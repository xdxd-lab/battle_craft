// 真實瀏覽器輸出錄音：攔截接到 destination 的連線，同步送進 MediaStreamDestination 錄成 webm。
// 用法：node tools/record-audio.mjs <html> <輸出.webm> [hash] [秒數=25] [音量設定 JSON，預設 {"music":2,"sfx":0}]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { launch, sleep } from './browser.mjs';
const [html, out, hash = '', secs = '25', levels = '{"music":2,"sfx":0}'] = process.argv.slice(2);
const prelude = `
try { localStorage.setItem('battle_craft.dev02.display', JSON.stringify(Object.assign({ bars: true, log: false, engineering: false, quality: 'std' }, ${levels}))); } catch {}
const C = window.AudioContext, orig = AudioNode.prototype.connect;
AudioNode.prototype.connect = function (to, ...r) { const res = orig.call(this, to, ...r); if (to instanceof AudioDestinationNode) { const c = this.context; c.__tap ??= c.createMediaStreamDestination(); orig.call(this, c.__tap); window.__ctx = c; } return res; };`;
const browser = await launch({ width: 1280, height: 720, args: ['--autoplay-policy=user-gesture-required'] });
const page = await browser.open(pathToFileURL(html).href + hash, { prelude });
await page.until(`!!window.__dev02 && !!document.querySelector('[data-seat]')`);
await page.clickOn('[data-seat="S"]'); // 真實點擊＝使用者手勢
await page.until(`window.__ctx?.state === 'running' && !!window.__ctx.__tap`);
await page.eval(`window.__chunks = []; window.__rec = new MediaRecorder(window.__ctx.__tap.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 }); __rec.ondataavailable = e => __chunks.push(e.data); __rec.start(); true`);
await sleep(+secs * 1000);
const info = await page.eval('JSON.stringify(__dev02.audio())');
const b64 = await page.eval(`new Promise(done => { __rec.onstop = async () => { const b = new Blob(__chunks); const a = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode(...a.subarray(i, i + 32768)); done(btoa(s)); }; __rec.stop(); })`);
fs.writeFileSync(out, Buffer.from(b64, 'base64')); console.log(info, page.errors); await page.close(); await browser.close?.(); process.exit(0);
