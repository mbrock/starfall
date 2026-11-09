// Travelling to other worlds. Once the player owns the Launch Base (stats.launch, a shop item), every 10 shards
// fuel a launch base that rises out of the ground ahead of Pip. Walking onto it bolts jets onto his skateboard
// and he blasts off. In space the player steers (stick or W/S to climb and dive, A/D or the mouse to turn) through
// stardust trails and past drifting rocks, and lands on whichever world he flies into; when the fuel runs out he
// coasts to the nearest one. The worlds are in world/bodies.js; game/flight.js re-centers the world on them and
// handles landing.
import * as THREE from 'three';
import { $, debug } from '../platform.js';
import { camera, renderer, scene } from '../engine/stage.js';
import { COLORS, glowSprite } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { V, chord, pointAhead, rand, randomUnit, standOn } from '../sphere.js';
import { game, pip, run, shake, stats } from '../state.js';
import { BODIES, buildBodies, here, offsetOf, updateSkyHalos } from '../world/bodies.js';
import { clearDecorAround } from '../world/decor.js';
import { stars } from '../world/sky.js';
import { board, player } from '../actors/pip.js';
import { jetFlames, jets, makeBeam, makePad, moteMat, rockGeo, rockMat } from '../actors/vehicles.js';
import { pad as gamepad, readMove, takeMouseTurn } from '../input.js';
import { popup } from '../ui/popups.js';
import { applyLook } from './cosmetics.js';
import { camRig } from './camera.js';
import { arrive, beginTrip, bezier, chase, ease, goHome, groundPoint, nearestBody, posePlayer, recenter, showBanner, trip, updateBanner } from './flight.js';

const NEED = 10, FUEL = 24, SPEED = 17, SPINUP = 1.5;

buildBodies();
const pad = makePad(), beam = makeBeam(0xffcf5a, 16, 0.5);
pad.g.visible = beam.visible = false;
scene.add(pad.g, beam);
const motes = Array.from({ length: 48 }, () => { const s = glowSprite(null, 1.3, moteMat); s.visible = false; scene.add(s); return s; });
const rocks = Array.from({ length: 16 }, () => {
  const m = new THREE.Mesh(rockGeo, rockMat); m.visible = false; scene.add(m);
  return { m, r: 1, spin: new V() };
});
const tags = BODIES.map(() => {
  const el = document.createElement('div'); el.className = 'body-tag'; el.hidden = true;
  $('travel-tags').appendChild(el); return el;
});
{
  // Draw everything travel shows once now, rather than first in the middle of a run: that compiles its shaders and
  // uploads its geometry, shadow pass included (dropped frames on the Pi when the base first rose).
  const models = [pad.g, beam, board, jets, motes[0], rocks[0].m], shown = models.map((o) => o.visible), culled = [];
  for (const o of models) { o.visible = true; o.traverse((c) => { culled.push([c, c.frustumCulled]); c.frustumCulled = false; }); }
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  models.forEach((o, i) => { o.visible = shown[i]; });
  for (const [c, f] of culled) c.frustumCulled = f;
}

/**
 * state: 'fuel' (collecting shards) → 'rising' (the base comes up) → 'ready' (beam on, waiting for Pip) → 'spinup'
 * (jets on, Pip lifts off the pad) → 'launch' (climbing away) → 'free' (the player flies) → 'land' → 'fuel'.
 */
const st = {
  state: 'fuel', fuel: 0, t: 0, n: new V(), jetFuel: 0, speed: 0, pos: new V(), fwd: new V(), up: new V(),
  path: [new V(), new V(), new V(), new V()], n2: new V(), chain: 0, chainT: 0,
};
const _v = new V(), _a = new V(), _b = new V(), _c = new V(), _s = new V();

/** True while Pip is off the ground (on the pad's jets or in space); game/run.js hands him to this module then. */
export const travelling = () => trip.on;
/** Shard points and stardust are worth more on worlds further out. */
export const bodyMul = () => here.body.mul;
/** How often meteors come, relative to the home planet. */
export const meteorRate = () => here.body.meteors;

