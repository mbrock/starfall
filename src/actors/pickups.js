// Things lying on the ground for Pip to grab: star shards, golden shards and hull hearts.
// This module owns how they look and fade; game/run.js decides what grabbing one does.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { COLORS, glowMaterial, glowSprite, mat } from '../engine/materials.js';
import { burst } from '../engine/particles.js';
import { UP, surfR } from '../sphere.js';
import { game } from '../state.js';

const beamGeo = new THREE.CylinderGeometry(0.07, 0.16, 7, 8, 1, true).translate(0, 3.5, 0);
const beamMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const shardGeo = new THREE.OctahedronGeometry(0.3, 0);

export const PICKUP_KINDS = {
  shard: { geo: shardGeo, mat: mat(0xffd36b, { emissive: 0xffa21f, emissiveIntensity: 1.6, roughness: 0.3 }), size: 1, glow: glowMaterial(0xffb43a, 0.85), glowSize: 1.7, beam: beamMat(0xffb43a), color: COLORS.gold },
  gold: { geo: shardGeo, mat: mat(0xfff1a8, { emissive: 0xffd36b, emissiveIntensity: 2.2, roughness: 0.15, metalness: 0.4 }), size: 1.7, glow: glowMaterial(0xfff0a0, 0.85), glowSize: 3, beam: beamMat(0xffb43a), color: COLORS.gold },
  heart: { geo: new THREE.IcosahedronGeometry(0.27, 0), mat: mat(0x6ef0c2, { emissive: 0x1fbf8a, emissiveIntensity: 1.4, roughness: 0.3 }), size: 1, glow: glowMaterial(0x6ef0c2, 0.85), glowSize: 1.7, beam: beamMat(0x6ef0c2), color: COLORS.mint },
};

/** Live pickups: { g (group), mesh, n (surface point), kind, life (s left), age (s) }. */
export const pickups = [];

export function spawnPickup(n, kind, life, { beacon = false } = {}) {
  const k = PICKUP_KINDS[kind];
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(k.geo, k.mat);
  mesh.castShadow = true; mesh.scale.setScalar(k.size);
  g.add(mesh, glowSprite(null, k.glowSize, k.glow));
  if (beacon) g.add(new THREE.Mesh(beamGeo, k.beam));
  scene.add(g);
  const pk = { g, mesh, n: n.clone(), kind, life, age: 0, phase: Math.random() * 6 };
  pickups.push(pk);
  return pk;
}
export function removePickup(pk) {
  const i = pickups.indexOf(pk);
  if (i >= 0) pickups.splice(i, 1);
  scene.remove(pk.g);
}
export function clearPickups() { while (pickups.length) removePickup(pickups[0]); }

export function updatePickups(dt) {
  const t = game.clock;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.age += dt; pk.life -= dt;
    if (pk.life <= 0) { burst(pk.g.position, 8, PICKUP_KINDS[pk.kind].color, 1.5, 0.5, 0.2); removePickup(pk); continue; }
    pk.g.position.copy(pk.n).multiplyScalar(surfR(pk.n) + 0.68 + Math.sin(t * 3 + pk.phase) * 0.12);
    pk.g.quaternion.setFromUnitVectors(UP, pk.n);
    pk.mesh.rotation.y += dt * 2.2;
    pk.g.scale.setScalar(Math.min(1, pk.age * 4) * (1 + Math.sin(t * 6 + pk.phase) * 0.05));
    pk.g.visible = pk.life > 2 || Math.sin(t * 22) > -0.2; // flicker before fading out
  }
}
