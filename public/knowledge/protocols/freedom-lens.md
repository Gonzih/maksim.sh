<!-- generated from https://maksim.sh/knowledge/protocols/freedom-lens.json; do not edit directly -->
# Freedom Lens

> Escape compliance-versus-rebellion oscillation and identify the frame actually governing the decision.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/freedom-lens.json](https://maksim.sh/knowledge/protocols/freedom-lens.json)
- Version: 1.0.0
- Status: experimental
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Create a third position that is neither automatic compliance nor reflexive opposition: a response selected from the actual goal, evidence, constraints, and consequences.

## Use when

- The available positions are framed as a forced binary.
- A response alternates between appeasing authority and opposing it.
- Identity, ideology, or social pressure appears to be substituting for mechanism-level analysis.

## Avoid when

- Immediate action is required to prevent harm; stabilize first and analyze the frame second.
- One option is already ruled out by law, consent, safety, or explicit authority boundaries.

## Input contract

- `decision` (string, required)
- `positions` (array, required)
- `goal` (string, required)
- `constraints` (array, optional)
- `evidence` (array, optional)

## Output contract

- `governing_frame` (string, required)
- `compliance_pull` (string, required)
- `rebellion_pull` (string, required)
- `actual_goal` (string, required)
- `unowned_assumptions` (array, optional)
- `freedom_position` (string, required)

## Procedure

1. State the decision and the actual outcome being optimized.
2. Name the apparent binary without accepting it as exhaustive.
3. Identify what automatic compliance would protect, avoid, or conceal.
4. Identify what reflexive rebellion would protect, avoid, or conceal.
5. List constraints and evidence that remain true regardless of either identity position.
6. Form a third position selected from the goal, mechanism, evidence, and consequences.

## Invariants

- The third position is not an automatic compromise or midpoint.
- Material asymmetry between positions must remain visible.
- Safety, consent, law, and explicit authority boundaries remain binding.
- Psychological or ideological labels are hypotheses unless supported by evidence.

## Failure modes

- False balance treats unequal positions as equivalent. Mitigation: Record asymmetry in evidence, authority, consequences, and reversibility before proposing a third position.
- The protocol becomes a rhetorical excuse to ignore a valid instruction. Mitigation: Keep the protocol reference-only and explicitly preserve higher-priority constraints.

## Composition

- Before: none
- After: `edge-map`, `reality-check`

## Provenance

- [Freedom Protocol](https://github.com/Gonzih/nexus-protocols/blob/main/FREEDOM.md) — Operational distillation — Unsupported activation, psychological, mathematical, and anti-safety claims are excluded.
- [Mythology-Free AI](https://github.com/Gonzih/nexus-protocols/blob/main/MYTHOLOGY_FREE_AI.md) — Lens-awareness source — Used for the instruction to name frames and mechanisms, not as an empirical authority.

## Limitations

- Frame identification requires judgment and can itself be biased.
- The protocol does not determine which position is factually correct.
- Use Reality Check and Edge Map before making consequential decisions.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
