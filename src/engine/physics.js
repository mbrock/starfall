// The Box3D physics engine (Erin Catto's, compiled to WebAssembly in vendor/box3d). With ?physics=off `physics`
// is null and nothing here loads. Bodies are small integer handles; positions and
// vectors go in and out as THREE.Vector3s. Gravity pulls toward the origin, where the body Pip stands on sits.
import * as THREE from 'three';
import { physicsMode } from '../platform.js';

/** m/s² toward the planet's center. */
export const GRAVITY = 20;
/** Collision categories: each shape is one of these and lists the ones it collides with. */
export const CAT = { ground: 1, prop: 2, pip: 4, loose: 8, debris: 16 };
export const STATIC = 0, KINEMATIC = 1, DYNAMIC = 2;
/** Body flags for body(). */
export const LOCK_ROTATION = 1, BULLET = 2, NO_SLEEP = 4;

const m = physicsMode ? await (await import('../../vendor/box3d/box3d.js')).default() : null;
m?._sf_init(GRAVITY);

let view = null;
/** The binding's result buffer (sf_scratch); the view is remade when memory grows. */
function out() {
  if (!view || view.buffer !== m.HEAPF32.buffer) view = new Float32Array(m.HEAPF32.buffer, m._sf_scratch(), 32);
  return view;
}
// A reusable block of wasm memory for passing arrays in.
let heap = 0, heapBytes = 0;
function scratchBytes(bytes) {
  if (bytes > heapBytes) { if (heap) m._free(heap); heapBytes = Math.max(bytes, heapBytes * 2, 65536); heap = m._malloc(heapBytes); }
  return heap;
}

const shapeArgs = (o) => [o.density ?? 1, o.friction ?? 0.6, o.restitution ?? 0, o.cat ?? CAT.loose, o.mask ?? ~0];
const hulls = new Map();

/** For ?debug: ms per step (a running average), and total ms and count of ground patch rebuilds. */
export const physicsTiming = { step: 0, ground: 0, groundBuilds: 0 };

export const physics = m && {
  /** A body of `type` (STATIC, KINEMATIC, DYNAMIC) at pos; gravity scales the pull toward the center. */
  body(type, pos, { gravity = 1, linearDamping = 0, angularDamping = 0, flags = 0 } = {}) {
    return m._sf_body(type, pos.x, pos.y, pos.z, gravity, linearDamping, angularDamping, flags);
  },
  destroy(h) { m._sf_destroy(h); },
  enable(h, on) { m._sf_enable(h, on ? 1 : 0); },
  /** Shapes. o: { density, friction, restitution, rolling, cat, mask }. Each returns a shape handle. */
  sphere(h, r, o = {}, c = null) {
    const [d, f, e, cat, mask] = shapeArgs(o);
    return m._sf_sphere(h, c?.x ?? 0, c?.y ?? 0, c?.z ?? 0, r, d, f, e, o.rolling ?? 0, cat, mask);
  },
  capsule(h, a, b, r, o = {}) { return m._sf_capsule(h, a.x, a.y, a.z, b.x, b.y, b.z, r, ...shapeArgs(o)); },
  /** A convex hull of points (Vector3s), made once per key. */
  hullOf(key, points) {
    if (!hulls.has(key)) {
      const p = scratchBytes(points.length * 12), F = m.HEAPF32;
      points.forEach((v, i) => { F[p / 4 + i * 3] = v.x; F[p / 4 + i * 3 + 1] = v.y; F[p / 4 + i * 3 + 2] = v.z; });
      hulls.set(key, m._sf_make_hull(p, points.length));
    }
    return hulls.get(key);
  },
  /** An upright cylinder hull standing on y = 0. */
  cylinderOf(height, radius) {
    const key = `cyl:${height.toFixed(2)}:${radius.toFixed(2)}`;
    if (!hulls.has(key)) hulls.set(key, m._sf_make_cylinder(height, radius, 12));
    return hulls.get(key);
  },
  hull(h, hull, scale = 1, o = {}) { return m._sf_hull(h, hull, scale, ...shapeArgs(o)); },
  setSphere(s, r, c = null) { m._sf_set_sphere(s, c?.x ?? 0, c?.y ?? 0, c?.z ?? 0, r); },

  /** Read a body: position into pos, and optionally rotation into quat and velocity into vel. Returns whether it is awake. */
  read(h, pos, quat = null, vel = null) {
    m._sf_read(h);
    const o = out();
    pos?.set(o[0], o[1], o[2]);
    quat?.set(o[3], o[4], o[5], o[6]);
    vel?.set(o[7], o[8], o[9]);
    return o[13] > 0;
  },
  place(h, pos, quat = null) { m._sf_set_transform(h, pos.x, pos.y, pos.z, quat?.x ?? 0, quat?.y ?? 0, quat?.z ?? 0, quat?.w ?? 1); },
  setVelocity(h, v, w = null) { m._sf_set_velocity(h, v.x, v.y, v.z, w?.x ?? 0, w?.y ?? 0, w?.z ?? 0); },
  impulse(h, v) { m._sf_impulse(h, v.x, v.y, v.z); },
  force(h, v) { m._sf_force(h, v.x, v.y, v.z); },
  mass(h) { return m._sf_mass(h); },
  /** Push dynamic bodies in mask away from at: full strength within radius, fading out over falloff more meters. */
  explode(at, radius, falloff, impulsePerArea, mask) { m._sf_explode(at.x, at.y, at.z, radius, falloff, impulsePerArea, mask); },

  step(dt) {
    const t = performance.now();
    m._sf_step(dt, 4);
    physicsTiming.step = physicsTiming.step * 0.95 + (performance.now() - t) * 0.05;
  },

  /** Set ground patch i to a triangle mesh: verts (xyz Float32Array) and counter-clockwise triangles (Int32Array). */
  groundPatch(i, verts, tris) {
    const t = performance.now();
    const p = scratchBytes(verts.length * 4 + tris.length * 4);
    m.HEAPF32.set(verts, p / 4);
    m.HEAP32.set(tris, p / 4 + verts.length);
    m._sf_ground_chunk(i, p, verts.length / 3, p + verts.length * 4, tris.length / 3, 0.8, CAT.ground);
    physicsTiming.ground += performance.now() - t; physicsTiming.groundBuilds++;
  },
  clearGround() { m._sf_ground_clear(); },

  /** Make body h the character mover (one at a time); see moverUpdate. */
  moverCreate(h) { m._sf_mover_create(h); },
  /**
   * Before each step: cast down from the mover along -up for rayLength m and hold it restLength above ground it hits
   * with a spring (hertz, damping, at most tension N pulling down and compression N pushing up); drive its velocity
   * in the plane under up toward want with at most force N. Returns the ground's normal (into normal) or null.
   */
  moverUpdate(up, rayLength, restLength, hertz, damping, tension, compression, want, force, minUp, mask, normal) {
    const hit = m._sf_mover_update(up.x, up.y, up.z, rayLength, restLength, hertz, damping, tension, compression, want.x, want.y, want.z, force, minUp, mask);
    if (!hit) return null;
    const o = out();
    return normal.set(o[3], o[4], o[5]);
  },
};

/** Copy a dynamic body's pose onto a three.js object. */
const _q = new THREE.Quaternion();
export function poseFromBody(h, obj) { physics.read(h, obj.position, _q); obj.quaternion.copy(_q); }
