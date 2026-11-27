// DEV02：以真實瀏覽器輸入從選席玩到終局，並以 Node 重跑輸入紀錄比對狀態摘要。
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { launch, sleep } from '../tools/browser.mjs';
import * as S from './sim.mjs';
import * as L from '../dev05-layout/layout.mjs';
import { TRACKS, BATTLE_AT_SECONDS } from './music-tracks.mjs';

// 三兵種本體三角面
const stdTri = { marine: 192, dragoon: 148, mutalisk: 160, hydralisk: 216, archon: 196, wraith: 180 }, highTri = { marine: 976, dragoon: 756, mutalisk: 436, hydralisk: 704, archon: 776, wraith: 448 };
const gold = tick => S.ECONOMY.startGold + Math.floor(tick / S.ECONOMY.incomeEvery);
const here = path.dirname(fileURLToPath(import.meta.url)), SHOTS = process.env.SHOTS;
const url = pathToFileURL(path.join(here, 'battle_craft-dev02.html')).href;
const browser = await launch({ width: 1600, height: 900 }), rows = [];
const test = async (name, fn) => rows.push({ 案例: name, 摘要: (await fn()) ?? '' });
async function open(seat, { seed = 7, stepped = true, keep = false, quality = 'std', ...size } = {}) {
  const page = await browser.open(`${url}#seed=${seed}&quality=${quality}`, { stepped, ...size });
  await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`);
  if (!keep) { await page.eval(`try { localStorage.clear() } catch {}`); await page.reload(); await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); }
  if (stepped) await page.eval('__step(2)');
  await page.clickOn(`[data-seat="${seat}"]`); assert.equal(await page.eval('__dev02.mode()'), 'play');
  if (stepped) { await page.eval("document.getElementById('speed').click(); document.getElementById('speed').click(); __step(2)"); }
  page.snap = () => page.eval('__dev02.snapshot()');
  page.clickWorld = async (x, z, n = 1) => { const [a, b] = await page.eval(`__dev02.screen(${x}, ${z})`); await page.click(a, b, n); };
  page.done = async () => { assert.deepEqual(page.errors, []); await page.close(); };
  return page;
}
const same = async page => { const rec = await page.eval('__dev02.record()'), r = S.replay({ ...rec, ticks: (await page.snap()).tick }); assert.equal(r.final, await page.eval('__dev02.digest()'), 'Node 重跑與瀏覽器不同'); assert.deepEqual(r.log.length, (await page.eval('__dev02.log().length'))); return rec.commands.length; };

await test('四席：點信標購兵、HUD 與帳目相符、WASD 依鏡頭方向、數字鍵', async () => {
  for (const id of S.SEAT_IDS) {
    const page = await open(id); const [x, z] = S.padWorld(id, 0, S.DIM);
    assert.equal(await page.eval('__dev02.view()'), 'seat:' + id);
    let s = await page.snap(); const h = s.seats[id].commander;
    await page.clickWorld(x, z, 12); let first = 0;
    for (let i = 0; i < 90; i++) { await page.eval('__step(1)'); s = await page.snap(); if (!first && s.seats[id].buys) first = s.tick; if (Math.hypot(s.seats[id].commander.x - x, s.seats[id].commander.z - z) > S.RULES.padRadius) assert.equal(s.seats[id].spent, 0); }
    assert(first > 0); assert.equal(s.seats[id].gold + s.seats[id].spent, gold(s.tick)); assert.equal(+(await page.eval(`document.getElementById('gold').textContent`)), s.seats[id].gold);
    assert(Math.hypot(s.seats[id].commander.x - h.x, s.seats[id].commander.z - h.z) > 2);
    await page.clickWorld(...S.toWorld(id, 0, 0, S.DIM)); await page.eval('__step(60)');
    const at = async () => { const c = (await page.snap()).seats[id].commander; return page.eval(`__dev02.screen(${c.x}, ${c.z})`); };
    for (const [k, ax, sign] of [['d', 0, 1], ['a', 0, -1], ['w', 1, -1], ['s', 1, 1]]) { const a = await at(); await page.down(k); await page.eval('__step(8)'); await page.up(k); await page.eval('__step(2)'); const b = await at(), d = [b[0] - a[0], b[1] - a[1]]; assert(d[ax] * sign > 5 && Math.abs(d[1 - ax]) < Math.abs(d[ax]), `${id} ${k} 移動 ${d}`); }
    for (const i of [1, 2]) { await page.down(String(i + 1)); await page.up(String(i + 1)); await page.eval('__step(70)'); assert.equal((await page.snap()).seats[id].pad, i); }
    const n = (await page.eval('__dev02.record().commands.length')); await page.clickWorld(0, 0); await page.eval('__step(3)'); assert.equal(await page.eval('__dev02.record().commands.length'), n, '購買區外不應成為指令');
    await same(page); if (SHOTS && id === 'S') await page.shot(path.join(SHOTS, 'seatS.png')); await page.done();
  }
});
await test('從選席玩到終局（單步、真實輸入），重跑摘要一致', async () => {
  const page = await open('S', { seed: 20261126 }); let k = 0, shot = false;
  while (await page.eval('__dev02.mode()') === 'play') { const key = '1213'[k++ % 4]; await page.down(key); await page.up(key); await page.eval('__step(150)'); if (SHOTS && !shot && k === 10) { shot = true; await page.shot(path.join(SHOTS, 'battle-S.png')); await page.down('v'); await page.up('v'); await page.eval('__step(40)'); await page.shot(path.join(SHOTS, 'battle-team.png')); } assert(k < 400); }
  const s = await page.snap(), text = await page.eval(`document.getElementById('result').textContent`);
  assert.equal(text, s.winner === 'draw' ? '平手' : s.winner === 'B' ? '勝利' : '敗北'); const n = await same(page); if (SHOTS) await page.shot(path.join(SHOTS, 'end.png'));
  await page.clickOn('#restart'); await page.clickOn('[data-seat="N"]'); assert.equal(await page.eval("document.getElementById('speed').textContent"), '1×'); await page.eval('__step(20)'); const t = await page.snap(); assert(t.tick > 0 && t.tick < 60 && t.units.length === 0 && t.seats.N.hp === S.coreMax(S.VERSION)); await page.done();
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
    if (via === 'blur') await page.clickOn('#opt-engineering');
    await page.down(key); // 尚未推進 tick
    if (via === 'button') await page.clickOn('#pause'); else if (via === 'space') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); } else await page.eval(`dispatchEvent(new Event('blur'))`);
    assert.equal(await page.eval('__dev02.mode()'), 'paused'); await page.eval('__step(30)'); await page.up(key); await page.eval('__step(30)');
    if (via === 'space') { await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); } else await page.clickOn('#pause');
    assert.equal(await page.eval('__dev02.mode()'), 'play'); await page.eval('__step(240)');
    const after = await page.snap(), a = before.seats[id], b = after.seats[id];
    assert.deepEqual([b.commander.x, b.commander.z, b.spent, b.buys, b.pad], [a.commander.x, a.commander.z, 0, 0, -1], `${via} ${id} 暫停後自行移動或扣款`);
    assert.equal(b.gold, gold(after.tick)); await same(page);
    // 正常行為仍在：恢復後再按方向鍵會移動
    await page.down(key); await page.eval('__step(10)'); await page.up(key); await page.eval('__step(2)'); const c = (await page.snap()).seats[id].commander;
    assert(Math.hypot(c.x - b.commander.x, c.z - b.commander.z) > 1, `${via} ${id} 恢復後按鍵應移動`); await page.done();
  }
  return '按鈕、空白鍵、失焦 × 四席';
});
await test('一般模式失焦：丟掉待處理輸入，停止方向移動，保留已生效點擊，維持手動暫停', async () => {
  const page = await open('N');
  const blur = () => page.eval("dispatchEvent(new Event('blur'))");
  const pos = async () => { const { x, z } = (await page.snap()).seats.N.commander; return [x, z]; };
  const initial = await pos();
  assert.equal(await page.eval('__dev02.display().engineering'), false);

  await page.down('d'); await blur(); await page.eval('__step(5)');
  assert.deepEqual(await pos(), initial, '失焦前尚未生效的方向鍵');
  await page.down('d', true); await page.eval('__step(5)');
  assert.deepEqual(await pos(), initial, '等待重新按下方向鍵');
  await page.up('d'); await page.down('d'); await page.eval('__step(5)');
  const moved = await pos(); assert.notDeepEqual(moved, initial);
  const beforeBlur = (await page.snap()).tick;
  await blur(); await page.eval('__step(5)'); await page.up('d');
  assert.deepEqual(await pos(), moved, '停止已生效的方向鍵');
  assert.equal((await page.snap()).tick, beforeBlur + 5);
  assert.equal(await page.eval('__dev02.mode()'), 'play');

  const pad = S.padWorld('N', 0, S.DIM);
  await page.clickWorld(...pad); await blur(); await page.eval('__step(5)');
  assert.deepEqual(await pos(), moved, '丟掉尚未生效的點擊');
  await page.clickWorld(...pad); await page.eval('__step(1)');
  const goal = (await page.snap()).seats.N.goal;
  assert(goal && Math.hypot(goal.x - pad[0], goal.z - pad[1]) < .25);
  await blur(); await page.eval('__step(45)');
  const destination = [goal.x, goal.z];
  assert.deepEqual(await pos(), destination, '保留已生效的點擊');
  assert((await page.snap()).seats.N.buys > 0);

  await page.clickOn('#pause'); const paused = (await page.snap()).tick;
  await blur(); await page.eval("__step(20); dispatchEvent(new Event('focus')); __step(20)");
  assert.equal(await page.eval('__dev02.mode()'), 'paused');
  assert.equal((await page.snap()).tick, paused);
  await page.clickOn('#pause'); await page.down('w'); await page.eval('__step(10)'); await page.up('w'); await page.eval('__step(1)');
  assert.notDeepEqual(await pos(), destination);
  await same(page); await page.done();
  return '合成 blur/focus；真實分頁另驗';
});
await test('工程模式獨立保存，切回焦點仍維持暫停', async () => {
  const page = await open('N');
  await page.clickOn('#opt-engineering');
  const expectOn = () => page.eval(`[__dev02.display().engineering, __dev02.display().bars, __dev02.display().log]`);
  assert.deepEqual(await expectOn(), [true, true, true]);
  await page.reload(); await page.until('!!window.__dev02 && !!document.querySelector("[data-seat]")');
  assert.deepEqual(await expectOn(), [true, true, true]);
  await page.eval('__step(2)'); await page.clickOn('[data-seat="N"]');
  await page.eval("dispatchEvent(new Event('blur')); dispatchEvent(new Event('focus')); __step(20)");
  assert.equal(await page.eval('__dev02.mode()'), 'paused');
  await page.clickOn('#opt-engineering'); assert.deepEqual(await expectOn(), [false, true, true]);
  assert.equal(await page.eval('__dev02.mode()'), 'paused');
  await page.done();
});
await test('顯示設定：血條與事件紀錄獨立切換、重開可見近期事件、跨局與重載保留、保存受限可玩', async () => {
  const D = p => p.eval('__dev02.display()'), hpShown = p => p.eval(`getComputedStyle(document.querySelector('.core .hp')).visibility`), nums = p => p.eval(`[...document.querySelectorAll('.core span')].map(e => e.textContent).join('|')`);
  const page = await open('W'); await page.eval('__step(400)');
  let d = await D(page); assert(d.bars && d.log && d.barsDrawn > 4 && !d.logShown && d.logRows > 3);
  await page.clickOn('#opt-engineering'); d = await D(page); assert(d.logShown); assert.equal(await hpShown(page), 'visible');
  const before = await page.eval('__dev02.digest()');
  await page.clickOn('#opt-bars'); await page.eval('__step(1)'); d = await D(page); assert(!d.bars && d.log && !d.barsDrawn && d.logShown); assert.equal(await hpShown(page), 'hidden'); assert.match(await nums(page), /我席 \d+/);
  await page.clickOn('#opt-log'); d = await D(page); assert(!d.bars && !d.log && !d.logShown); assert.equal(await page.eval(`document.getElementById('panel-title').textContent`), '暫定規則');
  await page.clickOn('#opt-bars'); await page.eval('__step(1)'); d = await D(page); assert(d.bars && !d.log && d.barsDrawn > 4 && !d.logShown, '血條與紀錄應各自獨立');
  await page.clickOn('#opt-engineering');
  const rows = d.logRows, msg = await page.eval(`document.getElementById('msg').textContent`); await page.clickWorld(...S.padWorld('W', 0, S.DIM)); await page.eval('__step(900)');
  assert.notEqual(await page.eval(`document.getElementById('msg').textContent`), msg, '即時提示應保留'); assert(await page.eval('__dev02.log().length') > rows);
  await page.clickOn('#opt-engineering'); await page.clickOn('#opt-log'); d = await D(page); assert(d.log && d.logShown && d.logRows > rows, '重開應看到關閉期間的事件');
  const first = await page.eval(`document.querySelector('#log .log time').textContent`), clock = await page.eval(`document.getElementById('clock').textContent`); assert(first <= clock && first >= '00:20', `最近一列 ${first}`);
  assert.notEqual(await page.eval('__dev02.digest()'), before); await same(page);
  await page.clickOn('#opt-log'); await page.clickOn('#again'); await page.clickOn('[data-seat="N"]'); await page.eval('__step(30)'); d = await D(page); assert(d.bars && !d.log, '重開一局應保留');
  await page.reload(); await page.until(`!!window.__dev02`); d = await D(page); assert(d.bars && !d.log, '重載應保留'); assert.equal(await page.eval(`document.getElementById('opt-log').textContent`), '事件紀錄：關');
  await page.done();
  const locked = await browser.open(`${url}#seed=7`, { stepped: true, prelude: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });` });
  await locked.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await locked.eval('__step(2)'); await locked.clickOn('[data-seat="E"]');
  d = await D(locked); assert(d.bars && d.log, '保存受限時用預設'); await locked.clickOn('#opt-bars'); await locked.clickOn('#opt-engineering'); await locked.clickOn('#opt-log'); await locked.eval('__step(300)'); d = await D(locked); assert(!d.bars && !d.log);
  assert((await locked.eval('__dev02.snapshot()')).tick >= 300); assert.deepEqual(locked.errors, []); await locked.close();
  return '關閉期間新增事件於重開後可見；localStorage 拋錯仍可玩';
});
await test('鍵盤操作設定：Space／Enter 連續切換、Tab 換開關，焦點留在按鈕且不暫停；點戰場後恢復操作', async () => {
  const page = await open('N'); await page.eval('__step(30)');
  const key = (key, code, vk, text) => page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, ...(text ? { text } : {}) }).then(() => page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }));
  const space = () => key(' ', 'Space', 32, ' '), enter = () => key('Enter', 'Enter', 13, '\r'), tab = () => key('Tab', 'Tab', 9);
  const state = () => page.eval(`[document.activeElement.id, __dev02.mode(), __dev02.display().bars, __dev02.display().log]`);
  await page.eval(`document.getElementById('framing').focus()`); await tab(); assert.deepEqual(await state(), ['opt-bars', 'play', true, true]);
  await space(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-bars', 'play', false, true]);
  await space(); await space(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-bars', 'play', false, true], '連按三次');
  await enter(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-bars', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['view', 'play', true, true]); await tab(); await tab(); assert.deepEqual(await state(), ['opt-quality', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['opt-engineering', 'play', true, true]); await space();
  await tab(); assert.deepEqual(await state(), ['opt-music', 'play', true, true]); await tab(); await tab(); assert.deepEqual(await state(), ['panel-title', 'play', true, true]);
  await tab(); assert.deepEqual(await state(), ['opt-log', 'play', true, true]); await space(); await enter(); await space(); await page.eval('__step(1)'); assert.deepEqual(await state(), ['opt-log', 'play', true, false]);
  await page.clickOn('#opt-engineering');
  const t = (await page.snap()).tick; await page.eval('__step(30)'); assert.equal((await page.snap()).tick, t + 30, '對局不應暫停');
  const c = (await page.snap()).seats.N.commander, [x, y] = await page.eval(`__dev02.screen(${c.x}, ${c.z})`); await page.click(x, y);
  assert.equal(await page.eval('document.activeElement.id'), 'stage'); await page.down('d'); await page.eval('__step(10)'); await page.up('d'); await page.eval('__step(2)');
  const m = (await page.snap()).seats.N.commander; assert(Math.hypot(m.x - c.x, m.z - c.z) > 1, '點戰場後方向鍵應移動');
  await space(); assert.equal(await page.eval('__dev02.mode()'), 'paused', '戰場有焦點時 Space 仍暫停'); await space(); assert.equal(await page.eval('__dev02.mode()'), 'play');
  await page.clickOn('#opt-bars'); assert.equal(await page.eval('document.activeElement.id'), 'stage', '滑鼠點擊後焦點回戰場'); await same(page); await page.done();
});
const BAD_IMAGES = `{ const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, String(v).startsWith('data:image/jpeg') ? 'data:image/jpeg;base64,AAAA' : v); }, get() { return d.get.call(this); } }); }`;
await test('地表跟隨畫質：僅標準／精緻、無地表按鈕、舊保存值與舊網址參數相容、載入失敗回內建材質', async () => {
  const sf = p => p.eval('__dev02.surface().active'), settled = (p, want) => p.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.surface().active === '${want}'`, 60000);
  const page = await browser.open(`${url}#seed=7`, { stepped: true }); await settled(page, 'max');
  assert.equal(await page.eval(`document.getElementById('opt-surface')`), null);
  for (const [saved, quality, want] of [[{ surface: 'orig' }, 'high', 'max'], [{ surface: 'hi' }, 'high', 'max'], [{ quality: 'std', surface: 'orig' }, 'std', 'std'], [{ quality: 'std', surface: 'max' }, 'std', 'std'], [{ quality: 'high', surface: 'std' }, 'high', 'max'], [{ quality: 'bogus', surface: 7 }, 'high', 'max']]) {
    await page.eval(`localStorage.setItem('battle_craft.dev02.display', '${JSON.stringify(saved)}')`); await page.reload(); await settled(page, want);
    assert.equal(await page.eval('__dev02.quality().active'), quality, JSON.stringify(saved));
  }
  await page.eval(`localStorage.setItem('battle_craft.dev02.display', '{"bars":false,"surface":"hi","quality":"std"}')`); await page.reload(); await settled(page, 'std'); await page.eval('__step(2)'); await page.clickOn('[data-seat="N"]'); await page.clickOn('#opt-engineering');
  assert.deepEqual(JSON.parse(await page.eval(`localStorage.getItem('battle_craft.dev02.display')`)), { bars: false, log: true, engineering: true, quality: 'std', music: 2, sfx: 2 }, '重存時移除舊地表欄位');
  await page.eval(`localStorage.setItem('battle_craft.dev02.display', '{壞掉'); location.hash = 'seed=7&surface=hi&quality=std'`); await page.reload(); await settled(page, 'std'); assert.deepEqual(page.errors, []); await page.close();
  const broken = await browser.open(`${url}#seed=7`, { stepped: true, prelude: `localStorage.clear(); ${BAD_IMAGES}` });
  await broken.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await broken.eval('__step(2)'); await broken.until(`!__dev02.surface().busy`);
  assert.equal(await sf(broken), 'orig', '失敗應回內建材質'); assert.match(await broken.eval(`document.getElementById('msg').textContent`), /內建材質/);
  await broken.clickOn('[data-seat="E"]'); await broken.clickOn('#opt-quality'); await broken.until(`!__dev02.surface().busy`); assert.equal(await sf(broken), 'orig'); await broken.eval('__step(300)'); assert((await broken.eval('__dev02.snapshot()')).tick >= 300);
  assert.deepEqual(broken.errors, []); await broken.close();
  const fast = await open('N'); await fast.eval(`for (let i = 0; i < 5; i++) document.getElementById('opt-quality').click()`); await settled(fast, 'max'); assert.equal(await fast.eval('__dev02.quality().active'), 'high'); await fast.done();
  return '6 組舊值；壞圖回內建材質且可玩；連按 5 次收斂到精緻';
});
await test('畫質：高細節預設、模型與場景層切換、解析度、不改模擬、跨重載保留、素材失敗回退', async () => {
  const page = await browser.open(`${url}#seed=7`, { stepped: true }); const ready = p => p.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.quality().props.status !== 'loading'`, 60000);
  await ready(page); await page.eval('localStorage.clear()'); await page.reload(); await ready(page); await page.eval('__step(2)'); await page.clickOn('[data-seat="W"]'); await page.eval("document.getElementById('speed').click(); document.getElementById('speed').click(); __step(2)"); await page.eval('__step(600)');
  const q = () => page.eval('__dev02.quality()'), tri = () => page.eval('__dev02.info().bodyTriangles'), sf = () => page.eval('__dev02.surface().active');
  let v = await q(); assert.deepEqual([v.active, v.sceneVisible, v.props.status, v.props.count, v.pixelRatio, await sf()], ['high', true, 'ready', 12, 1.5, 'max']); assert.deepEqual(await tri(), { ...highTri, commander: 372 });
  const ref = await open('W'); await ref.eval('__step(600)');
  for (let i = 0; i < 3; i++) { await page.clickOn('#opt-quality'); await ready(page); await page.eval('__step(60)'); await ref.eval('__step(60)'); }
  v = await q(); assert.deepEqual([v.active, v.sceneVisible, v.pixelRatio, await sf()], ['std', false, 1, 'std']); assert.deepEqual(await tri(), { ...stdTri, commander: 92 });
  while ((await ref.snap()).tick < (await page.eval('__dev02.snapshot().tick'))) await ref.eval('__step(1)');
  if ((await ref.snap()).tick === (await page.eval('__dev02.snapshot().tick'))) assert.equal(await page.eval('__dev02.digest()'), await ref.eval('__dev02.digest()'), '畫質切換不應影響模擬'); else assert.fail('tick 未對齊');
  await ref.done(); await page.reload(); await ready(page); assert.equal((await q()).active, 'std', '重載保留');
  await page.eval(`localStorage.setItem('battle_craft.dev02.display', JSON.stringify({ bars: true, log: true, surface: 'orig' }))`); await page.reload(); await ready(page); assert.deepEqual([(await q()).active, await sf()], ['high', 'max'], '舊版保存值不覆蓋高細節預設');
  assert.deepEqual(page.errors, []); await page.close();
  const broken = await browser.open(`${url}#seed=7`, { stepped: true, prelude: `localStorage.clear(); { const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, String(v).startsWith('data:image/jpeg') ? 'data:image/jpeg;base64,AAAA' : v); }, get() { return d.get.call(this); } }); } window.Worker = class { constructor() { throw new Error('blocked'); } };` });
  await broken.until(`!!window.__dev02 && !__dev02.surface().busy && __dev02.quality().props.status !== 'loading'`, 60000); await broken.eval('__step(2)'); await broken.clickOn('[data-seat="N"]'); await broken.eval('__step(300)');
  assert.deepEqual([(await broken.eval('__dev02.surface().active')), (await broken.eval('__dev02.quality().props.status'))], ['orig', 'failed']); assert((await broken.eval('__dev02.snapshot().tick')) >= 300); await broken.close();
  return '預設高細節；三次切換摘要與對照一致；壞圖與配件解碼失敗仍可玩';
});
await test('橫式設定按鈕不遮擋：844×390、1280×720 兩種開關組合', async () => {
  for (const [w, h] of [[844, 390], [1280, 720], [1600, 900]]) for (const flip of [false, true]) {
    const page = await open('S', { w, h }); if (flip) { await page.clickOn('#opt-bars'); await page.clickOn('#opt-engineering'); } await page.eval('__step(200)');
    const box = await page.eval(`(() => { const r = id => document.getElementById(id).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const opts = ['opt-bars', 'opt-log', 'opt-quality', 'opt-engineering'].map(r).filter(x => x.width), others = ['shop', 'msg'].map(r).filter(x => x.width);
      return { inView: opts.every(o => o.top >= 0 && o.bottom <= innerHeight && o.left >= 0 && o.right <= innerWidth), overlap: opts.some(o => others.some(x => hit(o, x))), bar: r('bar').bottom, h: innerHeight }; })()`);
    assert(box.inView && !box.overlap, `${w}x${h} ${JSON.stringify(box)}`); await page.clickOn('#framing'); assert(await page.eval('__dev02.inside()'), `${w}x${h} 取景`);
    if (SHOTS && w === 844) await page.shot(path.join(SHOTS, `display-phone-${flip ? 'off' : 'on'}.png`)); await page.done();
  }
});
await test('側欄按鈕：兩欄等寬、不跨欄、血條在切全景旁、文字不溢出；畫面內核心的血條與數字不被裁切', async () => {
  const shifted = new Set();
  for (const [w, h] of [[844, 340], [667, 375], [844, 375], [844, 390], [1280, 720], [1600, 900]]) for (const quality of ['std', 'high']) {
    const page = await open('S', { w, h, quality });
    const rows = await page.eval(`[...document.querySelectorAll('#bar button')].map(b => { const r = b.getBoundingClientRect(); return { id: b.id, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), over: b.scrollWidth > b.clientWidth, bottom: r.bottom }; })`);
    assert.deepEqual(rows.map(r => r.id), ['pause', 'speed', 'framing', 'opt-bars', 'view', 'again', 'opt-quality', 'opt-engineering', 'opt-music', 'opt-sfx']);
    for (let i = 0; i < rows.length; i += 2) assert.equal(rows[i].y, rows[i + 1].y, `${w} 第 ${i / 2 + 1} 列`);
    assert(Math.max(...rows.map(r => r.w)) - Math.min(...rows.map(r => r.w)) <= 12 && new Set(rows.map(r => r.x)).size <= 4, `${w} ${JSON.stringify(rows)}`);
    assert(rows.every(r => !r.over && r.bottom <= h), `${w}x${h} ${JSON.stringify(rows)}`);
    await page.eval('__step(2)'); const cores = await page.eval('__dev02.cores()'); // 核心在畫面內時，血量數字不得被左右緣裁切
    for (const [id, c] of Object.entries(cores)) if (c.label && Math.abs(c.anchor[0]) < 1 && Math.abs(c.anchor[1]) < 1) { assert(c.screen[0] >= -1 && c.screen[1] <= 1, `${w}x${h} ${id} 核心血量 ${JSON.stringify(c)}`); if (c.shift) shifted.add(`${w}${id}`); }
    await page.until(`__dev02.audio().musicSource === 'track'`); // 曲名列：可見、不超出畫面底部、不撐寬側欄、不蓋到按鈕
    const np = await page.eval(`(() => { const e = document.getElementById('now-playing'), r = e.getBoundingClientRect(), p = e.parentElement.getBoundingClientRect(), b = document.getElementById('opt-sfx').getBoundingClientRect(); return { hidden: e.hidden, text: e.textContent, bottom: r.bottom, right: r.right, pright: p.right, wide: e.scrollWidth > e.clientWidth, below: r.top >= b.bottom - 1 }; })()`);
    assert(!np.hidden && np.text.includes('♪') && np.bottom <= h && np.right <= np.pright + 1 && !np.wide && np.below, `${w}x${h} 曲名列 ${JSON.stringify(np)}`);
    const longest = TRACKS.map(t => `♪ ${t.phase === 'opening' ? '開場' : '激戰'}｜${t.title} — ${t.author}（${t.license}）`).sort((x, y) => y.length - x.length)[0]; // 最長曲名也要放得下
    const fit = await page.eval(`(() => { const e = document.getElementById('now-playing'), old = e.textContent; e.textContent = ${JSON.stringify(longest)}; const r = e.getBoundingClientRect(), ok = r.bottom <= ${h} && e.scrollWidth <= e.clientWidth; e.textContent = old; return ok; })()`); assert(fit, `${w}x${h} 最長曲名放不下`);
    const again = await page.eval(`[...document.querySelectorAll('#bar button')].map(b => Math.round(b.getBoundingClientRect().width))`); assert.deepEqual(again, rows.map(r => r.w), '曲名列不改變按鈕寬度');
    if (SHOTS) await page.shot(path.join(SHOTS, `hud-${w}-${quality}.png`)); await page.done();
  }
  assert(shifted.has('667E'), '667 寬東席核心應平移（原本被右緣裁切）'); return `平移：${[...shifted].join(' ')}`;
});
await test('飛螳、死靈戰機飛行（離地、有影子）；重騎兵、刺蛇地面；破壞能低空懸浮', async () => {
  const page = await open('none', { seed: 11, quality: 'high' }); const seen = {}, want = ['dragoon', 'mutalisk', 'hydralisk', 'wraith', 'archon'];
  for (let i = 0; i < 400 && !want.every(k => seen[k]); i++) {
    await page.eval('__step(20)'); const [info, air] = await page.eval(`[__dev02.info(), __dev02.snapshot().units.filter(u => u.kind === 'mutalisk' || u.kind === 'wraith').length]`);
    assert.equal(info.shadows, air); for (const k of want) if (info.heights[k].length) seen[k] = k === 'archon' ? [Math.min(...info.heights[k]) >= .3 && Math.max(...info.heights[k]) <= .46] : info.heights[k];
  }
  assert.deepEqual(seen, { dragoon: [.04], mutalisk: [1.74], hydralisk: [.04], wraith: [1.74], archon: [true] }); if (SHOTS) await page.shot(path.join(SHOTS, 'air-ground.png')); await page.done(); return JSON.stringify(seen);
});
await test('主城：血量數字與損壞階段隨本體血量、血條開關連動、純呈現不改模擬', async () => {
  const max = S.coreMax(S.VERSION), want = hp => [.75, .5, .25].filter(a => hp <= max * a).length;
  for (const [w, h, quality] of [[1600, 900, 'high'], [844, 390, 'std']]) {
    const page = await open('none', { seed: 11, w, h, quality }); await page.clickOn('#framing'); const seen = new Set();
    for (let i = 0; i < 2000 && await page.eval('__dev02.mode()') === 'play'; i++) {
      await page.eval('__step(15)'); const [st, ui] = await page.eval('[__dev02.snapshot().seats, __dev02.cores()]');
      for (const id of S.SEAT_IDS) { assert.equal(ui[id].stage, want(st[id].hp), `${id} ${st[id].hp}`); assert.equal(ui[id].layers, ui[id].stage); assert.equal(ui[id].label, st[id].alive ? String(Math.ceil(st[id].hp)) : null); if (!seen.has(ui[id].stage)) { seen.add(ui[id].stage); if (SHOTS) { await page.eval('__step(6)'); await page.shot(path.join(SHOTS, `core-stage${ui[id].stage}-${id}-${w}.png`)); } } }
    }
    assert.deepEqual([...seen].sort(), [0, 1, 2, 3]); await same(page);
    const reach = await page.eval('__dev02.coreReach()'); assert(reach > 3 && reach <= S.RULES.coreRadius, `地面損壞物件伸到 ${reach}`);
    await page.eval('__step(2)'); if (SHOTS) await page.shot(path.join(SHOTS, `core-end-${w}.png`)); await page.done();
  }
  const page = await open('W'); await page.eval('__step(30)'); assert.equal((await page.eval('__dev02.cores()')).N.label, String(max)); await page.clickOn('#opt-bars'); await page.eval('__step(2)'); assert((await page.eval('Object.values(__dev02.cores())')).every(c => c.label === null)); await page.clickOn('#opt-bars'); await page.eval('__step(2)'); assert.equal((await page.eval('__dev02.cores()')).W.label, String(max)); await page.done();
  return '四階段皆出現；數字與模擬血量一致';
});
await test('六信標：點展示模型走向該信標（不開單位介紹）、按鈕與數字鍵 1–6、橫式不被 HUD 遮住', async () => {
  const out = [];
  for (const [w, h] of [[1600, 900], [844, 390]]) for (const id of S.SEAT_IDS) {
    const page = await open(id, { w, h });
    assert.equal(await page.eval(`document.querySelectorAll('#shop button').length`), 6);
    const models = await page.eval('__dev02.padModels()'); assert.equal(models.length, 24, '四席各六座展示模型');
    for (const sid of S.SEAT_IDS) assert.deepEqual(models.filter(m => m.seat === sid).map(m => m.kind), S.PADS.map(p => p.kind), `${sid} 展示模型`);
    for (let i = 0; i < 6; i++) {
      const at = await page.eval(`__dev02.padModel(${i})`); assert(at, `模型 ${i}`);
      const [x, y] = await page.eval(`__dev02.screen(${at[0]}, ${at[2]}, ${at[1]})`);
      assert(await page.eval(`document.elementFromPoint(${x}, ${y})?.id === 'stage'`), `${w}x${h} ${id} 模型 ${i + 1} 被遮`);
      const before = await page.eval(`document.getElementById('profile-name').textContent`);
      await page.click(x, y); await page.eval('__step(70)');
      assert.equal((await page.snap()).seats[id].pad, i, `${w}x${h} ${id} 點模型 ${i + 1}`);
      assert.equal(await page.eval(`document.getElementById('profile-name').textContent`), before);
      if (id === 'S') { // 踩住即購買：等到錢夠，最新一名必為該信標的兵種
        const buys = (await page.snap()).seats[id].buys; let snap;
        for (let n = 0; n < 200 && (snap = await page.snap()).seats[id].buys === buys; n++) await page.eval('__step(30)');
        assert(snap.seats[id].buys > buys, `${w}x${h} 信標 ${i + 1} 未購買`); const mine = snap.units.filter(u => u.seat === id);
        assert.equal(mine.reduce((m, u) => u.id > m.id ? u : m).kind, S.PADS[i].kind, `${w}x${h} 信標 ${i + 1} 兵種`);
      }
    }
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, text: '3' }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 }); await page.eval('__step(70)'); assert.equal((await page.snap()).seats[id].pad, 2);
    await page.clickOn('#shop button[data-pad="5"]'); await page.eval('__step(70)'); assert.equal((await page.snap()).seats[id].pad, 5);
    const kinds = new Set((await page.snap()).units.filter(u => u.seat === id).map(u => u.kind)); out.push(`${id}:${kinds.size}`);
    if (SHOTS && id === 'S') await page.shot(path.join(SHOTS, `six-pads-${w}x${h}.png`));
    await page.done();
  }
  return out.join(' ');
});
await test('取景：桌面與橫式手機四席與隊伍視角皆在安全區內', async () => {
  for (const [w, h] of [[1600, 900], [1280, 720], [844, 390]]) for (const id of S.SEAT_IDS) {
    const page = await open(id, { w, h });
    assert.equal(await page.eval('__dev02.framing()'), 'near');
    for (const i of [0, 1, 2, 3, 4, 5]) {
      if (i === 1) { await page.clickOn('#view'); await page.eval('__step(40)'); }
      const pad = S.padWorld(id, i, S.DIM);
      assert(await page.eval(`(() => { const [x,y] = __dev02.screen(${pad[0]}, ${pad[1]}); return document.elementFromPoint(x,y)?.id === 'stage'; })()`), `${w}x${h} ${id}, 近景信標 ${i + 1}`);
      await page.clickWorld(...pad); await page.eval('__step(60)');
      assert.equal((await page.snap()).seats[id].pad, i);
      await page.clickOn('#framing'); await page.eval('__step(1)');
      assert.equal(await page.eval('__dev02.framing()'), 'overview');
      assert(await page.eval('__dev02.inside()'), `${w}x${h} ${id}, 四席全景`);
      await page.clickOn('#framing'); await page.eval('__step(1)');
    }
    if (SHOTS && w === 844 && id === 'W') await page.shot(path.join(SHOTS, 'phone-W.png'));
    await page.done();
  }
});
await test('即時模式 4 倍速：玩家不動至終局，重跑摘要一致', async () => {
  const page = await open('N', { seed: 5, stepped: false }); assert.equal(await page.eval("document.getElementById('speed').textContent"), '1×'); await page.clickOn('#speed'); assert.equal(await page.eval("document.getElementById('speed').textContent"), '2×');
  await page.until(`__dev02.mode() === 'end'`, 90000); assert.equal(await page.eval(`document.getElementById('result').textContent`), '敗北'); await same(page); const s = await page.snap(); await page.done(); return `${(s.tick / 30).toFixed(0)} 秒`;
});
await test('四席各買六兵種；模型、盾條、四種飛行中投射物可見；暫停凍結', async () => {
  const page = await open('none', { seed: 11 });
  const seen = { dragoon: false, mutalisk: false, hydralisk: false, wraith: false }, bought = new Set(), KIND = Object.keys(S.padsFor(S.VERSION).reduce((a, p) => ({ ...a, [p.kind]: 1 }), {})); let frozen = false;
  for (let i = 0; i < 4000 && await page.eval('__dev02.mode()') === 'play'; i++) {
    await page.eval('__step(4)');
    const [shots, drawn, units, info] = await page.eval(`[__dev02.mode() === 'end' ? [] : __dev02.snapshot().shots, __dev02.info().projectiles, __dev02.snapshot().units, __dev02.info().drawn]`);
    for (const u of units) bought.add(u.seat + u.kind);
    for (const k of KIND) assert.equal(info[k], units.filter(u => u.kind === k).length, `${k} 繪製數`);
    for (const k of Object.keys(seen)) { assert.equal(drawn[k], shots.filter(s => s.kind === k).length, `${k} 投射物`); if (drawn[k]) seen[k] = true; }
    if (!frozen && drawn.dragoon && drawn.mutalisk) {
      frozen = true; if (SHOTS) await page.shot(path.join(SHOTS, 'projectiles.png'));
      await page.clickOn('#pause'); const a = await page.eval('JSON.stringify(__dev02.snapshot().shots)'); await page.eval('__step(40)'); assert.equal(await page.eval('JSON.stringify(__dev02.snapshot().shots)'), a); assert.equal((await page.eval('__dev02.info().projectiles')).dragoon, drawn.dragoon);
      await page.clickOn('#pause'); await page.eval('__step(20)'); assert.notEqual(await page.eval('JSON.stringify(__dev02.snapshot().shots)'), a);
    }
  }
  assert(frozen && Object.values(seen).every(Boolean), JSON.stringify(seen)); assert.equal(bought.size, 24, `四席六兵種 ${[...bought]}`); assert.equal(await page.eval('__dev02.mode()'), 'end'); await page.eval('__step(2)'); assert.deepEqual(await page.eval('__dev02.info().projectiles'), { dragoon: 0, mutalisk: 0, hydralisk: 0, wraith: 0 }, '終局不留投射物'); await same(page); await page.done();
  // seed 1 觀戰終局時仍有飛行中的投射物
  const left = await open('none', { seed: 1 }); for (let i = 0; i < 300 && await left.eval('__dev02.mode()') === 'play'; i++) await left.eval('__step(300)'); await left.eval('__step(2)'); assert((await left.eval('__dev02.snapshot().shots.length')) > 0); assert.deepEqual(await left.eval('__dev02.info().projectiles'), { dragoon: 0, mutalisk: 0, hydralisk: 0, wraith: 0 }); await left.done();
  for (const quality of ['std', 'high']) {
    const card = await open('N', { quality });
    for (const [kind, name, attack] of [['marine', '陸戰隊（Marine）', '普通'], ['dragoon', '重騎兵（Dragoon）', '指向性爆炸'], ['mutalisk', '飛螳（Mutalisk）', '彈跳'], ['hydralisk', '刺蛇（Hydralisk）', '指向性爆炸'], ['archon', '破壞能（Archon）', '濺射'], ['wraith', '死靈戰機（Wraith）', '對地 8／對空 20']]) {
      await card.clickOn(`[data-profile="${kind}"]`); const text = await card.eval(`document.getElementById('dossier').innerText`); assert(text.includes(name) && text.includes(attack), text);
      if (SHOTS) await card.shot(path.join(SHOTS, `dossier-${quality}-${kind}.png`));
    }
    assert.deepEqual(await card.eval(`[...document.querySelectorAll('#dossier nav button')].map(b => b.innerText.replace(/\\s+/g, ' '))`), ['陸戰隊 Marine', '重騎兵 Dragoon', '飛螳 Mutalisk', '刺蛇 Hydralisk', '破壞能 Archon', '死靈戰機 Wraith', '指揮官 Commander']);
    await card.done();
  }
  for (const [w, h] of [[844, 390], [1600, 900]]) { const p = await open('S', { w, h, quality: 'high', seed: 11 }); await p.eval('__step(30)'); for (let i = 0; i < 22; i++) { await p.down('123456'[i % 6]); await p.up('123456'[i % 6]); await p.eval('__step(60)'); } if (SHOTS) await p.shot(path.join(SHOTS, `battle-${w}.png`));
    assert(await p.eval(`(() => { const r = e => e.getBoundingClientRect(); return [...document.querySelectorAll('#shop button, #dossier nav button')].filter(b => r(b).width).every(b => r(b).left >= 0 && r(b).right <= innerWidth && r(b).bottom <= innerHeight); })()`), `${w} 按鈕在視窗內`); await p.done(); }
  return `${bought.size} 組席位×兵種；投射物數與狀態一致`;
});
await test('半金：價格、扣款與 HUD 顯示 7.5 金', async () => {
  const page = await open('S'); assert.match(await page.eval(`document.querySelector('#shop button').textContent`), /7\.5 金/); assert.equal(await page.eval(`document.getElementById('gold').textContent`), String(gold((await page.snap()).tick)));
  await page.down('1'); await page.up('1'); for (let i = 0; i < 200 && (await page.snap()).seats.S.buys !== 1; i++) await page.eval('__step(1)');
  const s = await page.snap(); assert.equal(s.seats.S.spent, 7.5); assert.equal(await page.eval(`document.getElementById('gold').textContent`), String(gold(s.tick) - 7.5)); assert.match(await page.eval(`document.getElementById('msg').textContent`), /花 7\.5 金/); if (SHOTS) await page.shot(path.join(SHOTS, 'half-gold.png')); await page.done();
});
await test('飛螳拍翅：隨模擬 tick 擺動、各隻錯相、暫停凍結', async () => {
  const page = await open('none', { seed: 11, quality: 'high' }); let tilts = [];
  for (let i = 0; i < 400 && tilts.length < 2; i++) { await page.eval('__step(10)'); tilts = await page.eval('__dev02.wings()'); }
  assert(tilts.length >= 2); const seen = [];
  for (let i = 0; i < 14; i++) { await page.eval('__step(1)'); seen.push((await page.eval('__dev02.wings()'))[0]); }
  assert(Math.max(...seen) > .3 && Math.min(...seen) < -.3 && seen.every(v => Math.abs(v) <= .501), String(seen)); assert(new Set(await page.eval('__dev02.wings()')).size > 1);
  if (SHOTS) { await page.clickOn('#view'); await page.eval('__step(40)'); }
  await page.clickOn('#pause'); await page.eval('__step(2)'); const a = await page.eval('__dev02.wings()'); await page.eval('__step(20)'); assert.deepEqual(await page.eval('__dev02.wings()'), a); await page.done();
  return `角度 ${Math.min(...seen)}～${Math.max(...seen)} rad`;
});
await test('聲音：互動後啟動、分開調整與關閉、保存、限制同時發聲、暫停靜止、不改模擬', async () => {
  const A = p => p.eval('__dev02.audio()'), running = p => p.until(`__dev02.audio().state === 'running'`), stopped = p => p.until(`__dev02.audio().state === 'suspended'`);
  const page = await browser.open(`${url}#seed=11`, { stepped: true, prelude: `if (!sessionStorage.k) { localStorage.clear(); sessionStorage.k = 1 }` });
  await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await page.eval('__step(2)');
  assert.deepEqual([(await A(page)).state, (await A(page)).musicStarted], ['locked', false], '互動前不建立 AudioContext');
  await page.clickOn('[data-seat="none"]'); await running(page); await page.until(`__dev02.audio().musicStarted`); let a = await A(page); assert(a.musicStarted && a.music > 0 && a.sfx > 0 && a.musicSource === 'track' && a.phase === 'opening', JSON.stringify(a)); // 內嵌曲檔實際解碼、開場曲
  for (let i = 0; i < 600 && !(a.played.marine && a.played.dragoon && a.played.mutalisk && a.dropped) && await page.eval('__dev02.mode()') === 'play'; i++) { await page.eval('__step(6)'); await sleep(8); a = await A(page); assert(a.voices <= 6, `聲部 ${a.voices}`); }
  assert(a.played.marine && a.played.dragoon && a.played.mutalisk && a.dropped > 0 && a.peak >= 2 && a.peak <= 6, JSON.stringify(a));
  await sleep(700); assert.equal((await A(page)).voices, 0, '播完釋放聲部'); const total = v => Object.values(v.played).reduce((x, y) => x + y, 0), first = total(await A(page));
  for (let i = 0; i < 100 && total(await A(page)) < first + 3; i++) { await page.eval('__step(6)'); await sleep(90); } assert(total(await A(page)) >= first + 3, '釋放後可再播放'); a = await A(page);
  await page.clickOn('#pause'); await stopped(page); const before = (await A(page)).played; await page.eval('__step(30)'); assert.deepEqual((await A(page)).played, before); await page.clickOn('#pause'); await running(page);
  const click = n => page.eval(`for (let i = 0; i < ${n}; i++) document.getElementById('pause').click()`);
  for (let i = 0; i < 5; i++) { await click(2); await sleep(150); assert.deepEqual([await page.eval('__dev02.mode()'), (await A(page)).state], ['play', 'running']); await click(1); await stopped(page); await click(2); await sleep(150); assert.deepEqual([await page.eval('__dev02.mode()'), (await A(page)).state], ['paused', 'suspended'], '連按後聲音須跟上暫停'); await click(1); await running(page); }
  const label = id => page.eval(`document.getElementById('${id}').textContent`);
  const levels = []; for (let i = 0; i < 4; i++) { await page.clickOn('#opt-sfx'); levels.push([await label('opt-sfx'), (await A(page)).sfx]); }
  assert.deepEqual(levels.map(v => v[0]), ['音效：大', '音效：關', '音效：小', '音效：中']); assert(levels[1][1] === 0 && levels[0][1] > levels[3][1] && levels[3][1] > levels[2][1]);
  await page.clickOn('#opt-sfx'); await page.clickOn('#opt-sfx'); const mute = (await A(page)).played; await page.eval('__step(200)'); assert.deepEqual((await A(page)).played, mute, '音效關閉不播放'); assert((await A(page)).music > 0, '音樂獨立'); await running(page);
  await page.clickOn('#opt-music'); await page.clickOn('#opt-music'); assert.equal(await label('opt-music'), '音樂：關'); await stopped(page); assert.equal((await A(page)).music, 0);
  await page.reload(); await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await page.eval('__step(2)'); assert.deepEqual([await label('opt-music'), await label('opt-sfx')], ['音樂：關', '音效：關']);
  await page.clickOn('[data-seat="N"]'); assert.equal((await A(page)).state, 'locked', '全關時不建立'); await page.clickOn('#opt-music'); await running(page); await page.until(`__dev02.audio().musicStarted`); await page.until(`__dev02.audio().musicSource === 'track'`); assert.equal(await label('opt-music'), '音樂：小');
  await page.eval(`localStorage.setItem('battle_craft.dev02.display', '{"music":9,"sfx":"x"}')`); await page.reload(); await page.until(`!!window.__dev02`); assert.deepEqual([await label('opt-music'), await label('opt-sfx')], ['音樂：中', '音效：中']); assert.deepEqual(page.errors, []); await page.close();
  const mutedRun = await open('N', { seed: 21 }), loudRun = await open('N', { seed: 21 });
  for (const id of ['#opt-music', '#opt-music', '#opt-sfx', '#opt-sfx']) await mutedRun.clickOn(id);
  for (const p of [mutedRun, loudRun]) { while ((await p.snap()).tick < 900) await p.eval('__step(1)'); }
  assert.equal(await mutedRun.eval('__dev02.digest()'), await loudRun.eval('__dev02.digest()'), '聲音不影響模擬'); await mutedRun.done(); await loudRun.done();
  const none = await browser.open(`${url}#seed=7`, { stepped: true, prelude: `window.AudioContext = window.webkitAudioContext = undefined;` });
  await none.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await none.eval('__step(2)'); await none.clickOn('[data-seat="N"]'); await none.clickOn('#opt-sfx'); await none.eval('__step(300)'); assert.equal((await A(none)).state, 'unavailable'); assert((await none.eval('__dev02.snapshot().tick')) >= 300); assert.deepEqual(none.errors, []); await none.close();
  return `播放 ${JSON.stringify(a.played)}、略過 ${a.dropped}、同時峰值 ${a.peak}`;
});
await test('聲音背景與恢復：隱藏／暫停期間戰鬥續跑不發新音效、舊音效已停、恢復與再開局無殘留', async () => {
  const SPY = `localStorage.clear(); window.__src = []; const make = AudioContext.prototype.createBufferSource; AudioContext.prototype.createBufferSource = function () { const s = make.call(this), stop = s.stop.bind(s); s.stops = 0; s.stop = (...a) => { s.stops++; stop(...a); }; __src.push(s); return s; };`;
  const page = await browser.open(`${url}#seed=11`, { stepped: true, prelude: SPY }); await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await page.eval('__step(2)'); await page.clickOn('[data-seat="none"]'); await page.until(`__dev02.audio().state === 'running'`);
  const A = () => page.eval('__dev02.audio()'), total = v => Object.values(v.played).reduce((a, b) => a + b, 0);
  const battle = async () => { for (let i = 0; i < 300 && !(await A()).voices; i++) { await page.eval('__step(3)'); await sleep(20); } assert((await A()).voices > 0, '應有發聲中的音效'); };
  const music = () => page.eval('__src.filter(s => s.loop).map(s => s.stops)');
  for (const [via, enter, leave] of [
    ['暫停', `document.getElementById('pause').click()`, `document.getElementById('pause').click()`],
    ['模擬隱藏', `Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))`, `delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))`],
  ]) {
    await battle();
    // 同一工作內進入靜止並讀值：此時 suspend() 尚未完成
    const sounding = await page.eval('__dev02.audio().voices'), stops = () => page.eval('__src.filter(s => !s.loop && s.stops).length'), was = await stops();
    const inside = await page.eval(`(() => { ${enter}; return __dev02.audio(); })()`);
    assert.equal(inside.voices, 0, via); assert(await stops() - was >= 1 && sounding >= 1, '發聲中的來源應被停掉'); const before = total(inside), tick = await page.eval('__dev02.snapshot().tick');
    await page.until(`__dev02.audio().state === 'suspended'`);
    if (via === '模擬隱藏') await page.until(`__dev02.snapshot().tick > ${tick + 60}`, 15000); else await page.eval('__step(60)');
    assert.equal(total(await A()), before, `${via}期間不發新音效`);
    const resumed = await page.eval(`(() => { ${leave}; return __dev02.audio(); })()`); assert.equal(resumed.voices, 0);
    await page.until(`__dev02.audio().state === 'running'`); assert.equal((await A()).voices, 0, '恢復後無續播'); assert.deepEqual(await music(), [0], '音樂同一條、未停掉');
  }
  await battle(); await page.eval(`document.getElementById('again').click()`); assert.equal((await A()).voices, 0); await page.until(`__dev02.audio().state === 'running'`); await page.clickOn('[data-seat="N"]'); assert.equal((await A()).voices, 0);
  await page.eval('__step(30)'); assert.deepEqual(await music(), [0]); assert.deepEqual(page.errors, []); await page.close();
  // 真實背景：另開分頁蓋到前景
  const real = await browser.open(`${url}#seed=11`, { prelude: SPY }); await real.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`); await real.send('Emulation.setFocusEmulationEnabled', { enabled: false }); await real.clickOn('[data-seat="none"]'); await real.until(`__dev02.audio().voices > 0`, 30000);
  const cover = await browser.open('about:blank'); await cover.send('Page.bringToFront');
  let hidden = false; for (let i = 0; i < 40 && !hidden; i++) { await sleep(50); hidden = await real.eval('document.hidden'); }
  if (hidden) {
    await real.until(`__dev02.audio().state === 'suspended'`); const a = await real.eval('[__dev02.audio(), __dev02.snapshot().tick]'); await sleep(2500); const b = await real.eval('[__dev02.audio(), __dev02.snapshot().tick]');
    assert(b[1] > a[1], '背景續跑'); assert.equal(b[0].voices, 0); assert.deepEqual(b[0].played, a[0].played);
    await real.send('Page.bringToFront'); await real.until(`!document.hidden && __dev02.audio().state === 'running'`);
  }
  await cover.close(); assert.deepEqual(real.errors, []); await real.close();
  return hidden ? '含真實分頁隱藏' : '真實分頁未能進入隱藏，僅模擬';
});
await test('終局與音樂階段：開場→激戰只切一次並維持到終局、曲名顯示；勝／敗立即停掉戰鬥音效且不再新啟動；只開音樂、只開音效、再來一局', async () => {
  const A = p => p.eval('__dev02.audio()'), total = v => Object.values(v.played).reduce((x, y) => x + y, 0), out = [];
  for (const [seat, music, sfx, seed] of [['S', true, true, 11], ['N', true, false, 11], ['E', false, true, 3]]) { // 種子 3 東席閒置仍勝（Node 搜尋）
    const page = await open(seat, { seed });
    if (!sfx) { await page.clickOn('#opt-sfx'); await page.clickOn('#opt-sfx'); } if (!music) { await page.clickOn('#opt-music'); await page.clickOn('#opt-music'); }
    let a = await A(page), busy = 0; const phases = [];
    if (music) { await page.until(`__dev02.audio().musicSource === 'track'`); a = await A(page); assert(TRACKS.some(t => t.id === a.track && t.phase === 'opening'), a.track); assert.equal(await page.eval(`document.getElementById('now-playing').hidden`), false); const label = await page.eval(`document.getElementById('now-playing').textContent`); assert(label.includes(TRACKS.find(t => t.id === a.track).title), label); }
    else assert.equal(await page.eval(`document.getElementById('now-playing').hidden`), true, '音樂關閉不顯示曲名');
    for (let i = 0; i < 3000 && await page.eval('__dev02.mode()') === 'play'; i++) {
      await page.eval('__step(15)'); a = await A(page); busy = Math.max(busy, a.voices);
      if (phases.at(-1)?.[0] !== a.phase) phases.push([a.phase, (await page.snap()).tick, Object.values((await page.snap()).seats).some(v => v.hp < S.coreMax(S.VERSION))]);
    }
    assert.deepEqual(phases.map(p => p[0]), ['opening', 'battle'], JSON.stringify(phases)); const [, at, hit] = phases[1]; assert(hit || at >= BATTLE_AT_SECONDS * S.HZ, '激戰觸發條件'); // 只切一次，維持到對局結束
    if (music) { await page.until(`__dev02.audio().phase === 'battle' && __dev02.audio().musicSource === 'track'`); const now = (await A(page)).track; assert(TRACKS.some(t => t.id === now && t.phase === 'battle'), now); }
    assert.equal(await page.eval('__dev02.mode()'), 'end'); a = await A(page);
    const rec = await page.eval('__dev02.record()'); assert.equal(rec.digest, await page.eval('__dev02.digest()'), '終局紀錄應寫入摘要'); assert.equal(rec.ticks, (await page.snap()).tick); assert.match(rec.digest, /^[0-9a-f]{8}$/);
    assert.equal(a.voices, 0, `${seat} 終局仍有 ${a.voices} 個音效`); const played = total(a); if (sfx) assert(played > 0 && busy > 0); else assert.equal(played, 0, '只開音樂不得有音效');
    await page.eval('__step(90)'); await sleep(400); a = await A(page); assert.equal(total(a), played, '終局後不得新啟動音效'); assert.equal(a.voices, 0);
    assert(music ? a.musicStarted && a.music > 0 : a.music === 0, `音樂照設定 ${JSON.stringify(a)}`); if (music) assert.equal(a.state, 'running', '終局後音樂續播');
    const result = await page.eval(`document.getElementById('result').textContent`);
    await page.clickOn('#restart'); await page.clickOn(`[data-seat="${seat}"]`); await page.eval('__step(2)'); a = await A(page);
    assert.equal(a.phase, 'opening', '新的一局回到開場');
    assert.equal(await page.eval('__dev02.mode()'), 'play'); assert.equal(a.voices, 0); assert(music ? a.musicStarted && a.music > 0 : a.music === 0);
    if (sfx) { for (let i = 0; i < 200 && total(await A(page)) === played; i++) await page.eval('__step(15)'); assert(total(await A(page)) > played, '再來一局音效恢復'); }
    out.push(`${seat}${result}:${music ? '樂' : ''}${sfx ? '效' : ''}@${(phases[1][1] / S.HZ).toFixed(0)}s`); await page.done();
  }
  assert(out.some(r => r.includes('勝利')) && out.some(r => r.includes('敗北')), out.join(' ')); return out.join(' ');
});
await sleep(50); await browser.close();
console.table(rows); console.log(`DEV02 browser QA: OK (${browser.angle})`);
