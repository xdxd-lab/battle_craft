// v11 keeps its prototype turret. v18 adds three independently tuned SPEED-inspired variants.
import { ccw, corePos, seatById } from '../dev05-layout/layout.mjs';
import { KINDS, PLATE, SHIELD_REGEN, framesAt, applyDamage } from './roster.mjs';
import { WORLD_PER_PX } from './motion.mjs';
import { weaponBoxFromExtents, weaponGapPx } from './combat-reach.mjs';
import { placeSeekingShot, advanceSeekingShot, targetPoint } from './weapon-delivery.mjs';
import { scaleCoins } from './special-powers.mjs';

export const DEFENSE_VERSION = 11;
export const VISIBILITY_VERSION = 12;
export const DEFENSE_TUNING_VERSION = 13;
export const TOWER_VARIANTS_VERSION = 18;
export const TOWER = Object.freeze({ cost: 70, hp: 180, range: 3.2, hitRadius: .50, damage: 55, period: 34, plate: 1 });

// 500 is the original 2009 purchase cost in the v16+ mineral denomination.
const variant = (name, hp, shield, plate, damage, attack, period, ground, air, extents, windup, delivery) =>
  Object.freeze({ name, cost:500, hp, shield, plate, damage, attack, period, ground, air,
    rangePx:224, range:224*WORLD_PER_PX, hitRadius:TOWER.hitRadius, extents:Object.freeze(extents), windup, delivery:Object.freeze(delivery) });
const home = (speed,accel,turn,lifetime,muzzle,muzzleUp=0) =>
  ({mode:'home',speed,accel,turn:turn*Math.PI/128,lifetime,muzzle,muzzleUp,offset:0});
export const TOWER_VARIANTS = Object.freeze({
  photon: variant('光子砲臺',300,300,3,60,'N',22,true,true,[20,16,20,16],6,home(17067,850,127,255,0,20)),
  spore: variant('孢子殖體',300,0,3,80,'N',15,false,true,[24,24,23,23],0,home(8533,667,40,60,5)),
  sunken: variant('沉沒殖體',300,0,3,120,'E',32,true,false,[24,24,23,23],10,{mode:'atTarget',delay:5}),
});
export const towerSpec = (version, kind) =>
  version < TOWER_VARIANTS_VERSION ? TOWER : Object.hasOwn(TOWER_VARIANTS,kind) ? TOWER_VARIANTS[kind] : null;
export const towerCost = (version, kind) =>
  version < TOWER_VARIANTS_VERSION ? scaleCoins(version,TOWER.cost) : towerSpec(version,kind)?.cost ?? TOWER_VARIANTS.photon.cost;
export const towerWeaponBox = t => weaponBoxFromExtents(TOWER_VARIANTS[t.kind].extents,t.x,t.z);

export function towerPosition(id, dim) {
  const [cx,cz] = corePos(id,dim), [dx,dz] = seatById(id).dir, [sx,sz]=ccw([dx,dz]);
  const [front,side] = dim.visibleTower ? [6,3.15] : [4.7,1.9];
  return [cx-dx*front+sx*side,cz-dz*front+sz*side];
}

export function buyTower(state, seat, dim, emit, kind) {
  if (state.version >= TOWER_VARIANTS_VERSION) {
    const spec=towerSpec(state.version,kind);
    if (!spec || !seat?.alive || seat.gold < spec.cost) return false;
    const [x,z]=towerPosition(seat.id,dim), old=seat.tower;
    // Each replacement is an independent object in the one slot; an old
    // in-flight hit cannot damage the newly paid-for body.
    seat.gold-=spec.cost;seat.spent+=spec.cost;
    const t=seat.tower={x,z,hp:spec.hp,sh:spec.shield,kind,id:(old?.id??0)+1,next:framesAt(state.tick)};
    emit('tower-build',seat.id,{x,z,hp:t.hp,sh:t.sh,cost:spec.cost,kind,towerId:t.id,replaced:old?.kind??null});
    return true;
  }
  const cost = towerCost(state.version);
  if (state.version < DEFENSE_VERSION || !seat?.alive || seat.tower || seat.gold < cost) return false;
  const [x,z]=towerPosition(seat.id,dim);
  seat.gold-=cost;seat.spent+=cost;
  // Keep the wreck (hp=0) on the seat so a destroyed turret cannot be re-purchased.
  seat.tower={x,z,hp:TOWER.hp,next:state.tick};
  emit('tower-build',seat.id,{x,z,hp:TOWER.hp,cost});
  return true;
}

export function hitTower(state, id, damage, attack, divisor, emit, expectedTowerId) {
  const s=state.seats[id], t=s?.tower;
  if(!s?.alive||!t||t.hp<=0)return null;
  const modern=state.version>=TOWER_VARIANTS_VERSION;
  if(modern && expectedTowerId!==undefined && t.id!==expectedTowerId)return null;
  const body={hp:t.hp,sh:modern?t.sh:0,armor:'heavy'};
  const dealt=applyDamage(body,damage,attack,divisor,towerSpec(state.version,t.kind).plate);
  t.hp=Math.max(body.hp,0);
  if(modern)t.sh=body.sh;
  if(!t.hp)emit('tower-fall',id,{x:t.x,z:t.z,...(modern?{kind:t.kind,towerId:t.id}:{})});
  return dealt;
}

