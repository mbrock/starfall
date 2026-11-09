// Falling meteors: a warning ring that fills while the rock falls, then a crater, a shockwave, sparks and
// knocked-over trees. What a landing means for Pip is up to the onLand callback (game/run.js).
// With ?physics=box3d the rock survives the landing: it bounces out of its crater and tumbles for a few seconds,
// and the blast throws loose shards and rocks around.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { COLORS, glowMaterial, glowSprite, mat } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { R, V, rand, randomTangent, randomUnit, surfR } from '../sphere.js';
import { active, game } from '../state.js';
import { addDisk, removeDisk } from '../world/disks.js';
import { dentPlanet } from '../world/dents.js';
import { sdf } from '../platform.js';
import { sdfRock } from './meteor-sdf.js';
import { knockDecor } from '../world/decor.js';
import { CAT, DYNAMIC, physics, poseFromBody } from '../engine/physics.js';

/** Radius in meters of a meteor's warning ring and the area that hurts Pip. */
export const BLAST = 1.7;

const rockGeo = new THREE.DodecahedronGeometry(0.62, 0);
const rockMat = mat(0x4a2f3a, { emissive: 0xff5a1a, emissiveIntensity: 0.9 });
const glowMat = glowMaterial(0xff7a2a);

/** Falling meteors: { n (landing point), t (s fallen), fall (s to land), warn (ring mesh), mesh, drift, spin }. */
export const meteors = [];
/** Timed disk effects (craters, shockwaves): update(uniforms, k) runs with k going 0 → 1 over dur seconds. */
const effects = [];

export function spawnMeteor(n, fall) {
  const mesh = sdf('meteors') ? sdfRock() : new THREE.Mesh(rockGeo, rockMat);
  mesh.castShadow = true;
  mesh.add(glowSprite(null, 3, glowMat));
  scene.add(mesh);
  meteors.push({ n: n.clone(), t: 0, fall, warn: addDisk('warn', n, BLAST), mesh, drift: randomTangent(n), spin: new V(rand(-4, 4), rand(-4, 4), rand(-4, 4)) });
}
function removeMeteor(m) { removeDisk(m.warn); scene.remove(m.mesh); }
export function clearMeteors() {
  for (const m of meteors) removeMeteor(m);
  meteors.length = 0;
  while (rocks.length) dropRock(rocks[0]);
}

/** Meteor rocks lying around after landing (physics only): { mesh, h (body), t (s left) }. */
const rocks = [];
const ROCK_LIFE = 4.5, MAX_ROCKS = 6, ROCK_SCALE = 0.8;
const rockHull = physics && physics.hullOf('meteor', (() => {
  const p = rockGeo.attributes.position, seen = new Map();
  for (let i = 0; i < p.count; i++) { const v = new V().fromBufferAttribute(p, i); seen.set(v.toArray().map((x) => x.toFixed(4)).join(), v); }
  return [...seen.values()];
})());
function dropRock(r) { rocks.splice(rocks.indexOf(r), 1); scene.remove(r.mesh); physics.destroy(r.h); }

const _o = new V(), _w = new V();
/** The rock bounces back out of the crater it made, away from where it came from, and the blast scatters loose things. */
function tumble(m, n) {
  physics.explode(_o.copy(n).multiplyScalar(surfR(n) - 0.6), BLAST * 1.3, 2, 25, CAT.loose | CAT.debris);
  if (rocks.length >= MAX_ROCKS) dropRock(rocks[0]);
  const mesh = m.mesh;
  mesh.clear(); // its glow
  mesh.scale.setScalar(ROCK_SCALE);
  scene.add(mesh);
  const h = physics.body(DYNAMIC, _o.copy(n).multiplyScalar(surfR(n) + 0.75), { angularDamping: 0.4 });
  physics.place(h, _o, mesh.quaternion);
  physics.hull(h, rockHull, ROCK_SCALE, { density: 40, friction: 0.7, restitution: 0.3, cat: CAT.debris, mask: CAT.ground | CAT.prop | CAT.pip | CAT.loose | CAT.debris });
  physics.setVelocity(h, _o.copy(m.drift).multiplyScalar(-rand(2, 4)).addScaledVector(n, rand(3, 5)), _w.copy(m.spin).multiplyScalar(0.6));
  rocks.push({ mesh, h, t: ROCK_LIFE });
}
/** Remove craters and shockwaves still showing (before Pip leaves for another body). */
export function clearCraters() { for (const e of effects) removeDisk(e.mesh); effects.length = 0; }

const dust = new THREE.Color(0x8a7fb8);
function land(m) {
  const n = m.n, at = n.clone().multiplyScalar(surfR(n) + 0.1);
  dentPlanet(n);
  if (physics) tumble(m, n);
  effects.push({ mesh: addDisk('shock', n, BLAST * 1.9), t: 0, dur: 0.55, update: (u, k) => { u.prog.value = k; } });
  burst(at, 46, COLORS.ember, 7, 1.0, 1, n, 1.2);
  burst(at, 24, COLORS.gold, 4, 0.7, 0.6, n, 1.0);
  burst(at, 18, dust, 3, 1.4, 1.4, n, 0.8);
  knockDecor(n, BLAST + 0.4);
}

const _d = new V(), _v = new V(), _a = new V();
/** Advance every meteor and effect; onLand(n) runs for each meteor that hits the ground this frame. */
export function updateMeteors(dt, onLand) {
  const fallDt = game.phase === 'play' && active('drift') ? dt * 0.3 : dt; // Time Drift slows the fall
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.t += fallDt;
    const s = Math.min(1, m.t / m.fall);
    m.warn.material.uniforms.prog.value = s;
    m.warn.material.uniforms.time.value = game.clock;
    const h = 34 * (1 - s * s);
    _d.copy(m.n).addScaledVector(m.drift, (1 - s) * 0.45).normalize();
    m.mesh.position.copy(_d).multiplyScalar(R + h + 0.3);
    m.mesh.rotation.x += m.spin.x * dt; m.mesh.rotation.y += m.spin.y * dt;
    if (h < 30) for (let k = 0; k < 2; k++) {
      _v.copy(_d).multiplyScalar(rand(1, 3)).add(randomUnit(_a).multiplyScalar(0.5));
      emit(m.mesh.position, _v, Math.random() < 0.5 ? COLORS.ember : COLORS.gold, rand(0.25, 0.5), 0);
    }
    if (s >= 1) {
      removeMeteor(m);
      meteors.splice(i, 1);
      land(m);
      onLand(m.n);
    }
  }
  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    r.t -= dt;
    if (r.t <= 0) { dropRock(r); continue; }
    poseFromBody(r.h, r.mesh);
    r.mesh.scale.setScalar(ROCK_SCALE * Math.min(1, r.t / 0.6)); // shrink away at the end
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i]; e.t += dt;
    const k = Math.min(1, e.t / e.dur);
    e.update(e.mesh.material.uniforms, k);
    if (k >= 1) { removeDisk(e.mesh); effects.splice(i, 1); }
  }
}
