import { describe, expect, it } from 'vitest';
import { BridgeError, handleBridgeRequest, parseCheckpointRequest } from './protocol.mjs';
import { withDustRetry } from './wallet.mjs';

describe('bridge public protocol', () => {
  it('accepts only the MS-01 point without publishing private fields', () => {
    expect(parseCheckpointRequest('{"droneId":"MS-01","evidence":[52,81]}')).toEqual({
      droneId: 'MS-01',
      evidence: [52n, 81n],
    });
    expect(() =>
      parseCheckpointRequest('{"droneId":"MS-01","evidence":[52,81,40,60,70,90]}'),
    ).toThrow('INVALID_CLAIM');
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
