// Focused fixtures for the strategy module. Command/replay integration is tested separately.
import assert from 'node:assert/strict';
import { DEFENSE_RADIUS, chooseDefense, hasDefenseThreat } from './bot-defense.mjs';
import { corePos } from '../dev05-layout/layout.mjs';
import { createSim, dimFor, padsFor, padWorld } from './sim.mjs';

const dim = dimFor(10), [x, z] = corePos('N', dim), core = { x, z };
const { commander } = createSim({ version: 10, bots: [] }).seats.N;
const pads = padsFor(10).map((p, index) => {
  const [x,z] = padWorld('N', index, dim);
  return { ...p, x,z,index };
});
const input = { core, commander, entry: { x: 0, z: -dim.spawnRadial }, pads, gold: 24 };
const t = (id, kind, ahead = 8, offset = 0) => ({ id, kind, x: core.x + offset, z: core.z + ahead });
const p = (kind) => pads.find(p => p.kind === kind);
const choose = (threats, changes = {}) => chooseDefense({ ...input, threats, ...changes });

{
  const irrelevant = [t(1, 'battlecruiser', DEFENSE_RADIUS + .01), { ...t(2, 'dragoon'), visible: false }, t(3, 'scourge'), t(4, 'unknown'), null];
  assert.equal(hasDefenseThreat({ core, threats: irrelevant }), false);
  assert.equal(choose(irrelevant), null);
  assert.equal(hasDefenseThreat({ core, threats: [t(5, 'marine', DEFENSE_RADIUS)] }), true);
}

{
  // 北席實際位置：戰巡壓城時，依可花金額使用對空武器，而非站着等理想兵。
  const attack = [t(1, 'battlecruiser')];
  assert.deepEqual(choose(attack, { gold: 9 }), { pad: p('hydralisk').index, kind:'hydralisk', threatId:1, exchanges:1 });
  assert.equal(choose(attack, { gold: 17 }).kind, 'wraith');
  assert.equal(choose(attack).kind, 'scout');
  assert.equal(choose(attack, { gold: 0 }), null);
  assert.equal(hasDefenseThreat({ core, threats: attack }), true, '沒錢不代表危機已解除');
}

{
  const threat = t(1, 'battlecruiser');
  const only = [ { ...p('scout'), locked:true }, { ...p('wraith'), reachable:false }, p('hydralisk') ];
  assert.equal(choose([threat], { pads:only, heldPad:p('wraith').index }).kind, 'hydralisk');
  assert.equal(choose([threat], { pads:only, gold:8.999 }), null, '不借款、不預支未到期資源');
  const ground = t(2, 'marine', 6);
  assert.equal(choose([ground], { pads: [p('scourge')] }), null, '自殺蟲不打地面');
  const now = choose([ground], { heldPad:p('scourge').index });
  assert.equal(now.threatId, 2);
  assert.notEqual(now.kind, 'scourge', '看見威脅改變即放棄不能命中的舊計畫');
}

{
  const close = t(77, 'dragoon', 6), far = t(3, 'battlecruiser', 11);
  assert.equal(choose([far,close]).threatId, 77, '位置與預估接觸先於兵名和 ID');
  const a = t(2, 'marine'), b = t(3, 'marine');
  assert.equal(choose([b,a]).threatId, 2);
  assert.deepEqual(choose([b,a]), choose([a,b], { pads:[...pads].reverse() }));
}

{
  const wave = (count) => Array.from({length:count}, (_,i) => t(i+1, 'marine', 6.2+i*.02, i*.035));
  const oneChoice = { pads:[p('marine')], gold:99 };
  for (const [count, exchanges] of [[1,1],[2,1],[3,2],[5,2],[6,3],[16,3]]) {
    assert.equal(choose(wave(count), oneChoice).exchanges, exchanges);
  }
  assert.equal(choose(wave(8), { ...oneChoice, gold:15 }).exchanges, 2, '規劃只承諾付得起的批數');
  assert.equal(choose(wave(8), { ...oneChoice, gold:7.5 }).exchanges, 1);
  assert.equal(choose(wave(8), { ...oneChoice, gold:7.499 }), null);
  assert.equal(choose(wave(7), { gold:30 }).kind, 'archon', '密集敵軍會給濺射加權');
}

{
  const attack = [t(1, 'battlecruiser')], pad = p('hydralisk');
  const equal = [{ ...pad,index:1,ticksToPad:9 },{ ...pad,index:4,ticksToPad:9 }];
  assert.equal(choose(attack, { pads:equal }).pad, 1);
  assert.equal(choose(attack, { pads:equal, heldPad:4 }).pad, 4, '避免等值兩處反覆轉身');
  const delayed = [equal[0],{ ...equal[1],ticksToPad:70 }];
  assert.equal(choose(attack, { pads:delayed, heldPad:4 }).pad, 1, '仍需重估自家路徑');
}

{
  // A projected visible unit doesn't even expose these fields to the policy.
  const hostile = new Proxy(Object.freeze(t(1, 'battlecruiser')), { get(obj, key) {
    assert(!['hp','sh','gold','target','buff','order','motion','cd','team'].includes(key), '偷看未提供的敵方資料');
    return Reflect.get(obj,key);
  }});
  const fixed = Object.freeze({ ...input, core:Object.freeze({...core}), commander:Object.freeze({...commander}),
    pads:Object.freeze(pads.map(p => Object.freeze({...p}))), threats:Object.freeze([hostile]) });
  for (let i=0; i<40; i++) assert.deepEqual(chooseDefense(fixed), choose([t(1, 'battlecruiser')]));
}
console.log('Defensive NPC QA OK: visible threats, reachable/affordable counters, urgency, recheck, waves, private data isolation');
