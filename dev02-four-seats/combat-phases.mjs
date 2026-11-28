// Candidate v9. Animation wind-up, flight, and damage are separate clocks.
// Values are the first lock -> release interval observed in the OpenBW open-field
// probe, not verified native-client frame data nor a universal lock rule.
const WINDUP = {
  marine: { first: 2, repeat: 0, stationary: true },
  dragoon: { first: 7, repeat: 1, stationary: true },
  hydralisk: { first: 4, repeat: 0, stationary: true },
  archon: { first: 4, repeat: 4, stationary: false },
};

export const shotTarget = p => p.hit?.id ?? (p.tower ? 'tower:' + p.core + (p.towerId===undefined?'':':'+p.towerId) : p.core) ?? null;
const EXPANSION_WINDUP = {guardian:{first:1,repeat:1,stationary:false},valkyrie:{first:1,repeat:1,stationary:false},warbringer:{first:1,repeat:1,stationary:true}};
const FLYING_WINDUP = { first:1, repeat:1, stationary:false };
export function attackReady(u, p, frame, hasFrame, version=9) {
  if (p.dragoonHold !== undefined) {
    // Keep turning and pause accumulated wind-up on a short loss of reach.
    // No shot can be started or released while this hold intent is active.
    if (hasFrame && u.fight?.target === p.dragoonHold) u.fight.due++;
    return false;
  }
  const target = shotTarget(p), profile = WINDUP[u.kind] ?? EXPANSION_WINDUP[u.kind] ?? (version>=10&&(u.kind==='battlecruiser'||u.kind==='wraith'||u.kind==='scout'||u.kind==='mutalisk') ? FLYING_WINDUP : null);
  if (u.fight?.target != null && (u.fight.target !== target || (profile?.stationary && u.motion?.speed > .001))) {
    u.fight.target = null;
  }
  if (!hasFrame || target === null || u.cd > 0) return false;
  if (!profile) return true; // do not guess wind-ups for the other weapons.
  if(profile.stationary && u.motion?.speed > .001) return false;
  if(version>=10){
    const facing=u.motion?.heading??((u.dx||u.dz)?Math.atan2(u.dz,u.dx):p.attackAngle);
    if(Math.abs(Math.atan2(Math.sin(p.attackAngle-facing),Math.cos(p.attackAngle-facing)))>(p.attackArc??Math.PI)) return false;
  }else if(profile.stationary&&u.motion&&Math.abs(Math.atan2(Math.sin(p.attackAngle-u.motion.heading),Math.cos(p.attackAngle-u.motion.heading)))>Math.PI/4) return false;
  const fight = u.fight ??= {target:null,lastTarget:null,at:-1,due:-1,fired:-1};
  if (fight.target !== target) {
    const continuous = fight.lastTarget === target && frame-fight.fired <= p.interval+8;
    fight.target = target; fight.at = frame; fight.due = frame+(continuous ? profile.repeat : profile.first);
  }
  return frame >= fight.due;
}
export function noteAttackFired(u, p, frame) {
  const fight = u.fight ??= {target:null,lastTarget:null,at:-1,due:-1,fired:-1};
  fight.lastTarget = shotTarget(p); fight.fired = frame; fight.target = null;
}
export function attackPose(u, frame) {
  const f=u.fight; if(!f) return 0;
  const time=frame-f.fired;
  if(f.fired>=0&&time>=0&&time<4)return (1-time/4)*.11;
  if(f.target!==null&&f.due>f.at)return -.14*Math.min(1,Math.max(0,(frame-f.at)/(f.due-f.at)));
  return 0;
}