export function fireTowers(state, units, killer, emit, boxes, frame, frames) {
  if(state.version>=TOWER_VARIANTS_VERSION)return fireVariantTowers(state,units,killer,emit,boxes,frame,frames);
  for (const s of Object.values(state.seats)) {
    const t=s.tower;
    if(!s.alive||!t||t.hp<=0||state.tick<t.next)continue;
    // Closest eligible attacker, one beam per reload. No splash and no core damage.
    let best=null, d2=TOWER.range*TOWER.range;
    for(const u of units) {
      if(u.hp<=0||u.team===s.team)continue;
      const d=(u.x-t.x)**2+(u.z-t.z)**2;
      if(d<d2||(d===d2&&(!best||u.id<best.id))){best=u;d2=d;}
    }
    if(!best)continue;
    t.next=state.tick+TOWER.period;
    const body={hp:best.hp,sh:best.sh,armor:best.armor??KINDS[best.kind].armor};
    const dealt=applyDamage(body,TOWER.damage,'N',1,PLATE[best.kind]);
    best.hp=body.hp;best.sh=body.sh;
    if(best.hp<=0)killer.set(best.id,s.id);
    emit('tower-fire',s.id,{x:t.x,z:t.z,to:best.id,tx:best.x,tz:best.z,...dealt},true);
  }
}

export function regenerateTowerShields(state, frames) {
  if(state.version<TOWER_VARIANTS_VERSION || !frames)return;
  for(const seat of Object.values(state.seats)){
    const t=seat.tower;
    if(!seat.alive||!t||t.hp<=0)continue;
    const max=towerSpec(state.version,t.kind).shield;
    if(t.sh<max)t.sh=Math.min(max,t.sh+SHIELD_REGEN*frames/256);
  }
}

const shotEvent = shot => ({
  kind:shot.kind, shot:shot.id, towerId:shot.towerId, to:shot.target, x:shot.x, z:shot.z, tx:shot.tx, tz:shot.tz,
  targetAir:shot.air, delivery:shot.delivery,
});

function fireVariantTowers(state, units, killer, emit, boxes, frame, frames) {
  if(!frames)return;
  const byId=new Map(units.map(u=>[u.id,u]));
  function impact(shot, t) {
    if(!t||t.hp<=0||t.team===state.seats[shot.seat].team){
      emit('tower-fizzle',shot.seat,shotEvent(shot),true);
      return;
    }
    const spec=towerSpec(state.version,shot.kind);
    const body={hp:t.hp,sh:t.sh,armor:t.armor??KINDS[t.kind].armor};
    const dealt=applyDamage(body,spec.damage,spec.attack,1,PLATE[t.kind]);
    t.hp=body.hp;t.sh=body.sh;
    if(t.hp<=0)killer.set(t.id,shot.seat);
    emit('tower-impact',shot.seat,{...shotEvent(shot),...dealt},true);
  }
  state.towerShots=state.towerShots.filter(shot=>{
    const t=byId.get(shot.target);
    if(shot.delivery==='atTarget'){
      if(frame<shot.due)return true;
    }else{
      // The retained target remains authoritative. Tracking continues beyond
      // launch range; a lost/dead target leaves a harmless effect at its end.
      if(t?.hp>0){shot.tx=t.x;shot.tz=t.z;}
      const profile=towerSpec(state.version,shot.kind).delivery;
      if(!advanceSeekingShot(shot,profile,frames))return true;
    }
    impact(shot,t);
    return false;
  });
  for(const seat of Object.values(state.seats)){
    const t=seat.tower;
    if(!seat.alive||!t||t.hp<=0)continue;
    const spec=towerSpec(state.version,t.kind), box=towerWeaponBox(t);
    let best=null, bestGap=spec.rangePx;
    for(const u of units){
      if(u.hp<=0||u.team===seat.team||!(KINDS[u.kind].air?spec.air:spec.ground))continue;
      const gap=weaponGapPx(box,boxes.get(u.id));
      if(gap>spec.rangePx)continue;
      if(u.id===t.lock){best=u;break;}
      if(gap<bestGap||(gap===bestGap&&(!best||u.id<best.id))){best=u;bestGap=gap;}
    }
    if(!best){delete t.lock;delete t.aim;continue;}
    if(t.lock!==best.id){t.lock=best.id;t.aim=frame+spec.windup;}
    if(frame<t.next||frame<t.aim)continue;
    t.next=frame+spec.period;
    const delivery=spec.delivery, shot={
      id:++state.shotSerial,seat:seat.id,kind:t.kind,towerId:t.id,target:best.id,air:KINDS[best.kind].air,delivery:delivery.mode,
    };
    if(delivery.mode==='atTarget'){
      const [x,z]=targetPoint(t,best);
      Object.assign(shot,{x,z,tx:x,tz:z,due:frame+delivery.delay});
      state.towerShots.push(shot);
    }else{
      const muzzle={x:t.x,z:t.z-delivery.muzzleUp*WORLD_PER_PX};
      placeSeekingShot(shot,delivery,muzzle,best.x,best.z,0);
    }
    emit('tower-fire',seat.id,{...shotEvent(shot),x:t.x,z:t.z},true);
    if(delivery.mode==='home'){
      if(advanceSeekingShot(shot,delivery,frames))impact(shot,best);
      else state.towerShots.push(shot);
    }
  }
}
