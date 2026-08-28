import { describe, expect, it } from 'vitest';
import { advanceSimulation, resetSimulation } from './simulator';

describe('mission simulator', () => {
  it('runs the deterministic mission without exposing private evidence', () => {
    let state = { ...resetSimulation(), running: true };
    while (state.running) state = advanceSimulation(state);

    expect(state.mission.completedCheckpoints).toBe(2);
    expect(state.failedProofs).toBe(1);
    expect(state.events.map(({ droneId, status }) => ({ droneId, status }))).toEqual([
      { droneId: 'MS-12', status: 'verified' },
      { droneId: 'MS-07', status: 'failed' },
      { droneId: 'MS-01', status: 'verified' },
    ]);
    expect(JSON.stringify(state)).not.toMatch(/"x"|"y"|minX|maxX|minY|maxY/);
  });
});
