# Agent Guide

## Mission

Build a hackathon MVP that proves one idea clearly:

> Sensitive drone data stays private; only verifiable mission progress is published on Midnight.

Do not build flight control, real drone networking, computer vision, or production fleet management. Simulated drones and sensor inputs are sufficient for the demo.

## Product Flow

1. ROS generates private evidence for `MS-01` and sends only `[x, y]` to the internal bridge.
2. The bridge owns checkpoint bounds, credentials, wallet state, deployments, and proof submission.
3. One Compact deployment verifies `MS-01`; a ROS coordinator reads its finalized public
   state through the indexer before publishing the `MS-02` start signal.
4. A second Compact deployment verifies `MS-02` at a different checkpoint.
5. The browser reads only the public manifest and public indexer state for both drones.

## Privacy Invariants

- Never place raw GPS coordinates, flight paths, images, video, or sensor readings on-chain or in public logs.
- Treat identifiers as potentially sensitive; use pseudonymous drone and mission IDs in the demo.
- Keep proof inputs private unless disclosure is explicitly required by the claim.
- Display proof status and mission outcome, not the underlying evidence.
- Do not claim privacy, security, or verification properties that the implementation does not demonstrate.

## MVP Scope

Implement the thinnest end-to-end vertical slice:

- one live mission and two sequential ROS-driven drones;
- one proof-backed event (`checkpoint reached` is the default);
- a live success path plus valid/invalid contract test coverage;
- an operator dashboard showing drone state, assignment, event history, proof status, and overall progress.

Add more event types only after that path works reliably.

## Repository Boundaries

- `contract/`: Compact contract and tests.
- `bridge/`: the only wallet, deployment, credential, and proof-submission service.
- `ros2_ws/`: synthetic private evidence and ROS visualization.
- `web/`: read-only Mock/Local dashboard; never add wallet keys or private evidence.

Prefer existing repository patterns and installed dependencies. Avoid adding services, databases, queues, abstractions, or deployment infrastructure unless the demo requires them.

## Definition of Done

- A valid private input produces a verified public mission event.
- An invalid claim is rejected or visibly fails verification.
- No raw private evidence appears in ledger state, dashboard payloads, console output, screenshots, or committed fixtures.
- The dashboard clearly distinguishes pending, verified, and failed events.
- A teammate can run the demo from the README.
- Tests cover the contract's valid and invalid claim paths.
- Local mode starts at zero with `MS-02` waiting, reaches 50% after finalized `MS-01` state,
  and reaches 100% only after `MS-02` also finalizes on-chain.
- `MS-02` must start from the coordinator's indexer-backed state read, never from a timer,
  raw pose observation, or unfinalized bridge response.
- The optional Matplotlib operator window opens once and updates the private trajectory in
  place; private position data remains outside the browser.

## Working Rules

- Inspect callers and data flow before editing; fix shared causes once.
- Keep commits and changes small enough for a teammate to review during the hackathon.
- Never overwrite another contributor's uncommitted work.
- Update the README when setup commands or the demo flow change.
- Record assumptions instead of silently inventing mission, privacy, or threat-model requirements.
- Never commit seed phrases, wallet keys, credentials, real coordinates, or confidential sensor data.

## Midnight References and Plugins

Use current official documentation and verify API/compiler versions before implementing. The [Midnight Expert plugin catalog](https://github.com/midnightntwrk/midnight-expert/tree/main/plugins) is optional tooling for Claude Code, not a runtime dependency.

Most useful plugins for this project:

- `compact-core`: Compact syntax, witnesses, disclosure rules, circuit cost, and review.
- `compact-examples`: current compilable contract patterns.
- `midnight-dapp-dev`: React DApp, provider, and wallet integration patterns.
- `midnight-tooling`: Compact toolchain, local devnet, indexer, and proof server.
- `midnight-wallet`: wallet SDK and test-wallet patterns.
- `midnight-cq`: formatting, type checking, tests, and CI once the first slice runs.
- `midnight-verify`: mechanically verify important Compact and SDK claims before the demo.

Do not copy generated examples blindly. Confirm that private inputs remain private and that public ledger fields match the dashboard's needs.
