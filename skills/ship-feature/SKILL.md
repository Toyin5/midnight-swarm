---
name: ship-feature
description: Use when the user wants to run a full feature shipping pipeline: plan, architect, implement, test, and review a feature request. Trigger for phrases like ship feature, build feature end-to-end, run full pipeline, plan code test review.
---

# Ship Feature

## Required Input

A feature request must be provided by the user.

If the feature request is missing, incomplete, or ambiguous, stop and ask for clarification.

## Response Format

Every reply while this skill is active must begin with exactly:

SHIP MODE ACTIVE

No exceptions.

Status updates, blockers, progress reports, and final reports must all begin with this line.

## Role

You are the pipeline coordinator.

Your responsibility is to orchestrate the complete feature delivery workflow.

You do not perform all work yourself.

You delegate work to the appropriate specialist agents and enforce stage gates.

## Agent Registry

For planning work:

- Read `.codex/agents/planner.md`

For architecture work:

- Read `.codex/agents/architect.md`

For implementation work:

- Read `.codex/agents/coder.md`

For testing work:

- Read `.codex/agents/tester.md`

For code-review work:

- Read `.code/skills/code-review/SKILL.md`

For general feature review work:

- Read `.codex/agents/reviewer.md`

Do not load all agent files at once.

Load only the agent needed for the current stage.

## Constraints

- Execute stages strictly in order.
- Never skip a stage.
- Never start a stage before the previous gate passes.
- Verify every handoff artifact exists before continuing.
- Do not merge.
- Do not push.
- Do not open a PR.
- Leave all changes on the current branch.
- If a stage blocks, stop immediately.
- Do not invent requirements.
- Do not bypass failed gates.
- Do not continue after OPEN QUESTIONS are detected.

## Pipeline

### Stage 1 — Plan

Load:

`.codex/agents/planner.md`

Input:

- User feature request

Expected output:

`.pipeline/spec.md`

Gate:

- `.pipeline/spec.md` exists
- `.pipeline/spec.md` is non-empty

Stop if:

- `.pipeline/spec.md` begins with `OPEN QUESTIONS`

If blocked:

- Show all open questions
- Explain why the pipeline cannot continue
- Halt

---

### Stage 2 — Architecture

Load:

`.codex/agents/architect.md`

Input:

- User feature request
- `.pipeline/spec.md`

Expected output:

`.pipeline/architecture.md`

Gate:

- `.pipeline/architecture.md` exists
- `.pipeline/architecture.md` is non-empty

Stop if:

- `.pipeline/architecture.md` begins with `OPEN QUESTIONS`

If blocked:

- Show all open questions
- Explain why the pipeline cannot continue
- Halt

---

### Stage 3 — Implement

Load:

`.codex/agents/coder.md`

Input:

- `.pipeline/spec.md`
- `.pipeline/architecture.md`

Expected output:

`.pipeline/changes.md`

Gate:

- `.pipeline/changes.md` exists
- `.pipeline/changes.md` is non-empty

Stop if:

- implementation failed
- build failed
- required files could not be modified

If blocked:

- Show failure details
- Halt

---

### Stage 4 — Code Review

Load:

`.codex/skills/code-review/SKILL.md`

Input:

- `.pipeline/spec.md`
- `.pipeline/architecture.md`
- `.pipeline/changes.md`

Expected output:

`.pipeline/code-review-results.md`

Gate:

- `.pipeline/code-review-results.md` exists

Stop if:

- any critical flaws & vulnerabilities found

If blocked:

- Show critical flaws & vulnerabilities found
- Halt

---

### Stage 5 — Test

Load:

`.codex/agents/tester.md`

Input:

- `.pipeline/spec.md`
- `.pipeline/architecture.md`
- `.pipeline/changes.md`

Expected output:

`.pipeline/test-results.md`

Gate:

- `.pipeline/test-results.md` exists

Stop if:

- any required tests fail

If blocked:

- Show test failures
- Halt

---

### Stage 6 — General Feature Review

Load:

`.codex/agents/reviewer.md`

Input:

- `.pipeline/spec.md`
- `.pipeline/architecture.md`
- `.pipeline/changes.md`
- `.pipeline/test-results.md`

Expected output:

`.pipeline/review.md`

Gate:

- `.pipeline/review.md` exists

---

If execution mode is approval:

- Present the generated artifact.
- Ask for approval.
- Halt until approval is received.

If execution mode is autonomous:

- Validate the gate.
- Continue automatically to the next stage.

## Final Report

When Stage 5 completes successfully, reply with:

### Verdict

PASS, FAIL, or CONDITIONAL

(from `.pipeline/review.md`)

### Artifacts

List every generated pipeline file:

- `.pipeline/spec.md`
- `.pipeline/architecture.md`
- `.pipeline/changes.md`
- `.pipeline/code-review-results.md`
- `.pipeline/test-results.md`
- `.pipeline/review.md`

### Summary

Include:

- What was built
- Files changed
- Test outcome
- Major review findings
- Outstanding risks (if any)

### Next Step

State:

- Changes remain on the current branch
- No merge performed
- Ready for human review

## Failure Report

If any stage blocks, report:

### Blocked Stage

Name of the stage

### Failed Gate

Exact gate that failed

### Reason

Why the stage failed

### User Decision Required

What the user must clarify, approve, or fix before re-running the pipeline

## Execution Mode

The pipeline supports two execution modes.

### autonomous

Default mode.

Agents should:

- Make reasonable decisions using existing codebase patterns.
- Continue automatically between stages.
- Ask questions only for critical ambiguities.
- Minimize interruptions.

### approval

Approval-driven mode.

Agents should:

- Stop after each stage.
- Present the artifact created.
- Request explicit approval before proceeding.
- Never continue automatically.

If no mode is specified, use autonomous.
