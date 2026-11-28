// v16 special powers are explicit player commands, not commander beacons or NPC actions.
export const SPECIAL_POWER_VERSION = 16;
export const ECONOMY_SCALE = 20;
export const PLAYABLE_JUNCTION_RADIUS = 8.2; // The visual junction is slightly larger.
export const SPECIAL_POWER_COSTS = Object.freeze({ clear: 4500, control: 6000 });

export const scaleCoins = (version, coins) => version >= SPECIAL_POWER_VERSION ? coins * ECONOMY_SCALE : coins;

export function specialPowerZone(power, dim) {
  if (!Object.hasOwn(SPECIAL_POWER_COSTS, power)) return null;
  const roadReach = dim.coreDistance - dim.corePlatformRadius;
  return { halfWidth: dim.laneHalf, reach: roadReach * (power === 'control' ? .7 : 1),
    junctionRadius: PLAYABLE_JUNCTION_RADIUS };
}

export function inSpecialPowerZone(power, dim, x, z) {
  const zone = specialPowerZone(power, dim);
  if (!zone || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  return pointInCross(power, zone, dim, x, z);
}

function pointInCross(power, { halfWidth, reach, junctionRadius }, dim, x, z) {
  // Both axes share the movement lane's playable width. The long coordinate
  // picks the nearest of the four home platforms; the rim is protected too.
  // Clear follows the round rim into the shoulders, whereas control is a
  // straight, symmetric cutoff at 70% of the nominal centerline reach.
  const roadEnd = power === 'clear' ? dim.coreDistance : reach;
  const ax = Math.abs(x), az = Math.abs(z), along = Math.max(ax, az), across = Math.min(ax, az);
  return (across <= halfWidth && along <= roadEnd || ax * ax + az * az <= junctionRadius ** 2) &&
    (dim.coreDistance - along) ** 2 + across ** 2 > dim.corePlatformRadius ** 2;
}

function playerSeat(state, id) {
  if (state.version < SPECIAL_POWER_VERSION || state.mode !== 'play' || !Object.hasOwn(state.seats, id) || state.bots[id]) return null;
  const seat = state.seats[id];
  return seat.alive ? seat : null;
}

export function specialPowerTargets(state, id, power, dim) {
  const seat = playerSeat(state, id), zone = specialPowerZone(power, dim);
  if (!seat || !zone) return [];
  return state.units.filter(u => u.hp > 0 && u.team !== seat.team && pointInCross(power, zone, dim, u.x, u.z))
    .sort((a, b) => a.id - b.id);
}

export function applySpecialPower(state, id, power, dim, targetOf, emit) {
  const seat = playerSeat(state, id);
  if (!seat || !Object.hasOwn(SPECIAL_POWER_COSTS, power)) return false;
  const cost = SPECIAL_POWER_COSTS[power], targets = specialPowerTargets(state, id, power, dim);
  const report = (status, units = []) => emit('special', id, { power, status, cost, gold: seat.gold, count: units.length, units });
  if (!targets.length) { report('empty'); return false; }
  if (seat.gold < cost) { report('insufficient'); return false; }

  seat.gold -= cost;
  seat.spent += cost;
  const ids = targets.map(u => u.id);
  report('applied', ids);
  if (power === 'clear') {
    const remove = new Set(ids);
    state.units = state.units.filter(u => !remove.has(u.id));
    seat.kills += ids.length;
    for (const u of targets) {
      state.seats[u.seat].lost++;
      emit('death', u.seat, { unit: u.id, kind: u.kind, x: u.x, z: u.z, by: [id] });
    }
  } else {
    const target = targetOf(state, id);
    for (const u of targets) {
      // This is the same body, not a re-spawn: retain ID, physical kinematics,
      // HP, shield, and reload; discard old orders and unreleased attacks.
      Object.assign(u, { seat: id, team: seat.team, target, foe: 0, controlledAt: state.tick });
      delete u.fight;
      delete u.dragoonTrack;
    }
  }
  return true;
}
