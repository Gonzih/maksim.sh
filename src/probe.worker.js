import initWasm, { Probe } from "./wasm/maksim_wasm.js";
import initSimd, { simd_mix } from "./wasm-simd/maksim_simd.js";
import { runSuite } from "./benchmark.js";
import { setTelemetryRunning, writeTelemetry } from "./telemetry.js";

let baselineExports;
let simdAvailable = false;
let sharedView = null;
let bufferBytes = 2 * 1024 * 1024;

const yieldWorker = () => new Promise((resolve) => setTimeout(resolve, 0));

self.addEventListener("message", async ({ data }) => {
  if (data.type === "init") {
    bufferBytes = data.bufferBytes || bufferBytes;
    sharedView = data.sharedBuffer ? new Int32Array(data.sharedBuffer) : null;

    try {
      const started = performance.now();
      baselineExports = await initWasm();
      const baselineMs = performance.now() - started;
      let simdMs = null;

      try {
        const simdStarted = performance.now();
        await initSimd();
        simdMs = performance.now() - simdStarted;
        simdAvailable = true;
      } catch {
        simdAvailable = false;
      }

      self.postMessage({
        type: "ready",
        baselineMs,
        simdAvailable,
        simdMs,
        memoryBytes: baselineExports.memory?.buffer.byteLength || null,
      });
    } catch (error) {
      self.postMessage({ type: "init-error", message: String(error) });
    }
    return;
  }

  if (data.type !== "run") return;

  const probe = new Probe(bufferBytes);
  if (sharedView) setTelemetryRunning(sharedView, true);

  try {
    const result = await runSuite({
      probe,
      simdMix: simdAvailable ? simd_mix : null,
      samples: data.samples,
      targetMs: data.targetMs,
      yieldControl: yieldWorker,
      onProgress(event) {
        if (sharedView) {
          writeTelemetry(sharedView, event);
        } else {
          self.postMessage({ type: "progress", runId: data.runId, event });
        }
      },
    });

    self.postMessage({
      type: "result",
      runId: data.runId,
      result,
      memoryBytes: baselineExports.memory?.buffer.byteLength || null,
    });
  } catch (error) {
    self.postMessage({ type: "run-error", runId: data.runId, message: String(error) });
  } finally {
    probe.free();
    if (sharedView) setTelemetryRunning(sharedView, false);
  }
});
