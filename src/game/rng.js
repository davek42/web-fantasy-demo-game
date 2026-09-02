/**
 * Seeded pseudo-random numbers (mulberry32). Same seed, same realm, same
 * dice — which is what makes the engine testable and lets players share a
 * realm by number.
 */

export function seedFromString(text) {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed = Date.now()) {
  let state = (typeof seed === "number" ? seed : seedFromString(seed)) >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Float in [0, 1). */
    next,
    /** Float in [min, max). */
    float: (min, max) => min + next() * (max - min),
    /** Integer in [min, max], inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** True with probability p. */
    chance: (p) => next() < p,
    /** One element of a non-empty array. */
    pick: (array) => array[Math.floor(next() * array.length)],
    /** Internal state, for saving and restoring. */
    getState: () => state,
    setState: (value) => {
      state = value >>> 0;
    },
  };
}
