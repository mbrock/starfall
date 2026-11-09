#!/bin/sh
# Rebuild box3d.js + box3d.wasm from Box3D and starfall_box3d.c. Needs the Emscripten SDK (emcc on PATH):
#   git clone https://github.com/emscripten-core/emsdk && cd emsdk && ./emsdk install latest && ./emsdk activate latest
#   . ./emsdk_env.sh
# Then run this script from anywhere. It clones Box3D at the pinned commit into a temporary directory.
set -eu
BOX3D_COMMIT=336263320469e5e9febfe18697ab562488f7e97a
here=$(cd "$(dirname "$0")" && pwd)
src=${BOX3D_SRC:-$(mktemp -d)/box3d}
if [ ! -d "$src/src" ]; then
  git clone --quiet https://github.com/erincatto/box3d.git "$src"
  git -C "$src" checkout --quiet "$BOX3D_COMMIT"
fi
exports=$(grep -o 'EXPORT [^(]*\bsf_[a-z_]*' "$here/starfall_box3d.c" | grep -o 'sf_[a-z_]*' | sed 's/^/_/' | paste -sd, -)
# Single-threaded, wasm SIMD (Box3D maps it onto its SSE2 path), no assertions.
emcc -O3 -DNDEBUG -msimd128 -msse2 -std=gnu17 \
  -I"$src/include" -I"$src/src" \
  "$src"/src/*.c "$here/starfall_box3d.c" \
  -sMODULARIZE -sEXPORT_ES6 -sEXPORT_NAME=Box3D -sENVIRONMENT=web,node \
  -sALLOW_MEMORY_GROWTH -sINITIAL_MEMORY=33554432 -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS="$exports,_malloc,_free" -sEXPORTED_RUNTIME_METHODS=HEAPF32,HEAP32 \
  -o "$here/box3d.js"
ls -l "$here/box3d.js" "$here/box3d.wasm"
