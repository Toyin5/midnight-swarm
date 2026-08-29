# Agent Onboarding and Handoff

## Mission

This repository demonstrates a privacy-preserving drone checkpoint claim on a local
Midnight network. A synthetic ROS 2 drone flies from the origin to a configured target,
the ROS monitor detects arrival, and a Compact circuit proves the checkpoint claim. A
Matplotlib animation is produced after the blockchain result returns to ROS.

Read these files first:

1. `README.md` for product context and quick starts.
2. `ARCHITECTURE.md` for the component model and public/private boundary.
3. `AGENT.md` and every file under `agents/` for repository-specific agent guidance.
4. `docker-compose.yml` for the actual local topology.
5. `contract/src/checkpoint.compact` for the proof predicate.
6. `bridge/server.mjs` and `bridge/wallet.mjs` for the live chain integration.
7. `ros2_ws/src/midnight_checkpoint/` for the ROS pipeline.

Do not assume the React dashboard is connected to the live pipeline. It is currently a
polished deterministic mock, while Docker Compose contains the real ROS-to-Midnight path.

## Current components

| Path | Purpose |
| --- | --- |
| `contract/` | Compact 0.23 source, generated-code workflow, and TypeScript simulator tests |
| `bridge/` | Node.js wallet/provider integration and internal HTTP API |
| `ros2_ws/` | ROS 2 Lyrical Python package and simulator image |
| `web/` | React/Vite operator-dashboard mock |
| `docker-compose.yml` | Node, indexer, proof server, bridge, and ROS orchestration |
| `ARCHITECTURE.md` | Detailed architecture and operating model |

## End-to-end runtime flow

```text
numpy.linspace trajectory
  -> /drone/private_pose
  -> checkpoint_monitor (three stable in-bounds samples)
  -> /midnight/private_checkpoint_evidence
  -> bridge_forwarder
  -> POST http://midnight-bridge:3001/checkpoint
  -> Compact proveCheckpoint
  -> proof server + wallet balancing + local node
  -> finalized transaction response
  -> /midnight/checkpoint_result
  -> demo-output/midnight-checkpoint.gif
```

Default trajectory: `(0, 0, 0)` to `(52, 81, 20)`.

Default contract checkpoint: X `40..60`, Y `70..90`. Z is visual-only today.

## Local setup

Host requirements:

- Node.js 24.11.1 or newer and npm 11 or newer
- Docker Engine and Compose v2
- `uv` for the pure-Python ROS helper tests
- Compact toolchain 0.31.1 for host-side contract work

Install JavaScript dependencies:

```bash
npm install
```

Run the dashboard mock:

```bash
npm run dev
```

Run the real local pipeline:

```bash
sudo docker compose up -d --build --force-recreate midnight-bridge ros-simulator
sudo docker compose logs -f --tail=200 midnight-bridge ros-simulator
```

The first chain startup can take several minutes while the wallet synchronizes, DUST is
generated, the contract deploys, and proof material is prepared.

## Success criteria

All five services should be running; the first four expose health checks:

```bash
sudo docker compose ps -a
```

Expected log sequence:

```text
Local wallet has spendable DUST
Checkpoint contract deployed and local bridge is ready
Checkpoint evidence ready for the local Midnight bridge
Checkpoint proof finalized on the local Midnight network
Compact bridge verified checkpoint evidence
Midnight-verified 3D animation saved
```

Check deployment readiness:

```bash
sudo docker compose exec midnight-bridge \
  node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.json()).then(console.log)"
```

`status: ready` confirms wallet synchronization and contract deployment only. Transaction
finalization must be confirmed separately in logs or on `/midnight/checkpoint_result`.

Expected visualization artifacts:

```bash
ls -lh demo-output/
xdg-open demo-output/midnight-checkpoint.gif
```

## Validation commands

JavaScript, Compact, and React:

```bash
npm run contract:compile
npm test
npm run build
npm run lint
docker compose config --quiet
```

Pure-Python ROS logic:

```bash
cd ros2_ws/src/midnight_checkpoint
UV_CACHE_DIR=/tmp/midnight-swarm-uv-cache uv run ruff check midnight_checkpoint test
UV_CACHE_DIR=/tmp/midnight-swarm-uv-cache uv run pytest
```

The geometry suite currently contains five tests. Full ROS execution belongs in the ROS
image because `rclpy` and ROS messages are system packages rather than PyPI dependencies.

## Important implementation details

### Compact and Midnight versions

