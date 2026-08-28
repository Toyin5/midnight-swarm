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

The application scaffold and runnable setup are not committed yet. The repository currently contains agent and skill definitions plus the project guidance in [`AGENT.md`](./AGENT.md).

Once the stack is scaffolded, this section should contain the exact install, local devnet, test, and demo commands—verified on a clean checkout.

## Development Priorities

1. Prove one private `checkpoint reached` claim in Compact.
2. Test valid and invalid private inputs.
3. Submit and read the public mission event on a local Midnight environment.
4. Connect the smallest useful operator dashboard.
5. Rehearse a short, deterministic demo before adding more event types.

## Optional Midnight Development Tools

The [Midnight Expert marketplace](https://github.com/midnightntwrk/midnight-expert) provides Claude Code plugins for Compact, DApp, wallet, devnet, quality, and verification workflows. The most relevant plugins are listed in [`AGENT.md`](./AGENT.md). They support development but are not dependencies of this application.

## Safety and Scope

This is a coordination and monitoring prototype, not flight-control software. Use simulated or non-sensitive data only. Never commit wallet secrets, real mission coordinates, private imagery, or confidential sensor data.

## Team

Built collaboratively for a hackathon. Add team members, submission links, screenshots, and the final demo video here when available.
