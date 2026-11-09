// Pip as a Box3D body (only with ?physics=box3d): a ball that floats on a spring (the pogo joint) at his usual
// height over the ground, steered by a mover joint. Speed builds up and bleeds off the way it does in Quake:
// friction on the ground, a little steering in the air. Meteor blasts knock him around; trees, rocks, landmarks
// and meteor rocks block him. game/run.js says where he wants to go; posePip() draws him where the body is.
import { CAT, DYNAMIC, GRAVITY, LOCK_ROTATION, NO_SLEEP, physics } from '../engine/physics.js';
import { V, groundVersion, surfR } from '../sphere.js';
import { pip } from '../state.js';

/** Feel of the movement; ?debug exposes it as starfall.pipTuning to try numbers live. */
export const pipTuning = {
  friction: 7,      // 1/s: how fast speed bleeds off on the ground
  stopSpeed: 2.5,   // m/s: below this, friction removes a fixed amount instead of a share
  accelerate: 9,    // how quickly he reaches the speed he wants, in top speeds per second
  airSteer: 0.25,   // share of that he has in the air
  groundForce: 90,  // m/s² the mover joint may use on the ground, and in the air
  airForce: 12,
  hertz: 5.5, damping: 0.85, // the spring holding him off the ground
  knock: 1,         // scales meteor knockback
};

/** Where Pip's center is and how fast he moves, after the last step. */
export const pipBody = { pos: new V(0, 11, 0), vel: new V(), speed: 0, grounded: false };

const BODY_R = 0.32;
let h = 0, shape = 0, mass = 1, shapeScale = 1, parked = false, placedOn = -1;
let jumping = false, jumpTicks = 0;
const _up = new V(), _v = new V(), _w = new V(), _n = new V();

/** Height of Pip's center over the ground: his radius, plus the skateboard if he rides it. */
export const restHeight = (board) => (0.42 + (board ? 0.14 : 0)) * pip.scale;

function create() {
  h = physics.body(DYNAMIC, pipBody.pos, { gravity: 1, flags: LOCK_ROTATION | NO_SLEEP });
  shape = physics.sphere(h, BODY_R, { density: 120, friction: 0, restitution: 0, cat: CAT.pip, mask: CAT.ground | CAT.prop | CAT.debris });
  mass = physics.mass(h);
  physics.moverCreate(h);
}

/** Put Pip's body on the ground at pip.p, standing still. */
export function placePipBody(board = false) {
  if (!physics) return;
  if (!h) create();
  pipBody.pos.copy(pip.p).multiplyScalar(surfR(pip.p) + restHeight(board));
  physics.place(h, pipBody.pos);
  physics.setVelocity(h, _v.set(0, 0, 0));
  if (parked) { physics.enable(h, true); parked = false; }
  jumping = false; placedOn = groundVersion;
}

/** Take Pip's body out of the world while he flies between worlds; drivePip puts it back. */
export function parkPipBody() {
  if (!h || parked) return;
  physics.enable(h, false); parked = true;
}

/** Throw Pip off the ground with velocity change dv (m/s); the spring lets go until he comes back down. */
export function knockPip(dv) {
  if (!h || parked) return;
  physics.impulse(h, _v.copy(dv).multiplyScalar(mass * pipTuning.knock));
  pipBody.vel.addScaledVector(dv, pipTuning.knock); // so the next drivePip steers from the new velocity
  pipBody.grounded = false; jumping = true; jumpTicks = 0;
}

/**
 * Before the physics step: steer Pip toward `speed` m/s along unit tangent dir (speed 0: stop). accel scales how
 * hard he pushes (dashes push harder). board: he rides the skateboard, a little higher.
 */
export function drivePip(dt, dir, speed, accel = 1, board = false) {
  if (!h || parked || placedOn !== groundVersion) placePipBody(board);
  const t = pipTuning;
  if (Math.abs(pip.scale - shapeScale) > 0.01) { shapeScale = pip.scale; physics.setSphere(shape, BODY_R * shapeScale); }
  _up.copy(pipBody.pos).normalize();
  // velocity along the ground
  _v.copy(pipBody.vel).addScaledVector(_up, -pipBody.vel.dot(_up));
  if (pipBody.grounded) {
    const s = _v.length();
    if (s < 0.1) _v.set(0, 0, 0);
    else _v.multiplyScalar(Math.max(0, s - Math.max(s, t.stopSpeed) * t.friction * dt) / s);
  }
  if (speed > 0) {
    const before = _v.length(), add = speed - _v.dot(dir);
    if (add > 0) _v.addScaledVector(dir, Math.min(add, (pipBody.grounded ? 1 : t.airSteer) * t.accelerate * accel * speed * dt));
    if (_v.length() > Math.max(speed, before)) _v.setLength(Math.max(speed, before)); // turning never adds speed
  }
  const rest = restHeight(board), weight = mass * GRAVITY * pip.scale ** 0.5;
  const force = mass * (pipBody.grounded ? t.groundForce : t.airForce) * accel;
  const ground = physics.moverUpdate(_up, pipBody.grounded ? rest * 2 : rest, rest, t.hertz, t.damping,
    jumping ? 0 : 60 * weight, 60 * weight, _v, force, 0.5, CAT.ground | CAT.prop, _n);
  if (jumping && ++jumpTicks > 2 && ground && pipBody.vel.dot(_n) <= 0) jumping = false;
  pipBody.grounded = !!ground && !jumping;
}

/** After the physics step: read the body into pip.p (keeping pip.f along the ground) and pipBody. */
export function syncPip() {
  if (!h || parked) return;
  physics.read(h, pipBody.pos, null, pipBody.vel);
  if (!Number.isFinite(pipBody.pos.x)) { placePipBody(); return; } // never seen, but don't let a NaN loose
  pip.p.copy(pipBody.pos).normalize();
  pip.f.addScaledVector(pip.p, -pip.f.dot(pip.p));
  if (pip.f.lengthSq() < 1e-8) pip.f.set(1, 0, 0).addScaledVector(pip.p, -pip.p.x);
  pip.f.normalize();
  _w.copy(pipBody.vel).addScaledVector(pip.p, -pipBody.vel.dot(pip.p));
  pipBody.speed = _w.length();
}
