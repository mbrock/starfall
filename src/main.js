// Starfall Keeper's entry point: wires keys and buttons to game actions and runs the frame loop.
import { $, debug, toggleFullscreen } from './platform.js';
import { camera, canvas, renderer, resizeStage, scene } from './engine/stage.js';
import { updateParticles } from './engine/particles.js';
import { audio, initAudio, setMuted } from './engine/audio.js';
import { music, setMusicEnabled, updateMusic } from './engine/music.js';
import './world/sky.js';
import { updateDecor } from './world/decor.js';
import { updateLandmarks } from './world/landmarks.js';
import { posePip } from './actors/pip.js';
import { updatePickups } from './actors/pickups.js';
import { updateMeteors } from './actors/meteors.js';
import { game, pip, run, stats, timers } from './state.js';
import { save } from './save.js';
import { mouse, resetTouch } from './input.js';
import { ABILITIES, trigger } from './game/abilities.js';
import { computeStats } from './game/catalog.js';
import { applyLook } from './game/cosmetics.js';
import { onMeteorLand, setPaused, startRun, updateDemo, updatePlay } from './game/run.js';
import { updateCamera } from './game/camera.js';
import { updateHud } from './ui/hud.js';
import { updatePopups } from './ui/popups.js';
import { closeShop, isShopOpen, openShop } from './ui/shop.js';
import { initMenus, renderMusicButton, renderSoundButton } from './ui/menus.js';

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
  const confirm = e.code === 'Enter' || e.code === 'Space';
  if (isShopOpen()) { if (e.code === 'Escape') closeShop(); }
  else if (canRestart() && confirm) startRun();
  else if (game.paused && confirm) setPaused(false);
});

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
let last = performance.now();
renderer.setAnimationLoop((now) => {
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.paused) dt = 0;
  game.clock += dt;
  if (game.phase === 'play') updatePlay(dt);
  else updateDemo(dt);
  updateMeteors(dt, onMeteorLand);
  updatePickups(dt);
  updateDecor(dt, pip.p);
  updateLandmarks(dt);
  posePip(dt);
  updateParticles(dt);
  updateCamera(dt);
  updatePopups(dt);
  updateHud();
  renderer.render(scene, camera);
});

if (debug) window.starfall = { game, run, pip, stats, timers, save, startRun, setPaused, trigger, scene, renderer };
