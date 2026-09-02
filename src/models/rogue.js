import * as THREE from "three";
import { matte, metal, glow, box, sphere, cone, node } from "./parts.js";
import { humanoid } from "./humanoid.js";

export function rogue() {
  const skin = matte(0xd9b28c);
  const leather = matte(0x2b2a33);
  const cloak = matte(0x3a1f3f);
  const steel = metal(0xc9ced6);

  const rig = humanoid({ skin, cloth: leather, height: 0.78, bulk: 0.9 });
  rig.name = "rogue";
  const { headY, headR, neckY } = rig.userData;

  // hood: a cone that swallows the top of the head
  const hood = cone(headR * 2.2, headR * 3.0, cloak, 0, headY + headR * 0.5, -0.02, 10);
  hood.rotation.x = 0.15;
  rig.add(hood);
  // eyes gleam in the shadow of the hood
  for (const side of [-1, 1]) {
    rig.add(sphere(0.011, glow(0xa8ff9a, 1.6), side * 0.03, headY + 0.005, headR * 0.9, 6, 4));
  }

  // cloak as a flat wedge hanging off the shoulders
  const cape = new THREE.Shape();
  cape.moveTo(-0.14, 0);
  cape.lineTo(0.14, 0);
  cape.lineTo(0.2, -0.45);
  cape.lineTo(-0.2, -0.45);
  cape.closePath();
  const capeGeo = new THREE.ExtrudeGeometry(cape, { depth: 0.015, bevelEnabled: false });
  const capeMesh = new THREE.Mesh(capeGeo, cloak);
  capeMesh.castShadow = true;
  capeMesh.position.set(0, neckY, -0.09);
  capeMesh.rotation.x = 0.18;
  rig.add(capeMesh);

  // belt and bandolier
  rig.add(box(0.26, 0.03, 0.17, matte(0x6b4b2a), 0, 0.33, 0));

  // twin daggers
  for (const side of [-1, 1]) {
    const hand = rig.getObjectByName(side < 0 ? "hand-left" : "hand-right");
    const dagger = new THREE.Group();
    dagger.add(box(0.02, 0.06, 0.02, matte(0x3b2a1a), 0, 0, 0));
    const blade = cone(0.012, 0.16, steel, 0, 0.1, 0, 4);
    dagger.add(blade);
    dagger.rotation.x = side < 0 ? -1.9 : -1.4;
    dagger.rotation.z = side * 0.2;
    hand.add(dagger);
  }
  rig.getObjectByName("arm-left").rotation.x = -0.9;
  rig.getObjectByName("arm-right").rotation.x = -0.5;

  // a slight crouch reads as "sneaky"
  rig.rotation.x = 0.08;
  rig.add(node("dagger-tip", 0.16, 0.6, 0.2));

  return rig;
}
