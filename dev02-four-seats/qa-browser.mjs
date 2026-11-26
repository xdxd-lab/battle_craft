// DEV02：以真實瀏覽器輸入從選席玩到終局，並以 Node 重跑輸入紀錄比對狀態摘要。
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch, sleep } from '../tools/browser.mjs';
import * as S from './sim.mjs';
import * as L from '../dev05-layout/layout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), SHOTS = process.env.SHOTS;
const url = pathToFileURL(path.join(here, 'battle_craft-dev02.html')).href;
const browser = await launch({ width: 1600, height: 900 }), rows = [];
const test = async (name, fn) => rows.push({ 案例: name, 摘要: (await fn()) ?? '' });
async function open(seat, { seed = 7, stepped = true, ...size } = {}) {
  const page = await browser.open(`${url}#seed=${seed}`, { stepped, ...size });
  await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`);
  if (stepped) await page.eval('__step(2)');
  await page.clickOn(`[data-seat="${seat}"]`); assert.equal(await page.eval('__dev02.mode()'), 'play');
  if (stepped) await page.eval('__step(2)');
  page.snap = () => page.eval('__dev02.snapshot()');
  page.clickWorld = async (x, z, n = 1) => { const [a, b] = await page.eval(`__dev02.screen(${x}, ${z})`); await page.click(a, b, n); };
  page.done = async () => { assert.deepEqual(page.errors, []); await page.close(); };
  return page;
}
const same = async page => { const rec = await page.eval('__dev02.record()'), r = S.replay({ ...rec, ticks: (await page.snap()).tick }); assert.equal(r.final, await page.eval('__dev02.digest()'), 'Node 重跑與瀏覽器不同'); assert.deepEqual(r.log.length, (await page.eval('__dev02.log().length'))); return rec.commands.length; };

await test('四席：點信標購兵、HUD 與帳目相符、WASD 依鏡頭方向、數字鍵', async () => {
  for (const id of S.SEAT_IDS) {
    const page = await open(id); const [x, z] = S.padWorld(id, 0);
    assert.equal(await page.eval('__dev02.view()'), 'seat:' + id);
    let s = await page.snap(); const h = s.seats[id].commander;
    await page.clickWorld(x, z, 12); let first = 0;
    for (let i = 0; i < 90; i++) { await page.eval('__step(1)'); s = await page.snap(); if (!first && s.seats[id].buys) first = s.tick; if (Math.hypot(s.seats[id].commander.x - x, s.seats[id].commander.z - z) > S.RULES.padRadius) assert.equal(s.seats[id].spent, 0); }
    assert(first > 0); assert.equal(s.seats[id].gold + s.seats[id].spent, 12 + Math.floor(s.tick / 30)); assert.equal(+(await page.eval(`document.getElementById('gold').textContent`)), s.seats[id].gold);
    assert(Math.hypot(s.seats[id].commander.x - h.x, s.seats[id].commander.z - h.z) > 2);
    await page.clickWorld(...S.toWorld(id, .9, 0)); await page.eval('__step(60)');
    const at = async () => { const c = (await page.snap()).seats[id].commander; return page.eval(`__dev02.screen(${c.x}, ${c.z})`); };
    for (const [k, ax, sign] of [['d', 0, 1], ['a', 0, -1], ['w', 1, -1], ['s', 1, 1]]) { const a = await at(); await page.down(k); await page.eval('__step(8)'); await page.up(k); await page.eval('__step(2)'); const b = await at(), d = [b[0] - a[0], b[1] - a[1]]; assert(d[ax] * sign > 5 && Math.abs(d[1 - ax]) < Math.abs(d[ax]), `${id} ${k} 移動 ${d}`); }
    await page.down('2'); await page.up('2'); await page.eval('__step(70)'); assert.equal((await page.snap()).seats[id].pad, 1);
    const n = (await page.eval('__dev02.record().commands.length')); await page.clickWorld(0, 0); await page.eval('__step(3)'); assert.equal(await page.eval('__dev02.record().commands.length'), n, '購買區外不應成為指令');
    await same(page); if (SHOTS && id === 'S') await page.shot(path.join(SHOTS, 'seatS.png')); await page.done();
  }
});
await test('從選席玩到終局（單步、真實輸入），重跑摘要一致', async () => {
  const page = await open('S', { seed: 20261126 }); let k = 0, shot = false;
  while (await page.eval('__dev02.mode()') === 'play') { const key = k++ % 3 ? '2' : '1'; await page.down(key); await page.up(key); await page.eval('__step(150)'); if (SHOTS && !shot && k === 10) { shot = true; await page.shot(path.join(SHOTS, 'battle-S.png')); await page.down('v'); await page.up('v'); await page.eval('__step(40)'); await page.shot(path.join(SHOTS, 'battle-team.png')); } assert(k < 400); }
  const s = await page.snap(), text = await page.eval(`document.getElementById('result').textContent`);
  assert.equal(text, s.winner === 'draw' ? '平手' : s.winner === 'B' ? '勝利' : '敗北'); const n = await same(page); if (SHOTS) await page.shot(path.join(SHOTS, 'end.png'));
  await page.clickOn('#restart'); await page.clickOn('[data-seat="N"]'); await page.eval('__step(40)'); const t = await page.snap(); assert(t.tick > 0 && t.tick < 60 && t.units.length === 0 && t.seats.N.hp === S.RULES.coreHp); await page.done();
  return `${text}，${(s.tick / 30).toFixed(0)} 秒、${n} 個指令`;
});
await test('暫停、視角、觀戰', async () => {
  const page = await open('E'); await page.eval('__step(60)'); await page.clickOn('#pause'); const a = await page.eval('__dev02.digest()'); await page.eval('__step(90)'); assert.equal(await page.eval('__dev02.digest()'), a);
  await page.clickOn('#pause'); await page.eval('__step(5)'); assert.notEqual(await page.eval('__dev02.digest()'), a);
  await page.clickOn('#view'); assert.equal(await page.eval('__dev02.view()'), 'team:B'); await page.clickOn('#view'); assert.equal(await page.eval('__dev02.view()'), 'seat:E'); await page.done();
  const w = await open('none', { seed: 3 }); for (let i = 0; i < 300 && await w.eval('__dev02.mode()') === 'play'; i++) await w.eval('__step(300)'); assert.equal(await w.eval('__dev02.mode()'), 'end'); await same(w); await w.done();
});
await test('方向鍵按下後、下一 tick 前暫停，暫停中放開：恢復後不移動、不扣款', async () => {
  for (const [via, key] of [['button', 'd'], ['space', 'w'], ['blur', 'a']]) for (const id of S.SEAT_IDS) {
    const page = await open(id); await page.eval('__step(10)');
    const before = await page.snap();
    await page.down(key); // 尚未推進 tick
    if (via === 'button') await page.clickOn('#pause'); else if (via === 'space') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); } else await page.eval(`dispatchEvent(new Event('blur'))`);
    assert.equal(await page.eval('__dev02.mode()'), 'paused'); await page.eval('__step(30)'); await page.up(key); await page.eval('__step(30)');
    if (via === 'space') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); } else await page.clickOn('#pause');
    assert.equal(await page.eval('__dev02.mode()'), 'play'); await page.eval('__step(240)');
    const after = await page.snap(), a = before.seats[id], b = after.seats[id];
    assert.deepEqual([b.commander.x, b.commander.z, b.spent, b.buys, b.pad], [a.commander.x, a.commander.z, 0, 0, -1], `${via} ${id} 暫停後自行移動或扣款`);
    assert.equal(b.gold, 12 + Math.floor(after.tick / 30)); await same(page);
    // 正常行為仍在：恢復後再按方向鍵會移動
    await page.down(key); await page.eval('__step(10)'); await page.up(key); await page.eval('__step(2)'); const c = (await page.snap()).seats[id].commander;
    assert(Math.hypot(c.x - b.commander.x, c.z - b.commander.z) > 1, `${via} ${id} 恢復後按鍵應移動`); await page.done();
  }
  return '按鈕、空白鍵、失焦 × 四席';
});
await test('取景：桌面與橫式手機四席與隊伍視角皆在安全區內', async () => {
  for (const [w, h] of [[1600, 900], [1280, 720], [844, 390]]) for (const id of S.SEAT_IDS) {
    const page = await open(id, { w, h }); assert(await page.eval('__dev02.inside()'), `${w}x${h} ${id}`); if (SHOTS && w === 844 && id === 'W') { await page.eval('__step(500)'); await page.shot(path.join(SHOTS, 'phone-W.png')); }
    await page.clickOn('#view'); await page.eval('__step(40)'); assert(await page.eval('__dev02.inside()'), `${w}x${h} ${id} 隊伍`); await page.done();
  }
});
await test('即時模式 4 倍速：玩家不動至終局，重跑摘要一致', async () => {
  const page = await open('N', { seed: 5, stepped: false }); await page.clickOn('#speed'); await page.clickOn('#speed');
  await page.until(`__dev02.mode() === 'end'`, 90000); assert.equal(await page.eval(`document.getElementById('result').textContent`), '敗北'); await same(page); const s = await page.snap(); await page.done(); return `${(s.tick / 30).toFixed(0)} 秒`;
});
await sleep(50); await browser.close();
console.table(rows); console.log(`DEV02 browser QA: OK (${browser.angle})`);
