import { createDirector } from "./backgrounds/index.js";
import { createLetterField } from "./letters.js";
import "./styles.css";

const host = document.querySelector("#field");

const parameters = new URLSearchParams(window.location.search);
const socialPreviewMode = parameters.has("social-preview");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (socialPreviewMode) {
  document.documentElement.dataset.socialPreview = "true";
}

// ?bg=<n> pins a single module, which keeps the social preview deterministic
// and makes it possible to review one background in isolation.
const pinned = parameters.has("bg") ? Number.parseInt(parameters.get("bg"), 10) : null;

const director = createDirector(host, {
  reducedMotion: prefersReducedMotion.matches,
  moduleDuration: prefersReducedMotion.matches ? 40_000 : 24_000,
  only: socialPreviewMode && pinned === null ? 0 : pinned,
});

// The hero letters take the same shockwave the background does, so a click
// reads as one impulse crossing the whole page.
const letterField = createLetterField(document.querySelector("#name"), {
  reducedMotion: prefersReducedMotion.matches,
});

// Floor imposed on every module when the visitor asked for reduced motion.
const REDUCED_MOTION_INTERVAL = 1_000 / 12;

let resizeRequest = 0;
let lastFrameAt = 0;
let elapsed = 0;

function loop(timestamp) {
  window.requestAnimationFrame(loop);

  // Each module declares its own cadence; the canvas field runs uncapped so
  // its trail fade stays smooth, character grids throttle to save CPU.
  const interval = prefersReducedMotion.matches
    ? Math.max(REDUCED_MOTION_INTERVAL, director.frameInterval)
    : director.frameInterval;

  // Letters settle on a spring, so they step every frame even when the active
  // background is throttled — otherwise the recoil would visibly stair-step.
  elapsed = timestamp;
  letterField.step(timestamp);

  if (interval > 0 && timestamp - lastFrameAt < interval) return;
  lastFrameAt = timestamp;
  director.render(timestamp);
}

window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeRequest);
  resizeRequest = window.requestAnimationFrame(() => {
    director.resize();
    letterField.measure();
  });
});

window.addEventListener("pointermove", (event) => {
  director.setPointer(event.clientX, event.clientY);
});

window.addEventListener("pointerleave", () => {
  director.clearPointer();
});

window.addEventListener("pointerdown", (event) => {
  director.addRipple(event.clientX, event.clientY, elapsed);
  letterField.push(event.clientX, event.clientY, elapsed);
});

// Space skips to the next background. Ignored while a control has focus so it
// never swallows the space a keyboard user meant for a link or button.
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("a, button, input, textarea, select, [contenteditable]")) return;
  event.preventDefault();
  director.next(elapsed);
});

await director.start(0);
director.render(0);

// Lets the current module be identified from the console or a test harness.
Object.defineProperty(window, "__background", { get: () => director.label });

if (socialPreviewMode) {
  window.__renderSocialPreviewFrame = (time) => {
    elapsed = time;
    director.render(time);
  };
} else {
  window.requestAnimationFrame(loop);
}
