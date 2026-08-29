import type { NetworkTarget } from './types';

const requestedTarget = import.meta.env.VITE_MIDNIGHT_NETWORK;

export const networkConfig = {
  target: (requestedTarget === 'local' || requestedTarget === 'preprod'
    ? requestedTarget
    : 'mock') as NetworkTarget,
  nodeUrl: import.meta.env.VITE_MIDNIGHT_NODE_URL ?? 'http://127.0.0.1:9944',
  indexerUrl: import.meta.env.VITE_MIDNIGHT_INDEXER_URL ?? 'http://127.0.0.1:8088/api/v4/graphql',
  indexerWsUrl:
    import.meta.env.VITE_MIDNIGHT_INDEXER_WS_URL ?? 'ws://127.0.0.1:8088/api/v4/graphql/ws',
  proofServerUrl: import.meta.env.VITE_MIDNIGHT_PROOF_SERVER_URL ?? 'http://127.0.0.1:6300',
  contractAddress: import.meta.env.VITE_MIDNIGHT_CONTRACT_ADDRESS || undefined,
  explorerUrl: import.meta.env.VITE_MIDNIGHT_EXPLORER_URL || undefined,
};
