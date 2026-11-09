// Starfall Keeper's entry point: wires keys, buttons and the gamepad to game actions and runs the frame loop.
import { $, debug, toggleFullscreen } from './platform.js';
import { camera, canvas, renderer, resizeStage, scene } from './engine/stage.js';
import { updateParticles } from './engine/particles.js';
import { physics, physicsTiming } from './engine/physics.js';
import { audio, initAudio, setMuted } from './engine/audio.js';
import { music, setMusicEnabled, updateMusic } from './engine/music.js';
import './world/sky.js';
import { updateDecor } from './world/decor.js';
import { updateLandmarks } from './world/landmarks.js';
import { updateDents } from './world/dents.js';
import { updateGround } from './world/ground.js';
import './world/planet-sdf.js';
import { posePip } from './actors/pip.js';
import { pipBody, pipTuning, syncPip } from './actors/pip-body.js';
import { updatePickups } from './actors/pickups.js';
import { updateMeteors } from './actors/meteors.js';
import { game, pip, run, stats, timers } from './state.js';
import { save } from './save.js';
import { mouse, pad, padHeld, padPressed, pollPad, resetTouch } from './input.js';
import { ABILITIES, trigger } from './game/abilities.js';
import { computeStats } from './game/catalog.js';
import { applyLook } from './game/cosmetics.js';
import { onMeteorLand, setPaused, startRun, updateDemo, updatePlay } from './game/run.js';
import { updateCamera } from './game/camera.js';
import { travelAction, travelling, updateTravel } from './game/travel.js';
import { labelControls, updateHud } from './ui/hud.js';
import { updatePopups } from './ui/popups.js';
import { closeShop, isShopOpen, openShop } from './ui/shop.js';
import { initMenus, moveFocus, renderMusicButton, renderSoundButton, showControllerHelp } from './ui/menus.js';

computeStats();
applyLook();
initMenus();

const playing = () => game.phase === 'play' && !game.paused;
const canRestart = () => game.phase === 'title' || (game.phase === 'over' && game.overReady);
function toggleSound() { setMuted(!audio.muted); renderSoundButton(); }

// ---------- keyboard ----------
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'KeyF' && !e.repeat) toggleFullscreen();
  if (e.code === 'KeyB' && game.phase !== 'play' && !$('overlay').hidden) { openShop(); return; }
  if (game.phase === 'play' && e.code === 'KeyP') setPaused(!game.paused);
  if (game.phase === 'play' && e.code === 'Escape') setPaused(true);
  if (playing()) for (const ab of ABILITIES) if (ab.keys?.includes(e.code)) trigger(ab.id);
  if (playing() && e.code === 'KeyJ') travelAction();
  const confirm = e.code === 'Enter' || e.code === 'Space';
  if (isShopOpen()) { if (e.code === 'Escape') closeShop(); }
  else if (canRestart() && confirm) startRun();
  else if (game.paused && confirm) setPaused(false);
});

