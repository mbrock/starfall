// The rules of a run: starting, pausing, moving Pip, spawning meteors and shards, scoring, getting hurt
// and game over. updatePlay() runs every frame of a run; updateDemo() keeps the title screen alive.
import * as THREE from 'three';
import { COLORS } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { initAudio, sfx } from '../engine/audio.js';
import { updateMusic } from '../engine/music.js';
import { R, V, advance, chord, pointNear, rand, randomUnit, surfR } from '../sphere.js';
import { active, game, pip, run, shake, stats, timers } from '../state.js';
import { persist, save } from '../save.js';
import { abovePip, player } from '../actors/pip.js';
import { clearPickups, pickups, removePickup, spawnPickup } from '../actors/pickups.js';
import { BLAST, clearMeteors, spawnMeteor } from '../actors/meteors.js';
import { hideBuddies, resetBuddies, updateBuddies } from '../actors/buddies.js';
import { knockDecor } from '../world/decor.js';
import { lockMouse, mouse, readMove, resetTouch, releaseInput, takeMouseTurn, unlockMouse } from '../input.js';
import { computeStats } from './catalog.js';
import { resetAbilities, tickAbilities } from './abilities.js';
import { currentTrail } from './cosmetics.js';
import { camPos } from './camera.js';
import { bodyMul, meteorRate, onTravelCollect, onTravelMeteor, resetTravel, travelling, updateTravelGround } from './travel.js';
import { flashHurt, renderLives, showRunHud } from '../ui/hud.js';
import { hideTouchControls, showGameOver, showPause } from '../ui/menus.js';
import { popup } from '../ui/popups.js';

const clamp = THREE.MathUtils.clamp;
const _a = new V(), _b = new V(), _v = new V(), _r = new V(), _c = new THREE.Color();
let trail = null;

export function startRun() {
  if (game.phase === 'play') return;
  initAudio();
  clearMeteors();
  clearPickups();
  resetTravel();
  computeStats();
  resetAbilities();
  trail = currentTrail();
  const head = stats.headStart;
  Object.assign(run, { score: 0, time: 0, combo: head ? 3 : 1, comboT: head ? 8 : 0, bestChain: head ? 3 : 1, dust: 0, spawnT: 1.6, ambientT: 0.3, heartT: stats.heartEvery, stompT: 0 });
  Object.assign(pip, { lives: stats.maxLives, inv: 1.2, alive: true, shield: stats.shield, revived: false, scale: 1 });
  resetBuddies();
  game.phase = 'play';
  game.overReady = false;
  showRunHud();
  resetTouch();
  updateMusic();
  mouse.dx = 0; mouse.pitch = 0;
  lockMouse();
}

export function setPaused(on) {
  if (game.phase !== 'play') on = false;
  game.paused = on;
  showPause(on);
  mouse.dx = 0;
  if (on) { releaseInput(); unlockMouse(); }
  else lockMouse();
}

function dropPickup(n, kind, life) { spawnPickup(n, kind, life, { beacon: stats.beacons }); }

function hurt() {
  if (pip.shield) {
    pip.shield = false; pip.inv = 1.2;
    shake(0.5); sfx.pop();
    burst(player.position, 36, COLORS.mint, 5, 0.7, 0.3, pip.p, 0.6);
    popup('shield popped', abovePip(1), 'mint');
    return;
  }
  pip.lives--; pip.inv = stats.invTime;
  run.combo = Math.max(1, Math.floor(run.combo * stats.steady)); run.comboT = run.combo > 1 ? stats.comboWin : 0;
  shake(0.9); sfx.hurt();
  burst(player.position, 30, COLORS.coral, 5, 0.8, 0.8, pip.p, 0.8);
  flashHurt();
  renderLives();
  if (pip.lives > 0) return;
  if (stats.revive && !pip.revived) {
    pip.revived = true; pip.lives = 1; pip.inv = 2.5; renderLives();
    sfx.heart();
    burst(player.position, 50, COLORS.mint, 6, 1, 0.3, pip.p, 1);
    popup('second wind!', abovePip(1.1), 'mint');
  } else gameOver();
}

function gameOver() {
  game.phase = 'over'; pip.alive = false;
  unlockMouse();
  burst(player.position, 70, COLORS.white, 6, 1.2, 0.6, pip.p, 1);
  burst(player.position, 40, COLORS.coral, 4, 1.0, 0.8, pip.p, 1);
  sfx.over();
  hideTouchControls(); resetTouch();
  timers.giant.t = 0; hideBuddies();
  const isBest = run.score > save.best;
  if (isBest) save.best = run.score;
  const earned = Math.floor(run.dust) + Math.floor(run.time / 10) * stats.survivorPay + stats.runBonus;
  save.dust += earned;
  persist();
  const result = { isBest, score: run.score, time: run.time, bestChain: run.bestChain, earned };
  setTimeout(() => { showGameOver(result); game.overReady = true; updateMusic(); }, 1400);
}

