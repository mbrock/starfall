// Pip's Shop: tabs of item cards built from game/catalog.js.
import { $ } from '../platform.js';
import { initAudio, sfx } from '../engine/audio.js';
import { lv, owns, resetProgress, save } from '../save.js';
import { CATALOG, buy, collection, price } from '../game/catalog.js';
import { SLOTS, applyLook } from '../game/cosmetics.js';
import { renderMenuDust } from './menus.js';

let tab = 'up';
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function card(it) {
  const l = lv(it.id), own = owns(it), cost = price(it);
  let detail = it.info || '';
  if (it.fx) detail += (l > 0 ? ` Now <b>${it.fx(l)}</b>.` : '') + (l < it.max ? ` Next <b>${it.fx(l + 1)}</b>.` : '');
  let label, cls = 'buy', disabled = false;
  if (it.slot) {
    if (own && save.equip[it.slot] === it.key) { label = 'Equipped'; cls += ' done'; disabled = true; }
    else if (own) { label = it.slot === 'world' ? 'Visit' : 'Wear'; cls += ' equip'; }
    else { label = `${cost} ✦`; disabled = save.dust < cost; }
  } else if (l >= it.max) { label = it.max > 1 ? 'Maxed' : 'Owned'; cls += ' done'; disabled = true; }
  else { label = `${cost} ✦`; disabled = save.dust < cost; }
  const el = document.createElement('div');
  el.className = 'item' + (own && (it.slot || l > 0) ? ' owned' : '');
  const swatch = it.color != null ? `<span class="swatch" style="background:${hex(it.color)}"></span>` : '';
  const pips = it.max > 10 ? `<span class="label">Lv ${l} / ${it.max}</span>`
    : it.max > 1 ? Array.from({ length: it.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('') : '';
  el.innerHTML = `<h3>${swatch}${it.name}</h3><p>${detail || (it.slot ? (it.base ? 'Cosmetic.' : 'Free.') : '')}</p><div class="foot"><span class="pips">${pips}</span><button class="${cls}" type="button" ${disabled ? 'disabled' : ''}>${label}</button></div>`;
  el.querySelector('button').addEventListener('click', () => {
    initAudio();
    const result = buy(it);
    if (result === 'refused') sfx.nope();
    else if (result === 'bought') sfx.buy();
    else sfx.pickup(1);
    renderShop(); renderMenuDust();
  });
  return el;
}

export function renderShop() {
  $('wallet').textContent = save.dust;
  const { have, all } = collection();
  $('collectlabel').textContent = `Collection ${have} / ${all}`;
  $('collectbar').style.width = (100 * have / all) + '%';
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  const box = $('items');
  box.innerHTML = '';
  let lastSlot = null;
  for (const it of CATALOG) {
    if (it.tab !== tab) continue;
    if (it.slot && it.slot !== lastSlot) {
      lastSlot = it.slot;
      const h = document.createElement('div'); h.className = 'slot-head label'; h.textContent = SLOTS[it.slot];
      box.appendChild(h);
    }
    box.appendChild(card(it));
  }
}

export const isShopOpen = () => !$('shop').hidden;
export function openShop() { initAudio(); $('overlay').hidden = true; $('shop').hidden = false; renderShop(); }
export function closeShop() { $('shop').hidden = true; $('overlay').hidden = false; $('openshop').focus({ preventScroll: true }); }

$('openshop').addEventListener('click', openShop);
$('closeshop').addEventListener('click', closeShop);
for (const b of document.querySelectorAll('.tab')) b.addEventListener('click', () => { tab = b.dataset.tab; renderShop(); });

// Reset takes two taps within 3 s.
let resetArm = 0;
$('reset').addEventListener('click', () => {
  const btn = $('reset');
  if (performance.now() - resetArm < 3000) {
    resetArm = 0;
    resetProgress(); applyLook(); renderShop(); renderMenuDust();
    btn.textContent = 'Progress erased';
  } else {
    resetArm = performance.now();
    btn.textContent = 'Tap again to erase everything';
    setTimeout(() => { if (resetArm) btn.textContent = 'Reset progress'; resetArm = 0; }, 3000);
  }
});
