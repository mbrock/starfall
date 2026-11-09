// Flying between worlds (game/travel.js): leaving the ground, flying through space with the world re-centered on
// whichever body is nearest, and landing with a welcome.
//
// The body Pip is nearest always sits at the origin, so landing and everything after it use the normal
// surface code. recenter() moves the origin to another body mid-flight; it shifts the camera and particles
// itself, and game/travel.js shifts its own objects in onShift(offset).
import * as THREE from 'three';
import { $ } from '../platform.js';
import { COLORS } from '../engine/materials.js';
import { burst, shiftParticles } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { V, pointNear, surfR, terrainAt } from '../sphere.js';
import { pip, run, shake, stats, timers } from '../state.js';
import { BODIES, HOME, here, offsetOf, setBody } from '../world/bodies.js';
import { player } from '../actors/pip.js';
import { clearCraters, clearMeteors } from '../actors/meteors.js';
import { clearPickups, spawnPickup } from '../actors/pickups.js';
import { hideBuddies } from '../actors/buddies.js';
import { camRig, shiftCamera } from './camera.js';
import { popup } from '../ui/popups.js';

export const trip = { on: false, from: HOME, visited: new Set() };

/** Leave the ground: clear the sky and the ground, and hand the camera to game/travel.js. */
export function beginTrip() {
  trip.on = true; trip.from = here.body;
  clearMeteors(); clearCraters(); clearPickups(); hideBuddies();
  pip.moving = 0; pip.turn = 0; pip.inv = 99;
  if (timers.giant) timers.giant.t = 0;
  camRig.on = true; camRig.rate = 3;
}

const _m = new THREE.Matrix4(), _r = new V(), _u = new V();
/** Pose Pip in space at pos, facing fwd with his head toward up. */
export function posePlayer(pos, fwd, up, visible = true) {
  _u.copy(up).addScaledVector(fwd, -up.dot(fwd)).normalize();
  _r.crossVectors(_u, fwd);
  _m.makeBasis(_r, _u, fwd);
  player.quaternion.setFromRotationMatrix(_m);
  player.position.copy(pos);
  player.scale.setScalar(1);
  player.visible = visible;
}

/** Ease the camera toward a spot `back` m behind and `lift` m above pos, looking `ahead` m in front of it. */
export function chase(pos, fwd, up, back, lift, ahead, rate = 4) {
  camRig.pos.copy(pos).addScaledVector(fwd, -back).addScaledVector(up, lift);
  camRig.look.copy(pos).addScaledVector(fwd, ahead);
  camRig.up.copy(up);
  camRig.rate = rate;
}

/** Point on a cubic Bézier curve (out), or its direction with tangent = true. */
export function bezier(out, a, b, c, d, u, tangent = false) {
  const v = 1 - u;
  if (!tangent) return out.copy(a).multiplyScalar(v * v * v).addScaledVector(b, 3 * v * v * u).addScaledVector(c, 3 * v * u * u).addScaledVector(d, u * u * u);
  return out.copy(b).sub(a).multiplyScalar(3 * v * v).addScaledVector(_r.copy(c).sub(b), 6 * v * u).addScaledVector(_u.copy(d).sub(c), 3 * u * u).normalize();
}

/** Where a landing on body b at normal n touches the ground, in the current frame. */
export function groundPoint(b, n, out = new V(), lift = 0) {
  offsetOf(b, out);
  return out.addScaledVector(n, b.radius + terrainAt(n, b.terrain) + lift);
}

const _o = new V(), _c = new V();
/** The body whose surface is nearest to pos (current frame). */
export function nearestBody(pos, skip = null) {
  let best = null, bestD = Infinity;
  for (const b of BODIES) {
    if (b === skip) continue;
    const d = offsetOf(b, _c).distanceTo(pos) - b.radius;
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

/**
 * Re-center the world on the body nearest to pos (or on `to`). Shifts pos, the camera and the particles;
 * returns the offset everything else in the frame must be moved by (pos -= offset), or null if nothing moved.
 */
export function recenter(pos, onShift, to = null) {
  const near = to ?? nearestBody(pos);
  if (near === here.body) return null;
  if (!to) {
    const dHere = pos.length() - here.body.radius, dNear = offsetOf(near, _c).distanceTo(pos) - near.radius;
    if (dNear > dHere * 0.85) return null; // a little hysteresis between two bodies
  }
  const offset = offsetOf(near, _o).clone();
  setBody(near);
  pos.sub(offset);
  shiftCamera(offset); shiftParticles(offset);
  camRig.pos.sub(offset); camRig.look.sub(offset);
  onShift?.(offset);
  return offset;
}

/** Touch down at surface normal n facing f: give the run back, welcome Pip and scatter some shards. */
export function arrive(n, f) {
  const b = here.body;
  trip.on = false; camRig.on = false;
  pip.p.copy(n).normalize();
  pip.f.copy(f).addScaledVector(pip.p, -f.dot(pip.p));
  if (pip.f.lengthSq() < 1e-4) pip.f.set(1, 0, 0).addScaledVector(pip.p, -pip.p.x);
  pip.f.normalize();
  pip.inv = 2.5; pip.moving = 0;
  run.spawnT = 2.6; run.ambientT = 1;
  const at = pip.p.clone().multiplyScalar(surfR(pip.p) + 0.3);
  sfx.touchdown(); shake(0.6);
  burst(at, 40, COLORS.dust, 4, 1.0, 1, pip.p, 1);
  burst(at, 30, COLORS.white, 5, 0.8, 0.3, pip.p, 1);
  if (b !== trip.from) {
    for (let i = 0; i < 6; i++) spawnPickup(pointNear(pip.p, 0.15, Math.min(1, 6 / b.radius)), 'shard', stats.shardLife + 4, { beacon: stats.beacons });
    if (!trip.visited.has(b.id)) {
      trip.visited.add(b.id);
      const bonus = Math.round(100 * b.mul);
      run.score += bonus;
      popup(`first landing +${bonus}`, at.clone().addScaledVector(pip.p, 1.6), 'gold');
    }
  }
  if (b === HOME) showBanner(b.name, 'Back home', 'Shards ×1');
  else showBanner(b.name, 'Welcome to', `${b.blurb} · shards ×${b.mul}`);
}

const banner = { t: 99 };
/** A big title across the middle of the screen for a few seconds. */
export function showBanner(name, eyebrow, blurb) {
  $('tb-eyebrow').textContent = eyebrow;
  $('tb-name').textContent = name;
  $('tb-blurb').textContent = blurb;
  banner.t = 0;
}
/** Fade the banner in and out on game time (so it pauses with the game). */
export function updateBanner(dt) {
  const el = $('travel-banner');
  banner.t += dt;
  const t = banner.t, a = Math.min(t / 0.4, 1, (3.6 - t) / 0.8);
  el.hidden = a <= 0;
  if (a > 0) { el.style.opacity = a; el.style.transform = `translate(-50%, ${-50 - 6 * Math.max(0, 1 - t / 0.4)}%)`; }
}

/** Put Pip back on his home planet at the start of a run. */
export function goHome() {
  trip.on = false; camRig.on = false; trip.visited.clear();
  if (here.body !== HOME) { clearCraters(); setBody(HOME); }
  banner.t = 99;
}

export const ease = (u) => u * u * (3 - 2 * u);
