import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import initRenderer, { render_braille_graph as renderBrailleGraph } from "./wasm/maksim_wasm.js";
import "./styles.css";

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
  magenta: "\x1b[38;5;213m",
  violet: "\x1b[38;5;141m",
  blue: "\x1b[38;5;111m",
  white: "\x1b[38;5;252m",
  gray: "\x1b[38;5;245m",
  border: "\x1b[38;5;239m",
};

const ANSI_PATTERN = /(\x1b\[[0-9;?]*[ -/]*[@-~])/g;
const paint = (color, value) => `${ANSI[color]}${value}${ANSI.reset}`;
const paintHex = (hex, value) => {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `\x1b[38;2;${red};${green};${blue}m${value}${ANSI.reset}`;
};
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const PALETTE = {
  positive: ["#ff5f68", "#ff9f43", "#f5d76e", "#68e69b"],
  negative: ["#718cff", "#9e68ff", "#d64ed8", "#ff4f9a"],
  meter: ["#5de28d", "#d8df64", "#ffad4d", "#ff5f68"],
  cyan: ["#50d7e8", "#668cff", "#a468ff"],
  inactive: "#252a27",
};

const PANEL = {
  green: { accent: "#69e399", border: "#315440" },
  yellow: { accent: "#f0d36f", border: "#59512d" },
  cyan: { accent: "#58d5e6", border: "#2c535b" },
  violet: { accent: "#ad7bff", border: "#4b3964" },
  rose: { accent: "#ff6ca8", border: "#65354d" },
};

function hexChannels(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function gradientColor(colors, position) {
  const scaled = clamp(position, 0, 1) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const fraction = scaled - index;
  const start = hexChannels(colors[index]);
  const end = hexChannels(colors[index + 1]);
  const channels = start.map((value, channel) => Math.round(value + (end[channel] - value) * fraction));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const terminal = new Terminal({
  allowTransparency: false,
  convertEol: true,
  cursorBlink: false,
  disableStdin: false,
  fontFamily: '"SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  fontSize: 13,
  fontWeight: "500",
  fontWeightBold: "700",
  letterSpacing: 0,
  lineHeight: 1.02,
  scrollback: 0,
  smoothScrollDuration: 0,
  theme: {
    background: "#050706",
    foreground: "#dce3de",
    cursor: "#69e399",
    selectionBackground: "#1f4733",
    black: "#050706",
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
terminal.loadAddon(new WebLinksAddon((event, uri) => {
  event.preventDefault();
  window.open(uri, "_blank", "noopener,noreferrer");
}));
terminal.open(terminalElement);

const state = {
  booting: true,
  autoTyping: false,
  workerReady: false,
  rendererReady: false,
  running: false,
  complete: false,
  input: "",
  commandHistory: [],
  historyIndex: 0,
  bootLines: [],
  log: [],
  decoded: "",
  frame: null,
  initMs: null,
  memoryBytes: null,
  elapsedMs: null,
  startedAt: performance.now(),
  inferenceHz: 0,
  rateFrames: 0,
  rateWindowAt: performance.now(),
  activationHistory: [],
  blockEnergy: [0, 0, 0, 0],
  emittedTokens: [],
  model: {
    name: "identity.q8",
    architecture: "4x8 residual / q8.8",
    runtime: "wasm32 / q8.8",
    tokenCount: 0,
    checksum: 0,
  },
};

const device = {
  cores: navigator.hardwareConcurrency || 1,
  memory: navigator.deviceMemory ? `${navigator.deviceMemory}GiB` : "n/a",
};

let renderScheduled = false;
const worker = new Worker(new URL("./inference.worker.js", import.meta.url), { type: "module" });

void initRenderer()
  .then(() => {
    state.rendererReady = true;
    render();
  })
  .catch((error) => {
    addLog(`error: braille raster failed: ${String(error)}`);
    render();
  });

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

function box(title, rows, width, style = PANEL.cyan, index = "") {
  const innerWidth = Math.max(12, width - 2);
  const maximumTitle = Math.max(4, width - 8);
  const titleCharacters = Array.from(`${index}${title}`);
  const clippedTitle = titleCharacters.length > maximumTitle
    ? `${titleCharacters.slice(0, maximumTitle - 1).join("")}…`
    : titleCharacters.join("");
  const indexLength = index ? Array.from(index).length : 0;
  const titleText = ` ${index ? paintHex(style.accent, clippedTitle.slice(0, indexLength)) : ""}${paint("white", clippedTitle.slice(indexLength))} `;
  const topPadding = Math.max(0, width - visibleLength(titleText) - 5);
  const top = `${paintHex(style.border, "╭─┐")}${titleText}${paintHex(style.border, `┌${"─".repeat(topPadding)}╮`)}`;
  const bottom = paintHex(style.border, `╰${"─".repeat(innerWidth)}╯`);
  const body = rows.map((row) => {
    const content = fitText(row, innerWidth);
    return `${paintHex(style.border, "│")}${content}${paintHex(style.border, "│")}`;
  });
  return [top, ...body, bottom];
}

function zipPanels(left, right, leftWidth) {
  const height = Math.max(left.length, right.length);
  const output = [];
  for (let index = 0; index < height; index += 1) {
    output.push(`${left[index] || " ".repeat(leftWidth)} ${right[index] || ""}`);
  }
  return output;
}

function labelValue(label, value, color = "white") {
  return `${paint("gray", label.padEnd(12, " "))}${paint(color, value)}`;
}

function formatHash(value) {
  return `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
}

function signedQ8(value) {
  const normalized = (value / 256).toFixed(2);
  return `${value >= 0 ? "+" : ""}${normalized}`.padStart(6, " ");
}

function graphSamples(field, characterWidth) {
  const samples = state.activationHistory
    .slice(-(characterWidth * 2))
    .map((entry) => Math.round(clamp(entry[field], 0, 1) * 255));
  return Uint8Array.from(samples);
}

function brailleRows(field, width, rows, inverted, colors) {
  if (!state.rendererReady) {
    return Array.from({ length: rows }, () => " ".repeat(width));
  }

  const raster = renderBrailleGraph(graphSamples(field, width), width, rows, inverted).split("\n");
  return raster.map((line, row) => paintHex(
    gradientColor(colors, rows === 1 ? 0 : row / (rows - 1)),
    line,
  ));
}

function centeredRule(width, label) {
  const labelText = ` ${label} `;
  const remaining = Math.max(0, width - visibleLength(labelText));
  const left = Math.floor(remaining / 2);
  return `${paintHex("#27322c", "─".repeat(left))}${labelText}${paintHex("#27322c", "─".repeat(remaining - left))}`;
}

function mirroredActivationGraph(width, rowsPerSide = 5) {
  const positive = brailleRows("positive", width, rowsPerSide, false, PALETTE.positive);
  const negative = brailleRows("negative", width, rowsPerSide, true, PALETTE.negative);
  const axis = centeredRule(
    width,
    `${paintHex(PALETTE.positive.at(-1), "▲")}${paintHex(PALETTE.negative[0], "▼")} ${paint("gray", "signed w·x")}`,
  );
  return [...positive, axis, ...negative];
}

function meter(value, width = 16, colors = PALETTE.meter) {
  const filled = Math.round(clamp(value, 0, 1) * width);
  let output = "";
  for (let index = 0; index < width; index += 1) {
    const color = index < filled
      ? gradientColor(colors, width === 1 ? 0 : index / (width - 1))
      : PALETTE.inactive;
    output += paintHex(color, "■");
  }
  return output;
}

function progressBar(value, width = 16) {
  return meter(value, width, PALETTE.meter);
}

function activityPanel(width, compact = false) {
  const innerWidth = Math.max(16, width - 2);
  const frame = state.frame;
  const progress = frame?.tokenCount ? frame.tokenIndex / frame.tokenCount : 0;
  const graphRows = compact ? 3 : clamp(Math.floor((terminal.rows - 34) / 2), 4, 8);
  const graph = mirroredActivationGraph(innerWidth, graphRows);
  const labels = joinColumns(
    ` ${paintHex("#68e69b", "Σ⁺")} ${paint("gray", "max(wᵢxᵢ, 0)")}`,
    `${paint("gray", "tok")} ${frame?.tokenIndex || 0}/${state.model.tokenCount || "?"}  ${paint("gray", "tick")} ${frame?.tick || 0} `,
    innerWidth,
  );
  const footer = joinColumns(
    ` ${paintHex("#ff4f9a", "Σ⁻")} ${paint("gray", "min(wᵢxᵢ, 0)")}`,
    `${progressBar(progress, compact ? 10 : 20)} ${String(Math.round(progress * 100)).padStart(3)}% `,
    innerWidth,
  );

  return box("act / q8.8 matmul", [labels, ...graph, footer], width, PANEL.green, "¹");
}

function channelMeter(value, width) {
  const normalized = clamp(Math.abs(value) / 256, 0, 1);
  return meter(normalized, width, value < 0 ? PALETTE.cyan : PALETTE.meter);
}

function channelsPanel(width) {
  const frame = state.frame;
  const meterWidth = Math.max(6, width - 14);
  const rows = Array.from({ length: 8 }, (_, index) => {
    const value = frame?.output[index] || 0;
    const marker = frame?.dominant === index ? paintHex(PANEL.cyan.accent, "›") : " ";
    return `${marker}${paint("gray", `h${index}`.padEnd(3))}${channelMeter(value, meterWidth)} ${paint(value < 0 ? "cyan" : "white", signedQ8(value))}`;
  });
  return box("vec / hidden state", rows, width, PANEL.cyan, "²");
}

function blocksPanel(width) {
  const barWidth = Math.max(8, width - 21);
  const rows = state.blockEnergy.map((energy, index) => {
    const active = state.frame?.block === index;
    return `${active ? paintHex(PANEL.yellow.accent, "▶") : paintHex(PALETTE.inactive, "■")} ${paint("gray", `res_${index}`.padEnd(7))}${progressBar(energy, barWidth)} ${String(Math.round(energy * 100)).padStart(3)}%`;
  });

  rows.push(labelValue(" kernel", "i16 matvec / q8.8"));
  rows.push(labelValue(" argmax", `h[${state.frame?.dominant ?? 0}]`, "cyan"));
  rows.push(labelValue(" weights", formatHash(state.model.checksum), "gray"));
  rows.push(labelValue(" output", formatHash(state.frame?.outputChecksum || 0x811c9dc5), "gray"));
  return box("res / kernel", rows, width, PANEL.yellow, "³");
}

function tokenStreamPanel(width) {
  const innerWidth = Math.max(12, width - 2);
  const rows = state.emittedTokens.slice(-8).map((event, index, tokens) => {
    const sequence = Math.max(1, (state.frame?.tokenIndex || 0) - tokens.length + index + 1);
    const display = event.value === "\n" ? "\\n" : event.value.replace(/\s/g, "·");
    const token = `${paint("gray", String(sequence).padStart(3, "0"))} ${paintHex(index === tokens.length - 1 ? PANEL.violet.accent : "#dce3de", display || "∅")}`;
    const trace = `${paint("gray", `h${event.dominant}`)} ${paintHex("#f2d475", event.energy.toFixed(2))}`;
    return ` ${joinColumns(token, trace, innerWidth - 1)}`;
  });
  while (rows.length < 8) rows.unshift("");
  return box("tok / decoder", rows, width, PANEL.violet, "⁴");
}

function highlightProfile(line, index) {
  if (index === 0) return `  ${ANSI.bold}${paintHex("#ffffff", line)}${ANSI.reset}`;
  if (index === 1) return `  ${paintHex("#69e399", line)}`;
  if (line === "links") return `  ${paintHex("#4b3964", "─┐")} ${paintHex(PANEL.violet.accent, line)} ${paintHex("#4b3964", "┌────────")}`;
  if (line === "contact") return `  ${paintHex("#65354d", "─┐")} ${paintHex(PANEL.rose.accent, line)} ${paintHex("#65354d", "┌──────")}`;

  const [label, ...valueParts] = line.trim().split(/\s{2,}/);
  const value = valueParts.join("  ");
  if (value) {
    const valueColor = value.startsWith("http") ? "#69dce9" : "#f2d475";
    return `  ${paint("gray", label.padEnd(8))}${paintHex("#3c4942", "→")} ${paintHex(valueColor, value)}`;
  }

  return line;
}

function outputPanel(width, rowCount) {
  const cursor = state.running ? `${ANSI.green}▌${ANSI.reset}` : "";
  let rows = state.decoded
    ? state.decoded.split("\n").map(highlightProfile)
    : [paint("dim", " waiting for output head...")];

  if (state.running && rows.length) {
    rows[rows.length - 1] += cursor;
  }

  if (rows.length > rowCount) {
    const omitted = rows.length - rowCount + 2;
    rows = [
      rows[0],
      paint("dim", `… ${omitted} decoded lines above …`),
      ...rows.slice(-(rowCount - 2)),
    ];
  }

  while (rows.length < rowCount) rows.push("");
  return box("profile / decoded", rows, width, PANEL.rose, "⁵");
}

function promptLine() {
  const prompt = `${paint("green", "maksim.sh")} ${paint("gray", "$ ")}`;
  return `${prompt}${state.input}${ANSI.green}▌${ANSI.reset}`;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)}KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MiB`;
}

function telemetryLine(width) {
  const left = [
    `${paint("gray", "wasm")} ${paintHex("#68e69b", formatBytes(state.memoryBytes))}`,
    `${paint("gray", "init")} ${paint("white", state.initMs === null ? "—" : `${state.initMs.toFixed(2)}ms`)}`,
    `${paint("gray", "step")} ${paintHex("#f2d475", `${state.inferenceHz}/s`)}`,
    `${paint("gray", "device")} ${paint("white", `${device.cores}c/${device.memory}`)}`,
    `${paint("gray", "raster")} ${paintHex("#ad7bff", "2×4 braille")}`,
  ].join(` ${paintHex("#323b36", "│")} `);
  return joinColumns(left, paintHex("#69e399", "github.com/Gonzih"), width);
}

function renderNow() {
  renderScheduled = false;
  if (!terminal.cols || !terminal.rows) return;

  const width = Math.max(36, terminal.cols - 1);
  const compact = width < 72 || terminal.rows < 36;
  const wide = width >= 110 && !compact;
  const live = state.running ? paintHex("#69e399", "●") : paintHex("#4f5b54", "●");
  const headerLeft = `${live} ${paint("bold", "maksim.sh")} ${paintHex("#34413a", "│")} ${paint("gray", state.model.name)}`;
  const headerRight = compact
    ? paintHex("#69dce9", "@Gonzih")
    : `${paint("white", "Maksim Soltan")}  ${paint("gray", "·")}  ${paintHex("#69dce9", "github.com/Gonzih")}`;
  const lines = [
    joinColumns(headerLeft, headerRight, width),
    paintHex("#26312b", "─".repeat(width)),
  ];

  if (compact) {
    lines.push(...activityPanel(width, true));
  } else {
    lines.push(...activityPanel(width));
  }

  if (wide) {
    const channelWidth = Math.floor(width * 0.34);
    const blockWidth = Math.floor(width * 0.35);
    const tokenWidth = width - channelWidth - blockWidth - 2;
    lines.push(
      "",
      ...zipPanels(
        zipPanels(channelsPanel(channelWidth), blocksPanel(blockWidth), channelWidth),
        tokenStreamPanel(tokenWidth),
        channelWidth + blockWidth + 1,
      ),
    );
  } else if (!compact) {
    const leftWidth = Math.floor((width - 1) / 2);
    lines.push("", ...zipPanels(channelsPanel(leftWidth), blocksPanel(width - leftWidth - 1), leftWidth));
  }

  const logRows = (state.log.length ? state.log : state.bootLines).slice(-1).map((line) => {
    if (line.startsWith("$")) return paint("yellow", line);
    if (line.startsWith("error")) return paint("red", line);
    if (line.startsWith("[wasm]")) return paint("green", line);
    return paint("gray", line);
  });
  const logSectionHeight = logRows.length ? logRows.length + 1 : 0;
  const outputRows = clamp(terminal.rows - lines.length - logSectionHeight - (compact ? 5 : 7), 4, compact ? 9 : 16);

  lines.push("", ...outputPanel(width, outputRows));
  if (logRows.length) lines.push("", ...logRows);
  if (!compact) lines.push(telemetryLine(width));
  lines.push(
    `${paint("dim", "replay  weights  source  github  clear")} ${paintHex("#34413a", "│")} ${paint("gray", "↑↓ history  ^C stop")}`,
    promptLine(),
  );

  const visible = lines.length > terminal.rows
    ? lines.slice(lines.length - terminal.rows)
    : lines;
  terminal.write(`\x1b[2J\x1b[H\x1b[?25l${visible.join("\r\n")}`);
}

function render() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(renderNow);
}

function addLog(...lines) {
  state.log.push(...lines);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
  if (lines.length) statusElement.textContent = lines.at(-1);
}

function startInference() {
  if (!state.workerReady) {
    addLog("error: wasm inference worker is not ready");
    render();
    return;
  }

  state.decoded = "";
  state.frame = null;
  state.activationHistory = [];
  state.blockEnergy = [0, 0, 0, 0];
  state.emittedTokens = [];
  state.elapsedMs = null;
  state.inferenceHz = 0;
  state.rateFrames = 0;
  state.rateWindowAt = performance.now();
  state.complete = false;
  state.running = true;
  addLog("[wasm] dispatch identity.q8 / trace every residual block");
  worker.postMessage({ type: "start", delayMs: 14 });
  render();
}

function openRoute(route) {
  const routes = {
    github: "https://github.com/Gonzih",
  };

  if (routes[route]) {
    window.open(routes[route], "_blank", "noopener,noreferrer");
  }
}

function commandLines(command) {
  const [name] = command.trim().toLowerCase().split(/\s+/, 1);

  switch (name) {
    case "":
      return [];
    case "infer":
    case "replay":
      queueMicrotask(startInference);
      return [];
    case "help":
      return [
        "replay   reset the q8 model and decode again",
        "weights  inspect model dimensions and hashes",
        "source   inspect the host / guest boundary",
        "github   open the only route",
        "^C       stop the current trace",
      ];
    case "weights":
      return [
        `model    ${state.model.name}`,
        `shape    ${state.model.architecture}`,
        `hash     ${formatHash(state.model.checksum)}`,
        "math     signed i16 q8.8 matvec + residual + rational squash",
        "payload  homepage token stream compiled into the wasm guest",
      ];
    case "source":
      return [
        "guest    WebAssembly owns q8 weights, activations, tokens, braille raster",
        "raster   two adjacent samples -> one 2x4 cell via 5x5 glyph lookup",
        "worker   advances one residual block per frame",
        "host     xterm.js writes ANSI rows; it does not calculate the graph",
        "network  none; inference and content stay on this device",
      ];
    case "contact":
      return [
        "github  github.com/Gonzih",
      ];
    case "github":
      openRoute(name);
      return [`opened ${name}`];
    case "whoami":
      return ["Maksim Soltan"];
    case "clear":
      state.log = [];
      return [];
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

function handleInput(data) {
  if (state.booting || state.autoTyping) return;

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
    if (state.running) {
      worker.postMessage({ type: "stop" });
      state.running = false;
      addLog("^C inference trace stopped");
    } else {
      addLog("^C");
    }
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

async function typeBoot(lines) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const line of lines) {
    state.bootLines.push("");
    if (reducedMotion) {
      state.bootLines[state.bootLines.length - 1] = line;
      render();
      continue;
    }

    for (let index = 1; index <= line.length; index += 1) {
      state.bootLines[state.bootLines.length - 1] = line.slice(0, index);
      render();
      await sleep(5);
    }
  }
}

async function autoTypeCommand(command) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  state.autoTyping = true;
  state.input = "";
  await sleep(260);

  if (reducedMotion) {
    state.input = command;
    render();
    await sleep(100);
  } else {
    for (const character of command) {
      state.input += character;
      render();
      await sleep(46);
    }
    await sleep(180);
  }

  state.autoTyping = false;
  submitCommand();
}

worker.addEventListener("message", ({ data }) => {
  if (data.type === "ready") {
    state.workerReady = true;
    state.model = data.model;
    state.initMs = data.initMs;
    state.memoryBytes = data.memoryBytes;
    void (async () => {
      await typeBoot(data.bootLines);
      state.booting = false;
      addLog("[wasm] decoder ready / scheduling identity prompt");
      render();
      terminal.focus();
      await autoTypeCommand("infer identity.weights --trace");
    })();
    return;
  }

  if (data.type === "frame") {
    state.frame = data.frame;
    state.rateFrames += 1;
    const rateNow = performance.now();
    const rateElapsed = rateNow - state.rateWindowAt;
    if (rateElapsed >= 350) {
      state.inferenceHz = Math.round((state.rateFrames * 1_000) / rateElapsed);
      state.rateFrames = 0;
      state.rateWindowAt = rateNow;
    }
    const contributionCount = Math.max(1, data.frame.contributions.length);
    const positive = Math.sqrt(data.frame.contributions.reduce(
      (sum, value) => sum + (value > 0 ? value * value : 0),
      0,
    ) / contributionCount) / 112;
    const negative = Math.sqrt(data.frame.contributions.reduce(
      (sum, value) => sum + (value < 0 ? value * value : 0),
      0,
    ) / contributionCount) / 112;
    state.activationHistory.push({
      positive: clamp(positive, 0, 1),
      negative: clamp(negative, 0, 1),
    });
    if (state.activationHistory.length > 1_024) state.activationHistory.shift();
    state.blockEnergy[data.frame.block] = clamp(data.frame.energy * 1.9, 0, 1);
    if (data.frame.emitted) {
      state.decoded += data.frame.emitted;
      state.emittedTokens.push({
        value: data.frame.emitted,
        dominant: data.frame.dominant,
        energy: data.frame.energy,
      });
      if (state.emittedTokens.length > 32) state.emittedTokens.shift();
    }
    render();
    return;
  }

  if (data.type === "complete") {
    state.running = false;
    state.complete = true;
    state.elapsedMs = data.elapsedMs;
    addLog(
      `[wasm] eos / ${state.model.tokenCount} tokens / ${(data.elapsedMs / 1_000).toFixed(2)}s staged trace`,
    );
    render();
    return;
  }

  if (data.type === "error") {
    state.booting = false;
    state.running = false;
    addLog(`error: wasm inference failed: ${data.message}`);
    render();
  }
});

worker.addEventListener("error", (event) => {
  state.booting = false;
  state.running = false;
  addLog(`error: inference worker failed: ${event.message}`);
  render();
});

terminal.onData(handleInput);
terminalElement.addEventListener("pointerdown", () => terminal.focus());
function fitTerminal() {
  const fontSize = window.innerWidth < 680 ? 11 : 13;
  if (terminal.options.fontSize !== fontSize) terminal.options.fontSize = fontSize;
  fitAddon.fit();
}

window.addEventListener("resize", () => {
  fitTerminal();
  render();
});
window.addEventListener("beforeunload", () => worker.terminate());

fitTerminal();
render();
