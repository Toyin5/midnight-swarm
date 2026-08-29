# Midnight Swarm Build Plan

## Current Baseline

- [x] Build the mock three-drone dashboard.
- [x] Implement the Compact checkpoint contract.
- [x] Test valid and rejected checkpoint proofs.
- [x] Configure local and preprod environments.
- [x] Verify responsive desktop and mobile layouts.
- [x] Pass build, test, lint, formatting, and Docker configuration checks.
- [x] Integrate the synthetic ROS checkpoint flow with the live dashboard.

## Live Local Demo

- [x] Use `bridge/` as the single wallet, deployment, and proof-submission workspace.
- [x] Deploy one checkpoint contract for the ROS-driven `MS-01` mission.
- [x] Generate a gitignored public mission manifest containing only mission metadata and contract addresses.
- [x] Submit the ROS checkpoint claim through the bridge and wait for finalization.
- [x] Add a visible Mock/Local mode switch to the dashboard.
- [x] Subscribe to the `MS-01` contract through the Midnight indexer.
- [x] Label the finalized ledger result `ON-CHAIN`.
- [x] Add unconfigured, connecting, connected, partial, offline, retry, and stale-status states.
- [x] Add copy controls and links for contract addresses.
- [x] Verify that coordinates, bounds, secrets, and raw proof errors never reach web state, public manifests, logs, or ledger data.
- [x] Keep Local mode idle until ROS is explicitly started from a second terminal.
- [x] Add a persistent 15 FPS operator-local Matplotlib view without exposing poses to the dashboard.

## Later Milestones

### Preprod

- [ ] Fund deployment wallets.
- [ ] Validate the remote indexer and local proof-server flow.
- [ ] Add preprod contract links and network-specific configuration.

### Wallet Administration

- [ ] Add Lace only if operators must deploy or administer missions.
- [ ] Keep drone proof generation outside the operator browser.

### Contract v2

- [ ] Support multiple drones and checkpoints in one deployment.
- [ ] Add public mission and event identifiers with durable history.
- [ ] Preserve the privacy of coordinates, checkpoint bounds, and drone credentials.

### Real Drone Integration

- [ ] Replace synthetic evidence with a separate drone-side client.
- [ ] Add authenticated mission assignment and calibrated location inputs.
- [ ] Keep raw sensor evidence off the operator dashboard.

### Production Hardening

- [ ] Add authentication, authorization, deployment, monitoring, and recovery only if the prototype advances beyond the hackathon.
- [ ] Perform privacy, security, and circuit-cost reviews.

## Live Demo Acceptance Checklist

- [x] One command prepares the local chain, bridge, and dashboard.
- [x] A separate command explicitly starts the ROS flight.
- [x] The ROS-triggered proof verifies on-chain.
- [x] Contract tests cover both valid and rejected claims.
- [x] The dashboard updates without receiving private evidence.
- [x] Mock mode remains usable when Midnight services are unavailable.
- [x] Build, tests, lint, Docker validation, and responsive visual QA pass.