/** At the start of a run: back on the home planet with an empty tank. */
export function resetTravel() {
  goHome();
  Object.assign(st, { state: 'fuel', fuel: 0 });
  pad.g.visible = beam.visible = false;
  hideSpace();
  applyLook();
}
function hideSpace() {
  for (const m of motes) m.visible = false;
  for (const r of rocks) r.m.visible = false;
  for (const el of tags) el.hidden = true;
  jets.visible = false;
}

/** Pip grabbed a pickup: shards fuel the launch base (a golden shard counts 3). */
export function onTravelCollect(kind) {
  if (!stats.launch || st.state !== 'fuel' || (kind !== 'shard' && kind !== 'gold')) return;
  st.fuel = Math.min(NEED, st.fuel + (kind === 'gold' ? 3 : 1));
  if (st.fuel < NEED) return;
  // the base rises out of the ground somewhere ahead
  const r = here.body.radius;
  st.n.copy(pointAhead(pip.p, pip.f, Math.min(0.9, 9 / r), Math.min(1.2, 12 / r), 0.7));
  clearDecorAround(st.n, 3.2);
  st.state = 'rising'; st.t = 0;
  pad.g.visible = true;
  sfx.unlock();
  showBanner('Launch base rising', 'Fuelled up', 'Walk onto the pad to fly to another world');
}

/** Every frame of a run on the ground: raise the base, blink it, and take off when Pip steps onto it. */
export function updateTravelGround(dt) {
  if (st.state === 'rising') {
    st.t += dt;
    const k = Math.min(1, st.t / 2.4);
    standOn(pad.g, st.n, -0.6 * (1 - ease(k)));
    if (Math.random() < 0.6) burst(_v.copy(st.n).multiplyScalar(here.body.radius + 0.2), 3, COLORS.dust, 3, 0.8, 1, st.n, 0.8);
    shake(0.06);
    if (k >= 1) { st.state = 'ready'; standOn(beam, st.n, 0); beam.visible = true; sfx.unlock(); }
  }
  if (st.state === 'ready') {
    pad.lamp.color.setHSL(0.12, 1, Math.sin(game.clock * 8) > 0 ? 0.65 : 0.3);
    beam.material.opacity = 0.32 * THREE.MathUtils.clamp((chord(pip.p, st.n) - 1.5) / 5, 0.12, 1); // fade as Pip gets close
    if (chord(pip.p, st.n) < 1.6) takeOff(); // anywhere on the pad
  }
}

/** J or the gamepad's RB: take off from the launch base without stepping all the way onto it. */
export function travelAction() {
  if (game.phase === 'play' && !game.paused && pip.alive && st.state === 'ready' && chord(pip.p, st.n) < 4) takeOff();
}

function takeOff() {
  beginTrip();
  st.state = 'spinup'; st.t = 0;
  beam.visible = false;
  jets.visible = board.visible = true;
  st.up.copy(st.n);
  st.fwd.copy(pip.f).addScaledVector(st.n, -pip.f.dot(st.n)).normalize();
  st.pos.copy(player.position);
  sfx.jets();
  popup('jets on!', _v.copy(pad.g.position).addScaledVector(st.n, 2.4), 'mint');
}

