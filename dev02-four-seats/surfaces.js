// 地板與場外背景的材質：標準／精緻兩級，由畫質決定。只改呈現，不碰模擬。
// 圖檔為 Poly Haven CC0，建置時以 base64 內嵌；任何一張載入失敗就整組回到程序材質（'orig'，僅作回退，不供選擇）。
import * as THREE from 'three';
import * as W from '../dev05-layout/world.js';
import DATA, { assetBytes } from './surface-data.generated.js';

export const TIERS = {
  std: { name: '標準', floor: '512', ground: '1k', canvas: 2048 },
  max: { name: '精緻', floor: '2k', ground: '4k', panel: 2048 },
};
// 真實尺寸：地板 4 m、背景 30 m；場景 1 單位約 1 公尺
// 背景沿用原本每 140 m 一輪的貼圖：柏油 5×5 塊（每塊 28 m，比實際 30 m 小約 7%）合成後，再畫上原本 420 個星點
const FLOOR_M = 4, BOX_UV_M = 7, GROUND_TILES = 5, DOT_PX = 2 / 1024, GROUND_SIZE = 420, GROUND_M = 30;
// 精緻級甲板：每 7 m 一張合成圖＝照片鋪 2×2（每塊 3.5 m，比實際小約 12%）＋原艙板分割的接縫、倒角與嵌板色差
function panels(n, draw) { for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const wide = (i + j) % 3 === 0 && i < 3; draw(i * n / 4, j * n / 4, n / 4 * (wide ? 2 : 1), n / 4, i * 7 + j * 13); if (wide) i++; } }
function sheet(n, img) { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.drawImage(img, i * n / 2, j * n / 2, n / 2, n / 2); return [c, g]; }
function deckAlbedo(n, img) {
  const [c, g] = sheet(n, img);
  panels(n, (x, y, w, h, k) => { const v = k * 37 % 42; g.fillStyle = v > 21 ? `rgba(255,255,255,${(v - 21) / 170})` : `rgba(0,0,0,${(21 - v) / 110})`; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(12,15,18,.82)'; g.lineWidth = n / 190; g.strokeRect(x, y, w, h); g.strokeStyle = 'rgba(225,235,245,.3)'; g.lineWidth = n / 700; g.strokeRect(x + n / 150, y + n / 150, w - n / 75, h - n / 75);
    for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const px = x + (a > 0 ? n / 62 : w - n / 62), py = y + (b > 0 ? n / 62 : h - n / 62); g.fillStyle = 'rgba(14,16,20,.75)'; g.beginPath(); g.arc(px, py, n / 210, 0, 7); g.fill(); g.fillStyle = 'rgba(230,236,244,.6)'; g.beginPath(); g.arc(px - n / 700, py - n / 700, n / 480, 0, 7); g.fill(); } });
  return c;
}
function deckNormal(n, img) { // 照片法線上疊倒角：R 為 +u、G 為 +v（畫布上方）
  const [c, g] = sheet(n, img), b = n / 110;
  panels(n, (x, y, w, h) => { for (const [color, a, q, r, s] of [['rgb(50,128,205)', x, y, b, h], ['rgb(205,128,205)', x + w - b, y, b, h], ['rgb(128,205,205)', x, y, w, b], ['rgb(128,50,205)', x, y + h - b, w, b]]) { g.fillStyle = color; g.fillRect(a, q, r, s); } });
  return c;
}
let dotsPlane = null; // 精緻級把原星點獨立成一層，柏油得以用 4K 原圖依 30 m 平鋪
function stars(repeat) {
  if (!dotsPlane) {
    const c = document.createElement('canvas'); c.width = c.height = 2048; const x = c.getContext('2d');
    for (const d of W.GROUND.dots) { x.fillStyle = d.color.replace(/[\d.]+\)$/, '.95)'); x.fillRect(d.x * 2048, d.y * 2048, DOT_PX * 2048, DOT_PX * 2048); } // 位置與冷暖分布同原版；此層不受光照，提高不透明度補足亮度
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.repeat.copy(repeat);
    dotsPlane = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false })); dotsPlane.rotation.x = -Math.PI / 2; dotsPlane.position.y = -14.97; W.scene.add(dotsPlane);
  }
  dotsPlane.visible = true;
}
const deck = W.MAT.deck, original = { deck: { map: deck.map, roughnessMap: deck.roughnessMap, color: deck.color.clone() }, ground: null };
let current = 'orig', made = [], token = 0;

