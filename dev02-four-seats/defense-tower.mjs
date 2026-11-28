// v11 defense lab. This is the Web prototype, not the original CHK's stats.
import { ccw, corePos, seatById } from '../dev05-layout/layout.mjs';
import { KINDS, PLATE, applyDamage } from './roster.mjs';

export const DEFENSE_VERSION = 11;
export const TOWER = Object.freeze({ cost: 70, hp: 180, range: 3.2, hitRadius: .50, damage: 55, period: 34, plate: 1 });

export function towerPosition(id, dim) {
  const [cx,cz] = corePos(id,dim), [dx,dz] = seatById(id).dir, [sx,sz]=ccw([dx,dz]);
  return [cx-dx*4.7+sx*1.9,cz-dz*4.7+sz*1.9];
}

export function buyTower(state, seat, dim, emit) {
  if (state.version < DEFENSE_VERSION || !seat?.alive || seat.tower || seat.gold < TOWER.cost) return false;
  const [x,z]=towerPosition(seat.id,dim);
  seat.gold-=TOWER.cost;seat.spent+=TOWER.cost;
  // Keep the wreck (hp=0) on the seat so a destroyed turret cannot be re-purchased.
  seat.tower={x,z,hp:TOWER.hp,next:state.tick};
  emit('tower-build',seat.id,{x,z,hp:TOWER.hp,cost:TOWER.cost});
  return true;
}

export function hitTower(state, id, damage, attack, divisor, emit) {
  const s=state.seats[id], t=s?.tower;
  if(!s?.alive||!t||t.hp<=0)return null;
  const body={hp:t.hp,sh:0,armor:'heavy'};
  const dealt=applyDamage(body,damage,attack,divisor,TOWER.plate);
  t.hp=Math.max(body.hp,0);
  if(!t.hp)emit('tower-fall',id,{x:t.x,z:t.z});
  return dealt;
}

export function fireTowers(state, units, killer, emit) {
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
