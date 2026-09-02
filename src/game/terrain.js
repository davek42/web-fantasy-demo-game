import { BOARD_SIZE, GENERATION, TERRAIN, TERRAIN_RULES, cornerTile } from "./rules.js";

const CORNERS = ["nw", "ne", "sw", "se"];

export const key = (x, y) => `${x},${y}`;

/** Chebyshev distance: diagonals cost the same as orthogonal steps. */
export function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** The up-to-eight tiles around (x, y), clipped to the board. */
export function neighbours8(x, y, size) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      out.push({ x: nx, y: ny });
    }
  }
  return out;
}

/** Can this unit stand on / path through this terrain code? */
export function isPassable(code, unit) {
  const rule = TERRAIN_RULES[code];
  if (!rule) throw new Error(`unknown terrain: ${code}`);
  return rule.passable || (unit.skills ?? []).includes("fly");
}

export function defenceBonus(code) {
  const rule = TERRAIN_RULES[code];
  if (!rule) throw new Error(`unknown terrain: ${code}`);
  return rule.defenceBonus;
}

/** Tiles within the clear radius of every corner: always plain, so pieces start on open ground. */
function forbiddenTiles(size) {
  const forbidden = new Set();
  const r = GENERATION.cornerClearRadius;
  for (const corner of CORNERS) {
    const c = cornerTile(corner, size);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (x >= 0 && y >= 0 && x < size && y < size) forbidden.add(key(x, y));
      }
    }
  }
  return forbidden;
}

/** Every corner reachable from every other without crossing a mountain. */
function cornersConnected(terrain, size) {
  const start = cornerTile("nw", size);
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighbours8(cur.x, cur.y, size)) {
      const k = key(n.x, n.y);
      if (seen.has(k) || terrain[n.y][n.x] === TERRAIN.MOUNTAIN) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return CORNERS.every((corner) => {
    const c = cornerTile(corner, size);
    return seen.has(key(c.x, c.y));
  });
}

function attempt(rng, size) {
  const terrain = Array.from({ length: size }, () => Array(size).fill(TERRAIN.PLAIN));
  const forbidden = forbiddenTiles(size);
  const open = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (!forbidden.has(key(x, y))) open.push({ x, y });
  }
  if (open.length === 0) return terrain;

  // forests: grow each clump outward from a seed tile by picking random frontier cells
  for (let i = 0; i < GENERATION.forestClumps; i++) {
    const target = rng.int(GENERATION.forestClumpSize[0], GENERATION.forestClumpSize[1]);
    const seed = rng.pick(open);
    if (terrain[seed.y][seed.x] !== TERRAIN.PLAIN) continue;
    const clump = [seed];
    terrain[seed.y][seed.x] = TERRAIN.FOREST;
    let tries = 0;
    while (clump.length < target && tries++ < 200) {
      const from = rng.pick(clump);
      const n = rng.pick(neighbours8(from.x, from.y, size));
      if (forbidden.has(key(n.x, n.y)) || terrain[n.y][n.x] !== TERRAIN.PLAIN) continue;
      terrain[n.y][n.x] = TERRAIN.FOREST;
      clump.push(n);
    }
  }

  // mountains: single tiles on plain ground
  let placed = 0;
  let tries = 0;
  while (placed < GENERATION.mountains && tries++ < 500) {
    const t = rng.pick(open);
    if (terrain[t.y][t.x] !== TERRAIN.PLAIN) continue;
    terrain[t.y][t.x] = TERRAIN.MOUNTAIN;
    placed++;
  }

  return terrain;
}

/**
 * A size×size grid of terrain codes, indexed terrain[y][x]. Corners stay
 * plain and are guaranteed mutually reachable without crossing mountains.
 */
export function generateTerrain(rng, size = BOARD_SIZE) {
  for (let i = 0; i < GENERATION.maxAttempts; i++) {
    const terrain = attempt(rng, size);
    if (cornersConnected(terrain, size)) return terrain;
  }
  throw new Error(`🐉 could not generate a connected ${size}×${size} realm`);
}
