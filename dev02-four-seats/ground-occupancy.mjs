// Candidate v9 ground locomotion. Not a port of Brood War pathfinding; only the
// ground body dimensions below are from its data. Do not call in older simulations.
import { SEATS } from '../dev05-layout/layout.mjs';
import { WORLD_PER_PX } from './motion.mjs';

const EPS = 1e-9;
// units.dat pixel extents: left, up, right, down, measured from the unit centre.
// Source ids: 0 Marine, 66 Dragoon, 38 Hydralisk, 68 Archon. Screen axes stay aligned
// with map axes when the body turns (do not rotate this with the drawn model).
export const GROUND_DAT_EXTENTS = Object.freeze({
  marine: Object.freeze([8, 9, 8, 10]),
  dragoon: Object.freeze([15, 15, 16, 16]),
  hydralisk: Object.freeze([10, 10, 10, 12]),
  archon: Object.freeze([16, 16, 15, 15]),
});
const shapes = Object.freeze(Object.fromEntries(Object.entries(GROUND_DAT_EXTENTS).map(([k, b]) =>
  [k, Object.freeze(b.map(v => (v + .5) * WORLD_PER_PX))])));
export const groundExtents = kind => Object.hasOwn(shapes, kind) ? shapes[kind] : null;
const shapeOf = u => groundExtents(u.kind);
const alive = u => u.hp === undefined || u.hp > 0;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const sq = v => v * v;
const toBox = (shape, x, z) => [x - shape[0], z - shape[1], x + shape[2], z + shape[3]];

export function groundGap(a, b) {
  const as = shapeOf(a), bs = shapeOf(b);
  if (!as || !bs) return null; // not a ground-ground pair
  const [ax, az, ar, ab] = toBox(as, a.x, a.z);
  const [bx, bz, br, bb] = toBox(bs, b.x, b.z);
  return Math.hypot(Math.max(0, ax - br, bx - ar), Math.max(0, az - bb, bz - ab));
}
export function groundOverlap(a, b) {
  const as = shapeOf(a), bs = shapeOf(b);
  if (!as || !bs) return false;
  const [ax, az, ar, ab] = toBox(as, a.x, a.z);
  const [bx, bz, br, bb] = toBox(bs, b.x, b.z);
  return ax < br - EPS && az < bb - EPS && bx < ar - EPS && bz < ab - EPS;
}

// Cross-shaped road + circular hub + four circular core platforms, minus solid cores.
// Splitting at the road's straight boundaries makes each leftover sub-rectangle
// either fully inside a circular pad or invalid. The five v8/v9 pads are disjoint.
export function createGroundTerrain(dim, rules) {
  const C = dim.coreDistance, half = dim.laneHalf ?? rules.laneHalf;
  const platform = dim.platformWalkRadius ?? rules.platform;
  const platforms = SEATS.map(({ dir: [x, z] }) => [x * C, z * C]);
  const dims = [-C, -half, half, C];
  const inRect = (l,t,r,b) => (l >= -half - EPS && r <= half + EPS && t >= -C - EPS && b <= C + EPS) ||
    (t >= -half - EPS && b <= half + EPS && l >= -C - EPS && r <= C + EPS);
  const insideDisk = (l,t,r,b,x,z,radius) => sq(Math.max(Math.abs(l-x),Math.abs(r-x))) +
    sq(Math.max(Math.abs(t-z),Math.abs(b-z))) <= sq(radius) + EPS;
  const inDisk = (l,t,r,b) => insideDisk(l,t,r,b,0,0,rules.junction) ||
    platforms.some(([x,z]) => insideDisk(l,t,r,b,x,z,platform));
  const cuts = (a,b) => [a,...dims.filter(v => v>a && v<b),b];
  function contains(l,t,r,b) {
    if (platforms.some(([x,z]) => sq(x-clamp(x,l,r)) + sq(z-clamp(z,t,b)) < sq(rules.coreRadius)-EPS)) return false;
    if (inRect(l,t,r,b) || inDisk(l,t,r,b)) return true;
    const xs = cuts(l,r), zs = cuts(t,b);
    for (let i=0; i<xs.length-1; i++) for (let j=0; j<zs.length-1; j++) {
      if (!inRect(xs[i],zs[j],xs[i+1],zs[j+1]) && !inDisk(xs[i],zs[j],xs[i+1],zs[j+1])) return false;
    }
    return true;
  }
  return { contains, fits(kind,x,z) {
    const shape = groundExtents(kind);
    return !!shape && Number.isFinite(x) && Number.isFinite(z) && contains(...toBox(shape,x,z));
  }};
}

