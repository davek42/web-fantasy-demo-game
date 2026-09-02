import { describe, expect, test } from "bun:test";
import { Game } from "../src/game/game.js";
import { BOARD_SIZE, ROSTER, TERRAIN } from "../src/game/rules.js";
import { eventTypes, find, loadBoard, newGame, setActive, tileKeys } from "./helpers.js";

const EMPTY = ["......", "......", "......", "......", "......", "......"];

describe("new game", () => {
  test("puts the four pieces in plain corners with the Dragon to move", () => {
    const game = newGame(3);
    const s = game.state;
    expect(s.size).toBe(BOARD_SIZE);
    expect(s.status).toBe("playing");
    expect(s.round).toBe(1);
    expect(s.units.map((u) => u.id)).toEqual(ROSTER.map((r) => r.id));
    expect(game.activeUnit().id).toBe("dragon");
    const last = BOARD_SIZE - 1;
    expect(game.unit("dragon")).toMatchObject({ x: 0, y: 0, alive: true });
    expect(game.unit("orc")).toMatchObject({ x: last, y: 0 });
    expect(game.unit("wizard")).toMatchObject({ x: 0, y: last });
    expect(game.unit("rogue")).toMatchObject({ x: last, y: last });
    for (const u of s.units) {
      expect(u.hp).toBe(u.maxHp);
      expect(game.terrainAt(u.x, u.y)).toBe(TERRAIN.PLAIN);
    }
  });

  test("same seed, same realm", () => {
    expect(newGame(11).state.terrain).toEqual(newGame(11).state.terrain);
  });
});

describe("reachable tiles", () => {
  test("Orc (move 1) reaches its neighbours, clipped at the edge", () => {
    const game = loadBoard(newGame(), ["O.....", "......", "......", "......", "......", "......"]);
    expect(tileKeys(game.reachableTiles("orc"))).toEqual(tileKeys([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]));
  });

  test("Rogue (move 3) covers a Chebyshev square, diagonals free", () => {
    const game = loadBoard(newGame(), ["......", ".R....", "......", "......", "......", "......"]);
    const tiles = game.reachableTiles("rogue");
    expect(tiles).toHaveLength(24); // 5×5 square minus the start
    expect(tileKeys(tiles)).toContain("4,4");
    expect(tileKeys(tiles)).not.toContain("5,0");
    expect(tileKeys(tiles)).not.toContain("1,1");
  });

  test("mountains stop walkers but not the flying Dragon", () => {
    const walled = ["R^....", "^^....", "......", "......", "......", "......"];
    const rogue = loadBoard(newGame(), walled);
    expect(rogue.reachableTiles("rogue")).toEqual([]);

    const flying = loadBoard(newGame(), ["D^....", "^^....", "......", "......", "......", "......"]);
    const tiles = tileKeys(flying.reachableTiles("dragon"));
    expect(tiles).toContain("1,1"); // may stand on a mountain
    expect(tiles).toContain("2,2"); // and pass over one
  });

  test("occupied tiles are neither destinations nor corridors", () => {
    const game = loadBoard(newGame(), ["R.O...", "^^^^^^", "......", "......", "......", "......"]);
    expect(tileKeys(game.reachableTiles("rogue"))).toEqual(["1,0"]);
  });

  test("dead units have no reach", () => {
    const game = loadBoard(newGame(), ["R.....", "......", "......", "......", "......", "......"]);
    expect(game.reachableTiles("orc")).toEqual([]);
  });
});