/** A meteor hit the ground at n: shake the camera, and during a run hurt Pip, pay close calls and leave a shard. */
export function onMeteorLand(n) {
  const dist = chord(pip.p, n);
  shake(clamp(1 - dist / 9, 0, 1) * 0.55);
  sfx.boom(clamp(1 - dist / 14, 0.15, 1));
  if (game.phase !== 'play' || !pip.alive) return;
  const hit = dist < BLAST * 0.92;
  if (hit && active('giant')) {
    run.score += 5 * run.combo; popup('bonk! +' + 5 * run.combo, abovePip(2.2), 'gold');
    burst(abovePip(1.6), 24, COLORS.gold, 5, 0.7, 0.4, pip.p, 1);
  } else if (hit && pip.inv <= 0 && !active('dash')) hurt();
  else if (!hit && dist < BLAST + 1.1) {
    const bonus = 5 * run.combo * stats.closeMul;
    run.score += bonus;
    popup('close call +' + bonus, abovePip(0.9), 'ink');
  }
  if (onTravelMeteor(n)) return; // left a jet core instead
  if (stats.clover && pip.lives < stats.maxLives && Math.random() < 0.1) dropPickup(pointNear(n, 0, 0.05), 'heart', 9);
  else if (Math.random() < 0.8) {
    dropPickup(pointNear(n, 0, 0.05), stats.goldRush && Math.random() < 0.125 ? 'gold' : 'shard', stats.shardLife);
    if (Math.random() < stats.doubleShard) dropPickup(pointNear(n, 0.07, 0.12), 'shard', stats.shardLife);
  }
}

function collect(pk) {
  if (pk.kind === 'heart') {
    pip.lives = Math.min(stats.maxLives, pip.lives + 1); renderLives(); sfx.heart();
    popup('+1 hull', pk.g.position, 'mint');
    burst(pk.g.position, 26, COLORS.mint, 3.5, 0.8, 0.3);
  } else if (pk.kind === 'core') {
    burst(pk.g.position, 30, COLORS.mint, 4, 0.7, 0.3);
  } else {
    const gold = pk.kind === 'gold' ? 5 : 1;
    const gain = Math.round(10 * run.combo * stats.shardMul * bodyMul()) * gold;
    run.score += gain; sfx.pickup(run.combo);
    popup((gold > 1 ? 'GOLD +' : '+') + gain + (run.combo > 1 ? '  ×' + run.combo : ''), pk.g.position, 'gold');
    burst(pk.g.position, gold > 1 ? 50 : 22, COLORS.gold, gold > 1 ? 5 : 3.5, 0.7, 0.3);
    run.dust += (1 + Math.floor(run.combo / 3)) * stats.dustMul * gold * bodyMul();
    run.combo = Math.min(stats.comboMax, run.combo + 1); run.comboT = stats.comboWin;
    run.bestChain = Math.max(run.bestChain, run.combo);
  }
  onTravelCollect(pk.kind);
  removePickup(pk);
}

function movePip(dt) {
  const { fwd, turn } = readMove();
  const mouseTurn = takeMouseTurn();
  pip.turn = clamp(turn - mouseTurn / Math.max(dt, 0.001) / 4, -1, 1);
  pip.f.applyAxisAngle(pip.p, -mouseTurn);
  pip.inv = Math.max(0, pip.inv - dt);
  tickAbilities(dt);
  pip.f.applyAxisAngle(pip.p, turn * 3.0 * dt);
  let speed = fwd * (fwd < 0 ? 3.2 : stats.speed) * (active('giant') ? 1.25 : 1);
  if (active('dash')) speed = stats.speed * stats.dashSpeed;
  pip.moving = Math.min(1, Math.abs(speed) / stats.speed);
  advance(pip.p, pip.f, speed * dt);
}

