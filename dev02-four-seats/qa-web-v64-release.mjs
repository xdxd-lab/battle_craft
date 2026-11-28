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
let browser;
try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const entry=process.env.BC_PAGES_URL??`http://127.0.0.1:${server.address().port}/dev02-four-seats/battle_craft-v6-4.html`;
 browser=await launch();
 for(const [w,h,mobile] of [[390,844,true],[844,390,true],[1280,800,false]]){
  const p=await browser.open(entry+'#seed=3&quality=std',{stepped:true,w,h});
  if(mobile){
   await p.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
   await p.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  }
  await p.until("!!window.__dev02 && !!document.querySelector('[data-seat]')");
  await input(p,'[data-seat="N"]',mobile);
  await p.eval('__step(3)');
  assert.equal(await p.eval('__dev02.snapshot().version'),20);
  assert.equal(await p.eval("document.querySelectorAll('#shop [data-pad]').length"),12);
  const geom=await p.eval(`(()=>{
    const q=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]};
    return [q('#v18-core-minerals'),q('[data-tower-row]'),q('#shop'),q('#msg')];
  })()`);
  const [bank,towers,shop,msg]=geom;
  assert(bank[2]>bank[0]&&bank[3]>bank[1]&&bank[1]>=towers[3]-1&&bank[3]<=shop[1]+1&&msg[3]<=bank[1],JSON.stringify(geom));
  for(let i=0;i<12;i++){
   const btn=`#shop [data-pad="${i}"]`;
   const presses=await p.eval("__dev02.record().commands.filter(c=>c.type==='shop').length");
   await input(p,btn,mobile);await p.eval('__step(2)');
   assert.equal(await p.eval(`${own}.shopChoice`),i);
   assert.equal(await p.eval(`document.querySelector('${btn}').getAttribute('aria-pressed')`),'true');
   if(i===0||i===11){
    for(let tmp=0;tmp<8;tmp++){
     const n=await p.eval(`${own}.buys`);
     await p.eval('__step(18)');
     if(await p.eval(`${own}.buys`)>n)break;
    }
    assert.equal(await p.eval(`${own}.pad`),i);
    assert(await p.eval(`${own}.buys`)>0);
   }
   const spent=await p.eval(`${own}.spent`);
   await input(p,btn,mobile);await p.eval('__step(12)');
   assert.deepEqual(await p.eval(`[${own}.shopChoice,${own}.pad,${own}.spent]`),[-1,-1,spent]);
   assert.equal(await p.eval(`document.querySelector('${btn}').getAttribute('aria-pressed')`),'false');
   assert.equal(await p.eval("__dev02.record().commands.filter(c=>c.type==='shop').length"),presses+2);
  }
  assert.deepEqual(p.errors.filter(e=>!e.includes('AudioContext')),[]);
  console.log(`${w}×${h}: 12 button selects/cancels, while buying tested; visible minerals under towers and clear of status.`);
  await p.close();
 }
}finally{if(browser)await browser.close();server.close();}
