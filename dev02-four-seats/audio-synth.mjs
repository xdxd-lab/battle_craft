// 原創程序合成的音效與背景音樂：只用正弦波與固定種子雜訊即時算出，沒有任何外部或遊戲原作音檔。
// 純函式（回傳 Float32Array），Node 可直接檢查。
export const RATE = 22050;
export const SOUNDS = {
  marine: { name: '陸戰隊：雙發短促步槍聲', seconds: .16, gain: .5 },
  dragoon: { name: '重騎兵：低沉能量砲', seconds: .45, gain: .75 },
  mutalisk: { name: '飛螳：顫音拋射聲', seconds: .24, gain: .55 },
  hydralisk: { name: '刺蛇：濕性噴刺聲', seconds: .18, gain: .5 },
  archon: { name: '破壞能：靈能電弧爆裂', seconds: .4, gain: .6 },
  wraith: { name: '死靈戰機：三連短雷射', seconds: .22, gain: .45 },
  battlecruiser: { name: '戰鬥巡洋艦：低頻重砲台雙響', seconds: .42, gain: .7 },
  scout: { name: '斥候：雙發光子短脈衝', seconds: .2, gain: .45 },
  scourge: { name: '自殺蟲：濕性爆裂', seconds: .32, gain: .65 },
};
const TAU = Math.PI * 2;
const noise = seed => { let v = seed >>> 0 || 1; return () => { v ^= v << 13; v ^= v >>> 17; v ^= v << 5; return (v >>> 0) / 2147483648 - 1; }; };
const normalize = (data, peak) => { let max = 0; for (const v of data) max = Math.max(max, Math.abs(v)); if (max) for (let i = 0; i < data.length; i++) data[i] *= peak / max; return data; };
const voices = {
  marine(rnd) {
    let low = 0;
    return t => { let out = 0; for (const [at, level] of [[0, 1], [.055, .7]]) { const u = t - at; if (u < 0) continue; const n = rnd(); low += (n - low) * .25; out += level * ((n - low) * Math.exp(-u * 85) + .8 * Math.sin(TAU * (170 * u - 700 * u * u)) * Math.exp(-u * 48)); } return out; };
  },
  dragoon(rnd) {
    let low = 0, phase = 0;
    return t => { phase += TAU * (62 + 250 * Math.exp(-t * 11)) / RATE; low += (rnd() - low) * .12; return (Math.sin(phase) + .35 * Math.sin(phase * 2.01)) * Math.exp(-t * 7) + .25 * Math.sin(TAU * 910 * t) * Math.sin(TAU * 37 * t) * Math.exp(-t * 11) + 1.4 * low * Math.exp(-t * 26); };
  },
  mutalisk(rnd) {
    let low = 0, phase = 0;
    return t => { phase += TAU * (230 + 520 * Math.exp(-t * 13) + 150 * Math.sin(TAU * 46 * t)) / RATE; low += (rnd() - low) * .4; return (Math.sin(phase + 1.6 * Math.sin(phase * .5)) + .5 * low * Math.sin(TAU * 28 * t)) * Math.exp(-t * 14); };
  },
  hydralisk(rnd) { // 帶通雜訊「嘶」＋快速下滑的短促彈射音
    let a = 0, b = 0;
    return t => { const n = rnd(); a += (n - a) * .55; b += (a - b) * .3; return 1.6 * (a - b) * Math.exp(-t * 30) + .7 * Math.sin(TAU * (520 * t - 900 * t * t)) * Math.exp(-t * 28); };
  },
  archon(rnd) { // 環形調變的明亮電弧，夾雜隨機爆裂
    let crack = 0, phase = 0;
    return t => { phase += TAU * (260 + 120 * Math.sin(TAU * 9 * t)) / RATE; if (rnd() > .97) crack = 1; crack *= .93;
      return (Math.sin(phase) * Math.sin(TAU * 760 * t) + .5 * Math.sin(phase * .5)) * Math.exp(-t * 6) + .8 * crack * rnd() * Math.exp(-t * 4); };
  },
  battlecruiser(rnd) { // 兩記低頻砲擊，各帶短促金屬泛音與雜訊尾
    let low = 0;
    return t => { let out = 0; for (const at of [0, .14]) { const u = t - at; if (u < 0) continue; low += (rnd() - low) * .08; out += (Math.sin(TAU * (90 * u + 160 * (1 - Math.exp(-u * 20)) / 20)) + .4 * Math.sin(TAU * 1240 * u) * Math.exp(-u * 30) + 1.2 * low) * Math.exp(-u * 9); } return out; };
  },
  scout() { // 兩記上滑的明亮短脈衝
    return t => { let out = 0; for (const at of [0, .08]) { const u = t - at; if (u < 0 || u > .09) continue; out += Math.sin(TAU * (2600 * u + 6000 * u * u)) * Math.exp(-u * 40) * Math.min(1, u / .002, (.09 - u) / .004); } return out; };
  },
  scourge(rnd) { // 低通雜訊爆裂＋快速下滑的濕性尾音
    let a = 0;
    return t => { a += (rnd() - a) * .2; return 1.8 * a * Math.exp(-t * 12) + .6 * Math.sin(TAU * (300 * t - 380 * t * t)) * Math.exp(-t * 10); };
  },
  wraith() { // 三發等距高頻雷射，各自快速下滑
    return t => { let out = 0; for (let k = 0; k < 3; k++) { const u = t - k * .065; if (u < 0 || u > .07) continue; out += Math.sin(TAU * (1900 * u - 9000 * u * u)) * Math.exp(-u * 45) * Math.min(1, u / .002, (.07 - u) / .004); } return out; };
  },
};
export function renderSound(kind) {
  const { seconds } = SOUNDS[kind], data = new Float32Array(Math.round(seconds * RATE)), voice = voices[kind](noise(kind.length * 7919));
  for (let i = 0; i < data.length; i++) { const t = i / RATE; data[i] = voice(t) * Math.min(1, t / .002, (seconds - t) / .02); }
  return normalize(data, .9);
}

