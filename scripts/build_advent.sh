#!/bin/bash
# Rebuilds public/doors/advent.wasm: Open Adventure (Colossal Cave, BSD-2-Clause) compiled to WebAssembly.
#
# Tools (what built the committed copy):
#   zig 0.17.0      pip install ziglang==0.17.0      (C compiler + wasi-libc for wasm32-wasi)
#   binaryen 132    npm install binaryen@132.0.0     (wasm-opt --asyncify, so readline() can wait for the browser)
#   Python 3 + PyYAML                                 (Open Adventure's make_dungeon.py)
#   Open Adventure 1.22  https://gitlab.com/esr/open-adventure
#
# The only changes to Open Adventure are made at compile time: scripts/advent-compat/ stands in for
# libedit, and saveresume.c / main.c get fopen/fclose routed to the board (see compat.c).
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
COMPAT="$REPO/scripts/advent-compat"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
git clone -q --depth 1 https://gitlab.com/esr/open-adventure.git oa
( cd oa && python3 make_dungeon.py )
VERSION=$(sed -n '/^[0-9]/s/:.*//p' oa/NEWS.adoc | head -1)
npm install --silent --prefix "$WORK/node" binaryen@132.0.0 >/dev/null
CC="python3 -m ziglang cc --target=wasm32-wasi -Os"
$CC -c "$COMPAT/compat.c" -o compat.o
( cd oa && $CC -std=c99 -D_DEFAULT_SOURCE -D_WASI_EMULATED_SIGNAL -DVERSION=\"$VERSION\" -I"$COMPAT" \
    -Dfopen=adv_fopen -Dfclose=adv_fclose \
    main.c init.c actions.c score.c misc.c saveresume.c dungeon.c ../compat.o \
    -lwasi-emulated-signal -Wl,--export=adv_alloc -o ../advent.raw.wasm )
"$WORK/node/node_modules/binaryen/bin/wasm-opt" advent.raw.wasm \
    --enable-bulk-memory --enable-bulk-memory-opt --enable-sign-ext --enable-mutable-globals --enable-nontrapping-float-to-int \
    --asyncify --pass-arg=asyncify-imports@env.js_readline -Os -o "$REPO/public/doors/advent.wasm"
{ cat oa/COPYING; printf '\n----\nColossal Cave Adventure by Will Crowther (1976) and Don Woods (1977; 430-point version 1995).\nOpen Adventure by Eric S. Raymond (https://gitlab.com/esr/open-adventure), version %s.\nCompiled to WebAssembly for The Septic Tankz; see scripts/build_advent.sh.\n' "$VERSION"; } > "$REPO/public/doors/ADVENT-COPYING.txt"
ls -la "$REPO/public/doors/advent.wasm"