/** Every frame of a trip, after Pip is posed. */
function fly(dt) {
  st.t += dt;
  if (st.state === 'spinup') return spinup(dt);
  if (st.state === 'land') return landing(dt);
  const { fwd: stick, turn } = readMove();
  const yaw = turn * 1.7 * dt - takeMouseTurn();
  if (st.state === 'launch') {
    // pitch up off the ground, swing toward the nearest other world and accelerate
    const right = _a.crossVectors(st.up, st.fwd).normalize();
    const pitch = Math.max(0, 1 - st.t / 0.9) * 1.6 * dt;
    st.fwd.applyAxisAngle(right, -pitch); st.up.applyAxisAngle(right, -pitch);
    if (st.t > 0.5) st.fwd.lerp(offsetOf(nearestBody(st.pos, here.body), _c).sub(st.pos).normalize(), 1 - Math.exp(-3.5 * dt)).normalize();
    st.up.addScaledVector(st.fwd, -st.up.dot(st.fwd)).normalize();
    st.speed = Math.min(SPEED, st.speed + 18 * dt);
    if (st.t > 1.8) st.state = 'free';
  } else {
    st.jetFuel -= dt;
    let pitch = stick * 1.3 * dt, yawNow = -yaw;
    const nearest = nearestBody(st.pos);
    const lost = offsetOf(nearest, _c).distanceTo(st.pos) - nearest.radius > 150;
    if (st.jetFuel <= 0 || lost) {
      // out of fuel (or far out): coast toward the nearest world
      st.fwd.lerp(_c.sub(st.pos).normalize(), 1 - Math.exp(-1.2 * dt)).normalize();
      pitch = 0; yawNow = 0;
    }
    const right = _a.crossVectors(st.up, st.fwd).normalize();
    st.fwd.applyAxisAngle(st.up, -yawNow);
    st.fwd.applyAxisAngle(right, -pitch); st.up.applyAxisAngle(right, -pitch);
    st.up.addScaledVector(st.fwd, -st.up.dot(st.fwd)).normalize();
    pip.turn = THREE.MathUtils.lerp(pip.turn, turn, 0.2);
    st.speed = THREE.MathUtils.lerp(st.speed, st.jetFuel > 0 ? SPEED : SPEED * 0.75, 0.05);
    for (const b of BODIES) {
      if (b === trip.from && st.t < 3.5) continue;
      if (offsetOf(b, _c).distanceTo(st.pos) < b.radius + 6) { startLanding(b); return; }
    }
    hitThings(dt);
  }
  st.pos.addScaledVector(st.fwd, st.speed * dt);
  recenter(st.pos, shift);
  for (const r of rocks) if (r.m.visible) { r.m.rotation.x += r.spin.x * dt; r.m.rotation.y += r.spin.y * dt; }
  thrustFx(st.jetFuel > 0 || st.state === 'launch' ? 1 : 0.15);
  posePlayer(st.pos, st.fwd, st.up);
  board.rotation.z = -pip.turn * 0.35;
  chase(st.pos, st.fwd, st.up, 6.5, 2.2, 8, st.state === 'launch' ? 2 : 5);
  renderTags();
}

/** Jets roar on the pad and Pip lifts off it, then blasts away. */
function spinup(dt) {
  const k = Math.min(1, st.t / SPINUP), n = st.n;
  _a.copy(pad.g.position).addScaledVector(n, 0.75 + ease(k) * 0.9);
  st.pos.lerp(_a, 1 - Math.exp(-6 * dt));
  for (const f of jetFlames) f.scale.y = k * (1.2 + Math.random() * 0.6);
  if (Math.random() < 0.7) burst(pad.g.position, 2, COLORS.dust, 3, 1, 0.3, n, 0.2);
  emit(_b.copy(st.pos).addScaledVector(n, -0.5), randomUnit(_v).multiplyScalar(0.8).addScaledVector(n, -4), COLORS.mint, rand(0.3, 0.5), 0);
  shake(0.04 + 0.08 * k);
  posePlayer(st.pos, st.fwd, n);
  const side = _v.crossVectors(n, st.fwd).normalize();
  camRig.pos.copy(pad.g.position).addScaledVector(n, 3).addScaledVector(side, 6).addScaledVector(st.fwd, -4);
  camRig.look.copy(st.pos); camRig.up.copy(n); camRig.rate = 3;
  if (k < 1) return;
  sfx.liftoff(); shake(0.6);
  burst(st.pos, 50, COLORS.white, 5, 0.9, 0.4, n, 1);
  st.state = 'launch'; st.t = 0; st.jetFuel = FUEL; st.speed = 6; st.chain = 0;
  scatterSpace();
}

