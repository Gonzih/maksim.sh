import { spawn } from "node:child_process";
import { copyFile, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const frameDir = await mkdtemp(path.join(tmpdir(), "maksim-social-preview-"));
const outputPath = path.join(rootDir, "public", "og-animated-v2.gif");
const fallbackPath = path.join(rootDir, "public", "og.png");
const host = "127.0.0.1";
const port = 4175;
const origin = `http://${host}:${port}`;
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const run = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code}\n${stderr || stdout}`));
    });
  });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // Vite has not started listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${origin}`);
};

const vite = spawn(
  process.execPath,
  [
    path.join(rootDir, "node_modules", "vite", "bin", "vite.js"),
    "--host",
    host,
    "--port",
    String(port),
    "--strictPort",
  ],
  { cwd: rootDir, stdio: "ignore" },
);

let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({
    viewport: { width: 1_200, height: 630 },
    deviceScaleFactor: 1,
  });

  await page.goto(`${origin}/?social-preview=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__renderSocialPreviewFrame === "function");
  await page.evaluate(() => document.fonts.ready);

  const nameBounds = await page.locator(".name").boundingBox();
  const safeLeft = 180;
  const safeRight = 1_020;
  if (!nameBounds || nameBounds.x < safeLeft || nameBounds.x + nameBounds.width > safeRight) {
    throw new Error(
      `Preview name must fit the centered 840px iMessage safe area; received ${JSON.stringify(nameBounds)}.`,
    );
  }

  await page.evaluate(() => {
    for (let frame = 0; frame < 180; frame += 1) {
      window.__renderSocialPreviewFrame((frame / 179) * 3_200);
    }
  });

  const frameCount = 36;
  const startTime = 3_200;
  const endTime = 5_000;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const elapsed = startTime + ((endTime - startTime) * frame) / (frameCount - 1);
    await page.evaluate((time) => window.__renderSocialPreviewFrame(time), elapsed);
    await page.screenshot({
      path: path.join(frameDir, `frame-${String(frame).padStart(3, "0")}.png`),
      type: "png",
      fullPage: false,
    });
  }

  await copyFile(path.join(frameDir, "frame-000.png"), fallbackPath);

  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-framerate",
    "18",
    "-i",
    path.join(frameDir, "frame-%03d.png"),
    "-filter_complex",
    "[0:v]split=2[forward][reverse_input];[reverse_input]reverse[reverse];[forward][reverse]concat=n=2:v=1:a=0[loop];[loop]split=2[palette_input][gif_input];[palette_input]palettegen=max_colors=64:stats_mode=diff[palette];[gif_input][palette]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle[gif]",
    "-map",
    "[gif]",
    "-loop",
    "0",
    outputPath,
  ]);

  const { size } = await stat(outputPath);
  console.log(`Generated ${path.relative(rootDir, outputPath)} (${(size / 1_048_576).toFixed(2)} MiB).`);
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
  await rm(frameDir, { recursive: true, force: true });
}
