import { describe, expect, it } from 'vitest';
import { BridgeError, handleBridgeRequest, parseCheckpointRequest } from './protocol.mjs';
import { withDustRetry } from './wallet.mjs';

describe('bridge public protocol', () => {
  it('accepts only supported drone points without publishing private fields', () => {
    expect(parseCheckpointRequest('{"droneId":"MS-01","evidence":[52,81]}')).toEqual({
      droneId: 'MS-01',
      evidence: [52n, 81n],
    });
    expect(parseCheckpointRequest('{"droneId":"MS-02","evidence":[30,35]}')).toEqual({
      droneId: 'MS-02',
      evidence: [30n, 35n],
    });
    expect(() =>
      parseCheckpointRequest('{"droneId":"MS-01","evidence":[52,81,40,60,70,90]}'),
    ).toThrow('INVALID_CLAIM');
  });

  it('exposes sanitized indexer-backed checkpoint status', async () => {
    const dependencies = {
      getHealth: () => ({ status: 'ready' }),
      getCheckpointStatus: (droneId) => ({
        droneId,
        status: 'verified',
        source: 'on-chain',
      }),
      submitCheckpoint: () => undefined,
    };
    expect(
      await handleBridgeRequest({ method: 'GET', url: '/checkpoint-status/MS-01' }, dependencies),
    ).toEqual({
      status: 200,
      payload: { droneId: 'MS-01', status: 'verified', source: 'on-chain' },
    });
  });

  it('sanitizes readiness, busy, and unexpected failures', async () => {
    const dependencies = {
      getHealth: () => ({ status: 'initializing', mode: 'local-chain' }),
      submitCheckpoint: () => {
        throw new Error('private proof details');
      },
    };
    expect(
      await handleBridgeRequest({ method: 'GET', url: '/health' }, dependencies),
    ).toMatchObject({ status: 503 });
    expect(
      await handleBridgeRequest(
        {
          method: 'POST',
          url: '/checkpoint',
          body: '{"droneId":"MS-01","evidence":[52,81]}',
        },
        dependencies,
      ),
    ).toEqual({
      status: 500,
      payload: { status: 'failed', error: 'INTERNAL_ERROR' },
    });

    const busy = {
      getHealth: () => ({ status: 'ready', mode: 'local-chain' }),
      submitCheckpoint: () => {
        throw new BridgeError('BUSY', 409);
      },
    };
    expect(
      await handleBridgeRequest(
        {
          method: 'POST',
          url: '/checkpoint',
          body: '{"droneId":"MS-01","evidence":[52,81]}',
        },
        busy,
      ),
    ).toMatchObject({ status: 409 });
  });

  it('bounds DUST retries without hiding unrelated errors', async () => {
    await expect(
      withDustRetry(() => Promise.reject(new Error('could not balance dust')), 0),
    ).rejects.toThrow('DUST_NOT_READY');
    await expect(
      withDustRetry(() => Promise.reject(new Error('deployment mismatch')), 0),
    ).rejects.toThrow('deployment mismatch');
  });
});
