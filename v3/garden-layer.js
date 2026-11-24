import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from './DRACOLoader.local.js';

// These values are replaced by build.py. The final HTML has no network dependencies.
const TREE_GLB = '__TREE_GLB__';
const BARREL_GLB = '__BARREL_GLB__';
const DRACO_JS = '__DRACO_JS__';
const DRACO_WASM = '__DRACO_WASM__';

function bytes(base64) {
  const data = atob(base64);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) result[i] = data.charCodeAt(i);
  return result.buffer;
}

function mark(message) {
  const node = document.getElementById('garden-state');
  if (node) node.textContent = message;
}

async function start() {
  const host = document.getElementById('arena');
  if (!host) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    mark('3D 場景不可用，遊戲仍可正常操作');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(760, 520, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.id = 'garden-layer';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const toggle = document.getElementById('toggle-garden');
  if (toggle) toggle.onclick = () => {
    const visible = renderer.domElement.style.display !== 'none';
    renderer.domElement.style.display = visible ? 'none' : 'block';
    toggle.textContent = visible ? '顯示 3D 場景' : '隱藏 3D 場景';
    toggle.setAttribute('aria-pressed', String(!visible));
    if (!visible) renderer.render(scene, camera);
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-380, 380, 260, -260, 0.1, 1000);
  camera.position.set(0, 0, 400);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xeaf9ff, 0x69615a, 2.1));
  const sun = new THREE.DirectionalLight(0xffe4ba, 2.3);
  sun.position.set(-110, 190, 260);
  scene.add(sun);

  const draco = new DRACOLoader();
  draco._loadLibrary = (file) => Promise.resolve(file.endsWith('.wasm') ? bytes(DRACO_WASM) : atob(DRACO_JS));
  draco.setWorkerLimit(1);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const parse = (base64) => new Promise((resolve, reject) => loader.parse(bytes(base64), '', resolve, reject));
  const [tree, barrel] = await Promise.all([parse(TREE_GLB), parse(BARREL_GLB)]);

  function add(model, x, y, height, rotation = 0) {
    const root = model.scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(root);
    wrapper.scale.setScalar(height / Math.max(size.y, 0.001));
    wrapper.rotation.y = rotation;
    wrapper.position.set(x - 380, 260 - y, 1);
    scene.add(wrapper);
  }
  // Positions deliberately avoid the travel lane, bases, and purchase hit areas.
  add(tree, 94, 82, 78, 0.25);
  add(tree, 660, 82, 78, -0.35);
  add(barrel, 203, 473, 39, 0.45);
  add(barrel, 557, 473, 39, -0.6);
  renderer.render(scene, camera);
  mark('3D Garden：場景樹與木桶已載入');
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderer.render(scene, camera);
  });
}

start().catch((error) => {
  mark('3D 場景載入失敗，遊戲仍可正常操作');
  console.error('3D Garden scene:', error);
});
