// Buildings the player buys in the shop's Planet tab. Each entry is the whole landmark: its shop
// name and price, and build(g, kit), which adds meshes to group g standing on the ground at y = 0.
// To add one, append an entry; it gets a spot on the planet and a shop item automatically.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { glowSprite, mat } from '../engine/materials.js';
import { emit } from '../engine/particles.js';
import { V, rand, randomUnit, standOn, surfR } from '../sphere.js';
import { clearDecorAround } from './decor.js';
import { game } from '../state.js';

const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const glow = (color, size, y) => { const s = glowSprite(color, size); s.position.y = y; return s; };
const wood = mat(0x8a5a3a), white = mat(0xf4f0ff), red = mat(0xff5a6e), gold = mat(0xffcf5a, { metalness: 0.6, roughness: 0.3 }), stone = mat(0x9a96b8), dark = mat(0x3a3570), blue = mat(0x5ab8ff), green = mat(0x46b88f);

/** Things that turn every frame: { o: object, axis: 'y' | 'z', speed } or { o, wave: true }. */
const spinners = [];
const spin = (o, axis, speed) => spinners.push({ o, axis, speed });

export const LANDMARKS = [
  { key: 'house', name: 'Cozy House', price: 40, build(g) { g.add(M(new THREE.BoxGeometry(1, 0.8, 0.9), mat(0xffe0b8), 0, 0.4, 0)); const r = M(new THREE.ConeGeometry(0.85, 0.6, 4), red, 0, 1.1, 0); r.rotation.y = Math.PI / 4; g.add(r); g.add(M(new THREE.BoxGeometry(0.22, 0.4, 0.05), wood, 0, 0.2, 0.46)); g.add(M(new THREE.BoxGeometry(0.2, 0.2, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd36b }), 0.3, 0.5, 0.46)); } },
  { key: 'lamp', name: 'Star Lamp', price: 25, build(g) { g.add(M(new THREE.CylinderGeometry(0.04, 0.06, 1.6, 6), dark, 0, 0.8, 0)); g.add(M(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe08a }), 0, 1.7, 0)); g.add(glow(0xffc04a, 1.6, 1.7)); } },
  { key: 'flag', name: 'Pip Flag', price: 20, build(g) { g.add(M(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), white, 0, 0.9, 0)); const f = M(new THREE.BoxGeometry(0.7, 0.42, 0.02), mat(0x9a7bff), 0.36, 1.55, 0); g.add(f); g.add(M(new THREE.SphereGeometry(0.08, 8, 6), white, 0.36, 1.55, 0.02)); spinners.push({ o: f, wave: true }); } },
  { key: 'mushroom', name: 'Giant Mushroom', price: 30, build(g) { g.add(M(new THREE.CylinderGeometry(0.15, 0.2, 0.7, 8), white, 0, 0.35, 0)); g.add(M(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, 0, 0.65, 0)); for (let i = 0; i < 6; i++) { const a = i * 1.05; g.add(M(new THREE.SphereGeometry(0.08, 6, 5), white, Math.cos(a) * 0.38, 1.05, Math.sin(a) * 0.38)); } } },
  { key: 'snowman', name: 'Snowman', price: 30, build(g) { g.add(M(new THREE.SphereGeometry(0.42, 12, 10), white, 0, 0.4, 0)); g.add(M(new THREE.SphereGeometry(0.3, 12, 10), white, 0, 1.0, 0)); g.add(M(new THREE.SphereGeometry(0.21, 12, 10), white, 0, 1.45, 0)); const n = M(new THREE.ConeGeometry(0.05, 0.22, 6), mat(0xff8a3a), 0, 1.45, 0.25); n.rotation.x = Math.PI / 2; g.add(n); g.add(M(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 10), dark, 0, 1.72, 0)); } },
  { key: 'tent', name: 'Camping Tent', price: 35, build(g) { const t = M(new THREE.ConeGeometry(0.75, 1.0, 4), mat(0xff8a3a), 0, 0.5, 0); t.rotation.y = Math.PI / 4; g.add(t); g.add(M(new THREE.BoxGeometry(0.3, 0.45, 0.05), dark, 0, 0.22, 0.42)); } },
  { key: 'statue', name: 'Pip Statue', price: 60, build(g) { g.add(M(new THREE.BoxGeometry(0.8, 0.5, 0.8), stone, 0, 0.25, 0)); g.add(M(new THREE.SphereGeometry(0.42, 16, 12), mat(0xc9c5e0, { metalness: 0.3 }), 0, 0.95, 0)); const tr = M(new THREE.TorusGeometry(0.37, 0.07, 6, 18), gold, 0, 0.82, 0); tr.rotation.x = Math.PI / 2; g.add(tr); } },
  { key: 'windmill', name: 'Windmill', price: 70, build(g) { g.add(M(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 6), mat(0xffe0b8), 0, 0.9, 0)); g.add(M(new THREE.ConeGeometry(0.38, 0.4, 6), red, 0, 2.0, 0)); const hub = new THREE.Group(); hub.position.set(0, 1.6, 0.36); for (let i = 0; i < 4; i++) { const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; arm.add(M(new THREE.BoxGeometry(0.14, 1.0, 0.03), white, 0, 0.5, 0)); hub.add(arm); } g.add(hub); spin(hub, 'z', 1.5); } },
  { key: 'tower', name: 'Castle Tower', price: 80, build(g) { g.add(M(new THREE.CylinderGeometry(0.5, 0.55, 2.0, 10), stone, 0, 1.0, 0)); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(M(new THREE.BoxGeometry(0.16, 0.2, 0.16), stone, Math.cos(a) * 0.48, 2.1, Math.sin(a) * 0.48)); } g.add(M(new THREE.ConeGeometry(0.42, 0.7, 10), mat(0x7d63d8), 0, 2.55, 0)); g.add(M(new THREE.BoxGeometry(0.22, 0.4, 0.05), wood, 0, 0.2, 0.53)); } },
  { key: 'rocket', name: 'Rocket Ship', price: 100, build(g) { g.add(M(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 12), white, 0, 1.0, 0)); g.add(M(new THREE.ConeGeometry(0.3, 0.6, 12), red, 0, 2.05, 0)); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const f = M(new THREE.BoxGeometry(0.05, 0.5, 0.35), red, Math.cos(a) * 0.32, 0.45, Math.sin(a) * 0.32); f.rotation.y = -a; g.add(f); } const win = M(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), blue, 0, 1.4, 0.29); win.rotation.x = Math.PI / 2; g.add(win); g.add(glow(0xff7a2a, 0.9, 0.15)); } },
  { key: 'lighthouse', name: 'Lighthouse', price: 110, build(g) { for (let i = 0; i < 4; i++) g.add(M(new THREE.CylinderGeometry(0.36 - i * 0.04, 0.4 - i * 0.04, 0.5, 12), i % 2 ? white : red, 0, 0.25 + i * 0.5, 0)); g.add(M(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 10), new THREE.MeshBasicMaterial({ color: 0xffe08a }), 0, 2.15, 0)); g.add(M(new THREE.ConeGeometry(0.3, 0.3, 10), dark, 0, 2.45, 0)); const beam = new THREE.Group(); beam.position.y = 2.15; const bm = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); bm.rotation.z = Math.PI / 2; bm.position.x = 2; beam.add(bm); g.add(beam); spin(beam, 'y', 1.2); } },
  { key: 'telescope', name: 'Telescope', price: 55, build(g) { for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const l = M(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), wood, Math.cos(a) * 0.2, 0.42, Math.sin(a) * 0.2); l.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); g.add(l); } const t = M(new THREE.CylinderGeometry(0.1, 0.16, 1.1, 10), gold, 0, 1.0, 0.15); t.rotation.x = -0.9; g.add(t); } },
  { key: 'monument', name: 'Shard Monument', price: 150, build(g) { g.add(M(new THREE.CylinderGeometry(0.5, 0.6, 0.4, 8), stone, 0, 0.2, 0)); const sh = M(new THREE.OctahedronGeometry(0.5, 0), mat(0xffd36b, { emissive: 0xffa21f, emissiveIntensity: 1.4, roughness: 0.3 }), 0, 1.2, 0); sh.scale.y = 1.4; g.add(sh); g.add(glow(0xffb43a, 3, 1.2)); spin(sh, 'y', 0.8); } },
  { key: 'wheel', name: 'Ferris Wheel', price: 180, build(g) { for (const sd of [-1, 1]) { const l = M(new THREE.BoxGeometry(0.08, 1.9, 0.08), dark, 0.5 * sd * 0.5, 0.9, 0); l.rotation.z = 0.25 * sd; g.add(l); } const w = new THREE.Group(); w.position.y = 1.7; w.add(M(new THREE.TorusGeometry(1.0, 0.05, 6, 28), mat(0x9a7bff))); const cols = [0xff5a6e, 0xffcf5a, 0x6ef0c2, 0x5ab8ff, 0xff9ad5, 0x9be05a]; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = M(new THREE.BoxGeometry(0.03, 1.0, 0.03), white, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0); sp.rotation.z = a + Math.PI / 2; w.add(sp); w.add(M(new THREE.BoxGeometry(0.22, 0.2, 0.22), mat(cols[i]), Math.cos(a), Math.sin(a), 0)); } g.add(w); spin(w, 'z', 0.5); } },
  { key: 'fountain', name: 'Fountain', price: 75, build(g) { g.add(M(new THREE.CylinderGeometry(0.75, 0.8, 0.25, 16), stone, 0, 0.12, 0)); g.add(M(new THREE.CylinderGeometry(0.65, 0.65, 0.05, 16), mat(0x6ec8f0, { emissive: 0x2f86c9, emissiveIntensity: 0.4 }), 0, 0.24, 0)); g.add(M(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), stone, 0, 0.55, 0)); g.add(M(new THREE.SphereGeometry(0.2, 10, 8), mat(0x9fe8ff, { emissive: 0x5ab8ff, emissiveIntensity: 0.6 }), 0, 0.95, 0)); },
    // spray water drops while visible
    update(g, n) { if (Math.random() < 0.5) emit(_p.copy(n).multiplyScalar(surfR(n) + 1.0), _v.copy(n).multiplyScalar(rand(1.5, 2.5)).add(randomUnit(_d).multiplyScalar(0.6)), _c.setHSL(0.55, 0.8, rand(0.7, 0.9)), rand(0.6, 0.9), 2); } },
  { key: 'treehouse', name: 'Tree House', price: 90, build(g) { g.add(M(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 7), wood, 0, 0.8, 0)); g.add(M(new THREE.BoxGeometry(0.8, 0.5, 0.7), mat(0xc98a5a), 0, 1.4, 0)); const r = M(new THREE.ConeGeometry(0.65, 0.4, 4), green, 0, 1.85, 0); r.rotation.y = Math.PI / 4; g.add(r); g.add(M(new THREE.IcosahedronGeometry(0.6, 0), mat(0x3fae7d), 0.5, 2.0, -0.2)); g.add(M(new THREE.IcosahedronGeometry(0.5, 0), mat(0x2e8f6b), -0.5, 1.9, 0.1)); } },
];
const _p = new V(), _v = new V(), _d = new V(), _c = new THREE.Color();

// Spread the landmarks evenly around the planet (golden-angle spiral), away from Pip's start point.
LANDMARKS.forEach((lm, i) => {
  const y = 0.75 - 1.55 * (i + 0.5) / LANDMARKS.length, rr = Math.sqrt(1 - y * y), a = i * 2.39996 + 0.7;
  const n = new V(Math.cos(a) * rr, y, Math.sin(a) * rr).normalize();
  const g = new THREE.Group();
  lm.build(g);
  standOn(g, n, -0.05);
  g.rotateY(a);
  g.visible = false;
  scene.add(g);
  Object.assign(lm, { obj: g, n });
  clearDecorAround(n, 1.4);
});

/** Show the landmarks for which built(key) is true. */
export function showLandmarks(built) {
  for (const lm of LANDMARKS) lm.obj.visible = built(lm.key);
}

export function updateLandmarks(dt) {
  for (const s of spinners) {
    if (s.wave) s.o.rotation.y = Math.sin(game.clock * 3) * 0.25;
    else s.o.rotation[s.axis] += dt * s.speed;
  }
  for (const lm of LANDMARKS) if (lm.update && lm.obj.visible) lm.update(lm.obj, lm.n);
}
