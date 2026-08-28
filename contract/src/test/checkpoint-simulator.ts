import {
  CostModel,
  QueryContext,
  type CircuitContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, type Ledger, ledger } from '../managed/checkpoint/contract/index.js';

export interface Bounds {
  minX: bigint;
  maxX: bigint;
  minY: bigint;
  maxY: bigint;
}

const EMPTY_PRIVATE_STATE = {};

export class CheckpointSimulator {
  readonly contract = new Contract<Record<string, never>>({});
  circuitContext: CircuitContext<Record<string, never>>;

  constructor(bounds: Bounds, droneSecret: Uint8Array) {
    const placeholder = new Uint8Array(32);
    const temporary = this.createContext(placeholder, placeholder);
    const checkpointCommitment = this.contract.circuits.checkpointKey(
      temporary,
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
    ).result;
    const droneCommitment = this.contract.circuits.droneKey(temporary, droneSecret).result;
    this.circuitContext = this.createContext(checkpointCommitment, droneCommitment);
  }

  private createContext(
    checkpointCommitment: Uint8Array,
    droneCommitment: Uint8Array,
  ): CircuitContext<Record<string, never>> {
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(EMPTY_PRIVATE_STATE, '0'.repeat(64)),
        checkpointCommitment,
        droneCommitment,
      );

    return {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
    };
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  prove(x: bigint, y: bigint, bounds: Bounds, droneSecret: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.proveCheckpoint(
      this.circuitContext,
      x,
      y,
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
      droneSecret,
    ).context;
    return this.getLedger();
  }
}
