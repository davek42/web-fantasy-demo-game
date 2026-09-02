import { describe, expect, test } from "bun:test";
import { Game } from "../src/game/game.js";
import { createRng } from "../src/game/rng.js";
import { TERRAIN } from "../src/game/rules.js";

const SEEDS = 200;
const MAX_TURNS = 300;

/** Nothing the engine does should ever leave the state inconsistent. */
function checkInvariants(game, result) {
  const s = game.state;
  if (!result.ok) expect(typeof result.error).toBe("string");
  expect(Array.isArray(result.events)).toBe(true);
  const occupied = new Set();
  for (const u of s.units) {
    expect(u.hp).toBeGreaterThanOrEqual(0);
    expect(u.hp).toBeLessThanOrEqual(u.maxHp);
    expect(u.alive).toBe(u.hp > 0);
    if (!u.alive) continue;
    const k = `${u.x},${u.y}`;
    expect(occupied.has(k)).toBe(false);
    occupied.add(k);
    if (s.terrain[u.y][u.x] === TERRAIN.MOUNTAIN) expect(u.skills).toContain("fly");
  }
  if (s.status === "playing") expect(game.activeUnit().alive).toBe(true);
  else expect(game.livingUnits().length).toBeLessThanOrEqual(1);
}

/** A mildly bloodthirsty random player: attack when possible, wander otherwise. */
function playRandomly(seed, turns = MAX_TURNS) {
  const game = new Game({ seed });
  const dice = createRng(seed * 7 + 1);
  const commands = [];
  const run = (fn, record) => {
    const result = fn();
    commands.push(record);
    checkInvariants(game, result);
    return result;
  };
  while (game.state.status === "playing" && turns-- > 0) {
    // up to a few actions, then end the turn
    for (let i = 0; i < 4 && game.state.status === "playing"; i++) {
      const targets = game.attackableTargets();
      const tiles = game.reachableTiles();
      if (targets.length && dice.chance(0.8)) {
        const t = dice.pick(targets);
        run(() => game.attack(t.unitId), ["attack", t.unitId]);
      } else if (tiles.length && dice.chance(0.7)) {
        const to = dice.pick(tiles);
        run(() => game.move(to), ["move", to]);
      } else if (dice.chance(0.1)) {
        // deliberately bad orders must fail cleanly
        const wild = { x: dice.int(-2, 14), y: dice.int(-2, 14) };
        run(() => game.move(wild), ["move", wild]);
      } else break;
    }
    if (game.state.status === "playing") run(() => game.endTurn(), ["endTurn"]);
  }
  return { game, commands };
}

describe("fuzz", () => {
  test("random play over many seeds never throws or breaks invariants", () => {
    const outcomes = { playing: 0, over: 0 };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { game } = playRandomly(seed);
      outcomes[game.state.status] += 1;
    }
    expect(outcomes.playing + outcomes.over).toBe(SEEDS);
    expect(outcomes.over).toBeGreaterThan(SEEDS / 4);
  });

  test("the same seed and commands replay to the same state", () => {
    const { game, commands } = playRandomly(77, 40);
    const replay = new Game({ seed: 77 });
    for (const [cmd, arg] of commands) {
      if (cmd === "attack") replay.attack(arg);
      else if (cmd === "move") replay.move(arg);
      else replay.endTurn();
    }
    expect(JSON.stringify(replay.state)).toBe(JSON.stringify(game.state));
  });
});
