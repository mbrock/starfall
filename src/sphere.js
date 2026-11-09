// Geometry of Pip's planet. Positions on the surface are unit vectors ("normals", usually named n);
// multiply by surfR(n) to get the world-space point on the ground.
import * as THREE from 'three';

export const V = THREE.Vector3;
export const UP = new V(0, 1, 0);
export const R = 10; // planet radius

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function noise3(x, y, z) {
  return Math.sin(x * 1.7 + Math.sin(z * 1.3)) * Math.cos(y * 1.9 + Math.sin(x * 1.1)) * 0.6
    + Math.sin(y * 3.3 + z * 2.7 + x * 0.7) * 0.25
    + Math.sin(x * 5.1 - y * 4.3 + z * 3.9) * 0.12;
}
/** Meteor dents in the ground, { n, k (0-1 strength) }; only the SDF planet experiment (?sdf=planet) adds them. */
export const dents = [];
/** Height in meters of a dent's surface at `c` m from its center: a bowl with a raised rim (planet-sdf.js matches it). */
export const dentH = (c) => { const x = Math.min(c / 1.3, 1); return -0.4 * (1 - x * x) ** 2 + 0.12 * Math.exp(-(((c - 1.25) / 0.3) ** 2)); };
export function heightAt(n) {
  let h = noise3(n.x * 2.2, n.y * 2.2, n.z * 2.2) * 0.24;
  for (const d of dents) h += d.k * dentH(n.distanceTo(d.n) * R);
  return h;
}
/** Distance from the planet's center to the ground under n. */
export const surfR = (n) => R + heightAt(n);
/** Straight-line distance in meters between two surface points. */
export const chord = (a, b) => a.distanceTo(b) * R;

export function randomUnit(out = new V()) {
  const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(th), u, s * Math.sin(th));
}
export function randomTangent(n, out = new V()) {
  do { randomUnit(out); out.addScaledVector(n, -out.dot(n)); } while (out.lengthSq() < 1e-4);
  return out.normalize();
}
/** A random surface point between minA and maxA radians of arc away from n. */
export function pointNear(n, minA, maxA) {
  const t = randomTangent(n);
  const a = minA + Math.random() * (maxA - minA);
  return n.clone().multiplyScalar(Math.cos(a)).addScaledVector(t, Math.sin(a)).normalize();
}
/** Orient obj so its +Y points away from the planet at n, standing on the ground (lifted by `lift`). */
export function standOn(obj, n, lift = 0) {
  obj.position.copy(n).multiplyScalar(surfR(n) + lift);
  obj.quaternion.setFromUnitVectors(UP, n);
}

const _axis = new V();
/** Move surface point p `meters` along its facing f (a great circle), keeping p and f unit length and perpendicular. */
export function advance(p, f, meters) {
  _axis.crossVectors(p, f).normalize();
  const ang = meters / R;
  p.applyAxisAngle(_axis, ang); f.applyAxisAngle(_axis, ang);
  p.normalize(); f.addScaledVector(p, -f.dot(p)).normalize();
}
