// Private trial action surface. Project existing in-world beacons to accessible
// native buttons; keep the authoritative price/targets and replay in the sim.
import { SPECIAL_POWER_LABELS, formatMinerals } from './special-power-ui.js';

const SHORT = {clear:'清除',control:'控制'};
const bounds=(x,y,w,h)=>({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});
const overlaps=(a,b)=>a.left<b.right && b.left<a.right && a.top<b.bottom && b.top<a.bottom;
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const live=c=>!!(c?.seat && c.alive && c.mode==='play');
const same=(a,b)=>a.seat===b.seat && a.match===b.match;

// Fit both touch targets as a pair. Prefer their actual projected centres; if
// too close at distance, separate without reordering the original pads.
export function directBeaconLayout(anchors, bank, frame, scale=1, keepClear=null) {
  if(!anchors?.every(Boolean) || anchors.length!==2)return null;
  const w=56*scale,h=44*scale,g=4*scale,bw=82*scale,bh=23*scale;
  const mid=anchors[0].map((v,k)=>(v+anchors[1][k])/2);
  const [dx,dy]=anchors[1].map((v,k)=>v-anchors[0][k]);
  const patterns=[anchors,
    [[mid[0]-Math.sign(dx||1)*(w+g)/2,mid[1]],[mid[0]+Math.sign(dx||1)*(w+g)/2,mid[1]]],
    [[mid[0],mid[1]-Math.sign(dy||1)*(h+g)/2],[mid[0],mid[1]+Math.sign(dy||1)*(h+g)/2]]];
  let winner=null,score=Infinity;
  for(const pattern of patterns){
    const [a,b]=pattern.map(([x,y])=>bounds(x,y,w,h));
    if(overlaps(a,b))continue;
    const left=Math.min(a.left,b.left),right=Math.max(a.right,b.right),top=Math.min(a.top,b.top),bottom=Math.max(a.bottom,b.bottom);
    if(right-left>frame.right-frame.left || bottom-top>frame.bottom-frame.top)continue;
    const xs=[0,-w*.57,w*.57],ys=[0,-h*.62,h*.62];
    if(keepClear){xs.push(keepClear.left-right-g,keepClear.right-left+g);ys.push(keepClear.top-bottom-g,keepClear.bottom-top+g);}
    for(const dx of xs)for(const dy of ys){
      const sx=clamp(dx,frame.left-left,frame.right-right),sy=clamp(dy,frame.top-top,frame.bottom-bottom);
      const points=pattern.map(([x,y])=>[x+sx,y+sy]),boxes=points.map(([x,y])=>bounds(x,y,w,h));
      // Do not hide the core or place either projected control over the other
      // one's original ring: both the label and the physical pad are tappable.
      if(boxes.some((b,i)=>keepClear&&overlaps(b,keepClear) || overlaps(b,bounds(...anchors[1-i],g,g))))continue;
      const diffs=points.map(([x,y],i)=>(x-anchors[i][0])**2+(y-anchors[i][1])**2);
      const cost=diffs[0]+diffs[1];
      // The control may fan slightly around a compact deck, never float across
      // the arena if its original beacon is genuinely offscreen.
      if(Math.sqrt(Math.max(...diffs))>84*scale || cost>=score)continue;
      score=cost;winner={points,boxes};
    }
  }
  let balance=null, bankCost=Infinity;
  if(bank && frame.right-frame.left>=bw && frame.bottom-frame.top>=bh)
    for(const ox of [0,-bw*.56,bw*.56,-bw,bw])for(const oy of [0,-bh,bh,-2*bh,2*bh]){
      const x=clamp(bank[0]+ox,frame.left+bw/2,frame.right-bw/2),
        y=clamp(bank[1]+oy,frame.top+bh/2,frame.bottom-bh/2);
      const b=bounds(x,y,bw,bh), cost=(x-bank[0])**2+(y-bank[1])**2;
      if(cost>=bankCost || Math.sqrt(cost)>75*scale || (keepClear&&overlaps(b,keepClear)) || winner?.boxes.some(a=>overlaps(a,b)))continue;
      balance=[x,y];bankCost=cost;
    }
  return {buttons:winner?.points??null,balance};
}

