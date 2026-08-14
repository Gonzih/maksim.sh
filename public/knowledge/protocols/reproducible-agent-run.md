<!-- generated from https://maksim.sh/knowledge/protocols/reproducible-agent-run.json; do not edit directly -->
# Reproducible Agent Run

> Capture enough execution state to replay, branch, compare, and audit an agent run.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/reproducible-agent-run.json](https://maksim.sh/knowledge/protocols/reproducible-agent-run.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Turn an agent interaction into a versioned execution object whose inputs, environment, decisions, tool effects, artifacts, and branch lineage can be inspected without storing unneeded secrets or private reasoning.

## Use when

- An execution must be replayed, audited, compared, debugged, or branched.
- Tool effects or provider behavior may change the result.
- A self-modifying or high-autonomy workflow needs rollback evidence.

## Avoid when

- The capture would retain credentials, private messages, protected data, or unnecessary model internals.
- The environment cannot be isolated enough for the proposed replay.

## Input contract

- `run_id` (string, required)
- `goal` (string, required)
- `inputs` (array, required)
- `environment` (object, required)
- `tools` (array, required)
- `parent_run` (string | null, optional)
- `redaction_policy` (string, required)

## Output contract

- `run_id` (string, required)
- `manifest` (object, required)
- `events` (array, required)
- `artifacts` (array, required)
- `diff` (object, required)
- `verification` (object, required)
- `replay_status` (reproducible | partially-reproducible | non-reproducible | not-replayed, required)

## Procedure

1. Create a run manifest containing goal, inputs, model and provider identifiers, tool versions, environment fingerprint, authority, and parent run.
2. Redact credentials and unnecessary sensitive content before persistence; store references rather than secrets.
3. Snapshot mutable state before the first side effect.
4. Record tool calls, observable results, file or state effects, errors, and timestamps as append-only events.
5. Store output artifacts and compute a state diff against the starting snapshot.
6. Replay or branch from a declared checkpoint, compare artifacts, and report the reproducibility boundary.

## Invariants

- Credentials and bearer tokens are never stored in captures.
- Observable inputs, outputs, tool effects, and artifacts are preferred over private chain-of-thought.
- Every branch declares its parent run and divergence point.
- A replay reports environmental or provider differences rather than hiding them.

## Failure modes

- A raw HTTP or process capture persists live credentials. Mitigation: Redact before write, scan artifacts before commit, and treat capture storage as sensitive by default.
- A replay is called deterministic despite provider, network, clock, or dependency drift. Mitigation: Fingerprint nondeterministic dependencies and report partial reproducibility with the differing boundary.

## Composition

- Before: `context-firewall`, `evidence-ladder`, `grit`
- After: `governed-self-modification`

## Provenance

- [Seed Phrase System](https://github.com/Gonzih/nexus-protocols/blob/main/SEED_PHRASE_SYSTEM.md) — Conversation lineage and branchability source — The public contract replaces mnemonic framing with explicit run manifests, parent links, and redaction rules.
- [Nexus Clojure Proxy](https://github.com/Gonzih/nexus-clojure-proxy) — Scripted-response and behavioral-capture implementation evidence — Used as evidence for deterministic test doubles, not as a production isolation guarantee.

## Limitations

- Commercial model inference may remain nondeterministic even with identical visible inputs.
- A full environment snapshot can be expensive or platform-specific.
- Reproducibility does not establish correctness; verification criteria remain separate.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
