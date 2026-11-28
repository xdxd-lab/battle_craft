// Exercise the exact v6-3 preview entry with real WebGL and touch.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch} from '../tools/browser.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  try{
    const loc=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!loc.startsWith(root+sep))return void res.writeHead(403).end();
    const bytes=await readFile(loc);
    res.writeHead(200,{'Content-Type':mime[extname(loc)]||'application/octet-stream'}).end(bytes);
  }catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
const commandList="__dev02.record().commands.filter(c=>c.type==='special'||c.type==='tower')";
const launched="!!window.__dev02 && !!document.querySelector('[data-seat=N]')";
const seatRecord='__dev02.snapshot().seats.N';
const power=(key)=>`[data-v18-power=${key}]`;
const tower=(key)=>`[data-tower-kind=${key}]`;
const touch=(p,type,...pts)=>p.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y],id)=>({x,y,id,radiusX:4,radiusY:4,force:1}))});
async function mid(p,sel){
  return p.eval(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
}
async function tap(p,sel){await touch(p,'touchStart',await mid(p,sel));await touch(p,'touchEnd');}
async function step(p,n=2,dt=33.34){
  await p.eval(`(()=>{
    const gl=document.getElementById('stage').getContext('webgl2');
    const calls=['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'];
    if(gl)for(const name of calls)gl[name]=()=>{};
    try{__step(${n},${dt});}finally{if(gl)for(const name of calls)delete gl[name];}
  })()`);
}
async function verifyLayout(p,w,h){
  const got=await p.eval(`(()=>{
    function item(e,clickable){
      const r=e.getBoundingClientRect(),p=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {x:r.x,y:r.y,w:r.width,h:r.height,click:!clickable||p?.closest('button')===e};
    }
    return {
      powers:[...document.querySelectorAll('[data-v18-power]')].map(e=>item(e,true)),
      towers:[...document.querySelectorAll('[data-tower-kind]')].map(e=>item(e,true)),
      shop:[...document.querySelectorAll('#shop button')].map(e=>item(e,true)),
      balance:item(document.querySelector('[data-core-minerals]'),false),
      hub:__dev02.screen(0,0),
      dock:item(document.querySelector('#v18-field-dock'),false),
    }
  })()`);
  const inView=r=>r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.x+r.w<=w+.01&&r.y+r.h<=h+.01&&r.click;
  const bottom=rows=>Math.max(...rows.map(x=>x.y+x.h));
  const top=rows=>Math.min(...rows.map(x=>x.y));
  assert.deepEqual([got.powers.length,got.towers.length,got.shop.length],[2,3,9],JSON.stringify(got));
  assert([...got.powers,...got.towers,...got.shop,got.balance].every(inView),JSON.stringify(got));
  assert(bottom(got.powers)<=top(got.towers)&&bottom(got.towers)<=top(got.shop),JSON.stringify(got));
  assert(got.hub[1]<got.dock.y,JSON.stringify(got));
  assert(got.balance.y+got.balance.h<=got.dock.y,JSON.stringify(got));
  return got;
}
let browser;
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const entry=process.env.BC_PAGES_URL??`http://127.0.0.1:${server.address().port}/dev02-four-seats/battle_craft-v6-3-lab.html`;
  browser=await launch();
  for(const [w,h,mobile] of [[1280,820,false],[390,844,true],[844,390,true],[568,320,true],[320,568,true]]){
    const p=await browser.open(entry+'#seed=3&quality=std',{stepped:true,w,h});
    if(mobile){
      await p.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
      await p.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    }
    const click=selector=>mobile?tap(p,selector):p.clickOn(selector);
    try{
      await p.until(launched);await click('[data-seat=N]');await step(p);
      assert(await p.eval(`__dev02.snapshot().version===18`));
      assert(await p.eval("!__dev02.specialZones && !document.querySelector('#direct-special-beacons,#special-power-dialog,.compact-special')"),'no retained special deck or old controls');
      assert(await p.eval("!document.querySelector('#tower-buy') || document.querySelector('#tower-buy').hidden"));
      await p.until("document.querySelector('#v18-core-minerals').textContent==='礦 960'");
      await verifyLayout(p,w,h);
      await p.eval("document.querySelector('#framing').click()");await step(p);
      const geo=await verifyLayout(p,w,h);
      assert.deepEqual(await p.eval("Array.from(document.querySelectorAll('[data-tower-kind]'),e=>e.textContent)"),['光子砲500 礦','孢子塔500 礦','地刺塔500 礦']);
      await click(power('clear'));await step(p);
      assert.match(await p.eval("document.querySelector('#msg').textContent"),/還差/);
      assert.deepEqual(await p.eval(commandList),[]);
      if(mobile){
        const a=await mid(p,tower('photon')),b=await mid(p,tower('spore'));
        const scale=await p.eval('visualViewport.scale');
        await touch(p,'touchStart',a);await touch(p,'touchStart',a,b);
        await touch(p,'touchMove',[a[0]-12,a[1]],[b[0]+13,b[1]]);await touch(p,'touchEnd');await step(p);
        assert.equal(await p.eval('visualViewport.scale'),scale);
        assert.deepEqual(await p.eval(commandList),[]);
      }
      await click(tower('photon'));await step(p);
      assert.deepEqual(await p.eval(`${commandList}.map(c=>[c.type,c.kind])`),[['tower','photon']]);
      {
        assert.deepEqual(await p.eval(`[${seatRecord}.tower.kind,${seatRecord}.spent]`),['photon',500]);
        await click(tower('spore'));await step(p);
        assert.equal(await p.eval(`${commandList}.length`),1,'cannot replace when below 500');
        await step(p,20,100);
        await click(tower('spore'));await step(p);
        assert.deepEqual(await p.eval(`[${seatRecord}.tower.kind,${seatRecord}.spent]`),['spore',1000]);
        assert.equal(await p.eval("document.querySelector('[data-tower-kind=spore]').dataset.installed"),'true');
      }
      if(process.env.BC_FIELD_SHOT_STEM && (w===390||w===844)){
        await p.eval('__step(1,0)');
        await p.shot(`${process.env.BC_FIELD_SHOT_STEM}-${w}x${h}.png`);
      }
      await p.eval("document.getElementById('again').click();document.querySelector('[data-seat=none]').click()");
      await step(p);
      assert(await p.eval("document.getElementById('v18-field-dock').hidden&&document.getElementById('v18-core-minerals').hidden"));
      assert.deepEqual(p.errors,[]);
      console.log(`${w}×${h}: actions, 3×500 tower prices, old deck absent, guard and view packing; dock y=${Math.round(geo.dock.y)}.`);
    }finally{await p.close();}
  }
}finally{await browser?.close();server.close();}
