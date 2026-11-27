// 合成音訊驗收（純 Node）：長度、音量範圍、彼此可區分、背景音樂循環接點；不引入任何音檔。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RATE, SOUNDS, MUSIC, renderSound, renderMusic } from './audio-synth.mjs';
import { KIND_IDS } from './roster.mjs';

const rows = [], test = (name, fn) => rows.push({ 案例: name, 摘要: fn() ?? '' });
const rms = d => Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length), peak = d => d.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
const brightness = d => d.reduce((a, v, i) => a + (i && (v >= 0) !== (d[i - 1] >= 0) ? 1 : 0), 0) / (d.length / RATE) / 2; // 過零估計頻率
test('三兵種各有一個音效：短、有聲、不削波、收尾歸零、可重現', () => {
  assert.deepEqual(Object.keys(SOUNDS), KIND_IDS);
  return KIND_IDS.map(k => { const d = renderSound(k); assert(d.length === Math.round(SOUNDS[k].seconds * RATE) && d.length < RATE * .6); assert(d.every(Number.isFinite)); assert(Math.abs(peak(d) - .9) < 1e-6 && rms(d) > .03, k); assert(Math.abs(d[0]) < .05 && Math.abs(d.at(-1)) < .05); assert.deepEqual(renderSound(k), d); return `${k} ${SOUNDS[k].seconds} 秒 RMS ${rms(d).toFixed(2)} 約 ${brightness(d).toFixed(0)} Hz`; }).join('；');
});
test('三個音效彼此可區分（亮度明顯不同）', () => {
  const [a, b, c] = KIND_IDS.map(k => brightness(renderSound(k))); assert(a > c && c > b * 1.3, `${a} ${b} ${c}`);
});
test('背景音樂：24 秒循環、不削波、接點無跳變、各小節皆有聲', () => {
  const d = renderMusic(), bar = d.length / 8;
  assert.equal(d.length, Math.round(MUSIC.beats * 60 / MUSIC.bpm * RATE)); assert(Math.abs(peak(d) - .8) < 1e-6);
  let step = 0; for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]));
  assert(Math.abs(d[0] - d.at(-1)) <= step, '接點跳變');
  const bars = Array.from({ length: 8 }, (_, i) => rms(d.subarray(i * bar, (i + 1) * bar))); assert(Math.min(...bars) > .05, String(bars));
  return `${(d.length / RATE).toFixed(0)} 秒，小節 RMS ${Math.min(...bars).toFixed(2)}～${Math.max(...bars).toFixed(2)}`;
});
test('原始碼不載入任何音檔', () => {
  for (const f of ['audio.js', 'audio-synth.mjs']) assert(!/fetch\(|new Audio|\.(mp3|ogg|wav|m4a)|data:audio|decodeAudioData/i.test(fs.readFileSync(new URL(f, import.meta.url), 'utf8')), f);
});
console.table(rows); console.log('audio QA: OK');
