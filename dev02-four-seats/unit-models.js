// BC01 三兵種的原創程序模型（+z 為車頭／頭部方向）。陸戰隊沿用原突擊機剪影；重騎兵為四足重型機，飛螳為展翼飛行體。
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { droneGeometries } from '../dev05-layout/world.js';
import { detailDrone, armor, edged, hex, oct } from './detail-models.js';

const box = (w, h, d, x, y, z, rz = 0, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateZ(rz).rotateY(ry).translate(x, y, z);
const cone = (r, h, n, x, y, z) => new THREE.ConeGeometry(r, h, n).rotateX(Math.PI / 2).translate(x, y, z);
const tube = (r1, r2, h, n, x, y, z) => new THREE.CylinderGeometry(r1, r2, h, n).translate(x, y, z);
const group = parts => mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
const wing = [[0, -.5], [1, -.15], [.82, .28], [.34, .12], [0, .5]];
const side = (outline, s) => s > 0 ? outline : outline.map(([u, v]) => [-u, v]).reverse();

function plainDragoon() {
  const dark = [box(.5, .22, .9, 0, 1.05, .75)];
  for (const x of [-1, 1]) for (const z of [-1, 1]) dark.push(box(.8, .18, .22, x * .72, .93, z * .52, -x * .5, x * z * -.45), box(.2, .9, .22, x * 1.05, .44, z * .72));
  return { hull: group([tube(.62, .82, .62, 8, 0, 1.2, 0)]), dark: group(dark), lamp: group([new THREE.OctahedronGeometry(.27).translate(0, 1.12, 1.25)]) };
}
function highDragoon() {
  const hull = [armor(oct, 0, .98, -.05, .86, .98, .42, .08), armor(hex, 0, 1.48, -.18, .74, .82, .16, .05)];
  const dark = [box(.46, .20, .82, 0, 1.12, .80), armor(hex, 0, .82, 0, .9, 1.1, .16, .04)];
  const lamp = [new THREE.IcosahedronGeometry(.28, 1).translate(0, 1.14, 1.28), box(.5, .06, .12, 0, 1.72, .1)];
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      dark.push(box(.8, .17, .2, x * .74, .94, z * .54, -x * .5, x * z * -.45), tube(.15, .15, .2, 8, x * 1.04, .86, z * .72), tube(.11, .22, .12, 8, x * 1.1, .08, z * .76));
      hull.push(armor(hex, x * 1.07, .26, z * .74, .3, .36, .46, .035));
    }
    dark.push(box(.1, .1, .66, x * .34, 1.12, .98));
  }
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}
function plainMutalisk() {
  const hull = [-1, 1].map(s => armor(side(wing, s), s * .2, .5, 0, 1.45, 1.25, .06, .015));
  return { hull: group(hull), dark: group([cone(.32, 1.1, 8, 0, .52, .35), box(.16, .16, .9, 0, .46, -.65)]), lamp: group([box(.32, .08, .1, 0, .66, .5)]) };
}
function highMutalisk() {
  const hull = [], dark = [cone(.30, 1.0, 10, 0, .52, .48), armor(hex, 0, .38, -.08, .52, .72, .2, .06)];
  const lamp = [box(.09, .09, .12, -.12, .68, .56), box(.09, .09, .12, .12, .68, .56)];
  for (const s of [-1, 1]) {
    hull.push(armor(side(wing, s), s * .22, .52, .02, 1.5, 1.28, .05, .02), armor(side(wing, s), s * .24, .62, -.06, .86, .70, .04, .02));
    dark.push(box(1.35, .08, .1, s * .9, .64, -.12, 0, s * .27), cone(.07, .5, 6, s * .18, .45, 1.02));
    lamp.push(box(.1, .05, .1, s * 1.55, .62, -.18));
  }
  for (let i = 0; i < 3; i++) dark.push(armor(hex, 0, .42 + i * .02, -.55 - i * .27, .24 - i * .05, .26, .12, .025));
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}

export const unitModels = {
  std: { marine: droneGeometries, dragoon: plainDragoon, mutalisk: plainMutalisk },
  high: { marine: detailDrone, dragoon: highDragoon, mutalisk: highMutalisk },
};
export const FLY_HEIGHT = 1.7;
