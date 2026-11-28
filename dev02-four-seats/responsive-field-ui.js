// v18: all power/tower inputs are ordinary DOM controls. The scene contributes
// only a projected, non-interactive core balance label; no special deck is needed.
import { SPECIAL_POWER_LABELS, formatMinerals } from './special-power-ui.js';
import { coreBalancePlacement } from './direct-special-beacons.js';

export const FIELD_TOWER_LABELS = Object.freeze({photon:'光子砲',spore:'孢子塔',sunken:'地刺塔'});
const TOWER_SCOPE = {photon:'對地、對空',spore:'只對空',sunken:'只對地'};
const POWER_SCOPE = {clear:'清除道路及交會區內的敵對兵',control:'接管中央與主道路內側 70% 的敵對兵'};
const active = c=>!!(c?.seat && c?.alive && c.mode==='play');
const costText = n=>`${formatMinerals(n)} 礦`;
const idOf = element=>element?.closest?.('button[data-v18-power],button[data-tower-kind],button[data-pad]') ?? null;

const CSS = `
#v18-field-dock {
 --field-ui:1;position:fixed;left:50%;bottom:max(calc(8px * var(--field-ui)),env(safe-area-inset-bottom));
 transform:translateX(-50%);display:grid;gap:calc(4px * var(--field-ui));
 width:min(calc(540px * var(--field-ui)),calc(100% - 20px * var(--field-ui)));
}
#v18-field-dock > #shop {
 position:static;left:auto;right:auto;bottom:auto;transform:none;max-width:none;width:100%;min-width:0;
 gap:calc(4px * var(--field-ui));
}
#v18-field-dock > #shop button {
 min-width:0;white-space:normal;line-height:1.15;overflow-wrap:anywhere;font-size:calc(13px * var(--field-ui));
}
#v18-field-actions{
 display:grid;gap:calc(3px * var(--field-ui));padding:calc(4px * var(--field-ui));border:1px solid #41566a;border-radius:6px;
 background:#15202ded;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
}
#v18-field-actions [role=group] {display:grid;gap:calc(3px * var(--field-ui));grid-template-columns:repeat(2,minmax(0,1fr))}
#v18-field-actions [data-tower-row] {grid-template-columns:repeat(3,minmax(0,1fr))}
#v18-field-actions button {
 min-width:0;min-height:calc(39px * var(--field-ui));white-space:normal;touch-action:none;
 display:flex;align-items:center;justify-content:space-between;gap:calc(3px * var(--field-ui));
 border-radius:calc(4px * var(--field-ui));padding:calc(3px * var(--field-ui)) calc(6px * var(--field-ui));
 font-size:calc(12px * var(--field-ui));line-height:1.14;
 background:#23374a;border-color:#7798aa;color:#eef5fa;
}
#v18-field-actions button[data-v18-power=clear]{border-color:#b29369}
#v18-field-actions button[data-tower-kind]{background:#243840;border-color:#637c7d}
#v18-field-actions button[data-installed=true]{box-shadow:inset 0 -2px #98d7ba}
#v18-field-actions button[data-affordable=false]{background:#182430;color:#c9d7e1;border-style:dashed}
#v18-field-actions button:active:not(:disabled),
#v18-field-actions button[data-pressing]:not(:disabled){
 background:#557084;border-color:#d5ecff;box-shadow:inset 0 2px 5px #08121a;transform:translateY(1px);
}
#v18-field-actions button[data-tapped]:not(:disabled):not([data-pressing]){
 animation:v18-action-release 240ms ease-out;
}
@keyframes v18-action-release{
 from{outline:2px solid #f3dc9a;outline-offset:-2px}
 to{outline:2px solid transparent;outline-offset:0}
}
@media(prefers-reduced-motion:reduce){
 #v18-field-actions button[data-tapped]:not(:disabled):not([data-pressing]){
  animation:none;outline:2px solid #f3dc9a;outline-offset:-2px
 }
}
#v18-field-dock > #shop button[aria-pressed=true]{
 color:#fff2c9;background:#354556;border-color:#ffe9a8;
}
#v18-field-dock > #shop button[aria-pressed=true] small{color:#e3eef6}
@media(forced-colors:active){
 #v18-field-dock > #shop button[aria-pressed=true]{
  forced-color-adjust:none;color:HighlightText;background:Highlight;border-color:HighlightText;
  box-shadow:inset 0 0 0 1px HighlightText;
 }
 #v18-field-dock > #shop button[aria-pressed=true] small{color:HighlightText}
}
#v18-field-actions button small{flex:none;white-space:nowrap;color:#d6dfe5;font-size:.87em;font-variant-numeric:tabular-nums}
#v18-field-dock[data-dock-minerals] > #shop button{touch-action:manipulation}
#v18-field-dock #v18-core-minerals{
 position:static;transform:none;justify-self:start;width:auto;min-width:calc(82px * var(--field-ui));
 max-width:100%;padding:0 calc(8px * var(--field-ui));
}
#v18-core-minerals{
 --field-ui:1;position:fixed;z-index:1;pointer-events:none;transform:translate(-50%,-50%);
 display:grid;place-items:center;width:calc(82px * var(--field-ui));height:calc(23px * var(--field-ui));
 border:1px solid #e3b75d;border-radius:calc(5px * var(--field-ui));background:#161d26f5;color:#ffe5a1;
 text-align:center;font:750 calc(12px * var(--field-ui))/1 system-ui;white-space:nowrap;font-variant-numeric:tabular-nums;
}
@media(orientation:landscape){
 #v18-field-dock{left:auto;right:max(12px,env(safe-area-inset-right));transform:none}
 #v18-field-dock > #shop button{justify-content:space-between}
}
@media(orientation:landscape) and (max-height:560px){
 #v18-field-dock{bottom:max(4px,env(safe-area-inset-bottom));width:min(520px,calc(100% - 182px))}
 #v18-field-actions button{min-height:35px;}
 #v18-field-dock > #shop button{font-size:11px}
}
@media(orientation:landscape) and (max-height:350px){
 #v18-field-actions{padding:2px}
 #v18-field-actions button{min-height:31px;padding:2px 4px}
 #v18-field-dock > #shop button{min-height:29px}
}
@media(orientation:portrait) and (max-width:700px){
 :root.field-controls-v18:not(.bc-portrait-overview) #panel {
  bottom:var(--v18-dock-inset,210px);max-height:min(38vh,calc(100% - var(--v18-dock-inset,210px) - 12px));
 }
}
@media(orientation:portrait) and (max-height:680px){
 #v18-field-actions button{min-height:calc(34px * var(--field-ui))}
 #v18-field-dock > #shop button{min-height:calc(34px * var(--field-ui));padding:2px 3px}
}
`;

