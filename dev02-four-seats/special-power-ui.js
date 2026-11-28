// Explicit confirm-only controls for the two special flag actions. UI only;
// the replay simulation decides eligibility, charged amount and affected IDs.
export const SPECIAL_POWER_LABELS = Object.freeze({clear:'敵對兵清除',control:'敵對兵控制'});
const summary=Object.freeze({clear:'移除範圍內的敵對地面與空中部隊。',control:'將範圍內的敵對地面與空中部隊轉為你的部隊。'});
const money = new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
export const formatMinerals = v=>money.format(v);

export function powerAvailability(ctx,cost,count) {
  if (!ctx?.seat) return {allowed:false,text:'觀戰中，不能使用特殊信標。'};
  if (!ctx.alive) return {allowed:false,text:'你的核心已失守，不能使用特殊信標。'};
  if (ctx.mode!=='play') return {allowed:false,text:ctx.mode==='paused'?'對局暫停中。':'此時不能使用特殊信標。'};
  const issue=[];
  if(!count)issue.push('範圍內沒有敵對兵');
  if(ctx.gold<cost)issue.push(`還差 ${formatMinerals(cost-ctx.gold)} 礦`);
  return issue.length?{allowed:false,text:issue.join('；')+'。'}:{allowed:true,text:`範圍內 ${count} 名敵對兵，可確認使用。`};
}
export function powerResult(e) {
  const label=SPECIAL_POWER_LABELS[e.power] || '特殊信標';
  if(e.status==='empty') return `${label}：範圍內沒有敵對兵，未扣礦。`;
  if(e.status==='insufficient') return `${label}：礦量不足，需 ${formatMinerals(e.cost)} 礦，未扣礦。`;
  if(e.status==='applied') return `${label}：${e.power==='clear'?'移除':'接管'} ${e.count} 名敵對兵，花 ${formatMinerals(e.cost)} 礦。`;
  return null;
}

