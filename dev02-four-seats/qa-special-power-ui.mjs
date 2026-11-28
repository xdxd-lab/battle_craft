// Browser integration exercises first close, then verify dispatch-only-on-confirm.
import assert from 'node:assert/strict';
import { SPECIAL_POWER_LABELS, formatMinerals, powerAvailability, powerResult } from './special-power-ui.js';
const live={seat:'N',mode:'play',alive:true,gold:960};
assert.deepEqual(Object.values(SPECIAL_POWER_LABELS),['敵對兵清除','敵對兵控制']);
assert.equal(formatMinerals(1400),'1,400');
assert.match(powerAvailability({...live,seat:null},4500,9).text,/觀戰/);
assert.match(powerAvailability({...live,alive:false},4500,9).text,/失守/);
assert.match(powerAvailability({...live,mode:'paused'},4500,9).text,/暫停/);
const empty=powerAvailability(live,4500,0);
assert.equal(empty.allowed,false);
assert.match(empty.text,/沒有敵對兵.*3,540 礦/);
assert.equal(powerAvailability({...live,gold:4499},4500,1).allowed,false);
assert.equal(powerAvailability({...live,gold:4500},4500,1).allowed,true);
assert.equal(powerAvailability({...live,gold:6000},6000,0).allowed,false);
assert.equal(powerAvailability({...live,gold:6000},6000,2).allowed,true);
assert.match(powerResult({power:'clear',status:'empty',cost:4500,count:0}),/沒有敵對兵，未扣礦/);
assert.match(powerResult({power:'control',status:'insufficient',cost:6000,count:0}),/6,000 礦，未扣礦/);
assert.match(powerResult({power:'control',status:'applied',cost:6000,count:2}),/接管 2 名/);
assert.match(powerResult({power:'clear',status:'applied',cost:4500,count:2}),/移除 2 名/);
console.log('Special-power UI messages: resource, scope availability, spectators and result states.');

// Wall-clock state transitions with deterministic scheduling, including stale
// callbacks the browser may have already queued before cancellation.
import { SPECIAL_ARM_MS, specialArming } from './compact-special-power-ui.js';
const makeClock=()=>{
  let now=0, last=0;
  const tasks=new Map(), history=[];
  return {now:()=>now,history,
    schedule:(callback,delay)=>{const id=++last;tasks.set(id,{at:now+delay,callback});history.push(callback);return id;},
    unschedule:id=>tasks.delete(id),
    pump(ms){const end=now+ms;
      for(;;){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next || next[1].at>end)break;
        const [id,{at,callback}]=next;tasks.delete(id);now=at;callback();
      }
      now=end;
    }
  };
};
function scenario(){
  const clock=makeClock(), ctx={...live,match:{},gold:6000}, attempts=[], notices=[], units={clear:2,control:1};
  const control=specialArming({costs:{clear:4500,control:6000},context:()=>ctx,targets:p=>units[p],
    cast:power=>attempts.push({power,time:clock.now()}),notice:text=>notices.push(text),...clock});
  return {clock,ctx,attempts,notices,units,control};
}
{
  const {control,clock,ctx,attempts,notices}=scenario();
  ctx.gold=4499; assert.equal(control.trigger('clear'),false);assert.match(notices.at(-1),/還差 1 礦/);
  assert.equal(control.view(),null);
  ctx.gold=4500; assert.equal(control.trigger('clear'),true);
  assert.equal(control.view().remaining,3);
  clock.pump(SPECIAL_ARM_MS-1);assert.equal(attempts.length,0);assert.equal(control.view().remaining,1);
  clock.pump(1);assert.deepEqual(attempts,[{power:'clear',time:3000}]);assert.equal(control.view(),null);
}
{
  const {control,clock,ctx,attempts,notices}=scenario();
  control.trigger('control');ctx.gold=5980;
  assert.equal(control.confirm(),false);assert.equal(control.view().availability.allowed,false);
  assert.equal(control.trigger('control'),false);assert.equal(control.view(),null);
  assert.match(notices.at(-1),/已取消：礦量不足/);
  ctx.gold=6000;clock.pump(6000);assert.equal(attempts.length,0);
  control.trigger('control');assert.equal(control.trigger('control'),true);
  assert.deepEqual(attempts,[{power:'control',time:6000}]);
  clock.pump(6000);assert.equal(attempts.length,1);
}
{
  const {control,clock,ctx,attempts}=scenario();
  control.trigger('clear');ctx.gold=4000;assert.equal(control.confirm(),false);
  clock.pump(3000);assert.equal(control.view().remaining,null);
  ctx.gold=6000;clock.pump(3000);assert.equal(attempts.length,0);
  assert.equal(control.view().availability.allowed,true);
  assert.equal(control.confirm(),true);
  assert.deepEqual(attempts,[{power:'clear',time:6000}]);
}
{
  const {control,clock,units,attempts}=scenario();
  units.control=0;assert.equal(control.trigger('control'),true,'funds allow arm during an empty scope');
  clock.pump(3000);assert.equal(control.view().remaining,null);assert.equal(control.view().availability.allowed,false);
  units.control=3;clock.pump(3000);assert.equal(attempts.length,0);
  assert.equal(control.confirm(),true);
}
{
  const {control,clock,ctx,attempts}=scenario();
  control.trigger('clear');clock.pump(1000);const stale=clock.history.at(-1);
  ctx.gold=5000;assert.equal(control.trigger('control'),false);
  assert.equal(control.view(),null);ctx.gold=6000;control.trigger('clear');stale();
  assert.equal(control.view().remaining,3);control.trigger('control');
  assert.equal(control.view().power,'control');control.cancel();clock.pump(6000);
  assert.deepEqual(attempts,[]);
  for(const key of ['seat','mode','match','alive']){
    const old=ctx[key];control.trigger('clear');ctx[key]=null;
    clock.pump(3000);assert.equal(control.view(),null);ctx[key]=old;
  }
  assert.deepEqual(attempts,[]);
}
console.log('Compact special-power arming: 3-second clock, double tap, dynamic budget/target gates, cancel/switch and stale-round protection.');
