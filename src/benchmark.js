export const PHASES = ["scalar", "branch", "linear", "chase", "simd"];

const TASKS = [
  {
    name: "scalar",
    initial: 400_000,
    minimum: 20_000,
    maximum: 80_000_000,
    invoke: ({ probe }, units) => probe.scalar(units),
    rate: (units, milliseconds) => ({
      value: units / milliseconds / 1_000,
      unit: "Miter/s",
    }),
  },
  {
    name: "branch",
    initial: 300_000,
    minimum: 20_000,
    maximum: 80_000_000,
    invoke: ({ probe }, units) => probe.branch(units),
    rate: (units, milliseconds) => ({
      value: units / milliseconds / 1_000,
      unit: "Miter/s",
    }),
  },
  {
    name: "linear",
    initial: 4,
    minimum: 1,
    maximum: 4_096,
    invoke: ({ probe }, units) => probe.linear_scan(units),
    rate: (units, milliseconds, probe) => ({
      value: (probe.buffer_bytes() * units * 1_000) / milliseconds / 2 ** 30,
      unit: "GiB/s",
    }),
  },
  {
    name: "chase",
    initial: 300_000,
    minimum: 10_000,
    maximum: 80_000_000,
    invoke: ({ probe }, units) => probe.pointer_chase(units),
    rate: (units, milliseconds) => ({
      value: units / milliseconds / 1_000,
      unit: "Mhop/s",
    }),
  },
  {
    name: "simd",
    initial: 300_000,
    minimum: 20_000,
    maximum: 80_000_000,
    available: ({ simdMix }) => typeof simdMix === "function",
    invoke: ({ simdMix }, units) => simdMix(units),
    rate: (units, milliseconds) => ({
      value: units / milliseconds / 1_000,
      unit: "Mvec/s",
    }),
  },
];

export function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function calibratedUnits(task, units, elapsed, targetMs) {
  const ratio = targetMs / Math.max(elapsed, 0.01);
  const next = Math.round(units * clamp(ratio, 0.25, 8));
  return clamp(next, task.minimum, task.maximum);
}

function measure(task, context, units) {
  const started = performance.now();
  const checksum = task.invoke(context, units) >>> 0;
  const elapsedMs = Math.max(performance.now() - started, 0.001);
  return { checksum, elapsedMs };
}

export async function runSuite({
  probe,
  simdMix = null,
  samples = 21,
  targetMs = 18,
  onProgress = () => {},
  yieldControl = async () => {},
}) {
  const context = { probe, simdMix };
  const tasks = TASKS.filter((task) => !task.available || task.available(context));
  const results = {};
  const suiteStarted = performance.now();
  let aggregateChecksum = 0;

  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    const task = tasks[taskIndex];
    let units = task.initial;

    // One discarded warm-up gets the function through first-call tiering.
    task.invoke(context, units);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await yieldControl();
      const calibration = measure(task, context, units);
      const next = calibratedUnits(task, units, calibration.elapsedMs, targetMs);
      if (calibration.elapsedMs >= targetMs * 0.72 && calibration.elapsedMs <= targetMs * 1.4) {
        break;
      }
      if (next === units) break;
      units = next;
    }

    const timings = [];
    let checksum = 0;

    for (let sample = 0; sample < samples; sample += 1) {
      await yieldControl();
      const measurement = measure(task, context, units);
      timings.push(measurement.elapsedMs);
      checksum ^= measurement.checksum;
      aggregateChecksum ^= measurement.checksum;

      onProgress({
        phase: task.name,
        sample: sample + 1,
        samples,
        elapsedMs: measurement.elapsedMs,
        checksum: measurement.checksum,
        progress: (taskIndex + (sample + 1) / samples) / tasks.length,
      });
    }

    const medianMs = percentile(timings, 0.5);
    const p95Ms = percentile(timings, 0.95);
    const rate = task.rate(units, medianMs, probe);

    results[task.name] = {
      units,
      samples,
      medianMs,
      p95Ms,
      rate: rate.value,
      unit: rate.unit,
      checksum: checksum >>> 0,
    };
  }

  return {
    elapsedMs: performance.now() - suiteStarted,
    checksum: aggregateChecksum >>> 0,
    tests: results,
  };
}
