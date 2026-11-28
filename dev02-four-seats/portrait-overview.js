// Rendering/UI only. Kept out of the replay state and enabled only by the new
// portrait full-overview entry. No external stylesheet fetch (offline build).
export const PORTRAIT_OVERVIEW_VERSION = 13;
export const isNarrowPortrait = (w,h) => w>0 && w<=700 && h>w;
export const overviewAngles = angles => ({ ...angles, el: 70*Math.PI/180 });

const className='bc-portrait-overview';
const style=`
.${className} #bar {
  top:max(8px,env(safe-area-inset-top)); left:max(8px,env(safe-area-inset-left)); right:max(8px,env(safe-area-inset-right));
  width:auto; gap:4px; grid-template-columns:minmax(0,1fr) minmax(0,1.03fr);
}
.${className} #bar>h1 {
  display:flex; align-items:center; padding-inline:4px; font-size:clamp(13px,3.6vw,16px); min-height:40px;
}
.${className} h1 small {display:none}
.${className} .box {min-width:0;padding:3px 5px;gap:3px;background:#1c2630ef;border-color:#52626f}
.${className} #bar>.box:nth-child(2) {display:flex;align-items:center}
.${className} #bar>.box:nth-child(2) .row {width:100%;align-items:center;gap:4px}
.${className} #clock,.${className} #gold {font-size:20px}
.${className} #bar .row small {font-size:10px;line-height:1.15}
.${className} #cores {
  grid-column:1/-1;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:8px;row-gap:3px
}
.${className} .core {grid-template-columns:18px minmax(0,1fr) auto;gap:4px;font-size:10.5px}
.${className} .core b {width:18px;height:18px;font-size:11px;line-height:1;border-width:1px}
.${className} .core span {min-width:0;white-space:nowrap}
.${className} #bar>.box:nth-child(4),.${className} #bar>.box[role=group] {grid-column:1/-1;gap:4px}
.${className} #bar>.box:nth-child(4) {grid-template-columns:repeat(6,minmax(0,1fr))}
.${className} #bar>.box[role=group] {grid-template-columns:repeat(5,minmax(0,1fr))}
.${className} #bar>.box:nth-child(4) .row,.${className} #bar>.box[role=group] .row {display:contents}
.${className} #bar button {
  min-height:42px;min-width:0;white-space:normal;line-height:1.13;font-size:clamp(10.5px,3vw,12px);
  padding:3px 2px;overflow-wrap:anywhere
}
.${className} #now-playing {grid-column:1/-1;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.${className} #shop {
  left:50%;right:auto;width:min(540px,calc(100% - 16px));max-width:none;
  bottom:max(8px,env(safe-area-inset-bottom));grid-template-columns:repeat(3,minmax(0,1fr));gap:4px
}
.${className} #shop button {min-width:0;min-height:44px;padding:3px 4px;font-size:12px;line-height:1.25}
.${className} #shop small {font-size:10px}
.${className} #msg {
  left:max(8px,env(safe-area-inset-left));right:max(111px,calc(env(safe-area-inset-right) + 103px));
  max-width:none;transform:none;text-align:left;padding:4px 6px;font-size:11px;line-height:1.3;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;
  min-height:26px;background:#16222deb
}
.${className} #panel {right:max(8px,env(safe-area-inset-right));top:auto;bottom:var(--bc-overview-action-bottom,158px)}
.${className} #panel:not([open]) {max-height:none}
.${className} #panel[open] {width:min(270px,calc(100vw - 16px));max-height:min(42vh,385px)}
.${className} #panel>summary {font-size:11.5px;line-height:1.2;padding:7px 6px}
`;
let installed=false;
export function syncPortraitOverview(enabled,w,h,root=document.documentElement) {
  const active = enabled && isNarrowPortrait(w,h);
  if(active && !installed){
    const node=document.createElement('style');node.id='portrait-overview-style';node.textContent=style;
    document.head.append(node);installed=true;
  }
  root.classList.toggle(className,active);
  return active;
}

export function setPortraitOverviewActionInset(active,shopH,root=document.documentElement) {
  if(active) root.style.setProperty('--bc-overview-action-bottom',`${Math.ceil(shopH+6)}px`);
  else root.style.removeProperty('--bc-overview-action-bottom');
}

const originalFog=new WeakMap();
export function setPortraitOverviewFog(fog,active) {
  if(!fog?.isFog)return;
  if(active){
    if(!originalFog.has(fog))originalFog.set(fog,[fog.near,fog.far]);
    // After reclaiming portrait height the full fit becomes width-limited and
    // its camera is farther away. Keep that added distance out of the fog.
    fog.near=270; fog.far=415;
  } else if(originalFog.has(fog)){
    [fog.near,fog.far]=originalFog.get(fog);
    originalFog.delete(fog);
  }
}
