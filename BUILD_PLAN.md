# Midnight Swarm Build Plan

## Current Baseline

- [x] Build the mock three-drone dashboard.
- [x] Implement the Compact checkpoint contract.
- [x] Test valid and rejected checkpoint proofs.
- [x] Configure local and preprod environments.
- [x] Verify responsive desktop and mobile layouts.
- [x] Pass build, test, lint, formatting, and Docker configuration checks.

## Next Milestone: Live Local Demo

- [x] Add a private `runner/` workspace that owns all private drone evidence.
- [x] Deploy three instances of the existing one-checkpoint contract.
- [x] Generate a gitignored public mission manifest containing only mission metadata and contract addresses.
- [x] Submit a deterministic success, rejection, success sequence from the runner.
- [x] Add a visible Mock/Local mode switch to the dashboard.
- [x] Subscribe to all three contracts through the Midnight indexer.
- [x] Label verified ledger results `ON-CHAIN` and rejected attempts `LOCAL`.
- [x] Add unconfigured, connecting, connected, partial, offline, retry, and stale-status states.
- [x] Add copy controls and links for contract addresses.
- [x] Verify that coordinates, bounds, secrets, and raw proof errors never reach web state, public manifests, logs, or ledger data.

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

- [ ] One command prepares and runs the local live demo.
- [ ] Two proofs verify on-chain.
- [ ] One proof rejects without changing ledger state.
- [ ] The dashboard updates without receiving private evidence.
- [ ] Mock mode remains usable when Midnight services are unavailable.
- [ ] Build, tests, lint, Docker validation, and responsive visual QA pass.
