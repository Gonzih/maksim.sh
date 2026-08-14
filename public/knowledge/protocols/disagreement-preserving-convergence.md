<!-- generated from https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.json; do not edit directly -->
# Disagreement-Preserving Convergence

> Map agreement and disagreement across independent responses without relabeling consensus as truth.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.json](https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.json)
- Version: 1.0.0
- Status: experimental
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Use model or specialist diversity to expose shared claims, material collisions, missing evidence, and next probes while preserving the complete source responses and their independence boundaries.

## Use when

- Independent models, experts, or retrieval paths produce materially different answers.
- A decision benefits from diversity but requires one inspectable output.
- Agreement strength and disagreement structure matter more than majority vote.

## Avoid when

- All responses share the same source, prompt contamination, training artifact, or failure mode and are not meaningfully independent.
- A qualified authority or primary measurement is available and an ensemble would only add rhetorical noise.

## Input contract

- `question` (string, required)
- `responses` (array, required)
- `decision` (string, optional)

## Output contract

- `agreements` (array, required)
- `disagreements` (array, required)
- `inversions` (array, required)
- `missing_evidence` (array, required)
- `source_responses` (array, required)
- `synthesis` (string, required)
- `next_probes` (array, required)
- `epistemic_warning` (any, required)

## Procedure

1. Preserve each source response verbatim with its evidence and independence notes.
2. Normalize claims into comparable propositions without deleting qualifiers.
3. Separate lexical similarity from agreement about predicted observations or actions.
4. Identify material disagreements, direct inversions, and evidence gaps.
5. Synthesize only what the evidence supports; carry unresolved branches into the result.
6. Use Edge Map to convert decision-relevant disagreements into next probes.

## Invariants

- Raw source responses remain available and attributable.
- Consensus is never labeled truth merely because multiple sources agree.
- Similarity, agreement, evidence quality, and source independence remain separate dimensions.
- The synthesis preserves disagreements that could change the decision.

## Failure modes

- Lexical overlap is presented as semantic or factual agreement. Mitigation: Compare predicted observations, cited evidence, and decision consequences separately from text similarity.
- Correlated models create false confidence through repeated shared errors. Mitigation: Record provider, model, prompt, source, and training-correlation proxies; downgrade claims with weak independence.

## Composition

- Before: `context-firewall`, `reality-check`
- After: `edge-map`, `evidence-ladder`, `temporal-knowledge`

## Provenance

- [Nexus Convergence Service](https://github.com/Gonzih/nexus-convergence-service) — Pipeline implementation — The current implementation fans out and compares responses but does not perform a fully evidence-grounded synthesis.
- [Nexus Consensus Service](https://github.com/Gonzih/nexus-consensus-service/blob/main/src/lib/consensus.ts) — Prototype comparison implementation — Current similarity and inversion mechanisms are lexical heuristics, not semantic truth verification.

## Limitations

- Source independence is difficult to establish for commercial language models.
- A high-quality minority answer can be more correct than broad agreement.
- Domain-specific verification remains necessary for consequential claims.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
