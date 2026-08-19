#!/usr/bin/env bash
#
# fetch-basemap.sh — build the local basemap asset bundle for Phase 8 (§8.B).
#
# Produces, under public/basemap/:
#
#   venue.pmtiles          a vector tile archive for ONE bounding box, extracted
#                          from the Protomaps daily planet build
#   fonts/<stack>/*.pbf    the glyph ranges MapLibre needs to draw labels
#   sprites/*              the POI icon sheet
#
# Everything the map needs is served from our own origin afterwards. That is the
# point: §8.B's requirement is not "cheap tiles", it is an offline story that
# survives a stadium's connectivity being unreliable by design. A basemap that
# silently reaches out to protomaps.github.io for its fonts every time somebody
# pans is not offline, it just looks offline until the network dies.
#
# None of this output is committed — see core/.gitignore. A fresh clone has no
# basemap and the app falls back to the raster-only map, which is the documented
# degrade-to-nothing behaviour (§8.B). Run this script to opt in.
#
# Usage:
#   ./scripts/fetch-basemap.sh                       # default bbox (UC Berkeley)
#   BBOX=-122.30,37.845,-122.23,37.895 ./scripts/fetch-basemap.sh
#   MAXZOOM=17 ./scripts/fetch-basemap.sh
#
# Pick the bbox to cover the venue plus enough surrounding context that a
# dispatcher panning off the venue edge does not hit blank tiles. Cost scales
# with area, not much with maxzoom: the default Berkeley box is ~5 MB.

set -euo pipefail

cd "$(dirname "$0")/.."

BBOX="${BBOX:--122.30,37.845,-122.23,37.895}"
MAXZOOM="${MAXZOOM:-16}"
PMTILES_VERSION="${PMTILES_VERSION:-1.31.2}"
ASSETS="https://protomaps.github.io/basemaps-assets"
OUT="public/basemap"
CACHE=".cache"

mkdir -p "$OUT" "$CACHE"

# ---------------------------------------------------------------------------
# 1. The pmtiles CLI (Go binary, not an npm package — the npm `pmtiles` package
#    is the browser-side reader and cannot do extracts).
# ---------------------------------------------------------------------------
PMTILES_BIN="$CACHE/pmtiles"
if [ ! -x "$PMTILES_BIN" ]; then
  case "$(uname -s)/$(uname -m)" in
    Darwin/arm64)  ASSET="go-pmtiles-${PMTILES_VERSION}_Darwin_arm64.zip" ;;
    Darwin/x86_64) ASSET="go-pmtiles-${PMTILES_VERSION}_Darwin_x86_64.zip" ;;
    Linux/aarch64) ASSET="go-pmtiles-${PMTILES_VERSION}_Linux_arm64.zip" ;;
    Linux/x86_64)  ASSET="go-pmtiles-${PMTILES_VERSION}_Linux_x86_64.zip" ;;
    *) echo "No prebuilt pmtiles for $(uname -s)/$(uname -m). See https://github.com/protomaps/go-pmtiles/releases" >&2; exit 1 ;;
  esac
  echo "==> fetching pmtiles CLI ${PMTILES_VERSION}"
  curl -fsSL -o "$CACHE/pmtiles.zip" \
    "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${ASSET}"
  unzip -o -q -d "$CACHE" "$CACHE/pmtiles.zip" pmtiles
  chmod +x "$PMTILES_BIN"
fi

# ---------------------------------------------------------------------------
# 2. Find the most recent daily planet build. build.protomaps.com publishes
#    <YYYYMMDD>.pmtiles and prunes old ones, so today's date is not guaranteed
#    to exist yet and last month's is guaranteed not to.
# ---------------------------------------------------------------------------
echo "==> locating latest Protomaps daily build"
BUILD=""
for i in $(seq 1 14); do
  D=$(date -u -v-"${i}"d +%Y%m%d 2>/dev/null || date -u -d "${i} days ago" +%Y%m%d)
  if curl -fsI --max-time 20 "https://build.protomaps.com/${D}.pmtiles" >/dev/null 2>&1; then
    BUILD="$D"; break
  fi
done
[ -n "$BUILD" ] || { echo "No daily build found in the last 14 days." >&2; exit 1; }
echo "    using build ${BUILD}"

# ---------------------------------------------------------------------------
# 3. Extract the bbox. This reads the remote archive over HTTP range requests
#    and downloads only the tiles inside the box — not the planet.
# ---------------------------------------------------------------------------
echo "==> extracting bbox ${BBOX} up to z${MAXZOOM}"
"$PMTILES_BIN" extract "https://build.protomaps.com/${BUILD}.pmtiles" "$OUT/venue.pmtiles" \
  --bbox="$BBOX" --maxzoom="$MAXZOOM" --download-threads=8

# ---------------------------------------------------------------------------
# 4. Glyphs. MapLibre renders text from SDF glyph ranges, not system fonts, and
#    refuses to draw any label without them. 0-255 covers Latin + Latin-1
#    Supplement, which is every label in a US venue extract; widen the range
#    list if you deploy somewhere it is not.
# ---------------------------------------------------------------------------
echo "==> fetching glyph ranges"
for STACK in "Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic"; do
  mkdir -p "$OUT/fonts/$STACK"
  for RANGE in "0-255" "256-511"; do
    [ -s "$OUT/fonts/$STACK/$RANGE.pbf" ] && continue
    curl -fsSL --create-dirs -o "$OUT/fonts/$STACK/$RANGE.pbf" \
      "$ASSETS/fonts/$(printf %s "$STACK" | sed 's/ /%20/g')/$RANGE.pbf"
  done
done

# ---------------------------------------------------------------------------
# 5. Sprites (POI icons). Optional in the sense that MapLibre renders without
#    them, but it logs an error per missing icon and the map looks broken.
# ---------------------------------------------------------------------------
echo "==> fetching sprites"
mkdir -p "$OUT/sprites"
for F in "light.json" "light.png" "light@2x.json" "light@2x.png"; do
  [ -s "$OUT/sprites/$F" ] && continue
  curl -fsSL -o "$OUT/sprites/$F" "$ASSETS/sprites/v4/$F" || echo "    (skipped $F)"
done

# ---------------------------------------------------------------------------
# 6. Mirror into the root wrapper's public/ when there is one.
#
#    This repo is a two-layer monorepo and the app is normally run from the
#    ROOT, not from core/ — so the public directory Next.js actually serves is
#    the root's, and assets written only to core/public/ are invisible at
#    runtime. core/ can also be run standalone, so the assets have to exist in
#    both places rather than only one. It is ~6 MB, both copies are gitignored,
#    and a stale copy in the wrong tree is a far more expensive bug to find than
#    the disk this wastes.
# ---------------------------------------------------------------------------
if [ -f "../next.config.js" ] && [ -d "../public" ]; then
  echo "==> mirroring into root wrapper public/"
  mkdir -p "../public/basemap"
  cp -R "$OUT/." "../public/basemap/"
fi

echo
echo "Done. $(du -sh "$OUT" | cut -f1) in $OUT"
echo
echo "Enable it by setting, in .env.local:"
echo "  NEXT_PUBLIC_BASEMAP_PMTILES_URL=/basemap/venue.pmtiles"
echo
echo "Basemap data © OpenStreetMap contributors, ODbL. The attribution is"
echo "rendered by the map control and must not be removed — see §9 Licensing."
