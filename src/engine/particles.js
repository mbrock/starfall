// One fixed pool of additive point sprites for every spark, puff and trail. Gravity pulls toward the planet's center.
import * as THREE from 'three';
import { scene } from './stage.js';
import { glowTex } from './materials.js';
import { R, V, rand, randomUnit } from '../sphere.js';

const MAX = 1200;
const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3), vel = new Float32Array(MAX * 3);
const base = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX), grav = new Float32Array(MAX);
let head = 0;
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.32, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
points.frustumCulled = false;
scene.add(points);

/** One particle. gravity 1 falls normally, 0 floats, negative rises. Overwrites the oldest particle when full. */
export function emit(p, v, color, seconds, gravity = 1) {
  const i = head; head = (head + 1) % MAX;
  pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
  vel[i * 3] = v.x; vel[i * 3 + 1] = v.y; vel[i * 3 + 2] = v.z;
  base[i * 3] = color.r; base[i * 3 + 1] = color.g; base[i * 3 + 2] = color.b;
  life[i] = maxLife[i] = seconds; grav[i] = gravity;
}

const _v = new V(), _c = new THREE.Color();
/** n particles flying out of p in random directions, with an optional extra push along `up`. */
export function burst(p, n, color, speed, seconds, gravity = 1, up = null, upBoost = 0.6) {
  for (let i = 0; i < n; i++) {
    randomUnit(_v).multiplyScalar(speed * rand(0.3, 1));
    if (up) _v.addScaledVector(up, speed * upBoost * Math.random());
    _c.copy(color).offsetHSL(rand(-0.03, 0.03), 0, rand(-0.08, 0.08));
    emit(p, _v, _c, seconds * rand(0.6, 1.2), gravity);
  }
}

export function updateParticles(dt) {
  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) continue;
    life[i] -= dt;
    const j = i * 3;
    let x = pos[j], y = pos[j + 1], z = pos[j + 2];
    const len = Math.hypot(x, y, z) || 1;
    const g = 9 * grav[i] * dt / len;
    vel[j] -= x * g; vel[j + 1] -= y * g; vel[j + 2] -= z * g;
    const drag = 1 - 1.2 * dt;
    vel[j] *= drag; vel[j + 1] *= drag; vel[j + 2] *= drag;
    x += vel[j] * dt; y += vel[j + 1] * dt; z += vel[j + 2] * dt;
    if (Math.hypot(x, y, z) < R - 0.05 || life[i] <= 0) { life[i] = 0; col[j] = col[j + 1] = col[j + 2] = 0; continue; }
    pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
    const k = life[i] / maxLife[i];
    col[j] = base[j] * k; col[j + 1] = base[j + 1] * k; col[j + 2] = base[j + 2] * k;
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
}