const CSS=`
#direct-special-beacons {position:fixed;inset:0;z-index:1;pointer-events:none;--beacon-ui:1}
#direct-special-beacons>*{position:absolute;margin:0;transform:translate(-50%,-50%);box-sizing:border-box}
#direct-special-beacons button{
 pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
 width:calc(56px * var(--beacon-ui));height:calc(44px * var(--beacon-ui));min-height:0;
 display:grid;place-content:center;gap:calc(2px * var(--beacon-ui));line-height:1.05;
 padding:0;border-radius:calc(6px * var(--beacon-ui));border:calc(1px * var(--beacon-ui)) solid #eac78e;
 background:#233246f2;color:#fff1d3;font-size:calc(13px * var(--beacon-ui));
 box-shadow:0 2px 5px #060a0b99;text-shadow:0 1px 1px #05090b;cursor:pointer;
}
#direct-special-beacons button[data-direct-special=control]{border-color:#a9d0ef;color:#dceefe}
#direct-special-beacons button[data-affordable=false]{background:#18232fdd;color:#e0e5eb;border-style:dashed}
#direct-special-beacons button:active:not(:disabled){background:#485a68}
#direct-special-beacons button:focus-visible{outline:2px solid #fff1ad;outline-offset:1px}
#direct-special-beacons small{display:block;font-size:calc(10px * var(--beacon-ui));font-variant-numeric:tabular-nums}
#direct-special-beacons [data-core-minerals]{
 display:grid;place-items:center;width:calc(82px * var(--beacon-ui));height:calc(23px * var(--beacon-ui));
 border:1px solid #e3b75d;border-radius:calc(5px * var(--beacon-ui));background:#161d26f5;color:#ffe5a1;
 text-align:center;font:750 calc(12px * var(--beacon-ui))/1 system-ui;font-variant-numeric:tabular-nums;
 white-space:nowrap;pointer-events:none;
}
`;

