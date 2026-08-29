import type { MissionManifest, ProofEvent, SimulationState } from './types';
import { resetSimulation } from './simulator';

const DRONE_IDS = new Set(['MS-01', 'MS-07', 'MS-12']);
const ADDRESS_PATTERN = /^[0-9a-f]{64}$/i;

export function parseMissionManifest(value: unknown): MissionManifest {
  if (!value || typeof value !== 'object') throw new Error('Manifest is missing');
  const manifest = value as Partial<MissionManifest>;
  if (
    manifest.version !== 1 ||
    typeof manifest.generatedAt !== 'string' ||
    !manifest.mission ||
    typeof manifest.mission.id !== 'string' ||
    typeof manifest.mission.name !== 'string' ||
    typeof manifest.mission.sector !== 'string' ||
    !Array.isArray(manifest.contracts) ||
    manifest.contracts.length !== 1 ||
    !Array.isArray(manifest.localEvents)
  ) {
    throw new Error('Manifest has an unsupported shape');
  }

  const ids = new Set<string>();
  for (const contract of manifest.contracts) {
    if (
      !contract ||
      !DRONE_IDS.has(contract.droneId) ||
      !ADDRESS_PATTERN.test(contract.address) ||
      ids.has(contract.droneId)
    ) {
      throw new Error('Manifest contains an invalid contract');
    }
    ids.add(contract.droneId);
  }
  if (!ids.has('MS-01')) throw new Error('Manifest is missing the ROS drone contract');

  for (const item of manifest.localEvents) {
    if (
      !item ||
      item.status !== 'failed' ||
      item.source !== 'local' ||
      !DRONE_IDS.has(item.droneId) ||
      typeof item.id !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.detail !== 'string' ||
      typeof item.timestamp !== 'string'
    ) {
      throw new Error('Manifest contains an invalid local event');
    }
  }

  return manifest as MissionManifest;
}

export function liveInitialState(manifest: MissionManifest): SimulationState {
  const state = resetSimulation();
  return applyLocalEvents(
    {
      ...state,
      mission: {
        ...state.mission,
        ...manifest.mission,
        status: 'active',
        completedCheckpoints: 0,
        totalCheckpoints: 1,
      },
      drones: state.drones.filter((drone) => drone.id === 'MS-01'),
    },
    manifest.localEvents,
  );
}

export function applyLocalEvents(state: SimulationState, events: ProofEvent[]): SimulationState {
  const additions = events.filter((event) => !state.events.some((item) => item.id === event.id));
  if (additions.length === 0) return state;
  const failedIds = new Set(additions.map((item) => item.droneId));
  return {
    ...state,
    drones: state.drones.map((drone) =>
      failedIds.has(drone.id) && drone.proofStatus !== 'verified'
        ? { ...drone, status: 'attention', proofStatus: 'failed' }
        : drone,
    ),
    events: [...additions, ...state.events],
    failedProofs: state.failedProofs + additions.length,
  };
}

export function applyVerifiedContract(
  state: SimulationState,
  droneId: string,
  address: string,
): SimulationState {
  if (state.events.some((item) => item.source === 'on-chain' && item.droneId === droneId)) {
    return state;
  }

  const event: ProofEvent = {
    id: `chain-${droneId}`,
    droneId,
    title: 'Checkpoint proof verified',
    detail: 'Midnight ledger state confirms the committed checkpoint rule was satisfied.',
    status: 'verified',
    timestamp: 'LIVE',
    source: 'on-chain',
    contractAddress: address,
  };
  const completedCheckpoints = state.mission.completedCheckpoints + 1;

  return {
    ...state,
    mission: {
      ...state.mission,
      completedCheckpoints,
      status: completedCheckpoints === state.mission.totalCheckpoints ? 'complete' : 'active',
    },
    drones: state.drones.map((drone) =>
      drone.id === droneId ? { ...drone, status: 'complete', proofStatus: 'verified' } : drone,
    ),
    events: [event, ...state.events],
  };
}
