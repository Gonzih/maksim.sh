import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import initWasm, {
  boot_line,
  boot_line_count,
  guest_abi,
  Probe,
} from "./wasm/maksim_wasm.js";
import wasmModuleUrl from "./wasm/maksim_wasm_bg.wasm?url";
import initSimd, { simd_mix } from "./wasm-simd/maksim_simd.js";
import { percentile, runSuite } from "./benchmark.js";
import { createTelemetryBuffer, readTelemetry } from "./telemetry.js";
import "./styles.css";

const BUFFER_BYTES = 2 * 1024 * 1024;
const terminalElement = document.querySelector("#terminal");
const statusElement = document.querySelector("#status");

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[38;5;114m",
  cyan: "\x1b[38;5;81m",
  yellow: "\x1b[38;5;221m",
  red: "\x1b[38;5;203m",
  white: "\x1b[38;5;252m",
  gray: "\x1b[38;5;245m",
  border: "\x1b[38;5;239m",
};

const ANSI_PATTERN = /(\x1b\[[0-9;?]*[ -/]*[@-~])/g;
const paint = (color, value) => `${ANSI[color]}${value}${ANSI.reset}`;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

const terminal = new Terminal({
  allowTransparency: false,
  convertEol: true,
  cursorBlink: false,
  disableStdin: false,
  fontFamily: '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: 13,
  lineHeight: 1.06,
  scrollback: 0,
  smoothScrollDuration: 0,
  theme: {
    background: "#090b0a",
    foreground: "#d7ddd8",
    cursor: "#72e6a1",
    selectionBackground: "#244936",
    black: "#090b0a",
    brightBlack: "#59625c",
    green: "#72e6a1",
    brightGreen: "#9af0b8",
    cyan: "#70d7e8",
    brightCyan: "#a5edf5",
    yellow: "#f2d37d",
    brightYellow: "#ffe6a4",
    red: "#f27f7f",
    brightRed: "#ff9c9c",
    white: "#d7ddd8",
    brightWhite: "#ffffff",
  },
});

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);
terminal.open(terminalElement);

let baselineExports = null;
let mainSimdAvailable = false;
let worker = null;
let workerReadyResolve = null;
let workerReadyPromise = null;
let runSequence = 0;
let telemetryView = null;
let telemetrySequence = 0;
const pendingWorkerRuns = new Map();
const frameEvents = [];
const keyPaintSamples = [];

const state = {
  booting: true,
  bootLines: [],
  commandHistory: [],
  historyIndex: 0,
  input: "",
  log: [],
  autoTyping: false,
  running: null,
  trace: false,
  current: { main: null, worker: null },
  results: { main: null, worker: null },
  guest: {
    status: "loading",
    abi: "rust/wasm32",
    bytes: null,
    fetchMs: null,
    compileMs: null,
    instantiateMs: null,
    probeInitMs: null,
    memoryBytes: null,
    simd: "loading",
    simdMs: null,
  },
  host: {
    frames: 0,
    frameP50: 0,
    frameP95: 0,
    frameP99: 0,
    frameBudget: 0,
    missed: 0,
    longTaskSupported: false,
    longTasks: 0,
    longTaskMs: 0,
    keyPaintP50: 0,
  },
  worker: {
    status: "loading",
    initMs: null,
    simd: false,
    transport: "postMessage",
  },
  device: readDeviceProfile(),
};

function readDeviceProfile() {
  const userAgentData = navigator.userAgentData;
  const browser = userAgentData?.brands?.find(({ brand }) => !/Not.?A.?Brand/i.test(brand))?.brand
    ?? navigator.appName
    ?? "browser";

  return {
    browser,
    platform: userAgentData?.platform || navigator.platform || "unknown",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    threads: navigator.hardwareConcurrency || null,
    memory: navigator.deviceMemory || null,
    isolated: window.crossOriginIsolated === true,
    sharedArrayBuffer: typeof SharedArrayBuffer === "function",
    visibility: document.visibilityState,
  };
}

function refreshDeviceProfile() {
  state.device = readDeviceProfile();
}

