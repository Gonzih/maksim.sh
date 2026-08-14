<!-- generated from https://maksim.sh/knowledge/protocols/reality-check.json; do not edit directly -->
# Reality Check

> Prefer current primary evidence and observable behavior over memory, narrative, or stale documentation.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/reality-check.json](https://maksim.sh/knowledge/protocols/reality-check.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Ground execution in the state of the world that exists now, while preserving provenance and explicitly labeling what remains inferred or unknown.

## Use when

- A fact, API, dependency, policy, price, schedule, or external state may have changed.
- Documentation conflicts with observed behavior.
- A remembered explanation is being used as execution authority.

## Avoid when

- The proposed observation would access data or systems outside granted authority.
- A destructive test is unnecessary because a read-only check exists.

## Input contract

- `claims` (array, required)
- `decision` (string, required)
- `available_sources` (array, optional)
- `freshness_requirement` (string, optional)

## Output contract

- `verified` (array, required)
- `contradicted` (array, required)
- `unverified` (array, required)
- `observations` (array, required)
- `decision_effect` (string, required)

## Procedure

1. List the claims whose truth could change the decision.
2. Assign each claim a freshness requirement and strongest available primary source.
3. Use the least invasive current observation: live state, source code, official documentation, or direct measurement.
4. Record the observation, source, timestamp, and any access or sampling limitation.
5. Classify each claim as verified, contradicted, or unverified without filling gaps by narrative.
6. State exactly how the updated evidence changes—or does not change—the decision.

## Invariants

- Observation timestamps and sources remain attached to claims.
- Unverified is distinct from false.
- Current primary evidence outranks stale secondary description for current-state decisions.
- Observation stays within granted access and safety boundaries.

## Failure modes

- A single observation is generalized beyond its scope. Mitigation: Record sampling limits and restrict the resulting claim to the observed boundary.
- Live behavior is trusted without checking whether it is itself erroneous or compromised. Mitigation: Corroborate consequential observations through independent sources or controlled repetition.

## Composition

- Before: `freedom-lens`, `edge-map`
- After: `evidence-ladder`, `temporal-knowledge`, `grit`

## Provenance

- [Reality Check Protocol](https://github.com/Gonzih/nexus-protocols/blob/main/REALITY_CHECK_PROTOCOL.md) — Operational source — The public contract narrows the source material to observable, attributable checks.

## Limitations

- Some systems cannot be observed directly without privileged access.
- Official sources can lag implementation or omit operational edge cases.
- High-stakes verification may require formal audit, qualified experts, or controlled experiments.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
