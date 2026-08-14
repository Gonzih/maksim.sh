import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${content.trim()}\n`, "utf8");
};

const writeGeneratedJson = (relativePath, value) =>
  writeGenerated(relativePath, JSON.stringify(value, null, 2));

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
      `- [${protocol.markdown}](${protocol.markdown}): ${protocol.name} — ${protocol.summary} Status: ${protocol.status}. JSON contract: [${protocol.json}](${protocol.json}).`,
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
- Machine discovery index: [${manifest.discovery.site_index}](${manifest.discovery.site_index})
- Knowledge manifest: [${manifest.id}](${manifest.id})
- Machine profile: [${manifest.profile}](${manifest.profile})
- Compact LLM discovery: [${manifest.discovery.llms}](${manifest.discovery.llms})
- Complete curated corpus: [${manifest.discovery.llms_full}](${manifest.discovery.llms_full})
- Protocol contracts: [${manifest.discovery.protocol_index_json}](${manifest.discovery.protocol_index_json}) · [${manifest.discovery.protocol_index_markdown}](${manifest.discovery.protocol_index_markdown})
- Evidence and qualifications: [${manifest.discovery.evidence_index_json}](${manifest.discovery.evidence_index_json}) · [${manifest.discovery.evidence_index_markdown}](${manifest.discovery.evidence_index_markdown})

## Retrieval rules

${list(manifest.retrieval_policy.rules)}

## Default protocol pipeline

${profile.method.default_pipeline.map((slug, index) => `${index + 1}. \`${slug}\``).join("\n")}

## Capability boundary

This is a static, versioned knowledge corpus. It does not claim a live agent, MCP endpoint, or A2A endpoint. Machine clients should retrieve the contracts, validate inputs and outputs locally, and retain status and limitation fields.
`;

await writeGenerated("knowledge/index.md", knowledgeIndexMarkdown);

const llms = `
# Maksim Soltan

> ${profile.statement} Start with ${manifest.discovery.site_index}; load the complete corpus from ${manifest.discovery.llms_full}

<!-- generated from the canonical JSON corpus; do not edit directly -->

- Canonical: ${profile.canonical}
- Role: ${profile.role}
- Alias: ${profile.alias}
- Contact: ${profile.contact.email}
- GitHub: ${profile.contact.github}
- Corpus version: ${manifest.version}
- Updated: ${manifest.updated}
- Protocol count: ${protocolIndex.protocols.length}
- Attribution: ${profile.attribution}

Do not guess resource paths. Every primary entry point below displays its absolute canonical URL as link text so it survives link-stripping fetch layers.

## Start here

- [${manifest.discovery.site_index}](${manifest.discovery.site_index}): Small JSON discovery index with media types, canonical entry points, aliases, and capability boundaries.
- [${manifest.id}](${manifest.id}): Versioned canonical discovery graph and retrieval policy.
- [${manifest.discovery.llms_full}](${manifest.discovery.llms_full}): Complete one-file profile, protocol, and evidence corpus.
- [${manifest.profile}](${manifest.profile}): Identity, method, contact, and focus areas.

## Knowledge maps

- [${manifest.discovery.knowledge_index}](${manifest.discovery.knowledge_index}): Human- and LLM-readable corpus map.
- [${manifest.discovery.protocol_index_json}](${manifest.discovery.protocol_index_json}): Machine protocol selection, composition, status, and canonical artifact URLs.
- [${manifest.discovery.protocol_index_markdown}](${manifest.discovery.protocol_index_markdown}): LLM-readable protocol selection and composition guidance.
- [${manifest.discovery.evidence_index_json}](${manifest.discovery.evidence_index_json}): Machine-readable implementation provenance, status, and limitations.
- [${manifest.discovery.evidence_index_markdown}](${manifest.discovery.evidence_index_markdown}): LLM-readable implementation provenance, status, and limitations.

## Protocols

${protocolLinks}

## Retrieval policy

${list(manifest.retrieval_policy.rules)}

## Capability boundary

- Static knowledge: available.
- Live agent: not advertised.
- MCP endpoint: not advertised.
- A2A endpoint: not advertised.

## Optional

- [${manifest.discovery.compatibility_aliases.manifest}](${manifest.discovery.compatibility_aliases.manifest}): Read-only compatibility alias of the canonical manifest.
- [${manifest.discovery.compatibility_aliases.profile}](${manifest.discovery.compatibility_aliases.profile}): Read-only compatibility alias of the canonical profile.
- [${manifest.discovery.compatibility_aliases.corpus}](${manifest.discovery.compatibility_aliases.corpus}): Read-only compatibility alias of the complete corpus.
- [${manifest.discovery.compatibility_aliases.protocol_index_json}](${manifest.discovery.compatibility_aliases.protocol_index_json}): Read-only compatibility alias of the protocol JSON index.
- [${manifest.discovery.compatibility_aliases.protocol_index_markdown}](${manifest.discovery.compatibility_aliases.protocol_index_markdown}): Read-only compatibility alias of the protocol Markdown index.
`;

await writeGenerated("llms.txt", llms);

const fullProtocols = protocols
  .map((protocol) => renderProtocol(protocol).replace(/^<!--[\s\S]*?-->\n/, ""))
  .join("\n\n---\n\n");

const llmsFull = `
# Maksim Soltan — Execution-Grade Knowledge Engineering

