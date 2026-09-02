import * as THREE from "three";
import { matte, metal, glow, sphere, cone, taper, node, mesh } from "./parts.js";

/**
 * A crimson dragon built from primitives. Faces +Z.
 * Wings hinge on "wing-pivot" groups; userData carries rest/flap angles.
 * "dragon-maw" is a launch point for breath.
 */
export function dragon() {
  const scale = matte(0x9b1f1f, { roughness: 0.6 });
  const belly = matte(0xd9a15b);
  const horn = matte(0x2a1c14);
  const membrane = new THREE.MeshStandardMaterial({
    color: 0x5a0f0f,
    roughness: 0.9,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });

  const rig = new THREE.Group();
  rig.name = "dragon";

  // body: a squashed sphere, chest forward, low to the ground
  const bodyY = 0.42;
  const body = sphere(0.3, scale, 0, bodyY, 0, 14, 10);
  body.scale.set(1, 0.8, 1.5);
  rig.add(body);
  const bellyPlate = sphere(0.24, belly, 0, bodyY - 0.1, 0.05, 12, 8);
  bellyPlate.scale.set(0.85, 0.55, 1.4);
  rig.add(bellyPlate);

  // neck: three tapered segments curving up and forward
  const neckPts = [
    [0, bodyY + 0.1, 0.35],
    [0, bodyY + 0.3, 0.55],
    [0, bodyY + 0.5, 0.68],
    [0, bodyY + 0.62, 0.78],
  ];
  const neckR = [0.15, 0.12, 0.1, 0.09];
  for (let i = 0; i < neckPts.length - 1; i++) {
    rig.add(taper(neckPts[i], neckPts[i + 1], neckR[i], neckR[i + 1], scale));
    rig.add(sphere(neckR[i + 1], scale, ...neckPts[i + 1], 10, 8));
  }

  // head
  const headPos = new THREE.Vector3(0, bodyY + 0.66, 0.88);
  const head = sphere(0.12, scale, headPos.x, headPos.y, headPos.z, 12, 8);
  head.scale.set(1, 0.85, 1.1);
  rig.add(head);
  const snout = taper([0, headPos.y - 0.02, headPos.z + 0.05], [0, headPos.y - 0.06, headPos.z + 0.3], 0.09, 0.05, scale);
  rig.add(snout);
  const jaw = taper([0, headPos.y - 0.08, headPos.z + 0.04], [0, headPos.y - 0.1, headPos.z + 0.25], 0.06, 0.03, belly);
  rig.add(jaw);
  rig.add(node("dragon-maw", 0, headPos.y - 0.07, headPos.z + 0.3));

  // horns, eyes, nostril embers
  for (const side of [-1, 1]) {
    const h = cone(0.025, 0.2, horn, side * 0.07, headPos.y + 0.1, headPos.z - 0.06, 6);
    h.rotation.x = -0.8;
    h.rotation.z = side * -0.3;
    rig.add(h);
    rig.add(sphere(0.022, glow(0xffa53a, 2.5), side * 0.07, headPos.y + 0.03, headPos.z + 0.09, 6, 4));
  }

  // spine ridge
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const z = 0.35 - t * 0.85;
    const y = bodyY + 0.24 - Math.abs(t - 0.4) * 0.12;
    const spike = cone(0.03, 0.09, horn, 0, y, z, 5);
    spike.rotation.x = -0.3;
    rig.add(spike);
  }

  // tail: tapered segments trailing behind and curling sideways
  const tailPts = [
    [0, bodyY - 0.02, -0.4],
    [0.1, bodyY - 0.08, -0.75],
    [0.3, bodyY - 0.12, -1.0],
    [0.55, bodyY - 0.1, -1.1],
  ];
  const tailR = [0.14, 0.09, 0.05, 0.02];
  for (let i = 0; i < tailPts.length - 1; i++) {
    rig.add(taper(tailPts[i], tailPts[i + 1], tailR[i], tailR[i + 1], scale));
    if (i < tailPts.length - 2) rig.add(sphere(tailR[i + 1], scale, ...tailPts[i + 1], 8, 6));
  }
  const spade = cone(0.06, 0.16, horn, ...tailPts[3], 4);
  spade.lookAt(new THREE.Vector3(1.0, bodyY - 0.05, -1.2));
  spade.rotateX(Math.PI / 2);
  rig.add(spade);

  // legs: four stubby tapers with claw cones
  const legs = [
    [-0.24, 0.3],
    [0.24, 0.3],
    [-0.26, -0.22],
    [0.26, -0.22],
  ];
  for (const [x, z] of legs) {
    rig.add(taper([x * 0.8, bodyY - 0.1, z], [x, 0.06, z + 0.04], 0.09, 0.06, scale));
    rig.add(sphere(0.07, scale, x, 0.06, z + 0.06, 8, 6));
    for (let c = -1; c <= 1; c++) {
      const claw = cone(0.015, 0.06, horn, x + c * 0.035, 0.03, z + 0.13, 4);
      claw.rotation.x = Math.PI / 2;
      rig.add(claw);
    }
  }

  // wings: extruded shape on a pivot, mirrored for the port side.
  // Shape space: X = span (root → tip), Y = chord (+Y = leading edge).
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.55, 0.35);
  wingShape.lineTo(0.95, 0.3);
  wingShape.lineTo(0.75, 0.05);
  wingShape.lineTo(0.85, -0.25);
  wingShape.lineTo(0.45, -0.15);
  wingShape.lineTo(0.35, -0.4);
  wingShape.lineTo(0.05, -0.12);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.012, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2); // XY → XZ, shape +Y becomes world +Z (leading edge forward)

  for (const side of [-1, 1]) {
    const pivot = node("wing-pivot", side * 0.12, bodyY + 0.2, 0.05);
    pivot.userData.rest = 0.55;
    pivot.userData.flap = 0.35;
    const wing = new THREE.Group();
    wing.add(mesh(wingGeo, membrane));
    // bones along the leading edge and out to the fingers
    wing.add(taper([0, 0.01, 0], [0.55, 0.01, 0.35], 0.03, 0.02, scale));
    wing.add(taper([0.55, 0.01, 0.35], [0.95, 0.01, 0.3], 0.02, 0.012, scale));
    wing.add(taper([0.55, 0.01, 0.35], [0.85, 0.01, -0.25], 0.018, 0.01, scale));
    wing.add(taper([0.55, 0.01, 0.35], [0.35, 0.01, -0.4], 0.018, 0.01, scale));
    pivot.add(wing);
    pivot.scale.x = side; // mirror the whole wing for the port side
    pivot.rotation.z = side * pivot.userData.rest; // raise the wing tips
    rig.add(pivot);
  }

  return rig;
}
