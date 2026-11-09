// Abilities Pip triggers with a key, a controller button or a touch button. Each entry is everything about one ability:
// controls, HUD elements, whether the player has it, how long it lasts and recharges, and what it does.
// Timers live in state.js (timers[id] = { t, cd }); active(id) is true while one is running.
// To add an ability: add an entry here and its HUD meter / touch button in index.html.
//
// Fields: keys (KeyboardEvent.code list), pad (controller button name, see PAD in input.js), button (touch button id),
// hud + meter (desktop HUD pill and its fill; the pill's <kbd> shows the key or controller button), drains (meter
// shows time left while active), timer (share another ability's timer), owned(), duration(), cooldown(), use() (runs
// after the timer starts), end() (runs when the active time runs out).
import { COLORS } from '../engine/materials.js';
import { burst, emit } from '../engine/particles.js';
import { sfx } from '../engine/audio.js';
import { V, advance, rand, randomUnit } from '../sphere.js';
import { game, pip, run, shake, stats, timers } from '../state.js';
import { abovePip, board, player, posePip } from '../actors/pip.js';
import { placePipBody } from '../actors/pip-body.js';
import { clearMeteors, meteors } from '../actors/meteors.js';
import { popup } from '../ui/popups.js';

const _b = new V(), _v = new V();

export const ABILITIES = [
  {
    id: 'dash', keys: ['Space', 'ShiftLeft', 'ShiftRight'], pad: 'A', button: 'dashbtn', meter: 'dashfill',
    owned: () => true, duration: () => stats.dashT, cooldown: () => stats.dashCD,
    // Pip can't be hit mid-dash; game/run.js reads active('dash') for speed and safety.
    use() { sfx.dash(); burst(player.position, 14, COLORS.white, 2.5, 0.5, 0.2); },
  },
  {
    // Right-click: jump instantly in the direction Pip is facing. Shares the dash recharge.
    id: 'blink', timer: 'dash', pad: 'B', button: 'blinkbtn',
    owned: () => true, duration: () => 0.12 /* a moment of safety on arrival */, cooldown: () => stats.dashCD,
    use() {
      const from = player.position.clone();
      burst(from, 24, COLORS.white, 3, 0.5, 0.2);
      advance(pip.p, pip.f, stats.blinkDist);
      placePipBody(board.visible); // with physics: arrive standing still
      posePip(0);
      const to = player.position;
      for (let i = 0; i <= 14; i++) emit(_b.copy(from).lerp(to, i / 14), randomUnit(_v).multiplyScalar(0.4), COLORS.mint, rand(0.3, 0.6), 0);
      burst(to, 30, COLORS.mint, 3.5, 0.6, 0.2, pip.p, 0.5);
      sfx.blink();
    },
  },
  {
    // Meteors fall at 30% speed while active (actors/meteors.js).
    id: 'drift', keys: ['KeyQ'], pad: 'LB', button: 'driftbtn', hud: 'ab-drift', meter: 'driftfill', drains: true,
    owned: () => stats.drift, duration: () => 4, cooldown: () => 25 * stats.abCD,
    use() { sfx.drift(); popup('time drift', abovePip(1), 'mint'); },
  },
  {
    id: 'burst', keys: ['KeyE'], pad: 'X', button: 'burstbtn', hud: 'ab-burst', meter: 'burstfill',
    owned: () => stats.burst, cooldown: () => 35 * stats.abCD,
    use() {
      sfx.burst(); shake(0.35);
      for (const m of meteors) {
        burst(m.mesh.position, 26, COLORS.gold, 6, 0.9, 0.2);
        burst(m.mesh.position, 16, COLORS.ember, 4, 0.8, 0.2);
      }
      const n = meteors.length;
      clearMeteors();
      burst(player.position, 40, COLORS.gold, 8, 0.8, 0.1, pip.p, 0.5);
      if (n) { run.score += 3 * n; popup(`star burst +${3 * n}`, abovePip(1.1), 'gold'); }
    },
  },
  {
    // While active: meteors bounce off, decor gets stomped, reach and ambient shards go up (game/run.js), Pip grows (actors/pip.js).
    id: 'giant', keys: ['KeyG'], pad: 'Y', button: 'giantbtn', hud: 'ab-giant', meter: 'giantfill', drains: true,
    owned: () => stats.giant, duration: () => stats.giantTime, cooldown: () => 30 * stats.abCD,
    use() {
      run.stompT = 0; sfx.giant(); shake(0.4);
      burst(player.position, 50, COLORS.gold, 6, 0.9, 0.3, pip.p, 1);
      burst(player.position, 30, COLORS.white, 4, 0.7, 0.3, pip.p, 1);
      popup('GIANT PIP!', abovePip(2), 'gold');
    },
    end() {
      pip.inv = Math.max(pip.inv, 1); sfx.shrink();
      burst(player.position, 30, COLORS.white, 3, 0.6, 0.3, pip.p, 0.6);
    },
  },
];

const byId = Object.fromEntries(ABILITIES.map((ab) => [ab.id, ab]));
export const timerOf = (ab) => timers[ab.timer ?? ab.id];

export function resetAbilities() {
  for (const ab of ABILITIES) if (!ab.timer) timers[ab.id] = { t: 0, cd: 0 };
}
resetAbilities();

/** Use an ability if a run is on and it is owned and recharged. */
export function trigger(id) {
  const ab = byId[id], tm = timerOf(ab);
  if (game.phase !== 'play' || game.paused || !pip.alive || !ab.owned() || tm.cd > 0) return;
  tm.t = ab.duration?.() ?? 0;
  tm.cd = ab.cooldown();
  ab.use();
}

export function tickAbilities(dt) {
  for (const ab of ABILITIES) {
    if (ab.timer) continue;
    const tm = timers[ab.id];
    tm.cd = Math.max(0, tm.cd - dt);
    if (tm.t > 0) { tm.t = Math.max(0, tm.t - dt); if (tm.t === 0) ab.end?.(); }
  }
}
