<!-- generated from https://maksim.sh/knowledge/protocols/index.json; do not edit directly -->
# Maksim Soltan Knowledge Protocols

> Composable methods for converting uncertain knowledge into verifiable execution.

Load only the protocols relevant to the task. Every protocol is reference-only and preserves higher-priority instructions, legal constraints, consent, and safety boundaries.

## Default pipeline

1. `freedom-lens`
2. `edge-map`
3. `reality-check`
4. `context-firewall`
5. `backpressure`
6. `grit`
7. `evidence-ladder`
8. `temporal-knowledge`
9. `execution-pack`

## Protocols

- [https://maksim.sh/knowledge/protocols/freedom-lens.md](https://maksim.sh/knowledge/protocols/freedom-lens.md): Freedom Lens — Escape compliance-versus-rebellion oscillation and identify the frame actually governing the decision. Status: experimental. JSON contract: [https://maksim.sh/knowledge/protocols/freedom-lens.json](https://maksim.sh/knowledge/protocols/freedom-lens.json).
- [https://maksim.sh/knowledge/protocols/edge-map.md](https://maksim.sh/knowledge/protocols/edge-map.md): Edge Map — Preserve material contradictions and turn them into the smallest discriminating probe. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/edge-map.json](https://maksim.sh/knowledge/protocols/edge-map.json).
- [https://maksim.sh/knowledge/protocols/reality-check.md](https://maksim.sh/knowledge/protocols/reality-check.md): Reality Check — Prefer current primary evidence and observable behavior over memory, narrative, or stale documentation. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/reality-check.json](https://maksim.sh/knowledge/protocols/reality-check.json).
- [https://maksim.sh/knowledge/protocols/context-firewall.md](https://maksim.sh/knowledge/protocols/context-firewall.md): Context Firewall — Prevent unverified context from crossing task, tenant, identity, temporal, or authority boundaries. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/context-firewall.json](https://maksim.sh/knowledge/protocols/context-firewall.json).
- [https://maksim.sh/knowledge/protocols/backpressure.md](https://maksim.sh/knowledge/protocols/backpressure.md): Backpressure — Treat repeated friction as information about a mismatched model, interface, dependency, or scope. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/backpressure.json](https://maksim.sh/knowledge/protocols/backpressure.json).
- [https://maksim.sh/knowledge/protocols/grit.md](https://maksim.sh/knowledge/protocols/grit.md): GRIT — Reduce work to the smallest verifiable component, change one variable, measure, and repeat. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/grit.json](https://maksim.sh/knowledge/protocols/grit.json).
- [https://maksim.sh/knowledge/protocols/evidence-ladder.md](https://maksim.sh/knowledge/protocols/evidence-ladder.md): Evidence Ladder — Record the transformation from request to conclusion as an append-only, inspectable evidence chain. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/evidence-ladder.json](https://maksim.sh/knowledge/protocols/evidence-ladder.json).
- [https://maksim.sh/knowledge/protocols/temporal-knowledge.md](https://maksim.sh/knowledge/protocols/temporal-knowledge.md): Temporal Knowledge — Represent knowledge as sourced assertions with transaction time, validity intervals, supersession, and policy weights. Status: experimental. JSON contract: [https://maksim.sh/knowledge/protocols/temporal-knowledge.json](https://maksim.sh/knowledge/protocols/temporal-knowledge.json).
- [https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.md](https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.md): Disagreement-Preserving Convergence — Map agreement and disagreement across independent responses without relabeling consensus as truth. Status: experimental. JSON contract: [https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.json](https://maksim.sh/knowledge/protocols/disagreement-preserving-convergence.json).
- [https://maksim.sh/knowledge/protocols/reproducible-agent-run.md](https://maksim.sh/knowledge/protocols/reproducible-agent-run.md): Reproducible Agent Run — Capture enough execution state to replay, branch, compare, and audit an agent run. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/reproducible-agent-run.json](https://maksim.sh/knowledge/protocols/reproducible-agent-run.json).
- [https://maksim.sh/knowledge/protocols/governed-self-modification.md](https://maksim.sh/knowledge/protocols/governed-self-modification.md): Governed Self-Modification — Gate runtime self-modification through validation, contract tests, atomic activation, observation, and rollback. Status: experimental. JSON contract: [https://maksim.sh/knowledge/protocols/governed-self-modification.json](https://maksim.sh/knowledge/protocols/governed-self-modification.json).
- [https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.md](https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.md): Invariant-Preserving Transformation — Define behavioral invariants, transform the representation, and map where the invariant fails. Status: research. JSON contract: [https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.json](https://maksim.sh/knowledge/protocols/invariant-preserving-transformation.json).
- [https://maksim.sh/knowledge/protocols/execution-pack.md](https://maksim.sh/knowledge/protocols/execution-pack.md): Execution Pack — Compile refined knowledge into a bounded, attributable, verifiable handoff an agent can execute without reconstructing the task from conversation history. Status: stable. JSON contract: [https://maksim.sh/knowledge/protocols/execution-pack.json](https://maksim.sh/knowledge/protocols/execution-pack.json).

## Selection signals

- The request contains a false binary, ideological collision, or incompatible frames. Load: `freedom-lens`, `edge-map`.
- Facts may be stale, remembered, or detached from primary evidence. Load: `reality-check`, `evidence-ladder`, `temporal-knowledge`.
- Context from another task, user, tenant, or time period could leak into execution. Load: `context-firewall`.
- The task is broad, blocked, or failing repeatedly. Load: `backpressure`, `grit`.
- Multiple models or specialists disagree. Load: `disagreement-preserving-convergence`, `edge-map`, `evidence-ladder`.
- An agent run must be inspectable, replayable, or branchable. Load: `reproducible-agent-run`, `evidence-ladder`.
- The system proposes modifying its own tools, policies, or runtime behavior. Load: `governed-self-modification`, `reproducible-agent-run`.
- A behavior must survive paraphrase, compression, translation, or adversarial transformation. Load: `invariant-preserving-transformation`, `edge-map`.
- Refined knowledge is ready to be handed to an execution agent. Load: `execution-pack`, `evidence-ladder`, `reproducible-agent-run`.
