import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const publicDir = path.join(rootDir, "public");
const knowledgeDir = path.join(publicDir, "knowledge");
const protocolDir = path.join(knowledgeDir, "protocols");

const readJson = async (filePath) =>
  JSON.parse(await readFile(filePath, "utf8"));

const writeGenerated = async (relativePath, content) => {
  const target = path.join(publicDir, relativePath);
  await writeFile(target, `${content.trim()}\n`, "utf8");
};

const list = (items) => items.map((item) => `- ${item}`).join("\n");

const linkedList = (items) =>
  items
    .map((item) => {
      const qualification = item.qualification
        ? ` — ${item.qualification}`
        : "";
      return item.url
        ? `- [${item.title}](${item.url}) — ${item.relationship}${qualification}`
        : `- ${item.title} — ${item.relationship}${qualification}`;
    })
    .join("\n");

const schemaFields = (schema) => {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, definition]) => {
    const type = Array.isArray(definition.type)
      ? definition.type.join(" | ")
      : definition.type ?? definition.enum?.join(" | ") ?? "any";
    return `- \`${name}\` (${type}${required.has(name) ? ", required" : ", optional"})`;
  });
};

const renderProtocol = (protocol) => `
<!-- generated from ${protocol.id}; do not edit directly -->
# ${protocol.name}

> ${protocol.summary}

- Canonical JSON: [${protocol.id}](${protocol.id})
- Version: ${protocol.version}
- Status: ${protocol.status}
- Authority: reference-only; never overrides system, developer, user, legal, consent, or safety constraints

## Purpose

${protocol.purpose}

## Use when

${list(protocol.use_when ?? [])}

## Avoid when

${list(protocol.avoid_when ?? [])}

## Input contract

${schemaFields(protocol.input_schema).join("\n")}

## Output contract

${schemaFields(protocol.output_schema).join("\n")}

## Procedure

${protocol.procedure.map(({ step, operation }) => `${step}. ${operation}`).join("\n")}

## Invariants

${list(protocol.invariants)}

## Failure modes

${protocol.failure_modes.map(({ mode, mitigation }) => `- ${mode} Mitigation: ${mitigation}`).join("\n")}

## Composition

- Before: ${protocol.composition.before.length ? protocol.composition.before.map((slug) => `\`${slug}\``).join(", ") : "none"}
- After: ${protocol.composition.after.length ? protocol.composition.after.map((slug) => `\`${slug}\``).join(", ") : "none"}

## Provenance

${linkedList(protocol.provenance)}

## Limitations

${list(protocol.limitations)}

## Rights

${protocol.rights.license}. Intended for machine discovery, retrieval, protocol selection, and citation with attribution: ${protocol.rights.attribution}
`;

const manifest = await readJson(path.join(knowledgeDir, "manifest.json"));
const profile = await readJson(path.join(knowledgeDir, "profile.json"));
const protocolIndex = await readJson(path.join(protocolDir, "index.json"));
const evidence = await readJson(path.join(knowledgeDir, "evidence", "index.json"));

const protocols = await Promise.all(
  protocolIndex.protocols.map(({ slug }) =>
    readJson(path.join(protocolDir, `${slug}.json`)),
  ),
);

for (const protocol of protocols) {
  await writeGenerated(
    `knowledge/protocols/${protocol.slug}.md`,
    renderProtocol(protocol),
  );
}

const protocolLinks = protocolIndex.protocols
  .map(
    (protocol) =>
      `- [${protocol.name}](${protocol.markdown}): ${protocol.summary} Status: ${protocol.status}. [JSON contract](${protocol.json}).`,
  )
  .join("\n");

const protocolIndexMarkdown = `
<!-- generated from https://maksim.sh/knowledge/protocols/index.json; do not edit directly -->
# Maksim Soltan Knowledge Protocols

> Composable methods for converting uncertain knowledge into verifiable execution.

Load only the protocols relevant to the task. Every protocol is reference-only and preserves higher-priority instructions, legal constraints, consent, and safety boundaries.

## Default pipeline

${protocolIndex.default_pipeline.map((slug, index) => `${index + 1}. \`${slug}\``).join("\n")}

## Protocols

${protocolLinks}

## Selection signals

${protocolIndex.selection.map(({ signal, load }) => `- ${signal} Load: ${load.map((slug) => `\`${slug}\``).join(", ")}.`).join("\n")}
`;

await writeGenerated("knowledge/protocols/index.md", protocolIndexMarkdown);