function visibleLength(value) {
  return Array.from(value.replace(ANSI_PATTERN, "")).length;
}

function clipAnsi(value, width) {
  const tokens = value.split(ANSI_PATTERN);
  let output = "";
  let visible = 0;

  for (const token of tokens) {
    if (!token) continue;
    if (token.startsWith("\x1b[")) {
      output += token;
      continue;
    }

    for (const character of Array.from(token)) {
      if (visible >= width) return `${output}${ANSI.reset}`;
      output += character;
      visible += 1;
    }
  }

  return output;
}

function fitText(value, width) {
  const length = visibleLength(value);
  if (length <= width) return `${value}${" ".repeat(width - length)}`;
  return `${clipAnsi(value, Math.max(0, width - 1))}…`;
}

function joinColumns(left, right, width) {
  const room = width - visibleLength(left) - visibleLength(right);
  if (room < 2) return fitText(left, width);
  return `${left}${" ".repeat(room)}${right}`;
}

function box(title, rows, width) {
  const innerWidth = Math.max(12, width - 2);
  const titleText = ` ${title} `;
  const topPadding = Math.max(0, innerWidth - titleText.length - 1);
  const top = `${ANSI.border}┌─${paint("cyan", titleText)}${"─".repeat(topPadding)}┐${ANSI.reset}`;
  const bottom = `${ANSI.border}└${"─".repeat(innerWidth)}┘${ANSI.reset}`;
  const body = rows.map((row) => {
    const content = fitText(row, innerWidth - 2);
    return `${ANSI.border}│${ANSI.reset} ${content} ${ANSI.border}│${ANSI.reset}`;
  });
  return [top, ...body, bottom];
}

function zipPanels(left, right, width) {
  const output = [];
  const height = Math.max(left.length, right.length);
  for (let index = 0; index < height; index += 1) {
    output.push(`${left[index] || " ".repeat(width)} ${right[index] || " ".repeat(width)}`);
  }
  return output;
}

function labelValue(label, value, color = "white") {
  return `${paint("gray", label.padEnd(12, " "))}${paint(color, value)}`;
}

function bar(value, width = 16) {
  const normalized = Math.max(0, Math.min(1, value || 0));
  const filled = Math.round(normalized * width);
  return `${paint("green", "█".repeat(filled))}${paint("border", "░".repeat(width - filled))}`;
}

function formatMs(value, digits = 2) {
  return value === null || value === undefined ? "n/a" : `${value.toFixed(digits)} ms`;
}

function formatBytes(value) {
  if (value === null || value === undefined) return "n/a";
  if (value >= 2 ** 20) return `${(value / 2 ** 20).toFixed(2)} MiB`;
  if (value >= 2 ** 10) return `${(value / 2 ** 10).toFixed(1)} KiB`;
  return `${value} B`;
}

function guestPanel(width) {
  const guest = state.guest;
  const pages = guest.memoryBytes ? Math.ceil(guest.memoryBytes / 65_536) : null;

  return box("wasm guest", [
    labelValue("status", guest.status, guest.status === "ready" ? "green" : "yellow"),
    labelValue("abi", guest.abi, "cyan"),
    labelValue("binary", formatBytes(guest.bytes)),
    labelValue("fetch", formatMs(guest.fetchMs)),
    labelValue("compile", formatMs(guest.compileMs)),
    labelValue("instantiate", formatMs(guest.instantiateMs)),
    labelValue("probe init", formatMs(guest.probeInitMs)),
    labelValue("linear mem", guest.memoryBytes ? `${formatBytes(guest.memoryBytes)} / ${pages}p` : "n/a"),
    labelValue("simd128", guest.simd === "ready" ? `ready / ${formatMs(guest.simdMs)}` : guest.simd, guest.simd === "ready" ? "green" : "gray"),
  ], width);
}

