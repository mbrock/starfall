// The player's progress in localStorage. Item ids and slot keys are part of the save format:
// renaming one in the catalog makes existing players lose that item, so add a migration instead.
import { storage } from './platform.js';

const SAVE_KEY = 'starfall-keeper-save', BEST_KEY = 'starfall-keeper-best';
const VERSION = 1;
export const DEFAULT_EQUIP = { scarf: 'coral', body: 'classic', hat: 'none', trail: 'none', world: 'meadow' };

export const save = { v: VERSION, dust: 0, levels: {}, equip: { ...DEFAULT_EQUIP }, best: 0 };

function load() {
  let s = null;
  try { s = JSON.parse(storage.get(SAVE_KEY)); } catch {}
  if (s) {
    // Saves written before versioning (no v) have the version 1 shape. Migrate older shapes here when it changes.
    save.dust = Math.max(0, s.dust | 0);
    Object.assign(save.levels, s.levels);
    Object.assign(save.equip, s.equip);
  }
  save.best = Number(storage.get(BEST_KEY)) || 0;
}
load();

export function persist() {
  const { best, ...rest } = save;
  storage.set(SAVE_KEY, JSON.stringify(rest));
  storage.set(BEST_KEY, String(best));
}

export function resetProgress() {
  Object.assign(save, { dust: 0, levels: {}, equip: { ...DEFAULT_EQUIP } });
  persist();
}

/** How many times the shop item with this id has been bought (0 if never). */
export const lv = (id) => save.levels[id] || 0;
/** Free items (base price 0) are owned from the start. */
export const owns = (item) => item.base === 0 || lv(item.id) >= 1;
