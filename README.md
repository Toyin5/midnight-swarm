# Privacy-Preserving Drone Swarm Coordination on Midnight

A hackathon prototype that lets a drone swarm prove mission progress without publishing sensitive operational data.

## The Problem

Blockchain can provide a shared, tamper-resistant history of drone activity, but recording GPS coordinates, flight paths, camera feeds, or sensor readings exposes confidential mission data. That is unacceptable in military, industrial, infrastructure, and emergency-response settings.

## The Idea

Each drone keeps its raw location and sensor evidence private and generates a zero-knowledge proof for a mission claim such as:

- checkpoint reached;
- sector scanned;
- delivery completed;
- geofence requirements satisfied.

Only the verified outcome is recorded on Midnight. Operators see trustworthy mission progress without receiving the underlying evidence.

> Instead of putting sensitive swarm data on-chain, we put verifiable proof of mission progress on-chain.

## Hackathon MVP

The first end-to-end demo will focus on one claim: **checkpoint reached**.

1. An operator assigns a checkpoint to a simulated drone.
2. The drone keeps its coordinates private.
3. A Compact contract verifies whether the private evidence satisfies the checkpoint rule.
4. The public mission history records the event and verification result, not the coordinates.
5. The dashboard shows swarm status, assignments, proof state, alerts, and mission progress.

The demo must include both a valid claim and a failed claim to make the trust boundary visible.

## Architecture

```text
Private drone/simulator evidence
              |
              v
    Compact proof generation
              |
              v
      Midnight verification
              |
              v
Public mission event -> Operator dashboard
```

Private: coordinates, paths, imagery, and sensor readings.

Public: pseudonymous drone/mission IDs, event type, proof result, and the minimum ledger metadata needed to order events.

## Repository Status

The runnable scaffold contains three npm workspaces:

- `contract/`: Compact `0.23` checkpoint contract and simulator tests.
- `runner/`: local deployment and proof submission; the only workspace that owns private evidence.
- `web/`: React, Vite, Tailwind, shadcn-style components, and deterministic mission dashboard.

The dashboard runs in mock mode by default. Local and preprod endpoint configuration is ready for the later wallet/provider integration.

## Prerequisites

- Node.js 24.11.1 or newer.
- npm 11 or newer.
- Docker with Compose v2 for the local Midnight services.
- [Compact devtools](https://github.com/midnightntwrk/compact/releases) with toolchain `0.31.1`.

Install or select the compiler toolchain:

```bash
compact update 0.31.1
```

## Run the Demo

```bash
npm install
npm run dev
```

Open the Vite URL, select **Start mission**, and watch the deterministic three-drone proof timeline. It finishes with two verified checkpoints, one rejected claim, and no private coordinates in UI state.

## Verify the Project

```bash
npm run contract:compile
npm test
npm run build
npm run lint
docker compose config --quiet
```

The first Compact compilation may download proving parameters.

## Midnight Environments

Mock mode requires no blockchain services. To start the local node, indexer, and proof server:

```bash
npm run midnight:up
npm run midnight:down
```

Copy `.env.local.example` or `.env.preprod.example` to `.env` to show the intended target in the dashboard. Preprod uses the public node/indexer endpoints with a local proof server:

```bash
docker compose up -d --wait proof-server
```

These configurations contain no wallet secrets. Lace integration remains intentionally deferred.

### Run the live local demo

```bash
cp .env.local.example .env
npm run live
```

This starts the local Midnight stack, compiles the contract, deploys three checkpoint contracts, submits the deterministic success/rejection/success sequence, writes the gitignored public mission manifest, and starts the dashboard. Select **Local** if it is not already active.

The browser subscribes to all three contract states through the indexer. Verified results are marked `ON-CHAIN`; the rejected proof is marked `LOCAL` because it never changes ledger state. Contract addresses are public and can be copied from the swarm table. Retry is available for offline, partial, and stale connections.

## Development Priorities

1. Connect the Compact contract to a local Midnight provider.
2. Deploy and read public mission state locally.
3. Add Lace wallet support for preprod.
4. Replace mock submissions while retaining the deterministic demo fallback.
5. Rehearse the demo before adding more event types.

## Optional Midnight Development Tools

The [Midnight Expert marketplace](https://github.com/midnightntwrk/midnight-expert) provides Claude Code plugins for Compact, DApp, wallet, devnet, quality, and verification workflows. The most relevant plugins are listed in [`AGENT.md`](./AGENT.md). They support development but are not dependencies of this application.

## Safety and Scope

This is a coordination and monitoring prototype, not flight-control software. Use simulated or non-sensitive data only. Never commit wallet secrets, real mission coordinates, private imagery, or confidential sensor data.

## Team

Built collaboratively for a hackathon. Add team members, submission links, screenshots, and the final demo video here when available.