describe("move", () => {
  test("moves once, carries a path, and refuses a second move", () => {
    const game = loadBoard(newGame(), ["......", ".R....", "......", "......", "......", "......"]);
    const r = game.move({ x: 4, y: 3 });
    expect(r.ok).toBe(true);
    const ev = find(r, "move");
    expect(ev).toMatchObject({ unitId: "rogue", from: { x: 1, y: 1 }, to: { x: 4, y: 3 } });
    expect(ev.path).toHaveLength(4);
    expect(ev.path[0]).toEqual({ x: 1, y: 1 });
    expect(ev.path[3]).toEqual({ x: 4, y: 3 });
    expect(game.unit("rogue")).toMatchObject({ x: 4, y: 3 });
    expect(game.state.turn.movesLeft).toBe(0);
    expect(game.state.turn.acted).toBe(true);

    const again = game.move({ x: 3, y: 3 });
    expect(again.ok).toBe(false);
    expect(again.error).toContain("already moved");
  });

  test("refuses unreachable tiles with an error", () => {
    const game = loadBoard(newGame(), ["O.....", "......", "......", "......", "......", "......"]);
    const r = game.move({ x: 5, y: 5 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("cannot reach");
    expect(game.state.turn.movesLeft).toBe(1);
  });

  test("attacking ends movement for ordinary units", () => {
    const game = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", "......"]);
    expect(game.attack("rogue").ok).toBe(true);
    const r = game.move({ x: 0, y: 1 });
    expect(r.ok).toBe(false);
  });
});

describe("melee attack", () => {
  test("needs an adjacent target, diagonals included", () => {
    const far = loadBoard(newGame(), ["O.R...", "......", "......", "......", "......", "......"]);
    const r = far.attack("rogue");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("out of reach");

    const diagonal = loadBoard(newGame(), ["O.....", ".R....", "......", "......", "......", "......"]);
    expect(diagonal.attack("rogue").ok).toBe(true);
  });

  test("move then attack in one turn", () => {
    const game = loadBoard(newGame(), ["O.D...", "......", "......", "......", "......", "......"]);
    setActive(game, "orc");
    expect(game.move({ x: 1, y: 0 }).ok).toBe(true);
    const r = game.attack("dragon");
    expect(r.ok).toBe(true);
    const ev = find(r, "attack");
    expect(ev).toMatchObject({ attackerId: "orc", defenderId: "dragon", ranged: false });
    expect(ev.damage).toBeGreaterThan(0);
    expect(ev.retaliation).toBeGreaterThan(0);
    expect(game.unit("dragon").hp).toBe(ev.defenderHp);
    expect(game.unit("orc").hp).toBe(ev.attackerHp);
  });

  test("a kill advances the attacker into the vacated tile", () => {
    const game = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", ".....W"], { hp: { rogue: 1 } });
    const r = game.attack("rogue");
    expect(eventTypes(r)).toEqual(["attack", "death", "advance"]);
    expect(find(r, "attack").killed).toBe(true);
    expect(find(r, "attack").retaliation).toBe(0);
    expect(game.unit("rogue").alive).toBe(false);
    expect(game.unit("orc")).toMatchObject({ x: 1, y: 0 });
  });

  test("no advance onto a mountain unless the attacker flies", () => {
    const orc = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", ".....W"], {
      hp: { rogue: 1 },
      terrainUnder: { R: TERRAIN.MOUNTAIN },
    });
    const r1 = orc.attack("rogue");
    expect(eventTypes(r1)).toEqual(["attack", "death"]);
    expect(orc.unit("orc")).toMatchObject({ x: 0, y: 0 });

    const dragon = loadBoard(newGame(), ["DR....", "......", "......", "......", "......", "......"], {
      hp: { rogue: 1 },
      terrainUnder: { R: TERRAIN.MOUNTAIN },
    });
    const r2 = dragon.attack("rogue");
    expect(eventTypes(r2)).toContain("advance");
    expect(dragon.unit("dragon")).toMatchObject({ x: 1, y: 0 });
  });

  test("refuses self, dead, and unknown targets", () => {
    const game = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", "......"]);
    expect(game.attack("orc").ok).toBe(false);
    expect(game.attack("wizard").ok).toBe(false);
    expect(game.attack("nobody").ok).toBe(false);
  });
});

