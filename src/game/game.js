import { BOARD_SIZE, COMBAT, ROSTER, cornerTile } from "./rules.js";
import { createRng } from "./rng.js";
import { chebyshev, defenceBonus, generateTerrain, isPassable, key, neighbours8 } from "./terrain.js";
import { resolveCombat } from "./combat.js";

const DEF = Object.fromEntries(ROSTER.map((d) => [d.id, d]));
const LOG_LIMIT = 200;

/** A fresh turn record for a unit: one move, one attack, escape unused, nothing done yet. */
export function freshTurn(unitId) {
  return { unitId, movesLeft: 1, attacksLeft: 1, escapeUsed: false, acted: false };
}

function buildUnit(def, size) {
  const at = cornerTile(def.corner, size);
  return {
    id: def.id,
    name: def.name,
    x: at.x,
    y: at.y,
    hp: def.hp,
    maxHp: def.hp,
    atk: def.atk,
    def: def.def,
    move: def.move,
    range: def.range,
    skills: [...def.skills],
    heal: def.heal ?? COMBAT.restHeal,
    alive: true,
  };
}

/**
 * The realm: a square board of terrain and four pieces taking turns.
 * Commands mutate `state` and return { ok, events, error? }. Events are plain
 * objects the crystal ball replays; the engine never touches the DOM.
 */
export class Game {
  constructor({ seed = Date.now(), size = BOARD_SIZE } = {}) {
    this.rng = createRng(seed);
    this.events = [];
    const terrain = generateTerrain(this.rng, size);
    const units = ROSTER.map((def) => buildUnit(def, size));
    this.state = {
      seed,
      size,
      status: "playing",
      winnerId: null,
      round: 1,
      terrain,
      units,
      turn: freshTurn(units[0].id),
      log: [],
    };
    this.log(`Round 1. ${this.label(units[0])} moves first.`);
    console.log(`🐉 new realm ${size}×${size}, seed ${seed}`);
  }

  // --- Save / restore -----------------------------------------------------

  toJSON() {
    return { state: structuredClone(this.state), rng: this.rng.getState() };
  }

  static fromJSON(data) {
    const game = Object.create(Game.prototype);
    game.rng = createRng(0);
    game.rng.setState(data.rng);
    game.state = structuredClone(data.state);
    game.events = [];
    return game;
  }

  // --- Queries ------------------------------------------------------------

  unit(id) {
    return this.state.units.find((u) => u.id === id);
  }

  activeUnit() {
    return this.unit(this.state.turn.unitId);
  }

  livingUnits() {
    return this.state.units.filter((u) => u.alive);
  }

  unitAt(x, y) {
    return this.state.units.find((u) => u.alive && u.x === x && u.y === y) ?? null;
  }

  terrainAt(x, y) {
    return this.state.terrain[y][x];
  }

  /** Breadth-first reach: Map of "x,y" → { x, y, path } for every tile the unit can end on. */
  reachMap(unit) {
    const { size } = this.state;
    const start = { x: unit.x, y: unit.y, path: [{ x: unit.x, y: unit.y }] };
    const seen = new Map([[key(unit.x, unit.y), start]]);
    let frontier = [start];
    for (let step = 0; step < unit.move && frontier.length; step++) {
      const next = [];
      for (const cur of frontier) {
        for (const n of neighbours8(cur.x, cur.y, size)) {
          const k = key(n.x, n.y);
          if (seen.has(k)) continue;
          if (!isPassable(this.terrainAt(n.x, n.y), unit)) continue;
          if (this.unitAt(n.x, n.y)) continue;
          const entry = { x: n.x, y: n.y, path: [...cur.path, { x: n.x, y: n.y }] };
          seen.set(k, entry);
          next.push(entry);
        }
      }
      frontier = next;
    }
    seen.delete(key(unit.x, unit.y));
    return seen;
  }

  reachableTiles(unitId = this.state.turn.unitId) {
    const unit = this.unit(unitId);
    if (!unit || !unit.alive) return [];
    return [...this.reachMap(unit).values()].map(({ x, y }) => ({ x, y }));
  }

  /** Living enemies within range, with a dry-run of the exchange for previews. */
  attackableTargets(unitId = this.state.turn.unitId) {
    const unit = this.unit(unitId);
    if (!unit || !unit.alive) return [];
    return this.livingUnits()
      .filter((other) => other.id !== unit.id && chebyshev(unit, other) <= unit.range)
      .map((other) => {
        const distance = chebyshev(unit, other);
        const retaliates = distance <= other.range;
        return {
          unitId: other.id,
          x: other.x,
          y: other.y,
          distance,
          retaliates,
          preview: resolveCombat(unit, other, { defenceBonus: defenceBonus(this.terrainAt(other.x, other.y)), retaliates }),
        };
      });
  }

  // --- Commands -----------------------------------------------------------

  move(to) {
    const blocked = this.begin();
    if (blocked) return blocked;
    const unit = this.activeUnit();
    const turn = this.state.turn;
    if (turn.movesLeft <= 0) return this.fail(`${this.label(unit)} has already moved this turn.`);
    if (!to || !Number.isInteger(to.x) || !Number.isInteger(to.y)) return this.fail("Move where?");
    const entry = this.reachMap(unit).get(key(to.x, to.y));
    if (!entry) return this.fail(`${this.label(unit)} cannot reach (${to.x}, ${to.y}).`);

    const from = { x: unit.x, y: unit.y };
    unit.x = to.x;
    unit.y = to.y;
    turn.movesLeft -= 1;
    turn.acted = true;
    this.emit("move", { unitId: unit.id, from, to: { x: to.x, y: to.y }, path: entry.path });
    this.log(`${this.label(unit)} moves to (${to.x}, ${to.y}).`);
    return this.finish();
  }

