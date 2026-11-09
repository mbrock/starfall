# Box3D for Starfall

[Box3D](https://github.com/erincatto/box3d), Erin Catto's 3D physics engine (MIT, see `LICENSE`), compiled to
WebAssembly for `?physics=box3d`. Nothing here is built when the site is served: the game imports `box3d.js` (the
Emscripten loader) and it fetches `box3d.wasm` next to it.

- `starfall_box3d.c`: the binding. Plain functions of numbers and integer handles (`sf_body`, `sf_sphere`,
  `sf_step`, `sf_mover_update`, ...), so JavaScript needs no struct marshalling; `src/engine/physics.js` wraps them.
  It also holds the radial gravity and the character mover adapted from Box3D's `samples/dynamic_mover.cpp`.
- `build.sh`: rebuilds `box3d.js` and `box3d.wasm` from the pinned Box3D commit with the Emscripten SDK
  (single-threaded, wasm SIMD, no assertions). Add a function to the binding with `EXPORT` and rerun it.
