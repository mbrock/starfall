// Shared mutable game state. Modules import these objects and change their fields in place;
// nothing reassigns them, so every module always sees the same state.
import * as THREE from 'three';

export const game = {
  phase: 'title',   // 'title' | 'play' | 'over'
  paused: false,
  clock: 0,         // seconds of unpaused time since load; drives idle animation
  shake: 0,         // camera shake strength, decays on its own
  overReady: false, // the game-over card is showing and accepts a restart
};

/** Per-run counters. start() in game/run.js resets them. */
export const run = {
  score: 0, time: 0, combo: 1, comboT: 0, bestChain: 1, dust: 0,
  spawnT: 2, ambientT: 0.5, heartT: 20, stompT: 0,
};

/** Pip on the planet: p is the unit position, f the unit facing direction tangent to the surface. */
export const pip = {
  p: new THREE.Vector3(0, 1, 0), f: new THREE.Vector3(0, 0, 1),
  lives: 3, inv: 0, alive: true, shield: false, revived: false,
  walk: 0, moving: 0, turn: 0, scale: 1,
};

/** Ability timers by ability id (see game/abilities.js): t = seconds left active, cd = seconds until ready. */
export const timers = {};
export const active = (id) => timers[id]?.t > 0;

/** Tuned numbers for this run, derived from upgrade levels by computeStats() in game/catalog.js. */
export const stats = {};

export const shake = (amount) => { game.shake = Math.max(game.shake, amount); };
