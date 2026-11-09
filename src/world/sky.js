// Background stars and the moon. Static unless travel is on (game/travel.js), which hides the moon and keeps
// the stars centered on the camera.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { V, rand, randomUnit } from '../sphere.js';

const N = 2200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
const c = new THREE.Color(), v = new V();
for (let i = 0; i < N; i++) {
  randomUnit(v).multiplyScalar(rand(220, 320));
  pos.set([v.x, v.y, v.z], i * 3);
  c.setHSL(rand(0.55, 0.75), rand(0.2, 0.7), rand(0.55, 0.95));
  col.set([c.r, c.g, c.b], i * 3);
}
const g = new THREE.BufferGeometry();
g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
g.setAttribute('color', new THREE.BufferAttribute(col, 3));
export const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2 * Math.min(devicePixelRatio, 2), sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
scene.add(stars);

export const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(9, 2), new THREE.MeshStandardMaterial({ color: 0xc9b8ff, flatShading: true, roughness: 1, emissive: 0x2a1f55, emissiveIntensity: 0.6 }));
moon.position.set(-90, 55, -120);
scene.add(moon);