function hostPanel(width) {
  const host = state.host;
  const device = state.device;
  const longTasks = host.longTaskSupported
    ? `${host.longTasks} / ${host.longTaskMs.toFixed(0)} ms`
    : "unsupported";

  return box("browser host", [
    labelValue("frame p50", host.frameP50 ? formatMs(host.frameP50, 1) : "sampling"),
    labelValue("frame p95", host.frameP95 ? formatMs(host.frameP95, 1) : "sampling", "yellow"),
    labelValue("frame p99", host.frameP99 ? formatMs(host.frameP99, 1) : "sampling", host.frameP99 > 34 ? "red" : "white"),
    labelValue("missed", `${host.missed} / ${host.frames} frames`),
    labelValue("long tasks", longTasks),
    labelValue("key→paint", host.keyPaintP50 ? formatMs(host.keyPaintP50, 1) : "sampling"),
    labelValue("worker", `${state.worker.status} / ${state.worker.transport}`, state.worker.status === "online" ? "green" : "yellow"),
    labelValue("isolated", device.isolated ? "yes" : "no", device.isolated ? "green" : "gray"),
    labelValue("host hints", `${device.threads || "?"}t · ${device.viewport} @${device.dpr}x`),
  ], width);
}

function formatTest(test) {
  if (!test) return "—";
  const precision = test.rate >= 100 ? 0 : test.rate >= 10 ? 1 : 2;
  return `${test.rate.toFixed(precision)} ${test.unit} · p95 ${test.p95Ms.toFixed(1)}ms`;
}

function resultPanel(lane, width) {
  const result = state.results[lane];
  const current = state.current[lane];
  let status = "idle";
  let color = "gray";

  if (current) {
    status = `${current.phase} ${current.sample}/${current.samples}`;
    color = "yellow";
  } else if (result) {
    status = `done / ${(result.elapsedMs / 1_000).toFixed(2)}s`;
    color = "green";
  }

  const impact = result?.impact
    ? `p95 ${result.impact.frameP95.toFixed(1)}ms · +${result.impact.missed} missed`
    : "—";

  return box(`${lane} thread`, [
    labelValue("status", status, color),
    `${paint("gray", "progress".padEnd(12, " "))}${bar(current?.progress || (result ? 1 : 0))} ${String(Math.round((current?.progress || (result ? 1 : 0)) * 100)).padStart(3)}%`,
    labelValue("scalar", formatTest(result?.tests.scalar)),
    labelValue("branch", formatTest(result?.tests.branch)),
    labelValue("linear", formatTest(result?.tests.linear)),
    labelValue("chase", formatTest(result?.tests.chase)),
    labelValue("simd", formatTest(result?.tests.simd)),
    labelValue("frame impact", impact, result?.impact?.missed ? "yellow" : "white"),
    labelValue("checksum", result ? `0x${result.checksum.toString(16).padStart(8, "0")}` : "—", "gray"),
  ], width);
}

function activityPanel(width) {
  const source = state.log.length ? state.log : state.bootLines;
  const rows = source.slice(-6).map((row) => {
    if (row.startsWith("$")) return paint("yellow", row);
    if (row.startsWith("[wasm]")) return paint("green", row);
    if (row.startsWith("[worker]")) return paint("cyan", row);
    if (row.startsWith("error")) return paint("red", row);
    if (row.startsWith("main:") || row.startsWith("worker:")) return paint("green", row);
    return paint("gray", row);
  });
  while (rows.length < 6) rows.push("");
  return box("activity", rows, width);
}

function promptLine() {
  const prompt = `${paint("green", "maksim.sh")} ${paint("gray", "$ ")}`;
  return `${prompt}${state.input}${ANSI.green}▌${ANSI.reset}`;
}

