<!-- generated from https://maksim.sh/knowledge/protocols/governed-self-modification.json; do not edit directly -->
# Governed Self-Modification

> Gate runtime self-modification through validation, contract tests, atomic activation, observation, and rollback.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/governed-self-modification.json](https://maksim.sh/knowledge/protocols/governed-self-modification.json)
- Version: 1.0.0
- Status: experimental
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Allow a system to improve replaceable behavior without granting unrestricted mutation of its authority, safety boundary, immutable core, or recovery path.

## Use when

- A runtime proposes replacing a tool, function, prompt module, policy implementation, or strategy.
- Hot-swapping is operationally valuable and a safe rollback path exists.
- The modified component has an explicit contract and bounded authority.

## Avoid when

- The target controls root authority, credential access, audit logging, rollback, or the validation gate itself.
- The change cannot be tested in isolation or reversed safely.
- The implementation relies on unrestricted native evaluation of untrusted input.

## Input contract

- `proposal_id` (string, required)
- `target` (string, required)
- `current_version` (string, required)
- `candidate` (object, required)
- `contract_tests` (array, required)
- `rollback_plan` (string, required)
- `authority_boundary` (string, required)

## Output contract

- `proposal_id` (string, required)
- `validation` (accepted | rejected, required)
- `test_results` (array, required)
- `activation` (inactive | canary | active | rolled-back, required)
- `observation` (object, required)
- `rollback_status` (available | executed | failed | not-applicable, required)

## Procedure

1. Reject proposals targeting immutable authority, audit, validation, credential, or rollback boundaries.
2. Parse and validate the candidate representation without executing it in the production authority context.
3. Run contract, safety, resource, and regression tests in an isolated environment.
4. Snapshot the current implementation and activate the candidate atomically under a bounded canary.
5. Observe predefined behavior, cost, error, and policy metrics without allowing the candidate to redefine success.
6. Promote only verified candidates; automatically rollback on threshold violation and append the complete event record.

## Invariants

- The candidate cannot modify the validation gate, immutable core, authority boundary, audit log, or rollback mechanism.
- Activation is atomic and reversible.
- Success criteria are fixed before candidate execution.
- Every proposal, rejection, activation, observation, and rollback is recorded.

## Failure modes

- The candidate passes narrow tests while exploiting or bypassing the evaluator. Mitigation: Keep evaluator authority separate, use adversarial contract tests, and prohibit candidate control over test selection or result interpretation.
- Rollback exists in documentation but cannot restore external side effects. Mitigation: Separate reversible runtime activation from irreversible external actions and gate those actions independently.

## Composition

- Before: `context-firewall`, `reproducible-agent-run`, `grit`
- After: `evidence-ladder`, `reality-check`

## Provenance

- [Nexus Clojure](https://github.com/Gonzih/nexus-clojure) — Runtime self-modification implementation source — The current native evaluation path is unsandboxed; this contract adds mandatory isolation and immutable governance boundaries.
- [Self-modification implementation](https://github.com/Gonzih/nexus-clojure/blob/main/src/nexus/self_modify.clj) — Atomic replacement, logging, and rollback evidence — Implementation evidence does not imply that unrestricted evaluation is safe.

## Limitations

- No finite test suite proves a self-modification safe under every future input.
- External side effects can be irreversible even when code activation is rolled back.
- The protocol requires real isolation and authority separation supplied by the host system.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
