// What the device and browser can do, plus small wrappers over browser APIs that can throw.

export const $ = (id) => document.getElementById(id);

// Phones and tablets: two-thumb touch controls instead of keyboard and mouse. CSS uses the same media query.
export const coarse = matchMedia('(pointer: coarse)').matches;

// The Raspberry Pi's V3D GPU spends 4-9 ms of each 720p frame on 4x MSAA, enough to drop frames; skip it there.
export const slowGPU = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2'), d = gl.getExtension('WEBGL_debug_renderer_info');
    const name = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /V3D|VideoCore/i.test(name);
  } catch { return false; }
})();

// ?debug exposes the game's state and main actions on window.starfall, for poking at it from the console.
const params = new URLSearchParams(location.search);
export const debug = params.has('debug');
// Rendering experiments: ?sdf=planet,pip,meteors (or all) draws those as ray-marched signed distance fields
// (engine/sdf.js).
const sdfList = (params.get('sdf') ?? '').split(',');
export const sdf = (part) => sdfList.includes(part) || sdfList.includes('all');
// ?travel=rocket|jet|comet turns on one of the prototype ways of travelling to other worlds (game/travel.js).
export const travelMode = params.get('travel');
// ?physics=box3d moves Pip, meteors and shards with the Box3D physics engine (engine/physics.js).
export const physicsMode = params.get('physics') === 'box3d';

// localStorage throws in some private modes and sandboxed iframes; the game then just forgets.
export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

// ---------- fullscreen ----------
const root = document.documentElement;
export const canFullscreen = !!(root.requestFullscreen || root.webkitRequestFullscreen);
const fullscreenNow = () => document.fullscreenElement || document.webkitFullscreenElement;
export function toggleFullscreen() {
  if (!canFullscreen) return;
  try {
    const p = fullscreenNow()
      ? (document.exitFullscreen || document.webkitExitFullscreen).call(document)
      : (root.requestFullscreen || root.webkitRequestFullscreen).call(root, { navigationUI: 'hide' });
    p?.catch?.(() => {});
  } catch {}
}
function renderFullscreenButtons() {
  for (const b of document.querySelectorAll('.fsbtn')) {
    b.hidden = !canFullscreen;
    b.textContent = fullscreenNow() ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
  }
}
for (const b of document.querySelectorAll('.fsbtn')) b.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', renderFullscreenButtons);
document.addEventListener('webkitfullscreenchange', renderFullscreenButtons);
renderFullscreenButtons();
