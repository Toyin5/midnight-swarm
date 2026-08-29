import { Buffer } from 'node:buffer';
import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
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

const GENESIS_SEED = '0000000000000000000000000000000000000000000000000000000000000001';

function deriveWalletKeys() {
  const result = HDWallet.fromSeed(Buffer.from(GENESIS_SEED, 'hex'));
  if (result.type !== 'seedOk') throw new Error('GENESIS_WALLET_INVALID');
  const derived = result.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  result.hdWallet.clear();
  if (derived.type !== 'keysDerived') throw new Error('WALLET_KEY_DERIVATION_FAILED');
  return derived.keys;
}

export async function createLocalWallet(config) {
  setNetworkId('undeployed');
  const keys = deriveWalletKeys();
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
  const wallet = await WalletFacade.init({
    configuration: {
      networkId,
      indexerClientConnection: {
        indexerHttpUrl: config.indexer,
        indexerWsUrl: config.indexerWS,
      },
      provingServerUrl: new URL(config.proofServer),
      relayURL: new URL(config.nodeWS),
      txHistoryStorage: new NoOpTransactionHistoryStorage(),
      costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
    },
    shielded: (childConfig) => ShieldedWallet(childConfig).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (childConfig) =>
      UnshieldedWallet(childConfig).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (childConfig) =>
      DustWallet(childConfig).startWithSecretKey(
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

export async function withDustRetry(attempt, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof Error) || !/could not balance dust/i.test(error.message)) throw error;
      if (Date.now() >= deadline) throw new Error('DUST_NOT_READY');
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}
