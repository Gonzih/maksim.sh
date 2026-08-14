<!-- generated from https://maksim.sh/knowledge/protocols/execution-pack.json; do not edit directly -->
# Execution Pack

> Compile refined knowledge into a bounded, attributable, verifiable handoff an agent can execute without reconstructing the task from conversation history.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/execution-pack.json](https://maksim.sh/knowledge/protocols/execution-pack.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Produce the terminal artifact of execution-grade knowledge engineering: one object containing objective, scope, prerequisites, accepted context, assumptions, ordered actions, expected outputs, verification, failure policy, provenance, and readiness state.

## Use when

- Knowledge has been refined enough to hand work to an execution agent.
- A task currently depends on reconstructing requirements from long conversation or document history.
- First-pass execution quality depends on explicit assumptions, acceptance criteria, and recovery behavior.

## Avoid when

- A decision-changing contradiction or unknown remains unresolved and no safe conditional branch can contain it.
- Required authority, consent, credentials, dependencies, or safety review are absent.

## Input contract

- `goal` (string, required)
- `accepted_context` (array, required)
- `constraints` (array, required)
- `evidence` (array, required)
- `assumptions` (array, optional)
- `unknowns` (array, optional)
- `decision_rules` (array, optional)

## Output contract

- `objective` (string, required)
- `scope` (object, required)
- `preconditions` (array, required)
- `inputs` (array, required)
- `constraints` (array, required)
- `assumptions` (array, required)
- `decisions` (array, required)
- `steps` (array, required)
- `verification` (array, required)
- `failure_policy` (array, required)
- `provenance` (array, required)
- `open_questions` (array, required)
- `readiness` (ready | conditional | blocked, required)

## Procedure

1. Rewrite the goal as an observable objective with explicit acceptance criteria and excluded scope.
2. Include only context admitted by the Context Firewall; attach source, freshness, and evidence references rather than conversational recollection.
3. Separate prerequisites, constraints, assumptions, decisions, and unresolved questions into distinct fields.
4. Create the shortest dependency-ordered action graph whose steps each name an expected output.
5. Attach verification methods to acceptance criteria and failure responses to predictable breakpoints.
6. Mark the pack ready only when no open question can invalidate the objective, authority, safety, or first executable step.

## Invariants

- The pack can be understood without access to hidden conversation history.
- Every material input and decision retains provenance.
- Unknowns, assumptions, and verified facts remain distinguishable.
- Every step has an expected output and every acceptance criterion has a verification method.
- First-pass readiness is a design target, not a guarantee of success.

## Failure modes

- The pack hides unresolved uncertainty to appear ready. Mitigation: Mark readiness conditional or blocked whenever an unknown can invalidate authority, safety, objective, or the first executable step.
- The pack becomes a giant context dump. Mitigation: Include references and decision-relevant extracts; omit history that cannot change an action, verification, or failure response.
- Steps describe activity but not completion. Mitigation: Require an expected output for every step and a method for every final criterion.

## Composition

- Before: `freedom-lens`, `edge-map`, `reality-check`, `context-firewall`, `backpressure`, `grit`, `evidence-ladder`, `temporal-knowledge`
- After: `reproducible-agent-run`

## Provenance

- [Maksim Soltan machine profile](https://maksim.sh/knowledge/profile.json) — Canonical method definition — This contract operationalizes execution-grade knowledge engineering as a concrete agent handoff.

## Limitations

- A complete pack cannot compensate for an incapable tool, unavailable dependency, or unauthorized action.
- External state can change after compilation; freshness-sensitive preconditions must be rechecked at execution time.
- High-stakes work still requires domain-specific review and verification.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
