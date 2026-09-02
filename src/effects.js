import * as THREE from "three";

/**
 * Short-lived glows: a flash that swells and fades, and a bolt that flies
 * from a launch node to a point. Bright additive materials clear the bloom
 * threshold, so these are the only things that glow besides the models' runes.
 *
 *   const fx = createEffects(scene);
 *   fx.flash(worldPos, 0xffa53a, 0.35, 0.4);
 *   fx.bolt(staffTipNode, worldPos, 0x6fd0ff, 0.3);
 *   ...and fx.update(dt) every frame; fx.clear() on rebuild.
 */
export function createEffects(scene) {
  const live = [];
  const sphere = new THREE.SphereGeometry(1, 10, 8);

  function material(color, opacity = 0.9) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  function add(mesh, duration, apply) {
    scene.add(mesh);
    live.push({ mesh, duration, elapsed: 0, apply });
  }

  function flash(position, color = 0xffa53a, duration = 0.35, size = 0.4) {
    const mesh = new THREE.Mesh(sphere, material(color));
    mesh.position.copy(position);
    add(mesh, duration, (k) => {
      mesh.scale.setScalar(size * (0.2 + 0.8 * k));
      mesh.material.opacity = 0.9 * (1 - k);
    });
  }

  function bolt(fromObject, to, color = 0x6fd0ff, duration = 0.3, size = 0.09) {
    const from = new THREE.Vector3();
    fromObject.getWorldPosition(from);
    const mesh = new THREE.Mesh(sphere, material(color, 1));
    mesh.position.copy(from);
    mesh.scale.setScalar(size);
    const target = to.clone();
    add(mesh, duration, (k) => {
      mesh.position.lerpVectors(from, target, k);
      mesh.position.y += Math.sin(Math.PI * k) * 0.25;
    });
  }

  function remove(item) {
    scene.remove(item.mesh);
    item.mesh.material.dispose();
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const item = live[i];
      item.elapsed += dt;
      const k = Math.min(1, item.elapsed / item.duration);
      item.apply(k);
      if (k >= 1) {
        remove(item);
        live.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const item of live) remove(item);
    live.length = 0;
  }

  return { flash, bolt, update, clear };
}
