// Travel style 3 (?travel=comet): now and then a comet comes skimming down at the planet and a gold ring
// marks where it will touch the ground, the way red rings mark meteors. Be inside the ring when the fill
// reaches its edge and Pip grabs the comet, which slings him to a random other world and crashes there.
// Miss it and the next one comes later.
import { scene } from '../engine/stage.js';
import { COLORS } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { V, chord, pick, pointAhead, rand, randomTangent, randomUnit, surfR } from '../sphere.js';
import { pip, run, shake } from '../state.js';
import { BODIES, here, offsetOf } from '../world/bodies.js';
import { addDisk, removeDisk } from '../world/disks.js';
import { knockDecor } from '../world/decor.js';
import { makeBeam, makeComet } from '../actors/vehicles.js';
import { player } from '../actors/pip.js';
import { popup } from '../ui/popups.js';
import { arrive, beginTrip, bezier, chase, detour, groundPoint, posePlayer, recenter, showBanner, steadyUp } from './flight.js';

const FIRST = 35, AGAIN = 30, WARN = 12, RING = 2.4, RIDE = 4.2;
const { g: comet, glow: cometGlow } = makeComet(), beam = makeBeam(0x9fe8ff, 16, 0.45);
comet.visible = beam.visible = false;
scene.add(comet, beam);
export const models = [comet, beam];

// state: 'wait' → 'incoming' (ring on the ground, comet closing in) → 'gone' (missed) → 'wait', or → 'ride' → 'wait' on the new world
const st = { state: 'wait', t: FIRST, n: new V(), dir: new V(), ring: null, to: null, path: [new V(), new V(), new V(), new V()], n2: new V(), up: new V(), shock: null, shockK: 0 };
const _p = new V(), _t = new V(), _a = new V(), _b = new V(), _v = new V();

export function reset() {
  removeRing();
  if (st.shock) { removeDisk(st.shock); st.shock = null; }
  Object.assign(st, { state: 'wait', t: FIRST });
  comet.visible = beam.visible = false;
}
function removeRing() { if (st.ring) { removeDisk(st.ring); st.ring = null; } }

/** Where the comet is `s` seconds before it skims the ring: far and slow, then a fast swoop. */
function cometAt(out, s) {
  const x = -(Math.min(s, 3) * 32 + Math.max(0, s - 3) * 6);
  return out.copy(st.n).multiplyScalar(surfR(st.n) + 1.2 + 0.006 * x * x).addScaledVector(st.dir, x);
}

export function ground(dt) {
  st.t -= dt;
  if (st.shock) { // the crash's shockwave
    st.shockK += dt / 0.6;
    st.shock.material.uniforms.prog.value = Math.min(1, st.shockK);
    if (st.shockK >= 1) { removeDisk(st.shock); st.shock = null; }
  }
  if (st.state === 'wait' && st.t <= 0) {
    st.state = 'incoming'; st.t = WARN;
    st.n.copy(pointAhead(pip.p, pip.f, Math.min(0.75, 8 / here.body.radius), Math.min(1.1, 12 / here.body.radius), 1.2));
    st.dir.copy(randomTangent(st.n));
    st.ring = addDisk('warn', st.n, RING);
    st.ring.material.uniforms.col.value.setRGB(1.0, 0.82, 0.3);
    beam.position.copy(st.n).multiplyScalar(surfR(st.n)); beam.quaternion.setFromUnitVectors(_a.set(0, 1, 0), st.n);
    beam.visible = comet.visible = true;
    sfx.unlock();
    showBanner('Comet incoming', 'Look up', 'Stand in the gold ring when it arrives');
  }
  if (st.state === 'incoming') {
    st.ring.material.uniforms.prog.value = 1 - st.t / WARN;
    st.ring.material.uniforms.time.value = performance.now() / 1000;
    beam.material.opacity = 0.32 * Math.min(1, Math.max(0.12, (chord(pip.p, st.n) - 1.5) / 5)); // fade as Pip gets close
    cometAt(comet.position, st.t);
    aim(st.t);
    if (st.t < 3 && st.t + dt >= 3) sfx.comet();
    if (st.t <= 0) {
      removeRing(); beam.visible = false;
      if (chord(pip.p, st.n) <= RING + 0.35) catchIt();
      else { st.state = 'gone'; st.t = 0; popup('missed the comet!', comet.position, 'coral'); }
    }
  }
  if (st.state === 'gone') {
    cometAt(comet.position, st.t); // keeps going up and away (s < 0)
    aim(st.t);
    if (st.t < -2.5) { comet.visible = false; st.state = 'wait'; st.t = AGAIN; }
  }
}

