import { PHASES } from "./benchmark.js";

const HEADER_WORDS = 4;
const RECORD_WORDS = 6;
const RECORD_COUNT = 64;

export function createTelemetryBuffer() {
  return new SharedArrayBuffer(
    Int32Array.BYTES_PER_ELEMENT * (HEADER_WORDS + RECORD_WORDS * RECORD_COUNT),
  );
}

export function setTelemetryRunning(view, running) {
  Atomics.store(view, 1, running ? 1 : 0);
  if (!running) Atomics.store(view, 3, 1_000);
}

export function writeTelemetry(view, event) {
  const sequence = Atomics.load(view, 0) + 1;
  const slot = sequence % RECORD_COUNT;
  const offset = HEADER_WORDS + slot * RECORD_WORDS;
  const phaseId = PHASES.indexOf(event.phase) + 1;

  Atomics.store(view, offset, sequence);
  Atomics.store(view, offset + 1, phaseId);
  Atomics.store(view, offset + 2, event.sample);
  Atomics.store(view, offset + 3, event.samples);
  Atomics.store(view, offset + 4, Math.round(event.elapsedMs * 1_000));
  Atomics.store(view, offset + 5, event.checksum | 0);
  Atomics.store(view, 2, phaseId);
  Atomics.store(view, 3, Math.round(event.progress * 1_000));
  Atomics.store(view, 0, sequence);
  Atomics.notify(view, 0);
}

export function readTelemetry(view, lastSequence) {
  const published = Atomics.load(view, 0);
  const first = Math.max(lastSequence + 1, published - RECORD_COUNT + 1);
  const records = [];

  for (let sequence = first; sequence <= published; sequence += 1) {
    const slot = sequence % RECORD_COUNT;
    const offset = HEADER_WORDS + slot * RECORD_WORDS;
    if (Atomics.load(view, offset) !== sequence) continue;

    records.push({
      phase: PHASES[Atomics.load(view, offset + 1) - 1] || "unknown",
      sample: Atomics.load(view, offset + 2),
      samples: Atomics.load(view, offset + 3),
      elapsedMs: Atomics.load(view, offset + 4) / 1_000,
      checksum: Atomics.load(view, offset + 5) >>> 0,
      progress: Atomics.load(view, 3) / 1_000,
    });
  }

  return {
    records,
    sequence: published,
    running: Atomics.load(view, 1) === 1,
    progress: Atomics.load(view, 3) / 1_000,
  };
}
