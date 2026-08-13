import initWasm, {
  boot_line,
  boot_line_count,
  Inference,
} from "./wasm/maksim_wasm.js";

let model = null;
let generation = 0;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function serializeFrame(frame) {
  return {
    block: frame.block(),
    tick: frame.tick(),
    tokenIndex: frame.token_index(),
    tokenCount: frame.token_count(),
    input: Array.from(frame.input()),
    output: Array.from(frame.output()),
    contributions: Array.from(frame.contributions()),
    emitted: frame.emitted(),
    energy: frame.energy_q8() / 256,
    dominant: frame.dominant(),
    outputChecksum: frame.output_checksum(),
    done: frame.done(),
  };
}

async function run(runId, delayMs) {
  const started = performance.now();

  while (runId === generation && model && !model.done()) {
    const frame = model.step();
    const packet = serializeFrame(frame);
    frame.free();
    self.postMessage({ type: "frame", runId, frame: packet });

    if (packet.done) break;
    await wait(packet.emitted ? delayMs * 1.7 : delayMs);
  }

  if (runId === generation && model?.done()) {
    self.postMessage({
      type: "complete",
      runId,
      elapsedMs: performance.now() - started,
    });
  }
}

self.addEventListener("message", ({ data }) => {
  if (data.type === "start") {
    generation += 1;
    model.reset();
    void run(generation, data.delayMs || 14);
    return;
  }

  if (data.type === "stop") {
    generation += 1;
  }
});

async function initialize() {
  try {
    const started = performance.now();
    const exports = await initWasm();
    model = new Inference();

    self.postMessage({
      type: "ready",
      initMs: performance.now() - started,
      memoryBytes: exports.memory?.buffer.byteLength || null,
      model: {
        name: model.model_name(),
        architecture: model.architecture(),
        runtime: model.runtime(),
        tokenCount: model.token_count(),
        checksum: model.model_checksum(),
      },
      bootLines: Array.from({ length: boot_line_count() }, (_, index) => boot_line(index)),
    });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  }
}

void initialize();
