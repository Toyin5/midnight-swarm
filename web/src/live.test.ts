import { describe, expect, it } from 'vitest';
import { applyVerifiedContract, liveInitialState, parseMissionManifest } from './live';

const manifest = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  mission: { id: 'MSN-2049', name: 'Silent Horizon', sector: 'Industrial Grid 7' },
  contracts: ['MS-01', 'MS-07', 'MS-12'].map((droneId, index) => ({
    droneId,
    address: String(index + 1).padStart(64, '0'),
  })),
  localEvents: [
    {
      id: 'local-MS-07',
      droneId: 'MS-07',
      title: 'Checkpoint proof rejected',
      detail: 'The private claim was rejected before ledger submission.',
      status: 'failed',
      timestamp: 'LOCAL',
      source: 'local',
    },
  ],
};

describe('live mission public state', () => {
  it('produces two on-chain successes and one local rejection without private evidence', () => {
    const parsed = parseMissionManifest(manifest);
    let state = liveInitialState(parsed);
    state = applyVerifiedContract(state, 'MS-01', parsed.contracts[0].address);
    state = applyVerifiedContract(state, 'MS-12', parsed.contracts[2].address);

    expect(state.mission.completedCheckpoints).toBe(2);
    expect(state.failedProofs).toBe(1);
    expect(state.events.map((event) => event.source)).toEqual(['on-chain', 'on-chain', 'local']);
    expect(JSON.stringify(state)).not.toMatch(/"x"|"y"|bounds|secret|minX|maxX|minY|maxY/);
  });

  it('rejects malformed public manifests', () => {
    expect(() => parseMissionManifest({ ...manifest, contracts: [] })).toThrow();
  });
});
