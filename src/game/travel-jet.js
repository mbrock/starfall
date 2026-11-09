// Travel style 2 (?travel=jet): some craters leave a jet core instead of a shard. With three cores Pip
// bolts jets onto his skateboard and blasts off (J or the Launch button). In space the player steers:
// fly through stardust trails, dodge drifting rocks, and land on whichever body you fly into before the
// fuel runs out (then the jets coast to the nearest one).
import * as THREE from 'three';
import { $, coarse } from '../platform.js';
import { camera, scene } from '../engine/stage.js';
import { COLORS } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { V, pointNear, rand, randomUnit } from '../sphere.js';
import { pip, run, shake } from '../state.js';
import { BODIES, here, offsetOf } from '../world/bodies.js';
import { board, player } from '../actors/pip.js';
import { pickups, spawnPickup } from '../actors/pickups.js';
import { jetFlames, jets, moteMat, rockGeo, rockMat } from '../actors/vehicles.js';
import { pad, readMove, takeMouseTurn } from '../input.js';
import { glowSprite } from '../engine/materials.js';
import { popup } from '../ui/popups.js';
import { applyLook } from './cosmetics.js';
import { arrive, beginTrip, bezier, chase, groundPoint, nearestBody, posePlayer, recenter, trip } from './flight.js';

const CORES = 3, FUEL = 24, SPEED = 17;
const st = { cores: 0, phase: '', t: 0, fuel: 0, speed: 0, pos: new V(), fwd: new V(), up: new V(), land: null, path: [new V(), new V(), new V(), new V()], n2: new V(), chain: 0, chainT: 0 };
const _v = new V(), _a = new V(), _b = new V(), _c = new V();

const motes = Array.from({ length: 48 }, () => { const s = glowSprite(null, 1.3, moteMat); s.visible = false; scene.add(s); return s; });
const rocks = Array.from({ length: 16 }, () => {
  const m = new THREE.Mesh(rockGeo, rockMat); m.visible = false; scene.add(m);
  return { m, r: 1, spin: new V() };
});
export const models = [board, jets, motes[0], rocks[0].m];
const tags = BODIES.map((b) => {
  const el = document.createElement('div'); el.className = 'body-tag'; el.hidden = true;
  $('travel-tags').appendChild(el); return el;
});

export function reset() {
  Object.assign(st, { cores: 0, phase: '' });
  hideSpace();
}
function hideSpace() {
  for (const m of motes) m.visible = false;
  for (const r of rocks) r.m.visible = false;
  for (const el of tags) el.hidden = true;
  jets.visible = false;
  $('jetbtn').hidden = true;
}

/** A crater sometimes leaves a jet core instead of a shard. Returns true when it did. */
export function meteorLanded(n) {
  const lying = pickups.filter((p) => p.kind === 'core').length;
  if (trip.on || st.cores + lying >= CORES || Math.random() > 0.22) return false;
  spawnPickup(pointNear(n, 0, 0.05), 'core', 14);
  return true;
}

export function collected(kind) {
  if (kind !== 'core') return;
  st.cores = Math.min(CORES, st.cores + 1);
  const at = player.position.clone().addScaledVector(pip.p, 1.2);
  if (st.cores < CORES) { sfx.pickup(st.cores + 2); popup(`jet core ${st.cores}/${CORES}`, at, 'mint'); return; }
  sfx.unlock();
  popup(coarse ? 'JETS READY! tap Launch' : 'JETS READY! press J', at, 'mint');
  $('jetbtn').hidden = !coarse;
  jets.visible = board.visible = true;
}

export function ground() {}

/** J or the Launch button. */
export function action() {
  if (trip.on || st.cores < CORES) return;
  beginTrip();
  st.cores = 0; $('jetbtn').hidden = true;
  jets.visible = board.visible = true;
  st.phase = 'launch'; st.t = 0; st.fuel = FUEL; st.speed = 2;
  st.pos.copy(player.position);
  st.up.copy(pip.p); st.fwd.copy(pip.f);
  sfx.liftoff(); shake(0.6);
  burst(st.pos, 50, COLORS.white, 5, 0.9, 0.4, pip.p, 1);
  scatterSpace();
}

