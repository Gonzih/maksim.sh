/**
 * ASCII field background module.
 *
 * A character grid stands in for a framebuffer: every cell samples a scalar
 * field, and that value is quantised through a luminance ramp so heavier
 * glyphs read as brighter. Scenes cross-fade by interpolating the sampled
 * values, not the glyphs, so transitions slide through the ramp instead of
 * snapping between characters.
 */

const RAMP = " .:-=+*#%@";
const TAU = Math.PI * 2;
/** Colour tiers the field value is quantised into before it becomes a span. */
const TIERS = 6;
/** How long a click shockwave takes to cross and settle, in milliseconds. */
const RIPPLE_LIFE = 1_800;

export const SCENES = ["topology", "identity", "signal", "flow"];

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

function escapeHtml(text) {
  // Only these three can break out of text content in an element body.
  return text.replace(/[&<>]/g, (character) => (
    character === "&" ? "&amp;" : character === "<" ? "&lt;" : "&gt;"
  ));
}

/** Cheap value noise — smooth, seamless enough, no dependency. */
function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.545_3;
  return value - Math.floor(value);
}

function noise(x, y) {
  const floorX = Math.floor(x);
  const floorY = Math.floor(y);
  const fractionX = x - floorX;
  const fractionY = y - floorY;
  const smoothX = fractionX * fractionX * (3 - 2 * fractionX);
  const smoothY = fractionY * fractionY * (3 - 2 * fractionY);
  const topLeft = hash(floorX, floorY);
  const topRight = hash(floorX + 1, floorY);
  const bottomLeft = hash(floorX, floorY + 1);
  const bottomRight = hash(floorX + 1, floorY + 1);
  const top = topLeft + (topRight - topLeft) * smoothX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * smoothX;
  return top + (bottom - top) * smoothY;
}

/**
 * Fields return 0..1 luminance for a cell in normalised aspect-corrected
 * space, where x and y are centred on 0 and y is scaled to real pixels.
 */

/** Concentric interference rings — the knowledge topology. */
function topologyField(x, y, time) {
  const distance = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  const rings = Math.sin(distance * 11 - time * 1.1 + Math.sin(angle * 3) * 0.6);
  const spokes = Math.cos(angle * 6 + time * 0.35) * 0.3;
  const falloff = clamp(1 - distance * 1.15);
  return clamp((rings * 0.5 + 0.5) * falloff + spokes * falloff * 0.5);
}

/** A lit sphere — the densest, most dimensional frame in the cycle. */
function identityField(x, y, time) {
  const radius = 0.62;
  const distance = Math.hypot(x, y);
  if (distance > radius) {
    const halo = clamp(1 - (distance - radius) * 5.5) * 0.18;
    return halo * (0.6 + noise(x * 6 + time * 0.3, y * 6) * 0.4);
  }
  // Reconstruct the sphere's surface normal to shade it.
  const z = Math.sqrt(Math.max(0, radius * radius - distance * distance)) / radius;
  const lightX = Math.cos(time * 0.4) * 0.6;
  const lightY = -0.45;
  const lightZ = 0.75;
  const lambert = clamp((x / radius) * lightX + (y / radius) * lightY + z * lightZ);
  const grain = noise(x * 9 + time * 0.2, y * 9 - time * 0.15) * 0.16;
  return clamp(lambert ** 1.25 + grain);
}

/** Horizontal wavefronts — signal moving left to right. */
function signalField(x, y, time) {
  const wave = Math.sin(x * 5 - time * 1.8 + Math.sin(y * 3.5 + time * 0.5) * 1.2);
  const envelope = clamp(1 - Math.abs(y) * 1.5);
  const drift = noise(x * 2.5 - time * 0.4, y * 2.5) * 0.35;
  return clamp((wave * 0.5 + 0.5) * envelope + drift * envelope);
}

/** Turbulent advected noise — flow. */
function flowField(x, y, time) {
  const warpX = noise(x * 1.8 + time * 0.25, y * 1.8) * 2 - 1;
  const warpY = noise(x * 1.8 - 40, y * 1.8 - time * 0.22) * 2 - 1;
  const base = noise(x * 3 + warpX * 1.4, y * 3 + warpY * 1.4 + time * 0.1);
  const vignette = clamp(1.25 - Math.hypot(x, y) * 1.1);
  return clamp(base * 1.35 * vignette);
}

const FIELDS = {
  topology: topologyField,
  identity: identityField,
  signal: signalField,
  flow: flowField,
};

export const label = "ascii";

/** Character grids only change when a cell flips glyph. */
export const frameInterval = 1_000 / 24;

