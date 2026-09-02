/**
 * Every tunable number in the game lives here. The engine, the tests, the
 * HUD, and (later) a handbook page all read from this file so nothing drifts.
 *
 * Combat follows the Polytopia model: deterministic, both stats scale with
 * remaining health, and 4.5 sets the damage ceiling (max damage = atk × 4.5).
 */

export const BOARD_SIZE = 12;

/** Terrain codes are single characters so ASCII test fixtures can use them directly. */
export const TERRAIN = { PLAIN: ".", FOREST: "f", MOUNTAIN: "^" };

export const TERRAIN_RULES = {
  [TERRAIN.PLAIN]: { name: "plain", defenceBonus: 1.0, passable: true },
  [TERRAIN.FOREST]: { name: "forest", defenceBonus: 1.5, passable: true },
  [TERRAIN.MOUNTAIN]: { name: "mountain", defenceBonus: 1.0, passable: false }, // only "fly" may enter
};

/** Seeded terrain generation. */
export const GENERATION = {
  forestClumps: 6,
  forestClumpSize: [4, 9], // inclusive range, tiles per clump
  mountains: 7,
  cornerClearRadius: 1, // Chebyshev radius around each corner kept plain
  maxAttempts: 20, // regeneration attempts before giving up on a seed
};

export const COMBAT = {
  damageScale: 4.5,
  restHeal: 2, // HP recovered by a unit that does nothing on its turn
};

/**
 * The four pieces. Array order is turn order. A unit-level `heal` overrides
 * COMBAT.restHeal. Skills: "fly" (mountains passable), "persist" (attack again
 * after a kill), "escape" (move again after attacking, once per turn).
 */
export const ROSTER = [
  { id: "dragon", name: "Dragon", emoji: "🐉", color: "#9b1f1f", hp: 25, atk: 5, def: 3, move: 2, range: 1, skills: ["fly"], corner: "nw" },
  { id: "orc", name: "Orc", emoji: "🪓", color: "#4f7a2e", hp: 15, atk: 3, def: 3, move: 1, range: 1, skills: ["persist"], corner: "ne" },
  { id: "wizard", name: "Wizard", emoji: "🧙", color: "#2c3f8f", hp: 10, atk: 4, def: 1, move: 1, range: 2, skills: [], heal: 4, corner: "sw" },
  { id: "rogue", name: "Rogue", emoji: "🗡️", color: "#3a1f3f", hp: 10, atk: 2, def: 1, move: 3, range: 1, skills: ["escape"], corner: "se" },
];

/** Board tile for a corner name on an N×N board. x east, y south. */
export function cornerTile(corner, size) {
  const last = size - 1;
  switch (corner) {
    case "nw": return { x: 0, y: 0 };
    case "ne": return { x: last, y: 0 };
    case "sw": return { x: 0, y: last };
    case "se": return { x: last, y: last };
    default: throw new Error(`unknown corner: ${corner}`);
  }
}

export const SKILL_TEXT = {
  fly: "Fly: crosses and stands on mountains",
  persist: "Persist: attacks again after a kill",
  escape: "Escape: may move again after attacking",
};