function image(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('圖檔載入失敗')); i.src = src; }); }
// 平均線性亮度，用來讓替換後的整體明暗接近原始，不改變席位色與道路的對比
function meanLinear(img) {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data; let s = 0; const lin = v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  for (let i = 0; i < d.length; i += 4) s += .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]);
  return s / (d.length / 4);
}
// 原背景去掉星點後的平均亮度（星點約佔 0.2% 面積，取 32×32 縮圖的中位數附近平均以排除）
function baseMean(img) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64);
  const d = g.getImageData(0, 0, 64, 64).data, v = [], lin = q => (q /= 255) <= .04045 ? q / 12.92 : ((q + .055) / 1.055) ** 2.4;
  for (let i = 0; i < d.length; i += 4) v.push(.2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]));
  v.sort((a, b) => a - b); const keep = v.slice(0, Math.floor(v.length * .98)); return keep.reduce((a, b) => a + b, 0) / keep.length;
}
function texture(img, srgb, repeat) {
  const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; made.push(t); return t;
}
function restore() {
  Object.assign(deck, { map: original.deck.map, roughnessMap: original.deck.roughnessMap, normalMap: null }); deck.color.copy(original.deck.color); deck.needsUpdate = true;
  if (dotsPlane) dotsPlane.visible = false;
  const g = W.GROUND.material; Object.assign(g, original.ground.props); g.color.copy(original.ground.color); g.needsUpdate = true;
  for (const t of made) t.dispose(); made = [];
}
// 回傳實際生效的級別；失敗時為 'orig'
export async function setSurface(tier) {
  const g = W.GROUND.material; if (!original.ground) original.ground = { props: { map: g.map, emissiveMap: g.emissiveMap, emissiveIntensity: g.emissiveIntensity }, color: g.color.clone(), mean: meanLinear(g.map.image), base: baseMean(g.map.image) };
  if (!original.deck.mean) original.deck.mean = meanLinear(deck.map.image);
  const want = TIERS[tier] ? tier : 'orig', my = ++token;
  if (want === 'orig') { restore(); return current = 'orig'; }
  const T = TIERS[want];
  try {
    const [diff, rough, ground, nor] = await Promise.all([DATA[`floor_diff_${T.floor}`], DATA[`floor_rough_${T.floor}`], DATA[`ground_diff_${T.ground}`], ...(T.panel ? [DATA[`floor_nor_${T.floor}`]] : [])].map(image));
    if (my !== token) throw new Error('已被較新的切換取代');
    restore();
    if (T.panel) {
      const albedo = deckAlbedo(T.panel, diff), r = sheet(T.panel, rough)[0];
      deck.map = texture(albedo, true, 1); deck.roughnessMap = texture(r, false, 1); deck.normalMap = texture(deckNormal(T.panel, nor), false, 1); // 接縫改由合成法線提供（法線貼圖會停用 bumpMap）
      deck.color.copy(original.deck.color).multiplyScalar(original.deck.mean / meanLinear(albedo)); deck.needsUpdate = true;
      const tex = texture(ground, true, GROUND_SIZE / GROUND_M), k = 1.35 * original.ground.base / meanLinear(ground); // 稍提亮讓裂紋與顆粒讀得出來
      Object.assign(g, { map: tex, emissiveMap: tex }); g.color.copy(original.ground.color).multiplyScalar(Math.min(2.2, k)); g.emissiveIntensity = original.ground.props.emissiveIntensity * Math.min(2.2, k); g.needsUpdate = true;
      stars(original.ground.props.map.repeat);
      return current = want;
    }
    const k = BOX_UV_M / FLOOR_M; // 道路等方塊 UV 為每 7 m 一輪
    deck.map = texture(diff, true, k); deck.roughnessMap = texture(rough, false, k); // 接縫仍由原 bumpMap 提供
    deck.color.copy(original.deck.color).multiplyScalar(original.deck.mean / meanLinear(diff)); deck.needsUpdate = true;
    const n = T.canvas, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), step = n / GROUND_TILES;
    for (let i = 0; i < GROUND_TILES; i++) for (let j = 0; j < GROUND_TILES; j++) x.drawImage(ground, i * step, j * step, step, step);
    // 以黑色覆蓋壓暗到原背景的平均亮度（sRGB 乘 1-a，線性約乘其 2.2 次方），材質的光照與自發光參數維持原值
    const brightness = Math.min(1, original.ground.base / meanLinear(ground)); x.fillStyle = `rgba(0,0,0,${1 - brightness ** (1 / 2.2)})`; x.fillRect(0, 0, n, n);
    for (const d of W.GROUND.dots) { x.fillStyle = d.color; x.fillRect(d.x * n, d.y * n, DOT_PX * n, DOT_PX * n); }
    const tex = texture(c, true, g.map.repeat.x); Object.assign(g, { map: tex, emissiveMap: tex }); g.needsUpdate = true;
    return current = want;
  } catch (err) { console.warn(err); if (my === token) { restore(); current = 'orig'; } throw err; }
}
export const surface = () => current;
export const bytes = assetBytes;
