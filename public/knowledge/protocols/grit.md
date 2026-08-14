<!-- generated from https://maksim.sh/knowledge/protocols/grit.json; do not edit directly -->
# GRIT

> Reduce work to the smallest verifiable component, change one variable, measure, and repeat.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/grit.json](https://maksim.sh/knowledge/protocols/grit.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Replace broad effort and speculative rewrites with a tight execution loop that localizes failure and accumulates verified progress.

## Use when

- A task is broad enough that failure cannot be localized.
- Multiple variables are changing between attempts.
- Progress is being reported without a verification artifact.

## Avoid when

- The smallest local improvement would lock in a globally invalid architecture.
- A safety-critical change requires formal system-level validation before any execution.

## Input contract

- `goal` (string, required)
- `current_state` (string, required)
- `known_failure` (string, optional)
- `verification_target` (string, required)
- `constraints` (array, optional)

## Output contract

- `smallest_component` (string, required)
- `exact_failure` (string, required)
- `single_variable` (string, required)
- `verification` (string, required)
- `result` (verified | failed | inconclusive | not-run, required)
- `next_step` (string, required)

## Procedure

1. Research only enough to identify the smallest component that can produce a decision-changing result.
2. Reproduce and state the exact current failure or missing behavior.
3. Select one variable whose change could explain the result.
4. Apply the smallest reversible change to that variable.
5. Run the predefined verification and capture its artifact.
6. Keep the change only if verified; otherwise update the failure model and repeat.

## Invariants

- One explanatory variable changes per experiment when practical.
- Verification criteria are selected before interpreting the result.
- A failed experiment remains evidence and is not erased from the execution history.
- Each accepted step leaves the system in a coherent, recoverable state.

## Failure modes

- The smallest component is locally testable but irrelevant to the actual goal. Mitigation: Require every component to name the decision or dependency it unlocks.
- One-variable discipline becomes impossible in a coupled system. Mitigation: Change the smallest coupled set and explicitly record the loss of causal resolution.

## Composition

- Before: `edge-map`, `reality-check`, `backpressure`
- After: `evidence-ladder`, `reproducible-agent-run`

## Provenance

- [GRIT Protocol](https://github.com/Gonzih/nexus-protocols/blob/main/GRIT.md) — Primary operational source — Rendered here as an explicit machine contract.

## Limitations

- Local verification does not replace end-to-end validation.
- Some failures emerge only under load, time, concurrency, or real external dependencies.
- The protocol optimizes learning rate, not necessarily calendar speed for every task.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
