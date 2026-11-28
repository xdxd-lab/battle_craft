// v17 presentation only: the real-time arming clock never enters the simulation
// or a replay. Only a successful request is recorded as the usual special command.
import { SPECIAL_POWER_LABELS, formatMinerals, powerAvailability } from './special-power-ui.js';

export const COMPACT_SPECIAL_UI_FROM = 17;
export const SPECIAL_ARM_MS = 3000;
const shortName = {clear:'清除',control:'控制'};
const live = ctx => !!ctx?.seat && ctx.alive && ctx.mode==='play';
const text = (node,value) => { if(node.textContent!==value)node.textContent=value; };

export function specialArming({costs,context,targets,cast,notice,onChange=()=>{},now=()=>performance.now(),schedule=setTimeout,unschedule=clearTimeout}) {
  let pending=null, timer=null;
  const same=(p,c)=>p?.seat===c.seat && p?.match===c.match;
  const rich=(power,c)=>c.gold>=costs[power];
  const check=(power,c)=>powerAvailability(c,costs[power],targets(power));
  function stopTimer(){
    if(timer!==null)unschedule(timer);
    timer=null;
  }
  function cancel(){
    stopTimer();
    if(!pending)return;
    pending=null;
    onChange();
  }
  function missed(p){
    stopTimer();
    if(pending!==p)return;
    p.until=null;
    onChange();
  }
  function valid(){
    const c=context();
    if(!live(c) || (pending && !same(pending,c))){cancel();return null;}
    return c;
  }
  function confirm(source='prompt'){
    if(!pending)return false;
    const c=valid();
    if(!c)return false;
    const p=pending, decision=check(p.power,c);
    if(!decision.allowed){
      if(source==='trigger' && !rich(p.power,c)){
        cancel();
        notice(`${shortName[p.power]}已取消：礦量不足。`);
      } else if(source==='timer' || source==='trigger')missed(p);
      else onChange(); // Keep the prompt and reevaluate after ordinary purchases/income.
      return false;
    }
    pending=null;
    stopTimer();
    cast(p.power);
    onChange();
    return true;
  }
  function tick(p){
    // Even a stale callback (same power/seat in a new round) cannot cast.
    if(pending!==p || p.until===null)return;
    const remaining=p.until-now();
    if(remaining>0){timer=schedule(()=>tick(p),remaining);return;}
    timer=null;
    confirm('timer');
  }
  function trigger(power){
    if(!Object.hasOwn(costs,power))return false;
    const c=valid();
    if(!c)return false;
    if(pending?.power===power)return confirm('trigger');
    stopTimer();
    pending=null;
    if(!rich(power,c)){
      notice(`${shortName[power]}需要 ${formatMinerals(costs[power])} 礦，還差 ${formatMinerals(costs[power]-c.gold)} 礦。`);
      onChange();
      return false;
    }
    // Funds gate arming; enemies can enter the scope in the next three seconds.
    const p=pending={power,seat:c.seat,match:c.match,until:now()+SPECIAL_ARM_MS};
    timer=schedule(()=>tick(p),SPECIAL_ARM_MS);
    onChange();
    return true;
  }
  function view(){
    const c=valid();
    if(!c || !pending)return null;
    const {power,until}=pending;
    return {power,remaining:until===null?null:Math.max(0,Math.ceil((until-now())/1000)), availability:check(power,c)};
  }
  return {trigger,confirm,cancel,view};
}

