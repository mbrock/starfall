// Trees, rocks and crystals. Meteors and Giant Pip knock them down; they regrow somewhere else.
// With physics on (the default) each has a static collider (trunk or stone) that blocks Pip, shards and meteor rocks.
import * as THREE from 'three';
import { scene } from '../engine/stage.js';
import { mat } from '../engine/materials.js';
import { burst } from '../engine/particles.js';
import { V, chord, dents, pick, rand, randomUnit, standOn } from '../sphere.js';
import { CAT, STATIC, physics } from '../engine/physics.js';

const shape = (geo, f) => { f(geo); return geo; };
const geos = {
  trunk: shape(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 5), (g) => g.translate(0, 0.25, 0)),
  cone: shape(new THREE.ConeGeometry(0.42, 1.0, 6), (g) => g.translate(0, 0.95, 0)),
  blob: shape(new THREE.IcosahedronGeometry(0.42, 0), (g) => g.translate(0, 0.78, 0)),
  rock: shape(new THREE.DodecahedronGeometry(0.35, 0), (g) => g.translate(0, 0.08, 0)),
  crystal: shape(new THREE.OctahedronGeometry(0.26, 0), (g) => { g.scale(0.7, 1.9, 0.7); g.translate(0, 0.4, 0); }),
};
const mats = {
  trunk: mat(0x7a4a3a),
  leaves: [mat(0x3fae7d), mat(0x2e8f6b), mat(0x7ccf6a), mat(0xf29f6b), mat(0xffd27a)],
  rock: mat(0x6c6890),
  crystal: mat(0xa98bff, { emissive: 0x5b3bff, emissiveIntensity: 0.7, roughness: 0.3 }),
};

function build(kind) {
  const g = new THREE.Group();
  const add = (geo, m) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; g.add(mesh); return mesh; };
  let color;
  if (kind === 'tree' || kind === 'round') {
    const leaves = pick(mats.leaves);
    add(geos.trunk, mats.trunk);
    add(kind === 'tree' ? geos.cone : geos.blob, leaves);
    color = leaves.color;
  } else if (kind === 'rock') { add(geos.rock, mats.rock); color = mats.rock.color; }
  else {
    for (let i = 0; i < 3; i++) {
      const m = add(geos.crystal, mats.crystal);
      m.position.set(rand(-0.2, 0.2), 0, rand(-0.2, 0.2)); m.rotation.set(rand(-0.4, 0.4), rand(0, 6), rand(-0.4, 0.4));
      m.scale.setScalar(rand(0.6, 1.1));
    }
    color = mats.crystal.color;
  }
  return { obj: g, color, kind };
}

/** Colliders by kind, in the model's frame at full size 1: [radius, bottom, top] (a capsule; a ball when equal). */
const SOLID = { tree: [0.2, 0.15, 0.85], round: [0.25, 0.15, 0.8], rock: [0.3, 0.1, 0.1], crystal: [0.18, 0.1, 0.55] };
const _a = new V(), _b = new V();

/** With physics: give d its collider where it stands, solid while it stands or grows. */
function collide(d) {
  if (!physics) return;
  if (!d.h) {
    const [r, y0, y1] = SOLID[d.kind].map((x) => x * d.full), o = { friction: 0.5, cat: CAT.prop };
    d.h = physics.body(STATIC, d.obj.position);
    if (y0 === y1) physics.sphere(d.h, r, o, _a.set(0, y0, 0));
    else physics.capsule(d.h, _a.set(0, y0, 0), _b.set(0, y1, 0), r, o);
    d.on = true;
  }
  physics.place(d.h, d.obj.position, d.obj.quaternion);
  const on = d.state === 'live' || d.state === 'growing';
  if (d.on !== on) physics.enable(d.h, d.on = on);
}

/** state: 'live' → 'dying' (shrinks) → 'dead' (hidden, waiting) → 'growing' → 'live'. */
const decor = [];
function place(d, n) {
  d.n.copy(n);
  standOn(d.obj, n, -0.06);
  d.obj.rotateY(Math.random() * Math.PI * 2);
  collide(d);
}
for (let i = 0; i < 80; i++) {
  const r = Math.random();
  const { obj, color, kind } = build(r < 0.42 ? 'tree' : r < 0.7 ? 'round' : r < 0.88 ? 'rock' : 'crystal');
  const d = { obj, color, kind, n: new V(), full: rand(0.7, 1.25), s: 0, state: 'live', timer: 0 };
  let n; do { n = randomUnit(); } while (n.y > 0.97); // keep the spawn point clear
  place(d, n); d.s = d.full; obj.scale.setScalar(d.s);
  scene.add(obj); decor.push(d);
}

/** Move any decor within `radius` m of n somewhere else, to make room for a landmark. */
export function clearDecorAround(n, radius) {
  for (const d of decor) if (chord(d.n, n) < radius) place(d, randomUnit());
}

/**
 * Spread the decor over the body Pip now stands on (after it changes size), keeping a share (0-1) of each kind,
 * such as { rock: 0.5, crystal: 1 }; kinds left out stay hidden. No share keeps everything.
 */
export function respreadDecor(share) {
  for (const d of decor) {
    if (share && Math.random() >= (share[d.kind] ?? 0)) { d.state = 'dead'; d.timer = Infinity; d.obj.visible = false; collide(d); continue; }
    d.state = 'live';
    place(d, randomUnit());
    d.s = d.full; d.obj.scale.setScalar(d.s); d.obj.visible = true;
  }
}

/** Knock down standing decor within `radius` m of n, calling onKnock(position, up) for each one. */
export function knockDecor(n, radius, onKnock) {
  for (const d of decor) if (d.state === 'live' && chord(d.n, n) < radius) {
    d.state = 'dying'; collide(d);
    burst(d.obj.position.clone().addScaledVector(d.n, 0.6), 10, d.color, 3, 0.8, 1, d.n, 0.8);
    onKnock?.(d.obj.position, d.n);
  }
}

/** Shrink fallen decor away and regrow it at least 4 m from `avoid` (Pip) and out of craters. */
export function updateDecor(dt, avoid) {
  for (const d of decor) {
    if (d.state === 'dying') { d.s -= dt * 5; if (d.s <= 0) { d.s = 0; d.state = 'dead'; d.timer = rand(6, 12); d.obj.visible = false; } }
    else if (d.state === 'dead') {
      d.timer -= dt;
      if (d.timer <= 0) {
        let n; do { n = randomUnit(); } while (chord(n, avoid) < 4 || dents.some((c) => chord(c.n, n) < 2.2)); // not in a crater
        d.state = 'growing'; place(d, n); d.obj.visible = true;
      }
    } else if (d.state === 'growing') { d.s += dt * 1.1; if (d.s >= d.full) { d.s = d.full; d.state = 'live'; } }
    else continue;
    d.obj.scale.setScalar(Math.max(0.0001, d.s));
  }
}
