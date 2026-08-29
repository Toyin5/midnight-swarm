import { createServer } from 'node:http';

const UINT32_MAX = 2 ** 32 - 1;
const DRONE_IDS = new Set(['MS-01', 'MS-02']);

export class BridgeError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function parseCheckpointRequest(body) {
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    throw new BridgeError('INVALID_CLAIM', 422);
  }
  if (
    !value ||
    !DRONE_IDS.has(value.droneId) ||
    !Array.isArray(value.evidence) ||
    value.evidence.length !== 2 ||
    !value.evidence.every((item) => Number.isInteger(item) && item >= 0 && item <= UINT32_MAX)
  ) {
    throw new BridgeError('INVALID_CLAIM', 422);
  }
  return { droneId: value.droneId, evidence: value.evidence.map(BigInt) };
}

function respond(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

export async function handleBridgeRequest(
  { method, url, body = '' },
  { getHealth, getCheckpointStatus, submitCheckpoint },
) {
  if (method === 'GET' && url === '/health') {
    const health = getHealth();
    return { status: health.status === 'ready' ? 200 : 503, payload: health };
  }
  const statusMatch = url?.match(/^\/checkpoint-status\/(MS-0[12])$/);
  if (method === 'GET' && statusMatch) {
    try {
      return { status: 200, payload: await getCheckpointStatus(statusMatch[1]) };
    } catch (error) {
      const bridgeError =
        error instanceof BridgeError ? error : new BridgeError('INTERNAL_ERROR', 500);
      return { status: bridgeError.status, payload: { status: 'failed', error: bridgeError.code } };
    }
  }
  if (method !== 'POST' || url !== '/checkpoint') {
    return { status: 404, payload: { error: 'NOT_FOUND' } };
  }

  try {
    if (body.length > 4096) throw new BridgeError('INVALID_CLAIM', 422);
    const claim = parseCheckpointRequest(body);
    return { status: 200, payload: await submitCheckpoint(claim) };
  } catch (error) {
    const bridgeError =
      error instanceof BridgeError ? error : new BridgeError('INTERNAL_ERROR', 500);
    return {
      status: bridgeError.status,
      payload: { status: 'failed', error: bridgeError.code },
    };
  }
}

export function createBridgeServer(dependencies) {
  return createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', async () => {
      const result = await handleBridgeRequest(
        { method: request.method, url: request.url, body },
        dependencies,
      );
      respond(response, result.status, result.payload);
    });
  });
}
