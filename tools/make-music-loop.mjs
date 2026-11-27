// 背景音樂循環檔製作（需本機 ffmpeg）：
//   解碼（可選動態壓縮）→ 尾段等功率交叉淡入開頭 → 依「小喇叭響度」對齊 → 限幅 → MP3。
// 小喇叭響度＝經 200 Hz 二階高通後的 EBU R128 整體響度：筆電／手機喇叭放不出低頻，只看全頻 LUFS 會把低頻曲調得「數字夠、聽不到」。
// 用法：node tools/make-music-loop.mjs <原檔> <輸出.mp3> [--fade 2] [--target -21] [--compress [--dyn <ffmpeg 濾鏡>]] [--kbps 96]
import { execFileSync, spawnSync } from 'node:child_process';
const args = process.argv.slice(2), [src, out] = args, opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const fade = +opt('--fade', 2), target = +opt('--target', -21), kbps = opt('--kbps', '96'), compress = args.includes('--compress');
const RATE = 44100, CH = 2, FF = 'ffmpeg', fmt = ['-f', 'f32le', '-ac', String(CH), '-ar', String(RATE)];
const pcm = buf => Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength), f32 = b => new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
// 壓縮：只用在動態範圍過大的曲（如〈Pulse〉），把長段近乎無聲的部分拉起來，不改節奏
const dyn = opt('--dyn', 'dynaudnorm=f=400:g=21:p=0.9:m=12:s=8');
const x0 = f32(execFileSync(FF, ['-v', 'error', '-i', src, ...(compress ? ['-af', dyn] : []), ...fmt, '-'], { maxBuffer: 1 << 30 }));
function measure(buf, hp) { // 回傳整體 LUFS 與每 0.5 秒的瞬時響度
  const s = spawnSync(FF, ['-hide_banner', '-nostats', ...fmt, '-i', '-', '-af', `${hp ? 'highpass=f=200,highpass=f=200,' : ''}ebur128`, '-f', 'null', '-'], { input: pcm(buf), maxBuffer: 1 << 28 }).stderr.toString(), I = +s.match(/I:\s+(-?[\d.]+) LUFS\s*\n\s+Threshold/)[1], half = [];
  for (const r of s.matchAll(/t:\s*([\d.]+).*?M:\s*(-?[\d.]+)/g)) half[Math.floor(+r[1] * 2)] = +r[2];
  return { I, momentary: half.filter(v => v !== undefined) };
}
// 先對齊響度並限幅（峰值上限 .84，約 −1.5 dB），再做循環交叉：限幅器的延遲只會位移整段，不會破壞接點
const gain = 10 ** ((target - measure(x0, true).I) / 20), boosted = x0.map(v => v * gain);
const x = f32(execFileSync(FF, ['-v', 'error', ...fmt, '-i', '-', '-af', 'alimiter=limit=0.84:attack=5:release=80:level=false', ...fmt, '-'], { input: pcm(boosted), maxBuffer: 1 << 30 }));
const frames = x.length / CH, F = Math.round(fade * RATE), n = frames - F, z = new Float32Array(n * CH);
for (let f = 0; f < n; f++) for (let c = 0; c < CH; c++) {
  let v = x[f * CH + c];
  if (f < F) { const t = (f + .5) / F; v = v * Math.sin(t * Math.PI / 2) + x[(n + f) * CH + c] * Math.cos(t * Math.PI / 2); } // 結尾接回開頭時，接上原曲的下一個取樣
  z[f * CH + c] = v;
}
const hp = measure(z, true), full = measure(z, false), len = z.length / CH;
let peak = 0; for (const v of z) peak = Math.max(peak, Math.abs(v));
const seam = Math.max(...[0, 1].map(c => Math.abs(z[c] - z[(len - 1) * CH + c])));
let typical = 0; for (let f = 1; f < len; f++) typical += Math.abs(z[f * CH] - z[(f - 1) * CH]); typical /= len - 1;
execFileSync(FF, ['-v', 'error', '-y', ...fmt, '-i', '-', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, out], { input: pcm(z) });
const q = hp.momentary.slice(1).sort((a, b) => a - b); // 略過第一個 0.5 秒（量測暖機）
console.log(JSON.stringify({ out, seconds: +(len / RATE).toFixed(3), compress, gainDb: +(20 * Math.log10(gain)).toFixed(1), fullLufs: full.I, speakerLufs: hp.I,
  speakerMomentary: { min: q[0], p5: q[Math.floor(q.length * .05)], p50: q[Math.floor(q.length / 2)] }, peak: +peak.toFixed(3), seamStep: +seam.toFixed(4), typicalStep: +typical.toFixed(4) }));
