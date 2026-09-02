import * as THREE from "three";
import { matte, metal, glow, cone, sphere, cylinder, node } from "./parts.js";
import { humanoid } from "./humanoid.js";

export function wizard() {
  const skin = matte(0xe8c9a5);
  const robe = matte(0x2c3f8f);
  const trim = metal(0xd8b25a, { roughness: 0.5 });
  const beardMat = matte(0xe9e6df);

  const rig = humanoid({ skin, cloth: robe, height: 0.85 });
  rig.name = "wizard";
  const { headY, headR, neckY } = rig.userData;

  // robe skirt hides the legs
  rig.add(cone(0.2, 0.42, robe, 0, 0.21, 0, 12));
  rig.add(cylinder(0.14, 0.15, 0.03, trim, 0, 0.42, 0, 12)); // belt

  // beard
  const beard = cone(0.06, 0.18, beardMat, 0, headY - headR - 0.05, headR * 0.55, 8);
  beard.rotation.x = Math.PI;
  beard.rotation.z = Math.PI;
  rig.add(beard);

  // pointy hat with a brim
  rig.add(cylinder(0.16, 0.16, 0.015, robe, 0, headY + headR * 0.75, 0, 16));
  const hat = cone(0.1, 0.32, robe, 0, headY + headR * 0.75 + 0.16, 0, 12);
  hat.rotation.z = 0.12;
  rig.add(hat);
  rig.add(sphere(0.02, glow(0xffd86b, 1.5), 0, headY + headR * 0.75 + 0.02, 0.16, 6, 4)); // hat pin

  // eyes
  for (const side of [-1, 1]) {
    rig.add(sphere(0.012, matte(0x222222), side * 0.035, headY + 0.01, headR * 0.92, 6, 4));
  }

  // staff with a glowing orb, held in the left hand
  const hand = rig.getObjectByName("hand-left");
  const staff = new THREE.Group();
  staff.add(cylinder(0.014, 0.018, 0.9, matte(0x5b3b1e), 0, 0.25, 0, 8));
  const tip = node("staff-tip", 0, 0.72, 0);
  tip.add(sphere(0.045, glow(0x6fd0ff, 3), 0, 0, 0, 12, 8));
  staff.add(tip);
  hand.add(staff);
  rig.getObjectByName("arm-left").rotation.x = -0.4;

  return rig;
}
