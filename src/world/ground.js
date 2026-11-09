// The ground as Box3D sees it (unless ?physics=off): the body Pip stands on as a triangle mesh with the same
// heights as heightAt() in sphere.js, craters included. The mesh is split into 80 patches so a crater only rebuilds
// the few it reaches, and only when its depth moves to the next eighth: about 0.15 ms per patch on a desktop.
import * as THREE from 'three';
import { physics } from '../engine/physics.js';
import { R, V, dents, groundVersion, heightAt } from '../sphere.js';

const REACH = 2.2; // meters from a crater's center to where its rim fades out (world/dents.js)

// Patch centers: the faces of a once-subdivided icosahedron.
const centers = [];
{
  const p = new THREE.IcosahedronGeometry(1, 1).attributes.position;
  for (let i = 0; i < p.count; i += 3) centers.push(new V().fromBufferAttribute(p, i).add(new V().fromBufferAttribute(p, i + 1)).add(new V().fromBufferAttribute(p, i + 2)).normalize());
}

const layouts = new Map();
/** Split an icosphere of this detail into patches: { dirs (unit vertex directions), tris, center, cos (of its angular radius) }. */
function layout(detail) {
  if (layouts.has(detail)) return layouts.get(detail);
  const pos = new THREE.IcosahedronGeometry(1, detail).attributes.position;
  const parts = centers.map((center) => ({ center, keys: new Map(), dirs: [], tris: [], cos: 1 }));
  const a = new V(), b = new V(), c = new V(), mid = new V();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    mid.copy(a).add(b).add(c).normalize();
    let best = parts[0], bestDot = -2;
    for (const p of parts) { const d = p.center.dot(mid); if (d > bestDot) { bestDot = d; best = p; } }
    for (const v of [a, b, c]) {
      const key = `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`;
      let j = best.keys.get(key);
      if (j === undefined) {
        j = best.dirs.length / 3; best.keys.set(key, j);
        v.normalize(); best.dirs.push(v.x, v.y, v.z);
        best.cos = Math.min(best.cos, v.dot(best.center));
      }
      best.tris.push(j);
    }
  }
  const out = parts.map((p) => ({ center: p.center, cos: p.cos, dirs: new Float32Array(p.dirs), tris: new Int32Array(p.tris), verts: new Float32Array(p.dirs.length) }));
  layouts.set(detail, out);
  return out;
}

let patches = [], builtFor = -1, seen = [];
const dirty = new Set(), _n = new V();

function build(i) {
  const p = patches[i];
  for (let j = 0; j < p.dirs.length; j += 3) {
    _n.fromArray(p.dirs, j);
    const r = R + heightAt(_n);
    p.verts[j] = _n.x * r; p.verts[j + 1] = _n.y * r; p.verts[j + 2] = _n.z * r;
  }
  physics.groundPatch(i, p.verts, p.tris);
}

/** Mark the patches with a vertex a crater at n reaches (heights only change at vertices). */
function touch(n) {
  const reach = REACH / R, near = Math.cos(reach);
  patches.forEach((p, i) => {
    if (dirty.has(i) || n.dot(p.center) < Math.cos(Math.acos(Math.min(1, p.cos)) + reach)) return;
    const d = p.dirs;
    for (let j = 0; j < d.length; j += 3) if (n.x * d[j] + n.y * d[j + 1] + n.z * d[j + 2] > near) { dirty.add(i); return; }
  });
}

/**
 * Every frame before the physics step: rebuild the ground when the body underfoot changed (travel) or a crater
 * moved. spread: nothing stands on the ground (Pip is flying), so a whole new body can be built over a few frames.
 */
export function updateGround(spread = false) {
  if (!physics) return;
  // A few patches a frame: a crater's depth step reaches about 5 of them, ~0.17 ms each on the Pi 5, so a deepening
  // crater catches up within a frame or two instead of one 3-5 ms frame.
  let budget = 4;
  if (builtFor !== groundVersion) {
    // a new body: all at once if Pip stands on it, spread out below if he is still flying in
    budget = Infinity;
    // about 0.3 m between vertices, like the home planet's mesh, so craters keep their shape
    patches = layout(Math.max(12, Math.min(52, Math.round(R * 4))));
    physics.clearGround();
    patches.forEach((_, i) => dirty.add(i));
    builtFor = groundVersion; seen = dents.slice();
  }
  if (spread) budget = 16;
  for (const d of dents) {
    const q = Math.round(d.k * 8);
    if (d.q !== q) { d.q = q; touch(d.n); }
  }
  let same = seen.length === dents.length;
  for (let i = 0; same && i < dents.length; i++) same = seen[i] === dents[i];
  if (!same) {
    for (const d of seen) if (!dents.includes(d)) touch(d.n); // healed, or dropped when the list was full
    seen = dents.slice();
  }
  for (const i of dirty) { if (budget-- <= 0) break; build(i); dirty.delete(i); }
}
