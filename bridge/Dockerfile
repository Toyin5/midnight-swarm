FROM node:24-bookworm AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY bridge/package.json ./package.json
RUN npm install --omit=dev

RUN curl --proto '=https' --tlsv1.2 -LsSf \
      https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh \
      | sh \
    && /root/.local/bin/compact update 0.31.1

COPY contract/src/checkpoint.compact ./checkpoint.compact
RUN /root/.local/bin/compact compile checkpoint.compact managed/checkpoint

FROM node:24-bookworm-slim AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/managed ./managed
COPY bridge/server.mjs ./server.mjs
COPY bridge/wallet.mjs ./wallet.mjs
COPY bridge/protocol.mjs ./protocol.mjs

ENV BRIDGE_PORT=3001
EXPOSE 3001
CMD ["node", "server.mjs"]
