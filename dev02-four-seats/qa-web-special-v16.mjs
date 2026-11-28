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
    res.writeHead(200,{'Content-Type':MIME[extname(loc)]??'application/octet-stream'}).end(await readFile(loc));
  } catch {if(!res.headersSent)res.writeHead(404);res.end();}
});
let browser;
const prompt='#special-power-prompt';
const confirm='[data-special-confirm]', cancel='[data-special-cancel]';
const trigger=power=>`[data-special-trigger="${power}"]`;
const rect=sel=>`(()=>{const e=document.querySelector(${JSON.stringify(sel)}), r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()`;
const visible=sel=>`!document.querySelector(${JSON.stringify(sel)}).hidden`;
const spent='__dev02.snapshot().seats.N.spent';
const sent="__dev02.record().commands.filter(c=>c.type==='special')";
const bank='__dev02.snapshot().seats.N.gold';
const clock="document.querySelector('#special-power-prompt .special-clock').textContent";
const center=async(page,sel)=>{const [x,y,w,h]=await page.eval(rect(sel));assert(w>0&&h>0,sel);return {x:x+w/2,y:y+h/2};};
const touch=(page,type,...pts)=>page.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(({x,y},id)=>({x,y,id,radiusX:4,radiusY:4,force:1}))});
const tap=async(page,sel)=>{await touch(page,'touchStart',await center(page,sel));await touch(page,'touchEnd');};
async function prepare(page,power,cost){
  const eligible=`(()=>{const s=__dev02.snapshot();return __specialModule.specialPowerTargets(s,'N','${power}',__specialSim.dimFor(17)).map(u=>u.id)})()`;
  for(let i=0;i<45;i++){
    if(await page.eval(`${bank}>=${cost}`) && (await page.eval(eligible)).length)break;
    await page.eval('__step(10,100)');
  }
  assert(await page.eval(`${bank}>=${cost}`));
  const ids=await page.eval(eligible);
  assert(ids.length,'real enemy units reached the eligible road');
  return ids;
}
async function checkReplay(page,power,cost,before,ids){
  await page.eval('__step(3)');
  assert.equal(await page.eval(spent),before+cost);
  assert.deepEqual((await page.eval(sent)).map(c=>c.power),[power]);
  const event=(await page.eval('__dev02.log().filter(e=>e.type==="special")'))[0];
  assert.equal(event.status,'applied');assert.equal(event.cost,cost);assert(event.count>0);
  const applied=await page.eval(`(()=>{const s=__dev02.snapshot();return ${JSON.stringify(ids)}.filter(id=>${power==='clear'?'!s.units.some(u=>u.id===id)':'s.units.some(u=>u.id===id&&u.seat===\'N\')'});})()`);
  assert(applied.length,'eligible enemy units actually removed or transferred');
  assert.equal(await page.eval(`__specialSim.replay({...__dev02.record(),ticks:__dev02.snapshot().tick}).final`),await page.eval('__dev02.digest()'));
  return event.count;
}
try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const entry=process.env.BC_PAGES_URL??`http://127.0.0.1:${server.address().port}/dev02-four-seats/battle_craft-defense-lab.html`;
  browser=await launch({width:900,height:820});
  for(const [power,cost,w,h] of [['clear',4500,390,844],['control',6000,844,390]]){
    const page=await browser.open(entry+'#seed=3&quality=std',{stepped:true,w,h});
    await page.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:true});
    await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
    try{
      await page.until("!!window.__dev02 && !!document.querySelector('[data-seat]')");
      await tap(page,'[data-seat="N"]');
      assert.deepEqual(await page.eval(`[__dev02.snapshot().version,${bank}]`),[17,960]);
      await tap(page,trigger(power));
      assert.equal(await page.eval(visible(prompt)),false,'first unfunded trigger cannot arm');
      assert.match(await page.eval('document.querySelector("#msg").textContent'),/還差/);
      assert.deepEqual(await page.eval(sent),[]);
      await page.eval("(async()=>{window.__specialModule=await import(new URL('./special-powers.mjs',location.href));window.__specialSim=await import(new URL('./sim.mjs',location.href));})()");
      // Fast-forward the deterministic simulation, not the real-time arm clock.
      await tap(page,'#speed');await page.eval('document.getElementById("speed").click()');
      if(h>w)await tap(page,'#framing');
      let ids=await prepare(page,power,cost);

      const p1=await center(page,trigger(power)), p2=await center(page,trigger(power==='clear'?'control':'clear'));
      const scale=await page.eval('visualViewport.scale');
      await touch(page,'touchStart',p1);await touch(page,'touchStart',p1,p2);
      await touch(page,'touchMove',{x:p1.x-18,y:p1.y+5},{x:p2.x+18,y:p2.y+5});await touch(page,'touchEnd');
      await sleep(330);
      assert.equal(await page.eval('visualViewport.scale'),scale);
      assert.equal(await page.eval(visible(prompt)),false,'pinching did not arm either power');

      const input=trigger(power);
      // Capture viewport geometry in a single browser task so slow software
      // rendering cannot consume the actual three-second interaction window.
      const boxes=await page.eval(`(()=>{
        const btn=document.querySelector('${input}'),panel=document.querySelector('${prompt}'),
          b=()=>{const r=btn.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]};
        const before=b();
        btn.click();const opened=!panel.hidden, after=b();__step(1,0);
        const r=panel.getBoundingClientRect(), layout={opened,same:JSON.stringify(before)===JSON.stringify(after),
          r:[r.left,r.top,r.right,r.bottom],hub:__dev02.screen(0,0),button:document.querySelector('#framing').getBoundingClientRect().bottom,
          modal:!!document.querySelector('dialog[open]')};
        document.querySelector('${cancel}').click();
        return {...layout,cancelled:panel.hidden};
      })()`);
      assert(boxes.opened&&boxes.same&&!boxes.modal&&boxes.cancelled,JSON.stringify(boxes));
      assert(boxes.r[1]>boxes.button && boxes.r[3]<=h,JSON.stringify(boxes));
      assert(h>w?boxes.r[3]<boxes.hub[1]:boxes.r[2]<boxes.hub[0],JSON.stringify(boxes));

      if(power==='clear'){
        // Pause and restarting cancel; a real tower purchase should not.
        const pause=await page.eval(`(()=>{
          const power=document.querySelector('${input}'),pause=document.getElementById('pause'),p=document.querySelector('${prompt}');
          power.click();pause.click();const paused=__dev02.mode()==='paused'&&p.hidden;
          pause.click();return paused&&__dev02.mode()==='play'&&p.hidden;
        })()`);
        assert.equal(pause,true);
        const loss=await page.eval(`(()=>{
          const btn=document.querySelector('${input}'),p=document.querySelector('${prompt}');
          btn.click(); document.querySelector('#tower-buy').click();__step(1);
          const kept=!p.hidden,blocked=document.querySelector('${confirm}').disabled,
            why=document.querySelector('[data-special-status]').textContent;
          btn.click();return {kept,blocked,why,cancelled:p.hidden};
        })()`);
        assert(loss.kept&&loss.blocked&&loss.cancelled,JSON.stringify(loss));
        assert.match(loss.why,/還差/);assert.equal(await page.eval(spent),1400);
        assert.deepEqual(await page.eval(sent),[]);
        ids=await prepare(page,power,cost);
        const tapped=await page.eval(`(()=>{
          const b=document.querySelector('${input}'),p=document.querySelector('${prompt}');
          b.click();const first=!p.hidden&&document.querySelector('#gold').textContent;
          b.click();return !!first&&p.hidden;
        })()`);
        assert.equal(tapped,true);
        const affected=await checkReplay(page,power,cost,1400,ids);
        console.log(`${w}×${h}: cancel/pause/low bank/double activation; ${affected} cleared. Layout ${JSON.stringify(boxes)}`);
      }else{
        const running=await page.eval(`(()=>{
          const p=document.querySelector('${prompt}'),started=performance.now();
          const observe=new MutationObserver(()=>{if(p.hidden){window.__armElapsed=performance.now()-started;observe.disconnect();}});
          document.querySelector('${input}').click();
          observe.observe(p,{attributes:true,attributeFilter:['hidden']});
          return !p.hidden && ${clock}.includes('3 秒後');
        })()`);
        assert.equal(running,true);
        await page.until('window.__armElapsed',7000);
        assert(await page.eval('window.__armElapsed')>=2995,'timer uses three real seconds, regardless of simulation speed');
        assert.equal(await page.eval(spent),0,'real-time timer only enqueues until the next sim tick');
        const affected=await checkReplay(page,power,cost,0,ids);
        console.log(`${w}×${h}: real-time ${(await page.eval('window.__armElapsed')).toFixed(1)} ms confirmation; ${affected} converted. Layout ${JSON.stringify(boxes)}`);
      }
      assert.deepEqual(page.errors,[]);
    }finally{await page.close();}
  }
}finally{await browser?.close();server.close();}
