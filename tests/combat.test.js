import { describe, expect, test } from "bun:test";
import { resolveCombat } from "../src/game/combat.js";
import { COMBAT } from "../src/game/rules.js";

const unit = (atk, def, hp, maxHp = hp) => ({ atk, def, hp, maxHp });

describe("resolveCombat: the reference's worked examples", () => {
  test("warrior attacks warrior, both full health: 5 each way", () => {
    const r = resolveCombat(unit(2, 2, 10), unit(2, 2, 10));
    expect(r.attackForce).toBe(2);
    expect(r.defenceForce).toBe(2);
    expect(r.damage).toBe(5);
    expect(r.retaliation).toBe(5);
    expect(r.defenderHp).toBe(5);
    expect(r.attackerHp).toBe(5);
    expect(r.killed).toBe(false);
    expect(r.attackerKilled).toBe(false);
  });

  test("swordsman attacks rider: 10 damage, a kill, no retaliation", () => {
    const r = resolveCombat(unit(3, 3, 15), unit(2, 1, 10));
    expect(r.damage).toBe(10);
    expect(r.killed).toBe(true);
    expect(r.retaliation).toBe(0);
    expect(r.defenderHp).toBe(0);
    expect(r.attackerHp).toBe(15);
  });

  test("warrior at 5 HP attacks a full warrior: deals ~3, takes ~6", () => {
    const r = resolveCombat(unit(2, 2, 5, 10), unit(2, 2, 10));
    expect(r.damage).toBe(3);
    expect(r.retaliation).toBe(6);
  });
});

describe("resolveCombat: rules", () => {
  test("a forest defender takes less and hits back harder", () => {
    const open = resolveCombat(unit(2, 2, 10), unit(2, 2, 10));
    const forest = resolveCombat(unit(2, 2, 10), unit(2, 2, 10), { defenceBonus: 1.5 });
    expect(forest.damage).toBe(4); // round(2/5 × 2 × 4.5 = 3.6)
    expect(forest.retaliation).toBe(5); // round(3/5 × 2 × 4.5 = 5.4)
    expect(forest.damage).toBeLessThan(open.damage);
  });

  test("retaliates: false suppresses the counter-punch", () => {
    const r = resolveCombat(unit(2, 2, 10), unit(2, 2, 10), { retaliates: false });
    expect(r.damage).toBe(5);
    expect(r.retaliation).toBe(0);
    expect(r.attackerHp).toBe(10);
  });

  test("retaliation is computed from the defender's health before the hit", () => {
    // Defender at full health hits back with its full defence force even though
    // it drops to 5 HP this exchange. If post-hit HP were used the force would halve.
    const r = resolveCombat(unit(2, 2, 10), unit(2, 2, 10));
    expect(r.retaliation).toBe(5);
    const halved = resolveCombat(unit(2, 2, 10), unit(2, 2, 5, 10));
    expect(halved.retaliation).toBeLessThan(r.retaliation);
  });

  test("hp never drops below zero and the attacker can die to retaliation", () => {
    const r = resolveCombat(unit(2, 1, 2, 10), unit(2, 3, 15));
    expect(r.attackerHp).toBe(0);
    expect(r.attackerKilled).toBe(true);
    expect(r.defenderHp).toBeGreaterThanOrEqual(0);
  });

  test("a zero-defence defender always takes maximum damage", () => {
    const r = resolveCombat(unit(4, 0, 10), unit(1, 0, 10));
    expect(r.damage).toBe(Math.round(4 * COMBAT.damageScale));
    expect(r.retaliation).toBe(0);
  });

  test("the attacker's defence and the defender's attack play no part", () => {
    const a = resolveCombat(unit(2, 0, 10), unit(0, 2, 10));
    const b = resolveCombat(unit(2, 9, 10), unit(9, 2, 10));
    expect(a.damage).toBe(b.damage);
    expect(a.retaliation).toBe(b.retaliation);
  });

  test("inputs are not mutated", () => {
    const attacker = unit(2, 2, 10);
    const defender = unit(2, 2, 10);
    resolveCombat(attacker, defender);
    expect(attacker.hp).toBe(10);
    expect(defender.hp).toBe(10);
  });
});