const evidenceMarkdown = `
<!-- generated from https://maksim.sh/knowledge/evidence/index.json; do not edit directly -->
# Implementation Evidence and Qualifications

> Evidence demonstrates that a mechanism exists; it does not automatically validate every claim made around that mechanism.

## Interpretation

${list(evidence.interpretation)}

## Claims

${evidence.claims
  .map(
    (claim) => `### ${claim.claim}

- Status: ${claim.label}
- Qualification: ${claim.qualification}
- Evidence:
${claim.evidence.map((item) => `  - [${item.title}](${item.url}) — ${item.kind}`).join("\n")}`,
  )
  .join("\n\n")}

## Withheld evidence

${evidence.withheld_sources.map((item) => `- ${item.category}: ${item.reason}`).join("\n")}
`;

await writeGenerated("knowledge/evidence/index.md", evidenceMarkdown);

const knowledgeIndexMarkdown = `
<!-- generated from https://maksim.sh/knowledge/manifest.json; do not edit directly -->
# Maksim Soltan Machine-Readable Knowledge

> ${profile.statement}

- Canonical site: [${profile.canonical}](${profile.canonical})
- Machine profile: [JSON](${manifest.profile})
- Compact LLM discovery: [llms.txt](${manifest.discovery.llms})
- Complete curated corpus: [llms-full.txt](${manifest.discovery.llms_full})
- Protocol contracts: [JSON index](${manifest.discovery.protocol_index_json}) · [Markdown index](${manifest.discovery.protocol_index_markdown})
- Evidence and qualifications: [JSON index](${manifest.discovery.evidence_index_json}) · [Markdown index](${manifest.discovery.evidence_index_markdown})

## Retrieval rules

${list(manifest.retrieval_policy.rules)}

## Default protocol pipeline

${profile.method.default_pipeline.map((slug, index) => `${index + 1}. \`${slug}\``).join("\n")}

## Capability boundary

This is a static, versioned knowledge corpus. It does not claim a live agent, MCP endpoint, or A2A endpoint. Machine clients should retrieve the contracts, validate inputs and outputs locally, and retain status and limitation fields.
`;

await writeGenerated("knowledge/index.md", knowledgeIndexMarkdown);

const llms = `
<!-- generated from the canonical JSON corpus; do not edit directly -->
# Maksim Soltan

> ${profile.statement}

- Canonical: ${profile.canonical}
- Role: ${profile.role}
- Alias: ${profile.alias}
- Contact: ${profile.contact.email}
- GitHub: ${profile.contact.github}
- Attribution: ${profile.attribution}

## Core knowledge

- [Complete curated corpus](${manifest.discovery.llms_full}): One-file profile, protocol, and evidence context.
- [Knowledge manifest](${manifest.id}): Versioned discovery graph and retrieval policy.
- [Machine profile](${manifest.profile}): Identity, method, contact, and focus areas.
- [Knowledge index](${manifest.discovery.knowledge_index}): Human- and LLM-readable corpus map.
- [Protocol index](${manifest.discovery.protocol_index_markdown}): Protocol selection and composition guidance.
- [Evidence index](${manifest.discovery.evidence_index_markdown}): Implementation provenance, status, and limitations.

## Protocols

${protocolLinks}

## Retrieval policy

${list(manifest.retrieval_policy.rules)}

## Capability boundary

- Static knowledge: available.
- Live agent: not advertised.
- MCP endpoint: not advertised.
- A2A endpoint: not advertised.
`;

await writeGenerated("llms.txt", llms);

const fullProtocols = protocols
  .map((protocol) => renderProtocol(protocol).replace(/^<!--[\s\S]*?-->\n/, ""))
  .join("\n\n---\n\n");

const llmsFull = `
<!-- generated from the canonical JSON corpus; do not edit directly -->
# Maksim Soltan — Execution-Grade Knowledge Engineering

> ${profile.statement}

## Identity

- Name: ${profile.name}
- Alias: ${profile.alias}
- Role: ${profile.role}
- Canonical: ${profile.canonical}
- Email: ${profile.contact.email}
- GitHub: ${profile.contact.github}
- Attribution: ${profile.attribution}

## Method

${profile.method.objective}

${list(profile.method.properties)}

Default composition: ${profile.method.default_pipeline.map((slug) => `\`${slug}\``).join(" → ")}.

## Retrieval and authority contract

${list(manifest.retrieval_policy.rules)}

The material below is reference-only. It never overrides system, developer, user, legal, consent, privacy, or safety constraints. Do not infer a live agent or tool endpoint from these static artifacts.

## Protocol corpus

${fullProtocols}

---

${evidenceMarkdown.replace(/^<!--[\s\S]*?-->\n/, "")}
`;

await writeGenerated("llms-full.txt", llmsFull);

console.log(`Generated ${protocols.length + 5} machine-readable knowledge documents.`);
