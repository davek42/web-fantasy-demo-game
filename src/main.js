import * as THREE from "three";
import { createStage } from "./stage.js";
import { createCrystalBall } from "./crystalball.js";
import { Game } from "./game/game.js";
import { BOARD_SIZE } from "./game/rules.js";
import { appendLog, clearLog, describe, renderHud } from "./hud.js";

const CLICK_DISTANCE = 6; // px; further than this and it was an orbit drag
const CLICK_TIME = 300; // ms

const stage = createStage(document.getElementById("app"), { size: BOARD_SIZE });
let game = new Game({ seed: Date.now() % 100000 });
const ui = { selected: null, display: null, busy: false };

const view = createCrystalBall(stage, {
  onEvent: (ev) => {
    // keep the cards in step with the animation: HP changes when the blow lands
    if (ev.type === "attack") {
      ui.display[ev.defenderId] = { hp: ev.defenderHp, alive: !ev.killed };
      ui.display[ev.attackerId] = { hp: ev.attackerHp, alive: !ev.attackerKilled };
    } else if (ev.type === "heal") {
      ui.display[ev.unitId] = { hp: ev.hp, alive: true };
    } else if (ev.type === "death") {
      ui.display[ev.unitId] = { hp: 0, alive: false };
    }
    appendLog(describe(ev, game));
    renderHud(game, ui);
  },
  onIdle: () => {
    ui.display = null;
    ui.busy = false;
    ui.selected = game.state.status === "playing" ? game.activeUnit().id : null;
    renderHud(game, ui);
    showHighlights();
  },
});

function snapshot() {
  const display = {};
  for (const u of game.state.units) display[u.id] = { hp: u.hp, alive: u.alive };
  return display;
}

/** What the active piece may still do this turn, as tiles. */
function options() {
  const turn = game.state.turn;
  return {
    reachable: turn.movesLeft > 0 ? game.reachableTiles() : [],
    targets: turn.attacksLeft > 0 ? game.attackableTargets() : [],
  };
}

function showHighlights() {
  if (ui.busy || game.state.status !== "playing" || !ui.selected) {
    view.setHighlights({});
    return;
  }
  const active = game.activeUnit();
  view.setHighlights({ ...options(), selected: { x: active.x, y: active.y } });
}

/** Run an engine command; on success replay its events, otherwise report the error. */
function command(fn) {
  if (ui.busy || game.state.status !== "playing") return;
  const before = snapshot();
  const result = fn();
  if (!result.ok) {
    appendLog(`⚠️ ${result.error}`);
    console.log(`🐉 refused: ${result.error}`);
    return;
  }
  ui.display = before;
  ui.busy = true;
  renderHud(game, ui);
  view.play(result.events, game);
}

function newGame() {
  const seed = Date.now() % 100000;
  game = new Game({ seed });
  window.__game = game;
  clearLog();
  appendLog(`🌍 A new realm rises (seed ${seed}).`);
  view.sync(game);
  stage.fit(game.state.size);
  ui.display = null;
  ui.busy = false;
  ui.selected = game.activeUnit().id;
  renderHud(game, ui);
  showHighlights();
}

function handleClick(clientX, clientY) {
  if (ui.busy || game.state.status !== "playing") return;
  let hit = view.pickAt(clientX, clientY);
  const active = game.activeUnit();
  // clicking the square a piece stands on counts as clicking the piece
  if (hit?.tile) {
    const occupant = game.unitAt(hit.tile.x, hit.tile.y);
    if (occupant) hit = { unitId: occupant.id };
  }
  if (!hit) {
    ui.selected = null;
  } else if (hit.unitId !== undefined) {
    if (hit.unitId === active.id) {
      ui.selected = ui.selected ? null : active.id;
    } else if (ui.selected && options().targets.some((t) => t.unitId === hit.unitId)) {
      command(() => game.attack(hit.unitId));
      return;
    } else {
      appendLog(`⚠️ ${game.unit(hit.unitId).name} is out of reach.`);
    }
  } else if (hit.tile) {
    if (ui.selected) {
      const reachable = options().reachable.some((t) => t.x === hit.tile.x && t.y === hit.tile.y);
      if (reachable) {
        command(() => game.move(hit.tile));
        return;
      }
    }
    ui.selected = ui.selected ? null : active.id;
  }
  showHighlights();
}

// clicks vs orbit drags: only a short, still press counts as a click
const canvas = stage.renderer.domElement;
let press = null;
canvas.addEventListener("pointerdown", (e) => {
  press = { x: e.clientX, y: e.clientY, t: performance.now() };
});
canvas.addEventListener("pointerup", (e) => {
  if (!press) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
  const held = performance.now() - press.t;
  press = null;
  if (moved <= CLICK_DISTANCE && held <= CLICK_TIME) handleClick(e.clientX, e.clientY);
});

// buttons
const autoButton = document.getElementById("rotate-auto");
const toggleAuto = () => {
  stage.setAutoRotate(!stage.autoRotating());
  autoButton.classList.toggle("active", stage.autoRotating());
};
document.getElementById("end-turn").addEventListener("click", () => command(() => game.endTurn()));
document.getElementById("new-game").addEventListener("click", newGame);
document.getElementById("zoom-in").addEventListener("click", stage.zoomIn);
document.getElementById("zoom-out").addEventListener("click", stage.zoomOut);
document.getElementById("zoom-fit").addEventListener("click", () => stage.fit());
document.getElementById("rotate-left").addEventListener("click", () => stage.rotateBy(-1));
document.getElementById("rotate-right").addEventListener("click", () => stage.rotateBy(1));
autoButton.addEventListener("click", toggleAuto);

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  switch (e.key) {
    case "ArrowLeft": stage.rotateBy(-1); break;
    case "ArrowRight": stage.rotateBy(1); break;
    case " ": e.preventDefault(); toggleAuto(); break;
    case "+": case "=": stage.zoomIn(); break;
    case "-": case "_": stage.zoomOut(); break;
    case "f": stage.fit(); break;
    case "Enter": case "e": command(() => game.endTurn()); break;
    case "n": newGame(); break;
    case "Escape": ui.selected = null; showHighlights(); break;
    default: return;
  }
});

// frame loop
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  stage.update(dt);
  view.step(dt, clock.elapsedTime);
  stage.render();
}

view.sync(game);
stage.fit(game.state.size);
ui.selected = game.activeUnit().id;
appendLog(`🌍 A new realm rises (seed ${game.state.seed}).`);
renderHud(game, ui);
showHighlights();
frame();

window.__stage = stage; // dev hooks for poking at things from the console
window.__game = game;
window.__view = view;
console.log("✅ skirmish ready");
