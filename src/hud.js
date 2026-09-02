import { ROSTER, SKILL_TEXT, TERRAIN_RULES } from "./game/rules.js";

const DEF = Object.fromEntries(ROSTER.map((d) => [d.id, d]));
const LOG_LINES = 8;

export function label(game, id) {
  const unit = game.unit(id);
  return `${DEF[id]?.emoji ?? ""} ${unit?.name ?? id}`.trim();
}

/** Turn an event into one sentence for the chronicle. Returns null for silent events. */
export function describe(event, game) {
  switch (event.type) {
    case "move":
      return `${label(game, event.unitId)} moves to (${event.to.x}, ${event.to.y}).`;
    case "attack": {
      const back = event.retaliation > 0 ? ` and takes ${event.retaliation} back` : "";
      const how = event.ranged ? "bolts" : "hits";
      return `${label(game, event.attackerId)} ${how} ${label(game, event.defenderId)} for ${event.damage}${back}.`;
    }
    case "death":
      return `${label(game, event.unitId)} falls.`;
    case "heal":
      return `${label(game, event.unitId)} rests and recovers ${event.amount}.`;
    case "turn":
      return `Round ${event.round}. ${label(game, event.unitId)}'s turn.`;
    case "gameOver":
      return event.winnerId ? `🏆 ${label(game, event.winnerId)} rules the realm!` : "The realm lies empty.";
    default:
      return null;
  }
}

function skillLine(unit) {
  const parts = unit.skills.map((s) => SKILL_TEXT[s] ?? s);
  if (unit.range > 1) parts.push(`Ranged: strikes from ${unit.range} tiles`);
  if (DEF[unit.id]?.heal) parts.push(`Mend: rests heal ${unit.heal}`);
  return parts.join(" · ") || "No special skill";
}

/**
 * Rebuild the banner, the four unit cards, and button states from the game.
 * `ui.display` (id → { hp, alive }) overrides state while a replay is running,
 * so HP bars change when the blow lands rather than when the command returns.
 */
export function renderHud(game, ui = {}) {
  const state = game.state;
  const banner = document.getElementById("banner");
  const cards = document.getElementById("cards");
  const active = game.activeUnit();
  const shown = (u) => ui.display?.[u.id] ?? { hp: u.hp, alive: u.alive };

  if (state.status === "over") {
    banner.className = "winner";
    banner.textContent = state.winnerId ? `🏆 ${label(game, state.winnerId)} rules the realm!` : "The realm lies empty.";
  } else {
    banner.className = "";
    const turn = state.turn;
    const todo = [turn.movesLeft > 0 ? "move" : null, turn.attacksLeft > 0 ? "attack" : null].filter(Boolean);
    const tail = todo.length ? `can ${todo.join(" and ")}` : "is done";
    banner.textContent = `Round ${state.round} · ${label(game, active.id)}'s turn · ${tail}`;
  }

  cards.innerHTML = "";
  for (const unit of state.units) {
    const def = DEF[unit.id];
    const s = shown(unit);
    const card = document.createElement("div");
    card.className = "card";
    if (state.status === "playing" && unit.id === active.id) card.classList.add("active");
    if (!s.alive) card.classList.add("dead");
    card.style.setProperty("--c", def.color);
    const pct = Math.round((s.hp / unit.maxHp) * 100);
    const terrain = s.alive ? TERRAIN_RULES[game.terrainAt(unit.x, unit.y)].name : "fallen";
    card.innerHTML = `
      <div class="head"><span class="swatch"></span>${def.emoji} ${unit.name}<span class="hp">${s.hp}/${unit.maxHp}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="stats">atk ${unit.atk} · def ${unit.def} · move ${unit.move} · range ${unit.range} · ${terrain}</div>
      <div class="skill">${skillLine(unit)}</div>`;
    cards.appendChild(card);
  }

  const busy = !!ui.busy;
  document.getElementById("end-turn").disabled = busy || state.status !== "playing";
  document.getElementById("new-game").disabled = busy;
}

export function appendLog(text) {
  if (!text) return;
  const log = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = text;
  log.appendChild(line);
  while (log.children.length > LOG_LINES) log.removeChild(log.firstChild);
}

export function clearLog() {
  document.getElementById("log").innerHTML = "";
}
