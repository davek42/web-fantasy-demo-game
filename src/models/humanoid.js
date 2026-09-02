import * as THREE from "three";
import { box, sphere, taper, node } from "./parts.js";

/**
 * A stubby, board-game-scale humanoid. Faces +Z.
 * Returns a group with named children so a character can dress it up:
 *   torso, head, arm-left, arm-right, leg-left, leg-right, hand-left, hand-right
 * Limbs are pivot groups hinged at the shoulder / hip.
 */
export function humanoid({ skin, cloth, height = 0.8, bulk = 1 } = {}) {
  const rig = new THREE.Group();
  const H = height;
  const legH = H * 0.4;
  const torsoH = H * 0.35;
  const headR = H * 0.13;
  const torsoW = H * 0.32 * bulk;
  const torsoD = H * 0.2 * bulk;

  // legs
  for (const side of [-1, 1]) {
    const hip = node(side < 0 ? "leg-left" : "leg-right", side * torsoW * 0.28, legH, 0);
    const leg = taper([0, 0, 0], [0, -legH, 0], H * 0.055 * bulk, H * 0.045 * bulk, cloth);
    hip.add(leg);
    // boot
    hip.add(box(H * 0.1 * bulk, H * 0.06, H * 0.15, cloth, 0, -legH + H * 0.03, H * 0.03));
    rig.add(hip);
  }

  // torso
  const torso = box(torsoW, torsoH, torsoD, cloth, 0, legH + torsoH / 2, 0);
  torso.name = "torso";
  rig.add(torso);

  // head
  const neckY = legH + torsoH;
  const head = sphere(headR, skin, 0, neckY + headR * 1.05, 0);
  head.name = "head";
  rig.add(head);

  // arms
  const armLen = H * 0.36;
  for (const side of [-1, 1]) {
    const shoulder = node(side < 0 ? "arm-left" : "arm-right", side * (torsoW / 2 + H * 0.03), neckY - H * 0.03, 0);
    const arm = taper([0, 0, 0], [0, -armLen, 0], H * 0.045 * bulk, H * 0.035 * bulk, cloth);
    shoulder.add(arm);
    const hand = sphere(H * 0.045, skin, 0, -armLen, 0, 8, 6);
    hand.name = side < 0 ? "hand-left" : "hand-right";
    shoulder.add(hand);
    rig.add(shoulder);
  }

  rig.userData.height = H;
  rig.userData.headY = neckY + headR * 1.05;
  rig.userData.headR = headR;
  rig.userData.neckY = neckY;
  return rig;
}
