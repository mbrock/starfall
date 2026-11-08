// Keyboard, mouse and touch, read into plain state that game/run.js polls every frame.
// Discrete actions (abilities, pause, menus) are wired to events in main.js.
//
// Touch: the left half of the canvas is a floating steer stick (up/down walks, left/right turns),
// the right half swipes to look. Mouse: moving turns Pip and tilts the camera; clicking locks the cursor.
import * as THREE from 'three';
import { $, coarse } from './platform.js';
import { canvas } from './engine/stage.js';
import { game } from './state.js';

const clamp = THREE.MathUtils.clamp;
const playing = () => game.phase === 'play' && !game.paused;

export const keys = new Set();
/** Turning since the last frame (dx, pixels) and the camera tilt (pitch, radians), from the mouse or a look swipe. */
export const mouse = { dx: 0, pitch: 0 };
const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, x: 0, y: 0 };
const joyEl = $('joy'), knob = joyEl.firstElementChild;

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function endJoy() {
  joy.active = false; joy.id = null; joy.x = joy.y = 0;
  joyEl.classList.add('rest'); knob.style.transform = '';
}
/** Drop every touch in progress (on pause, resize and game over). */
export function resetTouch() {
  for (const id of [joy.id, look.id]) if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  endJoy(); look.id = null;
}
/** Forget held keys, touches and pending mouse turning. */
export function releaseInput() { keys.clear(); resetTouch(); mouse.dx = 0; }

export function lockMouse() {
  if (coarse || document.pointerLockElement === canvas || !canvas.requestPointerLock) return;
  try { canvas.requestPointerLock()?.catch?.(() => {}); } catch {}
}
export function unlockMouse() { if (document.pointerLockElement) document.exitPointerLock?.(); }

const tilt = (dy) => { mouse.pitch = clamp(mouse.pitch - dy * 0.003, -0.4, 0.6); };
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousemove', (e) => {
  if (coarse || !playing()) return;
  mouse.dx += e.movementX || 0;
  tilt(e.movementY || 0);
});
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2) return; // right-click blinks; main.js handles it
  if (e.pointerType === 'mouse') { if (playing()) lockMouse(); return; }
  if (!playing()) return;
  if (e.clientX < innerWidth / 2) {
    if (joy.active) return;
    Object.assign(joy, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    joyEl.classList.remove('rest'); joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px';
    knob.style.transform = '';
  } else {
    if (look.id !== null) return;
    Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY });
  }
  canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!playing()) return;
  if (e.pointerId === look.id) {
    mouse.dx += e.clientX - look.x;
    tilt(e.clientY - look.y);
    look.x = e.clientX; look.y = e.clientY;
    return;
  }
  if (!joy.active || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
  const len = Math.hypot(dx, dy), max = 50;
  if (len > max) { dx *= max / len; dy *= max / len; }
  joy.x = dx / max; joy.y = dy / max;
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
});
const endPointer = (e) => {
  if (e.pointerId === look.id) look.id = null;
  if (e.pointerId === joy.id) endJoy();
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('lostpointercapture', endPointer);

/** Walking (fwd, -1..1) and turning (turn, -1..1, positive is left) from keys or the steer stick. */
export function readMove() {
  let fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  let turn = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  if (joy.active && Math.min(1, Math.hypot(joy.x, joy.y)) > 0.18) {
    // Up/down walks (including reverse); left/right turns without forced movement.
    turn = -joy.x;
    fwd = -joy.y;
  }
  return { fwd, turn };
}
/** Radians to turn from mouse or swipe movement since the last call. */
export function takeMouseTurn() { const t = mouse.dx * 0.0035; mouse.dx = 0; return t; }
