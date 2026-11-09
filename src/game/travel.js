// Travelling to other worlds: three prototypes to compare, picked with ?travel=rocket|jet|comet. Without the
// flag none of this runs and the game is the plain one-planet game. Each style module has the same hooks:
// reset() at the start of a run, ground(dt) every frame on the ground, fly(dt) every frame of a trip,
// collected(kind), meteorLanded(n) (true if it left its own pickup), action() (J / Launch), status() for
// the HUD, debugReady() and hint. game/flight.js has what they share; world/bodies.js has the worlds.
import { $, debug, travelMode } from '../platform.js';
import { camera, renderer, scene } from '../engine/stage.js';
import { V, chord } from '../sphere.js';
import { game, pip } from '../state.js';
import { BODIES, buildBodies, here, updateSkyHalos } from '../world/bodies.js';
import { moon, stars } from '../world/sky.js';
import { applyLook } from './cosmetics.js';
import { goHome, trip, updateBanner } from './flight.js';
import * as rocket from './travel-rocket.js';
import * as jet from './travel-jet.js';
import * as comet from './travel-comet.js';

const STYLES = { rocket: { ...rocket, label: 'Rocket base' }, jet: { ...jet, label: 'Jet board' }, comet: { ...comet, label: 'Comet ride' } };
const style = STYLES[travelMode] ?? null;

if (style) {
  buildBodies();
  moon.visible = false; // the Lumen Moon hangs about where the old backdrop moon was
  $('eyebrow').textContent = `Travel test · ${style.label}`;
  $('lede').textContent = style.hint;
  const links = Object.entries(STYLES).map(([k, s]) => k === travelMode ? `<b>${s.label}</b>` : `<a href="?travel=${k}${debug ? '&debug' : ''}">${s.label}</a>`);
  $('variants').innerHTML = `Try: ${links.join(' · ')} · <a href="./">off</a>`;
  $('variants').hidden = false;
  // Compile the style's shaders now rather than when its rocket or comet first shows up (a hitch on the Pi).
  const shown = style.models.map((o) => o.visible);
  for (const o of style.models) o.visible = true;
  renderer.compile(scene, camera);
  style.models.forEach((o, i) => { o.visible = shown[i]; });
}

/** True while Pip is in the air between worlds; game/run.js hands him to the travel style then. */
export const travelling = () => trip.on;
/** Shard points and stardust are worth more on worlds further out. */
export const bodyMul = () => here.body.mul;
/** How often meteors come, relative to the home planet. */
export const meteorRate = () => here.body.meteors;

export function resetTravel() {
  if (!style) return;
  goHome();
  style.reset();
  applyLook();
}

export const updateTravelGround = (dt) => style?.ground(dt);
export const onTravelCollect = (kind) => style?.collected?.(kind);
export const onTravelMeteor = (n) => style?.meteorLanded?.(n) ?? false;
export const travelAction = () => { if (game.phase === 'play' && !game.paused && pip.alive) style?.action?.(); };

/** Every frame, after Pip is posed: fly the trip, keep the sky around the camera, update the HUD. */
export function updateTravel(dt) {
  if (!style) return;
  if (trip.on && game.phase === 'play') style.fly(dt);
  stars.position.copy(camera.position);
  updateSkyHalos(camera.position);
  updateBanner(dt);
  renderHud();
}

const _d = new V(), _r = new V();
let lastText = '';
function renderHud() {
  const s = game.phase === 'play' ? style.status() : null;
  $('travel-hud').hidden = !s;
  if (!s) return;
  const arrow = $('travel-arrow');
  arrow.hidden = !s.target;
  let text = s.text;
  if (s.target) {
    // which way to walk: the target's direction in Pip's tangent plane, relative to his facing
    _d.copy(s.target).addScaledVector(pip.p, -s.target.dot(pip.p));
    _r.crossVectors(pip.p, pip.f);
    const ang = Math.atan2(-_d.dot(_r), _d.dot(pip.f));
    arrow.style.transform = `rotate(${ang}rad)`;
    text += ` · ${Math.round(chord(pip.p, s.target))} m`;
  }
  if (text !== lastText) { $('travel-text').textContent = text; lastText = text; }
  $('travel-hud').classList.toggle('hot', !!s.hot);
}

if (style && debug) window.starfallTravel = { style: travelMode, ready: () => style.debugReady(), status: () => style.status(), action: () => style.action?.(), here, BODIES, trip };
