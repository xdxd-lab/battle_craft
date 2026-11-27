// 背景音樂循環檔製作：解碼原檔 → 尾段等功率交叉淡入開頭 → 峰值正規化到 .8 → 96 kbps 立體聲 MP3。需本機 ffmpeg。
// 用法：node tools/make-music-loop.mjs <原檔> <輸出.mp3> [交叉秒數=2]
import { execFileSync } from 'node:child_process';
const [src, out, fadeArg = '2'] = process.argv.slice(2), RATE = 44100, CH = 2;
const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', src, '-f', 'f32le', '-ac', String(CH), '-ar', String(RATE), '-'], { maxBuffer: 1 << 30 });
const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), frames = x.length / CH, F = Math.round(+fadeArg * RATE);
const at = (f, c) => x[f * CH + c];
const n = frames - F, y = new Float32Array(n * CH);
for (let f = 0; f < n; f++) for (let c = 0; c < CH; c++) {
  let v = at(f, c);
  if (f < F) { const t = (f + .5) / F; v = v * Math.sin(t * Math.PI / 2) + at(n + f, c) * Math.cos(t * Math.PI / 2); }
  y[f * CH + c] = v;
}
let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v));
const gain = .8 / peak; for (let i = 0; i < y.length; i++) y[i] *= gain; // 峰值對齊合成音樂（.8），音樂音量設定的級距維持一致
const jump = c => Math.abs(y[c] - y[(n - 1) * CH + c]), step = Math.max(...[0, 1].map(jump));
let typical = 0; for (let f = 1; f < n; f++) typical += Math.abs(y[f * CH] - y[(f - 1) * CH]); typical /= n - 1;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ac', String(CH), '-ar', String(RATE), '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', out], { input: Buffer.from(y.buffer) });
console.log(JSON.stringify({ seconds: +(n / RATE).toFixed(3), crossfade: +fadeArg, sourcePeak: +peak.toFixed(3), gain: +gain.toFixed(3), seamStep: +step.toFixed(4), typicalStep: +typical.toFixed(4) }));
