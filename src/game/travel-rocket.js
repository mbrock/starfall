// Travel style 1 (?travel=rocket): fuel a rocket with shards. On the home planet a launch base rises out of
// the ground once the tank is full; walk onto it and Pip boards, counts down and flies to the next body in
// the route. The rocket lands tail-first and stays there, ready to be fuelled again for the next hop.
import { scene } from '../engine/stage.js';
import { COLORS } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import * as THREE from 'three';
import { V, chord, pointAhead, rand, randomUnit, standOn } from '../sphere.js';
import { pip, shake } from '../state.js';
import { BODIES, here, offsetOf } from '../world/bodies.js';
import { clearDecorAround } from '../world/decor.js';
import { player } from '../actors/pip.js';
import { makeBeam, makePad, makeRocket } from '../actors/vehicles.js';
import { popup } from '../ui/popups.js';
import { arrive, beginTrip, bezier, chase, detour, ease, groundPoint, posePlayer, recenter, showBanner, steadyUp } from './flight.js';
import { camRig } from './camera.js';

const NEED = 10, FLIGHT = 7.5;
const rocket = makeRocket(), pad = makePad(), beam = makeBeam(0xffcf5a, 16, 0.5);
rocket.g.scale.setScalar(1.25);
/** Everything this style shows, for compiling its shaders up front (game/travel.js). */
export const models = [rocket.g, pad.g, beam];
for (const o of models) { o.visible = false; scene.add(o); }

// state: 'fuel' (collecting) → 'rising' (home base comes up) → 'ready' (beam on) → 'board' (countdown) → 'fly' → 'fuel' on the new body
const st = { state: 'fuel', fuel: 0, t: 0, n: new V(), baseUp: new V(), docked: false, to: null, path: [new V(), new V(), new V(), new V()], n2: new V(), padOn: false };
const _p = new V(), _t = new V(), _v = new V(), _a = new V(), _b = new V(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), Y = new V(0, 1, 0);

export function reset() {
  Object.assign(st, { state: 'fuel', fuel: 0, t: 0, docked: false, padOn: false });
  rocket.g.visible = pad.g.visible = beam.visible = false;
  rocket.flame.scale.y = 0.01;
}

export function collected(kind) {
  if (st.state !== 'fuel' || (kind !== 'shard' && kind !== 'gold')) return;
  st.fuel = Math.min(NEED, st.fuel + (kind === 'gold' ? 3 : 1));
  if (st.fuel < NEED) return;
  sfx.unlock();
  if (st.docked) { st.state = 'ready'; showBeam(); popup('rocket fuelled!', player.position.clone().addScaledVector(pip.p, 1.2), 'gold'); return; }
  // the home base rises out of the ground somewhere ahead
  st.n.copy(pointAhead(pip.p, pip.f, Math.min(0.9, 9 / here.body.radius), Math.min(1.2, 12 / here.body.radius), 0.7));
  clearDecorAround(st.n, 2.4);
  st.state = 'rising'; st.t = 0; st.padOn = true;
  rocket.g.visible = pad.g.visible = true;
  showBanner('Launch base rising', 'Rocket fuelled', 'Walk onto the pad to fly to the next world');
}

function showBeam() { standOn(beam, st.n, 0); beam.visible = true; }

/** On the ground: raise the base, blink it, and board when Pip steps onto it. */
export function ground(dt) {
  if (st.state === 'rising') {
    st.t += dt;
    const k = Math.min(1, st.t / 2.4);
    standOn(pad.g, st.n, -3.2 * (1 - ease(k)));
    standOn(rocket.g, st.n, 0.26 - 3.2 * (1 - ease(k)));
    if (Math.random() < 0.6) burst(_p.copy(st.n).multiplyScalar(here.body.radius + 0.2), 3, COLORS.dust, 3, 0.8, 1, st.n, 0.8);
    shake(0.08);
    if (k >= 1) { st.state = 'ready'; st.docked = true; showBeam(); sfx.unlock(); }
  }
  if (st.state === 'ready') {
    pad.lamp.color.setHSL(0.12, 1, Math.sin(performance.now() / 120) > 0 ? 0.65 : 0.3);
    beam.material.opacity = 0.32 * Math.min(1, Math.max(0.12, (chord(pip.p, st.n) - 1.5) / 5));
    if (chord(pip.p, st.n) < 1.7) board();
  }
}

function board() {
  beginTrip();
  st.state = 'board'; st.t = 0; beam.visible = false;
  st.to = BODIES[(BODIES.indexOf(here.body) + 1) % BODIES.length];
  st.baseUp.copy(st.n);
  popup(`next stop: ${st.to.name}`, rocket.g.position.clone().addScaledVector(st.n, 4.5), 'mint');
}