/** Point the comet along its path and make it bigger the further away it is, so it reads in the sky. */
function aim(s) {
  cometAt(_t, s - 0.05); // where it is a moment later
  comet.lookAt(_t);
  comet.scale.setScalar(Math.min(4, Math.max(1, comet.position.distanceTo(player.position) / 30)));
  cometGlow.scale.setScalar(6);
  tail(comet.position, _a.subVectors(_t, comet.position).normalize(), 2);
}

function tail(at, dir, n) {
  for (let k = 0; k < n; k++) emit(at, randomUnit(_b).multiplyScalar(1.2).addScaledVector(dir, -rand(3, 8)), Math.random() < 0.5 ? COLORS.white : COLORS.mint, rand(0.8, 1.6), 0);
}

function catchIt() {
  beginTrip();
  st.state = 'ride'; st.t = 0;
  st.to = pick(BODIES.filter((b) => b !== here.body));
  const [a, b, c, d] = st.path;
  cometAt(a, 0);
  b.copy(a).addScaledVector(st.dir, 40).addScaledVector(st.n, 18);
  st.n2.copy(b).sub(offsetOf(st.to, _v)).normalize();
  groundPoint(st.to, st.n2, d, 0.2);
  c.copy(d).addScaledVector(st.n2, 35);
  detour(b, c, here.body.radius);
  st.up.copy(st.n);
  sfx.whoosh(); shake(0.8);
  burst(a, 50, COLORS.mint, 6, 0.8, 0.2);
  popup(`caught it! → ${st.to.name}`, _p.copy(a).addScaledVector(st.n, 2), 'mint');
  run.score += 50;
}

function shift(offset) { for (const p of st.path) p.sub(offset); }

export function fly(dt) {
  st.t += dt;
  const u = Math.min(1, st.t / RIDE), e = 1 - Math.pow(1 - u, 1.6); // fast out of the gate, slower near the end
  bezier(_p, ...st.path, e);
  recenter(_p, shift);
  bezier(_t, ...st.path, Math.min(e, 0.999), true);
  comet.position.copy(_p);
  comet.lookAt(_a.copy(_p).add(_t));
  comet.scale.setScalar(0.7); cometGlow.scale.setScalar(3);
  const up = steadyUp(st.up, _t, u < 0.6 ? st.n : st.n2, dt);
  tail(_p, _t, 6);
  // streaks rushing past the camera
  for (let k = 0; k < 4; k++) {
    _a.copy(_p).addScaledVector(_t, rand(18, 34)).add(randomUnit(_b).multiplyScalar(rand(3, 7)));
    emit(_a, _v.copy(_t).multiplyScalar(-rand(50, 70)), COLORS.white, 0.4, 0);
  }
  _a.copy(_p).addScaledVector(up, 0.95);
  posePlayer(_a, _t, up);
  chase(_p, _t, up, 7, 2.6, 6, 6);
  if (u >= 1) crash();
}

function crash() {
  recenter(comet.position, shift, st.to);
  const at = comet.position;
  comet.visible = false;
  shake(1); sfx.boom(1);
  burst(at, 80, COLORS.mint, 8, 1.1, 0.6, st.n2, 1.2);
  burst(at, 40, COLORS.white, 6, 0.9, 0.6, st.n2, 1.2);
  knockDecor(st.n2, 3.5);
  st.shock = addDisk('shock', st.n2, 5); st.shockK = 0;
  const f = randomTangent(st.n2);
  const n = _a.copy(st.n2).multiplyScalar(here.body.radius).addScaledVector(f, 1.5).normalize();
  st.state = 'wait'; st.t = AGAIN;
  arrive(n, f);
}

export function status() {
  if (st.state === 'incoming') return { text: `Comet! Stand in the gold ring: ${Math.max(0, st.t).toFixed(1)} s`, target: st.n, hot: true };
  if (st.state === 'wait') return { text: `Next comet in ${Math.ceil(Math.max(0, st.t))} s` };
  return null;
}

export function debugReady() { if (st.state === 'wait') st.t = 0.01; }
export const hint = 'Every so often a comet skims the planet. Stand in its gold ring when it arrives to hitch a ride to a random world.';
