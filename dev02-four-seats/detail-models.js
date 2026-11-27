// 高細節共用造型工具與指揮官模型（直立塔身與雙燈識別）。
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

export const hex = [[-.55, -.22], [0, -.38], [.55, -.22], [.55, .22], [0, .38], [-.55, .22]];
export const oct = [[-.50, -.65], [.50, -.65], [.78, -.34], [.78, .30], [.42, .70], [-.42, .70], [-.78, .30], [-.78, -.34]];
export function armor(outline, x, y, z, width, length, depth, bevel) {
  const s = new THREE.Shape();
  for (const [i, [u, v]] of outline.entries()) {
    if (i) s.lineTo(u * width, -v * length);
    else s.moveTo(u * width, -v * length);
  }
  s.closePath();
  return new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelSegments: 1, steps: 1,
    bevelSize: bevel, bevelThickness: bevel,
  }).rotateX(-Math.PI / 2).translate(x, y, z);
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const cylinder = (r1, r2, h, n, x, y, z) => new THREE.CylinderGeometry(r1, r2, h, n).translate(x, y, z);
const group = parts => mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));

// 依面法線寫入頂點色：倒角面提亮、側面壓暗，讓接縫與輪廓在遠鏡頭也看得見（不增加三角面）
export function edged(g) {
  g.computeVertexNormals(); const n = g.getAttribute('normal'), c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) { const y = Math.abs(n.getY(i)), v = y > .93 ? .9 : y > .2 ? 1.55 : .55; c.set([v, v, v], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
export function detailCommander() {
  const hull = [armor(oct, 0, .77, 0, .76, .61, .78, .075)];
  const dark = [armor(hex, 0, .17, 0, 1.37, 1.48, .22, .065),
    armor(hex, 0, .47, .03, 1.08, 1.24, .24, .055),
    armor(oct, 0, 1.89, .03, .52, .50, .34, .065)];
  for (const side of [-1, 1]) {
    hull.push(armor(hex, side * .53, 1.13, .02, .60, .85, .25, .045));
    dark.push(cylinder(.15, .20, .42, 8, side * .52, .82, .02));
  }
  const lamp = box(.57, .15, .10, 0, 2.04, .40);
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp };
}

export const triangles = geo => (geo.index?.count ?? geo.getAttribute('position').count) / 3;

// 高細節反光材質：沿用席位色與艙板貼圖，提高金屬感並啟用輪廓頂點色
export function detailMaterials(paint, dark) {
  const hull = paint.clone(); Object.assign(hull, { metalness: .5, roughness: .42, vertexColors: true });
  const frame = dark.clone(); Object.assign(frame, { metalness: .82, roughness: .34, vertexColors: true });
  return [hull, frame];
}
