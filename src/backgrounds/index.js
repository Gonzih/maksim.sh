/**
 * Background module registry and director.
 *
 * Every module exposes the same surface — create(host, options) returning
 * { label, resize, render, setPointer, clearPointer, addRipple, setOpacity,
 * destroy } — so the director can rotate through them without knowing whether
 * a module paints to a canvas, a character grid, or anything else.
 *
 * Modules are instantiated lazily and torn down once they rotate out, so only
 * the active pair ever holds memory or does work.
 */

const LOADERS = [
  () => import("./dither.js"),
  () => import("./particles.js"),
  () => import("./ascii.js"),
  () => import("./rain.js"),
];

export function createDirector(host, options = {}) {
  const {
    moduleDuration = 24_000,
    crossfade = 1_600,
    reducedMotion = false,
    only = null,
  } = options;

  const loaders = only === null
    ? LOADERS
    : [LOADERS[((only % LOADERS.length) + LOADERS.length) % LOADERS.length]];

  const instances = new Map();
  const pointer = { x: 0, y: 0, active: false };

  let index = -1;
  let current = null;
  let previous = null;
  let switchedAt = 0;
  let advancing = false;
  let pendingRipples = [];

  async function instantiate(slot) {
    if (instances.has(slot)) return instances.get(slot);
    const loading = loaders[slot]().then((module) => {
      const instance = module.create(host, { reducedMotion });
      instance.resize();
      // Modules pace themselves: the canvas field needs every frame for its
      // trail fade, character grids only repaint when a cell flips glyph.
      instance.frameInterval = module.frameInterval ?? 0;
      return instance;
    });
    instances.set(slot, loading);
    return loading;
  }

  async function advance(elapsed, target = null) {
    // A rotation can be requested while the previous one is still loading its
    // module. Serialising on this flag keeps at most two layers alive, so a
    // slow import can never orphan one that nothing holds a reference to.
    if (advancing) return;
    advancing = true;

    try {
      const nextIndex = target === null
        ? (index + 1) % loaders.length
        : ((target % loaders.length) + loaders.length) % loaders.length;
      if (nextIndex === index && current) return;

      const instance = await instantiate(nextIndex);

      // Anything still on screen from an earlier switch goes now; only the
      // outgoing module gets to fade.
      retire();

      previous = current;
      current = instance;
      index = nextIndex;
      switchedAt = elapsed;

      current.setOpacity(previous === null ? 1 : 0);
      if (pointer.active) current.setPointer(pointer.x, pointer.y);
      for (const ripple of pendingRipples) {
        current.addRipple(ripple.x, ripple.y, elapsed);
      }
      pendingRipples = [];
    } finally {
      advancing = false;
    }
  }

  function retire() {
    if (!previous) return;
    const retiring = previous;
    previous = null;
    retiring.destroy();
    for (const [slot, value] of instances) {
      Promise.resolve(value).then((instance) => {
        if (instance === retiring) instances.delete(slot);
      });
    }
  }

  return {
    get label() {
      return current?.label ?? "loading";
    },

    /** Slowest cadence that still satisfies every live module. */
    get frameInterval() {
      const active = [current, previous].filter(Boolean);
      if (!active.length) return 0;
      return Math.min(...active.map((instance) => instance.frameInterval ?? 0));
    },

    async start(elapsed) {
      await advance(elapsed);
    },

    /** Skip to the next module immediately, restarting its full turn. */
    next(elapsed) {
      return advance(elapsed);
    },

    render(elapsed) {
      if (!current) return;

      // Rotate once the active module has had its full turn.
      if (loaders.length > 1 && elapsed - switchedAt > moduleDuration) {
        advance(elapsed);
      }

      if (previous) {
        const progress = (elapsed - switchedAt) / crossfade;
        if (progress >= 1) {
          current.setOpacity(1);
          retire();
        } else {
          const eased = progress * progress * (3 - 2 * progress);
          current.setOpacity(eased.toFixed(3));
          previous.setOpacity((1 - eased).toFixed(3));
          previous.render(elapsed);
        }
      }

      current.render(elapsed);
    },

    resize() {
      current?.resize();
      previous?.resize();
    },

    setPointer(clientX, clientY) {
      pointer.x = clientX;
      pointer.y = clientY;
      pointer.active = true;
      current?.setPointer(clientX, clientY);
      previous?.setPointer(clientX, clientY);
    },

    clearPointer() {
      pointer.active = false;
      current?.clearPointer();
      previous?.clearPointer();
    },

    addRipple(clientX, clientY, elapsed) {
      if (!current) {
        pendingRipples.push({ x: clientX, y: clientY });
        return;
      }
      current.addRipple(clientX, clientY, elapsed);
      previous?.addRipple(clientX, clientY, elapsed);
    },
  };
}
