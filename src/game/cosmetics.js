// Style items: scarves, body colors, hats, trails and planet palettes. Each slot holds one equipped item
// (save.equip[slot] = item key). applyLook() shows the equipped items on Pip and the planet.
// To add a cosmetic, add a row to its slot's table; hats live in actors/hats.js because they have models.
import { COLORS } from '../engine/materials.js';
import { rand } from '../sphere.js';
import { lv, owns, save } from '../save.js';
import { dressPip } from '../actors/pip.js';
import { HATS } from '../actors/hats.js';
import { paintPlanet } from '../world/planet.js';
import { showLandmarks } from '../world/landmarks.js';

export const SLOTS = { scarf: 'Scarf', body: 'Body color', hat: 'Hat', trail: 'Trail', world: 'Planet' };
const slug = (name) => name.toLowerCase().replace(/ /g, '');
const item = (slot, key, name, price, color, extra) => ({ id: `${slot}:${key}`, tab: 'style', slot, key, name, base: price, color, ...extra });

const SCARVES = [
  ['coral', 'Coral', 0, 0xff5a6e], ['gold', 'Gold', 15, 0xffcf5a], ['mint', 'Mint', 15, 0x6ef0c2], ['violet', 'Violet', 15, 0x9a7bff],
  ['sky', 'Sky', 15, 0x5ab8ff], ['night', 'Night', 20, 0x2a2160], ['rose', 'Rose', 15, 0xff8ad8], ['lime', 'Lime', 15, 0xb6f04a],
  ['snow', 'Snow', 15, 0xf8f8ff], ['rainbow', 'Rainbow', 60, 0xff5a6e, { rainbow: true }],
  ...[['Peach', 0xffb38a], ['Cherry', 0xd8233f], ['Ocean', 0x1f7fd1], ['Forest', 0x2e8f6b], ['Lemon', 0xfff05a], ['Plum', 0x7a2a8a], ['Teal', 0x1fb8b0], ['Coffee', 0x7a4a3a], ['Silver', 0xc9cdd8], ['Charcoal', 0x3a3a48], ['Tangerine', 0xff8a1f], ['Lavender', 0xc9a8ff], ['Bubblegum', 0xff7ad1], ['Ice', 0xbff4ff], ['Sunset', 0xff6a4a], ['Moss', 0x7a9a3a], ['Royal', 0x3a4ad8], ['Candy', 0xff4a9a], ['Sand', 0xe8cf9a], ['Neon', 0x5aff7a]]
    .map(([n, c]) => [slug(n), n, 18, c]),
].map(([key, n, price, color, extra]) => item('scarf', key, `${n} scarf`, price, color, extra));

const BODIES = [
  ['classic', 'Classic', 0, 0xf4f0ff], ['peach', 'Peach', 20, 0xffc9a8], ['lilac', 'Lilac', 20, 0xc9b8ff], ['mint', 'Seafoam', 20, 0xa8f0d6],
  ['midnight', 'Midnight', 30, 0x3a3570, { lightEyes: true }], ['sky', 'Sky', 20, 0xa8d8ff], ['bubblegum', 'Bubblegum', 25, 0xff9ad5],
  ['shadow', 'Shadow', 35, 0x1d1a2e, { lightEyes: true }], ['golden', 'Solid Gold', 80, 0xffd36b, { metalness: 0.7, roughness: 0.25 }],
  ['chrome', 'Chrome', 90, 0xd8dde8, { metalness: 0.9, roughness: 0.15 }],
  ...[['Lemon', 0xfff1a8], ['Sage', 0xb8d8a8], ['Coral', 0xff9a8a], ['Ice', 0xd8f4ff], ['Grape', 0x9a6ad8], ['Tangerine', 0xffb36a], ['Rose', 0xffb8d0], ['Cocoa', 0x8a5a4a], ['Ocean', 0x4a9ad8], ['Forest', 0x3a8a5a], ['Ruby', 0xd83a5a], ['Slate', 0x6a7088], ['Cream', 0xfff4e0], ['Neon', 0x8aff8a], ['Sunflower', 0xffd83a], ['Ghost', 0xe8e8f8]]
    .map(([n, c]) => [slug(n), n, 25, c]),
].map(([key, n, price, color, extra]) => item('body', key, n, price, color, extra));