/** Stardust trails toward every other body, and rocks drifting around them. */
function scatterSpace() {
  const others = BODIES.filter((b) => b !== here.body);
  let k = 0;
  for (const b of others) {
    const to = offsetOf(b, _a), side = _b.crossVectors(to, st.pos);
    if (side.lengthSq() < 1e-4) side.crossVectors(to, st.up);
    side.normalize();
    for (let i = 0; i < motes.length / others.length && k < motes.length; i++, k++) {
      const u = 0.18 + 0.64 * i / (motes.length / others.length);
      motes[k].position.copy(st.pos).lerp(to, u).addScaledVector(side, Math.sin(u * 9) * 4);
      motes[k].visible = true;
    }
  }
  rocks.forEach((r, i) => {
    const b = others[i % others.length];
    offsetOf(b, _a);
    r.r = rand(0.8, 2.2);
    r.m.scale.setScalar(r.r);
    r.m.position.copy(st.pos).lerp(_a, rand(0.25, 0.75)).add(randomUnit(_b).multiplyScalar(rand(3, 14)));
    r.spin.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
    r.m.visible = true;
  });
}

function shift(offset) {
  for (const p of st.path) p.sub(offset);
  for (const m of motes) m.position.sub(offset);
  for (const r of rocks) r.m.position.sub(offset);
}

export function fly(dt) {
  st.t += dt;
  const { fwd: stickY, turn } = readMove();
  const yaw = turn * 1.7 * dt - takeMouseTurn();
  if (st.phase === 'launch') {
    // pitch up off the ground, swing toward the nearest other world and accelerate
    const right = _a.crossVectors(st.up, st.fwd).normalize();
    const pitch = Math.max(0, 1 - st.t / 0.9) * 1.6 * dt;
    st.fwd.applyAxisAngle(right, -pitch); st.up.applyAxisAngle(right, -pitch);
    if (st.t > 0.5) st.fwd.lerp(offsetOf(nearestBody(st.pos, here.body), _c).sub(st.pos).normalize(), 1 - Math.exp(-2.2 * dt)).normalize();
    st.up.addScaledVector(st.fwd, -st.up.dot(st.fwd)).normalize();
    st.speed = Math.min(SPEED, st.speed + 18 * dt);
    if (st.t > 1.8) st.phase = 'free';
  } else if (st.phase === 'free') {
    st.fuel -= dt;
    let pitch = stickY * 1.3 * dt, yawNow = -yaw;
    const nearest = nearestBody(st.pos);
    const lost = offsetOf(nearest, _c).distanceTo(st.pos) - nearest.radius > 150;
    if (st.fuel <= 0 || lost) {
      // out of fuel: coast toward the nearest body
      const to = _c.sub(st.pos).normalize();
      const k = 1 - Math.exp(-1.2 * dt);
      st.fwd.lerp(to, k).normalize();
      pitch = 0; yawNow = 0;
    }
    const right = _a.crossVectors(st.up, st.fwd).normalize();
    st.fwd.applyAxisAngle(st.up, -yawNow); // turn
    st.fwd.applyAxisAngle(right, -pitch); st.up.applyAxisAngle(right, -pitch);
    st.up.addScaledVector(st.fwd, -st.up.dot(st.fwd)).normalize();
    pip.turn = THREE.MathUtils.lerp(pip.turn, turn, 0.2);
    st.speed = THREE.MathUtils.lerp(st.speed, st.fuel > 0 ? SPEED : SPEED * 0.75, 0.05);
    for (const b of BODIES) {
      if (b === trip.from && st.t < 3.5) continue;
      const c = offsetOf(b, _c);
      if (c.distanceTo(st.pos) < b.radius + 6) { startLanding(b); break; }
    }
    hitThings(dt);
  }
  if (st.phase === 'land') return landing(dt);
  st.pos.addScaledVector(st.fwd, st.speed * dt);
  recenter(st.pos, shift);
  for (const r of rocks) if (r.m.visible) { r.m.rotation.x += r.spin.x * dt; r.m.rotation.y += r.spin.y * dt; }
  thrustFx(st.fuel > 0 || st.phase === 'launch' ? 1 : 0.15);
  posePlayer(st.pos, st.fwd, st.up);
  board.rotation.z = -pip.turn * 0.35;
  chase(st.pos, st.fwd, st.up, 6.5, 2.2, 8, st.phase === 'launch' ? 2 : 5);
  renderTags();
}

