import type { Drone, ProofEvent, SimulationState } from './types';

// Private demo evidence never leaves this module or enters React state.
const PRIVATE_EVIDENCE = {
  'MS-01': { x: 52, y: 81, bounds: [40, 60, 70, 90] },
  'MS-07': { x: 74, y: 30, bounds: [18, 38, 22, 42] },
  'MS-12': { x: 27, y: 33, bounds: [18, 38, 22, 42] },
} as const;

const droneSeed: Drone[] = [
  {
    id: 'MS-01',
    label: 'Aster',
    assignment: 'Checkpoint Alpha',
    status: 'ready',
    proofStatus: 'idle',
    battery: 94,
    sectorPosition: { leftPercent: 68, topPercent: 26 },
  },
  {
    id: 'MS-07',
    label: 'Kestrel',
    assignment: 'Checkpoint Bravo',
    status: 'ready',
    proofStatus: 'idle',
    battery: 87,
    sectorPosition: { leftPercent: 38, topPercent: 61 },
  },
  {
    id: 'MS-12',
    label: 'Nova',
    assignment: 'Checkpoint Charlie',
    status: 'ready',
    proofStatus: 'idle',
    battery: 79,
    sectorPosition: { leftPercent: 24, topPercent: 36 },
  },
];

export const initialState: SimulationState = {
  mission: {
    id: 'MSN-2049',
    name: 'Silent Horizon',
    sector: 'Industrial Grid 7',
    status: 'ready',
    completedCheckpoints: 0,
    totalCheckpoints: 3,
  },
  drones: droneSeed,
  events: [],
  step: 0,
  running: false,
  failedProofs: 0,
};

function updateDrone(state: SimulationState, droneId: string, patch: Partial<Drone>): Drone[] {
  return state.drones.map((drone) => (drone.id === droneId ? { ...drone, ...patch } : drone));
}

function event(step: number, droneId: string, status: ProofEvent['status']): ProofEvent {
  const verified = status === 'verified';
  return {
    id: `proof-${step}`,
    droneId,
    title: verified ? 'Checkpoint proof verified' : 'Checkpoint proof rejected',
    detail: verified
      ? 'Private evidence satisfied the committed checkpoint rule.'
      : 'Private evidence did not satisfy the committed checkpoint rule.',
    status,
    timestamp: `T+${String(step * 8).padStart(2, '0')}s`,
  };
}

function evidencePasses(droneId: keyof typeof PRIVATE_EVIDENCE): boolean {
  const { x, y, bounds } = PRIVATE_EVIDENCE[droneId];
  const [minX, maxX, minY, maxY] = bounds;
  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

export function advanceSimulation(state: SimulationState): SimulationState {
  const step = state.step + 1;
  const next = { ...state, step, mission: { ...state.mission, status: 'active' as const } };

  if (step === 1) return { ...next, drones: updateDrone(state, 'MS-01', { status: 'in-flight' }) };
  if (step === 2)
    return {
      ...next,
      drones: updateDrone(state, 'MS-01', { status: 'proving', proofStatus: 'generating' }),
    };
  if (step === 3 && evidencePasses('MS-01'))
    return {
      ...next,
      mission: { ...next.mission, completedCheckpoints: 1 },
      drones: updateDrone(state, 'MS-01', { status: 'complete', proofStatus: 'verified' }),
      events: [event(step, 'MS-01', 'verified'), ...state.events],
    };
  if (step === 4) return { ...next, drones: updateDrone(state, 'MS-07', { status: 'in-flight' }) };
  if (step === 5)
    return {
      ...next,
      drones: updateDrone(state, 'MS-07', { status: 'proving', proofStatus: 'generating' }),
    };
  if (step === 6 && !evidencePasses('MS-07'))
    return {
      ...next,
      failedProofs: 1,
      drones: updateDrone(state, 'MS-07', { status: 'attention', proofStatus: 'failed' }),
      events: [event(step, 'MS-07', 'failed'), ...state.events],
    };
  if (step === 7) return { ...next, drones: updateDrone(state, 'MS-12', { status: 'in-flight' }) };
  if (step === 8)
    return {
      ...next,
      drones: updateDrone(state, 'MS-12', { status: 'proving', proofStatus: 'generating' }),
    };
  if (step === 9 && evidencePasses('MS-12'))
    return {
      ...next,
      running: false,
      mission: { ...next.mission, status: 'complete', completedCheckpoints: 2 },
      drones: updateDrone(state, 'MS-12', { status: 'complete', proofStatus: 'verified' }),
      events: [event(step, 'MS-12', 'verified'), ...state.events],
    };

  return { ...next, running: false };
}

export function resetSimulation(): SimulationState {
  return structuredClone(initialState);
}
