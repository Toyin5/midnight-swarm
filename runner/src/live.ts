import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  createKeystore,
  DustWallet,
  HDWallet,
  NoOpTransactionHistoryStorage,
  PublicKey,
  Roles,
  ShieldedWallet,
  UnshieldedWallet,
  WalletFacade,
} from '@midnight-ntwrk/wallet-sdk';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';
import * as Checkpoint from '../../contract/src/managed/checkpoint/contract/index.js';

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ZK_CONFIG_PATH = path.join(ROOT, 'contract/src/managed/checkpoint');
const MANIFEST_PATH = path.join(ROOT, 'web/public/mission-manifest.json');
const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';
const INDEXER_URL = process.env.MIDNIGHT_INDEXER_URL ?? 'http://127.0.0.1:8088/api/v4/graphql';
const INDEXER_WS_URL =
  process.env.MIDNIGHT_INDEXER_WS_URL ?? 'ws://127.0.0.1:8088/api/v4/graphql/ws';
const NODE_URL = process.env.MIDNIGHT_NODE_URL ?? 'ws://127.0.0.1:9944';
const PROOF_SERVER_URL = process.env.MIDNIGHT_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300';

const PRIVATE_EVIDENCE = [
  { droneId: 'MS-01', point: [52n, 81n], bounds: [40n, 60n, 70n, 90n], secret: bytes32('aster') },
  { droneId: 'MS-07', point: [74n, 30n], bounds: [18n, 38n, 22n, 42n], secret: bytes32('kestrel') },
  { droneId: 'MS-12', point: [27n, 33n], bounds: [18n, 38n, 22n, 42n], secret: bytes32('nova') },
] as const;

function bytes32(value: string): Uint8Array {
  const output = new Uint8Array(32);
  output.set(new TextEncoder().encode(`midnight-swarm:${value}`).slice(0, 32));
  return output;
}

function deriveWalletKeys() {
  const result = HDWallet.fromSeed(Buffer.from(GENESIS_SEED, 'hex'));
  if (result.type !== 'seedOk') throw new Error('Local genesis wallet seed is invalid');
  const derived = result.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  result.hdWallet.clear();
  if (derived.type !== 'keysDerived') throw new Error('Could not derive local wallet keys');
  return derived.keys;
}

async function createWallet() {
  setNetworkId('undeployed');
  const keys = deriveWalletKeys();
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
  const configuration = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: INDEXER_URL, indexerWsUrl: INDEXER_WS_URL },
    provingServerUrl: new URL(PROOF_SERVER_URL),
    relayURL: new URL(NODE_URL),
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };
  const wallet = await WalletFacade.init({
    configuration,
    shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) =>
      UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config) =>
      DustWallet(config).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      ),
  });
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  const state = await wallet.waitForSyncedState();
  const unregistered = state.unshielded.availableCoins.filter(
    (coin) => !coin.meta?.registeredForDustGeneration,
  );
  if (unregistered.length > 0) {
    const recipe = await wallet.registerNightUtxosForDustGeneration(
      unregistered,
      unshieldedKeystore.getPublicKey(),
      (payload) => unshieldedKeystore.signData(payload),
    );
    await wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
  }
  await Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.filter((next) => next.isSynced && next.dust.balance(new Date()) > 0n),
      Rx.timeout({ first: 300_000 }),
    ),
  );
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

async function main() {
  process.stdout.write('Syncing local Midnight wallet…\n');
  const wallet = await createWallet();
  const walletProvider = {
    getCoinPublicKey: () => wallet.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => wallet.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: Parameters<typeof wallet.wallet.balanceUnboundTransaction>[0], ttl?: Date) {
      const recipe = await wallet.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: wallet.shieldedSecretKeys, dustSecretKey: wallet.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return wallet.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: Parameters<typeof wallet.wallet.submitTransaction>[0]) =>
      wallet.wallet.submitTransaction(tx),
  };
  const zkConfigProvider = new NodeZkConfigProvider<'proveCheckpoint'>(ZK_CONFIG_PATH);
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'midnight-swarm-runner',
      accountId: wallet.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: () =>
        process.env.PRIVATE_STATE_PASSWORD ?? 'Local-Devnet-Development-Placeholder-1',
    }),
    publicDataProvider: indexerPublicDataProvider(INDEXER_URL, INDEXER_WS_URL),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER_URL, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
  const compiledContract = CompiledContract.make('checkpoint', Checkpoint.Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  );

  const deployments = [];
  process.stdout.write('Deploying three checkpoint contracts…\n');
  for (const evidence of PRIVATE_EVIDENCE) {
    const [minX, maxX, minY, maxY] = evidence.bounds;
    const deployed = await deployContract(providers, {
      compiledContract,
      args: [
        Checkpoint.pureCircuits.checkpointKey(minX, maxX, minY, maxY),
        Checkpoint.pureCircuits.droneKey(evidence.secret),
      ],
      privateStateId: `checkpoint-${evidence.droneId}`,
      initialPrivateState: {},
    });
    deployments.push({ evidence, deployed });
  }

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mission: { id: 'MSN-2049', name: 'Silent Horizon', sector: 'Industrial Grid 7' },
    contracts: deployments.map(({ evidence, deployed }) => ({
      droneId: evidence.droneId,
      address: deployed.deployTxData.public.contractAddress,
    })),
    localEvents: [] as Array<Record<string, string>>,
  } as const;
  await writeManifest(manifest);

  process.stdout.write('Submitting success, rejection, success…\n');
  for (const { evidence, deployed } of deployments) {
    const [x, y] = evidence.point;
    const [minX, maxX, minY, maxY] = evidence.bounds;
    try {
      await deployed.callTx.proveCheckpoint(x, y, minX, maxX, minY, maxY, evidence.secret);
    } catch (error) {
      if (evidence.droneId !== 'MS-07') throw error;
      manifest.localEvents.push({
        id: `local-${evidence.droneId}`,
        droneId: evidence.droneId,
        title: 'Checkpoint proof rejected',
        detail: 'The private claim was rejected before ledger submission.',
        status: 'failed',
        timestamp: 'LOCAL',
        source: 'local',
      });
      await writeManifest(manifest);
    }
  }

  const verified = await Promise.all(
    deployments.map(async ({ deployed }) => {
      const address = deployed.deployTxData.public.contractAddress;
      const contractState = await providers.publicDataProvider.queryContractState(address);
      return contractState ? Checkpoint.ledger(contractState.data).checkpointReached : false;
    }),
  );
  if (verified.join(',') !== 'true,false,true') {
    throw new Error('Public ledger outcomes did not match the mission sequence');
  }

  await wallet.wallet.stop();
  process.stdout.write('Live mission ready. No private evidence was logged or published.\n');
}

async function writeManifest(manifest: object) {
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
}

main().catch((error: unknown) => {
  console.error(error);
  process.stderr.write(
    `Live mission failed: ${error instanceof Error ? error.name : 'UnknownError'}\n`,
  );
  process.exitCode = 1;
});
