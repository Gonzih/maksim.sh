<!-- generated from https://maksim.sh/knowledge/protocols/edge-map.json; do not edit directly -->
# Edge Map

> Preserve material contradictions and turn them into the smallest discriminating probe.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/edge-map.json](https://maksim.sh/knowledge/protocols/edge-map.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Convert disagreement from narrative conflict into an explicit map of lenses, assumptions, invariants, unknowns, and a test that can change the decision.

## Use when

- Two or more plausible claims lead to different actions.
- A team or model ensemble agrees on language but not assumptions.
- A contradiction is being averaged away instead of investigated.

## Avoid when

- The disagreement is purely about preference and no factual discriminator is needed.
- The proposed probe would be unsafe, unlawful, non-consensual, or irreversibly destructive.

## Input contract

- `goal` (string, required)
- `claims` (array, required)
- `constraints` (array, optional)

## Output contract

- `lenses` (array, required)
- `assumptions` (array, required)
- `shared_ground` (array, required)
- `contradictions` (array, required)
- `unknowns` (array, required)
- `discriminating_probe` (object, required)
- `decision_rule` (string, required)
- `next_action` (string, required)

## Procedure

1. Normalize each claim without deleting its qualifiers, source, or boundary conditions.
2. Name the lens and assumptions required for each claim to hold.
3. Extract shared ground and separate verbal differences from material contradictions.
4. Identify the unknown that would most change the selected action.
5. Design the smallest safe probe capable of falsifying at least one material assumption.
6. Write the decision rule before observing the result, then select the immediate next action.

## Invariants

- No material contradiction is silently averaged into consensus.
- Every claimed discriminator names an observable measurement.
- The probe must be safe, bounded, and proportionate to the decision.
- Unknown remains an explicit state; it is not rewritten as false.

## Failure modes

- The map produces a long taxonomy but no decision-changing test. Mitigation: Rank unknowns by expected decision impact and keep only the highest-value probe.
- Different wording is mistaken for substantive contradiction. Mitigation: Translate each claim into predicted observations and compare those predictions.

## Composition

- Before: `freedom-lens`
- After: `reality-check`, `grit`, `evidence-ladder`

## Provenance

- [Friction Point Framework](https://github.com/Gonzih/nexus-protocols/blob/main/FRICTION_POINT_FRAMEWORK.md) — Primary conceptual source — Personal and unsupported metaphysical examples are excluded from this operational contract.
- [Conflict of Thought](https://github.com/Gonzih/nexus-protocols/blob/main/CONFLICT_OF_THOUGHT.md) — Specialist-collision source — The contract uses visible claims and evidence, not private chain-of-thought.

## Limitations

- A discriminating probe can reduce uncertainty without proving a universal conclusion.
- Poorly selected measurements can preserve the original ambiguity.
- High-stakes domains require qualified review and domain-specific evidence standards.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
