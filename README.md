# Midnight Swarm

A hackathon prototype that proves drone mission progress on Midnight without publishing
coordinates, geofence bounds, flight paths, or drone credentials.

The demo has three pseudonymous drones. ROS supplies private checkpoint evidence for
`MS-01`; the internal bridge produces an invalid `MS-07` claim and a valid `MS-12` claim.
The dashboard finishes at two verified proofs, one local rejection, and 67% completion.

## Repository

- `contract/`: Compact 0.23 checkpoint contract and tests.
- `bridge/`: headless wallet, three deployments, proof submission, and internal HTTP API.
- `ros2_ws/`: ROS 2 Lyrical synthetic drone, monitor, forwarder, and visualization.
- `web/`: React/Vite dashboard with Mock and Local modes.
- `ARCHITECTURE.md`: runtime flow and privacy boundary.
- `BUILD_PLAN.md`: remaining milestones.

## Requirements

- Node.js 24 and npm 11
- Docker with Compose v2
- Compact toolchain 0.31.1 for host-side contract compilation
- `uv` for ROS-independent Python tests

```bash
compact update 0.31.1
npm install
```

## Mock Dashboard

Mock mode needs no Midnight or ROS services:

```bash
npm run dev
```

Open the Vite URL and select **Start Mission**.

## Live Local Demo

```bash
cp .env.local.example .env
npm run live
```

This builds and starts the Midnight node, indexer, proof server, bridge, and ROS simulator,
then starts Vite. Select **Local** in the dashboard. The bridge writes the gitignored public
manifest to `web/public/mission-manifest.json`; the browser reads only contract addresses
and public indexer state.

The first run can take several minutes while images and proving material are prepared. View
service progress with:

```bash
docker compose logs -f midnight-bridge ros-simulator
```

The ROS visualization is written to `demo-output/midnight-checkpoint.gif` after `MS-01`
verifies. Stop the application services with `Ctrl+C`, then stop the Compose stack:

```bash
npm run midnight:down
```

`npm run midnight:up` starts only the node, indexer, and proof server.

## Validation

```bash
npm run contract:compile
npm test
npm run build
npm run lint
npm run format:check
docker compose config --quiet

cd ros2_ws/src/midnight_checkpoint
UV_CACHE_DIR=/tmp/midnight-swarm-uv-cache uv run ruff check midnight_checkpoint test
UV_CACHE_DIR=/tmp/midnight-swarm-uv-cache uv run pytest
```

## Privacy Boundary

ROS sends `{ "droneId": "MS-01", "evidence": [x, y] }` only over the trusted internal
Compose network. The bridge owns checkpoint bounds and drone credentials. Its responses,
manifest, logs, dashboard state, and ledger state contain no raw evidence. The browser is
read-only and accepts no wallet seed or private key configuration.

This is synthetic hackathon infrastructure, not flight-control or production security
software. Never use real mission data or commit wallet credentials.
