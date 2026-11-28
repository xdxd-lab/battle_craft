// 實際 Chrome 版面與點擊：曲名、訊息和購兵列在窄橫式畫面仍各自可用。
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch } from '../tools/browser.mjs';
import { TRACKS } from './music-tracks.mjs';

const url = pathToFileURL(fileURLToPath(new URL('./battle_craft-v6-0-offline.html', import.meta.url))).href;
const browser = await launch();
const sizes = [[667, 375], [640, 375], [740, 360], [844, 390], [1280, 720]];
const longest = TRACKS.map(t => `♪ ${t.phase === 'opening' ? '開場' : '激戰'}｜${t.title} — ${t.author}（${t.license}）`).sort((a, b) => b.length - a.length)[0];

try {
  for (const [w, h] of sizes) {
    const page = await browser.open(`${url}#seed=7`, { stepped: true, w, h });
    try {
      await page.until('!!window.__dev02 && !!document.querySelector("[data-seat]")');
      await page.eval('__step(2)');
      await page.clickOn('[data-seat="S"]');
      await page.until("__dev02.audio().musicSource === 'track'");
      for (const panelOpen of [false, true]) {
        await page.eval(`document.getElementById('panel').open = ${panelOpen}`);
        for (const title of [null, longest]) {
          const result = await page.eval(`(() => {
            const now = document.getElementById('now-playing'), old = now.textContent;
            if (${JSON.stringify(title)} !== null) now.textContent = ${JSON.stringify(title)};
            const rect = e => e.getBoundingClientRect();
            const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
            const n = rect(now), bar = rect(document.getElementById('bar'));
            const panel = rect(document.getElementById('panel'));
            const msg = rect(document.getElementById('msg'));
            const buttons = [...document.querySelectorAll('#shop button')].map(button => {
              const r = rect(button), x = r.left + r.width / 2, y = r.top + r.height / 2;
              return { rect: [r.left, r.top, r.right, r.bottom], inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
                fits: button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1,
                clear: !hit(r, n) && !hit(r, bar) && !hit(r, msg) && (!${panelOpen} || !hit(r, panel)),
                clickable: document.elementFromPoint(x, y)?.closest('#shop button') === button };
            });
            const out = { now: { visible: !now.hidden && n.width > 0 && n.height > 0, inView: n.left >= 0 && n.top >= 0 && n.right <= innerWidth && n.bottom <= innerHeight,
              fits: now.scrollWidth <= now.clientWidth + 1, text: now.textContent }, buttons };
            now.textContent = old;
            return out;
          })()`);
          assert(result.now.visible && result.now.inView && result.now.fits, `${w}x${h} 曲名 ${JSON.stringify(result.now)}`);
          assert.equal(result.buttons.length, 9);
          assert(result.buttons.every(b => b.inView && b.fits && b.clear && b.clickable), `${w}x${h} panel=${panelOpen} 曲名=${title ?? '播放中'} ${JSON.stringify(result.buttons)}`);
        }
      }
      await page.eval("document.getElementById('panel').open = false");
      await page.clickOn('#shop button[data-pad="5"]');
      await page.eval('__step(70)');
      assert.equal((await page.eval('__dev02.snapshot()')).seats.S.pad, 5, `${w}x${h} 點擊購兵按鈕`);
      assert.deepEqual(page.errors, [], `${w}x${h} 瀏覽器錯誤`);
      console.log(`PASS ${w}x${h}: 曲名可見，9 顆購兵按鈕無重疊且可點擊`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