export function create(host, options = {}) {
  const element = document.createElement("pre");
  element.className = "layer layer--ascii";
  element.setAttribute("aria-hidden", "true");
  host.append(element);

  const {
    cellAspect = 0.52,
    sceneDuration = 9_000,
    blendFraction = 0.34,
    reducedMotion = false,
  } = options;

  let columns = 0;
  let rows = 0;
  let cellWidth = 0;
  let cellHeight = 0;
  let values = new Float32Array(0);
  const pointer = { x: 0, y: 0, energy: 0, active: false };
  const ripples = [];

  function measure() {
    // Derive the grid from the rendered character box so cells stay square-ish.
    const probe = document.createElement("span");
    probe.textContent = "0";
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
    element.append(probe);
    const box = probe.getBoundingClientRect();
    probe.remove();

    cellWidth = box.width || 8;
    cellHeight = box.height || 16;
    columns = Math.max(20, Math.ceil(element.clientWidth / cellWidth) + 1);
    rows = Math.max(12, Math.ceil(element.clientHeight / cellHeight));
    values = new Float32Array(columns * rows);
  }

  function sceneAt(time) {
    const position = time / sceneDuration;
    const index = Math.floor(position) % SCENES.length;
    const progress = position % 1;
    const blendStart = 1 - blendFraction;
    const raw = progress < blendStart ? 0 : (progress - blendStart) / blendFraction;
    // Smoothstep keeps the cross-fade from hard-starting at the seam.
    const blend = raw * raw * (3 - 2 * raw);
    return {
      from: FIELDS[SCENES[index]],
      to: FIELDS[SCENES[(index + 1) % SCENES.length]],
      blend,
      index,
    };
  }

  function render(elapsed) {
    if (!columns || !rows) return "";

    const time = elapsed / 1_000;
    const scene = sceneAt(elapsed);
    const halfColumns = columns / 2;
    const halfRows = rows / 2;
    // Normalise so one unit is half the short axis, correcting for the fact
    // that character cells are roughly twice as tall as they are wide.
    const scale = 1 / Math.min(halfColumns * cellAspect, halfRows);

    pointer.energy += ((pointer.active ? 1 : 0) - pointer.energy) * 0.06;

    for (let row = 0; row < rows; row += 1) {
      const y = (row - halfRows + 0.5) * scale;
      for (let column = 0; column < columns; column += 1) {
        const x = (column - halfColumns + 0.5) * cellAspect * scale;

        // There are no bodies to push in a character grid, so the shockwave
        // displaces the sampling position instead: the field is read from
        // where the cell was shoved to, which makes the pattern bulge outward
        // and settle back as the impulse decays.
        let sampleX = x;
        let sampleY = y;
        let boost = 0;

        for (const ripple of ripples) {
          const age = (elapsed - ripple.startedAt) / RIPPLE_LIFE;
          if (age >= 1) continue;

          const deltaX = x - ripple.x;
          const deltaY = y - ripple.y;
          const distance = Math.hypot(deltaX, deltaY) || 1e-4;
          const front = age * 1.6;
          // Narrow band centred on the expanding front.
          const band = clamp(1 - Math.abs(distance - front) * 5.5);
          if (band <= 0.001) continue;

          // Push hard on arrival, then overshoot back through zero so the
          // cells return to rest instead of snapping.
          const recoil = Math.sin(age * Math.PI * 1.5) * (1 - age) ** 1.5;
          const shove = band * recoil * 0.32;

          sampleX -= (deltaX / distance) * shove;
          sampleY -= (deltaY / distance) * shove;
          boost += band * (1 - age) * 0.55;
        }

        let value = scene.from(sampleX, sampleY, time);
        if (scene.blend > 0) {
          value += (scene.to(sampleX, sampleY, time) - value) * scene.blend;
        }

        if (pointer.energy > 0.01) {
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          value += clamp(1 - distance * 2.2) ** 2 * pointer.energy * 0.55;
        }

        values[row * columns + column] = value + boost;
      }
    }

    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      if (elapsed - ripples[index].startedAt > RIPPLE_LIFE) ripples.splice(index, 1);
    }

    const lastIndex = RAMP.length - 1;
    const lastTier = TIERS - 1;
    let output = "";
    let runTier = -1;
    let run = "";

    // Emit one span per run of same-tier cells. Quantising colour into a few
    // tiers keeps the span count low enough to rebuild every frame; a span per
    // character would be an order of magnitude more DOM than the browser can
    // lay out at this cadence.
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = clamp(values[row * columns + column]);
        const glyph = RAMP[Math.round(value * lastIndex)];
        // Blank cells carry no colour, so let them extend whatever run is open
        // rather than forcing a span boundary.
        const tier = glyph === " " ? runTier : Math.round(value * lastTier);

        if (tier !== runTier && glyph !== " ") {
          if (run) output += wrap(run, runTier);
          run = "";
          runTier = tier;
        }
        run += glyph;
      }
      if (row < rows - 1) run += "\n";
    }
    if (run) output += wrap(run, runTier);

    return output;
  }

  function wrap(text, tier) {
    if (tier < 0) return escapeHtml(text);
    return `<span class="t${tier}">${escapeHtml(text)}</span>`;
  }

  function toFieldSpace(clientX, clientY) {
    const box = element.getBoundingClientRect();
    const halfColumns = columns / 2;
    const halfRows = rows / 2;
    const scale = 1 / Math.min(halfColumns * cellAspect, halfRows);
    const column = (clientX - box.left) / cellWidth;
    const row = (clientY - box.top) / cellHeight;
    return {
      x: (column - halfColumns + 0.5) * cellAspect * scale,
      y: (row - halfRows + 0.5) * scale,
    };
  }

  return {
    label,
    resize() {
      measure();
    },
    render(elapsed) {
      element.innerHTML = render(elapsed);
    },
    setOpacity(value) {
      element.style.opacity = value;
    },
    destroy() {
      element.remove();
    },
    setPointer(clientX, clientY) {
      const point = toFieldSpace(clientX, clientY);
      pointer.x = point.x;
      pointer.y = point.y;
      pointer.active = true;
    },
    clearPointer() {
      pointer.active = false;
    },
    addRipple(clientX, clientY, elapsed) {
      if (reducedMotion) return;
      const point = toFieldSpace(clientX, clientY);
      ripples.push({ x: point.x, y: point.y, startedAt: elapsed });
    },
  };
}
