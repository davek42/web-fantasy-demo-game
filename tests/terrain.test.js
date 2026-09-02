import { describe, expect, test } from "bun:test";
import { createRng } from "../src/game/rng.js";
import { GENERATION, TERRAIN, cornerTile } from "../src/game/rules.js";
import { chebyshev, defenceBonus, generateTerrain, isPassable, neighbours8 } from "../src/game/terrain.js";

const SIZE = 12;
const CORNERS = ["nw", "ne", "sw", "se"];

function count(terrain, code) {
  return terrain.flat().filter((c) => c === code).length;
}

/** Tiles reachable from `start` without crossing mountains (8-neighbour flood). */
function reachableWithoutMountains(terrain, start) {
  const size = terrain.length;
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighbours8(cur.x, cur.y, size)) {
      const key = `${n.x},${n.y}`;
      if (seen.has(key) || terrain[n.y][n.x] === TERRAIN.MOUNTAIN) continue;
      seen.add(key);
      queue.push(n);
    }
  }
  return seen;
}

describe("generateTerrain", () => {
  test("is deterministic for a seed and shaped size×size", () => {
    const a = generateTerrain(createRng(42), SIZE);
    const b = generateTerrain(createRng(42), SIZE);
    expect(a).toEqual(b);
    expect(a).toHaveLength(SIZE);
    for (const row of a) expect(row).toHaveLength(SIZE);
    const c = generateTerrain(createRng(43), SIZE);
    expect(c).not.toEqual(a);
  });

  test("only uses known terrain codes", () => {
    const t = generateTerrain(createRng(7), SIZE);
    const codes = new Set(t.flat());
    for (const code of codes) expect(Object.values(TERRAIN)).toContain(code);
  });

  test("keeps every corner and its clear radius plain", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const t = generateTerrain(createRng(seed), SIZE);
      for (const corner of CORNERS) {
        const c = cornerTile(corner, SIZE);
        for (let dy = -GENERATION.cornerClearRadius; dy <= GENERATION.cornerClearRadius; dy++) {
          for (let dx = -GENERATION.cornerClearRadius; dx <= GENERATION.cornerClearRadius; dx++) {
            const x = c.x + dx;
            const y = c.y + dy;
            if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
            expect(t[y][x]).toBe(TERRAIN.PLAIN);
          }
        }
      }
    }
  });

  test("places the configured number of mountains and a sensible amount of forest", () => {
    const t = generateTerrain(createRng(5), SIZE);
    expect(count(t, TERRAIN.MOUNTAIN)).toBe(GENERATION.mountains);
    const forest = count(t, TERRAIN.FOREST);
    const [lo, hi] = GENERATION.forestClumpSize;
    expect(forest).toBeGreaterThanOrEqual(lo); // clumps may merge, but at least one full clump exists
    expect(forest).toBeLessThanOrEqual(hi * GENERATION.forestClumps);
    expect(count(t, TERRAIN.PLAIN)).toBeGreaterThan(SIZE * SIZE / 2);
  });

  test("all four corners are mutually reachable without crossing mountains", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const t = generateTerrain(createRng(seed), SIZE);
      const from = reachableWithoutMountains(t, cornerTile("nw", SIZE));
      for (const corner of CORNERS) {
        const c = cornerTile(corner, SIZE);
        expect(from.has(`${c.x},${c.y}`)).toBe(true);
      }
    }
  });

  test("works on a small board", () => {
    const t = generateTerrain(createRng(1), 6);
    expect(t).toHaveLength(6);
    expect(count(t, TERRAIN.MOUNTAIN)).toBeLessThanOrEqual(GENERATION.mountains);
  });
});

describe("terrain helpers", () => {
  test("isPassable: mountains only for fliers", () => {
    const walker = { skills: [] };
    const flier = { skills: ["fly"] };
    expect(isPassable(TERRAIN.PLAIN, walker)).toBe(true);
    expect(isPassable(TERRAIN.FOREST, walker)).toBe(true);
    expect(isPassable(TERRAIN.MOUNTAIN, walker)).toBe(false);
    expect(isPassable(TERRAIN.MOUNTAIN, flier)).toBe(true);
  });

  test("defenceBonus reads the rules table", () => {
    expect(defenceBonus(TERRAIN.PLAIN)).toBe(1);
    expect(defenceBonus(TERRAIN.FOREST)).toBe(1.5);
    expect(defenceBonus(TERRAIN.MOUNTAIN)).toBe(1);
  });

  test("chebyshev distance treats diagonals as one step", () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe(3);
    expect(chebyshev({ x: 0, y: 0 }, { x: 1, y: 4 })).toBe(4);
    expect(chebyshev({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });

  test("neighbours8 clips at the board edge", () => {
    expect(neighbours8(0, 0, 12)).toHaveLength(3);
    expect(neighbours8(5, 0, 12)).toHaveLength(5);
    expect(neighbours8(5, 5, 12)).toHaveLength(8);
    expect(neighbours8(11, 11, 12)).toHaveLength(3);
  });
});