// ---------- gamepad ----------
// In play: ability buttons from the ABILITIES table, RB launches (travel, like J), Menu pauses. On a card (title,
// game over, shop, pause): the D-pad or left stick moves focus between buttons, A presses the focused one, B closes
// the shop or resumes. Disconnecting the controller mid-run pauses.
let menuDir = 0, menuRepeatAt = 0;
function handlePad(dt) {
  if (pollPad(dt)) {
    labelControls(pad.connected);
    showControllerHelp(pad.connected);
    if (!pad.connected && playing()) setPaused(true);
  }
  if (!pad.connected) return;
  if (pad.down.some((d, i) => d && !pad.was[i])) { initAudio(); updateMusic(); }
  const card = isShopOpen() ? $('shop') : game.paused ? $('pause') : !$('overlay').hidden ? $('overlay') : null;
  if (!card) {
    menuDir = 0;
    if (!playing()) return;
    if (padPressed('Menu')) { setPaused(true); return; }
    for (const ab of ABILITIES) if (ab.pad && padPressed(ab.pad)) trigger(ab.id);
    if (padPressed('RB')) travelAction();
    return;
  }
  const [x, y] = pad.axes;
  const dir = padHeld('Up') || padHeld('Left') || y < -0.6 || x < -0.6 ? -1
    : padHeld('Down') || padHeld('Right') || y > 0.6 || x > 0.6 ? 1 : 0;
  const now = performance.now();
  if (dir && (dir !== menuDir || now >= menuRepeatAt)) {
    moveFocus(card, dir);
    menuRepeatAt = now + (dir === menuDir ? 160 : 400); // a held direction repeats after a pause
  }
  menuDir = dir;
  if (padPressed('B') && isShopOpen()) closeShop();
  else if ((padPressed('B') || padPressed('Menu')) && game.paused) setPaused(false);
  else if (padPressed('A') && (game.phase !== 'over' || game.overReady)) {
    const focused = card.contains(document.activeElement) && document.activeElement.matches('button:not(:disabled)');
    (focused ? document.activeElement : game.paused ? $('resume') : isShopOpen() ? $('closeshop') : $('start')).click();
  }
}

// ---------- buttons and touch ----------
$('start').addEventListener('click', startRun);
$('resume').addEventListener('click', () => setPaused(false));
$('mute').addEventListener('click', toggleSound);
$('pausebtn').addEventListener('click', () => setPaused(true));
$('musicbtn').addEventListener('click', () => {
  // The first tap only starts the (already enabled) music; later taps toggle it.
  const wasSilent = !audio.ctx || !music.active;
  initAudio();
  setMusicEnabled(wasSilent && music.enabled ? true : !music.enabled);
  renderMusicButton();
});
for (const ab of ABILITIES) {
  if (!ab.button) continue;
  const b = $(ab.button);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); trigger(ab.id); });
  b.addEventListener('click', (e) => { if (e.detail === 0) trigger(ab.id); }); // keyboard activation
}
$('jetbtn').addEventListener('pointerdown', (e) => { e.preventDefault(); travelAction(); });
canvas.addEventListener('pointerdown', (e) => { if (e.button === 2) { e.preventDefault(); trigger('blink'); } });

// Browsers only allow sound after a user gesture.
const unlockAudio = (e) => {
  if (e.target?.closest?.('#musicbtn')) return;
  initAudio(); updateMusic();
};
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);

// ---------- pause when the player looks away ----------
addEventListener('blur', () => { if (game.phase === 'play') setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && game.phase === 'play') setPaused(true); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && playing()) setPaused(true);
});

function resize() { resetTouch(); mouse.dx = 0; resizeStage(); }
addEventListener('resize', resize);
resize();

// ---------- frame loop ----------
function frame(dt) {
  if (game.paused) dt = 0;
  game.clock += dt;
  if (game.phase === 'play') updatePlay(dt);
  else updateDemo(dt);
  if (physics && dt > 0) { updateGround(travelling()); physics.step(dt); syncPip(); } // null with ?physics=off
  updateMeteors(dt, onMeteorLand);
  updatePickups(dt);
  updateDecor(dt, pip.p);
  updateLandmarks(dt);
  updateDents(dt);
  posePip(dt);
  updateTravel(dt); // flights between worlds (only with ?travel=...)
  updateParticles(dt);
  updateCamera(dt);
  updatePopups(dt);
  updateHud();
  renderer.render(scene, camera);
}
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  handlePad(dt);
  frame(dt);
});

// step(dt) stops the real-time loop and advances exactly one frame, for recording smooth clips in slow browsers.
const step = (dt = 1 / 60) => { renderer.setAnimationLoop(null); frame(dt); };
if (debug) window.starfall = { game, run, pip, stats, timers, save, startRun, setPaused, trigger, scene, renderer, step, physics: physics && { timing: physicsTiming, pipBody, pipTuning } };