function idOf(element) {return element?.closest?.('[data-direct-special]')?.dataset.directSpecial ?? null;}
export function createDirectSpecialBeacons({canvas,costs,context,projection,canvasPower,cast,notice,scale=()=>1}) {
  const ids=Object.keys(SPECIAL_POWER_LABELS),buttons={};
  const css=document.createElement('style');css.id='direct-special-beacon-style';css.textContent=CSS;document.head.append(css);
  const group=document.createElement('section');group.id='direct-special-beacons';group.hidden=true;
  group.setAttribute('aria-label','本席主城的特殊信標');
  for(const power of ids){
    const button=document.createElement('button'), label=document.createElement('strong'), cost=document.createElement('small');
    button.type='button';button.hidden=true;button.dataset.directSpecial=power;
    const price=`${formatMinerals(costs[power])} 礦`;
    label.textContent=SHORT[power];cost.textContent=price;
    button.setAttribute('aria-label',`${SPECIAL_POWER_LABELS[power]} ${price}`);
    button.title=`${SPECIAL_POWER_LABELS[power]}：${price}`;
    button.append(label,cost);group.append(button);buttons[power]=button;
    // Native mouse/touch clicks are handled once on pointer release below.
    // Native keyboard and assistive action clicks still work with detail 0.
    button.onclick=e=>{if(e.detail===0 && !e.pointerType && !e.sourceCapabilities?.firesTouchEvents)use(power);};
    button.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();});
  }
  const bank=document.createElement('span');bank.dataset.coreMinerals='';bank.hidden=true;
  group.append(bank);document.body.append(group);
  let visibleScale=1, lastPose=-1,lastSeat=null;
  function use(power){
    const c=context();
    if(!live(c))return;
    const cost=costs[power];
    if(c.gold<cost){
      notice(`${SPECIAL_POWER_LABELS[power]}需要 ${formatMinerals(cost)} 礦，還差 ${formatMinerals(cost-c.gold)} 礦。`);
      return;
    }
    cast(power); // Funds/eligible targets rechecked by sim on the recorded tick.
  }

  const touches=new Set();
  let intent=null;
  function kindAt(x,y){
    const el=document.elementFromPoint(x,y);
    return idOf(el)||(el===canvas?canvasPower({clientX:x,clientY:y}):null);
  }
  const invalidate=()=>{intent=null;};
  // The canvas normally moves the commander on pointerdown. Consume it only
  // when the FIRST point hits an own pad, then require a matching clean up.
  window.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'){
      touches.add(e.pointerId);
      if(touches.size>1)invalidate();
    }
    if(!e.isPrimary||e.button!==0)return;
    const c=context(), power=live(c)?kindAt(e.clientX,e.clientY):null;
    if(!power)return;
    if(e.target===canvas)e.stopPropagation();
    if(touches.size>1)return;
    intent={power,ctx:c,id:e.pointerId,x:e.clientX,y:e.clientY};
  },true);
  const wandered=e=>intent?.id===e.pointerId && Math.hypot(e.clientX-intent.x,e.clientY-intent.y)>10*visibleScale;
  window.addEventListener('pointermove',e=>{if(wandered(e))invalidate();},true);
  window.addEventListener('pointerup',e=>{
    touches.delete(e.pointerId);
    if(intent?.id!==e.pointerId)return;
    const tapped=intent;invalidate();
    const c=context();
    if(!live(c)||!same(tapped.ctx,c)||touches.size ||
      Math.hypot(e.clientX-tapped.x,e.clientY-tapped.y)>10*visibleScale ||
      kindAt(e.clientX,e.clientY)!==tapped.power)return;
    use(tapped.power);
  },true);
  window.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);if(intent?.id===e.pointerId)invalidate();},true);
  function clear(){invalidate();touches.clear();}
  window.addEventListener('blur',clear);
  window.addEventListener('pagehide',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});

  function place(e,point){
    e.hidden=!point;
    if(point){
      const x=`${Math.round(point[0])}px`, y=`${Math.round(point[1])}px`;
      if(e.style.left!==x)e.style.left=x;
      if(e.style.top!==y)e.style.top=y;
    }
  }
  function update(){
    const c=context(), show=!!(c.seat && c.alive && (c.mode==='play'||c.mode==='paused'));
    group.hidden=!show;
    if(!show){invalidate();return;}
    for(const power of ids){
      if(buttons[power].disabled===live(c))buttons[power].disabled=!live(c);
      const ok=String(c.gold>=costs[power]);
      if(buttons[power].dataset.affordable!==ok)buttons[power].dataset.affordable=ok;
    }
    const text=`礦 ${formatMinerals(c.gold)}`;
    if(bank.textContent!==text){
      bank.textContent=text;
      bank.setAttribute('aria-label',`本席礦量 ${formatMinerals(c.gold)}`);
    }
  }
  function draw(frame,revision){
    const seat=context().seat;
    if(group.hidden || (revision===lastPose && seat===lastSeat))return;
    lastPose=revision;lastSeat=seat;
    const s=Math.max(1,scale());
    if(visibleScale!==s){visibleScale=s;group.style.setProperty('--beacon-ui',String(s));}
    const anchors=projection(seat), layout=anchors&&directBeaconLayout(anchors.pads,anchors.bank,frame,s,anchors.keepClear);
    ids.forEach((id,i)=>place(buttons[id],layout?.buttons?.[i]));
    place(bank,layout?.balance);
  }
  return {update,draw,close:()=>{clear();group.hidden=true;lastPose=-1;}};
}