function pipEffects(dt) {
  const dashing = active('dash');
  if (dashing) emit(player.position, randomUnit(_v).multiplyScalar(0.6), COLORS.white, 0.35, 0);
  if (active('giant')) {
    // heavy footsteps: dust puffs, a thud and a little shake
    run.stompT -= dt * (0.6 + pip.moving);
    if (run.stompT <= 0 && pip.moving > 0.2) {
      run.stompT = 0.38; sfx.stomp(); shake(0.12);
      burst(_b.copy(pip.p).multiplyScalar(surfR(pip.p) + 0.1), 12, COLORS.dust, 2.5, 0.6, 0.8, pip.p, 0.5);
    }
    // squash trees and rocks in the way
    knockDecor(pip.p, 1.6, (pos, up) => { run.score += 2; popup('+2', pos.clone().addScaledVector(up, 1.2), 'ink'); });
  }
  if (dashing && stats.skate) {
    // sparks off the skateboard wheels
    for (let k = 0; k < 3; k++) {
      _b.copy(player.position).addScaledVector(pip.p, -0.55).addScaledVector(pip.f, -0.35).addScaledVector(_r.crossVectors(pip.p, pip.f), rand(-0.18, 0.18));
      _v.copy(pip.f).multiplyScalar(-rand(2, 4)).addScaledVector(pip.p, rand(0.5, 2)).add(randomUnit(_a).multiplyScalar(0.8));
      emit(_b, _v, Math.random() < 0.6 ? COLORS.gold : COLORS.ember, rand(0.25, 0.5), 1.5);
    }
  }
  if (trail && pip.moving > 0.2 && Math.random() < 0.75) {
    trail.particle(_c, game.clock);
    _v.copy(pip.p).multiplyScalar(rand(0.2, 0.8)).addScaledVector(pip.f, -1.2).add(randomUnit(_a).multiplyScalar(0.3));
    _b.copy(player.position).addScaledVector(pip.p, -0.2).add(randomUnit(_a).multiplyScalar(0.15));
    emit(_b, _v, _c, rand(0.5, 0.9), trail.gravity);
  }
}

function spawnThings(dt) {
  // meteors come faster and fall faster the longer the run lasts
  run.spawnT -= dt;
  if (run.spawnT <= 0) {
    const interval = Math.max(0.4, 1.45 - run.time * 0.0135) / meteorRate();
    const fall = Math.max(1.1, 1.9 - run.time * 0.0075) * stats.fallMul;
    run.spawnT = interval * rand(0.7, 1.3);
    const r = Math.random();
    if (run.time > 45 && r < 0.2) {
      const c = pointNear(pip.p, 0.15, 0.6); // a cluster of three
      for (let i = 0; i < 3; i++) spawnMeteor(pointNear(c, 0.12, 0.28), fall + i * 0.15);
    } else if (r < 0.58) {
      // aim where Pip is heading
      const lead = clamp(pip.moving * stats.speed * fall * 0.55 / R, 0, 0.8);
      _b.copy(pip.p).multiplyScalar(Math.cos(lead)).addScaledVector(pip.f, Math.sin(lead)).normalize();
      spawnMeteor(pointNear(_b, 0, 0.16), fall);
    } else spawnMeteor(pointNear(pip.p, 0.2, 1.0), fall);
  }
  // a shard or two floating around even when nothing has landed; giants find them 50% faster
  const giant = active('giant');
  run.ambientT -= dt * (giant ? 1.5 : 1);
  if (run.ambientT <= 0) {
    run.ambientT = 3.2;
    if (pickups.filter((p) => p.kind === 'shard').length < (giant ? 3 : 2)) dropPickup(pointNear(pip.p, 0.35, 1.1), 'shard', stats.shardLife);
  }
  run.heartT -= dt;
  if (run.heartT <= 0) { run.heartT = stats.heartEvery; if (pip.lives < stats.maxLives) dropPickup(pointNear(pip.p, 0.5, 1.2), 'heart', 9); }
}

function collectNearby(dt) {
  const reach = stats.reach * (active('giant') ? 2.4 : 1), pull = stats.magnetPull;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    const d = chord(pip.p, pk.n);
    if (pull && d < reach * 2.6 && pk.age > 0.3) pk.n.lerp(pip.p, Math.min(1, dt * 1.2 * pull)).normalize();
    if (pk.age >= 0.15 && d <= reach) collect(pk);
  }
}

export function updatePlay(dt) {
  run.time += dt;
  if (travelling()) return; // in flight between worlds: game/travel.js flies Pip
  movePip(dt);
  pipEffects(dt);
  spawnThings(dt);
  run.comboT -= dt;
  if (run.comboT <= 0) run.combo = 1;
  collectNearby(dt);
  updateBuddies(dt, collect);
  updateTravelGround(dt);
}

/** Title and game-over screens: harmless meteors near the camera for atmosphere. */
export function updateDemo(dt) {
  pip.moving = 0; pip.turn = 0;
  run.spawnT -= dt;
  if (run.spawnT <= 0) { run.spawnT = rand(0.8, 1.6); spawnMeteor(pointNear(camPos.clone().normalize(), 0.2, 0.9), 1.8); }
}
