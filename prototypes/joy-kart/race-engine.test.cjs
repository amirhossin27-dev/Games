const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRules } = require('./build-preview.cjs');
const { physics: P, engine: { KartRace } } = loadRules();

function run(race, seconds, steer = 0, fps = 60) {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) race.advance(1 / fps, steer);
}
function racing(options = {}) { const r = new KartRace({ mode: 'solo', ...options }); r.begin(); run(r, 3); assert.equal(r.phase, 'racing'); return r; }

test('ready and paused countdown do not move the vehicle or advance the race clock', () => {
  const r = new KartRace({ mode: 'solo' });
  const start = { x: r.human.x, y: r.human.y };
  run(r, 5); assert.deepEqual({ x: r.human.x, y: r.human.y }, start);
  r.begin(); run(r, 1); r.pause(); const count = r.countdown;
  run(r, 10); assert.equal(r.countdown, count); assert.equal(r.elapsed, 0);
  r.resume(); run(r, 2); assert.equal(r.phase, 'racing');
  run(r, 1); assert.ok(r.human.prog > -28); assert.ok(r.elapsed > 0.99);
});

test('steering changes the actual trajectory and lane, not just the camera', () => {
  const left = racing(), right = racing(), straight = racing();
  run(left, 4, -1); run(right, 4, 1); run(straight, 4);
  assert.equal(left.human.lane, -P.LANE_MAX); assert.equal(right.human.lane, P.LANE_MAX);
  assert.ok(left.human.lat < straight.human.lat - 15);
  assert.ok(right.human.lat > straight.human.lat + 15);
  assert.ok(Math.hypot(left.human.x - right.human.x, left.human.y - right.human.y) > 30);
});

test('turbo consumes an item and physically accelerates the kart', () => {
  const r = racing(); run(r, 3); const speed = r.human.v;
  assert.equal(r.human.item, 'pilz'); r.queueBoost(); run(r, 0.5);
  assert.equal(r.human.item, null); assert.ok(r.human.boost > 0);
  assert.ok(r.human.v > speed + 35); assert.ok(r.takeEvents().includes('pilz'));
});

test('off-road grass slows the kart and recovery never awards unearned progress', () => {
  const r = racing({ assist: false }); run(r, 2);
  const position = P.trackPoint(r.track, r.human.s, 80);
  Object.assign(r.human, { x: position.x, y: position.y, a: position.a, lat: 80 });
  run(r, 1); assert.ok(r.human.v < P.VMAX);
  const progress = r.human.prog, lap = r.human.lap;
  r.returnToRoad(); assert.equal(r.human.prog, progress); assert.equal(r.human.lap, lap);
  assert.equal(r.human.lat, 0); assert.ok(r.human.v <= 60);
});

test('pause freezes movement and elapsed time; resuming does not catch up paused time', () => {
  const r = racing(); run(r, 2); r.pause(); const before = [r.human.x, r.human.y, r.elapsed];
  run(r, 20, 1); assert.deepEqual([r.human.x, r.human.y, r.elapsed], before);
  r.resume(); run(r, 1); assert.ok(Math.abs(r.elapsed - before[2] - 1) < 1e-6);
});

test('fixed ticks produce the same course progress at 30, 60 and 120 rendering FPS', () => {
  const results = [30, 60, 120].map(fps => { const r = new KartRace({ mode: 'solo' }); r.begin(); run(r, 18, 0, fps); return r; });
  for (const r of results.slice(1)) {
    assert.ok(Math.abs(r.human.prog - results[0].human.prog) < 0.001);
    assert.ok(Math.abs(r.elapsed - results[0].elapsed) < 0.001);
  }
});

test('three genuinely driven laps finish the race and freeze its result', () => {
  const r = racing();
  for (let i = 0; i < 120 * 60 && r.phase !== 'finished'; i++) r.advance(1 / 60);
  assert.equal(r.phase, 'finished'); assert.equal(r.human.lap, 3);
  assert.ok(r.human.prog >= P.LAPS * r.track.len); assert.equal(r.human.fin, r.elapsed);
  assert.ok(r.elapsed > 20 && r.elapsed < 120);
  const finish = [r.human.x, r.human.y, r.elapsed]; run(r, 5, 1);
  assert.deepEqual([r.human.x, r.human.y, r.elapsed], finish);
});

test('the Robo race remains finite with shared pickups and vehicle collisions', () => {
  const r = racing({ mode: 'cpu' }); run(r, 20);
  for (const k of [r.human, r.rival]) for (const field of ['x', 'y', 'a', 'v', 'prog']) assert.ok(Number.isFinite(k[field]));
  assert.ok([1, 2].includes(r.place)); assert.ok(r.human.prog > 1000);
});