describe("the Wizard's ranged attack", () => {
  test("strikes from two tiles away without retaliation and never advances", () => {
    const game = loadBoard(newGame(), ["W.D...", "......", "......", "......", "......", ".....R"], { hp: { dragon: 1 } });
    setActive(game, "wizard");
    const r = game.attack("dragon");
    expect(r.ok).toBe(true);
    const ev = find(r, "attack");
    expect(ev.ranged).toBe(true);
    expect(ev.retaliation).toBe(0);
    expect(ev.killed).toBe(true);
    expect(eventTypes(r)).not.toContain("advance");
    expect(game.unit("wizard")).toMatchObject({ x: 0, y: 0 });
  });

  test("an adjacent target hits back", () => {
    const game = loadBoard(newGame(), ["WD....", "......", "......", "......", "......", "......"]);
    setActive(game, "wizard");
    const ev = find(game.attack("dragon"), "attack");
    expect(ev.ranged).toBe(false);
    expect(ev.retaliation).toBeGreaterThan(0);
  });

  test("three tiles is too far", () => {
    const game = loadBoard(newGame(), ["W..D..", "......", "......", "......", "......", "......"]);
    setActive(game, "wizard");
    expect(game.attack("dragon").ok).toBe(false);
  });

  test("attackableTargets previews the exchange", () => {
    const game = loadBoard(newGame(), ["W.D...", "......", "......", "......", "......", "......"]);
    const targets = game.attackableTargets("wizard");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ unitId: "dragon", distance: 2, retaliates: false });
    expect(targets[0].preview.damage).toBeGreaterThan(0);
    expect(targets[0].preview.retaliation).toBe(0);
  });
});

describe("terrain in combat", () => {
  test("a defender in a forest takes less damage", () => {
    const open = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", "......"]);
    const forest = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", "......"], {
      terrainUnder: { R: TERRAIN.FOREST },
    });
    const a = find(open.attack("rogue"), "attack");
    const b = find(forest.attack("rogue"), "attack");
    expect(b.damage).toBeLessThan(a.damage);
    expect(b.retaliation).toBeGreaterThanOrEqual(a.retaliation);
  });

  test("an attacker in a forest gains nothing", () => {
    const open = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", "......"]);
    const forest = loadBoard(newGame(), ["OR....", "......", "......", "......", "......", "......"], {
      terrainUnder: { O: TERRAIN.FOREST },
    });
    expect(find(forest.attack("rogue"), "attack")).toMatchObject({
      damage: find(open.attack("rogue"), "attack").damage,
    });
  });
});

describe("retaliation deaths", () => {
  test("the attacker can fall to the counter-blow; the turn passes without healing", () => {
    const game = loadBoard(newGame(), ["DR....", "......", "......", "......", "......", ".....W"], { hp: { rogue: 1 } });
    setActive(game, "rogue");
    const r = game.attack("dragon");
    expect(r.ok).toBe(true);
    expect(find(r, "attack").attackerKilled).toBe(true);
    expect(eventTypes(r)).toEqual(["attack", "death", "turn"]);
    expect(find(r, "death").unitId).toBe("rogue");
    expect(game.unit("rogue").alive).toBe(false);
    expect(game.unit("rogue").hp).toBe(0);
    expect(game.activeUnit().alive).toBe(true);
    expect(game.activeUnit().id).toBe("dragon");
    expect(game.state.status).toBe("playing");
  });
});

describe("turns", () => {
  test("cycle Dragon → Orc → Wizard → Rogue → Dragon, counting rounds", () => {
    const game = newGame(2);
    const order = [game.activeUnit().id];
    for (let i = 0; i < 4; i++) {
      const r = game.endTurn();
      expect(r.ok).toBe(true);
      order.push(find(r, "turn").unitId);
    }
    expect(order).toEqual(["dragon", "orc", "wizard", "rogue", "dragon"]);
    expect(game.state.round).toBe(2);
  });

  test("dead units are skipped", () => {
    const game = loadBoard(newGame(), ["D.....", "......", "......", "......", "...W..", "......"]);
    expect(find(game.endTurn(), "turn").unitId).toBe("wizard");
    expect(find(game.endTurn(), "turn").unitId).toBe("dragon");
  });

  test("an idle unit heals at the end of its turn, capped at max", () => {
    const game = loadBoard(newGame(), ["D.....", "......", "......", "......", "...W..", "......"], {
      hp: { dragon: 20, wizard: 5 },
    });
    const r1 = game.endTurn();
    expect(find(r1, "heal")).toMatchObject({ unitId: "dragon", amount: 2, hp: 22 });
    const r2 = game.endTurn(); // wizard mends faster
    expect(find(r2, "heal")).toMatchObject({ unitId: "wizard", amount: 4, hp: 9 });
    game.unit("dragon").hp = 24;
    expect(find(game.endTurn(), "heal")).toMatchObject({ amount: 1, hp: 25 });
    expect(find(game.endTurn(), "heal")).toMatchObject({ amount: 1, hp: 10 });
    expect(find(game.endTurn(), "heal")).toBeUndefined(); // dragon is full
  });

  test("acting cancels the heal", () => {
    const game = loadBoard(newGame(), ["D.....", "......", "......", "......", "...W..", "......"], { hp: { dragon: 10 } });
    game.move({ x: 1, y: 1 });
    const r = game.endTurn();
    expect(find(r, "heal")).toBeUndefined();
    expect(game.unit("dragon").hp).toBe(10);
  });
});

