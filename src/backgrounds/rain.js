/**
 * Digital rain background module.
 *
 * Columns of glyphs fall at independent speeds. Each column keeps a head
 * position and a trail length; brightness falls off behind the head, and the
 * glyph in a cell is resampled occasionally so the stream shimmers rather
 * than scrolling a fixed string.
 */

const GLYPHS = "01<>[]{}()/\\|=+*-:.#%$&@ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHADES = " .:-=+*#%@";
/** Colour tiers the trail intensity is quantised into before it becomes a span. */
const TIERS = 6;
/** How long a click shockwave takes to cross and settle, in milliseconds. */
const STRIKE_LIFE = 1_800;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (character) => (
    character === "&" ? "&amp;" : character === "<" ? "&lt;" : "&gt;"
  ));
}

export const label = "rain";

/** Character grids only change when a cell flips glyph. */
export const frameInterval = 1_000 / 24;

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

export function create(host, options = {}) {
  const { reducedMotion = false } = options;

  const element = document.createElement("pre");
  element.className = "layer layer--ascii layer--rain";
  element.setAttribute("aria-hidden", "true");
  host.append(element);

  let columns = 0;
  let rows = 0;
  let cellWidth = 0;
  let cellHeight = 0;
  let streams = [];
  let glyphs = [];
  let lastElapsed = 0;
  const pointer = { column: 0, row: 0, active: false, energy: 0 };
  const strikes = [];

  function measure() {
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

    streams = Array.from({ length: columns }, () => ({
      head: Math.random() * -rows,
      speed: (reducedMotion ? 3 : 7) + Math.random() * (reducedMotion ? 3 : 13),
      trail: 6 + Math.floor(Math.random() * Math.max(6, rows * 0.55)),
    }));

    glyphs = Array.from({ length: columns * rows }, randomGlyph);
  }

  function render(elapsed) {
    if (!columns || !rows) return "";

    const delta = Math.min(0.12, Math.max(0, (elapsed - lastElapsed) / 1_000));
    lastElapsed = elapsed;

    pointer.energy += ((pointer.active ? 1 : 0) - pointer.energy) * 0.08;

    for (const stream of streams) {
      stream.head += stream.speed * delta;
      if (stream.head - stream.trail > rows) {
        stream.head = -Math.random() * rows * 0.5;
        stream.speed = (reducedMotion ? 3 : 7) + Math.random() * (reducedMotion ? 3 : 13);
        stream.trail = 6 + Math.floor(Math.random() * Math.max(6, rows * 0.55));
      }
    }

    // Resample a sparse set of cells each frame for the shimmer.
    const churn = Math.max(1, Math.round(columns * rows * (reducedMotion ? 0.002 : 0.012)));
    for (let n = 0; n < churn; n += 1) {
      glyphs[Math.floor(Math.random() * glyphs.length)] = randomGlyph();
    }

    for (let index = strikes.length - 1; index >= 0; index -= 1) {
      if (elapsed - strikes[index].startedAt > STRIKE_LIFE) strikes.splice(index, 1);
    }

    const lastShade = SHADES.length - 1;
    const lastTier = TIERS - 1;
    let output = "";
    let runTier = -1;
    let run = "";

    const wrap = (text, tier) => (
      tier < 0 ? escapeHtml(text) : `<span class="t${tier}">${escapeHtml(text)}</span>`
    );

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const stream = streams[column];
        let displacedRow = row;
        let boost = 0;

        for (const strike of strikes) {
          const age = (elapsed - strike.startedAt) / STRIKE_LIFE;
          if (age >= 1) continue;

          const deltaColumn = (column - strike.column) * 0.5;
          const deltaRow = row - strike.row;
          const distance = Math.hypot(deltaColumn, deltaRow) || 1e-4;
          const front = age * rows * 0.95;
          const band = Math.max(0, 1 - Math.abs(distance - front) / 4.5);
          if (band <= 0.001) continue;

          // Overshoot through zero so the columns spring back into place.
          const recoil = Math.sin(age * Math.PI * 1.5) * (1 - age) ** 1.5;
          displacedRow -= (deltaRow / distance) * band * recoil * 3.2;
          boost += band * (1 - age) * 0.55;
        }

        const behind = stream.head - displacedRow;
        let intensity = 0;

        if (behind >= 0 && behind < stream.trail) {
          // Bright at the head, tapering along the trail.
          intensity = (1 - behind / stream.trail) ** 1.6;
          if (behind < 1) intensity = 1;
        }

        if (pointer.energy > 0.01) {
          const distance = Math.hypot(
            (column - pointer.column) * 0.5,
            row - pointer.row,
          );
          intensity += Math.max(0, 1 - distance / 9) ** 2 * pointer.energy * 0.5;
        }

        intensity += boost;

        if (intensity <= 0.02) {
          run += " ";
          continue;
        }

        // Near the head show a real glyph; further back fall back to shading
        // so the trail dissolves into texture.
        const glyph = intensity > 0.55
          ? glyphs[row * columns + column]
          : SHADES[Math.max(1, Math.round(Math.min(1, intensity * 1.7) * lastShade))];
        const tier = Math.round(Math.min(1, intensity) * lastTier);

        if (tier !== runTier) {
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

  function toCell(clientX, clientY) {
    const box = element.getBoundingClientRect();
    return {
      column: (clientX - box.left) / cellWidth,
      row: (clientY - box.top) / cellHeight,
    };
  }

  return {
    label,
    resize: measure,
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
      const cell = toCell(clientX, clientY);
      pointer.column = cell.column;
      pointer.row = cell.row;
      pointer.active = true;
    },
    clearPointer() {
      pointer.active = false;
    },
    addRipple(clientX, clientY, elapsed) {
      if (reducedMotion) return;
      const cell = toCell(clientX, clientY);
      strikes.push({ column: cell.column, row: cell.row, startedAt: elapsed });
    },
  };
}
