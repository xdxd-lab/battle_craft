// DEV05 四席版面的唯一資料來源：尺寸、席位、隊伍、配色、鏡頭取景。
// 不依賴 DOM 或 Three.js，讓 Node 可以直接檢查。所有數值皆為暫定。
// 世界座標固定：北 = -z、東 = +x、上 = +y。切換視角只移動鏡頭，不旋轉場景。

export const DIM = {
  coreDistance: 30,      // 核心中心到戰場中心
  laneWidth: 8,          // 道路可通行寬
  junctionRadius: 9,     // 交會區外接半徑
  corePlatformRadius: 7, // 核心平台半徑
  coreHeight: 10,        // 核心最高點（含識別桿）
  shopWidth: 14,         // 購買區沿切線方向
  shopDepth: 10,         // 購買區沿臂方向
  shopTangent: 17,       // 購買區中心離道路中線
  shopRadial: 25,        // 購買區中心離戰場中心（沿臂）
  padCount: 4,           // 每席信標數
  padRadius: 1.5,
  markerHeight: 4,       // 敵我標記中心高度
  markerOffset: 12,      // 標記在核心順時鐘側的距離，不蓋住自己的道路與購買區
};

// 逆時鐘：北 → 西 → 南 → 東 → 北
export const SEATS = [
  { id: 'N', name: '北', dir: [0, -1], team: 'A', primary: '#2d73cb', secondary: '#a9ccff', primaryName: '鈷藍', secondaryName: '冰藍' },
  { id: 'W', name: '西', dir: [-1, 0], team: 'A', primary: '#2cacd0', secondary: '#a8f3ea', primaryName: '藍綠', secondaryName: '薄荷' },
  { id: 'S', name: '南', dir: [0, 1], team: 'B', primary: '#d48c22', secondary: '#ffe38f', primaryName: '琥珀', secondaryName: '乳黃' },
  { id: 'E', name: '東', dir: [1, 0], team: 'B', primary: '#c03f30', secondary: '#ffc3ad', primaryName: '珊瑚紅', secondaryName: '蜜桃' },
];
// 同隊共用色系（甲冷、乙暖），另以徽記圖形與名稱區分，不只靠顏色。
export const TEAMS = {
  A: { id: 'A', name: '甲隊', family: '冷色', emblem: 'bars', emblemName: '雙橫條' },
  B: { id: 'B', name: '乙隊', family: '暖色', emblem: 'chevrons', emblemName: '雙箭頭' },
};
// 敵我標記獨立於席位色，形狀＋文字＋顏色三重編碼；色相避開兩隊的冷、暖色系。
export const RELATIONS = {
  self: { name: '自己', shape: 'star', color: '#ffffff' },
  ally: { name: '隊友', shape: 'shield', color: '#c4f06a' },
  own: { name: '我隊', shape: 'shield', color: '#c4f06a' },
  enemy: { name: '敵方', shape: 'cross', color: '#ff6bf0' },
};

// 色覺模擬矩陣（Machado 2009，severity 1，linear RGB）；預覽濾鏡與測試共用。
export const CVD = {
  none: { name: '一般', m: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
  protan: { name: '紅色弱', m: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]] },
  deutan: { name: '綠色弱', m: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.01182, .04294, .968881]] },
  tritan: { name: '藍色弱', m: [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .3039]] },
};

export const seatIndex = id => SEATS.findIndex(s => s.id === id);
export const seatById = id => SEATS[seatIndex(id)];
export const nextCcw = id => SEATS[(seatIndex(id) + 1) % 4];
export const opposite = id => SEATS[(seatIndex(id) + 2) % 4];
export const seatsOf = team => SEATS.filter(s => s.team === team);
// 由上俯視的逆時鐘 90°
export const ccw = ([x, z]) => [z || 0, -x || 0];
// 席位本地座標（以北席建模）轉世界座標的 Y 軸旋轉角
export const seatYaw = id => seatIndex(id) * Math.PI / 2;

export function corePos(id) {
  const [x, z] = seatById(id).dir;
  return [x * DIM.coreDistance, z * DIM.coreDistance];
}
export function shopPos(id) {
  const d = seatById(id).dir, t = ccw(d);
  return [d[0] * DIM.shopRadial + t[0] * DIM.shopTangent, d[1] * DIM.shopRadial + t[1] * DIM.shopTangent];
}
export function markerPos(id) {
  const c = corePos(id), t = ccw(seatById(id).dir);
  return [c[0] - t[0] * DIM.markerOffset, DIM.markerHeight, c[1] - t[1] * DIM.markerOffset];
}
export function shopCorners(id) {
  const d = seatById(id).dir, t = ccw(d), c = shopPos(id);
  const out = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const h = a * DIM.shopWidth / 2, v = b * DIM.shopDepth / 2;
    out.push([c[0] + t[0] * h + d[0] * v, c[1] + t[1] * h + d[1] * v]);
  }
  return out;
}
// 購買區邊緣與道路邊緣的淨距
export const shopClearance = () => DIM.shopTangent - DIM.shopWidth / 2 - DIM.laneWidth / 2;