describe("skills", () => {
  test("persist: the Orc attacks again after a kill", () => {
    const game = loadBoard(newGame(), ["RD....", ".O....", "......", "......", "......", "......"], { hp: { rogue: 1 } });
    setActive(game, "orc");
    const kill = game.attack("rogue");
    expect(find(kill, "attack").killed).toBe(true);
    expect(game.unit("orc")).toMatchObject({ x: 0, y: 0 });
    expect(game.state.turn.attacksLeft).toBe(1);
    const second = game.attack("dragon");
    expect(second.ok).toBe(true);
    expect(find(second, "attack").killed).toBe(false);
    expect(game.state.turn.attacksLeft).toBe(0);
    expect(game.attack("dragon").ok).toBe(false);
  });

  test("persist does not refresh after a non-kill", () => {
    const game = loadBoard(newGame(), ["OD....", "......", "......", "......", "......", "......"]);
    setActive(game, "orc");
    game.attack("dragon");
    expect(game.state.turn.attacksLeft).toBe(0);
  });

  test("escape: the Rogue may move, attack, then move again, once", () => {
    const game = loadBoard(newGame(), ["R.....", "......", "..D...", "......", "......", "......"]);
    setActive(game, "rogue");
    expect(game.move({ x: 1, y: 1 }).ok).toBe(true);
    expect(game.attack("dragon").ok).toBe(true);
    expect(game.state.turn.movesLeft).toBe(1);
    expect(game.move({ x: 0, y: 0 }).ok).toBe(true);
    expect(game.move({ x: 1, y: 0 }).ok).toBe(false);
  });

  test("escape: attacking first still leaves one move", () => {
    const game = loadBoard(newGame(), ["RD....", "......", "......", "......", "......", "......"]);
    setActive(game, "rogue");
    expect(game.attack("dragon").ok).toBe(true);
    expect(game.move({ x: 0, y: 1 }).ok).toBe(true);
    expect(game.move({ x: 0, y: 2 }).ok).toBe(false);
  });
});

describe("game over", () => {
  test("the last piece standing wins and commands stop", () => {
    const game = loadBoard(newGame(), ["DR....", "......", "......", "......", "......", "......"], { hp: { rogue: 1 } });
    const r = game.attack("rogue");
    expect(eventTypes(r)).toContain("gameOver");
    expect(find(r, "gameOver").winnerId).toBe("dragon");
    expect(eventTypes(r)).not.toContain("turn");
    expect(game.state.status).toBe("over");
    expect(game.state.winnerId).toBe("dragon");
    for (const result of [game.endTurn(), game.move({ x: 2, y: 2 }), game.attack("rogue")]) {
      expect(result.ok).toBe(false);
      expect(result.error).toContain("over");
    }
  });
});

describe("save and restore", () => {
  test("a JSON round trip preserves state and reach", () => {
    const game = newGame(9);
    game.move({ x: 1, y: 1 });
    game.endTurn();
    const copy = Game.fromJSON(JSON.parse(JSON.stringify(game.toJSON())));
    expect(copy.state).toEqual(game.state);
    expect(copy.reachableTiles()).toEqual(game.reachableTiles());
    expect(copy.activeUnit().id).toBe("orc");
  });
});

describe("log", () => {
  test("records what happened in round-stamped lines", () => {
    const game = loadBoard(newGame(), ["OD....", "......", "......", "......", "......", "......"]);
    setActive(game, "orc");
    game.attack("dragon");
    const last = game.state.log.at(-1);
    expect(last.round).toBe(1);
    expect(last.text).toContain("Orc");
    expect(last.text).toContain("hits");
  });
});
