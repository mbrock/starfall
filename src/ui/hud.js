// The in-run HUD: score, combo, time, hull, stardust, ability meters and the touch buttons' recharge labels.
import { $, coarse } from '../platform.js';
import { game, pip, run, stats } from '../state.js';
import { ABILITIES, timerOf } from '../game/abilities.js';

export function fmtTime(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

/** Swap the menus for the HUD and show only the abilities this run has. */
export function showRunHud() {
  $('overlay').hidden = true;
  $('shop').hidden = true;
  $('hud').hidden = false;
  $('touch-controls').hidden = !coarse;
  for (const ab of ABILITIES) {
    if (ab.hud) $(ab.hud).hidden = !ab.owned();
    if (ab.button) $(ab.button).hidden = !(coarse && ab.owned());
  }
  renderLives();
}

export function renderLives() {
  const box = $('lives');
  if (box.children.length !== stats.maxLives) box.innerHTML = '<span></span>'.repeat(stats.maxLives);
  [...box.children].forEach((s, i) => s.classList.toggle('off', i >= pip.lives));
}

export function flashHurt() {
  const fl = $('flash');
  fl.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove('on')));
}

let lastText = '';
export function updateHud() {
  if (game.phase !== 'play') return;
  const text = `${run.score}|${run.combo}|${Math.floor(run.time)}`;
  if (text !== lastText) {
    lastText = text;
    $('score').textContent = run.score;
    $('combo').textContent = '×' + run.combo;
    $('time').textContent = fmtTime(run.time);
  }
  $('combobar').style.width = (run.combo > 1 ? Math.min(1, Math.max(0, run.comboT / stats.comboWin)) * 100 : 0) + '%';
  $('dusthud').textContent = Math.floor(run.dust) + ' stardust';
  for (const ab of ABILITIES) {
    if (!ab.owned()) continue;
    const { t, cd } = timerOf(ab);
    if (ab.meter) {
      const f = $(ab.meter);
      f.style.width = 100 * (ab.drains && t > 0 ? t / ab.duration() : 1 - cd / ab.cooldown()) + '%';
      f.classList.toggle('ready', cd <= 0);
    }
    if (coarse && ab.button) {
      const b = $(ab.button), label = cd > 0 ? `${Math.ceil(cd)}s` : 'Ready';
      if (b.lastElementChild.textContent !== label) b.lastElementChild.textContent = label;
      b.classList.toggle('cool', cd > 0);
      b.setAttribute('aria-disabled', String(cd > 0));
    }
  }
}
