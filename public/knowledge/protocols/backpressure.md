<!-- generated from https://maksim.sh/knowledge/protocols/backpressure.json; do not edit directly -->
# Backpressure

> Treat repeated friction as information about a mismatched model, interface, dependency, or scope.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/backpressure.json](https://maksim.sh/knowledge/protocols/backpressure.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Stop spending force on a blocked execution path, identify the boundary producing resistance, and change the controlling variable rather than repeating the same attempt.

## Use when

- The same failure recurs despite retries.
- Queues, context, coordination, dependencies, or interfaces are accumulating pressure.
- Increasing effort produces less useful output.

## Avoid when

- The failure is transient and a bounded retry policy has not been exhausted.
- Stopping the current path would create greater immediate harm than stabilizing it.

## Input contract

- `goal` (string, required)
- `attempts` (array, required)
- `observed_failures` (array, required)
- `constraints` (array, optional)
- `metrics` (object, optional)

## Output contract

- `pressure_signal` (string, required)
- `boundary_class` (model | interface | dependency | capacity | authority | scope | unknown, required)
- `controlling_hypothesis` (string, required)
- `release_test` (string, required)
- `next_action` (string, required)
- `stop_condition` (string, optional)

## Procedure

1. Stop unbounded retries and preserve the latest failure evidence.
2. Describe the pressure signal as an observable change in latency, errors, queue depth, context size, coordination cost, or output quality.
3. Classify the boundary as model, interface, dependency, capacity, authority, scope, or unknown.
4. Identify the smallest upstream assumption capable of producing the repeated pressure.
5. Change one controlling variable or reduce the load crossing the boundary.
6. Run a bounded release test and define the condition for continuing, escalating, or abandoning the path.

## Invariants

- Retries are bounded and observable.
- The latest failure evidence is preserved before changing the path.
- Only one controlling variable changes in the release test when practical.
- Backpressure is a signal to investigate, not proof of a specific cause.

## Failure modes

- Every obstacle is romanticized as meaningful backpressure. Mitigation: Require an observable repeated signal and compare against a bounded transient-failure baseline.
- The system reduces load while leaving the true dependency failure untouched. Mitigation: State a falsifiable controlling hypothesis and verify that the release test changes the pressure signal.

## Composition

- Before: `reality-check`, `context-firewall`
- After: `grit`, `evidence-ladder`

## Provenance

- [Backpressure Protocol](https://github.com/Gonzih/nexus-protocols/blob/main/BACKPRESSURE_PROTOCOL.md) — Operational distillation — The public contract narrows a broad source document to measurable system behavior.

## Limitations

- Boundary classification can be wrong when observability is weak.
- Reducing pressure can hide a latent defect rather than fix it.
- Distributed systems may have multiple coupled bottlenecks that cannot be isolated in one experiment.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