const CSS=`
#bar[data-compact-special]{touch-action:none}
#bar .compact-special{
 --power-px:var(--bc-portrait-scale,1);font-size:calc(12px * var(--power-px));
 display:grid;grid-column:1/-1;gap:calc(4px * var(--power-px));
 padding:calc(4px * var(--power-px));border-radius:6px;border:1px solid #526b7d;
 background:#162330f1;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
}
#bar .compact-special .special-triggers,#bar .compact-special .special-replies{
 display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(4px * var(--power-px));
}
#bar .compact-special button{
 min-width:0;min-height:calc(40px * var(--power-px));padding:calc(2px * var(--power-px));font-size:inherit;
 line-height:1.18;white-space:normal;touch-action:none;overflow-wrap:anywhere;
}
#bar .compact-special [data-special-trigger]{color:#eef5fa;background:#283e50;border-color:#6a879b}
#bar .compact-special [data-special-trigger][aria-pressed=true]{background:#415770;border-color:#e7bc83}
#bar .compact-special [data-affordable=false]:not([aria-pressed=true]){color:#d0dae4;background:#233340}
#bar .compact-special [data-special-trigger] small{display:block;color:#c5d4df;font-size:.87em;font-weight:400}
#bar .compact-special .special-info{
 margin:0;min-height:calc(28px * var(--power-px));font-size:.93em;line-height:1.2;color:#d4e0e9;
 overflow-wrap:anywhere;
}
#bar .compact-special .special-clock{display:block;color:#e7c189;font-weight:650}
#bar .compact-special .special-prompt[hidden]{display:none}
#bar .compact-special .special-replies button{min-height:calc(35px * var(--power-px))}
#bar .compact-special .special-replies [data-special-confirm]{background:#cfe9fa;color:#15334b;font-weight:700}
#bar .compact-special .special-replies [data-special-confirm]:disabled{background:#2d3a46;color:#a0abb4}
@media(orientation:landscape) and (max-height:560px){
 #bar .compact-special{padding:3px;font-size:11px;gap:3px}
 #bar .compact-special button,#bar .compact-special .special-replies button{min-height:34px}
 #bar .compact-special .special-info{min-height:2.4em}
}
/* Keep the in-battle strip entirely in the existing left HUD even in short
   phone landscape windows. Compress the old UI, not the road or targets. */
@media(orientation:landscape) and (max-height:420px){
 #bar[data-compact-special] #cores{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:4px}
 #bar[data-compact-special] .core{grid-template-columns:14px minmax(0,1fr) auto;gap:2px}
 #bar[data-compact-special] .core b{width:14px;height:14px}
 #bar[data-compact-special] .core span{min-width:0;font-size:9px;white-space:nowrap}
 #bar[data-compact-special]>.box:nth-child(4),#bar[data-compact-special]>.box[role=group]{grid-template-columns:repeat(3,minmax(0,1fr))}
 #bar[data-compact-special]>.box:nth-child(4) .row,#bar[data-compact-special]>.box[role=group] .row{display:contents}
 #bar[data-compact-special]>.box>button,#bar[data-compact-special]>.box>.row>button{min-width:0;white-space:normal;line-height:1.1;font-size:10px;padding:2px;border-radius:3px}
 #bar[data-compact-special] #tower-buy{grid-column:span 2}
 #bar[data-compact-special] #now-playing{grid-column:1/-1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
}
@media(orientation:landscape) and (max-height:345px){
 #bar[data-compact-special] #now-playing{display:none}
 #bar[data-compact-special]>.box:nth-child(2) .row small{font-size:9px;line-height:1.1}
 #bar[data-compact-special] #clock,#bar[data-compact-special] #gold{font-size:15px}
 #bar[data-compact-special]{gap:2px}
 #bar[data-compact-special]>.box{padding-block:2px}
 #bar[data-compact-special]>.box>button,#bar[data-compact-special]>.box>.row>button{min-height:22px;padding-block:1px}
 #bar .compact-special{padding:2px;gap:2px}
 #bar .compact-special .special-info{font-size:10px;min-height:2.2em}
 #bar .compact-special button,#bar .compact-special .special-replies button{min-height:29px}
}
@media(orientation:landscape) and (max-height:320px){
 #bar[data-compact-special] .compact-special{grid-row:3}
}
@media(orientation:portrait) and (max-width:700px){
 :root:not(.bc-portrait-overview) #bar[data-compact-special]{gap:4px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>h1{padding-inline:3px;align-self:center;font-size:14px}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>h1 small{display:none}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box{padding:3px 5px;gap:4px}
 :root:not(.bc-portrait-overview) #bar[data-compact-special] #clock,
 :root:not(.bc-portrait-overview) #bar[data-compact-special] #gold{font-size:20px}
 :root:not(.bc-portrait-overview) #bar[data-compact-special] .core{grid-template-columns:18px minmax(0,1fr) auto;gap:4px;font-size:10px}
 :root:not(.bc-portrait-overview) #bar[data-compact-special] .core b{width:18px;height:18px;font-size:11px}
 :root:not(.bc-portrait-overview) #bar[data-compact-special] .core span{min-width:0;white-space:nowrap}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>#cores,
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box:nth-child(4),
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box[role=group]{grid-column:1/-1}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box:nth-child(4){grid-template-columns:repeat(6,minmax(0,1fr))}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box[role=group]{grid-template-columns:repeat(5,minmax(0,1fr))}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box:nth-child(4) .row,
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box[role=group] .row{display:contents}
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box>button,
 :root:not(.bc-portrait-overview) #bar[data-compact-special]>.box>.row>button{min-width:0;white-space:normal;line-height:1.15;font-size:11px;padding:2px}
 :root:not(.bc-portrait-overview) #bar[data-compact-special] #now-playing{grid-column:1/-1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
}
`;

