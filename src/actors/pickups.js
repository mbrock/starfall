// Things lying on the ground for Pip to grab: star shards, golden shards, hull hearts and jet cores.
// This module owns how they look and fade; game/run.js decides what grabbing one does. With ?physics=box3d each
// one is a small ball that falls, bounces and rolls (tossed out of the crater that made it); the model floats
// above the ball.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { COLORS, glowMaterial, glowSprite, mat } from '../engine/materials.js';
import { burst } from '../engine/particles.js';
import { CAT, DYNAMIC, physics } from '../engine/physics.js';
import { R, UP, V, rand, randomTangent, surfR } from '../sphere.js';
import { game } from '../state.js';

const beamGeo = new THREE.CylinderGeometry(0.07, 0.16, 7, 8, 1, true).translate(0, 3.5, 0);
const beamMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const shardGeo = new THREE.OctahedronGeometry(0.3, 0);

export const PICKUP_KINDS = {
  shard: { geo: shardGeo, mat: mat(0xffd36b, { emissive: 0xffa21f, emissiveIntensity: 1.6, roughness: 0.3 }), size: 1, glow: glowMaterial(0xffb43a, 0.85), glowSize: 1.7, beam: beamMat(0xffb43a), color: COLORS.gold },
  gold: { geo: shardGeo, mat: mat(0xfff1a8, { emissive: 0xffd36b, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.4 }), size: 1.7, glow: glowMaterial(0xfff0a0, 0.85), glowSize: 3, beam: beamMat(0xffb43a), color: COLORS.gold },
  core: { geo: new THREE.TorusGeometry(0.22, 0.09, 6, 14), mat: mat(0x9fe8ff, { emissive: 0x3ab8ff, emissiveIntensity: 1.8, roughness: 0.2 }), size: 1.2, glow: glowMaterial(0x7ee0ff, 0.9), glowSize: 2.4, beam: beamMat(0x7ee0ff), color: COLORS.mint }, // jet cores (?travel=jet)
  heart: { geo: new THREE.IcosahedronGeometry(0.27, 0), mat: mat(0x6ef0c2, { emissive: 0x1fbf8a, emissiveIntensity: 1.4, roughness: 0.3 }), size: 1, glow: glowMaterial(0x6ef0c2, 0.85), glowSize: 1.7, beam: beamMat(0x6ef0c2), color: COLORS.mint },
};

/** Live pickups: { g (group), mesh, n (surface point), kind, life (s left), age (s), h (physics body) }. */
export const pickups = [];

const BALL = 0.22, FLOAT = 0.68; // the physics ball's radius; how high the model floats over the ground
const _p = new V(), _v = new V(), _t = new V();

/** toss: with physics, it flies out of the ground at n; otherwise it drops from a little above it. */
export function spawnPickup(n, kind, life, { beacon = false, toss = false } = {}) {
  const k = PICKUP_KINDS[kind];
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(k.geo, k.mat);
  mesh.castShadow = true; mesh.scale.setScalar(k.size);
  g.add(mesh, glowSprite(null, k.glowSize, k.glow));
  if (beacon) g.add(new THREE.Mesh(beamGeo, k.beam));
  scene.add(g);
  const pk = { g, mesh, n: n.clone(), kind, life, age: 0, phase: Math.random() * 6, h: 0, vel: new V() };
  if (physics) {
    const r = BALL * Math.sqrt(k.size);
    pk.h = physics.body(DYNAMIC, _p.copy(n).multiplyScalar(surfR(n) + (toss ? 0.35 : 1.8)), { linearDamping: 0.1, angularDamping: 1 });
    physics.sphere(pk.h, r, { density: 25, friction: 0.7, restitution: 0.35, rolling: 0.08, cat: CAT.loose, mask: CAT.ground | CAT.prop | CAT.loose | CAT.debris });
    if (toss) physics.setVelocity(pk.h, randomTangent(n, _v).multiplyScalar(rand(1, 2.6)).addScaledVector(n, rand(4.5, 7)));
    pk.lift = FLOAT - r;
  }
  pickups.push(pk);
  return pk;
}
export function removePickup(pk) {
  const i = pickups.indexOf(pk);
  if (i >= 0) pickups.splice(i, 1);
  scene.remove(pk.g);
  if (pk.h) physics.destroy(pk.h);
}

/** Pull pickup pk toward surface point n at `rate` (share of the way per second); Shard Magnet. */
export function nudgePickup(pk, n, rate, dt) {
  if (!pk.h) { pk.n.lerp(n, Math.min(1, dt * rate)).normalize(); return; }
  // roll it toward n: steer its velocity along the ground toward the gap times the rate
  _t.subVectors(n, pk.n).addScaledVector(pk.n, -_t.dot(pk.n)).multiplyScalar(R * rate);
  if (_t.length() > 7) _t.setLength(7);
  _v.copy(pk.vel).addScaledVector(pk.n, -pk.vel.dot(pk.n));
  physics.impulse(pk.h, _t.sub(_v).multiplyScalar(physics.mass(pk.h) * Math.min(1, dt * 8)));
}
export function clearPickups() { while (pickups.length) removePickup(pickups[0]); }

export function updatePickups(dt) {
  const t = game.clock;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.age += dt; pk.life -= dt;
    if (pk.life <= 0) { burst(pk.g.position, 8, PICKUP_KINDS[pk.kind].color, 1.5, 0.5, 0.2); removePickup(pk); continue; }
    const bob = Math.sin(t * 3 + pk.phase) * 0.12;
    if (pk.h) {
      physics.read(pk.h, _p, null, pk.vel);
      pk.n.copy(_p).normalize();
      pk.g.position.copy(_p).addScaledVector(pk.n, pk.lift + bob);
    } else pk.g.position.copy(pk.n).multiplyScalar(surfR(pk.n) + FLOAT + bob);
    pk.g.quaternion.setFromUnitVectors(UP, pk.n);
    pk.mesh.rotation.y += dt * 2.2;
    pk.g.scale.setScalar(Math.min(1, pk.age * 4) * (1 + Math.sin(t * 6 + pk.phase) * 0.05));
    pk.g.visible = pk.life > 2 || Math.sin(t * 22) > -0.2; // flicker before fading out
  }
}