// 背景音樂：80 BPM、8 小節、D 小調的低速工業氛圍循環。超出結尾的尾音繞回開頭，循環點沒有斷音。
export const MUSIC = { bpm: 80, beats: 32 };
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 50, 52]]; // 每兩小節一個
export function renderMusic() {
  const beat = 60 / MUSIC.bpm, length = Math.round(MUSIC.beats * beat * RATE), data = new Float32Array(length), rnd = noise(20261127);
  const add = (at, seconds, fn) => { const start = Math.round(at * RATE), n = Math.round(seconds * RATE); for (let i = 0; i < n; i++) data[(start + i) % length] += fn(i / RATE, seconds); };
  CHORDS.forEach((chord, c) => {
    const from = c * 8 * beat;
    for (const midi of chord) for (const detune of [-.12, .12]) { // 鋪底：慢起慢收、左右微失諧
      const f = hz(midi + detune);
      add(from, 8 * beat + 1.4, (t, s) => .05 * Math.min(1, t / 1.4, (s - t) / 1.4) * (Math.sin(TAU * f * t) + .3 * Math.sin(TAU * 2 * f * t) + .12 * Math.sin(TAU * 3 * f * t)));
    }
    for (let e = 0; e < 16; e++) { // 低音脈動
      const f = hz(chord[0] - 12), level = e % 4 === 0 ? .2 : .11;
      add(from + e * beat / 2, beat * .45, (t, s) => level * Math.min(1, t / .01, (s - t) / .03) * Math.tanh(2 * Math.sin(TAU * f * t)) * Math.exp(-t * 6));
    }
    [[1.5, 2], [3, 1], [5.5, 0], [6.5, 2]].forEach(([at, note]) => { // 稀疏高音點綴
      const f = hz(chord[(note + c) % 3] + 24);
      add(from + at * beat, 1.2, (t, s) => .055 * Math.min(1, t / .008, (s - t) / .2) * Math.sin(TAU * f * t + .6 * Math.sin(TAU * f * 2.76 * t)) * Math.exp(-t * 3.5));
    });
  });
  for (let b = 0; b < MUSIC.beats; b++) {
    if (b % 2 === 0) add(b * beat, .3, t => .22 * Math.sin(TAU * (48 * t + 3 * (1 - Math.exp(-t * 30)))) * Math.exp(-t * 14) * Math.min(1, t / .004));
    let low = 0;
    add((b + .5) * beat, .08, (t, s) => { const n = rnd(); low += (n - low) * .5; return .05 * (n - low) * Math.exp(-t * 60) * Math.min(1, (s - t) / .01); });
  }
  return normalize(data, .8);
}
