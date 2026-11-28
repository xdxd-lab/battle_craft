// Checks the real HTTP, WebGL and external-asset entry (the offline build has a separate suite).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../tools/browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.glb':'model/gltf-binary', '.wasm':'application/wasm' };
let server, browser;
const preview = process.env.BC_COMBAT_PREVIEW === '1';
try {
  let base = process.env.BC_PAGES_URL;
  if (!base) {
    server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const loc = resolve(root, '.' + pathname.replace(/\/$/, '/index.html'));
        if (!loc.startsWith(root + sep)) { res.writeHead(404).end(); return; }
        const data = await readFile(loc);
        res.writeHead(200, { 'Content-Type': MIME[extname(loc)] ?? 'application/octet-stream' }).end(data);
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(ok => server.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${server.address().port}/`;
  }
  browser = await launch({ width: 1280, height: 820 });
  for (const [w,h,tier,seat] of [[1280,820,'high','E'],[844,390,'std','N']]) {
    const entry = new URL('dev02-four-seats/battle_craft-v6-0.html', base);
    entry.hash = `seed=3&quality=${tier}${preview?'&preview=combat':''}`;
    const page = await browser.open(entry.href, { stepped:true, w, h });
    await page.until("!!window.__dev02 && !!document.querySelector('[data-seat]')");
    assert.match(await page.eval('document.title'), /v6-0/);
    await page.clickOn(`[data-seat="${seat}"]`);
    if (preview && tier==='high'){
      assert.match(await page.eval("document.querySelector('[data-profile=wraith]').textContent"),/死靈式戰機/);
      await page.clickOn('[data-profile=wraith]');
      await page.eval('__step(3)');
      await page.until("document.querySelector('#dossier p').textContent.includes('發射瞬間鎖定的位置')");
    }
    assert.deepEqual(await page.eval(`[__dev02.snapshot().version,__dev02.snapshot().seats.${seat}.hp]`), [preview?10:8,2700]);
    const zones=await page.eval('__dev02.specialZones()');
    assert.equal(zones.length,preview?4:0);
    assert(zones.every(z=>z.positions.length===2));
    assert.equal(await page.eval("document.querySelectorAll('#shop button').length"),9); // no purchasable special pad
    assert.match(await page.eval("document.querySelector('#shop button[data-pad=\"6\"]').textContent"), /40\s*金\s*→\s*3\s*艘/);
    await page.clickOn('#shop button[data-pad="6"]');
    await page.eval('__step(10)');
    await page.until('__dev02.audio().musicSource === "track"');
    await page.until(`__dev02.surface().active === '${tier==='high'?'max':'std'}' && !__dev02.surface().busy`,15000);
    if (tier === 'high') await page.until('__dev02.quality().props.status === "ready"',20000);
    const bought = `__dev02.snapshot().units.filter(u=>u.seat==='${seat}' && u.kind==='battlecruiser' && u.motion).length`;
    // Crossing another beacon can also buy it under the original shop rules.
    for (let i=0;i<190 && !(await page.eval(bought));i++) await page.eval('__step(3)');
    assert.equal(await page.eval(bought), 3);
    assert(await page.eval(`__dev02.snapshot().seats.${seat}.spent`) >= 40);
    assert.equal(await page.eval('__dev02.mode()'), 'play');
    assert.deepEqual(page.errors, []);
    await page.close();
    console.log(`${w}×${h} ${tier}: graphics, textures, soundtrack, core HP and triple battlecruiser passed`);
  }
} finally { await browser?.close(); server?.close(); }
