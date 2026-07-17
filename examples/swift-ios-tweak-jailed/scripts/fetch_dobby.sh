#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Fetch Dobby's prebuilt iOS static library into vendor/dobby/.
#
# Layout produced (matches the Makefile's -Ivendor/dobby/include and
# -Lvendor/dobby/lib):
#   vendor/dobby/include/dobby.h
#   vendor/dobby/lib/libdobby.a       (universal — arm64 + arm64e)
#
# Idempotent: re-runs skip the download if libdobby.a already exists.
# Force re-fetch with FORCE=1.
# ---------------------------------------------------------------------------

set -e

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VENDOR="$ROOT/vendor/dobby"
INCLUDE="$VENDOR/include"
LIB="$VENDOR/lib"

if [ -f "$LIB/libdobby.a" ] && [ -z "$FORCE" ]; then
    echo "dobby: $LIB/libdobby.a already present (FORCE=1 to re-fetch)"
    exit 0
fi

RELEASE_URL="https://github.com/jmpews/Dobby/releases/download/latest/dobby-iphoneos-all.tar.gz"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "dobby: downloading $RELEASE_URL"
curl -fsSL "$RELEASE_URL" -o "$TMP/dobby.tar.gz"

echo "dobby: extracting into $VENDOR"
tar xzf "$TMP/dobby.tar.gz" -C "$TMP"

mkdir -p "$INCLUDE" "$LIB"
cp "$TMP/build/iphoneos/dobby.h"                    "$INCLUDE/dobby.h"
cp "$TMP/build/iphoneos/universal/libdobby.a"       "$LIB/libdobby.a"

echo "dobby: installed"
echo "  $INCLUDE/dobby.h ($(wc -c < "$INCLUDE/dobby.h") bytes)"
echo "  $LIB/libdobby.a  ($(wc -c < "$LIB/libdobby.a") bytes, universal arm64+arm64e)"