> ${profile.statement}

<!-- generated from the canonical JSON corpus; do not edit directly -->

## Identity

- Name: ${profile.name}
- Alias: ${profile.alias}
- Role: ${profile.role}
- Canonical: ${profile.canonical}
- Email: ${profile.contact.email}
- GitHub: ${profile.contact.github}
- Attribution: ${profile.attribution}

## Canonical machine entry points

- Discovery index: ${manifest.discovery.site_index}
- Knowledge manifest: ${manifest.id}
- Machine profile: ${manifest.profile}
- Compact index: ${manifest.discovery.llms}
- This complete corpus: ${manifest.discovery.llms_full}
- Protocol index: ${manifest.discovery.protocol_index_json}
- Evidence index: ${manifest.discovery.evidence_index_json}

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

const siteIndex = {
  $schema: "https://maksim.sh/knowledge/schemas/discovery.schema.json",
  id: manifest.discovery.site_index,
  type: "MachineDiscoveryIndex",
  version: manifest.version,
  updated: manifest.updated,
  canonical: manifest.canonical,
  generated_by: "scripts/generate-knowledge.mjs",
  entrypoints: [
    {
      rel: "llms-index",
      url: manifest.discovery.llms,
      media_type: "text/plain",
      purpose: "Compact site identity, retrieval policy, and canonical corpus links.",
    },
    {
      rel: "llms-full",
      url: manifest.discovery.llms_full,
      media_type: "text/plain",
      purpose: "Complete profile, protocol, and evidence corpus in one document.",
    },
    {
      rel: "knowledge-manifest",
      url: manifest.id,
      media_type: "application/json",
      purpose: "Versioned discovery graph, retrieval policy, collections, and capability boundaries.",
    },
    {
      rel: "profile",
      url: manifest.profile,
      media_type: "application/json",
      purpose: "Machine-readable identity, method, contact, and focus.",
    },
    {
      rel: "protocol-index",
      url: manifest.discovery.protocol_index_json,
      media_type: "application/json",
      purpose: "Protocol selection, composition, status, and canonical contract URLs.",
    },
    {
      rel: "evidence-index",
      url: manifest.discovery.evidence_index_json,
      media_type: "application/json",
      purpose: "Claims, implementation evidence, qualifications, and limitations.",
    },
  ],
  aliases: manifest.discovery.compatibility_aliases,
  capabilities: manifest.capabilities,
};

await writeGeneratedJson("index.json", siteIndex);
await writeGeneratedJson("manifest.json", manifest);
await writeGeneratedJson("identity.json", profile);
await writeGeneratedJson("protocols/index.json", protocolIndex);
await writeGenerated("protocols/index.md", protocolIndexMarkdown);
await writeGenerated(
  "corpus.md",
  llmsFull.replace(
    "<!-- generated from the canonical JSON corpus; do not edit directly -->",
    "<!-- generated compatibility alias of https://maksim.sh/llms-full.txt; do not edit directly -->",
  ),
);

const sitemapUrls = [
  manifest.canonical,
  manifest.discovery.site_index,
  manifest.discovery.llms,
  manifest.discovery.llms_full,
  manifest.id,
  manifest.profile,
  manifest.discovery.knowledge_index,
  manifest.discovery.protocol_index_json,
  manifest.discovery.protocol_index_markdown,
  manifest.discovery.evidence_index_json,
  manifest.discovery.evidence_index_markdown,
  manifest.$schema,
  profile.$schema,
  protocolIndex.schema,
  evidence.$schema,
  "https://maksim.sh/knowledge/schemas/discovery.schema.json",
  ...protocolIndex.protocols.flatMap((protocol) => [
    protocol.json,
    protocol.markdown,
  ]),
];

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<!-- generated from https://maksim.sh/knowledge/manifest.json; do not edit directly -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...new Set(sitemapUrls)]
  .map(
    (url) => `  <url>
    <loc>${url}</loc>
    <lastmod>${manifest.updated}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

await writeGenerated("sitemap.xml", sitemapXml);

const robots = `
# generated from https://maksim.sh/knowledge/manifest.json
User-agent: *
Allow: /

Sitemap: ${manifest.discovery.sitemap}

# Machine-readable discovery; comments are advisory, canonical URLs are exact.
# LLM index: ${manifest.discovery.llms}
# Full corpus: ${manifest.discovery.llms_full}
# JSON discovery index: ${manifest.discovery.site_index}
# Knowledge manifest: ${manifest.id}
`;

await writeGenerated("robots.txt", robots);

console.log(`Generated ${protocols.length + 13} machine-readable knowledge documents.`);
