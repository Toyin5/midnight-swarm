import { describe, expect, it } from 'vitest';
import { applyVerifiedContract, liveInitialState, parseMissionManifest } from './live';

const manifest = {
  version: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  mission: { id: 'MSN-2049', name: 'Silent Horizon', sector: 'Industrial Grid 7' },
  contracts: [{ droneId: 'MS-01', address: '1'.padStart(64, '0') }],
  localEvents: [],
};

describe('live mission public state', () => {
  it('starts fresh and applies only the ROS-driven on-chain success', () => {
    const parsed = parseMissionManifest(manifest);
    let state = liveInitialState(parsed);
    expect(state.drones.map((drone) => drone.id)).toEqual(['MS-01']);
    expect(state.mission.completedCheckpoints).toBe(0);
    expect(state.events).toEqual([]);
    state = applyVerifiedContract(state, 'MS-01', parsed.contracts[0].address);

    expect(state.mission.completedCheckpoints).toBe(1);
    expect(state.mission.status).toBe('complete');
    expect(state.failedProofs).toBe(0);
    expect(state.events.map((event) => event.source)).toEqual(['on-chain']);
    expect(JSON.stringify(state)).not.toMatch(/"x"|"y"|bounds|secret|minX|maxX|minY|maxY/);
  });

  it('rejects malformed public manifests', () => {
    expect(() => parseMissionManifest({ ...manifest, contracts: [] })).toThrow();
  });
});
