import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SPACING } from "./models/board.js";

// view-only numbers; everything scales from the board size so an 8×8 looks like it always did
const CAMERA_DIRECTION = new THREE.Vector3(6, 5.5, 8).normalize();
const TARGET = new THREE.Vector3(0, 0.3, 0);
const FIT_MARGIN = 1.15;
const TURN_STEP = Math.PI / 4;
const TURN_SPEED = 3.0; // radians per second while stepping
const AUTO_SPEED = 0.25; // radians per second when auto-rotating
const ZOOM_EASE = 8; // per second
const ZOOM_IN = 0.8;
const ZOOM_OUT = 1.25;

/**
 * Renderer, camera, lights, bloom, orbit controls. Sized from its container
 * and scaled from the board size. Returns
 * { scene, camera, renderer, controls, render, resize, fit, zoomBy, zoomIn,
 *   zoomOut, rotateBy, setAutoRotate, autoRotating, update }.
 */
export function createStage(container, { size = 8 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d14);
  scene.fog = new THREE.Fog(0x0b0d14, 14, 30);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.target.copy(TARGET);

  // lighting: cool sky, warm key sun, faint rim from the far side
  scene.add(new THREE.HemisphereLight(0x8fa4c8, 0x3a3220, 0.9));
  const sun = new THREE.DirectionalLight(0xffe0b8, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6a7fd0, 0.6);
  rim.position.set(-6, 4, -6);
  scene.add(rim);

  // ground far below the board, so shadows and fog have somewhere to land
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0x141720, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.17;
  ground.receiveShadow = true;
  scene.add(ground);

  // bloom with a high threshold so only emissive parts glow
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.8);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let boardSize = size;
  let zoomTarget = null; // desired camera distance while easing, else null
  let userZoomed = false; // once the player zooms, resizing stops refitting
  let turnRemaining = 0;
  let autoRotate = false;

  /** Fog, shadows, sun and zoom limits as functions of the board size. */
  function applySize(n) {
    boardSize = n;
    controls.minDistance = n * 0.5;
    controls.maxDistance = n * 2.75;
    scene.fog.near = n * 1.75;
    scene.fog.far = n * 3.75;
    const half = n / 2 + 3;
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = n * 4;
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(5, 9, 4).multiplyScalar(n / 8);
    ground.scale.setScalar(n * 6);
  }

  function distance() {
    return camera.position.distanceTo(controls.target);
  }

  function setDistance(d) {
    const offset = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(offset, d);
  }

  /** Pull the camera back far enough that the whole board fits, whatever the aspect. */
  function fit(n = boardSize) {
    if (n !== boardSize) applySize(n);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const extent = (n * SPACING) / 2 + 1.5;
    const vertical = extent / Math.tan(fov / 2);
    const horizontal = extent / (Math.tan(fov / 2) * camera.aspect);
    const d = THREE.MathUtils.clamp(Math.max(vertical, horizontal) * FIT_MARGIN, controls.minDistance, controls.maxDistance);
    controls.target.copy(TARGET);
    camera.position.copy(TARGET).addScaledVector(CAMERA_DIRECTION, d);
    zoomTarget = null;
    userZoomed = false;
    controls.update();
    console.log(`🔮 camera fit to ${n}×${n} at distance ${d.toFixed(1)}`);
  }

  function zoomBy(factor) {
    const base = zoomTarget ?? distance();
    zoomTarget = THREE.MathUtils.clamp(base * factor, controls.minDistance, controls.maxDistance);
    userZoomed = true;
  }

  function rotateView(angle) {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    camera.position.copy(controls.target).add(offset);
  }

  function rotateBy(direction) {
    turnRemaining += direction * TURN_STEP;
    console.log(`🔮 rotate ${direction > 0 ? "right" : "left"}`);
  }

  function setAutoRotate(on) {
    autoRotate = on;
    console.log(`🔮 auto rotate ${autoRotate ? "on" : "off"}`);
  }

  /** Advance smooth rotation and zoom; call once per frame. */
  function update(dt) {
    if (turnRemaining !== 0) {
      const step = Math.sign(turnRemaining) * Math.min(Math.abs(turnRemaining), TURN_SPEED * dt);
      rotateView(step);
      turnRemaining -= step;
    } else if (autoRotate) {
      rotateView(AUTO_SPEED * dt);
    }
    if (zoomTarget !== null) {
      const d = distance();
      let next = d + (zoomTarget - d) * Math.min(1, dt * ZOOM_EASE);
      if (Math.abs(next - zoomTarget) < 0.01) {
        next = zoomTarget;
        zoomTarget = null;
      }
      setDistance(next);
    }
  }

  renderer.domElement.addEventListener("wheel", () => { userZoomed = true; }, { passive: true });

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    if (!userZoomed) fit();
  }
  new ResizeObserver(resize).observe(container);
  applySize(size);
  resize();

  function render() {
    controls.update();
    composer.render();
  }

  console.log("🔮 stage ready");
  return {
    scene,
    camera,
    renderer,
    controls,
    render,
    resize,
    fit,
    zoomBy,
    zoomIn: () => zoomBy(ZOOM_IN),
    zoomOut: () => zoomBy(ZOOM_OUT),
    rotateBy,
    setAutoRotate,
    autoRotating: () => autoRotate,
    update,
  };
}
