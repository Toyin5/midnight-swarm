import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { WebSocket } from 'ws';
import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract } from './managed/checkpoint/contract/index.js';
import { buildGenesisWallet, ensureSpendableDust, withDustRetry } from './wallet.mjs';

globalThis.WebSocket = WebSocket;
setNetworkId('undeployed');

const UINT32_MAX = 2 ** 32 - 1;
const port = Number.parseInt(process.env.BRIDGE_PORT ?? '3001', 10);
const managedPath = '/app/managed/checkpoint';
const expectedBounds = [
  Number.parseInt(process.env.CHECKPOINT_MIN_X ?? '40', 10),
  Number.parseInt(process.env.CHECKPOINT_MAX_X ?? '60', 10),
  Number.parseInt(process.env.CHECKPOINT_MIN_Y ?? '70', 10),
  Number.parseInt(process.env.CHECKPOINT_MAX_Y ?? '90', 10),
];
const config = {
  walletNetworkId: 'undeployed',
  networkId: 'undeployed',
  indexer: process.env.MN_INDEXER_URL ?? 'http://indexer:8088/api/v4/graphql',
  indexerWS: process.env.MN_INDEXER_WS ?? 'ws://indexer:8088/api/v4/graphql/ws',
  node: process.env.MN_NODE_URL ?? 'http://node:9944',
  nodeWS: process.env.MN_NODE_WS ?? 'ws://node:9944',
  proofServer: process.env.MN_PROOF_SERVER_URL ?? 'http://proof-server:6300',
  faucet: '',
};

let readiness = { status: 'initializing', mode: 'local-chain' };
let deployedContract;
let submitInProgress = false;

function droneSecret() {
  const value = process.env.DRONE_SECRET_HEX;
  if (!value) return Uint8Array.from(randomBytes(32));
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('DRONE_SECRET_HEX must contain exactly 64 hexadecimal characters');
  }
  return Uint8Array.from(Buffer.from(value, 'hex'));
}

function parseEvidence(body) {
  const value = JSON.parse(body);
  if (!Array.isArray(value.evidence) || value.evidence.length !== 6) {
    throw new Error('evidence must contain [x, y, minX, maxX, minY, maxY]');
  }
  if (!value.evidence.every(Number.isInteger)) throw new Error('evidence values must be integers');
  if (value.evidence.some((item) => item < 0 || item > UINT32_MAX)) {
    throw new Error('evidence values must fit Compact Uint<32>');
  }
  if (!value.evidence.slice(2).every((item, index) => item === expectedBounds[index])) {
    throw new Error('checkpoint bounds do not match the deployed commitment');
  }
  return value.evidence.map(BigInt);
}

async function commitmentContext(contract) {
  const placeholder = new Uint8Array(32);
  const initial = await contract.initialState(
    createConstructorContext({}, '0'.repeat(64)),
    placeholder,
    placeholder,
  );
  return {
    currentPrivateState: initial.currentPrivateState,
    currentZswapLocalState: initial.currentZswapLocalState,
    costModel: CostModel.initialCostModel(),
    currentQueryContext: new QueryContext(
      initial.currentContractState.data,
      sampleContractAddress(),
    ),
  };
}

async function initialize() {
  console.info('Synchronizing the pre-funded local genesis wallet');
  const wallet = await buildGenesisWallet(config);
  await ensureSpendableDust(wallet);
  console.info('Local wallet has spendable DUST');

  const secret = droneSecret();
  const contract = new Contract({});
  const context = await commitmentContext(contract);
  const checkpointCommitment = (await contract.circuits.checkpointKey(
    context,
    ...expectedBounds.map(BigInt),
  )).result;
  const droneCommitment = (await contract.circuits.droneKey(context, secret)).result;
  if (!(checkpointCommitment instanceof Uint8Array) || checkpointCommitment.length !== 32) {
    throw new Error('Compact checkpoint commitment did not resolve to Bytes<32>');
  }
  if (!(droneCommitment instanceof Uint8Array) || droneCommitment.length !== 32) {
    throw new Error('Compact drone commitment did not resolve to Bytes<32>');
  }
  const zkConfigProvider = new NodeZkConfigProvider(managedPath);
  const privateStoragePassword = `Local-${randomBytes(16).toString('hex')}!Aa1`;
  const walletProvider = {
    getCoinPublicKey: () => wallet.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => wallet.shieldedSecretKeys.encryptionPublicKey,
    balanceTx: async (transaction, ttl = ttlOneHour()) => {
      const recipe = await wallet.wallet.balanceUnboundTransaction(
        transaction,
        {
          shieldedSecretKeys: wallet.shieldedSecretKeys,
          dustSecretKey: wallet.dustSecretKey,
        },
        { ttl },
      );
      return wallet.wallet.finalizeRecipe(recipe);
    },
    submitTx: (transaction) => wallet.wallet.submitTransaction(transaction),
  };
  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'midnight-swarm-private-state',
      signingKeyStoreName: 'midnight-swarm-signing-keys',
      privateStoragePasswordProvider: () => privateStoragePassword,
      accountId: wallet.unshieldedKeystore.getBech32Address().asString(),
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexer, config.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
  const compiledContract = CompiledContract.withCompiledFileAssets(
    CompiledContract.withWitnesses(CompiledContract.make('checkpoint', Contract), {}),
    managedPath,
  );

  console.info('Deploying checkpoint contract to the local Midnight node');
  const deployed = await withDustRetry(() =>
    deployContract(providers, {
      compiledContract,
      args: [checkpointCommitment, droneCommitment],
    }),
  );
  deployedContract = { deployed, secret };
  readiness = {
    status: 'ready',
    mode: 'local-chain',
    contractAddress: deployed.deployTxData.public.contractAddress,
  };
  console.info('Checkpoint contract deployed and local bridge is ready');
}

function respond(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    respond(response, readiness.status === 'ready' ? 200 : 503, readiness);
    return;
  }
  if (request.method !== 'POST' || request.url !== '/checkpoint') {
    respond(response, 404, { error: 'not found' });
    return;
  }
  if (readiness.status !== 'ready') {
    respond(response, 503, readiness);
    return;
  }
  if (submitInProgress) {
    respond(response, 409, { status: 'pending', error: 'checkpoint submission already in progress' });
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 4096) request.destroy();
  });
  request.on('end', async () => {
    submitInProgress = true;
    try {
      const [x, y, minX, maxX, minY, maxY] = parseEvidence(body);
      const call = await deployedContract.deployed.callTx.proveCheckpoint(
        x,
        y,
        minX,
        maxX,
        minY,
        maxY,
        deployedContract.secret,
      );
      console.info('Checkpoint proof finalized on the local Midnight network');
      respond(response, 200, {
        status: 'verified',
        mode: 'local-chain',
        contractAddress: readiness.contractAddress,
        txId: call.public.txId,
        blockHeight: call.public.blockHeight.toString(),
      });
    } catch (error) {
      const message = String(error.message ?? error);
      console.warn(`Local Midnight checkpoint transaction failed: ${message}`);
      if (error instanceof Error && error.stack) console.warn(error.stack);
      if (error && typeof error === 'object' && 'cause' in error) {
        console.warn('Checkpoint transaction failure cause:', error.cause);
      }
      respond(response, 422, { status: 'failed', error: message });
    } finally {
      submitInProgress = false;
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.info(`Midnight bridge listening on port ${port}`);
  initialize().catch((error) => {
    readiness = { status: 'failed', mode: 'local-chain', error: String(error.message ?? error) };
    console.error('Midnight bridge initialization failed');
  });
});
