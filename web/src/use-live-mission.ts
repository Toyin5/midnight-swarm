import { useCallback, useEffect, useState } from 'react';
import { networkConfig } from './network';
import {
  applyLocalEvents,
  applyVerifiedContract,
  liveInitialState,
  parseMissionManifest,
} from './live';
import { resetSimulation } from './simulator';
import type { ConnectionStatus, MissionManifest, SimulationState } from './types';

const STALE_AFTER_MS = 30_000;

export function useLiveMission(enabled: boolean) {
  const [state, setState] = useState<SimulationState>(resetSimulation);
  const [manifest, setManifest] = useState<MissionManifest>();
  const [status, setStatus] = useState<ConnectionStatus>('unconfigured');
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    let connected = 0;
    let failed = 0;
    let lastUpdate = Date.now();

    queueMicrotask(() => {
      if (cancelled) return;
      setStatus('connecting');
      setManifest(undefined);
      setState(resetSimulation());
    });

    void fetch('/mission-manifest.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Manifest unavailable');
        return response.json() as Promise<unknown>;
      })
      .then(async (value) => {
        if (cancelled) return;
        const nextManifest = parseMissionManifest(value);
        setManifest(nextManifest);
        setState(liveInitialState(nextManifest));
        const [{ indexerPublicDataProvider }, { ledger }] = await Promise.all([
          import('@midnight-ntwrk/midnight-js-indexer-public-data-provider'),
          import('../../contract/src/managed/checkpoint/contract/index.js'),
        ]);
        if (cancelled) return;
        const provider = indexerPublicDataProvider(
          networkConfig.indexerUrl,
          networkConfig.indexerWsUrl,
          globalThis.WebSocket as unknown as Parameters<typeof indexerPublicDataProvider>[2],
        );

        for (const contract of nextManifest.contracts) {
          const address = contract.address as Parameters<
            typeof provider.contractStateObservable
          >[0];
          const subscription = provider
            .contractStateObservable(address, { type: 'latest' })
            .subscribe({
              next: (contractState) => {
                if (cancelled) return;
                connected += 1;
                lastUpdate = Date.now();
                setStatus(failed > 0 ? 'partial' : 'connected');
                const publicState = ledger(contractState.data);
                if (publicState.checkpointReached) {
                  setState((current) =>
                    applyVerifiedContract(current, contract.droneId, contract.address),
                  );
                }
              },
              error: () => {
                if (cancelled) return;
                failed += 1;
                setStatus(connected > 0 ? 'partial' : 'offline');
              },
            });
          cleanups.push(() => subscription.unsubscribe());
        }

        const staleTimer = window.setInterval(() => {
          if (!cancelled && connected > 0 && Date.now() - lastUpdate > STALE_AFTER_MS) {
            setStatus('stale');
          }
        }, 5_000);
        cleanups.push(() => window.clearInterval(staleTimer));

        const manifestTimer = window.setInterval(() => {
          void fetch('/mission-manifest.json', { cache: 'no-store' })
            .then((response) => response.json() as Promise<unknown>)
            .then(parseMissionManifest)
            .then((latest) => {
              if (!cancelled) setState((current) => applyLocalEvents(current, latest.localEvents));
            })
            .catch(() => undefined);
        }, 3_000);
        cleanups.push(() => window.clearInterval(manifestTimer));
      })
      .catch(() => {
        if (!cancelled) setStatus('unconfigured');
      });

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [enabled, retryKey]);

  return { state, manifest, status, retry };
}
