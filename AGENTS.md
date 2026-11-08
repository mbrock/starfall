# Starfall Keeper: notes for working on the game

A three.js game with no build step. `index.html` holds the markup, `style.css` the styles, and `src/` the ES modules;
`three` comes from a CDN through the import map in `index.html`. GitHub Pages serves `main` as is.

Run it with `python3 -m http.server 8765` and open http://localhost:8765/. Add `?debug` to get `window.starfall`
(state, stats, timers, save, `startRun()`, `trigger('giant')`, ...) for poking at it from the console or a test script.

## Layout

| Path | What it owns |
| --- | --- |
| `src/main.js` | Entry point: wires keys and buttons to actions, runs the frame loop in a fixed order. |
| `src/state.js` | Shared mutable state: `game` (phase, pause, clock, shake), `run` (score, combo, timers), `pip`, ability `timers`, run `stats`. |
| `src/save.js` | localStorage progress (`save.dust`, `levels`, `equip`, `best`), `lv(id)`, `owns(item)`. |
| `src/platform.js` | Device facts (`coarse` touch, `slowGPU`), safe storage, fullscreen. |
| `src/sphere.js` | Planet math: surface points are unit vectors; `surfR`, `chord`, `pointNear`, `advance`, `standOn`. |
| `src/input.js` | Keyboard, mouse and touch read into state that `game/run.js` polls. |
| `src/engine/` | Renderer and lights (`stage`), shared materials and colors, the particle pool, sound effects, menu music. |
| `src/world/` | The planet and its palettes, sky, decor (trees and rocks), terrain disks (warning rings, craters), landmarks. |
| `src/actors/` | Pip's model and hats, pickups (shards and hearts), meteors, Star Buddies. |
| `src/game/` | Rules: `run.js` (a run, scoring, hurt, game over), `abilities.js`, `upgrades.js`, `cosmetics.js`, `catalog.js` (the shop), `camera.js`. |
| `src/ui/` | DOM: HUD, menus, shop, floating popups. |

Dependencies point downward: `main` → `game` and `ui` → `actors` and `world` → `engine` → `state`, `sphere`, `platform`.
`ui` may read `game` tables; `game/run.js` calls `ui` to show things. Keep `engine`, `world` and `actors` free of game
rules; they take callbacks (`updateMeteors(dt, onLand)`, `knockDecor(n, r, onKnock)`) where a rule needs to react.

## Adding things

Most additions are one table entry:

- **Upgrade or one-time perk**: an entry in `UPGRADES` (`game/upgrades.js`) with `apply(stats, level)`, plus a default in
  `BASE_STATS`. Gameplay code reads `stats.x`, never `lv('id')`.
- **Ability with a key or button**: an entry in `ABILITIES` (`game/abilities.js`), and its HUD pill and touch button in
  `index.html`. `active('id')` tells other code it is running.
- **Cosmetic**: a row in the slot's table in `game/cosmetics.js`; a new hat model goes in `actors/hats.js`.
- **Landmark**: an entry in `LANDMARKS` (`world/landmarks.js`); it gets a spot on the planet and a shop item.
- **Something that moves every frame**: an `updateX(dt)` in its module, called from the loop in `main.js`.

## Rules that are easy to break

- Shop item ids (`speed`, `hat:crown-rosegold`, `trail:lava`, ...) and slot keys are the save format. Never rename one;
  if a shape has to change, bump `VERSION` in `save.js` and migrate in `load()`.
- It must hold 60 fps on a Raspberry Pi 5 kiosk (V3D GPU, 720p): shadow map stays 1024², MSAA stays off on `slowGPU`,
  and the cloned disk materials in `world/disks.js` are never disposed (disposing the last clone recompiles the shader,
  a 50-130 ms hitch). Share materials and geometries between instances; avoid allocating in per-frame loops (reuse
  scratch vectors such as `_v`).
- It must play on phones: anything a key does needs a touch path (`coarse` in `platform.js`, `(pointer: coarse)` in
  CSS), and layouts must respect the safe-area insets. Check portrait and landscape.
- Ability and shop descriptions use `coarse` to say "Tap" or "Press"; keep both wordings when adding one.

## Checking a change

Serve the folder and play it on desktop and in a phone-sized touch emulation (Playwright with a device profile makes
`(pointer: coarse)` match). Watch the console for errors. For rules and numbers, drive the game through `?debug`.
