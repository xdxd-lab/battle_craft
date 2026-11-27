import * as THREE from 'three';
import { detailCommander, detailMaterials } from './detail-models.js';
import { unitModels } from './unit-models.js';
import { MAT, seatMats } from '../dev05-layout/world.js';
import { HZ, RULES } from './sim.mjs';
import { KINDS, ATTACKS, ARMORS, FRAME_MS, PLATE } from './roster.mjs';

const describe = {
  marine: ['地面步兵', '低價前線單位，即時射擊地面與空中目標。', [1.9, 1.9, 4.3], .92, 25],
  dragoon: ['地面重型', '發射慢速光球，延後命中單一目標；護盾持續緩慢回復。', [4.2, 3.2, 4.6], .85, 22],
  mutalisk: ['飛行', '飛行單位。首擊後最多再彈跳兩次，傷害依序為 1/3、1/9。', [3.6, 3.6, 4.2], .5, 24],
  hydralisk: ['地面中型', '射出骨刺攻擊地面與空中，指向性爆炸對大型目標最有效。', [2.4, 2.0, 3.6], .8, 25],
  archon: ['地面懸浮', '近距靈能衝擊，主目標整發並濺射周圍敵軍與隊友單位（不傷己席）；幾乎全靠護盾承傷。', [3.2, 2.6, 4.0], 1.05, 26],
  wraith: ['飛行', '對地即時雷射（普通），對空發射飛彈（指向性爆炸）；隱形未實作。', [3.0, 2.6, 3.6], .4, 25],
  battlecruiser: ['飛行重型', '主力艦，雷射砲台即時射擊地面與空中；基礎護甲 3，低傷害武器效果大減。大和砲未實作。', [4.4, 3.4, 5.2], .4, 26],
  scout: ['飛行', '對地即時光子砲（普通）；對空一次發射兩枚反物質飛彈（指向性爆炸），擅長攔截大型飛行單位。', [3.4, 2.8, 4.0], .4, 25],
  scourge: ['飛行小型', '只攻擊空中目標。貼近後自爆造成 110 點傷害，自己同時陣亡；不攻擊地面與核心。', [1.8, 1.6, 2.4], .5, 25],
};
const unitProfile = kind => {
  const k = KINDS[kind], [role, description, camera, aim, fov] = describe[kind];
  return {
    name: k.name, english: k.source, role, description, camera, aim, fov,
    stats: [['耐久', k.hp], ['護盾', k.shield || '無'], ['裝甲', ARMORS[k.armor]], ['攻擊', ATTACKS[k.attack].name], ['基礎護甲', PLATE[kind]], ['單次傷害', k.vsAir ? `對地 ${k.damage}／對空 ${k.vsAir.damage}${k.vsAir.hits ? `×${k.vsAir.hits}` : ''}` : k.suicide ? `${k.damage}（自爆）` : k.damage], ['攻擊間隔', `約 ${(k.cooldown * FRAME_MS / 1000).toFixed(2)} 秒${k.vsAir ? `／對空 ${(k.vsAir.cooldown * FRAME_MS / 1000).toFixed(2)} 秒` : ''}`], ...(k.splash ? [['濺射', '100／50／25%']] : [])],
    model: unitModels.high[kind], plain: unitModels.std[kind],
  };
};
const profiles = {
  ...Object.fromEntries(Object.keys(describe).map(k => [k, unitProfile(k)])),
  commander: {
    name: '指揮官', english: 'Commander', role: '購買區操作',
    description: '在自己的購買區移動，站上信標即可持續用金幣部署部隊。',
    stats: [['移動速度', `${RULES.commanderSpeed * HZ} 世界單位／秒`], ['部署間隔', `${RULES.purchaseGap / HZ} 秒`]],
    model: detailCommander, camera: [3.5, 2.55, 4.5], aim: 1.08, fov: 23,
  },
};

