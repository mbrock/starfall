// Synthesized sound effects. Browsers only allow sound after the first tap or key press, so the
// AudioContext starts in initAudio(), which every user gesture calls; before that, sounds are silent no-ops.

export const audio = { ctx: null, master: null, muted: false };
const VOLUME = 0.45;

export function initAudio() {
  if (audio.ctx) { audio.ctx.resume?.(); return; }
  try {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = audio.muted ? 0 : VOLUME;
    audio.master.connect(audio.ctx.destination);
  } catch { audio.ctx = null; }
}
export function setMuted(m) {
  audio.muted = m;
  if (audio.master) audio.master.gain.value = m ? 0 : VOLUME;
}

let noiseBuf = null;
/** One second of white noise, made on first use. */
export function noiseBuffer() {
  const ctx = audio.ctx;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** A blip: an oscillator with a fast attack and exponential decay, optionally sliding to another pitch. */
export function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, delay = 0) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(audio.master); o.start(t0); o.stop(t0 + dur + 0.05);
}
/** A filtered noise hit. */
export function noise(dur, vol, freq, type = 'lowpass') {
  const ctx = audio.ctx;
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(audio.master); s.start(t0); s.stop(t0 + dur);
}

// Every game sound has a name here, so the code that plays one reads as what happened.
export const sfx = {
  pickup(combo) { const f = 523.25 * Math.pow(2, Math.min(combo - 1, 12) * 2 / 12); tone(f, 0.18, 'triangle', 0.18); tone(f * 1.5, 0.22, 'sine', 0.12, 0, 0.06); },
  heart() { tone(440, 0.15, 'sine', 0.15); tone(660, 0.2, 'sine', 0.15, 0, 0.08); tone(880, 0.3, 'sine', 0.15, 0, 0.16); },
  boom(v) { noise(0.6, 0.5 * v, 500); tone(110, 0.45, 'sine', 0.3 * v, 38); },
  hurt() { tone(320, 0.35, 'square', 0.1, 90); noise(0.3, 0.3, 1500, 'bandpass'); },
  dash() { noise(0.22, 0.25, 2400, 'bandpass'); tone(300, 0.15, 'sine', 0.06, 700); },
  blink() { this.dash(); tone(1100, 0.12, 'sine', 0.1, 1800); },
  over() { tone(392, 0.3, 'triangle', 0.15); tone(311, 0.3, 'triangle', 0.15, 0, 0.22); tone(233, 0.6, 'triangle', 0.15, 0, 0.44); },
  buy() { tone(784, 0.12, 'triangle', 0.15); tone(1175, 0.25, 'triangle', 0.14, 0, 0.08); },
  nope() { tone(180, 0.15, 'square', 0.06); },
  drift() { tone(900, 0.8, 'sine', 0.14, 220); },
  giant() { tone(110, 0.9, 'sawtooth', 0.12, 330); tone(220, 0.9, 'triangle', 0.12, 660); noise(0.5, 0.3, 400, 'lowpass'); },
  shrink() { tone(660, 0.5, 'triangle', 0.1, 220); },
  stomp() { tone(60, 0.18, 'sine', 0.22, 40); noise(0.12, 0.12, 300, 'lowpass'); },
  burst() { noise(0.8, 0.45, 3000, 'bandpass'); tone(1400, 0.5, 'triangle', 0.12, 2800); tone(70, 0.6, 'sine', 0.3, 35); },
  pop() { tone(1200, 0.12, 'sine', 0.15, 400); noise(0.15, 0.2, 4000, 'highpass'); },
  buddyGrab(k) { tone(1600 + k * 200, 0.12, 'sine', 0.06, 2200); },
  // travel between bodies (game/travel.js)
  unlock() { tone(523, 0.18, 'triangle', 0.14); tone(784, 0.2, 'triangle', 0.14, 0, 0.1); tone(1047, 0.4, 'triangle', 0.14, 0, 0.2); },
  tick(final) { tone(final ? 1320 : 880, final ? 0.4 : 0.1, 'square', 0.06); },
  liftoff() { noise(2.6, 0.5, 260); tone(55, 2.4, 'sawtooth', 0.12, 140); },
  whoosh() { noise(1.2, 0.35, 1800, 'bandpass'); tone(300, 1.0, 'sine', 0.08, 1200); },
  touchdown() { noise(0.7, 0.45, 600); tone(90, 0.5, 'sine', 0.25, 45); tone(660, 0.3, 'triangle', 0.1, 0, 0.25); tone(990, 0.4, 'triangle', 0.1, 0, 0.38); },
  bonk() { tone(140, 0.2, 'square', 0.1, 70); noise(0.2, 0.25, 900); },
  comet() { noise(2.5, 0.25, 4000, 'bandpass'); tone(1800, 2.2, 'sine', 0.05, 500); },
};
