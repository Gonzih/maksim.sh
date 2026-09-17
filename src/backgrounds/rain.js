/**
 * Digital rain background module.
 *
 * Every glyph on screen is a drop — its own position, velocity and lifetime.
 * Nothing is bound to a column, so a blast can throw drops anywhere and they
 * keep falling from wherever they end up. New drops enter from above at a
 * steady rate to keep the rain going; the population is capped, not fixed.
 */

const GLYPHS = "01<>[]{}()/\\|=+*-:.#%$&@ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHADES = " .:-=+*#%@";
/** Colour tiers a drop's brightness is quantised into before it becomes a span. */
const TIERS = 6;
/** Downward pull, in cells per second squared. */
const GRAVITY = 12;
/** How hard a blast throws a drop, and how far its reach extends in cells. */
const BLAST_SPEED = 62;
const BLAST_REACH = 26;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (character) => (
    character === "&" ? "&amp;" : character === "<" ? "&lt;" : "&gt;"
  ));
}

function randomGlyph() {
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

export const label = "rain";

/** Character grids only change when a cell flips glyph. */
export const frameInterval = 1_000 / 24;

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
  let capacity = 0;
  let lastElapsed = 0;
  let spawnDebt = 0;

  const drops = [];
  const pointer = { column: 0, row: 0, active: false, energy: 0 };

  function spawn(atTop) {
    return {
      column: Math.random() * columns,
      // Stagger entry above the fold so the rain does not arrive as a band.
      row: atTop ? -Math.random() * rows * 0.6 : Math.random() * rows,
      velocityColumn: 0,
      velocityRow: (reducedMotion ? 5 : 11) + Math.random() * (reducedMotion ? 4 : 15),
      glyph: randomGlyph(),
      brightness: 0.62 + Math.random() * 0.38,
      // Each drop drags a tail of dimmer glyphs, which is what makes a moving
      // point read as falling rain instead of a speck.
      trail: 4 + Math.floor(Math.random() * 11),
      // Drops thrown by a blast tumble and fade; falling rain does not.
      thrown: 0,
    };
  }

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

    capacity = Math.round(columns * rows * (reducedMotion ? 0.06 : 0.16));
    drops.length = 0;
    for (let index = 0; index < capacity; index += 1) drops.push(spawn(false));
  }

  function render(elapsed) {
    if (!columns || !rows) return "";

    const delta = Math.min(0.12, Math.max(0, (elapsed - lastElapsed) / 1_000));
    lastElapsed = elapsed;
    pointer.energy += ((pointer.active ? 1 : 0) - pointer.energy) * 0.08;

    for (let index = drops.length - 1; index >= 0; index -= 1) {
      const drop = drops[index];

      // Thrown drops carry sideways momentum that air resistance bleeds off;
      // gravity always wins in the end.
      if (drop.thrown > 0) {
        const drag = Math.exp(-1.6 * delta);
        drop.velocityColumn *= drag;
        drop.velocityRow = drop.velocityRow * drag + GRAVITY * delta;
        drop.thrown = Math.max(0, drop.thrown - delta * 0.8);
        if (Math.random() < delta * 5) drop.glyph = randomGlyph();
      } else {
        drop.velocityRow += GRAVITY * 0.12 * delta;
      }

      drop.column += drop.velocityColumn * delta;
      drop.row += drop.velocityRow * delta;

      // A drop that leaves the frame is gone. The rain is replenished from
      // above, never by resurrecting what the blast cleared out.
      if (drop.row > rows + 1 || drop.column < -2 || drop.column > columns + 2) {
        drops.splice(index, 1);
      }
    }

    // Refill toward capacity from the top at a steady rate, so a cleared
    // region fills back in as new rain falls into it rather than popping.
    spawnDebt += (capacity - drops.length) * delta * (reducedMotion ? 0.6 : 1.5);
    while (spawnDebt >= 1 && drops.length < capacity) {
      drops.push(spawn(true));
      spawnDebt -= 1;
    }

    const cells = new Array(columns * rows);
    const heat = new Float32Array(columns * rows);

    for (const drop of drops) {
      // Trail runs back along the drop's heading, so thrown drops streak the
      // way they were flung rather than always pointing up.
      const speed = Math.hypot(drop.velocityColumn * 0.5, drop.velocityRow) || 1;
      const stepColumn = -(drop.velocityColumn / speed);
      const stepRow = -(drop.velocityRow / speed);

      for (let step = 0; step <= drop.trail; step += 1) {
        const column = Math.round(drop.column + stepColumn * step);
        const row = Math.round(drop.row + stepRow * step);
        if (column < 0 || column >= columns || row < 0 || row >= rows) continue;

        let value = drop.brightness * (1 - step / (drop.trail + 1)) ** 1.5;
        if (step === 0) value = drop.brightness;
        if (value <= 0.02) continue;

        if (pointer.energy > 0.01) {
          const distance = Math.hypot((column - pointer.column) * 0.5, row - pointer.row);
          value += Math.max(0, 1 - distance / 9) ** 2 * pointer.energy * 0.5;
        }

        const cell = row * columns + column;
        if (value > heat[cell]) {
          heat[cell] = value;
          cells[cell] = step === 0 ? drop.glyph : GLYPHS[(column * 31 + row * 17) % GLYPHS.length];
        }
      }
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
        const cell = row * columns + column;
        const value = heat[cell];

        if (value <= 0.02) {
          run += " ";
          continue;
        }

        // Bright drops show their glyph; dim ones decay into shading so the
        // field keeps its depth.
        const glyph = value > 0.5
          ? cells[cell]
          : SHADES[Math.max(1, Math.round(Math.min(1, value * 1.9) * lastShade))];
        const tier = Math.round(Math.min(1, value) * lastTier);

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
      const origin = toCell(clientX, clientY);

      // The blast shoves every drop within reach straight out of the way. It
      // creates nothing: the cleared space stays empty until fresh rain falls
      // into it from above.
      for (const drop of drops) {
        // Cells are about twice as tall as wide; measuring in that aspect
        // keeps the blast circular on screen rather than an ellipse.
        const deltaColumn = (drop.column - origin.column) * 0.5;
        const deltaRow = drop.row - origin.row;
        const distance = Math.hypot(deltaColumn, deltaRow);
        if (distance > BLAST_REACH) continue;

        const falloff = (1 - distance / BLAST_REACH) ** 1.6;
        const speed = BLAST_SPEED * falloff;
        // Drops right at the origin have no direction to be pushed in; give
        // them a random one so the centre clears too.
        const angle = distance < 0.5
          ? Math.random() * Math.PI * 2
          : Math.atan2(deltaRow, deltaColumn);

        drop.velocityColumn += Math.cos(angle) * speed * 2;
        drop.velocityRow += Math.sin(angle) * speed;
        drop.thrown = Math.max(drop.thrown, falloff);
        drop.brightness = Math.min(1, drop.brightness + falloff * 0.5);
      }
    },
  };
}
