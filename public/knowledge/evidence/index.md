<!-- generated from https://maksim.sh/knowledge/evidence/index.json; do not edit directly -->
# Implementation Evidence and Qualifications

> Evidence demonstrates that a mechanism exists; it does not automatically validate every claim made around that mechanism.

## Interpretation

- An implementation link demonstrates that a mechanism exists; it does not prove that every surrounding claim is correct.
- Prototype means the architecture or contract is implemented with material simplifications.
- Experimental means the mechanism is implemented but its policy, thresholds, or operating assumptions remain subject to evaluation.
- Research means the artifact is a hypothesis, framework, or proposed test—not an established fact.

## Claims

### Freedom and Edge describe a method for escaping false binaries, exposing governing lenses, preserving useful contradiction, and deriving a discriminating next probe.

- Status: research
- Qualification: The public protocol contracts are operational distillations. They intentionally exclude unsupported mathematical, psychological, anti-safety, and prompt-activation claims from the source material.
- Evidence:
  - [Freedom Protocol](https://github.com/Gonzih/nexus-protocols/blob/main/FREEDOM.md) — source-framework
  - [Friction Point Framework](https://github.com/Gonzih/nexus-protocols/blob/main/FRICTION_POINT_FRAMEWORK.md) — source-framework

### Gravitas implements append-only assertions and retractions, transaction time, validity intervals, as-of queries, provenance, corroboration, contradiction, decay, and anomaly reporting.

- Status: implemented
- Qualification: Influence weights, decay, phase boundaries, and anomaly thresholds are policy heuristics. They must not be interpreted as objective truth probabilities.
- Evidence:
  - [Gravitas transaction and temporal query implementation](https://github.com/Gonzih/nexus-gravitas/blob/main/src/gravita.ts) — source-code
  - [Gravitas weighting implementation](https://github.com/Gonzih/nexus-gravitas/blob/main/src/weight.ts) — source-code

### The Evidence Service records an append-only audit ladder spanning query, decomposition, model execution, consensus, verification, and conclusion.

- Status: implemented
- Qualification: The ladder preserves recorded transformations. It does not independently establish the correctness of evidence supplied to it.
- Evidence:
  - [Nexus Evidence Service](https://github.com/Gonzih/nexus-evidence-service) — repository
  - [Evidence routes](https://github.com/Gonzih/nexus-evidence-service/blob/main/src/routes/evidence.ts) — source-code

### The Convergence Service fans requests out to multiple model providers, records evidence, invokes consensus analysis, and returns structured pipeline output.

- Status: prototype
- Qualification: The current final-answer path joins successful model responses rather than synthesizing a new answer, and some evidence-write failures are non-fatal.
- Evidence:
  - [Nexus Convergence Service](https://github.com/Gonzih/nexus-convergence-service) — repository
  - [Convergence route](https://github.com/Gonzih/nexus-convergence-service/blob/main/src/routes/converge.ts) — source-code

### The Consensus Service computes cross-response similarity, inversion indicators, agreement scores, and candidate agreed or disputed claims.

- Status: prototype
- Qualification: The implementation uses bag-of-words term frequency cosine, sentence overlap, and regular-expression inversion rules. It is not semantic verification and must not be called a truth engine.
- Evidence:
  - [Consensus implementation](https://github.com/Gonzih/nexus-consensus-service/blob/main/src/lib/consensus.ts) — source-code

### The Reasoning Graph captures interaction artifacts, chunks content, computes similarity edges, and renders a D3 graph of candidate influence relationships.

- Status: prototype
- Qualification: An edge represents semantic similarity to a later synthesis. It is candidate influence, not causal proof and not access to private model reasoning.
- Evidence:
  - [Nexus Reasoning Graph](https://github.com/Gonzih/nexus-reasoning-graph) — repository
  - [Influence calculation](https://github.com/Gonzih/nexus-reasoning-graph/blob/main/service/src/influence.ts) — source-code

### The Clojure harness supports runtime tool replacement, modification logging, rollback, nREPL, and MCP-oriented composition.

- Status: prototype
- Qualification: Native evaluation is currently unsandboxed. The public protocol therefore requires validation, tests, restricted authority, and rollback before activation.
- Evidence:
  - [Nexus Clojure harness](https://github.com/Gonzih/nexus-clojure) — repository
  - [Self-modification implementation](https://github.com/Gonzih/nexus-clojure/blob/main/src/nexus/self_modify.clj) — source-code

### Soul Core implements a Rust agent runtime with steerable loops, context management, permissions, budgets, tools, MCP, persistence, memory, snapshots, subagents, and virtual execution interfaces.

- Status: implemented
- Qualification: The public knowledge corpus endorses the architectural patterns documented here, not every provider-specific or experimental behavior in the runtime.
- Evidence:
  - [Soul Core](https://github.com/Gonzih/nexus-soul-core) — repository
  - [Agent loop](https://github.com/Gonzih/nexus-soul-core/tree/main/src/agent) — source-code
  - [Permission system](https://github.com/Gonzih/nexus-soul-core/tree/main/src/permission) — source-code

### Nexus research proposes evaluating semantic robustness by defining invariants, applying lawful and adversarial transformations, and measuring where behavior changes.

- Status: research
- Qualification: Geometric language is a modeling frame. Latent semantic regions, topological equivalence, and related analogies remain hypotheses unless established by an explicit experiment.
- Evidence:
  - [Geometry of Language](https://github.com/Gonzih/nexus-research/blob/main/geometry/geometry-of-language.md) — research-note

## Withheld evidence

- execution-capture implementation evidence: Not included in the public evidence index until source hygiene is complete.
- private optimization experiments: Private research is not part of the public machine-readable corpus.