/** Stardust trails toward every other world, and rocks drifting around them. */
function scatterSpace() {
  const others = BODIES.filter((b) => b !== here.body), per = Math.floor(motes.length / others.length);
  let k = 0;
  for (const b of others) {
    const to = offsetOf(b, _a), side = _b.crossVectors(to, st.pos);
    if (side.lengthSq() < 1e-4) side.crossVectors(to, st.up);
    side.normalize();
    for (let i = 0; i < per; i++, k++) {
      const u = 0.18 + 0.64 * i / per;
      motes[k].position.copy(st.pos).lerp(to, u).addScaledVector(side, Math.sin(u * 9) * 4);
      motes[k].visible = true;
    }
  }
  rocks.forEach((r, i) => {
    offsetOf(others[i % others.length], _a);
    r.r = rand(0.8, 2.2);
    r.m.scale.setScalar(r.r);
    r.m.position.copy(st.pos).lerp(_a, rand(0.25, 0.75)).add(randomUnit(_b).multiplyScalar(rand(3, 14)));
    r.spin.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    r.m.visible = true;
  });
}

/** The world re-centered on another body: move everything travel placed by -offset. */
function shift(offset) {
  for (const p of st.path) p.sub(offset);
  for (const m of motes) m.position.sub(offset);
  for (const r of rocks) r.m.position.sub(offset);
  pad.g.position.sub(offset);
}

function thrustFx(power) {
  for (const f of jetFlames) f.scale.y = power * (1.6 + Math.random() * 0.8);
  _a.copy(st.pos).addScaledVector(st.up, -0.5).addScaledVector(st.fwd, -0.6);
  for (let k = 0; k < 2; k++) emit(_a, randomUnit(_b).multiplyScalar(0.8).addScaledVector(st.fwd, -rand(4, 8) * power), Math.random() < 0.6 ? COLORS.mint : COLORS.white, rand(0.3, 0.6), 0);
}

/** Stardust pays points and a little fuel, chaining like shards; rocks knock fuel and speed off. */
function hitThings(dt) {
  st.chainT -= dt;
  if (st.chainT <= 0) st.chain = 0;
  for (const m of motes) {
    if (!m.visible || m.position.distanceTo(st.pos) > 2.2) continue;
    m.visible = false;
    st.chain = Math.min(12, st.chain + 1); st.chainT = 1.5;
    const gain = 10 * st.chain;
    run.score += gain; run.dust += 0.5; st.jetFuel = Math.min(FUEL, st.jetFuel + 0.6);
    sfx.pickup(st.chain);
    popup('+' + gain, m.position, 'gold');
    burst(m.position, 12, COLORS.gold, 3, 0.5, 0);
  }
  for (const r of rocks) {
    if (!r.m.visible || r.m.position.distanceTo(st.pos) > r.r + 0.7) continue;
    r.m.visible = false;
    st.jetFuel = Math.max(0.01, st.jetFuel - 4); st.speed *= 0.4;
    sfx.bonk(); shake(0.6);
    burst(r.m.position, 30, COLORS.rock, 5, 0.8, 0);
    popup('bonk! −4 s fuel', r.m.position, 'coral');
  }
}

function startLanding(b) {
  recenter(st.pos, shift, b);
  st.state = 'land'; st.t = 0;
  st.n2.copy(st.pos).normalize();
  const [a, p1, p2, d] = st.path;
  a.copy(st.pos);
  p1.copy(st.pos).addScaledVector(st.fwd, st.speed * 0.4);
  groundPoint(b, st.n2, d, 0.55);
  p2.copy(d).addScaledVector(st.n2, 4);
  for (const el of tags) el.hidden = true;
}

function landing(dt) {
  const u = Math.min(1, st.t / 1.4);
  bezier(st.pos, ...st.path, u);
  bezier(_v, ...st.path, Math.min(u, 0.999), true);
  // level out: feet toward the ground, facing along it
  st.up.lerp(st.n2, 1 - Math.exp(-6 * dt)).normalize();
  st.fwd.copy(_v).addScaledVector(st.n2, -_v.dot(st.n2));
  if (st.fwd.lengthSq() < 1e-4) st.fwd.copy(pip.f);
  st.fwd.normalize();
  thrustFx(0.6);
  posePlayer(st.pos, st.fwd, st.up);
  chase(st.pos, st.fwd, st.n2, 8.5, 6.4, 3.5, 3);
  if (u < 1) return;
  Object.assign(st, { state: 'fuel', fuel: 0 });
  pad.g.visible = false;
  hideSpace();
  applyLook(); // the skateboard is only there if it was bought
  arrive(st.n2, st.fwd);
}

