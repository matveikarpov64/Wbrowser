#!/usr/bin/env bash
# make-demo.sh — record a demo GIF in a throwaway profile.
#
# 🔴 Why a separate profile and port: your normal profile is signed in. Anything you
#    record there puts account names, mail subjects and open tabs into a file you are
#    about to publish. This launches a Chrome that has never been signed into, on its
#    own CDP port, so there is nothing private to leak — and it leaves your real
#    browser running and untouched.
#
# Usage:  scripts/make-demo.sh [out.gif]
#
# Requires ffmpeg.

set -uo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-demo.gif}"
PORT_CDP=9333
PORT_ENGINE=7982
FRAMES="$(mktemp -d)"

command -v ffmpeg >/dev/null || { echo "❌ ffmpeg is required"; exit 1; }

# 🔵 A Windows-style path is needed when driving Windows Chrome from WSL; elsewhere the
#    POSIX one is right. launch.js takes whatever it is given, so pick per platform.
case "$(uname -s)" in
  Linux*) if grep -qi microsoft /proc/version 2>/dev/null; then
            PROFILE='C:\Users\'"${USER^}"'\.wbrowser-demo'
          else PROFILE="$HOME/.wbrowser-demo"; fi ;;
  *)      PROFILE="$HOME/.wbrowser-demo" ;;
esac

cleanup() {
  # 🔴 Only ever kill by listening port. Never pattern-match on process names or command
  #    lines to find "the demo browser" — measured 2026-08-25: a filter meant to match
  #    only the demo profile killed the user's signed-in Chrome instead, closing their
  #    open work. The port is the one property that is unambiguously ours.
  #
  #    🔵 And do not kill Chrome at all. It may have windows the user opened; closing the
  #    demo profile is their call. Say it is still open instead of guessing.
  local pid
  pid=$(ss -ltnp 2>/dev/null | grep ":$PORT_ENGINE " | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
  rm -rf "$FRAMES"
  echo "· The demo browser is still open (port $PORT_CDP) — close that window when done."
}
trap cleanup EXIT

echo "· Starting a clean browser (profile: $PROFILE, port $PORT_CDP)"
WBROWSER_PROFILE_DIR="$PROFILE" WBROWSER_CDP_PORT="$PORT_CDP" node launch.js >/dev/null 2>&1 \
  || { echo "❌ Could not start the demo browser"; exit 1; }

WBROWSER_CDP_PORT="$PORT_CDP" WBROWSER_PORT="$PORT_ENGINE" \
  nohup node engine.js >/dev/null 2>&1 &
for _ in $(seq 1 20); do
  curl -s --max-time 2 "http://127.0.0.1:$PORT_ENGINE/health" 2>/dev/null | grep -q '"ok"' && break
  sleep 0.5
done

export WBROWSER_CDP_PORT="$PORT_CDP" WBROWSER_PORT="$PORT_ENGINE" WIN_AGENT="wbrowser"

# 🔵 The point of the demo is the banner and the tab label — proof that a human can see
#    an agent is driving. So visit pages that are visually distinct and signed-out.
i=0
for url in https://github.com https://example.com https://news.ycombinator.com; do
  ./wb go "$url" >/dev/null 2>&1
  sleep 1
  i=$((i+1))
  # two copies of each frame so the viewer has time to read it
  ./wb shot "$FRAMES/$(printf 'f%02da' "$i").png" >/dev/null 2>&1
  cp "$FRAMES/$(printf 'f%02da' "$i").png" "$FRAMES/$(printf 'f%02db' "$i").png"
done

# 🔴 Check the frames are not blank before spending time on the encode. A screenshot of
#    the wrong tab is a white rectangle of a few KB, and it is only obvious once opened.
small=$(find "$FRAMES" -name '*.png' -size -10k | wc -l)
if [ "$small" -gt 0 ]; then
  echo "❌ $small frame(s) came out nearly empty — the screenshots did not capture the page."
  exit 1
fi

echo "· Encoding $OUT"
ffmpeg -y -framerate 1.6 -pattern_type glob -i "$FRAMES/f*.png" \
  -vf "scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" \
  -loop 0 "$OUT" >/dev/null 2>&1 \
  || { echo "❌ ffmpeg failed"; exit 1; }

echo "✅ $OUT  ($(wc -c < "$OUT") bytes)"
echo "   Recorded in a signed-out profile — check it before publishing anyway."