function render() {
  if (!terminal.cols || !terminal.rows) return;

  const width = Math.max(36, terminal.cols - 1);
  const wide = width >= 88;
  const panelWidth = wide ? Math.floor((width - 1) / 2) : width;
  const headerLeft = `${paint("green", "●")} ${paint("bold", "maksim.sh")} ${paint("gray", ":: browser / wasm probe")}`;
  const headerRight = `${paint("white", "Maksim Soltan")} ${paint("gray", "· github.com/Gonzih")}`;
  const lines = [
    joinColumns(headerLeft, headerRight, width),
    paint("border", "─".repeat(width)),
  ];

  const guest = guestPanel(panelWidth);
  const host = hostPanel(panelWidth);
  const main = resultPanel("main", panelWidth);
  const workerResult = resultPanel("worker", panelWidth);

  if (wide) {
    lines.push(...zipPanels(guest, host, panelWidth), "", ...zipPanels(main, workerResult, panelWidth));
  } else {
    lines.push(...guest, "", ...host, "", ...main, "", ...workerResult);
  }

  lines.push(
    "",
    ...activityPanel(width),
    "",
    paint("dim", "help  probe [main|worker|full]  trace  caps  mem  contact  clear"),
    promptLine(),
  );

  const clipped = lines.slice(Math.max(0, lines.length - terminal.rows));
  terminal.write(`\x1b[2J\x1b[H\x1b[?25l${clipped.join("\r\n")}`);
}

function addLog(...lines) {
  state.log.push(...lines);
  if (state.log.length > 100) state.log.splice(0, state.log.length - 100);
  if (lines.length) statusElement.textContent = lines.at(-1);
}

function frameSnapshot() {
  return {
    sequence: state.host.frames,
    missed: state.host.missed,
    longTasks: state.host.longTasks,
  };
}

async function attachFrameImpact(result, before) {
  await nextFrame();
  const deltas = frameEvents
    .filter((entry) => entry.sequence > before.sequence)
    .map((entry) => entry.delta);
  result.impact = {
    frameP95: percentile(deltas, 0.95),
    missed: state.host.missed - before.missed,
    longTasks: state.host.longTasks - before.longTasks,
  };
  return result;
}

function updateCurrent(lane, event) {
  state.current[lane] = event;
  render();
}

async function runMainProbe({ samples, targetMs }) {
  const before = frameSnapshot();
  const probe = new Probe(BUFFER_BYTES);

  try {
    const result = await runSuite({
      probe,
      simdMix: mainSimdAvailable ? simd_mix : null,
      samples,
      targetMs,
      yieldControl: nextFrame,
      onProgress: (event) => updateCurrent("main", event),
    });
    await attachFrameImpact(result, before);
    state.results.main = result;
    addLog(
      `main: ${(result.elapsedMs / 1_000).toFixed(2)}s · frame p95 ${result.impact.frameP95.toFixed(1)}ms · +${result.impact.missed} missed`,
    );
    return result;
  } finally {
    probe.free();
    state.current.main = null;
    state.guest.memoryBytes = baselineExports?.memory?.buffer.byteLength || state.guest.memoryBytes;
    render();
  }
}

function runWorkerProbe({ samples, targetMs }) {
  if (state.worker.status !== "online") {
    return Promise.reject(new Error("worker lane unavailable"));
  }

  const runId = ++runSequence;
  const before = frameSnapshot();

  return new Promise((resolve, reject) => {
    pendingWorkerRuns.set(runId, { resolve, reject, before });
    worker.postMessage({ type: "run", runId, samples, targetMs });
  });
}

async function executeProbe(mode = "full", options = {}) {
  if (state.running) {
    addLog(`busy: ${state.running} probe already running`);
    render();
    return;
  }

  const samples = options.samples || 21;
  const targetMs = options.targetMs || 18;
  state.running = mode;
  addLog(`${options.auto ? "auto" : "probe"}: ${mode} lane${mode === "full" ? "s" : ""} · ${samples} samples / phase`);
  render();

  try {
    if (mode === "main" || mode === "full") await runMainProbe({ samples, targetMs });
    if (mode === "worker" || mode === "full") await runWorkerProbe({ samples, targetMs });
  } catch (error) {
    addLog(`error: ${String(error.message || error)}`);
  } finally {
    state.running = null;
    state.current.main = null;
    state.current.worker = null;
    render();
  }
}