  attack(targetId) {
    const blocked = this.begin();
    if (blocked) return blocked;
    const attacker = this.activeUnit();
    const target = this.unit(targetId);
    const turn = this.state.turn;
    if (!target || !target.alive) return this.fail("There is nothing there to attack.");
    if (target.id === attacker.id) return this.fail(`${this.label(attacker)} will not attack itself.`);
    if (turn.attacksLeft <= 0) return this.fail(`${this.label(attacker)} has already attacked this turn.`);
    const distance = chebyshev(attacker, target);
    if (distance > attacker.range) return this.fail(`${this.label(target)} is out of reach.`);

    const retaliates = distance <= target.range;
    const result = resolveCombat(attacker, target, {
      defenceBonus: defenceBonus(this.terrainAt(target.x, target.y)),
      retaliates,
    });
    target.hp = result.defenderHp;
    attacker.hp = result.attackerHp;
    turn.acted = true;
    turn.attacksLeft -= 1;
    if (attacker.skills.includes("escape") && !turn.escapeUsed) {
      turn.movesLeft = 1;
      turn.escapeUsed = true;
    } else {
      turn.movesLeft = 0;
    }

    this.emit("attack", {
      attackerId: attacker.id,
      defenderId: target.id,
      from: { x: attacker.x, y: attacker.y },
      to: { x: target.x, y: target.y },
      ranged: distance > 1,
      damage: result.damage,
      retaliation: result.retaliation,
      defenderHp: result.defenderHp,
      attackerHp: result.attackerHp,
      killed: result.killed,
      attackerKilled: result.attackerKilled,
    });
    const blow = result.retaliation > 0 ? ` and takes ${result.retaliation} back` : "";
    this.log(`${this.label(attacker)} hits ${this.label(target)} for ${result.damage}${blow}.`);

    if (result.killed) {
      target.alive = false;
      this.emit("death", { unitId: target.id, at: { x: target.x, y: target.y } });
      this.log(`${this.label(target)} falls.`);
      if (attacker.skills.includes("persist")) turn.attacksLeft = 1;
      if (attacker.range === 1 && isPassable(this.terrainAt(target.x, target.y), attacker)) {
        const from = { x: attacker.x, y: attacker.y };
        attacker.x = target.x;
        attacker.y = target.y;
        this.emit("advance", { unitId: attacker.id, from, to: { x: target.x, y: target.y } });
      }
    }
    if (result.attackerKilled) {
      attacker.alive = false;
      this.emit("death", { unitId: attacker.id, at: { x: attacker.x, y: attacker.y } });
      this.log(`${this.label(attacker)} falls to the counter-blow.`);
    }

    this.checkGameOver();
    if (this.state.status === "playing" && !attacker.alive) this.nextTurn();
    return this.finish();
  }

  endTurn() {
    const blocked = this.begin();
    if (blocked) return blocked;
    const unit = this.activeUnit();
    const turn = this.state.turn;
    if (!turn.acted && unit.hp < unit.maxHp) {
      const amount = Math.min(unit.heal, unit.maxHp - unit.hp);
      unit.hp += amount;
      this.emit("heal", { unitId: unit.id, amount, hp: unit.hp });
      this.log(`${this.label(unit)} rests and recovers ${amount}.`);
    }
    this.nextTurn();
    return this.finish();
  }

  // --- Internals ----------------------------------------------------------

  nextTurn() {
    const units = this.state.units;
    const current = units.findIndex((u) => u.id === this.state.turn.unitId);
    for (let step = 1; step <= units.length; step++) {
      const index = (current + step) % units.length;
      const candidate = units[index];
      if (!candidate.alive) continue;
      if (index <= current) this.state.round += 1;
      this.state.turn = freshTurn(candidate.id);
      this.emit("turn", { unitId: candidate.id, round: this.state.round });
      this.log(`Round ${this.state.round}. ${this.label(candidate)}'s turn.`);
      return;
    }
  }

  checkGameOver() {
    if (this.state.status !== "playing") return;
    const living = this.livingUnits();
    if (living.length > 1) return;
    this.state.status = "over";
    this.state.winnerId = living[0]?.id ?? null;
    this.emit("gameOver", { winnerId: this.state.winnerId });
    this.log(living[0] ? `${this.label(living[0])} rules the realm!` : "The realm lies empty.");
    console.log(`🐉 game over, winner: ${this.state.winnerId}`);
  }

  label(unit) {
    return `${DEF[unit.id]?.emoji ?? ""} ${unit.name}`.trim();
  }

  log(text) {
    this.state.log.push({ round: this.state.round, text });
    if (this.state.log.length > LOG_LIMIT) this.state.log.splice(0, this.state.log.length - LOG_LIMIT);
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  begin() {
    this.events = [];
    if (this.state.status !== "playing") {
      return { ok: false, error: "The game is over.", events: [] };
    }
    return null;
  }

  finish(ok = true) {
    const events = this.events;
    this.events = [];
    return { ok, events };
  }

  fail(error) {
    return { ok: false, error, events: this.finish().events };
  }
}
