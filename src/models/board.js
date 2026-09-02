import * as THREE from "three";
import { matte } from "./parts.js";
import { TERRAIN } from "../game/rules.js";
import { buildProps } from "./props.js";

export const SPACING = 1;

/** World position of the centre of board tile {x, y} (x east, y south). */
export function tileToWorld(x, y, size) {
  const half = (size - 1) / 2;
  return new THREE.Vector3((x - half) * SPACING, 0, (y - half) * SPACING);
}

/** Two checker shades per terrain so the grid still reads under forests and mountains. */
const SHADES = {
  [TERRAIN.PLAIN]: [0xa39c80, 0x5c584a],
  [TERRAIN.FOREST]: [0x4f7f3f, 0x35592c],
  [TERRAIN.MOUNTAIN]: [0x7d7972, 0x59554f],
};

/**
 * An N×N checkered board with a dark border, grid lines, and terrain props.
 * `terrain[y][x]` holds terrain codes; omit it for a plain board.
 * group.userData.tiles lists the tile meshes for raycasting (each carries
 * userData.tile = {x, y} and userData.terrain); group.userData.dispose()
 * frees everything.
 */
export function board(size = 8, terrain = null, seed = 0) {
  const group = new THREE.Group();
  group.name = "board";
  group.userData.tiles = [];

  const materials = {};
  for (const [code, [light, dark]] of Object.entries(SHADES)) {
    materials[code] = [matte(light, { roughness: 0.95 }), matte(dark, { roughness: 0.95 })];
  }
  const tileGeo = new THREE.BoxGeometry(SPACING * 0.98, 0.08, SPACING * 0.98);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const code = terrain?.[y]?.[x] ?? TERRAIN.PLAIN;
      const tile = new THREE.Mesh(tileGeo, materials[code][(x + y) % 2]);
      tile.receiveShadow = true;
      const p = tileToWorld(x, y, size);
      tile.position.set(p.x, -0.04, p.z);
      tile.userData.tile = { x, y };
      tile.userData.terrain = code;
      group.add(tile);
      group.userData.tiles.push(tile);
    }
  }

  // stone frame around the board
  const frameMat = matte(0x2b2924, { roughness: 1 });
  const outer = size * SPACING + 0.5;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(outer, 0.12, outer), frameMat);
  frame.position.y = -0.1;
  frame.receiveShadow = true;
  group.add(frame);

  // grid lines drawn just above the tiles
  const pts = [];
  const half = (size * SPACING) / 2;
  for (let i = 0; i <= size; i++) {
    const v = -half + i * SPACING;
    pts.push(-half, 0.005, v, half, 0.005, v);
    pts.push(v, 0.005, -half, v, 0.005, half);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x1a1915 }));
  group.add(lines);

  if (terrain) group.add(buildProps(terrain, size, seed));

  group.userData.dispose = () => {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  };

  return group;
}
