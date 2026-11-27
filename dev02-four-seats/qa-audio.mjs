// 合成音訊驗收（純 Node）：長度、音量範圍、彼此可區分、背景音樂循環接點；合成器不引入音檔，播放端只解碼內嵌的 CC0 曲檔；曲目表與激戰觸發。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RATE, SOUNDS, MUSIC, renderSound, renderMusic } from './audio-synth.mjs';
import { KIND_IDS } from './roster.mjs';
import { loopRange, TRIM_LIMIT } from './audio.js';
import { TRACKS, PHASES, BATTLE_AT_SECONDS, battleDue } from './music-tracks.mjs';

const rows = [], test = (name, fn) => rows.push({ 案例: name, 摘要: fn() ?? '' });
const rms = d => Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length), peak = d => d.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
const brightness = d => d.reduce((a, v, i) => a + (i && (v >= 0) !== (d[i - 1] >= 0) ? 1 : 0), 0) / (d.length / RATE) / 2; // 過零估計頻率
test(`${KIND_IDS.length} 兵種各有一個音效：短、有聲、不削波、收尾歸零、可重現`, () => {
  assert.deepEqual(Object.keys(SOUNDS), KIND_IDS);
  return KIND_IDS.map(k => { const d = renderSound(k); assert(d.length === Math.round(SOUNDS[k].seconds * RATE) && d.length < RATE * .6); assert(d.every(Number.isFinite)); assert(Math.abs(peak(d) - .9) < 1e-6 && rms(d) > .03, k); assert(Math.abs(d[0]) < .05 && Math.abs(d.at(-1)) < .05); assert.deepEqual(renderSound(k), d); return `${k} ${SOUNDS[k].seconds} 秒 RMS ${rms(d).toFixed(2)} 約 ${brightness(d).toFixed(0)} Hz`; }).join('；');
});
test(`${KIND_IDS.length} 個音效彼此可區分（亮度兩兩相差 8% 以上）`, () => {
  const [a, b, c] = KIND_IDS.map(k => brightness(renderSound(k))); assert(a > c && c > b * 1.3, `${a} ${b} ${c}`);
  const all = KIND_IDS.map(k => brightness(renderSound(k))); for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert(Math.abs(all[i] / all[j] - 1) > .08, `${KIND_IDS[i]} ${KIND_IDS[j]} ${all[i]} ${all[j]}`);
  return KIND_IDS.map((k, i) => `${k} ${all[i].toFixed(0)}`).join('、');
});
test('合成背景音樂（2026-11-27 起不播放，保留對照）：24 秒循環、不削波、接點無跳變、各小節皆有聲', () => {
  const d = renderMusic(), bar = d.length / 8;
  assert.equal(d.length, Math.round(MUSIC.beats * 60 / MUSIC.bpm * RATE)); assert(Math.abs(peak(d) - .8) < 1e-6);
  let step = 0; for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
  assert(Math.abs(d[0] - d.at(-1)) <= step, '接點跳變');
  const bars = Array.from({ length: 8 }, (_, i) => rms(d.subarray(i * bar, (i + 1) * bar))); assert(Math.min(...bars) > .05, String(bars));
  return `${(d.length / RATE).toFixed(0)} 秒，小節 RMS ${Math.min(...bars).toFixed(2)}～${Math.max(...bars).toFixed(2)}`;
});
test('不從網路或外部路徑載入音檔：合成器不碰音檔；播放端只解碼呼叫端傳入的內嵌曲檔', () => {
  const src = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
  assert(!/fetch\(|new Audio|\.(mp3|ogg|wav|m4a)|data:audio|decodeAudioData/i.test(src('audio-synth.mjs')), 'audio-synth.mjs');
  assert(!/fetch\(|new Audio|\.(mp3|ogg|wav|m4a)|data:audio|XMLHttpRequest/i.test(src('audio.js')), 'audio.js');
  assert.equal(src('audio.js').match(/decodeAudioData/g).length, 1, '只有一處解碼');
});
test('曲目表：開場／激戰各三首、id 不重複、檔案存在、授權為 CC0 或 CC BY 4.0（須署名）；單檔 HTML 內嵌位元相同', () => { // 讀已追蹤的輸出，不需先建置
  assert.deepEqual(PHASES.map(p => TRACKS.filter(t => t.phase === p).length), [3, 3], '使用者指定開場、激戰各三首'); assert.equal(new Set(TRACKS.map(t => t.id)).size, TRACKS.length);
  const html = fs.readFileSync(new URL('battle_craft-dev02.html', import.meta.url), 'utf8');
  return TRACKS.map(t => { assert(['CC0', 'CC BY 4.0'].includes(t.license) && t.title && t.author, t.id); if (t.license !== 'CC0') assert(t.credit.startsWith(`"${t.title}" ${t.author} (incompetech.com) Licensed under Creative Commons: By Attribution 4.0`) && t.credit.includes('creativecommons.org/licenses/by/4.0') && t.credit.includes('調整'), '署名格式（incompetech 原站 Attribution Code＋修改說明）'); const file = fs.readFileSync(new URL(`../assets/music/${t.file}`, import.meta.url)); assert(html.includes(`"${file.toString('base64')}"`), t.id); return `${t.id} ${file.length} B`; }).join('、');
});
test('激戰觸發：任一核心首次受損或滿 BATTLE_AT_SECONDS 秒，取較早者', () => {
  const seats = hp => ({ N: { hp: 900 }, S: { hp } });
  assert.equal(battleDue({ tick: 0, seats: seats(900) }, 900, 30), false);
  assert.equal(battleDue({ tick: 30 * BATTLE_AT_SECONDS - 1, seats: seats(900) }, 900, 30), false);
  assert.equal(battleDue({ tick: 30 * BATTLE_AT_SECONDS, seats: seats(900) }, 900, 30), true);
  assert.equal(battleDue({ tick: 10, seats: seats(899.5) }, 900, 30), true); return `${BATTLE_AT_SECONDS} 秒`;
});
test('循環區間：略過頭尾補零（上限 TRIM_LIMIT），兩聲道取有聲者', () => {
  const ch = n => new Float32Array(n), a = ch(10000), b = ch(10000); a.fill(.5, 300, 9000); b.fill(.5, 200, 8000);
  assert.deepEqual(loopRange([a, b]), [200, 9000]);
  const z = ch(10000); assert.deepEqual(loopRange([z]), [TRIM_LIMIT, 10000 - TRIM_LIMIT], '全靜音最多各略過上限');
  const c = ch(100); c[0] = c[99] = 1; assert.deepEqual(loopRange([c]), [0, 100]);
});
console.table(rows); console.log('audio QA: OK');
