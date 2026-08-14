<!-- generated from https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.json; do not edit directly -->
# Invariant-Preserving Transformation

> Define behavioral invariants, transform the representation, and map where the invariant fails.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.json](https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.json)
- Version: 1.0.0
- Status: research
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Evaluate whether a system preserves decision-relevant behavior across paraphrase, compression, translation, reordering, noise, adversarial framing, or other representation changes.

## Use when

- A prompt, policy, or knowledge artifact must survive representation changes.
- Robustness claims need an explicit behavioral test boundary.
- Adversarial feedback may reveal which parts of a concept are load-bearing.

## Avoid when

- The proposed invariant is vague, unobservable, or selected after seeing results.
- The transformation changes the task itself rather than its representation and that distinction is not modeled.

## Input contract

- `artifact` (string, required)
- `invariants` (array, required)
- `allowed_variation` (array, optional)
- `transformations` (array, required)
- `evaluator` (string, required)

## Output contract

- `baseline` (object, required)
- `results` (array, required)
- `preserved` (array, required)
- `violated` (array, required)
- `boundary_map` (array, required)
- `research_warning` (any, required)

## Procedure

1. Define observable invariants and allowed variation before generating transformed artifacts.
2. Capture baseline behavior, uncertainty, and evaluator reliability.
3. Generate lawful transformations first, changing one transformation dimension when practical.
4. Generate bounded adversarial transformations that target suspected load-bearing features without changing the declared task.
5. Evaluate behavior using fixed criteria and independent repetition where possible.
6. Map the smallest transformation associated with each invariant violation and label causal claims as hypotheses.

## Invariants

- Behavioral invariants are defined before transformed outputs are observed.
- Representation changes and task changes are labeled separately.
- Evaluator variance is measured or acknowledged.
- Observed robustness is not promoted into a claim about hidden geometry without additional evidence.

## Failure modes

- The evaluator rewards superficial wording instead of the intended behavior. Mitigation: Use task-level outcomes, adversarial counterexamples, and multiple evaluator forms.
- A transformation is called equivalent even though it changes information content. Mitigation: Record information loss and classify the transformation as lossy rather than invariant-preserving by assumption.

## Composition

- Before: `edge-map`, `reality-check`
- After: `evidence-ladder`, `reproducible-agent-run`

## Provenance

- [Geometry of Language](https://github.com/Gonzih/nexus-research/blob/main/geometry/geometry-of-language.md) — Research source — Topological and geometric language is treated as a hypothesis-generating model, not an established description of latent space.

## Limitations

- Passing a finite transformation suite does not prove universal invariance.
- Model stochasticity and evaluator error can blur the failure boundary.
- Formal topological claims require definitions and evidence beyond behavioral testing.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