/** Name, multiplier and distance over every world; worlds off screen get a marker at the screen edge. */
function renderTags() {
  BODIES.forEach((b, i) => {
    const el = tags[i];
    offsetOf(b, _c);
    _s.copy(_c).applyMatrix4(camera.matrixWorldInverse);
    const behind = _s.z > 0;
    _s.applyMatrix4(camera.projectionMatrix);
    let x = behind ? -_s.x : _s.x, y = behind ? -_s.y : _s.y;
    const edge = Math.max(Math.abs(x) / 0.86, Math.abs(y) / 0.7);
    const off = behind || edge > 1;
    if (off) { x /= edge; y /= edge; }
    el.hidden = false;
    el.classList.toggle('edge', off);
    const text = `${b.name} ×${b.mul} · ${Math.round(Math.max(0, _c.distanceTo(st.pos) - b.radius))} m`;
    if (el.lastChild?.textContent !== text) el.innerHTML = `<i>➜</i><span>${text}</span>`;
    el.firstChild.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    el.style.transform = `translate(${(x + 1) / 2 * innerWidth}px, ${(1 - y) / 2 * innerHeight}px) translate(-50%, ${off ? -50 : -150}%)`;
  });
}

/** What the HUD pill says, and where its arrow points (a surface point), or null for no pill. */
function status() {
  if (!stats.launch) return null;
  if (st.state === 'fuel') return { text: `Launch fuel ${st.fuel} / ${NEED} shards` };
  if (st.state === 'rising') return { text: 'Launch base rising…', target: st.n };
  if (st.state === 'ready') return { text: `Launch base ready: walk onto the pad${gamepad.connected ? ' or press RB near it' : ''}`, target: st.n, hot: true };
  if (st.state === 'launch' || st.state === 'free') {
    const s = Math.max(0, Math.ceil(st.jetFuel)), bars = Math.ceil(s / 4);
    return st.jetFuel > 0
      ? { text: `Jet fuel ${'▮'.repeat(bars)}${'▯'.repeat(FUEL / 4 - bars)} ${s} s · fly into a world to land`, hot: st.jetFuel <= 5 }
      : { text: 'Out of fuel: coasting to the nearest world', hot: true };
  }
  return null;
}

/** Every frame, after Pip is posed: fly the trip, keep the sky around the camera, update the HUD. */
export function updateTravel(dt) {
  if (trip.on && game.phase === 'play') fly(dt);
  stars.position.copy(camera.position);
  updateSkyHalos(camera.position);
  updateBanner(dt);
  renderHud();
}

let lastText = '';
function renderHud() {
  const s = game.phase === 'play' ? status() : null;
  $('travel-hud').hidden = !s;
  if (!s) return;
  const arrow = $('travel-arrow');
  arrow.hidden = !s.target;
  let text = s.text;
  if (s.target) {
    // which way to walk: the target's direction in Pip's tangent plane, relative to his facing
    _v.copy(s.target).addScaledVector(pip.p, -s.target.dot(pip.p));
    _a.crossVectors(pip.p, pip.f);
    const turn = `rotate(${Math.round(Math.atan2(-_v.dot(_a), _v.dot(pip.f)) * 50) / 50}rad)`;
    if (arrow.style.transform !== turn) arrow.style.transform = turn;
    text += ` · ${Math.round(chord(pip.p, s.target))} m`;
  }
  if (text !== lastText) { $('travel-text').textContent = text; lastText = text; }
  $('travel-hud').classList.toggle('hot', !!s.hot);
}

// ?debug: starfallTravel.ready() fills the tank (and grants the Launch Base for this run).
if (debug) window.starfallTravel = { ready() { stats.launch = true; st.fuel = NEED - 1; onTravelCollect('shard'); }, status, here, BODIES, trip, st };
