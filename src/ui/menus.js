// The title / game-over card and the pause card. Rendering only; main.js wires their buttons.
import { $, coarse } from '../platform.js';
import { audio } from '../engine/audio.js';
import { music } from '../engine/music.js';
import { save } from '../save.js';
import { game } from '../state.js';
import { fmtTime } from './hud.js';

export function renderMenuDust() { $('dustmenu').textContent = save.dust; }
export function renderMusicButton() { $('musicbtn').textContent = '♪ Music ' + (music.enabled ? 'on' : 'off'); }
export function renderSoundButton() { $('mute').textContent = 'Sound: ' + (audio.muted ? 'off' : 'on'); }

export function initMenus() {
  $('best').textContent = save.best;
  renderMenuDust();
  renderMusicButton();
  renderSoundButton();
  if (coarse) {
    $('keys').innerHTML = '<li><span><b>Left thumb:</b> drag up/down to walk, left/right to turn.</span></li><li><span><b>Right thumb:</b> swipe the sky to turn and look around.</span></li><li><span><b>Dash</b> through danger or <b>Blink</b> ahead instantly. They share a recharge.</span></li><li><span>Both portrait and landscape work. Tap <b>Pause</b> for sound and fullscreen.</span></li>';
    for (const k of document.querySelectorAll('.desk')) k.hidden = true;
  }
}

export function showPause(on) {
  $('pause').hidden = !on;
  $('touch-controls').hidden = !coarse || on || game.phase !== 'play';
}

export function hideTouchControls() { $('touch-controls').hidden = true; }

/** result: { isBest, score, time, bestChain, earned } */
export function showGameOver(result) {
  $('eyebrow').textContent = result.isBest ? 'New best score' : 'Pip has been flattened';
  $('headline').innerHTML = 'The sky<br><em>won</em> this time';
  $('lede').textContent = result.time < 30
    ? 'Watch the rings fill up; you have until the fill reaches the edge. Dash right before impact to slip through.'
    : 'Meteors fall faster the longer you last. Chain shards quickly to keep the multiplier climbing.';
  $('r-score').textContent = result.score;
  $('r-time').textContent = fmtTime(result.time);
  $('r-chain').textContent = '×' + result.bestChain;
  $('r-dust').textContent = '+' + result.earned;
  $('r-score-box').classList.toggle('new', result.isBest);
  $('result').hidden = false;
  $('keys').hidden = true;
  $('start').textContent = 'Play again';
  $('best').textContent = save.best;
  renderMenuDust();
  $('hud').hidden = true;
  $('overlay').hidden = false;
  $('start').focus({ preventScroll: true });
}
