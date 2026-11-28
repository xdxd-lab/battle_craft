import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from '../tools/browser.mjs';

const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.jpg':'image/jpeg','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(!path.startsWith(root+sep))return void res.writeHead(403).end();
    const bytes=await readFile(path);
    res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
const box=(p,q)=>p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(q)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e}})()`);
async function input(p,q,mobile){
  const r=await box(p,q);
  assert(r?.hit,`not a reachable button: ${q} ${JSON.stringify(r)}`);
  const x=r.x+r.w/2,y=r.y+r.h/2;
  if(mobile){
    await p.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
    await p.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});
    await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});
  }
}
const own='__dev02.snapshot().seats.N';
const all=[
  '[data-v18-power="clear"]','[data-v18-power="control"]',
  '[data-tower-kind="photon"]','[data-tower-kind="spore"]','[data-tower-kind="sunken"]',
];
let browser;
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const entry=process.env.BC_PAGES_URL??`http://127.0.0.1:${server.address().port}/dev02-four-seats/battle_craft-v6-3-lab.html`;
  browser=await launch();
  for(const [w,h,mobile] of [[390,844,true],[844,390,true],[1280,800,false]]){
    const p=await browser.open(entry+'#seed=3&quality=std',{stepped:true,w,h});
    if(mobile){
      await p.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
      await p.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    }
    await p.until("!!window.__dev02 && !!document.querySelector('[data-seat]')");
    await input(p,'[data-seat="N"]',mobile);await p.eval('__step(2)');
    assert.equal(await p.eval('__dev02.snapshot().version'),18);
    assert.equal(await p.eval("!!document.querySelector('[data-direct-special]')"),false);
    const rows=await Promise.all(all.map(q=>box(p,q)));
    assert(rows.every(r=>r?.hit&&r.x>=0&&r.y>=0&&r.x+r.w<=w+.1&&r.y+r.h<=h+.1),JSON.stringify(rows));
    assert(Math.min(...rows.slice(2).map(r=>r.y))>=Math.max(...rows.slice(0,2).map(r=>r.y+r.h))-.1,JSON.stringify(rows));
    await input(p,all[0],mobile);await p.eval('__step(2)');
    assert.equal(await p.eval("__dev02.record().commands.filter(c=>c.type==='special').length"),0);

    await input(p,all[2],mobile);await p.eval('__step(2)');
    assert.deepEqual(await p.eval(`[${own}.tower.kind,${own}.spent]`),['photon',500]);
    await p.eval('__step(25)');
    await input(p,all[3],mobile);await p.eval('__step(2)');
    assert.deepEqual(await p.eval(`[${own}.tower.kind,${own}.spent]`),['spore',1000]);

    const shop='#shop [data-pad="4"]';
    await input(p,shop,mobile);await p.eval('__step(2)');
    assert.equal(await p.eval(`${own}.shopChoice`),4);
    assert.equal(await p.eval(`document.querySelector('${shop}').getAttribute('aria-pressed')`),'true');
    const buys=await p.eval(`${own}.buys`);
    await input(p,shop,mobile);await p.eval('__step(35)');
    assert.deepEqual(await p.eval(`[${own}.shopChoice,${own}.pad,${own}.buys]`),[-1,-1,buys]);
    assert.equal(await p.eval(`document.querySelector('${shop}').getAttribute('aria-pressed')`),'false');
    if(w===390){
      await p.eval(`(async()=>{
        window.qaPowers=await import(new URL('./special-powers.mjs',location.href));
        window.qaSim=await import(new URL('./sim.mjs',location.href));
        document.getElementById('speed').click();document.getElementById('speed').click();
      })()`);
      const targets="window.qaPowers.specialPowerTargets(__dev02.snapshot(),'N','clear',window.qaSim.dimFor(18)).length";
      for(let i=0;i<60;i++){
        if(await p.eval(`${own}.gold>=4500&&(${targets})>0`))break;
        await p.eval(`(()=>{
          const gl=document.getElementById('stage').getContext('webgl2');
          const calls=['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'];
          if(gl)for(const key of calls)gl[key]=()=>{};
          try{__step(10,100);}finally{if(gl)for(const key of calls)delete gl[key];}
        })()`);
      }
      assert(await p.eval(`${own}.gold>=4500&&(${targets})>0`),'players can afford the power with legal targets');
      const spent=await p.eval(`${own}.spent`);
      await input(p,all[0],mobile);await p.eval('__step(2)');
      assert.equal(await p.eval(`${own}.spent`),spent+4500);
      assert.deepEqual(await p.eval("__dev02.record().commands.filter(c=>c.type==='special').map(c=>c.power)"),['clear']);
    }
    assert.deepEqual(p.errors,[]);
    console.log(`${w}×${h}: action dock, low funds, tower purchase and replacement, same-button cancellation.`);
    await p.close();
  }
}finally{await browser?.close();server.close();}
