# Starfall Keeper: notes for working on the game

A three.js game with no build step. `index.html` holds the markup, `style.css` the styles, and `src/` the ES modules;
`three` comes from a CDN through the import map in `index.html`. GitHub Pages serves `main` as is.

Run it with `python3 -m http.server 8765` and open http://localhost:8765/. Add `?debug` to get `window.starfall`
(state, stats, timers, save, `startRun()`, `trigger('giant')`, ...) for poking at it from the console or a test script.
`?sdf=planet,pip,meteors` (or `all`) turns on rendering experiments: ray-marched signed distance fields drawn
through `engine/sdf.js`. They are off by default; on the Pi 5 the SDF planet runs at about 21 fps, so it is not for the
live game.

## Layout

| Path | What it owns |
| --- | --- |
| `src/main.js` | Entry point: wires keys and buttons to actions, runs the frame loop in a fixed order. |
| `src/state.js` | Shared mutable state: `game` (phase, pause, clock, shake), `run` (score, combo, timers), `pip`, ability `timers`, run `stats`. |
| `src/save.js` | localStorage progress (`save.dust`, `levels`, `equip`, `best`), `lv(id)`, `owns(item)`. |
| `src/platform.js` | Device facts (`coarse` touch, `slowGPU`), safe storage, fullscreen. |
| `src/sphere.js` | Planet math: surface points are unit vectors; `surfR`, `chord`, `pointNear`, `advance`, `standOn`. `R` is the radius of whichever body Pip stands on (a live binding that `setGround()` changes). |
| `src/input.js` | Keyboard, mouse, touch and gamepad read into state that `game/run.js` polls; `main.js` maps gamepad buttons to actions. |
| `src/engine/` | Renderer and lights (`stage`), shared materials and colors, the particle pool, sound effects, menu music. |
| `src/world/` | The planet and its palettes, sky, decor (trees and rocks), meteor craters (`dents.js`), terrain disks (warning rings, shockwaves), landmarks. |
| `src/actors/` | Pip's model and hats, pickups (shards and hearts), meteors, Star Buddies. |
| `src/game/` | Rules: `run.js` (a run, scoring, hurt, game over), `abilities.js`, `upgrades.js`, `cosmetics.js`, `catalog.js` (the shop), `camera.js`. |
| `src/ui/` | DOM: HUD, menus, shop, floating popups. |
| `src/world/bodies.js`, `src/game/flight.js`, `src/game/travel*.js`, `src/actors/vehicles.js` | Prototype travel to other worlds, only with `?travel=rocket\|jet\|comet` (see below). |
| `vendor/box3d/`, `src/engine/physics.js`, `src/world/ground.js`, `src/actors/pip-body.js` | Box3D physics, on unless `?physics=off` (see below). |

Dependencies point downward: `main` → `game` and `ui` → `actors` and `world` → `engine` → `state`, `sphere`, `platform`.
`ui` may read `game` tables; `game/run.js` calls `ui` to show things. Keep `engine`, `world` and `actors` free of game
rules; they take callbacks (`updateMeteors(dt, onLand)`, `knockDecor(n, r, onKnock)`) where a rule needs to react.

## Adding things

Most additions are one table entry:

- **Upgrade or one-time perk**: an entry in `UPGRADES` (`game/upgrades.js`) with `apply(stats, level)`, plus a default in
  `BASE_STATS`. Gameplay code reads `stats.x`, never `lv('id')`.
- **Ability with a key or button**: an entry in `ABILITIES` (`game/abilities.js`) with its key, controller button
  (`pad`) and touch button, plus its HUD pill and touch button in `index.html`. `active('id')` tells other code it is
  running.
- **Cosmetic**: a row in the slot's table in `game/cosmetics.js`; a new hat model goes in `actors/hats.js`.
- **Landmark**: an entry in `LANDMARKS` (`world/landmarks.js`); it gets a spot on the planet and a shop item.
- **Something that moves every frame**: an `updateX(dt)` in its module, called from the loop in `main.js`.

## Travel to other worlds (prototypes)

