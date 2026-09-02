import * as THREE from "three";
import { matte } from "./parts.js";
import { tileToWorld } from "./board.js";
import { TERRAIN } from "../game/rules.js";
import { createRng } from "../game/rng.js";

const TREES_PER_TILE = [2, 3];
const TREE_JITTER = 0.3;
const noRaycast = () => {};

/**
 * Forest trees (instanced) and mountain cones for every terrain tile.
 * Purely decorative: props never answer raycasts, so picking stays on tiles.
 * Uses its own RNG stream so the look never touches the game's dice.
 */
export function buildProps(terrain, size, seed = 0) {
  const rng = createRng((seed >>> 0) + 1);
  const group = new THREE.Group();
  group.name = "props";

  const forest = [];
  const mountains = [];
  terrain.forEach((row, y) =>
    row.forEach((code, x) => {
      if (code === TERRAIN.FOREST) forest.push({ x, y });
      else if (code === TERRAIN.MOUNTAIN) mountains.push({ x, y });
    }),
  );

  // trees: one instanced canopy and one instanced trunk
  const trees = [];
  for (const tile of forest) {
    const n = rng.int(TREES_PER_TILE[0], TREES_PER_TILE[1]);
    const p = tileToWorld(tile.x, tile.y, size);
    for (let i = 0; i < n; i++) {
      trees.push({
        x: p.x + rng.float(-TREE_JITTER, TREE_JITTER),
        z: p.z + rng.float(-TREE_JITTER, TREE_JITTER),
        s: rng.float(0.8, 1.2),
      });
    }
  }
  if (trees.length) {
    const canopy = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.11, 0.32, 6),
      matte(0x2f6b34, { flat: true }),
      trees.length,
    );
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.03, 0.035, 0.12, 6),
      matte(0x4a3320),
      trees.length,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    trees.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, 0.28 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      canopy.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, 0.06 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      trunk.setMatrixAt(i, m);
    });
    for (const mesh of [canopy, trunk]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.raycast = noRaycast;
      group.add(mesh);
    }
  }

  // mountains: a flat-shaded grey cone with a pale cap
  const rock = matte(0x6f6b64, { flat: true, roughness: 1 });
  const snow = matte(0xd8d4cc, { flat: true });
  const rockGeo = new THREE.ConeGeometry(0.42, 0.55, 5);
  const capGeo = new THREE.ConeGeometry(0.15, 0.2, 5);
  for (const tile of mountains) {
    const p = tileToWorld(tile.x, tile.y, size);
    const peak = new THREE.Group();
    const body = new THREE.Mesh(rockGeo, rock);
    body.position.y = 0.275;
    const cap = new THREE.Mesh(capGeo, snow);
    cap.position.y = 0.45;
    for (const mesh of [body, cap]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.raycast = noRaycast;
      peak.add(mesh);
    }
    peak.position.set(p.x, 0, p.z);
    peak.rotation.y = rng.float(0, Math.PI * 2);
    group.add(peak);
  }

  return group;
}
