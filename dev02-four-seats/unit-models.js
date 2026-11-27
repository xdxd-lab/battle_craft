// 六兵種的原創程序模型（+z 為車頭／頭部方向）。陸戰隊為太空裝甲人形步兵；重騎兵為四足重型機，飛螳為展翼飛行體；
// 刺蛇為直立節肢生物，破壞能為懸浮能量核心，死靈戰機為前掠翼雙尾撐戰機（版本 6 起）；戰鬥巡洋艦為楔狀主艦、斥候為三角翼長莢艙戰機、自殺蟲為短翼球狀生物彈頭（版本 7 起）。
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

// 刺蛇：盤捲尾節撐起前傾軀幹，背脊棘板、雙前肢刃、頭冠與發光眼縫
function plainHydralisk() {
  const hull = [tube(.42, .5, .3, 8, 0, .15, -.15), tube(.3, .4, .42, 8, 0, .5, -.05), tube(.24, .3, .4, 8, 0, .9, .08), cone(.2, .55, 6, 0, 1.22, .42)];
  const dark = [box(.62, .34, .1, 0, 1.25, .02), box(.12, .3, .5, 0, .78, -.34, 0), box(.1, .24, .4, 0, .4, -.52)];
  for (const s of [-1, 1]) dark.push(box(.08, .08, .7, s * .32, 1.0, .42, s * .25, -s * .2), box(.24, .06, .3, s * .3, 1.28, -.04, s * .4));
  return { hull: group(hull), dark: group(dark), lamp: group([box(.3, .05, .05, 0, 1.28, .62), box(.1, .1, .1, 0, .62, .3)]) };
}
function highHydralisk() {
  const hull = [armor(oct, 0, .08, -.18, .62, .76, .2, .05), armor(oct, 0, .38, -.06, .5, .62, .28, .05), armor(oct, 0, .74, .06, .4, .5, .3, .04),
    cone(.2, .6, 10, 0, 1.2, .44), armor(hex, 0, 1.0, .12, .36, .4, .16, .03)];
  const dark = [];
  for (let i = 0; i < 5; i++) dark.push(armor(hex, 0, .32 + i * .2, -.34 - (i < 2 ? .14 - i * .07 : 0), .1, .3, .3 - i * .03, .02));
  for (const s of [-1, 1]) dark.push(box(.07, .07, .78, s * .33, 1.02, .46, s * .25, -s * .2), box(.04, .12, .3, s * .4, .9, .86, s * .25, -s * .2),
    armor(hex, s * .3, 1.24, -.06, .22, .4, .06, .02), tube(.06, .08, .3, 6, s * .28, .86, .14));
  const lamp = [box(.3, .05, .05, 0, 1.28, .64), box(.07, .07, .07, -.1, 1.33, .58), box(.07, .07, .07, .1, 1.33, .58), new THREE.IcosahedronGeometry(.09, 0).translate(0, .64, .36)];
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}
// 破壞能：懸浮能量核心（呈現層另加懸浮高度），外繞斜置護環與三支約束支架
function plainArchon() {
  const hull = [tube(.82, .82, .14, 10, 0, 1.05, 0), tube(.7, .7, .12, 10, 0, 0, 0).rotateX(.9).translate(0, 1.05, 0)];
  const dark = [];
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; dark.push(box(.12, 1.1, .12, Math.sin(a) * .78, 1.05, Math.cos(a) * .78)); }
  return { hull: group(hull), dark: group(dark), lamp: group([new THREE.IcosahedronGeometry(.56, 1).translate(0, 1.05, 0)]) };
}
function highArchon() {
  const hull = [tube(.86, .86, .12, 16, 0, 1.05, 0), tube(.72, .72, .1, 16, 0, 0, 0).rotateX(.9).translate(0, 1.05, 0), tube(.64, .64, .08, 16, 0, 0, 0).rotateZ(1.1).translate(0, 1.05, 0)];
  const dark = [];
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, x = Math.sin(a), z = Math.cos(a);
    dark.push(armor(hex, x * .84, .5, z * .84, .16, .2, 1.1, .02), tube(.09, .14, .16, 8, x * .84, .42, z * .84), tube(.14, .09, .16, 8, x * .84, 1.7, z * .84)); }
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group([new THREE.IcosahedronGeometry(.56, 2).translate(0, 1.05, 0), new THREE.IcosahedronGeometry(.16, 1).translate(0, 1.92, 0)]) };
}
// 死靈戰機：前掠主翼、雙尾撐與垂直尾翼、前置座艙
const fore = [[0, -.4], [.95, .1], [.9, .32], [.2, .2], [0, .45]];
function plainWraith() {
  const hull = [cone(.22, 1.3, 6, 0, .4, .35), armor(side(fore, -1), -.12, .32, -.1, 1, .9, .05, .01), armor(fore, .12, .32, -.1, 1, .9, .05, .01)];
  const dark = [tube(.18, .2, .5, 6, 0, 0, 0).rotateX(Math.PI / 2).translate(0, .4, -.5)];
  for (const s of [-1, 1]) dark.push(box(.12, .12, 1.2, s * .5, .38, -.55), box(.05, .4, .3, s * .5, .6, -1.05));
  return { hull: group(hull), dark: group(dark), lamp: group([box(.16, .1, .32, 0, .52, .62), box(.2, .12, .06, 0, .4, -.78)]) };
}
function highWraith() {
  const hull = [cone(.22, 1.4, 10, 0, .4, .38), armor(side(fore, -1), -.12, .32, -.1, 1.05, .95, .04, .015), armor(fore, .12, .32, -.1, 1.05, .95, .04, .015), armor(hex, 0, .3, -.3, .5, .9, .16, .03)];
  const dark = [tube(.17, .21, .55, 10, 0, 0, 0).rotateX(Math.PI / 2).translate(0, .4, -.55)];
  for (const s of [-1, 1]) dark.push(tube(.07, .07, 1.25, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(s * .5, .38, -.56), armor(hex, s * .5, .45, -1.05, .06, .32, .42, .01),
    box(.04, .08, .5, s * .7, .3, .1, 0, s * .4), box(.24, .03, .26, s * .5, .62, -1.16));
  const lamp = [box(.15, .1, .34, 0, .52, .66), box(.18, .1, .05, 0, .4, -.84)];
  for (const s of [-1, 1]) lamp.push(box(.07, .07, .05, s * .5, .38, -1.2), box(.05, .03, .05, s * .92, .32, .2));
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}

// 戰鬥巡洋艦（版本 7 起）：長形楔狀主艦體、前段厚重艦首裝甲、後段艦橋塔與三具推進器，兩舷各一排砲塔
function plainBattlecruiser() {
  const hull = [box(.9, .42, 2.4, 0, .4, 0), box(.62, .3, .7, 0, .46, 1.5), box(1.5, .14, 1.0, 0, .32, -.5)];
  const dark = [box(.34, .42, .5, 0, .8, -.55), box(.5, .2, .9, 0, .2, .2)];
  for (const s of [-1, 0, 1]) dark.push(tube(.14, .17, .4, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(s * .34, .38, -1.35));
  for (const s of [-1, 1]) for (const z of [.2, .7]) dark.push(box(.16, .1, .26, s * .5, .65, z));
  return { hull: group(hull), dark: group(dark), lamp: group([box(.26, .08, .06, 0, .9, -.3), box(.7, .06, .06, 0, .36, -1.58), box(.4, .06, .04, 0, .5, 1.86)]) };
}
function highBattlecruiser() {
  const hull = [armor(oct, 0, .22, -.1, 1.0, 2.5, .38, .06), armor(hex, 0, .3, 1.45, .7, .78, .3, .05), armor(hex, 0, .26, -.55, 1.6, 1.0, .1, .03), armor(hex, 0, .6, .4, .6, 1.2, .1, .03)];
  const dark = [armor(hex, 0, .66, -.62, .36, .5, .36, .03), box(.2, .3, .2, 0, 1.12, -.66), box(.5, .18, .9, 0, .2, .2)];
  for (const s of [-1, 0, 1]) dark.push(tube(.13, .18, .42, 12, 0, 0, 0).rotateX(Math.PI / 2).translate(s * .34, .38, -1.38));
  for (const s of [-1, 1]) for (const z of [.1, .55, 1.0]) dark.push(tube(.08, .1, .08, 8, s * .48, .62, z), box(.04, .04, .3, s * .48, .66, z + .14));
  const lamp = [box(.28, .08, .06, 0, 1.0, -.48), box(.72, .06, .06, 0, .36, -1.6), box(.42, .06, .04, 0, .5, 1.86)];
  for (const s of [-1, 1]) lamp.push(box(.04, .04, 1.6, s * .51, .3, .1));
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}
// 斥候（版本 7 起）：細長箭形機身、後掠三角翼、翼下兩具長形推進莢艙
const delta = [[0, -.55], [.95, -.45], [.25, .35], [0, .6]];
function plainScout() {
  const hull = [cone(.2, 1.4, 6, 0, .4, .3), armor(side(delta, -1), -.1, .34, -.2, 1, 1, .05, .01), armor(delta, .1, .34, -.2, 1, 1, .05, .01)];
  const dark = [];
  for (const s of [-1, 1]) dark.push(tube(.1, .12, .9, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(s * .55, .28, -.35));
  return { hull: group(hull), dark: group(dark), lamp: group([box(.14, .08, .3, 0, .5, .55), box(.1, .1, .06, -.55, .28, -.82), box(.1, .1, .06, .55, .28, -.82)]) };
}
function highScout() {
  const hull = [cone(.2, 1.5, 10, 0, .4, .32), armor(side(delta, -1), -.1, .34, -.2, 1.05, 1.05, .04, .015), armor(delta, .1, .34, -.2, 1.05, 1.05, .04, .015), armor(hex, 0, .3, -.35, .36, .7, .14, .03)];
  const dark = [];
  for (const s of [-1, 1]) dark.push(tube(.09, .12, .95, 12, 0, 0, 0).rotateX(Math.PI / 2).translate(s * .55, .28, -.36), box(.04, .22, .3, s * .55, .42, -.62), box(.3, .03, .12, s * .4, .3, -.1));
  const lamp = [box(.13, .08, .32, 0, .5, .58)];
  for (const s of [-1, 1]) lamp.push(box(.11, .11, .05, s * .55, .28, -.85), box(.04, .03, .2, s * .78, .3, -.42));
  return { hull: edged(group(hull)), dark: edged(group(dark)), lamp: group(lamp) };
}
// 自殺蟲（版本 7 起）：小型球狀生物彈頭、前端尖鉤、短翼（左右部件，繞翅根拍動）與尾刺
function plainScourge() {
  return finish(wings({ hull: [new THREE.IcosahedronGeometry(.3, 1).scale(1, .85, 1.2).translate(0, .45, 0)], dark: [cone(.08, .4, 5, 0, .45, .48), box(.08, .08, .5, 0, .42, -.45)], lamp: [new THREE.IcosahedronGeometry(.12, 0).translate(0, .62, .12)] },
    s => ({ hull: [armor(side(wing, s), s * .18, .5, -.05, .7, .6, .04, .01)], dark: [box(.6, .05, .06, s * .44, .55, -.1, 0, s * .27)], lamp: [box(.06, .04, .06, s * .74, .55, -.15)] })), false);
}
function highScourge() {
  const dark = [cone(.08, .42, 8, 0, .45, .5)];
  for (const s of [-1, 1]) dark.push(cone(.04, .24, 6, s * .1, .4, .44));
  for (let i = 0; i < 3; i++) dark.push(armor(hex, 0, .42, -.3 - i * .14, .14 - i * .03, .14, .06, .01));
  return finish(wings({ hull: [new THREE.IcosahedronGeometry(.3, 2).scale(1, .85, 1.2).translate(0, .45, 0)], dark, lamp: [new THREE.IcosahedronGeometry(.12, 1).translate(0, .64, .12), box(.05, .05, .05, -.08, .5, .36), box(.05, .05, .05, .08, .5, .36)] },
    s => ({ hull: [armor(side(wing, s), s * .18, .52, -.04, .74, .62, .03, .015)], dark: [box(.64, .05, .06, s * .46, .56, -.1, 0, s * .27)], lamp: [box(.06, .04, .06, s * .78, .56, -.15)] })), true);
}

export const unitModels = {
  std: { marine: plainMarine, dragoon: plainDragoon, mutalisk: plainMutalisk, hydralisk: plainHydralisk, archon: plainArchon, wraith: plainWraith, battlecruiser: plainBattlecruiser, scout: plainScout, scourge: plainScourge },
  high: { marine: highMarine, dragoon: highDragoon, mutalisk: highMutalisk, hydralisk: highHydralisk, archon: highArchon, wraith: highWraith, battlecruiser: highBattlecruiser, scout: highScout, scourge: highScourge },
};
export const HOVER_HEIGHT = .35; // 破壞能懸浮（純視覺，模擬上屬地面層）
export const FLY_HEIGHT = 1.7;