export function createResponsiveFieldUi({shop,costs,towerCosts,context,projection,cast,purchaseTower,notice,onShop,scale=()=>1}) {
  const css=document.createElement('style');css.id='responsive-field-style';css.textContent=CSS;document.head.append(css);
  document.documentElement.classList.add('field-controls-v18');
  const dock=document.createElement('section');dock.id='v18-field-dock';dock.hidden=true;dock.setAttribute('aria-label','本席戰場操作');
  const actions=document.createElement('div');actions.id='v18-field-actions';
  const makeRow=(name,key)=>{
    const row=document.createElement('div');row.setAttribute('role','group');row.setAttribute('aria-label',name);row.dataset[key]='';actions.append(row);return row;
  };
  const powerRow=makeRow('特殊能力','powerRow'),towerRow=makeRow('購買砲塔','towerRow');
  shop.before(dock);dock.append(actions,shop);
  const amount=document.createElement('span');amount.id='v18-core-minerals';amount.hidden=true;amount.dataset.coreMinerals='';
  if(onShop){dock.dataset.dockMinerals='';dock.insertBefore(amount,shop);}
  else document.body.append(amount);
  const optionOf=button=>button&&onShop&&shop.contains(button)&&button.dataset.pad!==undefined?Number(button.dataset.pad):null;
  function shopClick(e){
    if(e.detail===0 && !e.pointerType && !e.sourceCapabilities?.firesTouchEvents){
      const i=optionOf(idOf(e.target));
      if(i!==null && active(context()))onShop(i,false);
    }
  }
  if(onShop){
    shop.addEventListener('click',shopClick);
    shop.addEventListener('keydown',e=>{
      if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();
    });
  }
  const buttons=[], tapTimers=new Map();
  // Acknowledges the physical tap, not a successful cast. Never call the
  // command from a transition, and never leave a one-shot action selected.
  function showTap(button){
    clearTimeout(tapTimers.get(button));
    button.dataset.tapped='';
    tapTimers.set(button,setTimeout(()=>{delete button.dataset.tapped;tapTimers.delete(button);},240));
  }
  function clearTaps(){
    for(const [button,timer] of tapTimers){clearTimeout(timer);delete button.dataset.tapped;}
    tapTimers.clear();
  }
  function makeButton(row,{key,label,cost,detail,tower}){
    const button=document.createElement('button'), name=document.createElement('strong'), price=document.createElement('small');
    button.type='button';button.dataset[tower?'towerKind':'v18Power']=key;
    name.textContent=label;price.textContent=costText(cost);
    button.setAttribute('aria-label',`${label} ${costText(cost)}`);
    button.title=`${detail}。${tower?'有舊塔時，購買即取代。':''}`;
    button.append(name,price);row.append(button);
    const get=()=>{const c=context();return {c,enabled:active(c),affordable:c.gold>=cost};};
    const trigger=()=>{
      const {c,enabled,affordable}=get();
      if(!enabled)return;
      showTap(button);
      if(!affordable){notice(`${label}需要 ${costText(cost)}，還差 ${costText(cost-c.gold)}。`);return;}
      if(tower)purchaseTower(key);
      else cast(key);
    };
    button.onclick=e=>{if(e.detail===0 && !e.pointerType && !e.sourceCapabilities?.firesTouchEvents)trigger();};
    button.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();});
    buttons.push({button,key,get,trigger,tower});
  }
  for(const [key,label] of Object.entries(SPECIAL_POWER_LABELS))
    makeButton(powerRow,{key,label,cost:costs[key],detail:POWER_SCOPE[key],tower:false});
  for(const [key,label] of Object.entries(FIELD_TOWER_LABELS))
    makeButton(towerRow,{key,label,cost:towerCosts[key],detail:TOWER_SCOPE[key],tower:true});

  let visibleScale=1,lastSeat=null,lastPose=-1,intent=null;
  const touches=new Set();
  const clearPress=()=>{if(intent)delete intent.button.dataset.pressing;intent=null;};
  const cancel=()=>{clearPress();clearTaps();touches.clear();};
  const wandered=e=>intent?.id===e.pointerId&&Math.hypot(e.clientX-intent.x,e.clientY-intent.y)>10*visibleScale;
  // Track concurrent contacts at window capture without preventing gestures
  // elsewhere. Scope the browser's tap/pinch suppression to the action panel.
  window.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'){touches.add(e.pointerId);if(touches.size>1)clearPress();}
    const c=context(), button=idOf(e.target);
    if(!active(c)||!button||button.disabled||(!actions.contains(button)&&optionOf(button)===null)||!e.isPrimary||e.button!==0||touches.size>1)return;
    clearPress();
    intent={button,seat:c.seat,match:c.match,id:e.pointerId,x:e.clientX,y:e.clientY};
    button.dataset.pressing='';
  },true);
  window.addEventListener('pointermove',e=>{if(wandered(e))clearPress();},true);
  window.addEventListener('pointerup',e=>{
    touches.delete(e.pointerId);
    if(intent?.id!==e.pointerId)return;
    const wanted=intent,c=context(), drag=wandered(e);clearPress();
    if(drag||touches.size||!active(c)||c.seat!==wanted.seat||c.match!==wanted.match||
      idOf(document.elementFromPoint(e.clientX,e.clientY))!==wanted.button)return;
    const i=optionOf(wanted.button);
    if(i!==null){onShop(i,true);return;}
    buttons.find(b=>b.button===wanted.button)?.trigger();
  },true);
  window.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);if(intent?.id===e.pointerId)clearPress();},true);
  window.addEventListener('blur',cancel);
  window.addEventListener('pagehide',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});

  function update(){
    const c=context();
    const show=!!(c.seat && c.mode!=='menu');
    if(!active(c)){clearPress();clearTaps();}
    dock.hidden=!show;
    if(onShop)amount.hidden=!show||!c.alive||c.mode==='end';
    else if(!show||!c.alive||c.mode==='end')amount.hidden=true;
    if(!show){lastPose=-1;return;}
    for(const {button,key,get,tower} of buttons){
      const {enabled,affordable}=get();
      if(button.disabled===enabled)button.disabled=!enabled;
      const can=String(affordable), installed=String(tower&&c.tower===key);
      if(button.dataset.affordable!==can)button.dataset.affordable=can;
      if(tower&&button.dataset.installed!==installed)button.dataset.installed=installed;
    }
    const text=`礦 ${formatMinerals(c.gold)}`;
    if(amount.textContent!==text){amount.textContent=text;amount.setAttribute('aria-label',`本席礦量 ${formatMinerals(c.gold)}`);}
  }
  function draw(frame,revision){
    const c=context();
    if(dock.hidden || !c.alive || c.mode==='end' || (revision===lastPose&&c.seat===lastSeat))return;
    lastSeat=c.seat;lastPose=revision;
    const s=Math.max(1,scale());
    if(s!==visibleScale){visibleScale=s;for(const e of [dock,amount])e.style.setProperty('--field-ui',String(s));}
    if(onShop)return; // The balance is laid out by the dock, never over the arena or status line.
    const p=projection(c.seat);
    const b=p&&coreBalancePlacement(p.bank,frame,s,p.keepClear?[p.keepClear]:[]);
    amount.hidden=!b;
    if(b){amount.style.left=`${Math.round(b[0])}px`;amount.style.top=`${Math.round(b[1])}px`;}
  }
  return {root:dock,update,draw,close:()=>{cancel();dock.hidden=true;amount.hidden=true;lastPose=-1;}};
}
