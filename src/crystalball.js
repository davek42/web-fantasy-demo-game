import * as THREE from "three";
import { board, tileToWorld } from "./models/board.js";
import { dragon } from "./models/dragon.js";
import { orc } from "./models/orc.js";
import { wizard } from "./models/wizard.js";
import { rogue } from "./models/rogue.js";
import { Timeline } from "./timeline.js";
import { createEffects } from "./effects.js";

const MODEL_BUILDERS = { dragon, orc, wizard, rogue };
/** Board tiles are 1 unit; the humanoids are built ~0.8 tall, the dragon spans ~2 units. */
const MODEL_SCALE = { dragon: 1.0, orc: 1.4, wizard: 1.4, rogue: 1.5 };

// animation timings (seconds) and sizes
const MOVE_STEP = 0.28;
const HOP = 0.08;
const LUNGE = 0.35;
const LUNGE_OUT = 0.15;
const LUNGE_BACK = 0.2;
const BOLT = 0.3;
const RETALIATION_DELAY = 0.3;
const DEATH = 0.6;
const HEAL = 0.3;
const SETTLE = 0.2;

const COLORS = {
  hit: 0xffa53a,
  retaliation: 0xff5a3a,
  bolt: 0x6fd0ff,
  breath: 0xff7a1a,
  heal: 0x7dff9a,
  reachable: 0x3fbf5f,
  target: 0xd23c3c,
  selected: 0xe0b45c,
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const named = (root, name) => {
  const found = [];
  root.traverse((child) => child.name === name && found.push(child));
  return found;
};

/**
 * The 3D view of the board. `sync(game)` rebuilds the scene from state,
 * `play(events, game)` replays one command on a timeline and then reconciles.
 * The view never decides anything; it only shows what the engine said.
 */
export function createCrystalBall(stage, { onEvent = () => {}, onIdle = () => {} } = {}) {
  const { scene, camera, renderer } = stage;
  const effects = createEffects(scene);
  const pieces = new Map(); // unitId → holder group
  const piecesGroup = new THREE.Group();
  piecesGroup.name = "pieces";
  scene.add(piecesGroup);
  const highlights = new THREE.Group();
  highlights.name = "highlights";
  scene.add(highlights);

  let boardGroup = null;
  let boardKey = null;
  let size = 8;
  let timeline = new Timeline();
  let tweens = [];
  let busy = false;

  const planeGeo = new THREE.PlaneGeometry(0.92, 0.92);
  const ringGeo = new THREE.RingGeometry(0.36, 0.44, 32);
  const highlightMat = {
    reachable: new THREE.MeshBasicMaterial({ color: COLORS.reachable, transparent: true, opacity: 0.45, depthWrite: false }),
    target: new THREE.MeshBasicMaterial({ color: COLORS.target, transparent: true, opacity: 0.5, depthWrite: false }),
    selected: new THREE.MeshBasicMaterial({ color: COLORS.selected, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // --- pieces --------------------------------------------------------------

  function world(x, y) {
    return tileToWorld(x, y, size);
  }

  function buildPiece(unit) {
    const holder = new THREE.Group();
    holder.name = `piece-${unit.id}`;
    holder.userData.unitId = unit.id;
    const model = MODEL_BUILDERS[unit.id]();
    model.scale.setScalar(MODEL_SCALE[unit.id] ?? 1);
    holder.add(model);
    holder.userData.model = model;
    holder.userData.phase = Math.random() * Math.PI * 2;
    holder.userData.wingPivots = named(model, "wing-pivot");
    holder.userData.staffTip = named(model, "staff-tip")[0] ?? null;
    holder.userData.maw = named(model, "dragon-maw")[0] ?? null;
    return holder;
  }

  function place(holder, x, y) {
    const p = world(x, y);
    holder.position.set(p.x, 0, p.z);
  }

  function facePoint(holder, target) {
    holder.rotation.y = Math.atan2(target.x - holder.position.x, target.z - holder.position.z);
  }

  function removePiece(id) {
    const holder = pieces.get(id);
    if (!holder) return;
    piecesGroup.remove(holder);
    pieces.delete(id);
  }

  function rebuildBoard(state) {
    if (boardGroup) {
      scene.remove(boardGroup);
      boardGroup.userData.dispose?.();
    }
    boardGroup = board(state.size, state.terrain, state.seed);
    scene.add(boardGroup);
    for (const id of [...pieces.keys()]) removePiece(id);
    console.log(`🔮 board rebuilt ${state.size}×${state.size}`);
  }

  /** Make the scene match the state exactly. Safe to call any time. */
  function sync(game) {
    finishTweens();
    timeline.flush();
    timeline = new Timeline();
    effects.clear();
    busy = false;
    const state = game.state;
    size = state.size;
    const key = `${state.seed}:${state.size}`;
    if (key !== boardKey) {
      rebuildBoard(state);
      boardKey = key;
    }
    const centre = new THREE.Vector3(0, 0, 0);
    for (const unit of state.units) {
      if (!unit.alive) {
        removePiece(unit.id);
        continue;
      }
      let holder = pieces.get(unit.id);
      if (!holder) {
        holder = buildPiece(unit);
        pieces.set(unit.id, holder);
        piecesGroup.add(holder);
        place(holder, unit.x, unit.y);
        facePoint(holder, centre);
      } else {
        place(holder, unit.x, unit.y);
      }
      holder.scale.setScalar(1);
      holder.visible = true;
    }
  }

  // --- highlights and picking ---------------------------------------------

  function clearHighlights() {
    while (highlights.children.length) highlights.remove(highlights.children[0]);
  }

  function setHighlights({ reachable = [], targets = [], selected = null } = {}) {
    clearHighlights();
    const addPlane = (tile, mat) => {
      const m = new THREE.Mesh(planeGeo, mat);
      m.rotation.x = -Math.PI / 2;
      const p = world(tile.x, tile.y);
      m.position.set(p.x, 0.012, p.z);
      m.raycast = () => {};
      highlights.add(m);
    };
    for (const tile of reachable) addPlane(tile, highlightMat.reachable);
    for (const tile of targets) addPlane(tile, highlightMat.target);
    if (selected) {
      const ring = new THREE.Mesh(ringGeo, highlightMat.selected);
      ring.rotation.x = -Math.PI / 2;
      const p = world(selected.x, selected.y);
      ring.position.set(p.x, 0.015, p.z);
      ring.raycast = () => {};
      highlights.add(ring);
    }
  }

  /** What is under a screen point: { unitId, tile } for a piece, { tile } for a board tile, else null. */
  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const pieceHit = raycaster.intersectObjects(piecesGroup.children, true)[0];
    if (pieceHit) {
      let o = pieceHit.object;
      while (o && o.userData.unitId === undefined) o = o.parent;
      if (o) return { unitId: o.userData.unitId };
    }
    const tileHit = boardGroup ? raycaster.intersectObjects(boardGroup.userData.tiles, false)[0] : null;
    if (tileHit) return { tile: { ...tileHit.object.userData.tile } };
    return null;
  }

  // --- tweens ---------------------------------------------------------------

  function tween(duration, apply, onDone) {
    tweens.push({ duration, elapsed: 0, apply, onDone });
  }

  function finishTweens() {
    const pending = tweens;
    tweens = [];
    for (const t of pending) {
      t.apply(1);
      t.onDone?.();
    }
  }

  function stepTo(holder, from, to, duration = MOVE_STEP) {
    const a = world(from.x, from.y);
    const b = world(to.x, to.y);
    facePoint(holder, b);
    tween(duration, (k) => {
      const e = easeInOut(k);
      holder.position.lerpVectors(a, b, e);
      holder.position.y = Math.sin(Math.PI * k) * HOP;
    });
  }

  function lunge(holder, towards) {
    const origin = holder.position.clone();
    const dir = towards.clone().sub(origin).setY(0).normalize().multiplyScalar(LUNGE);
    tween(LUNGE_OUT, (k) => holder.position.copy(origin).addScaledVector(dir, easeInOut(k)), () => {
      tween(LUNGE_BACK, (k) => holder.position.copy(origin).addScaledVector(dir, 1 - easeInOut(k)));
    });
  }

  function sink(holder) {
    const startY = holder.position.y;
    tween(DEATH, (k) => {
      holder.position.y = startY - 0.7 * k;
      holder.scale.setScalar(1 - 0.8 * k);
    });
  }

  function headOf(holder) {
    const model = holder.userData.model;
    const h = (model.userData.headY ?? 0.7) * model.scale.y;
    return holder.position.clone().setY(holder.position.y + h);
  }

  // --- replay ---------------------------------------------------------------

  /** Replay one command's events, then reconcile with the game and report idle. */
  function play(events, game) {
    finishTweens();
    timeline.flush();
    timeline = new Timeline();
    busy = true;
    setHighlights({});
    let t = 0;

    for (const ev of events) {
      switch (ev.type) {
        case "move": {
          const holder = pieces.get(ev.unitId);
          if (!holder) break;
          for (let i = 1; i < ev.path.length; i++) {
            const from = ev.path[i - 1];
            const to = ev.path[i];
            timeline.at(t, () => stepTo(holder, from, to));
            t += MOVE_STEP;
          }
          timeline.at(t, () => onEvent(ev));
          break;
        }
        case "advance": {
          const holder = pieces.get(ev.unitId);
          if (!holder) break;
          timeline.at(t, () => stepTo(holder, ev.from, ev.to));
          t += MOVE_STEP;
          timeline.at(t, () => onEvent(ev));
          break;
        }
        case "attack": {
          const attacker = pieces.get(ev.attackerId);
          const defender = pieces.get(ev.defenderId);
          if (!attacker || !defender) {
            timeline.at(t, () => onEvent(ev));
            break;
          }
          const targetPos = world(ev.to.x, ev.to.y);
          const usesBolt = ev.ranged || !!attacker.userData.staffTip;
          timeline.at(t, () => facePoint(attacker, targetPos));
          let hitAt;
          if (usesBolt) {
            const launch = attacker.userData.staffTip ?? attacker.userData.maw ?? attacker;
            timeline.at(t + 0.05, () => effects.bolt(launch, headOf(defender), COLORS.bolt, BOLT));
            hitAt = t + 0.05 + BOLT;
          } else {
            timeline.at(t, () => {
              lunge(attacker, targetPos);
              if (attacker.userData.maw) {
                const maw = new THREE.Vector3();
                attacker.userData.maw.getWorldPosition(maw);
                effects.flash(maw, COLORS.breath, 0.3, 0.3);
              }
            });
            hitAt = t + LUNGE_OUT;
          }
          timeline.at(hitAt, () => {
            effects.flash(headOf(defender), COLORS.hit, 0.35, 0.45);
            onEvent(ev);
          });
          t = hitAt + 0.35;
          if (ev.retaliation > 0) {
            timeline.at(hitAt + RETALIATION_DELAY, () => {
              facePoint(defender, attacker.position);
              effects.flash(headOf(attacker), COLORS.retaliation, 0.3, 0.32);
            });
            t = hitAt + RETALIATION_DELAY + 0.35;
          }
          break;
        }
        case "death": {
          const holder = pieces.get(ev.unitId);
          if (!holder) break;
          timeline.at(t, () => sink(holder));
          t += DEATH;
          timeline.at(t, () => {
            removePiece(ev.unitId);
            onEvent(ev);
          });
          break;
        }
        case "heal": {
          const holder = pieces.get(ev.unitId);
          timeline.at(t, () => {
            if (holder) effects.flash(headOf(holder), COLORS.heal, HEAL, 0.4);
            onEvent(ev);
          });
          t += HEAL;
          break;
        }
        default:
          timeline.at(t, () => onEvent(ev));
      }
    }

    timeline.at(t + SETTLE, () => {
      busy = false;
      sync(game);
      onIdle();
    });
  }

  // --- per frame -----------------------------------------------------------

  function idle(time) {
    for (const holder of pieces.values()) {
      const model = holder.userData.model;
      const k = time * 2 + holder.userData.phase;
      if (holder.userData.unitId === "dragon") {
        model.position.y = 0.02 + Math.sin(k * 0.7) * 0.02;
        for (const pivot of holder.userData.wingPivots) {
          const side = Math.sign(pivot.scale.x);
          pivot.rotation.z = side * (pivot.userData.rest + Math.sin(k * 0.9) * pivot.userData.flap);
        }
      } else {
        model.position.y = Math.abs(Math.sin(k)) * 0.012;
      }
    }
  }

  /** Advance animations by dt seconds; `time` is the running clock for idle motion. */
  function step(dt, time) {
    timeline.update(dt);
    for (let i = 0; i < tweens.length; i++) {
      const tw = tweens[i];
      tw.elapsed += dt;
      const k = Math.min(1, tw.elapsed / tw.duration);
      tw.apply(k);
      if (k >= 1) {
        tweens.splice(i, 1);
        i--;
        tw.onDone?.();
      }
    }
    effects.update(dt);
    idle(time);
  }

  console.log("🔮 crystal ball ready");
  return {
    sync,
    play,
    setHighlights,
    pickAt,
    step,
    get busy() {
      return busy;
    },
  };
}