const CELL = .5, pxThreshold = WORLD_PER_PX;
const MAX_EXTENT = Math.max(...Object.values(shapes).flat());
const along = (value, delta, lo, hi) => {
  if (Math.abs(delta) < EPS) return value > lo && value < hi ? [-Infinity,Infinity] : [Infinity,-Infinity];
  const a = (lo-value)/delta, b = (hi-value)/delta;
  return [Math.min(a,b),Math.max(a,b)];
};
// Segment sweeps a translated rectangle; hitting only an edge/corner is legal.
function crosses(m, x, z, dx, dz, other) {
  const a = m.shape, b = other.shape;
  const [ex,lx] = along(x, dx, other.x-b[0]-a[2]+EPS, other.x+b[2]+a[0]-EPS);
  const [ez,lz] = along(z, dz, other.z-b[1]-a[3]+EPS, other.z+b[3]+a[1]-EPS);
  return Math.max(ex,ez,0) < Math.min(lx,lz,1);
}

const STEER = [
  [Math.cos(Math.PI*7/18), Math.sin(Math.PI*7/18)],
  [0, 1],
  [Math.cos(Math.PI/4), Math.sin(Math.PI/4)],
  [Math.cos(Math.PI*11/18), Math.sin(Math.PI*11/18)],
  [-Math.SQRT1_2, Math.SQRT1_2],
];
// New positions are private. Callers choose which actually apply; for simultaneous
// resolution they must apply the whole returned batch, not just winners.
export function createGroundOccupancy(units, dim, rules) {
  const terrain = createGroundTerrain(dim,rules), cells = new Map(), bodies = new Map();
  const key = (cx,cz) => `${cx},${cz}`;
  const at = (x,z) => key(Math.floor(x/CELL),Math.floor(z/CELL));
  function put(u) {
    const body = { id:u.id, x:u.x, z:u.z, kind:u.kind, shape:shapeOf(u) };
    if (bodies.has(body.id)) throw new RangeError(`Duplicate ground id: ${body.id}`);
    if (!Number.isFinite(body.x) || !Number.isFinite(body.z)) throw new TypeError(`Invalid ground coordinate: ${body.id}`);
    const index = at(body.x,body.z);
    if (!cells.has(index)) cells.set(index,new Set());
    cells.get(index).add(body);
    bodies.set(body.id,body);
    return body;
  }
  function leaveCell(u) {
    const index = at(u.x,u.z), cell = cells.get(index);
    cell.delete(u); if (!cell.size) cells.delete(index);
  }
  function insertCell(u,x,z) {
    const index = at(x,z);
    if (!cells.has(index)) cells.set(index,new Set());
    cells.get(index).add(u);
  }
  function change(u,x,z) {
    if (at(u.x,u.z) !== at(x,z)) { leaveCell(u); insertCell(u,x,z); }
    u.x=x; u.z=z;
  }
  function blocked(m,x,z,dx,dz,envelope) {
    const [l,t,r,b] = envelope;
    for (let cx=Math.floor((l-MAX_EXTENT)/CELL); cx<=Math.floor((r+MAX_EXTENT)/CELL); cx++)
      for (let cz=Math.floor((t-MAX_EXTENT)/CELL); cz<=Math.floor((b+MAX_EXTENT)/CELL); cz++) {
        const cell = cells.get(key(cx,cz));
        if (cell) for (const u of cell) if (u !== m && crosses(m,x,z,dx,dz,u)) return true;
      }
    return false;
  }
  function envelope(m,x,z,dx,dz) {
    const [l,t,r,b] = m.shape;
    return [Math.min(x,x+dx)-l,Math.min(z,z+dz)-t,Math.max(x,x+dx)+r,Math.max(z,z+dz)+b];
  }
  function clear(m,x,z,dx,dz) {
    // Conservative envelope: every swept rectangle is inside this box. A diagonal
    // along a terrain corner can be shortened or given a legal axial fallback.
    const box = envelope(m,x,z,dx,dz);
    return terrain.contains(...box) && !blocked(m,x,z,dx,dz,box);
  }
  for (const u of units) if (shapeOf(u) && alive(u)) put(u);

  function result(u,dx,dz,side,isBlocked,mode) {
    change(u,u.x+dx,u.z+dz);
    return { x:u.x, z:u.z, dx,dz,side, blocked:isBlocked, mode };
  }
  function resolveOne({id,dx,dz,side=0,allowSidestep=true,lookAhead=.62}) {
    const u = bodies.get(id);
    if (!u) return null; // air/removed unit
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) throw new TypeError(`Invalid ground displacement: ${id}`);
    side = Math.sign(side) || 0;
    if (Math.abs(dx)+Math.abs(dz)<EPS) return result(u,0,0,side,false,'hold');
    const direct = clear(u,u.x,u.z,dx,dz), length = Math.hypot(dx,dz);
    const k = allowSidestep && length >= pxThreshold ? Math.max(1,lookAhead/length) : 1;
    // Stand off far enough to move around the entire body, rather than grazing
    // back into its front edge on each frame. Only bodies, not terrain, use this probe.
    const trafficAhead = k>1 && blocked(u,u.x,u.z,dx*k,dz*k,envelope(u,u.x,u.z,dx*k,dz*k));
    if (direct && !trafficAhead) return result(u,dx,dz,side,false,'straight');
    if (allowSidestep) {
      // Choose the mover's local right first in a head-on encounter (not global east/west).
      // Retain that choice in subsequent frames, including between short straight advances.
      for (const sign of [side || 1,-(side || 1)]) for (const [forward,lateral] of STEER) {
        const sx=dx*forward-dz*lateral*sign, sz=dz*forward+dx*lateral*sign;
        if (clear(u,u.x,u.z,sx,sz)) return result(u,sx,sz,sign,true,'sidestep');
      }
      const axes = Math.abs(dx)>=Math.abs(dz) ? [[dx,0],[0,dz]] : [[0,dz],[dx,0]];
      for (const [sx,sz] of axes) {
        if (Math.abs(sx)+Math.abs(sz)>EPS && clear(u,u.x,u.z,sx,sz)) return result(u,sx,sz,side,true,'axis');
      }
    }
    if (direct) return result(u,dx,dz,side,false,'straight');
    // Stop as close as is practical without entering the obstacle. No lateral
    // motion is allowed for a braking or stationary attack intent.
    for (const f of [.75,.5,.25]) if (clear(u,u.x,u.z,dx*f,dz*f)) return result(u,dx*f,dz*f,side,true,'short');
    return result(u,0,0,side,true,'blocked');
  }

  return {
    terrain,
    // All-or-nothing wave placement. The caller should debit and allocate IDs only
    // after success; failed waves stay unpurchased and can retry on later ticks.
    reserveWave(drafts) {
      const reserved = [], placed = [];
      const rollback = () => { for (const u of reserved) { leaveCell(u); bodies.delete(u.id); } return null; };
      const ids = new Set();
      for (const d of drafts) {
        if (ids.has(d.id) || bodies.has(d.id)) return null;
        ids.add(d.id);
      }
      for (const d of drafts) {
        const shape = shapeOf(d);
        if (!Number.isFinite(d.x) || !Number.isFinite(d.z)) return rollback();
        if (!shape) { placed.push({x:d.x,z:d.z}); continue; }
        const dir = SEATS.find(s=>s.id===d.seat)?.dir;
        if (!dir) return rollback();
        const [rx,rz] = dir, sx=-rz, sz=rx;
        let found = null;
        // Row-major, centre-out. Rows alternate away from and towards the arena.
        // Bounded to ~3 world units around the requested entrance, not a teleport.
        for (let i=0; i<=14 && !found; i++) {
          const f = i===0 ? 0 : Math.ceil(i/2)*(i%2 ? 1 : -1)*.43;
          for (let j=0; j<=14 && !found; j++) {
            const k = j===0 ? 0 : Math.ceil(j/2)*(j%2 ? 1 : -1)*.43;
            const x=d.x+rx*f+sx*k, z=d.z+rz*f+sz*k;
            if (clear({shape},x,z,0,0)) found={x,z};
          }
        }
        if (!found) return rollback();
        reserved.push(put({...d,...found}));
        placed.push(found);
      }
      return placed;
    },
    resolve(intents, frame=0) {
      const sorted = [...intents].filter(d=>bodies.has(d.id)).sort((a,b)=>a.id-b.id);
      for (let i=1;i<sorted.length;i++) if (sorted[i].id===sorted[i-1].id) throw new RangeError(`Duplicate mover: ${sorted[i].id}`);
      const positions = new Map();
      if (!sorted.length) return positions;
      const start = ((Math.trunc(frame)%sorted.length)+sorted.length)%sorted.length;
      for (let i=0;i<sorted.length;i++) {
        const d=sorted[(start+i)%sorted.length], p=resolveOne(d);
        if (p) positions.set(d.id,p);
      }
      return positions;
    },
  };
}
