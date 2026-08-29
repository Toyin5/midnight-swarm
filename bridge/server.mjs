import { randomBytes } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { WebSocket } from 'ws';
import { Contract, ledger, pureCircuits } from './managed/checkpoint/contract/index.js';
import { BridgeError, createBridgeServer } from './protocol.mjs';
import { createLocalWallet, withDustRetry } from './wallet.mjs';

globalThis.WebSocket = WebSocket;

const port = Number.parseInt(process.env.BRIDGE_PORT ?? '3001', 10);
const managedPath = '/app/managed/checkpoint';
const manifestPath = process.env.MISSION_MANIFEST_PATH ?? '/public/mission-manifest.json';
const config = {
  indexer: process.env.MN_INDEXER_URL ?? 'http://indexer:8088/api/v4/graphql',
  indexerWS: process.env.MN_INDEXER_WS ?? 'ws://indexer:8088/api/v4/graphql/ws',
  nodeWS: process.env.MN_NODE_WS ?? 'ws://node:9944',
  proofServer: process.env.MN_PROOF_SERVER_URL ?? 'http://proof-server:6300',
};

const droneDefinitions = [
  { droneId: 'MS-01', bounds: [40n, 60n, 70n, 90n] },
  { droneId: 'MS-02', bounds: [20n, 40n, 25n, 45n] },
].map((definition) => ({ ...definition, secret: secretFor(definition.droneId) }));

let readiness = { status: 'initializing', mode: 'local-chain' };
let providers;
let walletContext;
let deployments = new Map();
let manifest;
let submitInProgress = false;
const results = new Map();
let initializationPhase = 'WALLET';

function secretFor(droneId) {
  const configured = droneId === 'MS-01' ? process.env.DRONE_SECRET_HEX : undefined;
  if (!configured) return Uint8Array.from(randomBytes(32));
  if (!/^[0-9a-fA-F]{64}$/.test(configured)) throw new Error('DRONE_SECRET_INVALID');
  return Uint8Array.from(Buffer.from(configured, 'hex'));
}

async function writeManifest() {
  await mkdir(dirname(manifestPath), { recursive: true });
  const temporaryPath = `${manifestPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
  await rename(temporaryPath, manifestPath);
}

async function initialize() {
  await rm(manifestPath, { force: true });
  process.stdout.write('Synchronizing local Midnight wallet…\n');
  walletContext = await createLocalWallet(config);
  const walletProvider = {
    getCoinPublicKey: () => walletContext.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletContext.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(transaction, ttl) {
      const recipe = await walletContext.wallet.balanceUnboundTransaction(
        transaction,
        {
          shieldedSecretKeys: walletContext.shieldedSecretKeys,
          dustSecretKey: walletContext.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletContext.wallet.finalizeRecipe(recipe);
    },
    submitTx: (transaction) => walletContext.wallet.submitTransaction(transaction),
  };
  const zkConfigProvider = new NodeZkConfigProvider(managedPath);
  providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'midnight-swarm-bridge',
      accountId: walletContext.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: () =>
        process.env.PRIVATE_STATE_PASSWORD ?? 'Local-Devnet-Development-Placeholder-1',
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
  const compiledContract = CompiledContract.make('checkpoint', Contract).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(managedPath),
  );

  process.stdout.write('Deploying the ROS checkpoint contract…\n');
  for (const definition of droneDefinitions) {
    initializationPhase = `DEPLOY_${definition.droneId.replace('-', '_')}`;
    const [minX, maxX, minY, maxY] = definition.bounds;
    const deployed = await withDustRetry(() =>
      deployContract(providers, {
        compiledContract,
        args: [
          pureCircuits.checkpointKey(minX, maxX, minY, maxY),
          pureCircuits.droneKey(definition.secret),
        ],
        privateStateId: `checkpoint-${definition.droneId}`,
        initialPrivateState: {},
      }),
    );
    deployments.set(definition.droneId, { definition, deployed });
  }

  initializationPhase = 'MANIFEST';
  manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mission: { id: 'MSN-2049', name: 'Silent Horizon', sector: 'Industrial Grid 7' },
    contracts: [...deployments].map(([droneId, { deployed }]) => ({
      droneId,
      address: deployed.deployTxData.public.contractAddress,
    })),
    localEvents: [],
  };
  await writeManifest();
  readiness = {
    status: 'ready',
    mode: 'local-chain',
    contracts: manifest.contracts.map(({ droneId, address }) => ({ droneId, address })),
  };
  process.stdout.write('Midnight bridge ready for ROS evidence.\n');
}

async function submitCheckpoint({ droneId, evidence: [x, y] }) {
  if (results.has(droneId)) return results.get(droneId);
  if (readiness.status !== 'ready') {
    throw new BridgeError('NOT_READY', 503);
  }
  if (submitInProgress) throw new BridgeError('BUSY', 409);

  submitInProgress = true;
  try {
    const { definition, deployed } = deployments.get(droneId);
    const [minX, maxX, minY, maxY] = definition.bounds;
    const call = await deployed.callTx.proveCheckpoint(
      x,
      y,
      minX,
      maxX,
      minY,
      maxY,
      definition.secret,
    );
    const result = {
      status: 'verified',
      source: 'on-chain',
      droneId,
      contractAddress: deployed.deployTxData.public.contractAddress,
      txId: call.public.txId,
      blockHeight: call.public.blockHeight.toString(),
    };
    results.set(droneId, result);
    return result;
  } catch {
    throw new BridgeError('INVALID_CLAIM', 422);
  } finally {
    submitInProgress = false;
  }
}

async function getCheckpointStatus(droneId) {
  if (readiness.status !== 'ready') throw new BridgeError('NOT_READY', 503);
  const deployment = deployments.get(droneId);
  if (!deployment) throw new BridgeError('NOT_FOUND', 404);
  const state = await providers.publicDataProvider.queryContractState(
    deployment.deployed.deployTxData.public.contractAddress,
  );
  const verified = state ? ledger(state.data).checkpointReached : false;
  return {
    droneId,
    status: verified ? 'verified' : 'pending',
    source: 'on-chain',
    contractAddress: deployment.deployed.deployTxData.public.contractAddress,
  };
}

const server = createBridgeServer({
  getHealth: () => readiness,
  getCheckpointStatus,
  submitCheckpoint,
});
server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Midnight bridge listening on port ${port}.\n`);
  void initialize().catch(() => {
    readiness = {
      status: 'failed',
      mode: 'local-chain',
      error: `${initializationPhase}_FAILED`,
    };
  });
});

async function shutdown() {
  server.close();
  await walletContext?.wallet.stop();
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