function commandLines(command) {
  const [name, argument] = command.trim().toLowerCase().split(/\s+/, 2);

  switch (name) {
    case "":
      return [];
    case "help":
      return [
        "probe [full|main|worker]  calibrated Rust/WASM suite",
        "trace                     toggle live frame summaries",
        "caps                      browser capability surface",
        "mem                       guest linear-memory state",
        "contact                   routes for Maksim",
        "source                    runtime composition",
        "clear                     clear activity",
      ];
    case "caps":
    case "profile": {
      refreshDeviceProfile();
      return [
        `browser      ${state.device.browser} / ${state.device.platform}`,
        `viewport     ${state.device.viewport} @ ${state.device.dpr}x`,
        `logical hint ${state.device.threads || "n/a"}`,
        `memory hint  ${state.device.memory ? `${state.device.memory} GB` : "n/a"}`,
        `isolated     ${state.device.isolated}`,
        `shared mem   ${state.device.sharedArrayBuffer}`,
        `simd128      ${state.guest.simd}`,
        `longtask API ${state.host.longTaskSupported}`,
      ];
    }
    case "mem": {
      const bytes = baselineExports?.memory?.buffer.byteLength || state.guest.memoryBytes;
      return [
        `wasm memory  ${formatBytes(bytes)} / ${bytes ? Math.ceil(bytes / 65_536) : "?"} pages`,
        `probe buffer ${formatBytes(BUFFER_BYTES)}`,
        "page size    64 KiB",
        "linear test  sequential logical reads",
        "chase test   deterministic permutation cycle",
      ];
    }
    case "contact":
      return [
        "Maksim Soltan",
        "web     maksim.sh",
        "github  github.com/Gonzih",
        "email   gonzih@gmail.com",
      ];
    case "source":
      return [
        "terminal   xterm.js / canvas renderer",
        "guest      Rust / wasm-bindgen / wasm32",
        "kernels    scalar / branch / linear / chase / simd128",
        `transport  Web Worker / ${state.worker.transport}`,
        "scheduler  requestAnimationFrame / PerformanceObserver",
      ];
    case "trace":
      state.trace = !state.trace;
      return [`trace ${state.trace ? "on" : "off"}`];
    case "whoami":
      return ["maksim"];
    case "uname":
      return [`maksim.sh ${state.guest.abi} xterm.js`];
    case "clear":
      state.log = [];
      return [];
    case "github":
      window.open("https://github.com/Gonzih", "_blank", "noopener,noreferrer");
      return ["opened github.com/Gonzih"];
    case "email":
      window.location.href = "mailto:gonzih@gmail.com";
      return ["opened mailto:gonzih@gmail.com"];
    case "probe":
    case "bench": {
      const mode = argument || "full";
      if (!new Set(["full", "main", "worker"]).has(mode)) {
        return ["error: usage: probe [full|main|worker]"];
      }
      queueMicrotask(() => void executeProbe(mode));
      return [];
    }
    default:
      return [`error: command not found: ${command}`];
  }
}

function submitCommand() {
  const command = state.input;
  state.input = "";

  if (command.trim()) {
    state.commandHistory.push(command);
    state.historyIndex = state.commandHistory.length;
    addLog(`$ ${command}`, ...commandLines(command));
  } else {
    addLog("$");
  }
  render();
}

function recordKeyPaint() {
  const started = performance.now();
  requestAnimationFrame(() => {
    keyPaintSamples.push(performance.now() - started);
    while (keyPaintSamples.length > 64) keyPaintSamples.shift();
    state.host.keyPaintP50 = percentile(keyPaintSamples, 0.5);
  });
}

function handleInput(data) {
  if (state.booting || state.autoTyping) return;
  recordKeyPaint();

  if (data === "\r" || data === "\n") {
    submitCommand();
    return;
  }

  if (data === "\u007f") {
    state.input = state.input.slice(0, -1);
    render();
    return;
  }

  if (data === "\u0003") {
    state.input = "";
    addLog("^C");
    render();
    return;
  }

  if (data === "\u001b[A") {
    state.historyIndex = Math.max(0, state.historyIndex - 1);
    state.input = state.commandHistory[state.historyIndex] || "";
    render();
    return;
  }

  if (data === "\u001b[B") {
    state.historyIndex = Math.min(state.commandHistory.length, state.historyIndex + 1);
    state.input = state.commandHistory[state.historyIndex] || "";
    render();
    return;
  }

  if (/^[\x20-\x7e]+$/.test(data)) {
    state.input += data;
    render();
  }
}

