import assert from 'node:assert/strict';
import { PORTRAIT_OVERVIEW_VERSION,isNarrowPortrait,overviewAngles,syncPortraitOverview,
  setPortraitOverviewActionInset,setPortraitOverviewFog } from './portrait-overview.js';
assert.equal(PORTRAIT_OVERVIEW_VERSION,13);
assert.equal(isNarrowPortrait(390,844),true);
assert.equal(isNarrowPortrait(700,844),true);
for(const s of [[844,390],[701,844],[530,530],[0,100]])assert.equal(isNarrowPortrait(...s),false);
const angles={az:.45,el:49*Math.PI/180};
assert.equal(overviewAngles(angles).el,70*Math.PI/180);
assert.equal(overviewAngles(angles).az,angles.az);
assert.equal(angles.el,49*Math.PI/180);
const classes=new Set(),style=new Map(),head=[];
const root={classList:{toggle(c,on){if(on)classes.add(c);else classes.delete(c);}},style:{
  setProperty(k,v){style.set(k,v);},removeProperty(k){style.delete(k);},
}};
globalThis.document={documentElement:root,createElement:()=>({}),head:{append(x){head.push(x);}}};
assert.equal(syncPortraitOverview(false,390,844),false);
assert.equal(head.length,0,'no stylesheet insertion for legacy/full-landscape baseline');
assert.equal(syncPortraitOverview(true,390,844),true);
assert.equal(syncPortraitOverview(true,360,740),true);
assert.equal(classes.size,1);assert.equal(head.length,1,'insert stylesheet only once');
assert.match(head[0].textContent,/\.bc-portrait-overview #shop/);
setPortraitOverviewActionInset(true,123.5);assert.equal(style.get('--bc-overview-action-bottom'),'130px');
assert.equal(syncPortraitOverview(true,844,390),false);assert.equal(classes.size,0);
setPortraitOverviewActionInset(false,0);assert.equal(style.size,0);
const fog={isFog:true,near:150,far:290};
setPortraitOverviewFog(fog,true);setPortraitOverviewFog(fog,true);
assert.deepEqual([fog.near,fog.far],[270,415]);
setPortraitOverviewFog(fog,false);setPortraitOverviewFog(fog,false);
assert.deepEqual([fog.near,fog.far],[150,290]);
console.log('Portrait overview: v13-scoped narrow view; style and fog restore on exit.');
