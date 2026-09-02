import { Game, freshTurn } from "../src/game/game.js";
import { TERRAIN } from "../src/game/rules.js";

export const LETTERS = { D: "dragon", O: "orc", W: "wizard", R: "rogue" };

/**
 * Overwrite a game's board with a square ASCII picture:
 *   .  plain   f  forest   ^  mountain
 *   D  Dragon  O  Orc      W  Wizard   R  Rogue
 * Units absent from the picture are dead. `hp` overrides current HP by id;
 * `terrainUnder` sets the terrain beneath a unit letter (default plain).
 * The first living unit in roster order becomes active with a fresh turn.
 */
export function loadBoard(game, rows, { hp = {}, terrainUnder = {} } = {}) {
  const size = rows.length;
  for (const row of rows) {
    if (row.length !== size) throw new Error(`fixture must be square: "${row}"`);
  }
  const state = game.state;
  state.size = size;
  state.terrain = rows.map((row) =>
    [...row].map((c) => {
      if (LETTERS[c]) return terrainUnder[c] ?? TERRAIN.PLAIN;
      if (!Object.values(TERRAIN).includes(c)) throw new Error(`unknown fixture char: ${c}`);
      return c;
    }),
  );
  for (const unit of state.units) {
    unit.alive = false;
    unit.hp = 0;
  }
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const id = LETTERS[c];
      if (!id) return;
      const unit = game.unit(id);
      unit.x = x;
      unit.y = y;
      unit.alive = true;
      unit.hp = hp[id] ?? unit.maxHp;
    });
  });
  state.status = "playing";
  state.winnerId = null;
  const first = state.units.find((u) => u.alive);
  state.turn = freshTurn(first.id);
  return game;
}

export function setActive(game, id) {
  game.state.turn = freshTurn(id);
  return game;
}

export function newGame(seed = 1, opts = {}) {
  return new Game({ seed, ...opts });
}

export function eventTypes(result) {
  return result.events.map((e) => e.type);
}

export function find(result, type) {
  return result.events.find((e) => e.type === type);
}

export const tileKeys = (tiles) => tiles.map(({ x, y }) => `${x},${y}`).sort();
