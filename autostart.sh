#!/usr/bin/env bash
# Brings the agent browser up after a reboot.
#
# If it's already up, does nothing (idempotent) — safe to call repeatedly.
# Hook it into a WSL boot hook or cron @reboot.
#
#   Install:  crontab -e  →  @reboot <install-path>/autostart.sh
#   Manual:   ./autostart.sh
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_state_dir() {
  if [ -n "${WBROWSER_STATE_DIR:-}" ]; then echo "$WBROWSER_STATE_DIR"; return; fi
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Application Support/wbrowser" ;;
    MINGW*|MSYS*|CYGWIN*) echo "${LOCALAPPDATA:-$HOME}/wbrowser" ;;
    *) echo "${XDG_STATE_HOME:-$HOME/.local/state}/wbrowser" ;;
  esac
}
mkdir -p "$(_state_dir)" 2>/dev/null
LOG="$(_state_dir)/autostart.log"

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# 🔴 The only judge is the CDP response. The process list can't be trusted in this environment.
_cdp_up()    { curl -s --max-time 2 http://127.0.0.1:9222/json/version 2>/dev/null | grep -q Browser; }
_engine_up() { curl -s --max-time 2 http://127.0.0.1:7981/health 2>/dev/null | grep -q '"ok"'; }

if _cdp_up && _engine_up; then
  log "already up — doing nothing"
  echo "· Already running"
  exit 0
fi

log "starting up"
WIN_OWN_PROFILE=1 "$DIR/wb" up >> "$LOG" 2>&1
rc=$?

if _cdp_up && _engine_up; then
  log "startup succeeded"
  echo "✅ Agent browser ready"
  exit 0
fi

# 🔴 Do not fail silently. Record why it failed in the log and signal it with the exit code.
log "startup failed rc=$rc (cdp=$(_cdp_up && echo up || echo down) engine=$(_engine_up && echo up || echo down))"
echo "❌ Startup failed — log: $LOG"
tail -5 "$LOG"
exit 1