const HAT_ITEMS = [
  ...Object.entries(HATS).map(([key, h]) => item('hat', key, h.name, h.price, undefined, { model: key })),
  ...Object.entries(HATS).flatMap(([model, h]) => (h.tints ?? []).map(([n, c]) => item('hat', `${model}-${slug(n)}`, `${n} ${h.tintName}`, h.tintPrice, c, { model, tint: c }))),
];

// particle(color, clock) sets a fresh trail particle's color; gravity 1 falls, negative floats up.
const tinted = (tint) => ({ gravity: 0.05, particle: (c) => c.set(tint).offsetHSL(rand(-0.03, 0.03), 0, rand(-0.12, 0.12)) });
const TRAILS = [
  item('trail', 'none', 'No trail', 0),
  item('trail', 'sparkle', 'Sparkles', 30, 0xffcf5a, { gravity: 0.05, particle: (c) => c.setHSL(0.12, 1, rand(0.6, 0.85)) }),
  item('trail', 'embers', 'Embers', 40, 0xff7a2a, { gravity: -0.15, particle: (c) => c.copy(COLORS.ember).offsetHSL(rand(-0.03, 0.05), 0, 0) }),
  item('trail', 'frost', 'Snowflakes', 40, 0xbfe0f5, { gravity: 0.25, particle: (c) => c.setHSL(0.56, 0.6, rand(0.75, 0.95)) }),
  item('trail', 'bubbles', 'Bubbles', 35, 0x9fe8ff, { gravity: -0.35, particle: (c) => c.setHSL(0.53, 0.8, rand(0.7, 0.9)) }),
  item('trail', 'hearts', 'Love', 45, 0xff7ab8, { gravity: 0.05, particle: (c) => c.setHSL(rand(0.9, 0.97), 0.9, rand(0.65, 0.8)) }),
  item('trail', 'leaves', 'Leaves', 40, 0x7ccf6a, { gravity: 0.4, particle: (c) => c.setHSL(rand(0.22, 0.33), 0.6, rand(0.45, 0.6)) }),
  item('trail', 'rainbow', 'Rainbow', 70, undefined, { gravity: 0.05, particle: (c, t) => c.setHSL((t * 0.6) % 1, 0.9, 0.62) }),
  // Saved under trail:<name> but equipped as tint-<name>, as they always have been.
  ...[['Fireflies', 0xd8ff5a], ['Ocean spray', 0x5ad8ff], ['Cherry blossom', 0xffb8d8], ['Lava', 0xff4a1f], ['Gold dust', 0xffd36b], ['Mint', 0x6ef0c2], ['Violet', 0x9a7bff], ['Ghost', 0xe8e8ff], ['Toxic', 0x7aff3a], ['Sky', 0x8ac8ff], ['Ruby', 0xff3a6a], ['Sunset', 0xff8a4a]]
    .map(([n, c]) => ({ ...item('trail', `tint-${slug(n)}`, n, 40, c, tinted(c)), id: `trail:${slug(n)}` })),
];

