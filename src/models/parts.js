import * as THREE from "three";

/** Matte surface: skin, cloth, stone. */
export function matte(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.0,
    flatShading: opts.flat ?? false,
  });
}

/** Shiny surface: blades, armour, scales. */
export function metal(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.35,
    metalness: opts.metalness ?? 0.8,
  });
}

/** Emissive surface that bloom picks up: eyes, orbs, runes. */
export function glow(color, intensity = 2) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });
}

/** A mesh that casts and receives shadows; saves repeating two lines everywhere. */
export function mesh(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A box stretched between two points: necks, spines, staffs, limbs. */
export function strut(from, to, thickness, material) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const geo = new THREE.BoxGeometry(thickness, thickness, length);
  const m = mesh(geo, material);
  m.position.copy(a).lerp(b, 0.5);
  m.lookAt(b);
  return m;
}

/** A tapered cylinder between two points: tails, limbs, horns. */
export function taper(from, to, r1, r2, material, segments = 8) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r2, r1, length, segments);
  geo.rotateX(Math.PI / 2); // cylinder along +Z so lookAt works
  const m = mesh(geo, material);
  m.position.copy(a).lerp(b, 0.5);
  m.lookAt(b);
  return m;
}

export function sphere(radius, material, x = 0, y = 0, z = 0, w = 12, h = 8) {
  const m = mesh(new THREE.SphereGeometry(radius, w, h), material);
  m.position.set(x, y, z);
  return m;
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

export function cone(radius, height, material, x = 0, y = 0, z = 0, segments = 10) {
  const m = mesh(new THREE.ConeGeometry(radius, height, segments), material);
  m.position.set(x, y, z);
  return m;
}

export function cylinder(rTop, rBottom, height, material, x = 0, y = 0, z = 0, segments = 12) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBottom, height, segments), material);
  m.position.set(x, y, z);
  return m;
}

/** A named empty node, used as a launch point or a pivot. */
export function node(name, x = 0, y = 0, z = 0) {
  const n = new THREE.Object3D();
  n.name = name;
  n.position.set(x, y, z);
  return n;
}
