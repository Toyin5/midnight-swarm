export type ProofStatus = 'idle' | 'generating' | 'verified' | 'failed';
export type NetworkTarget = 'mock' | 'local' | 'preprod';
export type DroneStatus = 'ready' | 'in-flight' | 'proving' | 'complete' | 'attention';

export interface Mission {
  id: string;
  name: string;
  sector: string;
  status: 'ready' | 'active' | 'complete';
  completedCheckpoints: number;
  totalCheckpoints: number;
}

export interface Drone {
  id: string;
  label: string;
  assignment: string;
  status: DroneStatus;
  proofStatus: ProofStatus;
  battery: number;
  sectorPosition: { leftPercent: number; topPercent: number };
}

export interface ProofEvent {
  id: string;
  droneId: string;
  title: string;
  detail: string;
  status: ProofStatus;
  timestamp: string;
}

export interface SimulationState {
  mission: Mission;
  drones: Drone[];
  events: ProofEvent[];
  step: number;
  running: boolean;
  failedProofs: number;
}