// Planet palettes: [deep, grass, high, sand, bloom].
const WORLDS = [
  ['meadow', 'Meadow', 0, 0x46b88f, [0x2b8478, 0x46b88f, 0x93d47b, 0xe9c98d, 0x9a7bff]],
  ['autumn', 'Autumn', 50, 0xd9773a, [0x9a4a2e, 0xd9773a, 0xf2b84b, 0xf3dfb0, 0xc23b4e]],
  ['frost', 'Frost', 50, 0xbfe0f5, [0x6f9fd6, 0xbfe0f5, 0xffffff, 0x9fb4d9, 0x7ee0ff]],
  ['dusk', 'Dusk', 70, 0x4b3a9a, [0x2a2160, 0x4b3a9a, 0x7d63d8, 0x1c1640, 0x3ff0d0]],
  ['desert', 'Desert', 50, 0xd9a35a, [0xb8743a, 0xd9a35a, 0xf0cf8a, 0xf7e6c0, 0x46b88f]],
  ['ocean', 'Ocean', 60, 0x2f86c9, [0x1b4f8a, 0x2f86c9, 0x6ec8f0, 0xf3e3b0, 0xff8a6e]],
  ['candy', 'Candy', 80, 0xff9ad5, [0xd96aa8, 0xff9ad5, 0xffd1ec, 0xfff1a8, 0x7ee0ff]],
  ['lava', 'Ember Rock', 90, 0xff7a2a, [0x2a1a1f, 0x4a2a2a, 0x6e3b30, 0xff7a2a, 0xffcf5a]],
  ['jungle', 'Jungle', 70, 0x1f6b3a, [0x1f5a3a, 0x2e8f4a, 0x6ad86a, 0xc9b87a, 0xff5a6e]],
  ['mars', 'Red Planet', 70, 0xc24a2e, [0x7a2a1f, 0xc24a2e, 0xe88a5a, 0xf2c9a0, 0xffcf5a]],
  ['ice', 'Glacier', 70, 0x8ad8ff, [0x3a7ab8, 0x8ad8ff, 0xe8f8ff, 0xffffff, 0x5affd8]],
  ['mint', 'Mint Chip', 70, 0x8af0c8, [0x3a2a2a, 0x8af0c8, 0xc8ffe8, 0x5a3a2a, 0xff9ad5]],
  ['neon', 'Neon City', 70, 0xff3aa8, [0x1d1a2e, 0x3a2a6a, 0xff3aa8, 0x2a2048, 0x3affd8]],
  ['sunny', 'Sunny Isle', 70, 0xffd83a, [0x2fb8c9, 0x8ad86a, 0xffe88a, 0xfff4c8, 0xff7ab8]],
  ['moon', 'Moon Dust', 70, 0xc9c5d8, [0x6a6880, 0xa8a5b8, 0xd8d5e8, 0x4a4860, 0xffe08a]],
  ['grape', 'Grape Soda', 70, 0x7a3ad8, [0x3a1a6a, 0x7a3ad8, 0xc89aff, 0xffd8f0, 0x9be05a]],
  ['rust', 'Rust Bucket', 70, 0xb86a3a, [0x5a3a2a, 0xb86a3a, 0xd89a5a, 0x7a7a88, 0x5ab8ff]],
  ['cherry', 'Cherry Grove', 70, 0xff8ab8, [0x4a8a5a, 0x7ac87a, 0xffb8d8, 0xf8e8d8, 0xff4a7a]],
].map(([key, n, price, color, palette]) => item('world', key, n, price, color, { palette }));

/** Every style item, grouped by slot and sorted by price within a slot (a stable sort keeps table order for ties). */
export const STYLE_ITEMS = [...SCARVES, ...BODIES, ...HAT_ITEMS, ...TRAILS, ...WORLDS]
  .sort((a, b) => Object.keys(SLOTS).indexOf(a.slot) - Object.keys(SLOTS).indexOf(b.slot) || a.base - b.base);

/** The equipped item in a slot, or the slot's free default if the saved one isn't owned. */
export function styleItem(slot) {
  return STYLE_ITEMS.find((i) => i.slot === slot && i.key === save.equip[slot] && owns(i))
    ?? STYLE_ITEMS.find((i) => i.slot === slot && i.base === 0);
}

/** The equipped trail, or null for none. */
export const currentTrail = () => { const t = styleItem('trail'); return t.particle ? t : null; };

/** Show everything the player has bought and equipped: Pip's outfit, the planet's palette and landmarks. */
export function applyLook() {
  const hat = styleItem('hat');
  dressPip({ scarf: styleItem('scarf'), body: styleItem('body'), hat: { model: hat.model, tint: hat.tint }, skateboard: lv('skate') > 0 });
  paintPlanet(styleItem('world').palette);
  showLandmarks((key) => lv('home:' + key) > 0);
}
