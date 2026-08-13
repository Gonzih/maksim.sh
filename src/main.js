import {
  Delaunay,
  color as d3Color,
  easeCubicInOut,
  forceCollide,
  forceManyBody,
  forceSimulation,
  range,
  timer,
} from "d3";
import "./styles.css";

const canvas = document.querySelector("#field");
const context = canvas.getContext("2d", { alpha: false });

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PHASE_DURATION = 10_000;
const PHASES = ["topology", "identity", "signal", "flow"];
const CONCEPTS = [
  "ontology",
  "retrieval",
  "provenance",
  "semantics",
  "memory",
  "evaluation",
  "interfaces",
  "systems",
  "structure",
  "evidence",
];
const PALETTE = ["#c6ff63", "#62e8ff", "#9170ff", "#ff5b91", "#ffd166"];
const PALETTE_RGB = PALETTE.map((value) => {
  const parsed = d3Color(value);
  return [parsed.r, parsed.g, parsed.b];
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const pointer = { x: 0, y: 0, active: false, energy: 0 };
const bursts = [];

let width = 0;
let height = 0;
let pixelRatio = 1;
let nodes = [];
let monogramTargets = [];
let simulation = null;
let resizeRequest = 0;
let animationElapsed = 0;

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function rgba(paletteIndex, alpha) {
  const [red, green, blue] = PALETTE_RGB[paletteIndex % PALETTE_RGB.length];
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function desiredNodeCount() {
  if (width < 640) return 88;
  if (width < 1_080) return 128;
  return 172;
}

function createNodes(count) {
  const random = seededRandom(0x6d616b73);
  return range(count).map((id) => {
    const cluster = id % CONCEPTS.length;
    return {
      id,
      cluster,
      label: id < CONCEPTS.length ? CONCEPTS[id] : null,
      seed: random(),
      phase: random() * TAU,
      radius: 1 + random() * 1.8,
      x: width * (0.15 + random() * 0.7),
      y: height * (0.15 + random() * 0.7),
      vx: 0,
      vy: 0,
    };
  });
}

function sampleMonogram(count) {
  const sampleCanvas = document.createElement("canvas");
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleCanvas.width = 1_000;
  sampleCanvas.height = 560;
  sampleContext.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
  sampleContext.fillStyle = "#fff";
  sampleContext.font = '900 470px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  sampleContext.textAlign = "center";
  sampleContext.textBaseline = "alphabetic";
  sampleContext.fillText("MS", sampleCanvas.width / 2, 470);

  const pixels = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  const candidates = [];
  const stride = 7;

  for (let y = 0; y < sampleCanvas.height; y += stride) {
    for (let x = 0; x < sampleCanvas.width; x += stride) {
      if (pixels[(y * sampleCanvas.width + x) * 4 + 3] > 128) {
        candidates.push({ x, y });
      }
    }
  }

  const random = seededRandom(0x736f6c74);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
  }

  const selected = candidates.slice(0, count);
  const xExtent = selected.reduce(
    ([minimum, maximum], point) => [Math.min(minimum, point.x), Math.max(maximum, point.x)],
    [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  );
  const yExtent = selected.reduce(
    ([minimum, maximum], point) => [Math.min(minimum, point.y), Math.max(maximum, point.y)],
    [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  );
  const sourceWidth = Math.max(1, xExtent[1] - xExtent[0]);
  const sourceHeight = Math.max(1, yExtent[1] - yExtent[0]);
  const targetWidth = width * (width < 720 ? 0.84 : 0.66);
  const targetHeight = height * (width < 720 ? 0.42 : 0.57);
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const sourceCenterX = (xExtent[0] + xExtent[1]) / 2;
  const sourceCenterY = (yExtent[0] + yExtent[1]) / 2;

  return selected.map((point) => ({
    x: width / 2 + (point.x - sourceCenterX) * scale,
    y: height / 2 + (point.y - sourceCenterY) * scale,
  }));
}

function buildSimulation() {
  simulation?.stop();
  simulation = forceSimulation(nodes)
    .alphaDecay(0)
    .velocityDecay(prefersReducedMotion.matches ? 0.34 : 0.2)
    .force("charge", forceManyBody()
      .strength((node) => (node.label ? -14 : -3.5))
      .distanceMax(130))
    .force("collision", forceCollide()
      .radius((node) => (node.label ? 10 : node.radius + 1.5))
      .strength(0.22))
    .stop();
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#050508";
  context.fillRect(0, 0, width, height);

  nodes = createNodes(desiredNodeCount());
  monogramTargets = sampleMonogram(nodes.length);
  buildSimulation();
}

function constellationTarget(node, elapsed) {
  const clusterAngle = (node.cluster / CONCEPTS.length) * TAU + elapsed * 0.000035;
  const clusterRadiusX = width * (0.28 + Math.sin(elapsed * 0.00013) * 0.025);
  const clusterRadiusY = height * (0.27 + Math.cos(elapsed * 0.00011) * 0.025);
  const centerX = width / 2 + Math.cos(clusterAngle) * clusterRadiusX;
  const centerY = height / 2 + Math.sin(clusterAngle * 1.13) * clusterRadiusY;
  const localAngle = node.phase + elapsed * 0.00022 * (node.id % 2 === 0 ? 1 : -1);
  const localRadius = 10 + (node.id % 9) * 4.2;

  return [
    centerX + Math.cos(localAngle) * localRadius,
    centerY + Math.sin(localAngle) * localRadius,
  ];
}

function identityTarget(node, elapsed) {
  const target = monogramTargets[node.id % monogramTargets.length];
  const breath = Math.sin(elapsed * 0.0014 + node.phase) * 2.5;
  return [
    target.x + Math.cos(node.phase) * breath,
    target.y + Math.sin(node.phase) * breath,
  ];
}

function signalTarget(node, elapsed) {
  const columns = Math.max(10, Math.round(Math.sqrt(nodes.length * (width / height))));
  const rows = Math.ceil(nodes.length / columns);
  const column = node.id % columns;
  const row = Math.floor(node.id / columns);
  const normalizedX = (column + 0.5) / columns;
  const normalizedY = (row + 0.5) / rows;
  const wave = Math.sin(normalizedX * TAU * 2.2 + elapsed * 0.0012 + row * 0.5);
  const counterWave = Math.cos(normalizedY * TAU * 1.7 - elapsed * 0.00085 + column * 0.21);

  return [
    width * (0.06 + normalizedX * 0.88) + counterWave * 18,
    height * (0.09 + normalizedY * 0.82) + wave * height * 0.055,
  ];
}

function flowTarget(node, elapsed) {
  const normalized = (node.id + 0.5) / nodes.length;
  const radius = Math.sqrt(normalized) * Math.min(width, height) * 0.49;
  const angle = node.id * GOLDEN_ANGLE + elapsed * 0.00022 * (0.55 + node.seed);
  const pulse = 1 + Math.sin(elapsed * 0.0007 + node.phase) * 0.07;

  return [
    width / 2 + Math.cos(angle) * radius * pulse * (width > height ? 1.32 : 0.92),
    height / 2 + Math.sin(angle) * radius * pulse * 0.88,
  ];
}

const TARGETS = [constellationTarget, identityTarget, signalTarget, flowTarget];

function updatePhysics(elapsed) {
  const phasePosition = elapsed / (prefersReducedMotion.matches ? PHASE_DURATION * 1.8 : PHASE_DURATION);
  const phaseIndex = Math.floor(phasePosition) % PHASES.length;
  const nextPhase = (phaseIndex + 1) % PHASES.length;
  const phaseProgress = phasePosition % 1;
  const transition = easeCubicInOut(clamp((phaseProgress - 0.56) / 0.44));
  const targetStrength = prefersReducedMotion.matches ? 0.006 : 0.0115;

  pointer.energy += ((pointer.active ? 1 : 0) - pointer.energy) * 0.08;

  for (const node of nodes) {
    const from = TARGETS[phaseIndex](node, elapsed);
    const to = TARGETS[nextPhase](node, elapsed);
    const targetX = from[0] + (to[0] - from[0]) * transition;
    const targetY = from[1] + (to[1] - from[1]) * transition;
    const fieldAngle = Math.sin(node.y * 0.006 + elapsed * 0.00031 + node.phase)
      + Math.cos(node.x * 0.004 - elapsed * 0.00024);
    const fieldStrength = prefersReducedMotion.matches ? 0.004 : 0.022;

    node.vx += (targetX - node.x) * targetStrength + Math.cos(fieldAngle * Math.PI) * fieldStrength;
    node.vy += (targetY - node.y) * targetStrength + Math.sin(fieldAngle * Math.PI) * fieldStrength;

    if (pointer.energy > 0.01) {
      const deltaX = node.x - pointer.x;
      const deltaY = node.y - pointer.y;
      const distance = Math.hypot(deltaX, deltaY) || 1;
      const radius = Math.min(width, height) * 0.24;

      if (distance < radius) {
        const force = (1 - distance / radius) ** 2 * pointer.energy * 2.8;
        node.vx += (deltaX / distance) * force;
        node.vy += (deltaY / distance) * force;
      }
    }

    if (node.x < -30) node.vx += 0.8;
    if (node.x > width + 30) node.vx -= 0.8;
    if (node.y < -30) node.vy += 0.8;
    if (node.y > height + 30) node.vy -= 0.8;
  }

  simulation.alpha(0.17).tick();
  return { phaseIndex, nextPhase, transition };
}

function drawAtmosphere(elapsed) {
  const centerX = width * 0.52;
  const centerY = height * 0.5;
  const minimumDimension = Math.min(width, height);

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineWidth = 0.7;

  for (let ring = 0; ring < 11; ring += 1) {
    const baseRadius = minimumDimension * (0.12 + ring * 0.045);
    context.beginPath();

    for (let point = 0; point <= 96; point += 1) {
      const angle = (point / 96) * TAU;
      const distortion = Math.sin(angle * 3 + elapsed * 0.00034 + ring * 0.72) * 8
        + Math.cos(angle * 5 - elapsed * 0.00019 + ring) * 4;
      const radius = baseRadius + distortion;
      const x = centerX + Math.cos(angle) * radius * (width > height ? 1.45 : 0.98);
      const y = centerY + Math.sin(angle) * radius * 0.82;

      if (point === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    context.closePath();
    context.strokeStyle = rgba(ring % 3 === 0 ? 2 : 1, 0.025 + ring * 0.0015);
    context.stroke();
  }

  const pulseProgress = (elapsed % 5_200) / 5_200;
  const pulseRadius = minimumDimension * (0.08 + pulseProgress * 0.58);
  context.beginPath();
  context.arc(centerX, centerY, pulseRadius, 0, TAU);
  context.strokeStyle = rgba(0, (1 - pulseProgress) * 0.12);
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

function edgeControlPoint(source, target, elapsed) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const distance = Math.hypot(deltaX, deltaY) || 1;
  const bend = Math.sin(elapsed * 0.00045 + source.id * 0.71 + target.id * 0.37)
    * Math.min(16, distance * 0.09);
  return {
    x: (source.x + target.x) / 2 - (deltaY / distance) * bend,
    y: (source.y + target.y) / 2 + (deltaX / distance) * bend,
  };
}

function quadraticPoint(source, control, target, progress) {
  const inverse = 1 - progress;
  return {
    x: inverse * inverse * source.x + 2 * inverse * progress * control.x + progress * progress * target.x,
    y: inverse * inverse * source.y + 2 * inverse * progress * control.y + progress * progress * target.y,
  };
}

function collectEdges() {
  const delaunay = Delaunay.from(nodes, (node) => node.x, (node) => node.y);
  const maximumDistance = width < 720 ? 105 : 155;
  const edges = [];

  for (let sourceIndex = 0; sourceIndex < nodes.length; sourceIndex += 1) {
    for (const targetIndex of delaunay.neighbors(sourceIndex)) {
      if (targetIndex <= sourceIndex) continue;
      const source = nodes[sourceIndex];
      const target = nodes[targetIndex];
      const distance = Math.hypot(target.x - source.x, target.y - source.y);
      if (distance < maximumDistance) edges.push({ source, target, distance, maximumDistance });
    }
  }

  return edges;
}

function drawEdges(edges, elapsed) {
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineWidth = 0.72;

  edges.forEach((edge, index) => {
    const control = edgeControlPoint(edge.source, edge.target, elapsed);
    const alpha = (1 - edge.distance / edge.maximumDistance) * 0.24;
    context.beginPath();
    context.moveTo(edge.source.x, edge.source.y);
    context.quadraticCurveTo(control.x, control.y, edge.target.x, edge.target.y);
    context.strokeStyle = rgba(edge.source.cluster, alpha);
    context.stroke();

    if ((edge.source.id * 7 + edge.target.id * 11 + index) % 13 === 0) {
      const progress = (elapsed * 0.00018 + edge.source.seed + index * 0.031) % 1;
      const point = quadraticPoint(edge.source, control, edge.target, progress);
      context.beginPath();
      context.arc(point.x, point.y, 1.15, 0, TAU);
      context.fillStyle = rgba(edge.target.cluster, 0.92);
      context.fill();
    }
  });

  context.restore();
}

function drawNodes(elapsed, topologyOpacity) {
  context.save();
  context.globalCompositeOperation = "screen";

  for (const node of nodes) {
    const shimmer = 0.58 + Math.sin(elapsed * 0.002 + node.phase) * 0.22;
    context.beginPath();
    context.arc(node.x, node.y, node.radius, 0, TAU);
    context.fillStyle = rgba(node.cluster, shimmer);
    context.fill();
  }

  context.font = '500 11px "Helvetica Neue", Arial, sans-serif';
  context.textBaseline = "middle";
  context.letterSpacing = "0.08em";

  for (const node of nodes) {
    if (!node.label || topologyOpacity < 0.03) continue;
    context.beginPath();
    context.arc(node.x, node.y, 4.2, 0, TAU);
    context.fillStyle = rgba(node.cluster, 0.92 * topologyOpacity);
    context.shadowBlur = 18;
    context.shadowColor = rgba(node.cluster, 0.9 * topologyOpacity);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = `rgba(232, 237, 234, ${0.72 * topologyOpacity})`;
    context.fillText(node.label, node.x + 10, node.y + 0.5);
  }

  context.restore();
}

function drawBursts(elapsed) {
  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const burst = bursts[index];
    const progress = (elapsed - burst.startedAt) / 1_350;
    if (progress >= 1) {
      bursts.splice(index, 1);
      continue;
    }

    context.save();
    context.globalCompositeOperation = "screen";
    context.beginPath();
    context.arc(burst.x, burst.y, easeCubicInOut(progress) * Math.min(width, height) * 0.3, 0, TAU);
    context.strokeStyle = rgba(burst.color, (1 - progress) * 0.42);
    context.lineWidth = 1.2;
    context.stroke();
    context.restore();
  }
}

function render(elapsed) {
  animationElapsed = elapsed;
  const fade = prefersReducedMotion.matches ? 0.68 : 0.27;
  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = `rgba(5, 5, 8, ${fade})`;
  context.fillRect(0, 0, width, height);

  const haloX = pointer.active ? pointer.x : width * (0.55 + Math.sin(elapsed * 0.00012) * 0.08);
  const haloY = pointer.active ? pointer.y : height * (0.48 + Math.cos(elapsed * 0.00015) * 0.08);
  const halo = context.createRadialGradient(haloX, haloY, 0, haloX, haloY, Math.min(width, height) * 0.48);
  halo.addColorStop(0, "rgba(98, 232, 255, 0.035)");
  halo.addColorStop(0.45, "rgba(145, 112, 255, 0.018)");
  halo.addColorStop(1, "rgba(5, 5, 8, 0)");
  context.fillStyle = halo;
  context.fillRect(0, 0, width, height);
  context.restore();

  const phase = updatePhysics(elapsed);
  const edges = collectEdges();
  const topologyOpacity = phase.phaseIndex === 0
    ? 1 - phase.transition
    : phase.nextPhase === 0
      ? phase.transition
      : 0;

  drawAtmosphere(elapsed);
  drawEdges(edges, elapsed);
  drawNodes(elapsed, topologyOpacity);
  drawBursts(elapsed);
}

window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
});

window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

window.addEventListener("pointerdown", (event) => {
  bursts.push({
    x: event.clientX,
    y: event.clientY,
    startedAt: animationElapsed,
    color: Math.floor((event.clientX / Math.max(1, width)) * PALETTE.length),
  });
});

window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeRequest);
  resizeRequest = window.requestAnimationFrame(resize);
});

resize();
timer(render);
