import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
import * as Rx from 'rxjs';

const DUST_OPTIONS = {
  ledgerParams: LedgerParameters.initialParameters(),
  additionalFeeOverhead: 1_000n,
  feeBlocksMargin: 5,
};

function isComplete(progress) {
  return Boolean(progress && typeof progress.isStrictlyComplete === 'function' && progress.isStrictlyComplete());
}

function bounded(observable, label, timeoutMs = 300_000) {
  return Rx.firstValueFrom(
    observable.pipe(
      Rx.timeout({
        each: timeoutMs,
        with: () => Rx.throwError(() => new Error(`${label} timed out after ${timeoutMs}ms`)),
      }),
    ),
  );
}

export async function buildGenesisWallet(config) {
  const genesisSeed = BigInt(1).toString(16).padStart(64, '0');
  const { wallet, seeds, keystore } = await FluentWalletBuilder.forEnvironment(config)
    .withDustOptions(DUST_OPTIONS)
    .withSeed(genesisSeed)
    .buildWithoutStarting();
  const shieldedSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
  await wallet.start(shieldedSecretKeys, dustSecretKey);
  await bounded(
    wallet.state().pipe(
      Rx.filter(
        (state) =>
          isComplete(state.shielded.state.progress) &&
          isComplete(state.unshielded.progress) &&
          isComplete(state.dust.state.progress),
      ),
    ),
    'Local wallet synchronization',
  );
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore: keystore };
}

export async function ensureSpendableDust(context) {
  const state = await bounded(
    context.wallet.state().pipe(Rx.filter((value) => isComplete(value.unshielded.progress))),
    'Unshielded wallet synchronization',
  );
  const unregistered =
    state.unshielded?.availableCoins.filter(
      (coin) => coin.meta.registeredForDustGeneration === false,
    ) ?? [];

  if (unregistered.length > 0) {
    const recipe = await context.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      context.unshieldedKeystore.getPublicKey(),
      (payload) => context.unshieldedKeystore.signData(payload),
    );
    const finalized = await context.wallet.finalizeRecipe(recipe);
    await context.wallet.submitTransaction(finalized);
  }

  await bounded(
    context.wallet.state().pipe(
      Rx.filter((value) => (value.dust?.availableCoins.length ?? 0) >= 1),
    ),
    'Spendable DUST generation',
    180_000,
  );
}

export async function withDustRetry(attempt, timeoutMs = 180_000, intervalMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  for (let attemptNumber = 1; ; attemptNumber += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof Error) || !/could not balance dust/i.test(error.message)) {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `DUST was still not spendable after ${timeoutMs}ms (${attemptNumber} attempts): ${error.message}`,
        );
      }
      console.info(`DUST not spendable yet (attempt ${attemptNumber}); retrying in ${intervalMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}
