import { COMBAT } from "./rules.js";

/**
 * One exchange of blows, Polytopia style. Deterministic: no dice.
 *
 *   attackForce  = atk × hp/maxHp
 *   defenceForce = def × hp/maxHp × defenceBonus
 *   damage       = round(attackForce / total × atk × damageScale)
 *   retaliation  = round(defenceForce / total × def × damageScale)
 *
 * Retaliation uses the defender's health *before* the hit and is skipped when
 * the defender dies or cannot reach the attacker (`retaliates: false`).
 * Neither input is mutated; the caller applies the resulting hp values.
 */
export function resolveCombat(attacker, defender, { defenceBonus = 1, retaliates = true } = {}) {
  const attackForce = attacker.atk * (attacker.hp / attacker.maxHp);
  const defenceForce = defender.def * (defender.hp / defender.maxHp) * defenceBonus;
  const total = attackForce + defenceForce;

  const damage = total > 0 ? Math.round((attackForce / total) * attacker.atk * COMBAT.damageScale) : 0;
  const defenderHp = Math.max(0, defender.hp - damage);
  const killed = defenderHp === 0;

  const retaliation =
    retaliates && !killed && total > 0
      ? Math.round((defenceForce / total) * defender.def * COMBAT.damageScale)
      : 0;
  const attackerHp = Math.max(0, attacker.hp - retaliation);

  return {
    damage,
    retaliation,
    defenderHp,
    attackerHp,
    killed,
    attackerKilled: attackerHp === 0,
    attackForce,
    defenceForce,
  };
}
