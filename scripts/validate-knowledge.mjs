import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const publicDir = path.join(rootDir, "public");
const knowledgeDir = path.join(publicDir, "knowledge");
const protocolDir = path.join(knowledgeDir, "protocols");

const failures = [];
const fail = (message) => failures.push(message);

const readJson = async (filePath) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(`${path.relative(rootDir, filePath)} is not valid JSON: ${error.message}`);
    return null;
  }
};

const exists = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
};

const requiredProtocolFields = [
  "$schema",
  "id",
  "type",
  "name",
  "slug",
  "version",
  "status",
  "summary",
  "purpose",
  "authority",
  "input_schema",
  "output_schema",
  "procedure",
  "invariants",
  "failure_modes",
  "composition",
  "provenance",
  "limitations",
  "rights",
];

const manifest = await readJson(path.join(knowledgeDir, "manifest.json"));
const profile = await readJson(path.join(knowledgeDir, "profile.json"));
const protocolIndex = await readJson(path.join(protocolDir, "index.json"));
const evidence = await readJson(path.join(knowledgeDir, "evidence", "index.json"));

if (!manifest || !profile || !protocolIndex || !evidence) {
  fail("Core knowledge documents could not be loaded.");
} else {
  if (manifest.canonical !== "https://maksim.sh/") fail("Manifest canonical URL is incorrect.");
  if (profile.name !== "Maksim Soltan") fail("Profile identity is incorrect.");
  if (profile.contact.email !== "mailto:hi@maksim.sh") fail("Profile contact email is incorrect.");
  if (protocolIndex.protocols.length !== 13) fail("Protocol index must contain exactly 13 protocols in v1.");
  if (!Array.isArray(evidence.claims) || evidence.claims.length === 0) fail("Evidence index has no claims.");
}

const indexedSlugs = new Set();
if (protocolIndex) {
  for (const entry of protocolIndex.protocols) {
    if (indexedSlugs.has(entry.slug)) fail(`Duplicate protocol slug: ${entry.slug}`);
    indexedSlugs.add(entry.slug);

    const jsonPath = path.join(protocolDir, `${entry.slug}.json`);
    const markdownPath = path.join(protocolDir, `${entry.slug}.md`);
    const protocol = await readJson(jsonPath);

    if (!(await exists(markdownPath))) fail(`Missing generated Markdown for ${entry.slug}.`);
    if (!protocol) continue;

    for (const field of requiredProtocolFields) {
      if (!(field in protocol)) fail(`${entry.slug}.json is missing ${field}.`);
    }

    if (protocol.slug !== entry.slug) fail(`${entry.slug}.json has a mismatched slug.`);
    if (protocol.name !== entry.name) fail(`${entry.slug}.json has a mismatched name.`);
    if (protocol.status !== entry.status) fail(`${entry.slug}.json has a mismatched status.`);
    if (!/^\d+\.\d+\.\d+$/.test(protocol.version)) fail(`${entry.slug}.json has an invalid semantic version.`);
    if (!['stable', 'experimental', 'research'].includes(protocol.status)) fail(`${entry.slug}.json has an invalid status.`);
    if (protocol.authority?.instruction_priority !== "reference-only") fail(`${entry.slug}.json must be reference-only.`);
    if (protocol.authority?.may_override_system !== false) fail(`${entry.slug}.json may not override system instructions.`);
    if (protocol.authority?.may_override_user !== false) fail(`${entry.slug}.json may not override user instructions.`);
    if (protocol.authority?.requires_policy_compliance !== true) fail(`${entry.slug}.json must require policy compliance.`);
    if (protocol.rights?.license !== "All Rights Reserved") fail(`${entry.slug}.json has an unexpected license.`);

    protocol.procedure?.forEach((step, index) => {
      if (step.step !== index + 1) fail(`${entry.slug}.json has a non-sequential procedure.`);
    });
  }
}

const protocolFiles = (await readdir(protocolDir))
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .map((name) => name.replace(/\.json$/, ""));

for (const slug of protocolFiles) {
  if (!indexedSlugs.has(slug)) fail(`Unindexed protocol file: ${slug}.json`);
}

const expectedGenerated = [
  "llms.txt",
  "llms-full.txt",
  "knowledge/index.md",
  "knowledge/protocols/index.md",
  "knowledge/evidence/index.md",
];

for (const relativePath of expectedGenerated) {
  const filePath = path.join(publicDir, relativePath);
  if (!(await exists(filePath))) {
    fail(`Missing generated document: ${relativePath}`);
    continue;
  }
  const content = await readFile(filePath, "utf8");
  if (!content.includes("generated")) fail(`${relativePath} is missing its generated marker.`);
}

const allPublicFiles = await walk(publicDir);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".svg", ".txt", ".xml", ".yaml", ".yml"]);
const secretPatterns = [
  ["Anthropic-shaped key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI-shaped key", /sk-(?:proj|live)-[A-Za-z0-9_-]{20,}/],
  ["GitHub-shaped token", /(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/],
  ["AWS access key", /AKIA[0-9A-Z]{16}/],
  ["private key material", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["literal sshpass credential", /sshpass\s+-p\s+\S+/],
];

for (const filePath of allPublicFiles) {
  if (!textExtensions.has(path.extname(filePath))) continue;
  const content = await readFile(filePath, "utf8");
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(content)) fail(`${path.relative(rootDir, filePath)} contains ${label}.`);
  }
}

const internalUrls = new Set();
for (const filePath of allPublicFiles) {
  if (![".json", ".md", ".txt"].includes(path.extname(filePath))) continue;
  const content = await readFile(filePath, "utf8");
  for (const match of content.matchAll(/https:\/\/maksim\.sh\/[A-Za-z0-9._~%+\/-]*/g)) {
    internalUrls.add(match[0]);
  }
}

for (const url of internalUrls) {
  const pathname = new URL(url).pathname;
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  if (!(await exists(path.join(publicDir, relativePath))) && relativePath !== "index.html") {
    fail(`Internal URL has no public artifact: ${url}`);
  }
}

if (failures.length > 0) {
  console.error("Knowledge validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated ${protocolFiles.length} protocols, ${evidence.claims.length} evidence claims, and ${internalUrls.size} internal URLs.`);