const plainCommander = () => ({ hull: new THREE.CylinderGeometry(.5, .75, 1.7, 8).translate(0, .95, 0), dark: new THREE.CylinderGeometry(.4, .4, .6, 12).translate(0, 2.1, 0), lamp: new THREE.BoxGeometry(.6, .16, .3).translate(0, 2.15, .28) });
function portrait(renderer, kind, quality) {
  const { model, plain = plainCommander, camera: position, aim, fov } = profiles[kind], high = quality === 'high';
  const geometries = (high ? model : plain)(), paint = seatMats.N;
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x19252e);
  const lens = new THREE.PerspectiveCamera(fov, 2, .1, 20);
  lens.position.set(...position); lens.lookAt(0, aim, 0);
  const shade = kind === 'commander' ? MAT.steel : MAT.black, [hull, dark] = high ? detailMaterials(paint.paint, shade) : [paint.paint, shade];
  const mats = { hull, dark, lamp: paint.glow };
  if (high) { // 圖卡展示台與地面環，讓輪廓與反光讀得出來
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, .12, 48), new THREE.MeshStandardMaterial({ color: 0x2b3943, metalness: .8, roughness: .35 })); base.position.y = -.02;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2, .018, 8, 64), new THREE.MeshBasicMaterial({ color: 0xa9ccff })); halo.rotation.x = Math.PI / 2; halo.position.y = .06; studio.add(base, halo);
    const back = new THREE.DirectionalLight(0xbfdcff, 2.4); back.position.set(1, 4, 5); studio.add(back);
  }
  for (const [part, geometry] of Object.entries(geometries)) studio.add(new THREE.Mesh(geometry, mats[part.split(':')[0]]));
  studio.add(new THREE.HemisphereLight(0xdceafa, 0x5b6269, 1.85));
  for (const [color, intensity, x, y, z] of [[0xffe2bd, 3.1, -4, 7, -3], [0x9aceee, 2.3, 3, 2, 4]]) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z); studio.add(light);
  }

  const width = high ? 960 : 480, height = width / 2;
  const target = new THREE.WebGLRenderTarget(width, height, { colorSpace: THREE.SRGBColorSpace, samples: high ? 4 : 0 });
  const previous = renderer.getRenderTarget();
  const pixels = new Uint8Array(width * height * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.render(studio, lens);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    target.dispose();
    for (const geometry of Object.values(geometries)) geometry.dispose();
  }
  const image = document.createElement('canvas');
  image.width = width; image.height = height;
  const ctx = image.getContext('2d'), frame = ctx.createImageData(width, height);
  const stride = width * 4;
  for (let y = 0; y < height; y++) frame.data.set(pixels.subarray(y * stride, (y + 1) * stride), (height - y - 1) * stride);
  ctx.putImageData(frame, 0, 0);
  return image.toDataURL('image/png');
}

export function createDossier(renderer, card, panel, quality = () => 'std') {
  const name = card.querySelector('h2'), role = card.querySelector('.profile-role');
  const description = card.querySelector('p'), stats = card.querySelector('dl'), image = card.querySelector('img');
  const buttons = [...card.querySelectorAll('[data-profile]')], images = {};
  let selected = 'marine', hovered = null, visible;
  function update() {
    if (card.hidden || !panel.open) return;
    const kind = hovered || selected;
    if (kind === visible) return;
    visible = kind;
    const data = profiles[kind];
    name.textContent = `${data.name}（${data.english}）`; role.textContent = data.role; description.textContent = data.description;
    stats.replaceChildren(...data.stats.flatMap(([label, value]) => {
      const term = document.createElement('dt'), detail = document.createElement('dd');
      term.textContent = label; detail.textContent = value;
      return [term, detail];
    }));
    for (const button of buttons) button.setAttribute('aria-pressed', button.dataset.profile === kind);
    const key = `${quality()}:${kind}`;
    images[key] ??= portrait(renderer, kind, quality());
    image.src = images[key];
    card.dataset.unit = kind;
  }
  for (const button of buttons) { // 中文在上、英文在下
    const data = profiles[button.dataset.profile], english = document.createElement('small');
    english.textContent = data.english; english.lang = 'en'; button.replaceChildren(data.name, english);
  }
  for (const button of buttons) button.onclick = () => { selected = button.dataset.profile; hovered = null; update(); };
  panel.addEventListener('toggle', () => { if (!panel.open) { selected = 'marine'; hovered = null; } update(); });
  return {
    update,
    refresh() { visible = undefined; update(); },
    hover(kind) { hovered = kind; update(); },
    select(kind) { selected = kind; hovered = null; panel.open = true; update(); },
    reset() { selected = 'marine'; hovered = null; update(); },
  };
}
