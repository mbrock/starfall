// The whole shop: upgrades and abilities (upgrades.js), landmarks (world/landmarks.js) and style items
// (cosmetics.js), with prices, buying and the run stats they add up to.
import { BASE_STATS, UPGRADES } from './upgrades.js';
import { STYLE_ITEMS, applyLook } from './cosmetics.js';
import { LANDMARKS } from '../world/landmarks.js';
import { lv, owns, persist, save } from '../save.js';
import { stats } from '../state.js';

const LANDMARK_ITEMS = LANDMARKS.map((lm) => ({
  id: 'home:' + lm.key, tab: 'home', name: lm.name, base: lm.price,
  info: 'Builds it on your planet. Every landmark adds <b>+2 stardust</b> to each run.',
  apply: (s) => { s.runBonus += 2; },
}));

/** Every shop item, in display order within each tab. max defaults to 1 (a one-time purchase). */
export const CATALOG = [...UPGRADES, ...LANDMARK_ITEMS, ...STYLE_ITEMS].map((it) => ({ max: 1, ...it }));

/** Price of the next level: base × growth^level. */
export const price = (it) => Math.round(it.base * Math.pow(it.g || 1.7, lv(it.id)));

/** Rebuild state.stats from BASE_STATS and every owned item's apply(). */
export function computeStats() {
  Object.assign(stats, BASE_STATS);
  for (const it of CATALOG) if (it.apply && lv(it.id) > 0) it.apply(stats, lv(it.id));
}

/** Buy the item's next level, or wear an owned style item. Returns 'equipped', 'bought' or 'refused'. */
export function buy(it) {
  let result;
  if (it.slot && owns(it)) { save.equip[it.slot] = it.key; result = 'equipped'; }
  else {
    const cost = price(it);
    if (save.dust < cost || lv(it.id) >= it.max) return 'refused';
    save.dust -= cost;
    save.levels[it.id] = lv(it.id) + 1;
    if (it.slot) save.equip[it.slot] = it.key;
    result = 'bought';
  }
  persist();
  applyLook();
  return result;
}

/** Owned levels out of all buyable levels (free items don't count). */
export function collection() {
  let have = 0, all = 0;
  for (const it of CATALOG) { if (!it.base) continue; all += it.max; have += Math.min(it.max, lv(it.id)); }
  return { have, all };
}
