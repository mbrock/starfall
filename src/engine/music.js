// Menu music, generated live: slow pads, a sub drone, twinkling plucks and the odd comet sweep.
// It plays on the title and game-over screens and fades out during a run.
import { audio, noiseBuffer } from './audio.js';
import { storage } from '../platform.js';
import { game } from '../state.js';

const PREF_KEY = 'starfall-keeper-music';
export const music = { out: null, bus: null, delay: null, active: false, next: 0, step: 0, enabled: storage.get(PREF_KEY) !== 'off' };

export function setMusicEnabled(on) {
  music.enabled = on;
  storage.set(PREF_KEY, on ? 'on' : 'off');
  updateMusic();
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [45, 57, 60, 64, 67, 71], // Am9
  [41, 53, 57, 60, 64, 69], // Fmaj7
  [48, 55, 59, 64, 67, 71], // Cmaj7
  [43, 55, 59, 62, 66, 69], // G6 / D
];
const EIGHTH = 60 / 68 / 2, STEPS_PER_CHORD = 16;

function makeImpulse(sec) {
  const ctx = audio.ctx, len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5); }
  return b;
}
function setupMusic() {
  const ctx = audio.ctx;
  if (!ctx || music.out) return;
  const out = ctx.createGain(); out.gain.value = 0; out.connect(audio.master);
  const bus = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 0.5; bus.connect(dry).connect(out);
  const conv = ctx.createConvolver(); conv.buffer = makeImpulse(4.5);
  const wet = ctx.createGain(); wet.gain.value = 0.75; bus.connect(conv).connect(wet).connect(out);
  const delay = ctx.createDelay(2); delay.delayTime.value = EIGHTH * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.45; delay.connect(fb).connect(delay);
  const dl = ctx.createGain(); dl.gain.value = 0.5; delay.connect(dl).connect(bus);
  Object.assign(music, { out, bus, delay });
  setInterval(scheduleMusic, 200);
}
function padVoice(m, t0, dur, vol) {
  const ctx = audio.ctx;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(350, t0);
  f.frequency.linearRampToValueAtTime(1500, t0 + dur * 0.5);
  f.frequency.linearRampToValueAtTime(400, t0 + dur + 2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 2.2);
  g.gain.setValueAtTime(vol, t0 + dur);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 2.5);
  f.connect(g).connect(music.bus);
  for (const det of [-8, 8]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    o.connect(f); o.start(t0); o.stop(t0 + dur + 2.6);
  }
}
function bassVoice(m, t0, dur) {
  const ctx = audio.ctx;
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.16, t0 + 1.5);
  g.gain.setValueAtTime(0.16, t0 + dur - 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.8);
  o.connect(g).connect(music.out); o.start(t0); o.stop(t0 + dur + 1);
}
function pluck(m, t0, vol = 0.055) {
  const ctx = audio.ctx;
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
  o.connect(g); g.connect(music.bus); g.connect(music.delay);
  o.start(t0); o.stop(t0 + 1.9);
}
function cometSweep(t0) {
  const ctx = audio.ctx;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(5000, t0); f.frequency.exponentialRampToValueAtTime(250, t0 + 3.5);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.8); g.gain.linearRampToValueAtTime(0.0001, t0 + 3.5);
  s.connect(f).connect(g).connect(music.bus); s.start(t0); s.stop(t0 + 3.6);
}
function scheduleMusic() {
  if (!audio.ctx || !music.active) return;
  const now = audio.ctx.currentTime;
  if (music.next < now) music.next = now + 0.05;
  while (music.next < now + 0.8) {
    const t = music.next, s = music.step;
    const chord = CHORDS[Math.floor(s / STEPS_PER_CHORD) % CHORDS.length];
    if (s % STEPS_PER_CHORD === 0) {
      const dur = EIGHTH * STEPS_PER_CHORD;
      for (const m of chord.slice(1, 5)) padVoice(m, t, dur, 0.02);
      bassVoice(chord[0], t, dur);
    }
    if (Math.random() < (s % 2 === 0 ? 0.55 : 0.25)) {
      const up = chord.slice(2);
      pluck(up[Math.floor(Math.random() * up.length)] + (Math.random() < 0.6 ? 12 : 24), t);
    }
    if (s % (STEPS_PER_CHORD * 2) === 8 && Math.random() < 0.7) cometSweep(t);
    music.next += EIGHTH; music.step++;
  }
}

/** Fade the music in or out to match the setting and whether a run is on. Call after either changes. */
export function updateMusic() {
  if (!audio.ctx) return;
  setupMusic();
  const want = music.enabled && game.phase !== 'play';
  const now = audio.ctx.currentTime;
  if (want && !music.active) { music.active = true; music.step = 0; music.next = now + 0.1; scheduleMusic(); }
  if (!want) music.active = false;
  music.out.gain.cancelScheduledValues(now);
  music.out.gain.setValueAtTime(music.out.gain.value, now);
  music.out.gain.setTargetAtTime(want ? 1 : 0, now, want ? 1.2 : 0.35);
}
