// Floating text that rises from a point in the world ("+20 ×3", "close call", ...). cls picks the color: gold, mint, coral or ink.
import { $ } from '../platform.js';
import { camera } from '../engine/stage.js';
import { V } from '../sphere.js';

const box = $('popups'), pops = [];
export function popup(text, worldPos, cls) {
  const el = document.createElement('div');
  el.className = 'pop ' + cls; el.textContent = text;
  box.appendChild(el);
  pops.push({ el, pos: worldPos.clone(), t: 0 });
}
const _p = new V();
export function updatePopups(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t > 1) { p.el.remove(); pops.splice(i, 1); continue; }
    _p.copy(p.pos).project(camera);
    const x = (_p.x + 1) / 2 * innerWidth, y = (1 - _p.y) / 2 * innerHeight - p.t * 46;
    p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.25 - p.t)})`;
    p.el.style.opacity = String(Math.min(1, (1 - p.t) * 2.5));
  }
}
