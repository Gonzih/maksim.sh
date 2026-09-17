/**
 * Dither gradient background module.
 *
 * A curved front sweeps the viewport. Coverage is solid behind the front and
 * decays with distance ahead of it; each cell is then thresholded against a
 * blue-noise-ish value, so the edge dissolves into scattered dots instead of
 * a hard line.
 *
 * Colour is banded into three zones by coverage: a turbulent burning core, a
 * soft blue membrane rippling at the surface, and cool flecks drifting off
 * into the dark beyond it.
 *
 * Drawn to a canvas as small squares rather than a character grid — the dots
 * are finer than a glyph cell and there are far more of them.
 */

const CELL = 3;
/** How long a click shockwave takes to cross and settle, in milliseconds. */
const PULSE_LIFE = 1_800;
/** Coverage depth the blue membrane sits at, and how thick it reads. */
const MEMBRANE_AT = 0.46;
const MEMBRANE_WIDTH = 0.19;

export const label = "dither";

/** Cheap hash — stable per cell so dots hold still instead of boiling. */
function hash(x, y) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.545_3;
  return value - Math.floor(value);
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Smooth value noise — drives the churn inside the core. */
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

export function create(host, options = {}) {
  const { reducedMotion = false } = options;

  const canvas = document.createElement("canvas");
  canvas.className = "layer layer--canvas";
  host.append(canvas);
  const context = canvas.getContext("2d", { alpha: true });

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let columns = 0;
  let rows = 0;
  const pointer = { x: 0, y: 0, active: false, energy: 0 };
  const pulses = [];

  function resize() {
    width = host.clientWidth || window.innerWidth;
    height = host.clientHeight || window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    columns = Math.ceil(width / CELL);
    rows = Math.ceil(height / CELL);
  }

  /**
   * Signed distance to the front, normalised so 0 is the edge and positive is
   * inside the mass. The front is a parabola rolling up from the lower right.
   */
  function frontDistance(normalizedX, normalizedY, time) {
    const sweep = Math.sin(time * 0.11) * 0.16;
    const curve = (1 - normalizedX) ** 2 * 1.45 + sweep;
    const ripple = Math.sin(normalizedX * 7 - time * 0.55) * 0.022
      + Math.sin(normalizedX * 13 + time * 0.31) * 0.011;
    return normalizedY - (0.42 + curve + ripple);
  }

  function render(elapsed) {
    if (!columns || !rows) return;

    const time = elapsed / 1_000;
    context.clearRect(0, 0, width, height);
    pointer.energy += ((pointer.active ? 1 : 0) - pointer.energy) * 0.07;

    for (let index = pulses.length - 1; index >= 0; index -= 1) {
      if (elapsed - pulses[index].startedAt > PULSE_LIFE) pulses.splice(index, 1);
    }

    for (let row = 0; row < rows; row += 1) {
      const y = row * CELL;
      const normalizedY = y / height;

      for (let column = 0; column < columns; column += 1) {
        const x = column * CELL;
        const normalizedX = x / width;

        // The shockwave displaces where the front is sampled, so the edge
        // physically bows outward around the click and springs back.
        let sampleX = normalizedX;
        let sampleY = normalizedY;
        let boost = 0;

        for (const pulse of pulses) {
          const age = (elapsed - pulse.startedAt) / PULSE_LIFE;
          if (age >= 1) continue;

          const deltaX = x - pulse.x;
          const deltaY = y - pulse.y;
          const toPulse = Math.hypot(deltaX, deltaY) || 1e-4;
          const front = age * Math.max(width, height) * 0.62;
          const band = clamp(1 - Math.abs(toPulse - front) / 90);
          if (band <= 0.001) continue;

          // Overshoot through zero so the dots return to rest rather than
          // stopping dead where the wave left them.
          const recoil = Math.sin(age * Math.PI * 1.5) * (1 - age) ** 1.5;
          const shove = band * recoil * 46;

          sampleX -= (deltaX / toPulse) * shove / width;
          sampleY -= (deltaY / toPulse) * shove / height;
          boost += band * (1 - age) * 0.4;
        }

        const distance = frontDistance(sampleX, sampleY, time);
        // Solid well inside the mass, fading over a soft band outside it.
        let coverage = clamp(distance / 0.34 + 1) + boost;

        if (pointer.energy > 0.01) {
          const toPointer = Math.hypot(x - pointer.x, y - pointer.y);
          coverage += clamp(1 - toPointer / (Math.min(width, height) * 0.22)) ** 2
            * pointer.energy * 0.45;
        }

        coverage = clamp(coverage);
        if (coverage <= 0.004) continue;

        // Stochastic threshold: the dot survives only if it beats the noise,
        // so density — not opacity — carries the gradient.
        const threshold = hash(column, row);
        if (threshold > coverage) continue;

        // Three concentric zones rather than one ramp: a burning core, a soft
        // blue membrane at the surface, and cool flecks drifting off into the
        // dark. Coverage says which zone a cell is in.
        const mix = clamp((coverage - 0.18) / 0.62) ** 0.85;

        // The membrane sits at a fixed coverage band, but its exact depth
        // breathes, so the shell ripples instead of sitting as a flat ring.
        const membraneCentre = MEMBRANE_AT
          + Math.sin(normalizedX * 5.5 - time * 0.7) * 0.05
          + Math.sin(normalizedY * 4.1 + time * 0.47) * 0.04;
        const membrane = clamp(1 - Math.abs(coverage - membraneCentre) / MEMBRANE_WIDTH) ** 1.4;

        // Turbulence inside the core, advected so the interior churns.
        const heat = clamp((coverage - membraneCentre) / (1 - membraneCentre));
        const churn = heat > 0
          ? noise(column * 0.055 + time * 0.9, row * 0.055 - time * 0.62) * 0.62
            + noise(column * 0.14 - time * 0.5, row * 0.14 + time * 1.1) * 0.3
          : 0;
        // Centre the churn on zero and amplify it, so the core alternates
        // between dim and white-hot instead of hovering mid-ramp.
        const flame = clamp(0.5 + (churn - 0.46) * 2.6);
        const burn = clamp(heat ** 0.65 * (0.32 + flame * 0.9));

        // Base: escaping flecks, cool and near-white.
        let red = 232 - mix * 26;
        let green = 238 - mix * 92;
        let blue = 250 - mix * 18;

        // Membrane: pull hard toward cyan-blue where the shell sits.
        red -= membrane * 150;
        green -= membrane * 28;
        blue = blue * (1 - membrane) + 255 * membrane;

        // Core: deep magenta at the shell climbing to hot pink where the
        // churn peaks. Green stays suppressed so the heat reads as fire
        // inside the site's magenta/violet range, never orange or yellow.
        const hot = clamp((burn - 0.5) / 0.5) ** 1.35;
        red = red * (1 - burn) + (198 + hot * 57) * burn;
        green = green * (1 - burn) + (10 + hot * 128) * burn;
        blue = blue * (1 - burn) + (96 + hot * 120) * burn;

        const alpha = 0.3 + coverage * 0.44 + membrane * 0.22 + burn * 0.3;

        context.fillStyle = `rgba(${clamp(red, 0, 255) | 0}, ${clamp(green, 0, 255) | 0}, ${clamp(blue, 0, 255) | 0}, ${Math.min(1, alpha).toFixed(3)})`;
        context.fillRect(x, y, CELL - 1, CELL - 1);
      }
    }
  }

  return {
    label,
    resize,
    render,
    setOpacity(value) {
      canvas.style.opacity = value;
    },
    destroy() {
      canvas.remove();
    },
    setPointer(clientX, clientY) {
      const box = canvas.getBoundingClientRect();
      pointer.x = clientX - box.left;
      pointer.y = clientY - box.top;
      pointer.active = true;
    },
    clearPointer() {
      pointer.active = false;
    },
    addRipple(clientX, clientY, elapsed) {
      if (reducedMotion) return;
      const box = canvas.getBoundingClientRect();
      pulses.push({ x: clientX - box.left, y: clientY - box.top, startedAt: elapsed });
    },
  };
}

/** Dot field with a moving edge; needs a steady cadence, not every frame. */
export const frameInterval = 1_000 / 30;
