import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { describe, expect, it } from 'vitest';
import { CheckpointSimulator, type Bounds } from './checkpoint-simulator.js';

setNetworkId('undeployed');

const bounds: Bounds = { minX: 40n, maxX: 60n, minY: 70n, maxY: 90n };
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

describe('checkpoint contract', () => {
  it('accepts a valid authorized checkpoint proof', () => {
    const secret = randomBytes(32);
    const ledger = new CheckpointSimulator(bounds, secret).prove(52n, 81n, bounds, secret);

    expect(ledger.checkpointReached).toBe(true);
    expect(ledger.verifiedProofCount).toBe(1n);
  });

  it('rejects a point outside the checkpoint', () => {
    const secret = randomBytes(32);
    const simulator = new CheckpointSimulator(bounds, secret);

    expect(() => simulator.prove(61n, 81n, bounds, secret)).toThrow('Checkpoint not reached');
  });

  it('rejects altered checkpoint bounds', () => {
    const secret = randomBytes(32);
    const simulator = new CheckpointSimulator(bounds, secret);

    expect(() => simulator.prove(52n, 81n, { ...bounds, maxX: 61n }, secret)).toThrow(
      'Checkpoint commitment mismatch',
    );
  });

  it('rejects an unauthorized drone secret', () => {
    const simulator = new CheckpointSimulator(bounds, randomBytes(32));

    expect(() => simulator.prove(52n, 81n, bounds, randomBytes(32))).toThrow('Unauthorized drone');
  });
});