function thrustFx(power) {
  for (const f of jetFlames) f.scale.y = power * (1.6 + Math.random() * 0.8);
  _a.copy(st.pos).addScaledVector(st.up, -0.5).addScaledVector(st.fwd, -0.6);
  for (let k = 0; k < 2; k++) emit(_a, randomUnit(_b).multiplyScalar(0.8).addScaledVector(st.fwd, -rand(4, 8) * power), Math.random() < 0.6 ? COLORS.mint : COLORS.white, rand(0.3, 0.6), 0);
}

function hitThings(dt) {
  st.chainT -= dt;
  if (st.chainT <= 0) st.chain = 0;
  for (const m of motes) {
    if (!m.visible || m.position.distanceTo(st.pos) > 2.2) continue;
    m.visible = false;
    st.chain = Math.min(12, st.chain + 1); st.chainT = 1.5;
    const gain = Math.round(10 * st.chain * here.body.mul);
    run.score += gain; run.dust += 0.5; st.fuel = Math.min(FUEL, st.fuel + 0.6);
    sfx.pickup(st.chain);
    popup('+' + gain, m.position, 'gold');
    burst(m.position, 12, COLORS.gold, 3, 0.5, 0);
  }
  for (const r of rocks) {
    if (!r.m.visible || r.m.position.distanceTo(st.pos) > r.r + 0.7) continue;
    r.m.visible = false;
    st.fuel = Math.max(0.01, st.fuel - 4); st.speed *= 0.4;
    sfx.bonk(); shake(0.6);
    burst(r.m.position, 30, COLORS.rock, 5, 0.8, 0);
    popup('bonk! −4 s fuel', r.m.position, 'coral');
  }
}

function startLanding(b) {
  recenter(st.pos, shift, b);
  st.phase = 'land'; st.t = 0; st.land = b;
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
  // level out: feet toward the ground, facing along the ground
  st.up.lerp(st.n2, 1 - Math.exp(-6 * dt)).normalize();
  st.fwd.copy(_v).addScaledVector(st.n2, -_v.dot(st.n2));
  if (st.fwd.lengthSq() < 1e-4) st.fwd.copy(pip.f);
  st.fwd.normalize();
  thrustFx(0.6);
  posePlayer(st.pos, st.fwd, st.up);
  chase(st.pos, st.fwd, st.n2, 8.5, 6.4, 3.5, 3);
  if (u >= 1) {
    st.phase = '';
    hideSpace();
    applyLook(); // the skateboard is only there if it was bought
    arrive(st.n2, st.fwd);
  }
}

const _s = new V();
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
    const d = Math.max(0, _c.distanceTo(st.pos) - b.radius);
    const text = `${b.name} ×${b.mul} · ${Math.round(d)} m`;
    if (el.lastChild?.textContent !== text) el.innerHTML = `<i>➜</i><span>${text}</span>`;
    el.firstChild.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    el.style.transform = `translate(${(x + 1) / 2 * innerWidth}px, ${(1 - y) / 2 * innerHeight}px) translate(-50%, ${off ? -50 : -150}%)`;
  });
}

export function status() {
  if (trip.on && st.phase !== 'land') {
    const s = Math.max(0, Math.ceil(st.fuel));
    return { text: st.fuel > 0 ? `Jet fuel ${'▮'.repeat(Math.ceil(s / 4))}${'▯'.repeat(Math.ceil(FUEL / 4) - Math.ceil(s / 4))} ${s} s · fly into a world to land` : 'Out of fuel: coasting to the nearest world', hot: st.fuel <= 5 };
  }
  if (trip.on) return null;
  if (st.cores >= CORES) return { text: coarse ? 'Jets ready: tap Launch' : pad.connected ? 'Jets ready: press RB to blast off' : 'Jets ready: press J to blast off', hot: true };
  return { text: `Jet cores ${'◆'.repeat(st.cores)}${'◇'.repeat(CORES - st.cores)} (blue, from craters)` };
}

export function debugReady() { st.cores = CORES - 1; collected('core'); }
export const hint = 'Some craters leave a blue jet core. Grab three, then blast off on your skateboard and fly to another world yourself.';
