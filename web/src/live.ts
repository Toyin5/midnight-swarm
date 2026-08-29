import type { MissionManifest, ProofEvent, SimulationState } from './types';
import { resetSimulation } from './simulator';

const DRONE_IDS = new Set(['MS-01', 'MS-02']);
const ADDRESS_PATTERN = /^[0-9a-f]{64}$/i;
const VERIFIED_SECTOR_POSITIONS = {
  'MS-01': { leftPercent: 72, topPercent: 70 },
  'MS-02': { leftPercent: 27, topPercent: 30 },
} as const;

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
    manifest.contracts.length !== 2 ||
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
  if (!ids.has('MS-01') || !ids.has('MS-02')) {
    throw new Error('Manifest is missing a sequential ROS drone contract');
  }

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
        totalCheckpoints: 2,
      },
      drones: [
        state.drones.find((drone) => drone.id === 'MS-01')!,
        {
          id: 'MS-02',
          label: 'Azure',
          assignment: 'Checkpoint Delta · waits for MS-01 ledger finality',
          status: 'ready',
          proofStatus: 'idle',
          battery: 91,
          sectorPosition: { leftPercent: 24, topPercent: 70 },
        },
      ],
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
    drones: state.drones.map((drone) => {
      if (drone.id === droneId) {
        return {
          ...drone,
          status: 'complete',
          proofStatus: 'verified',
          sectorPosition:
            VERIFIED_SECTOR_POSITIONS[droneId as keyof typeof VERIFIED_SECTOR_POSITIONS] ??
            drone.sectorPosition,
        };
      }
      if (droneId === 'MS-01' && drone.id === 'MS-02' && drone.proofStatus !== 'verified') {
        return { ...drone, status: 'in-flight', proofStatus: 'generating' };
      }
      return drone;
    }),
    events: [event, ...state.events],
  };
}