const CSS=`
#bar .special-power-launcher-row button{font-size:11px;white-space:normal;overflow-wrap:anywhere}
#bar .special-power-launcher-row [data-special-launch]{color:#e9f4fd;background:#23384a;border-color:#729ab3;font-weight:700}
.bc-portrait-overview #bar>.box[role=group].has-special-powers:not(.special-powers-hidden){grid-template-columns:repeat(6,minmax(0,1fr))}
#special-power-dialog {
 color:#f1f5f8;background:#141e27;border:1px solid #69869c;border-radius:12px;
 width:min(calc(100% - 24px),460px);max-height:calc(100dvh - 24px);padding:16px;overflow:auto;
}
#special-power-dialog::backdrop{background:#071019ba}
#special-power-dialog header{display:flex;align-items:center;justify-content:space-between;gap:9px}
#special-power-dialog h2{margin:0;color:#edf6fd;font-size:1.24em}
#special-power-dialog header button{width:44px;min-height:44px;border-radius:7px}
#special-power-dialog p{margin:8px 0;line-height:1.43}
#special-power-dialog .special-scope{color:#c3d2df}
#special-power-dialog .special-area-key{display:flex;align-items:center;gap:9px;font-size:.86em;line-height:1.38;color:#cddde9}
#special-power-dialog .special-area-key svg{width:4.5em;flex:none;max-height:4.5em}
#special-power-dialog .special-area-key b{color:#ebc994}
#special-power-dialog .special-area-key em{color:#bbdcfc;font-style:normal}
#special-power-dialog .special-cards{display:grid;gap:8px}
#special-power-dialog .special-card{border:1px solid #465c70;border-radius:7px;padding:7px}
#special-power-dialog [data-special-action]{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;min-height:44px;text-align:left;border-radius:5px;padding:4px 9px;white-space:normal;background:#294358}
#special-power-dialog [data-special-action][aria-pressed=true]{border-color:#c3e4fd;background:#e9edf0;color:#122535}
#special-power-dialog [data-special-action][aria-disabled=true]{opacity:.76}
#special-power-dialog [data-special-state]{display:block;color:#f7d190;font-size:.9em;line-height:1.25}
#special-power-dialog [data-special-state][data-ready=true]{color:#b5ebbf}
#special-power-dialog [data-special-confirm]{width:100%;min-height:44px;border-radius:6px;font-weight:800;color:#133049;background:#d5eefd}
#special-power-dialog [data-special-status]{min-height:1em;color:#f6d394}
#special-power-dialog[data-virtual=true]{
 font-size:calc(14px * var(--special-ui-scale));padding:calc(10px * var(--special-ui-scale));border-radius:calc(7px * var(--special-ui-scale))
}
#special-power-dialog[data-virtual=true] header button{width:calc(36px * var(--special-ui-scale))}
#special-power-dialog[data-virtual=true] button{min-height:calc(38px * var(--special-ui-scale))}
#special-power-dialog[data-virtual=true] .special-card{padding:calc(5px * var(--special-ui-scale))}
`;
function setText(node,text){if(node.textContent!==text)node.textContent=text;}
export function createSpecialPowerUi({towerButton,costs,zone,context,targets,cast,release,scale=()=>1}) {
  const names=Object.keys(SPECIAL_POWER_LABELS);
  const styled=document.createElement('style'); styled.id='special-power-ui-style';styled.textContent=CSS;document.head.append(styled);
  const row=document.createElement('div');row.className='row special-power-launcher-row';row.hidden=true;
  const host=towerButton.parentElement;host.classList.add('has-special-powers','special-powers-hidden');
  towerButton.before(row);
  const launch=document.createElement('button');launch.type='button';launch.dataset.specialLaunch='';
  launch.textContent='特殊信標';launch.setAttribute('aria-controls','special-power-dialog');launch.setAttribute('aria-haspopup','dialog');
  row.append(towerButton,launch);

  const dialog=document.createElement('dialog');dialog.id='special-power-dialog';dialog.setAttribute('aria-labelledby','special-power-title');
  dialog.innerHTML='<header><h2 id="special-power-title">特殊信標</h2><button type="button" data-special-close aria-label="關閉特殊信標">關閉</button></header><p class="special-scope">作用於中央交會區及四條主道路；不包含主城平台、核心、砲塔或友軍。</p><div class="special-area-key"></div><p data-special-balance></p><div class="special-cards"></div><p role="status" aria-live="polite" data-special-status></p><button type="button" data-special-confirm hidden>確認使用</button>';
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector), cards=$('.special-cards');
  const close=$('[data-special-close]'), confirm=$('[data-special-confirm]'), status=$('[data-special-status]'), balance=$('[data-special-balance]');
  // These are the same dimensions the simulation supplies, not decorative guessed reach.
  const full=zone('clear'), core=zone('control');
  const cross=({reach:r,halfWidth:w})=>`M ${-w} ${-r} H ${w} V ${-w} H ${r} V ${w} H ${w} V ${r} H ${-w} V ${w} H ${-r} V ${-w} H ${-w} Z`;
  const r=full.coreDistance+2;
  const homes=[[0,-1],[-1,0],[0,1],[1,0]].map(([x,z])=>`<circle cx="${x*full.coreDistance}" cy="${z*full.coreDistance}" r="${full.corePlatformRadius}" fill="black"/>`).join('');
  $('.special-area-key').innerHTML=`<svg viewBox="${-r} ${-r} ${2*r} ${2*r}" role="img" aria-label="清除覆蓋金色全長，控制只覆蓋藍色中央範圍；兩者都不包含主城平台"><defs><mask id="bc-power-homes" x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" maskUnits="userSpaceOnUse"><rect x="${-r}" y="${-r}" width="${2*r}" height="${2*r}" fill="white"/>${homes}</mask></defs><g fill="#c59b63" mask="url(#bc-power-homes)"><path d="${cross({...full,reach:full.coreDistance})}"/><circle r="${full.junctionRadius}"/></g><g fill="#a0c9e7"><path d="${cross(core)}"/><circle r="${core.junctionRadius}"/></g></svg><span><b>金色：清除全長</b><br><em>藍色：控制中央 70%</em></span>`;
  const actions={}, states={}; let armed=null;
  names.forEach(power=>{
    const data=zone(power), card=document.createElement('div');card.className='special-card';
    card.innerHTML='<button type="button" aria-pressed="false"><strong></strong><b></b></button><p class="special-scope"></p><small></small>';
    const button=card.querySelector('button'), state=card.querySelector('small');
    button.dataset.specialAction=power;state.dataset.specialState=power;
    setText(button.querySelector('strong'),SPECIAL_POWER_LABELS[power]);
    setText(button.querySelector('b'),`${formatMinerals(costs[power])} 礦`);
    setText(card.querySelector('p'),`${summary[power]}每臂中線從場地中心算起 ${formatMinerals(data.reach)} 世界單位${power==='clear'?'，兩側沿主城平台邊緣截止':''}。`);
    actions[power]=button;states[power]=state;button.onclick=()=>choose(power);cards.append(card);
  });
  const availability=p=>powerAvailability(context(),costs[p],targets(p));
  function update() {
    const ctx=context(), visible=!!ctx?.seat && ctx.mode!=='menu';
    row.hidden=!visible;host.classList.toggle('special-powers-hidden',!visible);
    launch.disabled=!ctx?.alive || ctx.mode==='end';
    if(!dialog.open)return;
    if(!visible || !ctx.alive || ctx.mode==='end'){dialog.close();return;}
    setText(balance,`目前 ${formatMinerals(ctx.gold)} 礦`);
    for (const power of names){
      const a=availability(power);
      setText(states[power],a.text);states[power].dataset.ready=String(a.allowed);
      actions[power].setAttribute('aria-disabled',String(!a.allowed));
      actions[power].setAttribute('aria-pressed',String(armed===power));
      if(armed===power)confirm.disabled=!a.allowed;
    }
    confirm.hidden=!armed;
    if(armed)setText(confirm,`確認使用：${SPECIAL_POWER_LABELS[armed]}（${formatMinerals(costs[armed])} 礦）`);
  }
  function choose(power){
    const a=availability(power);
    armed=a.allowed?power:null;
    setText(status,a.allowed?'請再次確認；只按選擇不會發動或扣礦。':a.text);
    update();
    if(armed)confirm.focus();
  }
  function open(power=null) {
    const ctx=context();
    if(!ctx?.alive || ctx.mode==='end' || ctx.mode==='menu')return false;
    if(!dialog.open){
      release();
      const s=Math.max(1,scale());dialog.dataset.virtual=String(s>1);
      dialog.style.setProperty('--special-ui-scale',String(s));
      dialog.style.maxWidth=`${460*s}px`;if(s>1)dialog.style.width=`min(calc(100% - ${24*s}px),${460*s}px)`;
      else dialog.style.width='';
      dialog.showModal();
    }
    armed=null;setText(status,'');update();
    if(names.includes(power))choose(power);else close.focus();
    return true;
  }
  confirm.onclick=()=>{
    if(!armed)return;
    const a=availability(armed);
    if(!a.allowed){setText(status,a.text);update();return;}
    const power=armed;armed=null;
    cast(power);dialog.close();
  };
  launch.onclick=()=>open();close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{armed=null;setText(status,'');});
  return {open,update,close:()=>{if(dialog.open)dialog.close();},isOpen:()=>dialog.open};
}
