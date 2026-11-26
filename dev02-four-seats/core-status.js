// 主城血量數字與依本體血量顯示的損壞外觀。只加呈現物件、只讀模擬狀態；不扣血、不影響判定。
// 階段門檻 75／50／25% 為暫定：原版沒有查到各建築通用的視覺百分比（見 ../research/BC-SURFACE-HUD.md）。
import * as THREE from 'three';
import * as L from '../dev05-layout/layout.mjs';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import * as W from '../dev05-layout/world.js';
import { corePos } from './arena.mjs';

export const STAGE_AT = [.75, .5, .25];
export const STAGE_NAMES = ['完好', '輕損', '重損', '危急'];
export const coreStage = (hp, max) => STAGE_AT.filter(at => hp <= max * at).length;

let seed = 41;
const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
const flat = (color, more = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...more });

export function createCoreStatus(max) {
  const geo = { scar: new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2), chunk: new THREE.TetrahedronGeometry(.5), flame: new THREE.ConeGeometry(.5, 1.6, 7).translate(0, .8, 0), puff: new THREE.IcosahedronGeometry(.6, 1), spark: new THREE.OctahedronGeometry(.16), breach: new THREE.BoxGeometry(1.1, 1.5, .24) };
  const scorch = flat(0x07080a, { transparent: true, opacity: .88, depthWrite: false }), metal = new THREE.MeshStandardMaterial({ color: 0x17191b, metalness: .5, roughness: .8 });
  const outer = flat(0xff6a1a, { transparent: true, opacity: .88, depthWrite: false }), inner = flat(0xffd65a), ember = flat(0xff8a2a), spark = flat(0xfff1b0);
  const cores = L.SEATS.map((s, index) => {
    const [x, z] = corePos(s.id), root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = L.seatYaw(s.id); W.scene.add(root);
    const layers = [1, 2, 3].map(() => { const g = new THREE.Group(); g.visible = false; root.add(g); return g; }), flames = [], puffs = [], sparks = [];
    const mesh = (stage, g, m, px, py, pz) => { const o = new THREE.Mesh(g, m); o.position.set(px, py, pz); layers[stage - 1].add(o); return o; };
    // 各階段累加：外殼裂口與焦痕 → 掉落碎片與起火 → 大火與濃煙。角度以席位本地座標配置
    const around = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
    for (const stage of [1, 2, 3]) for (let i = 0; i < 5; i++) {
      const a = i * 1.2566 + stage * .8, [px, pz] = around(a, 2.5 + rnd() * 1.1), o = mesh(stage, geo.scar, scorch, px, 2.04 + stage * .006, pz); o.scale.set(.45 + rnd() * .55, 1, .3 + rnd() * .45); o.rotation.y = rnd() * 6;
      const [bx, bz] = around(a + .3, 2.3), b = mesh(stage, geo.breach, metal, bx, 2.5 + rnd() * 3, bz); b.rotation.set(rnd() * .5, Math.PI / 2 - a - .3, rnd() - .5); b.scale.setScalar(.7 + stage * .22);
      if (stage > 1) { const [cx, cz] = around(a - .4, 3.7 + rnd() * .25), c = mesh(stage, geo.chunk, metal, cx, 1.3, cz); c.rotation.set(rnd() * 3, rnd() * 3, 0); c.scale.setScalar(.6 + rnd() * .5); } // 地面高度的物件留在核心本體半徑內，不蓋住攻城部隊
    }
    const fire = (stage, a, r, y, size) => { const [px, pz] = around(a, r), g = new THREE.Group(); g.position.set(px, y, pz); const o = new THREE.Mesh(geo.flame, outer), i = new THREE.Mesh(geo.flame, inner); i.scale.set(.55, .62, .55); i.renderOrder = 2; g.add(o, i); layers[stage - 1].add(g); flames.push({ g, size, phase: rnd() * 6 }); };
    const smoke = (stage, a, r, y, size, shade, n) => { const [px, pz] = around(a, r); for (let i = 0; i < n; i++) { const o = mesh(stage, geo.puff, flat(shade, { transparent: true, opacity: .5, depthWrite: false }), px, y, pz); puffs.push({ o, x: px, y, z: pz, size, phase: i / n + rnd() * .1 }); } };
    for (let i = 0; i < 6; i++) { const [px, pz] = around(i * 1.05 + .4, 2.5); sparks.push({ o: mesh(1, geo.spark, spark, px, 2.8 + (i % 3) * 1.1, pz), phase: i * 2.1 }); }
    for (const [px, pz, q] of [[-.7, .35, .75], [.55, -.6, .6], [.5, .75, .45]]) { const o = mesh(1, geo.scar, scorch, px, 7.49, pz); o.scale.setScalar(q); o.rotation.y = q * 9; } // 塔頂焦痕
    for (const a of [.6, 2.7, 4.8]) smoke(1, a, 2.6, 7.2, 1.2, 0x5d666d, 5); // 輕損：三道灰煙
    for (const a of [.2, 2.3, 4.4]) { fire(2, a, 3.2, 2.1, 1.5); smoke(2, a, 3.2, 4, 1.2, 0x565d63, 4); } // 重損：三方向起火
    for (const a of [1.25, 3.35, 5.45]) { fire(3, a, 3.3, 2.1, 2.5); fire(3, a + .35, 3.8, 1.05, 1.4); }
    fire(3, 0, 0, 8.4, 2.8); smoke(3, 1.5, .6, 9.5, 2.3, 0x1d2125, 9); // 危急：塔頂大火與濃煙
    for (let i = 0; i < 8; i++) { const [px, pz] = around(i * .785, 4.3), o = mesh(3, geo.spark, ember, px, 1.2, pz); o.scale.setScalar(1.3); }
    for (const layer of layers) for (const material of [scorch, metal, ember]) { // 靜態件按層與材質合批
      const parts = layer.children.filter(o => o.material === material); if (!parts.length) continue;
      const merged = mergeGeometries(parts.map(o => { o.updateMatrix(); const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); return g.applyMatrix4(o.matrix); }));
      layer.remove(...parts); layer.add(new THREE.Mesh(merged, material));
    }
    const tag = W.label(240, 100, () => {}); tag.visible = false; tag.name = `core-hp-${s.id}`; W.scene.add(tag);
    return { id: s.id, index, root, layers, flames, puffs, sparks, tag, anchor: new THREE.Vector3(x, 10.2, z), stage: 0, text: '' };
  });
  const right = new THREE.Vector3();
  function write(c, text, color) {
    const map = c.tag.material.map, g = map.image.getContext('2d'); g.clearRect(0, 0, 240, 100);
    g.fillStyle = 'rgba(7,11,15,.86)'; g.beginPath(); g.roundRect(3, 3, 234, 94, 16); g.fill(); g.lineWidth = 6; g.strokeStyle = color; g.stroke();
    g.fillStyle = '#fff'; g.font = `800 66px ${W.FONT}`; g.fillText(text, 120, 54); map.needsUpdate = true; c.text = text;
  }
  return {
    // t 為模擬 tick（含插值），暫停時動畫一起停住
    update(state, t, camera, showTags, compact, colorOf) {
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      for (const c of cores) {
        const v = state?.seats[c.id]; c.stage = v ? coreStage(v.hp, max) : 0;
        c.layers.forEach((g, i) => { g.visible = c.stage > i; });
        c.tag.visible = !!(showTags && v?.alive);
        if (c.tag.visible) {
          const text = String(Math.ceil(v.hp)), color = colorOf(c.id), k = compact ? 1.4 : 1;
          if (text !== c.text || color !== c.color) { write(c, text, color); c.color = color; }
          c.tag.scale.set(3.1 * k, 1.3 * k, 1); c.tag.position.copy(c.anchor).addScaledVector(right, 3.2 + 1.65 * k);
        }
        if (!c.stage) continue;
        const s = t / 30;
        for (const f of c.flames) { const w = Math.sin(s * 11 + f.phase) * .16 + Math.sin(s * 23 + f.phase * 3) * .09; f.g.scale.set(f.size * (1 - w * .4), f.size * (1 + w), f.size * (1 - w * .4)); f.g.rotation.y = s * 2 + f.phase; }
        for (const p of c.puffs) { const q = (s * .28 + p.phase) % 1; p.o.position.set(p.x + q * q * 2.2, p.y + q * 5, p.z + Math.sin(q * 6 + p.phase * 9) * .4); p.o.scale.setScalar(p.size * (.45 + q * 1.2)); p.o.material.opacity = .78 * (1 - q) * Math.min(1, q * 6); }
        for (const p of c.sparks) p.o.scale.setScalar(Math.max(0, Math.sin(s * 9 + p.phase * 4)) * 1.8);
      }
    },
    // 離地 2 以下的損壞物件距核心中心的最大水平距離（供核對不伸進部隊站位）
    reach() {
      const p = new THREE.Vector3(); let far = 0;
      for (const c of cores) { c.root.updateMatrixWorld(true); for (const layer of c.layers) layer.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { p.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); if (p.y < 2) far = Math.max(far, Math.hypot(p.x - c.root.position.x, p.z - c.root.position.z)); } }); }
      return far;
    },
    info: () => Object.fromEntries(cores.map(c => [c.id, { stage: c.stage, layers: c.layers.filter(g => g.visible).length, label: c.tag.visible ? c.text : null }])),
  };
}
