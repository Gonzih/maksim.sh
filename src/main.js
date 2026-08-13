import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
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
  white: "\x1b[38;5;252m",
  gray: "\x1b[38;5;245m",
  border: "\x1b[38;5;239m",
};

const ANSI_PATTERN = /(\x1b\[[0-9;?]*[ -/]*[@-~])/g;
const paint = (color, value) => `${ANSI[color]}${value}${ANSI.reset}`;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

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

const state = {
  booting: true,
  autoTyping: false,
  workerReady: false,
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
  model: {
    name: "identity.q8",
    architecture: "4x8 residual / q8.8",
    runtime: "rust / wasm32",
    tokenCount: 0,
    checksum: 0,
  },
};

let renderScheduled = false;
const worker = new Worker(new URL("./inference.worker.js", import.meta.url), { type: "module" });

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

function formatBytes(value) {
  if (value === null || value === undefined) return "n/a";
  if (value >= 2 ** 20) return `${(value / 2 ** 20).toFixed(2)} MiB`;
  return `${(value / 2 ** 10).toFixed(1)} KiB`;
}

function formatHash(value) {
  return `0x${(value >>> 0).toString(16).padStart(8, "0")}`;
}

function signedQ8(value) {
  const normalized = (value / 256).toFixed(2);
  return `${value >= 0 ? "+" : ""}${normalized}`.padStart(6, " ");
}

function node(value) {
  const magnitude = Math.abs(value) / 256;
  const glyph = magnitude >= 0.58 ? "●" : magnitude >= 0.22 ? "◉" : "○";
  return paint(value >= 0 ? "green" : "cyan", glyph);
}

function heatCell(value) {
  const magnitude = Math.abs(value) / 256;
  const glyph = magnitude < 0.04
    ? "·"
    : magnitude < 0.12
      ? "░"
      : magnitude < 0.25
        ? "▒"
        : magnitude < 0.5
          ? "▓"
          : "█";
  const color = magnitude < 0.04 ? "border" : value >= 0 ? "green" : "cyan";
  return paint(color, glyph);
}

function progressBar(value, width = 16) {
  const filled = Math.round(clamp(value, 0, 1) * width);
  return `${paint("green", "█".repeat(filled))}${paint("border", "░".repeat(width - filled))}`;
}

function networkPanel(width) {
  const frame = state.frame;
  const block = frame?.block ?? 0;
  const rows = [
    `${paint("gray", "i   activation")}       ${paint("gray", `W${block} · a contribution`)}       ${paint("gray", "h[i]")}`,
  ];

  for (let index = 0; index < 8; index += 1) {
    if (!frame) {
      rows.push(`${String(index).padStart(2, "0")}  ${paint("border", "+0.00 ○   ········   ○ +0.00")}`);
      continue;
    }

    const matrix = frame.contributions
      .slice(index * 8, index * 8 + 8)
      .map(heatCell)
      .join("");
    rows.push(
      `${String(index).padStart(2, "0")}  ${paint("gray", signedQ8(frame.input[index]))} ${node(frame.input[index])}   ${matrix}   ${node(frame.output[index])} ${paint("white", signedQ8(frame.output[index]))}`,
    );
  }

  rows.push(paint("dim", "· <.04  ░ <.12  ▒ <.25  ▓ <.50  █ ≥.50  cyan = negative"));
  rows.push(paint("dim", "cells are signed q8.8 products from Rust/WASM linear memory"));
  return box(`weight propagation / block ${block + 1} of 4`, rows, width);
}

function modelPanel(width) {
  const frame = state.frame;
  const progress = frame?.tokenCount ? frame.tokenIndex / frame.tokenCount : 0;
  const status = state.running ? "decoding" : state.complete ? "complete" : state.workerReady ? "ready" : "loading";

  return box(`decoder / ${status}`, [
    labelValue("model", state.model.name, "cyan"),
    labelValue("arch", state.model.architecture),
    labelValue("runtime", state.model.runtime),
    labelValue("wasm init", state.initMs === null ? "n/a" : `${state.initMs.toFixed(2)} ms`),
    labelValue("linear mem", formatBytes(state.memoryBytes)),
    labelValue("token", `${String(frame?.tokenIndex || 0).padStart(3, "0")} / ${state.model.tokenCount || "?"}`),
    labelValue("block", `${(frame?.block ?? 0) + 1} / 4`),
    labelValue("tick", String(frame?.tick ?? 0)),
    labelValue("energy", frame ? frame.energy.toFixed(3) : "0.000", "yellow"),
    labelValue("dominant", `h[${frame?.dominant ?? 0}]`),
    labelValue("weights", formatHash(state.model.checksum), "gray"),
    labelValue("output", formatHash(frame?.outputChecksum || 0x811c9dc5), "gray"),
    `${paint("gray", "progress".padEnd(12, " "))}${progressBar(progress)} ${String(Math.round(progress * 100)).padStart(3)}%`,
  ], width);
}

function compactTracePanel(width) {
  const frame = state.frame;
  const progress = frame?.tokenCount ? frame.tokenIndex / frame.tokenCount : 0;
  const rows = [
    joinColumns(
      `${paint("cyan", state.model.name)} · ${state.model.architecture}`,
      state.running ? paint("yellow", "decoding") : state.complete ? paint("green", "complete") : paint("gray", "loading"),
      width - 4,
    ),
    `${progressBar(progress, 20)} ${Math.round(progress * 100)}% · token ${frame?.tokenIndex || 0}/${state.model.tokenCount || "?"}`,
  ];

  for (const index of [0, 2, 4, 6]) {
    const contributions = frame
      ? frame.contributions.slice(index * 8, index * 8 + 8).map(heatCell).join("")
      : paint("border", "········");
    rows.push(
      `h[${index}] ${frame ? node(frame.input[index]) : paint("border", "○")} ${contributions} ${frame ? node(frame.output[index]) : paint("border", "○")} ${frame ? signedQ8(frame.output[index]) : "+0.00"}`,
    );
  }

  rows.push(
    `${paint("gray", "block")} ${(frame?.block ?? 0) + 1}/4  ${paint("gray", "energy")} ${frame?.energy.toFixed(3) || "0.000"}  ${paint("gray", "hash")} ${formatHash(frame?.outputChecksum || 0x811c9dc5)}`,
  );
  return box("wasm weight trace", rows, width);
}

function outputPanel(width, rowCount) {
  const cursor = state.running ? `${ANSI.green}▌${ANSI.reset}` : "";
  let rows = state.decoded ? state.decoded.split("\n") : [paint("dim", "awaiting output head...")];

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
  return box("decoded homepage", rows, width);
}

function promptLine() {
  const prompt = `${paint("green", "maksim.sh")} ${paint("gray", "$ ")}`;
  return `${prompt}${state.input}${ANSI.green}▌${ANSI.reset}`;
}

function renderNow() {
  renderScheduled = false;
  if (!terminal.cols || !terminal.rows) return;

  const width = Math.max(36, terminal.cols - 1);
  const compact = width < 72 || terminal.rows < 34;
  const wide = width >= 104 && !compact;
  const headerLeft = `${paint("green", "●")} ${paint("bold", "maksim.sh")} ${paint("gray", ":: identity inference")}`;
  const headerRight = `${paint("white", "Maksim Soltan")} ${paint("gray", "· github.com/Gonzih")}`;
  const lines = [
    joinColumns(headerLeft, headerRight, width),
    paint("border", "─".repeat(width)),
  ];

  if (compact) {
    lines.push(...compactTracePanel(width));
  } else if (wide) {
    const leftWidth = Math.floor(width * 0.6);
    const rightWidth = width - leftWidth - 1;
    lines.push(...zipPanels(networkPanel(leftWidth), modelPanel(rightWidth), leftWidth));
  } else {
    lines.push(...networkPanel(width));
    const frame = state.frame;
    lines.push(
      joinColumns(
        `${paint("cyan", state.model.name)} · token ${frame?.tokenIndex || 0}/${state.model.tokenCount || "?"} · block ${(frame?.block ?? 0) + 1}/4`,
        `${paint("gray", "weights")} ${formatHash(state.model.checksum)}`,
        width,
      ),
    );
  }

  const logRows = (state.log.length ? state.log : state.bootLines).slice(-2).map((line) => {
    if (line.startsWith("$")) return paint("yellow", line);
    if (line.startsWith("error")) return paint("red", line);
    if (line.startsWith("[wasm]")) return paint("green", line);
    return paint("gray", line);
  });
  const logSectionHeight = logRows.length ? logRows.length + 1 : 0;
  const outputRows = clamp(terminal.rows - lines.length - logSectionHeight - 5, 4, 18);

  lines.push("", ...outputPanel(width, outputRows));
  if (logRows.length) lines.push("", ...logRows);
  lines.push(
    paint("dim", "replay  weights  source  contact  github  blog  email  clear"),
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
  state.elapsedMs = null;
  state.complete = false;
  state.running = true;
  addLog("[wasm] dispatch identity.q8 / trace every residual block");
  worker.postMessage({ type: "start", delayMs: 14 });
  render();
}

function openRoute(route) {
  const routes = {
    github: "https://github.com/Gonzih",
    blog: "https://blog.gonzih.me",
    cv: "https://gonzih.notion.site/Max-Gonzih-CV-d6cb096878a24c9293f2ac8f0f6f87ee",
  };

  if (route === "email") {
    window.location.href = "mailto:gonzih@gmail.com";
  } else if (routes[route]) {
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
        "contact  print routes",
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
        "guest    Rust/WASM owns weights, activations, tokenization, output",
        "worker   advances one residual block per frame",
        "host     xterm.js renders typed arrays as ANSI contribution heat",
        "network  none; inference and content stay on this device",
      ];
    case "contact":
      return [
        "github  github.com/Gonzih",
        "blog    blog.gonzih.me",
        "email   gonzih@gmail.com",
        "web     maksim.sh",
      ];
    case "github":
    case "blog":
    case "email":
    case "cv":
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
    if (data.frame.emitted) state.decoded += data.frame.emitted;
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
window.addEventListener("resize", () => {
  fitAddon.fit();
  render();
});
window.addEventListener("beforeunload", () => worker.terminate());

fitAddon.fit();
render();
