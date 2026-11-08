// The camera rig: a slow orbit on the title and game-over screens, otherwise a chase camera behind Pip.
// The sun follows over the camera's shoulder so the visible side of the planet is always lit.
import { camera, hemi, sun } from '../engine/stage.js';
import { R, UP, V, randomUnit } from '../sphere.js';
import { game, pip } from '../state.js';
import { GIANT_SCALE } from '../actors/pip.js';
import { updateHalo } from '../world/planet.js';
import { mouse } from '../input.js';

export const camPos = new V(0, 14, 34);
const camLook = new V(), camUp = new V(0, 1, 0);
const _a = new V(), _b = new V(), _d = new V();

export function updateCamera(dt) {
  const k = 1 - Math.exp(-4.5 * dt), t = game.clock, over = game.phase === 'over';
  if (game.phase === 'title' || (over && game.overReady)) {
    const a = t * 0.12;
    _a.set(Math.sin(a) * 30, 9 + Math.sin(t * 0.2) * 3, Math.cos(a) * 30);
    camPos.lerp(_a, k * 0.5); camLook.lerp(_b.set(0, 0, 0), k * 0.5); camUp.lerp(UP, k).normalize();
  } else {
    const pitch = over ? 0 : mouse.pitch;
    const gz = (pip.scale - 1) / (GIANT_SCALE - 1); // pull back while giant
    const back = over ? 13 : 8.5 - pitch * 2 + gz * 6, up = over ? 10 : 6.4 - pitch * 5 + gz * 5;
    _a.copy(pip.p).multiplyScalar(R + up).addScaledVector(pip.f, -back);
    _b.copy(pip.p).multiplyScalar(R + 0.6 + pitch * 1.5).addScaledVector(pip.f, 3.5 + pitch * 7);
    camPos.lerp(_a, k); camLook.lerp(_b, k * 1.3); camUp.lerp(pip.p, k).normalize();
  }
  camera.position.copy(camPos);
  if (game.shake > 0) {
    camera.position.add(randomUnit(_d).multiplyScalar(game.shake * 0.6));
    game.shake = Math.max(0, game.shake - dt * 1.8);
  }
  camera.up.copy(camUp);
  camera.lookAt(camLook);
  camera.updateMatrixWorld();

  const right = _d.setFromMatrixColumn(camera.matrixWorld, 0);
  _a.copy(camPos).normalize().addScaledVector(right, 0.7).addScaledVector(camera.up, 0.6).normalize();
  sun.position.copy(_a).multiplyScalar(45);
  hemi.position.copy(camPos).normalize();
  updateHalo(camPos);
}
