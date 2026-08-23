#!/usr/bin/env bash
# install.sh — registers the Wbrowser engine as a systemd user service (Linux / WSL).
#
# The browser is not registered — it is a desktop process, and it's right that the
# user decides when a window appears.
#
# macOS uses launchd (see the guidance printed below). Windows uses Task Scheduler.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { echo "❌ $*" >&2; exit 1; }

echo "Wbrowser install"
echo "  path: $DIR"
echo

# ── Preflight checks ─────────────────────────────────────────────────
NODE="$(command -v node)" || die "Cannot find node. Please install Node 18+."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$NODE_MAJOR" -ge 18 ] || die "Node 18 or later is required (current: $(node -v))"
echo "  ✅ node $(node -v)  ($NODE)"

# ── Platform ────────────────────────────────────────────────────────
case "$(uname -s)" in
  Darwin)
    cat <<'MAC'

  🔵 On macOS, launchd is used instead of systemd.
     Create ~/Library/LaunchAgents/com.wbrowser.engine.plist and put the
     paths to node and engine.js into ProgramArguments.

     If you just want to use it right now, this works too:
        node engine.js &
MAC
    exit 0
    ;;
  Linux) ;;
  *)
    echo "  🔵 Automatic registration is not supported on this platform."
    echo "     Run manually: node engine.js"
    exit 0
    ;;
esac

[ -d "$DIR/node_modules/playwright" ] || {
  echo "  · Installing dependencies…"
  (cd "$DIR" && npm install --no-audit --no-fund) || die "npm install failed"
}
echo "  ✅ dependencies"

command -v systemctl >/dev/null 2>&1 || {
  echo "  🔵 systemd is not present. Please run manually: node engine.js"
  exit 0
}
systemctl --user show-environment >/dev/null 2>&1 || {
  echo "  🔵 The systemd user session is unavailable (container, etc.)."
  echo "     Run manually: node engine.js"
  exit 0
}

# ── Service registration ─────────────────────────────────────────────
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"

# 🔴 Fill the template placeholders with measured values. Hardcoding paths in the
#    document makes it break silently on someone else's machine.
sed -e "s|__WBROWSER_DIR__|$DIR|g" \
    -e "s|__NODE_BIN__|$NODE|g" \
    "$DIR/wbrowser.service" > "$UNIT_DIR/wbrowser.service" \
  || die "Failed to create the service file"

systemctl --user daemon-reload
systemctl --user enable --now wbrowser.service >/dev/null 2>&1 || die "Service registration failed"

sleep 2
if systemctl --user is-active --quiet wbrowser.service; then
  echo "  ✅ Service registered and started"
else
  echo "  🔴 The service did not come up:"
  systemctl --user status wbrowser.service --no-pager -n 10 2>&1 | sed 's/^/     /'
  exit 1
fi

cat <<EOF

Next steps
  1) node launch.js          opens the dedicated Chrome window
  2) Log in yourself in that window (this tool never handles your password)
  3) ./wb go https://example.com

Check status:  systemctl --user status wbrowser
Stop:          systemctl --user stop wbrowser
Remove:        systemctl --user disable --now wbrowser && rm $UNIT_DIR/wbrowser.service
EOF
