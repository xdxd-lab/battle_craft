// Browser/sim17 integration through real touch input. No test hooks modify the live match.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from '../tools/browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.glb':'model/gltf-binary', '.wasm':'application/wasm' };
const server=createServer(async(req,res)=>{
  try {
    const loc=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!loc.startsWith(root+sep)) return void res.writeHead(403).end();
    let bytes=await readFile(loc);
    if(loc.endsWith('/battle_craft-defense-lab.html'))bytes=String(bytes).replace(/data-special-controls="direct"\s*/,'').replace('data-special-lab="true"','data-special-lab="true" data-special-controls="direct"');
    res.writeHead(200,{'Content-Type':MIME[extname(loc)]??'application/octet-stream'}).end(bytes);
  } catch {if(!res.headersSent)res.writeHead(404);res.end();}
});
let browser;
const trigger=power=>`[data-direct-special="${power}"]`;
const bank='__dev02.snapshot().seats.N.gold';
const spent='__dev02.snapshot().seats.N.spent';
const sent="__dev02.record().commands.filter(c=>c.type==='special')";
const noPanel="!document.querySelector('.compact-special, #special-power-prompt, #special-power-dialog')";
const shown="!document.querySelector('#direct-special-beacons').hidden";
const balance="document.querySelector('[data-core-minerals]')";
const visible=sel=>`document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().width>0`;
const msg="document.querySelector('#msg').textContent";
const middle=async(page,sel)=>{const pt=await page.eval(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return r.width?[r.x+r.width/2,r.y+r.height/2]:null})()`);assert(pt,sel);return pt;};
const touch=(page,type,...pts)=>page.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],id)=>({x,y,id,radiusX:4,radiusY:4,force:1}))});
const tap=async(page,sel)=>{await touch(page,'touchStart',await middle(page,sel));await touch(page,'touchEnd');};
const eligible=power=>`(()=>{const s=__dev02.snapshot();return __specialModule.specialPowerTargets(s,'N','${power}',__specialSim.dimFor(17)).map(u=>u.id)})()`;
async function fastForward(page,power,cost){
  let ids=[];
  for(let i=0;i<60;i++){
    if(await page.eval(`${bank}>=${cost}`) && (ids=await page.eval(eligible(power))).length)break;
    await page.eval(`(()=>{
      const gl=document.getElementById('stage').getContext('webgl2');
      const calls=['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'];
      if(gl)for(const name of calls)gl[name]=()=>{};
      try{__step(10,100);}finally{if(gl)for(const name of calls)delete gl[name];}
    })()`);
  }
  assert(await page.eval(`${bank}>=${cost}`));
  assert(ids.length,'enemy units reached the special road');
  return ids;
}
const fmt=x=>`礦 ${x.toLocaleString('zh-TW')}`;
const checkLayout=async(page,w,h)=>{
  const geom=await page.eval(`(()=>{
    const boxes=[...document.querySelectorAll('[data-direct-special],[data-core-minerals]')].map(e=>{
      const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,front:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-direct-special]')===e};
    });
    const zone=__dev02.specialZones().find(x=>x.id==='N'), n=zone.positions.map(([x,z])=>__dev02.screen(x,z,.49));
    return {boxes,n,hub:__dev02.screen(0,0),core:__dev02.screen(0,-36.2,1.7)};
  })()`);
  const [a,b,amount]=geom.boxes;
  const separate=(a,b)=>a.x+a.w<b.x+.01 || b.x+b.w<a.x+.01 || a.y+a.h<b.y+.01 || b.y+b.h<a.y+.01;
  assert(geom.boxes.every(o=>o.w>0 && o.h>0 && o.x>=0&&o.y>=0&&o.x+o.w<=w&&o.y+o.h<=h),JSON.stringify(geom));
  assert(a.front&&b.front&&a.h>=44&&b.h>=44,JSON.stringify(geom));
  assert(separate(a,b)&&separate(a,amount)&&separate(b,amount),JSON.stringify(geom));
  assert([a,b].every((o,i)=>Math.hypot(o.x+o.w/2-geom.n[i][0],o.y+o.h/2-geom.n[i][1])<86),JSON.stringify(geom));
  return geom;
};
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const entry=process.env.BC_PAGES_URL??`http://127.0.0.1:${server.address().port}/dev02-four-seats/battle_craft-v6-2.html`;
  browser=await launch({width:900,height:820});
  for(const [power,cost,w,h] of [['clear',4500,390,844],['control',6000,844,390]]){
    console.log(`Checking ${w}×${h} ${power}…`);
    const page=await browser.open(entry+'#seed=3&quality=std',{stepped:true,w,h});
    await page.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
    await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    try{
      await page.until("!!window.__dev02 && !!document.querySelector('[data-seat]')");
      await tap(page,'[data-seat="N"]');await page.eval('__step(2)');
      assert.deepEqual(await page.eval(`[__dev02.snapshot().version,${bank},${shown},${noPanel}]`),[17,960,true,true]);
      assert.equal(await page.eval(`${balance}.textContent`),fmt(960));
      const near=await checkLayout(page,w,h);
      if(h>w){await page.eval("document.getElementById('framing').click()");await page.eval('__step(2)');await checkLayout(page,w,h);}
      await tap(page,trigger(power));await page.eval('__step(2)');
      assert.match(await page.eval(msg),/還差/);
      assert.deepEqual(await page.eval(sent),[]);
      assert.equal(await page.eval(noPanel),true);
      await page.eval("(async()=>{window.__specialModule=await import(new URL('./special-powers.mjs',location.href));window.__specialSim=await import(new URL('./sim.mjs',location.href));document.getElementById('speed').click();document.getElementById('speed').click();})()");
      const ids=await fastForward(page,power,cost);
      const before=await page.eval(bank);
      assert(before>960);
      assert.equal(await page.eval(`${balance}.textContent`),fmt(before));

      const other=await page.eval(`(()=>{
        for(const z of __dev02.specialZones().filter(v=>v.id!=='N'))for(const [x,y] of z.positions.map(([x,z])=>__dev02.screen(x,z,.45))){
          if(document.elementFromPoint(x,y)?.id==='stage')return [x,y];
        }
      })()`);
      assert(other,'an enemy/allied pad is in the visible map');
      await touch(page,'touchStart',other);await touch(page,'touchEnd');await page.eval('__step(1)');
      assert.deepEqual(await page.eval(sent),[],'other seats do not unlock this player power');

      const a=await middle(page,trigger(power));
      const b=await page.eval(`(()=>{
        const [x,y]=${JSON.stringify(a)};
        return [[x,y-31],[x,y+31],[x+44,y],[x-44,y]].find(([x,y])=>document.elementFromPoint(x,y)?.id==='stage');
      })()`);
      assert(b,'second pinch finger starts just outside the own button');
      const scale=await page.eval('visualViewport.scale');
      await touch(page,'touchStart',a);await touch(page,'touchStart',a,b);
      await touch(page,'touchMove',[a[0]-26,a[1]+5],[b[0]+23,b[1]+5]);await touch(page,'touchEnd');
      await page.eval('__step(1)');
      assert.equal(await page.eval('visualViewport.scale'),scale);
      assert.deepEqual(await page.eval(sent),[],'pinch does not buy even with sufficient minerals');

      await touch(page,'touchStart',a);
      await touch(page,'touchMove',[a[0]-30,a[1]]);
      await touch(page,'touchMove',a);
      await touch(page,'touchEnd');await page.eval('__step(1)');
      assert.deepEqual(await page.eval(sent),[],'drag off and back is not a tap');

      const physical=await page.eval(`(()=>{
        const [x,z]=__dev02.specialZones().find(v=>v.id==='N').positions[${power==='clear'?0:1}];
        const [sx,sy]=__dev02.screen(x,z,.45), el=document.elementFromPoint(sx,sy);
        return [sx,sy,el?.id==='stage'?'ring':el?.closest('[data-direct-special]')?.dataset.directSpecial];
      })()`);
      assert(['ring',power].includes(physical[2]),JSON.stringify(physical));
      const finalPoint=h>w ? a : physical.slice(0,2);
      await touch(page,'touchStart',finalPoint);
      await page.eval('__step(1)');
      assert.deepEqual(await page.eval(sent),[],'touchdown alone does not activate');
      await touch(page,'touchEnd');
      const bankBeforeTap=await page.eval(bank);
      await page.eval('__step(2)');
      assert.equal(await page.eval(spent),cost);
      assert.deepEqual((await page.eval(sent)).map(o=>o.power),[power]);
      const event=(await page.eval("__dev02.log().find(e=>e.type==='special')"));
      assert.equal(event.status,'applied');assert.equal(event.cost,cost);
      assert(event.units.some(id=>ids.includes(id)));
      assert(await page.eval(bank)<bankBeforeTap);
      assert.equal(await page.eval(`${balance}.textContent`),fmt(await page.eval(bank)));
      assert.equal(await page.eval("__specialSim.replay({...__dev02.record(),ticks:__dev02.snapshot().tick}).final"),await page.eval('__dev02.digest()'));
      if(process.env.BC_SPECIAL_SHOT_STEM)await page.shot(`${process.env.BC_SPECIAL_SHOT_STEM}-${w}x${h}.png`);
      await page.eval("document.getElementById('again').click();document.querySelector('[data-seat=none]').click();__step(2)");
      assert.equal(await page.eval(shown),false,'observer must not see own powers/balance or activate');
      assert.equal(await page.eval(visible(trigger(power))),false);
      assert.deepEqual(await page.eval(sent),[]);
      assert.deepEqual(page.errors,[]);
      console.log(`${w}×${h}: single tap cost ${cost}, affected ${event.count}; bank badge moved ${before} → ${event.gold}; ring=${physical[2]}, pinch/drag/insufficient/foreign/observer/replay passed. Near ${JSON.stringify(near)}`);
    }finally{await page.close();}
  }
}finally{await browser?.close();server.close();}
