/**
 * Hero letter shockwave.
 *
 * Splits the heading into per-character spans once at boot, then lets a click
 * push them around: an expanding front knocks each letter outward, and a
 * critically-damped spring pulls it home. Letters are moved with transforms
 * only, so layout never reflows and the text stays selectable and readable to
 * assistive tech (the original string is kept as the element's label).
 */

/** How far a letter can be thrown, in pixels. */
const MAX_OFFSET = 46;
/** Spring constants — stiff enough to settle in about a second. */
const STIFFNESS = 116;
const DAMPING = 15.5;

export function createLetterField(root, options = {}) {
  const { reducedMotion = false } = options;

  const letters = [];
  const waves = [];
  let lastElapsed = 0;
  let settled = true;

  function split() {
    // Measure the untouched heading first: inline-block wrappers suppress the
    // font's kerning pairs, so each line is re-tracked afterwards to land back
    // on its original width.
    const lines = [...root.children].map((line) => ({
      element: line,
      width: line.getBoundingClientRect().width,
    }));

    // Walk text nodes only, so nested kerning spans keep their styling.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeValue.trim()) targets.push(node);
    }

    for (const node of targets) {
      const fragment = document.createDocumentFragment();
      for (const character of node.nodeValue) {
        if (character.trim() === "") {
          fragment.append(character);
          continue;
        }
        const span = document.createElement("span");
        span.className = "letter";
        span.textContent = character;
        fragment.append(span);
        letters.push({ element: span, x: 0, y: 0, vx: 0, vy: 0, cx: 0, cy: 0 });
      }
      node.parentNode.replaceChild(fragment, node);
    }

    for (const line of lines) {
      const count = line.element.querySelectorAll(".letter").length;
      if (count < 2 || !line.width) continue;
      const drift = line.element.getBoundingClientRect().width - line.width;
      if (Math.abs(drift) < 0.5) continue;
      // Spread the lost kerning back across the gaps between characters.
      line.element.style.letterSpacing = `${-drift / count}px`;
    }

    measure();
  }

  function measure() {
    for (const letter of letters) {
      // Cache each letter's resting centre in viewport space — the same space
      // clicks arrive in — so wave maths never hits layout during a frame.
      // Read while untransformed so a mid-flight resize can't bake in offsets.
      const reset = letter.element.style.transform;
      letter.element.style.transform = "";
      const rect = letter.element.getBoundingClientRect();
      letter.cx = rect.left + rect.width / 2;
      letter.cy = rect.top + rect.height / 2;
      letter.element.style.transform = reset;
    }
  }

  function push(clientX, clientY, elapsed) {
    if (reducedMotion) return;
    waves.push({ x: clientX, y: clientY, startedAt: elapsed });
    settled = false;
  }

  function step(elapsed) {
    if (settled && !waves.length) return;

    const delta = Math.min(0.05, Math.max(0.001, (elapsed - lastElapsed) / 1_000));
    lastElapsed = elapsed;

    for (let index = waves.length - 1; index >= 0; index -= 1) {
      if (elapsed - waves[index].startedAt > 1_700) waves.splice(index, 1);
    }

    let moving = false;

    for (const letter of letters) {
      for (const wave of waves) {
        const age = (elapsed - wave.startedAt) / 1_700;
        if (age >= 1) continue;

        const deltaX = letter.cx - wave.x;
        const deltaY = letter.cy - wave.y;
        const distance = Math.hypot(deltaX, deltaY) || 1e-4;
        // Front expands outward; only letters it is currently passing get hit.
        const front = age * 1_150;
        const band = Math.max(0, 1 - Math.abs(distance - front) / 340);
        if (band <= 0.001) continue;

        const impulse = band * (1 - age) ** 1.1 * 2_600 * delta;
        letter.vx += (deltaX / distance) * impulse;
        letter.vy += (deltaY / distance) * impulse;
      }

      // Spring back toward rest.
      letter.vx += (-STIFFNESS * letter.x - DAMPING * letter.vx) * delta;
      letter.vy += (-STIFFNESS * letter.y - DAMPING * letter.vy) * delta;
      letter.x += letter.vx * delta;
      letter.y += letter.vy * delta;

      const reach = Math.hypot(letter.x, letter.y);
      if (reach > MAX_OFFSET) {
        const scale = MAX_OFFSET / reach;
        letter.x *= scale;
        letter.y *= scale;
      }

      if (reach > 0.05 || Math.hypot(letter.vx, letter.vy) > 0.5) {
        moving = true;
        letter.element.style.transform = `translate3d(${letter.x.toFixed(2)}px, ${letter.y.toFixed(2)}px, 0)`;
      } else if (letter.x !== 0 || letter.y !== 0) {
        letter.x = 0;
        letter.y = 0;
        letter.vx = 0;
        letter.vy = 0;
        letter.element.style.transform = "";
      }
    }

    settled = !moving && !waves.length;
  }

  split();

  return { push, step, measure };
}