/** Boarding, countdown, flight and landing. Runs every frame of the trip, after Pip is posed. */
export function fly(dt) {
  st.t += dt;
  if (st.state === 'board') return countdown(dt);
  const u = Math.min(1, st.t / FLIGHT), e = u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u); // ease in, ease out
  bezier(_p, ...st.path, e);
  recenter(_p, shift);
  bezier(_t, ...st.path, Math.min(e, 0.999), true);
  // nose along the path, flipping to land tail-first over the last stretch
  const flip = THREE.MathUtils.smoothstep(u, 0.72, 0.9);
  _q.setFromUnitVectors(Y, _t); _q2.setFromUnitVectors(Y, st.n2);
  rocket.g.quaternion.copy(_q).slerp(_q2, flip);
  rocket.g.position.copy(_p);
  const up = _v.set(0, 1, 0).applyQuaternion(rocket.g.quaternion);
  const thrust = u < 0.3 ? 1 : u > 0.82 ? 0.8 : 0.35;
  rocket.flame.scale.y = THREE.MathUtils.lerp(rocket.flame.scale.y, thrust * (2.4 + Math.random() * 0.6), 0.3);
  _a.copy(_p).addScaledVector(up, -0.2);
  for (let k = 0; k < 3; k++) {
    emit(_a, randomUnit(_b).multiplyScalar(1.5).addScaledVector(up, -rand(6, 12) * thrust), Math.random() < 0.5 ? COLORS.ember : COLORS.gold, rand(0.4, 0.8), 0);
    if (Math.random() < 0.4) emit(_a, randomUnit(_b).multiplyScalar(1.2), COLORS.white, rand(1, 2), 0);
  }
  // camera: chase from behind, then swing round to watch the landing
  const refUp = steadyUp(_a, _t, u < 0.6 ? st.baseUp : st.n2, dt);
  const side = _v.crossVectors(_t, refUp).normalize();
  if (st.watch && _p.length() < here.body.radius + 16) { camRig.look.copy(_p); camRig.rate = 4; } // watch it climb from beside the pad
  else if (u < 0.75) { st.watch = false; chase(rocket.g.position, _t, refUp, 11, 4, 6, 2.5); }
  else {
    camRig.pos.copy(st.path[3]).addScaledVector(st.n2, 7).addScaledVector(side, 9);
    camRig.look.copy(rocket.g.position); camRig.up.copy(st.n2); camRig.rate = 2.2;
  }
  posePlayer(rocket.g.position, _t, refUp, false);
  if (u >= 1) touchdown();
}

function countdown(dt) {
  // Pip hops into the hatch, then 3, 2, 1, liftoff
  const t = st.t, n = st.n;
  const hatch = _a.copy(rocket.g.position).addScaledVector(n, 2.2);
  const k = Math.min(1, t / 0.7);
  _p.copy(player.position).lerp(hatch, k).addScaledVector(n, Math.sin(k * Math.PI) * 1.2);
  posePlayer(_p, pip.f, n, k < 1);
  const side = _v.crossVectors(n, pip.f).normalize();
  camRig.pos.copy(rocket.g.position).addScaledVector(n, 3.5).addScaledVector(side, 9).addScaledVector(pip.f, -3);
  camRig.look.copy(rocket.g.position).addScaledVector(n, 2.5); camRig.up.copy(n); camRig.rate = 2.5;
  for (const [at, label] of [[0.9, '3'], [1.6, '2'], [2.3, '1']]) if (t - dt < at && t >= at) { sfx.tick(false); popup(label, hatch.clone().addScaledVector(n, 2.6), 'gold'); }
  if (t > 1.2) { rocket.flame.scale.y = 0.4 + Math.random() * 0.3; if (Math.random() < 0.5) burst(rocket.g.position, 2, COLORS.dust, 3, 1.2, 0.2, n, 0.1); shake(0.05); }
  if (t >= 3) {
    sfx.tick(true); sfx.liftoff(); shake(0.7);
    popup('LIFTOFF!', hatch.clone().addScaledVector(n, 2.6), 'gold');
    burst(rocket.g.position, 60, COLORS.dust, 6, 1.4, 0.4, n, 0.4);
    // flight path from the pad to the far side of the next body facing us
    const [a, b, c, d] = st.path;
    a.copy(rocket.g.position);
    st.n2.copy(a).sub(offsetOf(st.to, _v)).normalize();
    groundPoint(st.to, st.n2, d, 0.05);
    b.copy(a).addScaledVector(n, 45);
    c.copy(d).addScaledVector(st.n2, 30);
    detour(b, c, here.body.radius);
    st.state = 'fly'; st.t = 0; st.watch = true;
  }
}

function shift(offset) {
  for (const p of st.path) p.sub(offset);
  pad.g.position.sub(offset);
}

function touchdown() {
  recenter(rocket.g.position, shift, st.to);
  st.n.copy(st.n2);
  standOn(rocket.g, st.n, 0);
  rocket.flame.scale.y = 0.01;
  pad.g.visible = here.body === BODIES[0] && st.padOn;
  // Pip hops out next to the rocket
  const f = _t.copy(randomUnit(_v)).addScaledVector(st.n, -_v.dot(st.n)).normalize();
  const n = _a.copy(st.n).multiplyScalar(here.body.radius).addScaledVector(f, 1.8).normalize();
  Object.assign(st, { state: 'fuel', fuel: 0, docked: true });
  arrive(n, _v.crossVectors(st.n, f)); // side-on to the rocket, so it doesn't block the camera
}

export function status() {
  if (st.state === 'fuel') return { text: `Rocket fuel ${st.fuel} / ${NEED} shards` };
  if (st.state === 'rising') return { text: 'Launch base rising…', target: st.n };
  if (st.state === 'ready') return { text: 'Rocket ready: walk onto the pad', target: st.n, hot: true };
  return null;
}

export function debugReady() { st.fuel = NEED - 1; collected('shard'); }
export const hint = `Collect ${NEED} shards to fuel a rocket. A launch base rises; walk onto it to fly to the next world.`;
