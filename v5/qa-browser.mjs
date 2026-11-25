// DEV01：以真實瀏覽器輸入驗收 v5 購兵。不改 v5，只讀畫面上的金幣、單位數、時鐘與事件紀錄。
// 單步模式每格恰好推進一個 1/30 秒模擬步，可核對到 tick；最後另跑一段未攔截的即時模式。
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from '../vendor/three.module.js';
import { launch, sleep } from '../tools/browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.resolve(process.env.V5_HTML || path.join(here, 'battle_craft-v5.html'))).href;
const PAD5 = { x: -8.3, z: 14.4 }, PAD12 = { x: 8.3, z: 14.4 };
const READ = `(() => { const n = i => +document.getElementById(i).textContent, [m, s] = document.getElementById('clock').textContent.split(':').map(Number);
  const rows = [...document.querySelectorAll('#event-log .log-row.friendly .log-text')].map(e => e.textContent).reverse();
  const buys = rows.map(t => t.match(/^我方花 (\\d+) 金，部署 (\\d+) 名/)).filter(Boolean).map(m => [+m[1], +m[2]]);
  return { gold: n('gold'), units: n('unit-count'), sec: m * 60 + s, buys, entered: rows.filter(t => t.startsWith('已進入')).length, waiting: rows.filter(t => t.startsWith('金幣不足')).length, mode: document.getElementById('start').textContent, rowCount: document.querySelectorAll('#event-log .log-row').length }; })()`;