function setupPerformanceObservers() {
  if (!window.PerformanceObserver) return;
  state.host.longTaskSupported = PerformanceObserver.supportedEntryTypes?.includes("longtask") || false;
  if (!state.host.longTaskSupported) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      state.host.longTasks += 1;
      state.host.longTaskMs += entry.duration;
    }
  });
  observer.observe({ type: "longtask", buffered: true });
}

function pollSharedTelemetry() {
  if (!telemetryView) return;
  const telemetry = readTelemetry(telemetryView, telemetrySequence);
  telemetrySequence = telemetry.sequence;
  for (const event of telemetry.records) updateCurrent("worker", event);
}

function monitorFrames() {
  let previous = performance.now();
  let lastRender = previous;
  let lastTrace = previous;
  const samples = [];

  const sample = (now) => {
    const delta = now - previous;
    previous = now;

    if (delta > 0 && delta < 2_000) {
      state.host.frames += 1;
      samples.push(delta);
      while (samples.length > 240) samples.shift();
      frameEvents.push({ sequence: state.host.frames, delta });
      while (frameEvents.length > 720) frameEvents.shift();

      state.host.frameP50 = percentile(samples, 0.5);
      state.host.frameP95 = percentile(samples, 0.95);
      state.host.frameP99 = percentile(samples, 0.99);

      if (!state.host.frameBudget && samples.length >= 45) {
        state.host.frameBudget = percentile(samples.filter((value) => value < 40), 0.5);
      }

      if (state.host.frameBudget) {
        state.host.missed += Math.max(0, Math.round(delta / state.host.frameBudget) - 1);
      }
    }

    pollSharedTelemetry();

    if (state.trace && now - lastTrace >= 1_000) {
      addLog(
        `frame: p50 ${state.host.frameP50.toFixed(1)}ms · p95 ${state.host.frameP95.toFixed(1)}ms · p99 ${state.host.frameP99.toFixed(1)}ms`,
      );
      lastTrace = now;
    }

    if (now - lastRender >= 350) {
      render();
      lastRender = now;
    }

    requestAnimationFrame(sample);
  };

  requestAnimationFrame(sample);
}

async function loadGuest() {
  state.guest.status = "fetching";
  render();

  const fetchStarted = performance.now();
  const response = await fetch(wasmModuleUrl);
  if (!response.ok) throw new Error(`wasm fetch failed: ${response.status}`);
  const bytes = await response.arrayBuffer();
  state.guest.fetchMs = performance.now() - fetchStarted;
  state.guest.bytes = bytes.byteLength;
  state.guest.status = "compiling";
  render();

  const compileStarted = performance.now();
  const module = await WebAssembly.compile(bytes);
  state.guest.compileMs = performance.now() - compileStarted;
  state.guest.status = "instantiating";
  render();

  const instantiateStarted = performance.now();
  baselineExports = await initWasm({ module_or_path: module });
  state.guest.instantiateMs = performance.now() - instantiateStarted;
  state.guest.abi = guest_abi();

  const probeStarted = performance.now();
  const probe = new Probe(BUFFER_BYTES);
  state.guest.probeInitMs = performance.now() - probeStarted;
  probe.free();
  state.guest.memoryBytes = baselineExports.memory?.buffer.byteLength || null;
  state.guest.status = "ready";
  render();
}

async function loadSimd() {
  try {
    const started = performance.now();
    await initSimd();
    state.guest.simdMs = performance.now() - started;
    state.guest.simd = "ready";
    mainSimdAvailable = true;
  } catch {
    state.guest.simd = "unavailable";
    mainSimdAvailable = false;
  }
  render();
}

