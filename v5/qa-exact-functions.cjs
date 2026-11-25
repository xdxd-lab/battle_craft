// Executes the actual purchasing functions from game.js in a minimal game-state VM.
// No gameplay function is copied or reimplemented here.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `missing source boundary ${start}`);
  return source.slice(a, b);
}
const functions = [
  between('function recruit(team, p) {', 'function beaconAt()'),
  between('function beaconAt()', 'function checkBeacon()'),
  between('function checkBeacon()', 'function moveCommander()'),
].join('\n');
const income = source.match(/if \(game\.tick % 30 === 0\) \{ game\.gold\[0\]\+\+; game\.gold\[1\]\+\+; \}/)?.[0];
assert(income, 'original income rule missing');

function run(startGold, padIndex, ticks) {
  const events = [];
  const pads = [
    { x: -8.3, z: 14.4, cost: 5, count: 1, label: '單兵部署' },
    { x: 8.3, z: 14.4, cost: 12, count: 3, label: '編隊部署' },
  ];
  const game = { tick: 0, gold: [startGold, 0], serial: 0, units: [],
    player: { x: pads[padIndex].x, z: pads[padIndex].z },
    activePad: null, nextPurchaseTick: 0, waitingPad: false };
  const context = vm.createContext({
    game, pads, Math,
    makeSoldier: () => ({ position: { set() {} } }),
    logEvent: (team, level, text) => events.push({ tick: game.tick, team, level, text }),
  });
  vm.runInContext(functions, context);
  for (let i = 0; i < ticks; i++) {
    game.tick++;
    vm.runInContext(income, context);
    vm.runInContext('checkBeacon()', context);
    assert(game.gold[0] >= 0, 'gold became negative');
  }
  return { game, events: events.filter(e => e.text.includes('部署') && e.text.includes('花')) };
}

const five = run(12, 0, 360);
assert(five.events.length >= 4, 'standing on 5-gold beacon did not repeatedly purchase');
assert(five.events.some(e => e.tick === 90), 'did not automatically purchase when income reached 5 gold');
const twelve = run(0, 1, 730);
assert.equal(twelve.events.length, 2, 'standing on 12-gold beacon should purchase at each 12-gold threshold');
assert.deepEqual(twelve.events.map(e => e.tick), [360, 720]);
// 邊界：走路期間（信標外）不扣款；離開後停止；重新進入立即可再買；恰好 15 tick 才可再成交
{
  const source2 = (visits, startGold, ticks) => {
    const buys = [], pads = [{ x: -8.3, z: 14.4, cost: 5, count: 1, label: '單兵部署' }];
    const game = { tick: 0, gold: [startGold, 0], serial: 0, units: [], player: { x: 0, z: 0 }, activePad: null, nextPurchaseTick: 0, waitingPad: false };
    const context = vm.createContext({ game, pads, Math, makeSoldier: () => ({ position: { set() {} } }), logEvent: (t, l, s) => { if (s.includes('花')) buys.push(game.tick); } });
    vm.runInContext(functions, context);
    for (let i = 0; i < ticks; i++) {
      game.tick++; const on = visits.some(([a, b]) => game.tick >= a && game.tick < b);
      game.player.x = on ? pads[0].x : 0; game.player.z = on ? pads[0].z : 0;
      vm.runInContext('checkBeacon()', context);
    }
    return { buys, game };
  };
  assert.deepEqual(source2([[50, 120]], 100, 200).buys, [50, 65, 80, 95, 110], 'arrival, 15-tick spacing, stop after leaving');
  assert.deepEqual(source2([[50, 52], [55, 57]], 100, 100).buys, [50, 55], 're-entry resets the spacing (current v5 rule)');
  const short = source2([[10, 400]], 4, 400); assert.equal(short.buys.length, 0); assert.equal(short.game.gold[0], 4);
  const exact = source2([[10, 400]], 5, 400); assert.deepEqual(exact.buys, [10]); assert.equal(exact.game.gold[0], 0); assert.equal(exact.game.units.length, 1);
}
console.log(JSON.stringify({
  fiveGold: five.events.map(e => ({tick:e.tick, seconds:(e.tick/30).toFixed(2)})),
  twelveGold: twelve.events.map(e => ({tick:e.tick, seconds:(e.tick/30).toFixed(2)})),
  note: 'Functions and income line were extracted from game.js; DOM, rendering and full combat were not exercised.'
}, null, 2));
