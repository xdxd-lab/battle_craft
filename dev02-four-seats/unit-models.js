// BC01 三兵種的原創程序模型（+z 為車頭／頭部方向）。陸戰隊為太空裝甲人形步兵；重騎兵為四足重型機，飛螳為展翼飛行體。
// 部件鍵：材質[:L|:R]。帶 L／R 的是翅膀，呈現層繞翅根拍動；標準與高細節的鍵必須一致。
import * as THREE from 'three';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { armor, edged, hex, oct } from './detail-models.js';

const box = (w, h, d, x, y, z, rz = 0, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateZ(rz).rotateY(ry).translate(x, y, z);
const cone = (r, h, n, x, y, z) => new THREE.ConeGeometry(r, h, n).rotateX(Math.PI / 2).translate(x, y, z);
const tube = (r1, r2, h, n, x, y, z) => new THREE.CylinderGeometry(r1, r2, h, n).translate(x, y, z);
const group = parts => mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g));
const wing = [[0, -.5], [1, -.15], [.82, .28], [.34, .12], [0, .5]];
const side = (outline, s) => s > 0 ? outline : outline.map(([u, v]) => [-u, v]).reverse();

// 陸戰隊：分腿站姿、梯形胸甲、背包與天線、單側加大肩甲、橫持步槍
function plainMarine() {
  const hull = [box(.66, .52, .44, 0, 1.12, 0), box(.38, .34, .38, 0, 1.58, .02), box(.34, .22, .46, -.52, 1.36, 0, .22), box(.26, .18, .38, .5, 1.34, 0, -.22)];
  const dark = [box(.46, .22, .32, 0, .76, 0), box(.5, .5, .22, 0, 1.14, -.33), box(.04, .42, .04, -.18, 1.58, -.38), box(.14, .16, .92, .2, 1.0, .5)];
  for (const s of [-1, 1]) dark.push(box(.22, .62, .26, s * .22, .36, 0, s * .08), box(.28, .14, .46, s * .26, .07, .08), box(.16, .46, .18, s * .46, 1.06, .1, s * .12));
  return { hull: group(hull), dark: group(dark), lamp: group([box(.3, .09, .05, 0, 1.6, .22), box(.1, .1, .05, -.17, 1.24, .235)]) };
}
function highMarine() {
  const hull = [armor(oct, 0, .90, 0, .46, .38, .46, .04), armor(oct, 0, 1.45, .01, .27, .30, .26, .06),
    armor(hex, -.52, 1.28, 0, .36, .66, .18, .045), armor(hex, .50, 1.28, 0, .28, .54, .14, .035)];
  const dark = [armor(hex, 0, .66, 0, .42, .44, .20, .035), armor(hex, 0, .88, -.33, .46, .30, .50, .035),
    tube(.018, .018, .46, 6, -.2, 1.56, -.38), tube(.15, .18, .07, 10, 0, 1.41, 0),
    box(.13, .15, .62, .2, 1.0, .42), tube(.05, .05, .46, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(.2, 1.02, .92), box(.1, .2, .14, .2, .86, .34)];
  const lamp = [box(.34, .09, .05, 0, 1.60, .29), box(.11, .11, .04, -.17, 1.22, .325), box(.06, .2, .04, .14, 1.2, -.50), box(.04, .04, .2, .275, 1.04, .46)];
  for (const s of [-1, 1]) {
    hull.push(armor(hex, s * .23, .40, .03, .24, .42, .22, .035), armor(hex, s * .27, .12, .10, .28, .62, .13, .035), armor(hex, s * .47, .88, .12, .17, .30, .20, .025));
    dark.push(tube(.11, .13, .66, 10, s * .22, .40, 0), tube(.09, .09, .46, 10, s * .46, 1.10, .06), box(.15, .14, .34, s * .39, .98, .27, 0, -s * .5),
      tube(.1, .12, .18, 8, s * .14, .88, -.46));
  }
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}
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
// 翅膀拆成左右部件；翅根在 (±WING_HINGE[0], WING_HINGE[1])
export const WING_HINGE = [.22, .55];
const wings = (parts, make) => { for (const [s, tag] of [[-1, 'L'], [1, 'R']]) for (const [material, list] of Object.entries(make(s))) parts[`${material}:${tag}`] = list; return parts; };
const finish = (parts, shade) => Object.fromEntries(Object.entries(parts).map(([key, list]) => { const g = group(list); return [key, shade && !key.startsWith('lamp') ? edged(g) : g]; }));
function plainMutalisk() {
  return finish(wings({ hull: [cone(.32, 1.1, 8, 0, .52, .35)], dark: [box(.16, .16, .9, 0, .46, -.65)], lamp: [box(.32, .08, .1, 0, .66, .5)] },
    s => ({ hull: [armor(side(wing, s), s * .2, .5, 0, 1.45, 1.25, .06, .015)], dark: [box(1.2, .07, .09, s * .85, .6, -.1, 0, s * .27)], lamp: [box(.1, .05, .1, s * 1.5, .6, -.18)] })), false);
}
function highMutalisk() {
  const dark = [cone(.30, 1.0, 10, 0, .52, .48)];
  for (const s of [-1, 1]) dark.push(cone(.07, .5, 6, s * .18, .45, 1.02));
  for (let i = 0; i < 3; i++) dark.push(armor(hex, 0, .42 + i * .02, -.55 - i * .27, .24 - i * .05, .26, .12, .025));
  return finish(wings({ hull: [armor(hex, 0, .38, -.08, .52, .72, .2, .06)], dark, lamp: [box(.09, .09, .12, -.12, .68, .56), box(.09, .09, .12, .12, .68, .56)] },
    s => ({ hull: [armor(side(wing, s), s * .22, .52, .02, 1.5, 1.28, .05, .02), armor(side(wing, s), s * .24, .62, -.06, .86, .70, .04, .02)],
      dark: [box(1.35, .08, .1, s * .9, .64, -.12, 0, s * .27)], lamp: [box(.1, .05, .1, s * 1.55, .62, -.18)] })), true);
}

export const unitModels = {
  std: { marine: plainMarine, dragoon: plainDragoon, mutalisk: plainMutalisk },
  high: { marine: highMarine, dragoon: highDragoon, mutalisk: highMutalisk },
};
export const FLY_HEIGHT = 1.7;
