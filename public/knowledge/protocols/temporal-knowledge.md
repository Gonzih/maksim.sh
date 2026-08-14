<!-- generated from https://maksim.sh/knowledge/protocols/temporal-knowledge.json; do not edit directly -->
# Temporal Knowledge

> Represent knowledge as sourced assertions with transaction time, validity intervals, supersession, and policy weights.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/temporal-knowledge.json](https://maksim.sh/knowledge/protocols/temporal-knowledge.json)
- Version: 1.0.0
- Status: experimental
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Prevent a knowledge base from flattening changing claims into timeless truth by preserving when an assertion was recorded, when it applies, what supersedes it, and how its influence was calculated.

## Use when

- Facts change over time or have bounded validity periods.
- Multiple sources assert different values for the same entity and attribute.
- An agent must answer current-state, history, or as-of questions.

## Avoid when

- A policy weight would be misrepresented as an objective probability of truth.
- The domain requires a formally validated temporal or probabilistic model not supplied here.

## Input contract

- `operation` (assert | retract | corroborate | query-current | query-as-of | query-history, required)
- `assertions` (array, required)
- `as_of` (string | null, optional)

## Output contract

- `transaction` (object, required)
- `current_assertions` (array, required)
- `conflicts` (array, required)
- `history` (array, optional)
- `weight_semantics` (any, required)

## Procedure

1. Store each assertion as an append-only entity-attribute-value event with source and transaction time.
2. Store valid-from and valid-until separately from the time the system recorded the assertion.
3. Represent retraction and corroboration as new events rather than destructive updates to history.
4. Treat a different value for the same entity and attribute as an explicit conflict candidate, not automatic semantic contradiction.
5. Resolve current or as-of views from ordered events and declared validity boundaries.
6. Expose source trust, decay, corroboration, and anomaly thresholds as inspectable policy parameters.

## Invariants

- Transaction time and valid time remain distinct.
- History is append-only and prior assertions remain inspectable.
- Every assertion retains source provenance.
- Weights and lifecycle labels are explicitly identified as policy heuristics.

## Failure modes

- A different string value is treated as a semantic contradiction without normalization or domain logic. Mitigation: Label it a conflict candidate and apply domain-specific equivalence or contradiction rules separately.
- Recency or repeated assertion is interpreted as truth. Mitigation: Keep source quality, corroboration independence, evidence, and policy weight as separate fields.

## Composition

- Before: `reality-check`, `evidence-ladder`
- After: `disagreement-preserving-convergence`

## Provenance

- [Nexus Gravitas](https://github.com/Gonzih/nexus-gravitas) — Implementation source — The contract generalizes the implementation while explicitly labeling its weighting constants and anomaly thresholds as policy.
- [Gravitas weighting implementation](https://github.com/Gonzih/nexus-gravitas/blob/main/src/weight.ts) — Heuristic provenance — Corroboration, contradiction, floor, ceiling, and decay values are implementation constants, not calibrated probabilities.

## Limitations

- Entity resolution, semantic normalization, and independent-source detection are outside this contract.
- Temporal correctness depends on trustworthy clocks and correctly modeled validity intervals.
- Policy weights require domain evaluation before consequential use.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