function handleWorkerMessage({ data }) {
  if (data.type === "ready") {
    state.worker.status = "online";
    state.worker.initMs = data.baselineMs;
    state.worker.simd = data.simdAvailable;
    workerReadyResolve?.(true);
    workerReadyResolve = null;
    render();
    return;
  }

  if (data.type === "progress") {
    updateCurrent("worker", data.event);
    return;
  }

  if (data.type === "result") {
    const pending = pendingWorkerRuns.get(data.runId);
    if (!pending) return;
    pendingWorkerRuns.delete(data.runId);
    state.guest.memoryBytes = Math.max(state.guest.memoryBytes || 0, data.memoryBytes || 0);
    void attachFrameImpact(data.result, pending.before).then((result) => {
      state.results.worker = result;
      state.current.worker = null;
      addLog(
        `worker: ${(result.elapsedMs / 1_000).toFixed(2)}s · frame p95 ${result.impact.frameP95.toFixed(1)}ms · +${result.impact.missed} missed`,
      );
      render();
      pending.resolve(result);
    });
    return;
  }

  if (data.type === "run-error") {
    const pending = pendingWorkerRuns.get(data.runId);
    pendingWorkerRuns.delete(data.runId);
    state.current.worker = null;
    pending?.reject(new Error(data.message));
    return;
  }

  if (data.type === "init-error") {
    state.worker.status = "offline";
    workerReadyResolve?.(false);
    workerReadyResolve = null;
    addLog(`error: worker init failed: ${data.message}`);
    render();
  }
}

function initializeWorker() {
  worker = new Worker(new URL("./probe.worker.js", import.meta.url), { type: "module" });
  workerReadyPromise = new Promise((resolve) => {
    workerReadyResolve = resolve;
  });
  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", (event) => {
    state.worker.status = "offline";
    workerReadyResolve?.(false);
    workerReadyResolve = null;
    addLog(`error: worker unavailable: ${event.message}`);
    render();
  });

  let sharedBuffer = null;
  if (state.device.isolated && state.device.sharedArrayBuffer) {
    sharedBuffer = createTelemetryBuffer();
    telemetryView = new Int32Array(sharedBuffer);
    state.worker.transport = "SAB/Atomics ring";
  }

  worker.postMessage({ type: "init", sharedBuffer, bufferBytes: BUFFER_BYTES });
  return workerReadyPromise;
}

async function typeBoot(lines) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const line of lines) {
    state.bootLines.push("");
    if (reducedMotion) {
      state.bootLines[state.bootLines.length - 1] = line;
      continue;
    }
    for (let index = 1; index <= line.length; index += 1) {
      state.bootLines[state.bootLines.length - 1] = line.slice(0, index);
      render();
      await sleep(7);
    }
  }
}

async function autoTypeCommand(command) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  state.autoTyping = true;
  state.input = "";
  await sleep(320);

  if (reducedMotion) {
    state.input = command;
    render();
    await sleep(120);
  } else {
    for (const character of command) {
      state.input += character;
      render();
      await sleep(58);
    }
    await sleep(220);
  }

  state.autoTyping = false;
  submitCommand();
}

async function start() {
  fitAddon.fit();
  setupPerformanceObservers();
  monitorFrames();
  render();

  try {
    await loadGuest();
    await loadSimd();
    const workerReady = await initializeWorker();
    const lines = Array.from({ length: boot_line_count() }, (_, index) => boot_line(index));
    await typeBoot(lines);
    state.booting = false;
    addLog("ready: scheduling full host / guest probe");
    render();
    terminal.focus();
    await autoTypeCommand(workerReady ? "probe full" : "probe main");
  } catch (error) {
    state.booting = false;
    state.guest.status = "failed";
    addLog("error: wasm guest failed to load", String(error));
    render();
  }
}

terminal.onData(handleInput);
terminalElement.addEventListener("pointerdown", () => terminal.focus());
window.addEventListener("resize", () => {
  fitAddon.fit();
  refreshDeviceProfile();
  render();
});
document.addEventListener("visibilitychange", () => {
  refreshDeviceProfile();
  render();
});
window.addEventListener("beforeunload", () => worker?.terminate());

start();