`?travel=rocket`, `?travel=jet` and `?travel=comet` each turn on one way of reaching other worlds; without the flag
the game is the one-planet game. The worlds are the `BODIES` table in `world/bodies.js` (radius, terrain, palette,
decor mix, shard multiplier, meteor rate, place in the sky). Home is the smooth cratered planet; the others are
flat-shaded meshes without craters, because the crater shader in `world/dents.js` bakes in the home radius. The body Pip stands on is always at the origin: when
he flies closer to another body, `recenter()` in `game/flight.js` moves that body's mesh to the origin, changes `R` and
the terrain, respreads the decor and shifts the camera, particles and the style's own objects, so all surface code keeps working. Each
style module (`game/travel-rocket.js`, `-jet.js`, `-comet.js`) has the same hooks, listed in `game/travel.js`.
With `?debug`, `starfallTravel.ready()` skips the unlock and `starfall.step(dt)` advances one frame for recordings.

## Box3D physics

The game moves Pip, meteor rocks and pickups with [Box3D](https://github.com/erincatto/box3d), compiled to
WebAssembly in `vendor/box3d/` (`box3d.wasm`, its Emscripten loader `box3d.js`, and `starfall_box3d.c`, a flat C API
of numbers and integer handles). `vendor/box3d/build.sh` rebuilds them; it needs the Emscripten SDK and pins the Box3D
commit. `?physics=off` brings back the old scripted movement: `physics` in `engine/physics.js` is null, the wasm never
loads and every physics branch is skipped. Box3D has one gravity vector, so the world has none and `sf_step` pulls each dynamic body toward the origin.

- `world/ground.js` mirrors the body Pip stands on as 80 triangle-mesh patches with `heightAt()`'s heights; a crater
  rebuilds the patches it reaches each time its depth moves an eighth, and a new body (travel) rebuilds them all.
- `actors/pip-body.js` is Box3D's dynamic mover turned for a round planet: a rotation-locked ball, a pogo joint that
  holds it `restHeight()` over the ground and a mover joint for speed, with Quake-style friction and acceleration.
  `game/run.js` calls `drivePip()` before the step and `knockPip()` on blasts; `pipTuning` (also `starfall.physics`
  with `?debug`) has the feel numbers. While Pip flies between worlds his body is parked.
- Collision categories are `CAT` in `engine/physics.js`: Pip collides with the ground, props (decor and landmark
  colliders) and meteor rocks, and pickups don't block him.

## Rules that are easy to break

- Shop item ids (`speed`, `hat:crown-rosegold`, `trail:lava`, ...) and slot keys are the save format. Never rename one;
  if a shape has to change, bump `VERSION` in `save.js` and migrate in `load()`.
- It must hold 60 fps on a Raspberry Pi 5 kiosk (V3D GPU, 720p): shadow map stays 1024², MSAA stays off on `slowGPU`,
  and the cloned disk materials in `world/disks.js` are never disposed (disposing the last clone recompiles the shader,
  a 50-130 ms hitch). Share materials and geometries between instances; avoid allocating in per-frame loops (reuse
  scratch vectors such as `_v`).
- Meteors dent the ground for about 24 s, so ground height changes over time. Things that sit on the ground read
  `surfR(n)` every frame (Pip, pickups, landmarks) or stay out of craters (regrowing decor). Shaders draw craters per
  vertex with `dentGLSL` from `world/dents.js`; looping over the craters per pixel cost about 3 ms of GPU time on the Pi.
- It must play on phones and with a controller (the Pi kiosk uses one): anything a key does needs a controller button
  and a touch path (`coarse` in `platform.js`, `(pointer: coarse)` in CSS), and layouts must respect the safe-area
  insets. Check portrait and landscape.
- Ability and shop descriptions use `coarse` to say "Tap" or "Press"; keep both wordings when adding one.

## Checking a change

Serve the folder and play it on desktop and in a phone-sized touch emulation (Playwright with a device profile makes
`(pointer: coarse)` match). Watch the console for errors. For rules and numbers, drive the game through `?debug`.