// 依 v5 createScene／resize 的鏡頭參數，把地面座標換成畫面座標
async function screenOf(page, p) {
  const r = await page.eval(`(() => { const r = document.getElementById('battlefield').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
  const cam = new THREE.PerspectiveCamera(2 * Math.atan(Math.max(21, 31 / (r[2] / r[3])) / 66) * 180 / Math.PI, r[2] / r[3], .1, 300);
  cam.position.set(0, 50, 43); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const v = new THREE.Vector3(p.x, 0, p.z).project(cam);
  return [r[0] + (v.x + 1) / 2 * r[2], r[1] + (1 - v.y) / 2 * r[3]];
}

const browser = await launch({ width: 1280, height: 1000 });
const results = [];
async function game(stepped = true) {
  const page = await browser.open(url, { stepped });
  await page.until(`document.getElementById('event-log').children.length > 0`);
  await page.eval(`document.getElementById('battlefield').scrollIntoView({ block: 'center' })`);
  if (stepped) await page.eval('__step(1)');
  await page.clickOn('#start');
  await page.eval(`document.getElementById('battlefield').scrollIntoView({ block: 'center' })`);
  const g = { page, tick: 0, log: [], last: await page.eval(READ) };
  assert.equal(g.last.mode, '暫停');
  g.goto = async (p, n = 1) => { const [x, y] = await screenOf(page, p); await page.click(x, y, n); };
  g.check = s => { // 每格帳目：起始 12 ＋ 收入 － 現有 ＝ 累計扣款；接戰前單位數 ＝ 累計出兵
    const spent = s.buys.reduce((a, b) => a + b[0], 0), made = s.buys.reduce((a, b) => a + b[1], 0);
    assert.equal(12 + s.sec - s.gold, spent, `帳目不符 ${JSON.stringify(s)}`);
    for (const [c, k] of s.buys) assert.equal(k, { 5: 1, 12: 3 }[c], '價格與出兵數不符');
    if (s.sec < 12) assert.equal(s.units, made, `出兵數不符 ${JSON.stringify(s)}`);
    assert(s.rowCount < 80, '事件紀錄已截斷，累計不可信');
  };
  g.step = async (n = 1) => {
    for (let i = 0; i < n; i++) {
      const s = await page.eval(`(__step(1), ${READ})`); g.tick++;
      assert.equal(s.sec, Math.floor(g.tick / 30), '單步與時鐘不同步'); g.check(s);
      assert(s.buys.length - g.last.buys.length <= 1, '同一 tick 成交超過一筆');
      if (s.buys.length > g.last.buys.length) g.log.push({ tick: g.tick, cost: s.buys.at(-1)[0], before: g.last.gold, after: s.gold });
      g.last = s;
    }
    return g.last;
  };
  g.run = async (cond, max = 600) => { for (let i = 0; i < max; i++) if (cond(await g.step())) return g.last; throw new Error('條件未達成'); };
  g.done = async () => { assert.deepEqual(page.errors, []); await page.close(); };
  return g;
}
const test = async (name, fn) => { const note = await fn(); results.push({ 案例: name, 結果: 'OK', 摘要: note }); };

await test('到達前不扣款，到達該 tick 成交一筆', async () => {
  const g = await game(); await g.goto(PAD5);
  const s = await g.run(s => { if (!s.entered) assert.equal(s.buys.length, 0); return s.entered; });
  assert.equal(s.buys.length, 1); assert.equal(g.log[0].tick, g.tick);
  const expected = Math.ceil((Math.hypot(-13 - PAD5.x, 8.3 - PAD5.z) - 2.25) / .22); // 起點到信標邊緣的步數，不依賴遊戲自己的「已進入」
  assert(Math.abs(g.tick - expected) <= 1, `到達 tick ${g.tick}，預期約 ${expected}`); await g.done();
  return `第 ${g.tick} tick 到達並成交`;
});
let control;
await test('停留續購：間隔至少 15 tick，差 1 金等到補足的 tick 成交', async () => {
  const g = await game(); await g.goto(PAD5); await g.run(s => s.entered); await g.step(330 - g.tick);
  const gaps = g.log.slice(1).map((b, i) => b.tick - g.log[i].tick);
  assert(g.log.length >= 4); assert(Math.min(...gaps) >= 15); assert(gaps.includes(15), '應有存款足夠時的 15 tick 續購');
  const waited = g.log.filter(b => b.before === 4); // 成交前一 tick 為 4 金（差 1 金）
  assert(waited.length >= 2); for (const b of waited) { assert.equal(b.tick % 30, 0); assert.equal(b.after, 0); }
  control = g.log; await g.done(); return `tick ${g.log.map(b => b.tick).join('、')}`;
});
await test('12 金信標：11 金不成交，補足 12 金的 tick 成交 3 名', async () => {
  const g = await game(); await g.goto(PAD12); await g.run(s => s.entered); await g.run(s => s.gold === 11); const n = g.log.length;
  await g.run(() => g.log.length > n, 31); const b = g.log.at(-1);
  assert.deepEqual([b.before, b.after, b.cost, b.tick % 30], [11, 0, 12, 0]); await g.done(); return `第 ${b.tick} tick 由 11 補足`;
});
await test('抵達時差 1 金：不成交，補足的 tick 才成交', async () => {
  const g = await game(); await g.goto(PAD5); await g.run(s => s.entered); await g.run(s => s.gold < 2 && s.buys.length >= 3);
  const out = { x: PAD5.x, z: PAD5.z - 4.2 }; await g.goto(out); await g.run(s => s.gold === 4);
  const n = g.log.length, e = g.last.entered; await g.goto(PAD5);
  const s = await g.run(s => s.entered > e, 29); assert.equal(s.gold, 4); assert.equal(g.log.length, n, '錢不足就成交');
  await g.run(() => g.log.length > n, 31); assert.deepEqual([g.log.at(-1).before, g.log.at(-1).after], [4, 0]); await g.done();
  return `第 ${g.log.at(-1).tick} tick 補足成交`;
});
await test('離開後停止，回來恢復', async () => {
  const g = await game(); await g.goto(PAD5); await g.run(s => s.entered && s.buys.length >= 2);
  await g.goto({ x: 0, z: 9 }); await g.step(30); const n = g.log.length, gold = g.last.gold, at = g.last.sec;
  await g.step(240); assert.equal(g.log.length, n); assert.equal(g.last.gold - gold, g.last.sec - at);
  await g.goto(PAD5); await g.run(() => g.log.length > n, 200); await g.done(); return '離開 8 秒 0 筆';
});
await test('連續點擊同一點：成交時間與對照組完全相同', async () => {
  const g = await game(); await g.goto(PAD5, 25);
  while (g.tick < 330) { await g.step(); if (g.tick % 9 === 0) await g.goto(PAD5, 6); }
  assert.deepEqual(g.log, control); await g.done(); return `${control.length} 筆一致`;
});
await test('鍵盤：按住與自動重複只移動，不重複扣款；信標內移動仍每 15 tick 至多一筆', async () => {
  const g = await game(); const { page } = g;
  await page.down('s'); await page.down('d'); await g.run(s => { page.down('s', true); page.down('d', true); return s.entered; }, 200);
  await page.up('s'); await page.up('d'); const e = g.last.entered;
  for (let i = 0; i < 12; i++) { const k = i % 2 ? 'a' : 'd'; await page.down(k); await page.down(k, true); await page.down(k, true); await g.step(4); await page.up(k); }
  assert.equal(g.last.entered, e, '不應離開信標'); const gaps = g.log.slice(1).map((b, i) => b.tick - g.log[i].tick);
  assert(g.log.length >= 2 && Math.min(...gaps) >= 15); await g.done(); return `${g.log.length} 筆，最小間隔 ${Math.min(...gaps)} tick`;
});
await test('暫停期間不收入、不成交', async () => {
  const g = await game(); await g.goto(PAD5); await g.run(s => s.entered); await g.page.clickOn('#start');
  const a = await g.page.eval(READ), b = await g.page.eval(`(__step(90), ${READ})`);
  assert.deepEqual([b.gold, b.buys.length, b.sec], [a.gold, a.buys.length, a.sec]); await g.done(); return '90 格無變化';
});
await test('即時模式（未攔截畫格）：點擊→成交→連點→離開', async () => {
  const g = await game(false); const { page } = g; await g.goto(PAD5);
  const end = Date.now() + 9000; let entered = false, n = 0;
  while (Date.now() < end) { const s = await page.eval(READ); g.check(s); if (!entered) { if (!s.entered) assert.equal(s.buys.length, 0); else { entered = true; await g.goto(PAD5, 20); } } n++; await sleep(40); }
  const before = await page.eval(READ); assert(before.buys.length >= 3); await g.goto({ x: 0, z: 9 }); await sleep(800);
  const a = await page.eval(READ); await sleep(3000); const b = await page.eval(READ); g.check(b); assert.equal(a.buys.length, b.buys.length); assert(b.gold > a.gold); await g.done();
  return `抽樣 ${n} 次，成交 ${b.buys.length} 筆`;
});
await browser.close();
console.table(results); console.log(`v5 browser QA: OK (${browser.angle})`);