export function createCompactSpecialPowerUi({bar,costs,context,targets,cast,notice}) {
  const powers=Object.keys(SPECIAL_POWER_LABELS), triggers={};
  const css=document.createElement('style');css.id='compact-special-power-style';css.textContent=CSS;document.head.append(css);
  bar.dataset.compactSpecial='';
  const deck=document.createElement('section');deck.className='compact-special';deck.hidden=true;deck.setAttribute('aria-label','特殊信標');
  deck.innerHTML='<div class="special-triggers"></div><div class="special-prompt" hidden><p class="special-info"><span class="special-clock"></span><span data-special-status role="status" aria-live="polite"></span></p><div class="special-replies"><button type="button" data-special-confirm>確認</button><button type="button" data-special-cancel>取消</button></div></div>';
  const $=s=>deck.querySelector(s), row=$('.special-triggers'), prompt=$('.special-prompt'), clock=$('.special-clock'), status=$('[data-special-status]'), confirm=$('[data-special-confirm]'), cancel=$('[data-special-cancel]');
  prompt.id='special-power-prompt';
  bar.append(deck);
  const controller=specialArming({costs,context,targets,cast,notice,onChange:update});
  for(const power of powers){
    const b=document.createElement('button'), name=document.createElement('strong'), price=document.createElement('small');
    b.type='button';b.dataset.specialTrigger=power;b.setAttribute('aria-controls',prompt.id);
    b.setAttribute('aria-label',`${SPECIAL_POWER_LABELS[power]} ${formatMinerals(costs[power])} 礦`);
    b.title=power==='clear'?'敵對兵清除：中央及四條主路；排除主城平台。':'敵對兵控制：中央及四條主路的內側 70%；排除主城平台。';
    text(name,shortName[power]);text(price,`${formatMinerals(costs[power])} 礦`);
    b.append(name,price);b.onclick=()=>controller.trigger(power);row.append(b);triggers[power]=b;
  }
  function update(){
    const c=context(), visible=!!c?.seat && c.mode!=='menu' && c.mode!=='end';
    deck.hidden=!visible;
    const p=controller.view();
    for(const power of powers){
      const b=triggers[power];
      b.disabled=!live(c);
      b.dataset.affordable=String(live(c) && c.gold>=costs[power]);
      b.setAttribute('aria-pressed',String(p?.power===power));
    }
    prompt.hidden=!p;
    if(!p)return;
    confirm.disabled=!p.availability.allowed;
    text(clock,p.remaining===null?`${shortName[p.power]} · 等待手動確認`:`${shortName[p.power]} · ${p.remaining} 秒後自動確認`);
    text(status,p.availability.allowed?`${p.availability.text.replace('，可確認使用。','。')}`:p.availability.text);
  }
  // Keep game and keyboard focus live: don't bring up a modal or autofocus.
  // Native disabled state still prevents an unfunded explicit confirm.
  confirm.onclick=()=>{const p=controller.view();if(controller.confirm() && p)triggers[p.power].focus({preventScroll:true});};
  cancel.onclick=()=>{const p=controller.view();controller.cancel();if(p)triggers[p.power].focus({preventScroll:true});};
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape' && controller.view()){e.preventDefault();controller.cancel();}
  });
  bar.addEventListener('keydown',e=>{
    if(deck.contains(e.target) && e.repeat && (e.key==='Enter'||e.key===' '))e.preventDefault();
  });
  // Scoped only to this v17 HUD: the rest of the page remains browser-zoomable.
  // Swallow click synthesis from both contacts in a pinch, not two distinct taps.
  let multi=false, ignoreThrough=0;
  bar.addEventListener('touchstart',e=>{
    if(e.touches.length<2 && !multi)return;
    multi=true;ignoreThrough=performance.now()+280;e.preventDefault();
  },{passive:false});
  for(const type of ['touchend','touchcancel'])bar.addEventListener(type,e=>{
    if(!multi)return;
    if(!e.touches.length)multi=false;
    ignoreThrough=performance.now()+280;e.preventDefault();
  },{passive:false});
  bar.addEventListener('click',e=>{
    if((e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents) && (multi||performance.now()<ignoreThrough)){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  return {update,close:controller.cancel, showHint:power=>{
    const b=triggers[power];if(!b || !live(context()))return false;
    notice(`${SPECIAL_POWER_LABELS[power]}：請按介面的「${shortName[power]}」啟用。`);
    return true;
  }};
}
