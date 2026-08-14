<!-- generated from https://maksim.sh/knowledge/protocols/evidence-ladder.json; do not edit directly -->
# Evidence Ladder

> Record the transformation from request to conclusion as an append-only, inspectable evidence chain.

- Canonical JSON: [https://maksim.sh/knowledge/protocols/evidence-ladder.json](https://maksim.sh/knowledge/protocols/evidence-ladder.json)
- Version: 1.0.0
- Status: stable
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

Make an agent result reconstructable by preserving what was requested, decomposed, observed, executed, compared, verified, and concluded without overwriting prior states.

## Use when

- A result must be audited, reproduced, challenged, or updated.
- Multiple transformations separate source evidence from the final conclusion.
- A failure must remain attributable to a specific execution stage.

## Avoid when

- The ladder would record secrets, personal data, or protected content without an approved storage and redaction policy.

## Input contract

- `request_id` (string, required)
- `request` (string, required)
- `actor` (string, required)
- `constraints` (array, optional)
- `parent_event` (string | null, optional)

## Output contract

- `request_id` (string, required)
- `events` (array, required)
- `conclusion` (string, required)
- `verification_status` (verified | partially-verified | unverified | failed, required)

## Procedure

1. Create an immutable query event containing the request, actor, constraints, and parent reference.
2. Record decomposition as a new event; do not rewrite the original request.
3. Record each execution or observation with its source, tool identity, timestamp, and artifact reference.
4. Record comparisons, disagreements, and transformations as separate events linked to their inputs.
5. Record verification criteria, result, and unresolved gaps.
6. Emit a conclusion event that points to supporting events and carries an explicit verification status.

## Invariants

- Prior events are append-only and addressable.
- Every conclusion links to the evidence and transformations that support it.
- Missing or failed evidence writes are visible to the caller.
- Sensitive data is redacted before persistence according to an explicit policy.

## Failure modes

- The ladder records a polished narrative rather than execution evidence. Mitigation: Require source, artifact, actor, timestamp, and parent references for each material transformation.
- Evidence persistence fails but the pipeline reports full auditability. Mitigation: Surface failed writes and downgrade the final verification status.

## Composition

- Before: `edge-map`, `reality-check`, `context-firewall`, `grit`
- After: `temporal-knowledge`, `reproducible-agent-run`

## Provenance

- [Nexus Evidence Service](https://github.com/Gonzih/nexus-evidence-service) — Implementation evidence — The public contract strengthens failure visibility and generalizes the original pipeline-specific stage names.

## Limitations

- An immutable record can faithfully preserve incorrect evidence.
- Full capture may conflict with privacy, security, retention, or data-minimization requirements.
- Artifact integrity requires independent storage, hashing, signing, or access controls not specified by this protocol.

## Rights

All Rights Reserved. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: Maksim Soltan — https://maksim.sh/
