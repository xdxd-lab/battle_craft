// Real browser purchases through the confirmation UI. The fixture does not edit live state.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../tools/browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.glb':'model/gltf-binary', '.wasm':'application/wasm' };
const server=createServer(async(req,res)=>{
  try {
    const loc=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!loc.startsWith(root+sep)) return void res.writeHead(403).end();
    res.writeHead(200,{'Content-Type':MIME[extname(loc)]??'application/octet-stream'}).end(await readFile(loc));
  } catch {if(!res.headersSent)res.writeHead(404);res.end();}
});
let browser;
try {
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const entry = process.env.BC_PAGES_URL ?? `http://127.0.0.1:${server.address().port}/dev02-four-seats/battle_craft-defense-lab.html`;
  browser=await launch({width:900,height:820});
  for (const [power,cost,w,h] of [['clear',4500,390,844],['control',6000,844,390]]) {
    const page=await browser.open(entry+'#seed=3&quality=std',{stepped:true,w,h});
    await page.until("!!window.__dev02 && !!document.querySelector('[data-seat]')");
    await page.clickOn('[data-seat="N"]');
    assert.deepEqual(await page.eval('[__dev02.snapshot().version,__dev02.snapshot().seats.N.gold]'),[16,960]);
    await page.clickOn('[data-special-launch]');
    await page.clickOn(`[data-special-action="${power}"]`);
    assert.equal(await page.eval("document.querySelector('[data-special-confirm]').hidden || document.querySelector('[data-special-confirm]').disabled"),true);
    assert.deepEqual(await page.eval('[__dev02.snapshot().seats.N.spent,__dev02.record().commands.length]'),[0,0]);
    await page.eval("document.querySelector('#special-power-dialog').close(); document.getElementById('speed').click()");
    await page.eval(`(async()=>{window.__specialModule=await import(new URL('./dev02-four-seats/special-powers.mjs',location.origin)); window.__specialSim=await import(new URL('./dev02-four-seats/sim.mjs',location.origin)); return 1;})()`);
    const eligible=`(()=>{const s=__dev02.snapshot(), dim=__specialSim.dimFor(16);return s.units.filter(u=>u.team!==s.seats.N.team&&u.hp>0&&__specialModule.inSpecialPowerZone('${power}',dim,u.x,u.z)).map(u=>u.id)})()`;
    for (let i=0;i<35;i++) {
      if (await page.eval(`__dev02.snapshot().seats.N.gold>=${cost}`) && (await page.eval(eligible)).length) break;
      await page.eval('__step(10,100)');
    }
    assert(await page.eval(`__dev02.snapshot().seats.N.gold>=${cost}`));
    const ids=await page.eval(eligible);
    assert(ids.length,'hostiles must reach the roadway during the real match');
    await page.clickOn('[data-special-launch]');
    await page.clickOn(`[data-special-action="${power}"]`);
    assert.equal(await page.eval("document.querySelector('[data-special-confirm]').disabled"),false);
    assert.equal(await page.eval('__dev02.snapshot().seats.N.spent'),0);
    await page.clickOn('[data-special-confirm]');
    await page.eval('__step(3)');
    assert.equal(await page.eval('__dev02.snapshot().seats.N.spent'),cost);
    assert(await page.eval(`__dev02.record().commands.some(c=>c.type==='special'&&c.power==='${power}'&&c.seat==='N')`));
    const applied=await page.eval(`(()=>{const s=__dev02.snapshot();return ${JSON.stringify(ids)}.filter(id=>${power==='clear'?'!s.units.some(u=>u.id===id)':'s.units.some(u=>u.id===id&&u.seat===\'N\')'});})()`);
    assert(applied.length,'eligible enemy units actually removed or transferred');
    assert.deepEqual(page.errors,[]);
    console.log(`${w}×${h}: ${power} charged exactly ${cost}, affected ${applied.length} expected enemy units`);
    await page.close();
  }
} finally {await browser?.close();server.close();}
