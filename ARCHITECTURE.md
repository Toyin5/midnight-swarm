# Midnight Swarm Architecture

## Runtime Flow

```mermaid
flowchart LR
    R["ROS synthetic drone"] -->|"private pose"| M["Checkpoint monitor"]
    M -->|"internal evidence: x, y"| F["ROS forwarder"]
    F -->|"POST /checkpoint"| B["Midnight bridge"]
    B --> P["Proof server"]
    B --> N["Midnight node"]
    N --> I["Indexer"]
    B -->|"public result"| F
    F --> V["ROS visualization"]
    B -->|"public manifest"| W["React dashboard"]
    I -->|"public contract state"| W
```

The bridge deploys one checkpoint contract for `MS-01`. ROS triggers its only proof, and
the dashboard remains at zero progress until the indexer observes finalized public contract
state with `checkpointReached == true`.

## Components

| Component      | Responsibility                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| `contract/`    | Verifies committed bounds, credential authorization, and private point inclusion.    |
| `bridge/`      | Owns wallet, bounds, credentials, deployments, proof calls, and public manifest.     |
| `ros2_ws/`     | Generates a synthetic pose, detects arrival, retries submission, and renders output. |
| `web/`         | Shows Mock or indexer-backed Local mission state; contains no wallet.                |
| Docker Compose | Runs the node, indexer, proof server, bridge, and ROS simulator.                     |

`midnight-bridge` is reachable only on the Compose network. Only the development node,
indexer, proof server, and Vite interfaces are exposed to host loopback.

## Bridge Interface

`GET /health` reports initialization status and public deployment addresses. It contains no
private fields.

`POST /checkpoint` accepts:

```json
{ "droneId": "MS-01", "evidence": [52, 81] }
```

Success returns only status, source, drone ID, contract address, transaction ID, and block
height. Errors use sanitized codes: `NOT_READY`, `BUSY`, `INVALID_CLAIM`, or
`INTERNAL_ERROR`. A successful duplicate `MS-01` submission returns the cached public result.

## Public and Private Data

Private inside ROS and the bridge:

- observed coordinates and trajectory;
- checkpoint bounds;
- drone credentials;
- raw circuit and wallet errors.

Public:

- pseudonymous mission and drone IDs;
- contract addresses and commitments;
- `checkpointReached` and `verifiedProofCount`;
- transaction identifiers and block heights.

The manifest volume exposes only `web/public/mission-manifest.json`. Private state stores,
ROS evidence, and bridge secrets are neither mounted into `web/` nor logged. Internal ROS
and HTTP transport is trusted local-demo infrastructure and is not production-secured.

## Dashboard Contract

The dashboard loads the public manifest and subscribes to the MS-01 address through the
indexer. The verified state is labeled `ON-CHAIN`. It does not consume or display ROS pose
messages. A private operator may enable the Matplotlib window inside the simulated drone's
ROS environment with `MIDNIGHT_SWARM_LIVE_PLOT=1`. The local-only window exists to make the
private trajectory visible during the hackathon demo; it is never published over a network
or consumed by the website. It is a single persistent 3D figure updated at 15 Hz, while
off-screen PNG snapshots remain throttled to 5 Hz. Missing services leave Mock mode usable.

## Version Constraint

The bridge keeps a direct `@midnight-ntwrk/onchain-runtime-v3@3.0.0` dependency. Removing
that pin can install incompatible physical copies whose `StateValue` class identities fail
during transaction construction.

## Scope

The demo uses synthetic integer grid coordinates, a development wallet, one checkpoint per
contract, and trusted local transport. Browser wallets, real drones, authentication,
deployment, durable mission history, and production hardening remain in `BUILD_PLAN.md`.
