import * as THREE from "three";
import { matte, metal, glow, box, sphere, cone, cylinder } from "./parts.js";
import { humanoid } from "./humanoid.js";

export function orc() {
  const skin = matte(0x4f7a2e);
  const hide = matte(0x5a3a22);
  const iron = metal(0x6d6d70);

  const rig = humanoid({ skin, cloth: skin, height: 0.9, bulk: 1.35 });
  rig.name = "orc";
  const { headY, headR, neckY } = rig.userData;

  // loincloth over the hips
  rig.add(box(0.36, 0.14, 0.24, hide, 0, 0.36, 0));

  // one spiked pauldron, because orcs
  const pauldron = sphere(0.1, iron, -0.2, neckY - 0.01, 0, 8, 6);
  pauldron.scale.set(1, 0.6, 1);
  rig.add(pauldron);
  rig.add(cone(0.025, 0.09, iron, -0.2, neckY + 0.08, 0, 6));

  // tusks and glowing eyes
  for (const side of [-1, 1]) {
    const tusk = cone(0.014, 0.06, matte(0xf1e9c9), side * 0.045, headY - headR * 0.35, headR * 0.85, 5);
    tusk.rotation.x = -0.35;
    rig.add(tusk);
    rig.add(sphere(0.016, glow(0xffb020, 2), side * 0.045, headY + 0.02, headR * 0.9, 6, 4));
  }
  // heavy brow
  rig.add(box(0.16, 0.03, 0.06, skin, 0, headY + 0.045, headR * 0.8));

  // club in the right hand
  const hand = rig.getObjectByName("hand-right");
  const club = new THREE.Group();
  club.add(cylinder(0.02, 0.026, 0.42, hide, 0, 0.12, 0, 8));
  club.add(cylinder(0.06, 0.04, 0.18, hide, 0, 0.38, 0, 8));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = cone(0.012, 0.05, iron, Math.cos(a) * 0.06, 0.38, Math.sin(a) * 0.06, 5);
    spike.lookAt(new THREE.Vector3(Math.cos(a) * 2, 0.38, Math.sin(a) * 2));
    spike.rotateX(Math.PI / 2);
    club.add(spike);
  }
  club.rotation.x = -0.5;
  hand.add(club);

  return rig;
}
