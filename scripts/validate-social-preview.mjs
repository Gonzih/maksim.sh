import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const gifPath = path.join(rootDir, "public", "og-animated-v2.gif");
const pngPath = path.join(rootDir, "public", "og.png");
const htmlPath = path.join(rootDir, "index.html");
const failures = [];

const fail = (message) => failures.push(message);
const gif = await readFile(gifPath);
const png = await readFile(pngPath);
const html = await readFile(htmlPath, "utf8");
const { size } = await stat(gifPath);

if (gif.subarray(0, 6).toString("ascii") !== "GIF89a") {
  fail("Animated social preview is not a GIF89a file.");
}

const width = gif.readUInt16LE(6);
const height = gif.readUInt16LE(8);
if (width !== 1_200 || height !== 630) {
  fail(`Animated social preview is ${width}x${height}; expected 1200x630.`);
}

if (size > 5 * 1_048_576) {
  fail(`Animated social preview is ${(size / 1_048_576).toFixed(2)} MiB; expected at most 5 MiB.`);
}

if (!gif.includes(Buffer.from("NETSCAPE2.0", "ascii"))) {
  fail("Animated social preview does not declare an infinite animation loop.");
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!png.subarray(0, 8).equals(pngSignature)) {
  fail("Static social preview fallback is not a PNG file.");
} else if (png.readUInt32BE(16) !== 1_200 || png.readUInt32BE(20) !== 630) {
  fail(`Static social preview fallback is ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}; expected 1200x630.`);
}

const gifUrl = "https://maksim.sh/og-animated-v2.gif";
const pngUrl = "https://maksim.sh/og.png";
const ogImages = [...html.matchAll(/<meta property="og:image" content="([^"]+)">/g)]
  .map((match) => match[1]);

if (ogImages.length !== 1 || ogImages[0] !== gifUrl) {
  fail(`index.html must declare only the animated Open Graph image; received ${JSON.stringify(ogImages)}.`);
}
if (html.includes(`<meta property="og:image:secure_url" content="${pngUrl}">`)) {
  fail("index.html must not declare the static PNG as another Open Graph image.");
}
if (!html.includes('<meta property="og:image:type" content="image/gif">')) {
  fail("index.html does not declare the Open Graph GIF media type.");
}
if (!html.includes(`<meta name="twitter:image" content="${gifUrl}">`)) {
  fail("index.html does not use the animated image for the Twitter card.");
}

if (failures.length > 0) {
  console.error("Social preview validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Validated animated social preview: 1200x630, ${(size / 1_048_576).toFixed(2)} MiB.`);
