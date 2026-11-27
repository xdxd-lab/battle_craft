// 原創程序合成的音效與背景音樂：只用正弦波與固定種子雜訊即時算出，沒有任何外部或遊戲原作音檔。
// 純函式（回傳 Float32Array），Node 可直接檢查。
export const RATE = 22050;
export const SOUNDS = {
  marine: { name: '陸戰隊：雙發短促步槍聲', seconds: .16, gain: .5 },
  dragoon: { name: '重騎兵：低沉能量砲', seconds: .45, gain: .75 },
  mutalisk: { name: '飛螳：顫音拋射聲', seconds: .24, gain: .55 },
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