// viewer: 'seat:N' | 'team:A' | 'plan'
export function parseView(text) {
  const [kind, id] = String(text || '').split(':');
  if (kind === 'seat' && seatById(id)) return { kind, id };
  if (kind === 'team' && TEAMS[id]) return { kind, id };
  return kind === 'plan' ? { kind: 'plan', id: null } : null;
}
export const viewKey = v => v.kind === 'plan' ? 'plan' : `${v.kind}:${v.id}`;
export const ALL_VIEWS = ['team:A', 'team:B', 'seat:N', 'seat:W', 'seat:S', 'seat:E', 'plan'];

// 相對於檢視者的關係；俯視校對不分敵我。
export function relation(view, id) {
  if (view.kind === 'plan') return null;
  if (view.kind === 'team') return seatById(id).team === view.id ? 'own' : 'enemy';
  if (view.id === id) return 'self';
  return seatById(view.id).team === seatById(id).team ? 'ally' : 'enemy';
}

// 鏡頭在水平面上所在的方向（自己／隊伍的一側靠近畫面下緣）
export function viewFrom(view) {
  if (view.kind === 'seat') return seatById(view.id).dir;
  if (view.kind === 'team') {
    const v = seatsOf(view.id).reduce((a, s) => [a[0] + s.dir[0], a[1] + s.dir[1]], [0, 0]);
    const n = Math.hypot(...v);
    return [v[0] / n, v[1] / n];
  }
  return [0, 1];
}

// 完整戰場必須入鏡的點：道路端、核心（含高度）、敵我標記、購買區。
export function boundsPoints() {
  const pts = [];
  for (const s of SEATS) {
    const [x, z] = corePos(s.id);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = DIM.corePlatformRadius;
      pts.push([x + Math.cos(a) * r, 0, z + Math.sin(a) * r]);
    }
    pts.push([x, DIM.coreHeight, z]);
    for (const [cx, cz] of shopCorners(s.id)) pts.push([cx, 0, cz], [cx, 4, cz]);
  }
  return pts;
}
// 標記是朝向鏡頭的方形貼圖，取景時以四角納入。
export const MARKER_SIZE = { w: 8.4, h: 4.8 };

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const FOV = 28;
export const ELEVATION = 49;

// 方位角 az 從南起算（+z），仰角 el；轉場時只內插這兩個角度，過程仍完整入鏡。
export function viewAngles(view) {
  const [x, z] = viewFrom(view);
  return { az: Math.atan2(x, z), el: (view.kind === 'plan' ? 90 : ELEVATION) * Math.PI / 180 };
}
export function basisOf({ az, el }) {
  const x = Math.sin(az), z = Math.cos(az), c = Math.cos(el), s = Math.sin(el);
  const forward = [-x * c, -s, -z * c];
  const up = [-x * s, c, -z * s];
  const right = [z, 0, -x];
  return { forward, up, right };
}
export const viewBasis = view => basisOf(viewAngles(view));
export const framePoints = view => frameOf(viewAngles(view));
export function frameOf(angles) {
  const { up, right } = basisOf(angles);
  const pts = boundsPoints();
  for (const s of SEATS) {
    const m = markerPos(s.id);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      const w = a * MARKER_SIZE.w / 2, h = b * MARKER_SIZE.h / 2;
      pts.push([0, 1, 2].map(i => m[i] + right[i] * w + up[i] * h));
    }
  }
  return pts;
}
// 封閉解：鏡頭左右置中（自己的核心永遠在中線），取能容納全部點的最近距離。
export const fitCamera = (view, aspect, margin) => fitAngles(viewAngles(view), aspect, margin);
export function fitAngles(angles, aspect, margin = 0.95) {
  const { forward, up, right } = basisOf(angles);
  const tv = Math.tan(FOV * Math.PI / 360) * margin, th = tv * aspect;
  let depthH = Infinity, hi = -Infinity, lo = Infinity;
  for (const p of frameOf(angles)) {
    const a = dot(p, right), b = dot(p, up), c = dot(p, forward);
    depthH = Math.min(depthH, c - Math.abs(a) / th);
    hi = Math.max(hi, b - tv * c);
    lo = Math.min(lo, b + tv * c);
  }
  const depthV = (lo - hi) / (2 * tv);
  const depth = Math.min(depthH, depthV);
  // 垂直方向置中：上下邊界對 b 的允許區間取中點
  const lift = ((hi + tv * depth) + (lo - tv * depth)) / 2;
  const position = [0, 1, 2].map(i => up[i] * lift + forward[i] * depth);
  return { position, forward, up, right };
}
export function project(cam, aspect, p) {
  const t = Math.tan(FOV * Math.PI / 360), d = sub(p, cam.position), c = dot(d, cam.forward);
  return [dot(d, cam.right) / (c * t * aspect), dot(d, cam.up) / (c * t)];
}