- Compact toolchain: `0.31.1`
- Compact language pragma: `0.23`
- Midnight.js packages: `4.1.1`
- Compact runtime: `0.16.0`
- On-chain runtime v3: exactly `3.0.0`
- Wallet SDK: `1.2.0`
- Node: `1.0.0`
- Indexer: `4.3.3`
- Proof server: `8.1.0`

Keep `@midnight-ntwrk/onchain-runtime-v3` pinned directly in `bridge/package.json`.
Without this pin, npm may install two physical runtime copies. `StateValue` created by one
copy then fails the other copy's `instanceof` check during `ChargedState` construction.

Generated Compact `initialState` and circuit calls may be asynchronous. Preserve the
`await` operations in `bridge/server.mjs` and the explicit 32-byte commitment checks.

### Wallet and DUST

The local bridge derives the pre-funded genesis wallet from seed `1`. It registers
eligible NIGHT UTXOs for DUST generation and retries deployment when DUST is synchronized
but temporarily not balanceable. This is development-only behavior.

The bridge generates an ephemeral drone secret unless
`MIDNIGHT_DRONE_SECRET_HEX` supplies exactly 64 hexadecimal characters. Never log this
secret or include it in ROS messages.

### Privacy model

Public ledger values are the two commitments, `checkpointReached`, and
`verifiedProofCount`. The position, bounds, and drone secret are proof material and are not
written into exported ledger state.

ROS and internal HTTP are local plaintext transports. Avoid claiming they provide
production confidentiality. Also avoid logging raw position/evidence values.

### Browser wallet

The official React wallet-connect approach is documented in `ARCHITECTURE.md`, but not
implemented. It belongs in the operator dashboard and should not replace the headless
bridge wallet used by the autonomous drone path.

## Known state at handoff

- Local node, indexer, proof server, bridge deployment, and ROS startup have all been
  observed working.
- A transaction initially failed with `expected instance of StateValue`; the trace showed
  duplicate `onchain-runtime-v3` class identities. The direct `3.0.0` dependency pin was
  added afterward.
- The user has not yet supplied a captured log proving that the post-pin transaction
  finalized. Treat end-to-end transaction success and final GIF creation as the first
  verification task, not as an already-established fact.
- The Matplotlib/NumPy changes pass Ruff, Python compilation, and all five geometry tests,
  but still need confirmation inside the rebuilt ROS image.
- Docker requires `sudo` for the current user. An agent execution session cannot enter the
  user's sudo password; ask the user to run Docker commands when necessary.
- `.idea/` is unrelated user IDE state. Do not delete or modify it unless explicitly asked.
- The worktree contains uncommitted and untracked implementation files. Preserve unrelated
  user changes and review `git status` before editing.

## Recommended next work

1. Rebuild `midnight-bridge` and `ros-simulator`; capture the complete success/failure log.
2. If successful, verify the GIF and PNG are readable and add an automated smoke check.
3. Add bridge unit tests for request validation without starting a wallet.
4. Persist or configure deployment metadata if restarts should attach to an existing contract.
5. Connect the React dashboard to bridge health and indexer-backed public contract state.
6. Add DApp Connector browser-wallet support for operator-authorized actions.
7. Add Z bounds, timestamps, replay protection, and idempotent submission semantics.
8. Add authentication/encryption before using non-synthetic sensor data.
9. Add a separate mission-coordinator agent that reads finalized public contract state and,
   when drone one's task is verified, publishes its next ROS assignment exactly once.

## Troubleshooting shortcuts

Container status and relevant logs:

```bash
sudo docker compose ps -a
sudo docker compose logs --no-color --tail=300 midnight-bridge ros-simulator
```

Filter the proof result:

```bash
sudo docker compose logs --no-color midnight-bridge ros-simulator |
  grep -E "deployed|finalized|verified|rejected|failed|animation"
```

Common meanings:

- `status: ready`: contract deployed; bridge can accept evidence.
- `could not balance dust`: wallet funding has not become spendable yet.
- `expected instance of StateValue`: inspect the npm tree for duplicate on-chain runtimes.
- HTTP `422`: bridge accepted the HTTP request but contract/proving/submission failed.
- ROS exit `143`: the container received SIGTERM, usually during Compose recreation.
- Docker exit `137`: the process was killed, commonly because Docker or the host ran out of memory.

Stop and reset containers without deleting named data:

```bash
sudo docker compose down
```

Do not delete Docker volumes, wallet state, or repository files unless the user explicitly
requests that destructive reset.
