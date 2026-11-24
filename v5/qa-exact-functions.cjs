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
console.log(JSON.stringify({
  fiveGold: five.events.map(e => ({tick:e.tick, seconds:(e.tick/30).toFixed(2)})),
  twelveGold: twelve.events.map(e => ({tick:e.tick, seconds:(e.tick/30).toFixed(2)})),
  note: 'Functions and income line were extracted from game.js; DOM, rendering and full combat were not exercised.'
}, null, 2));
