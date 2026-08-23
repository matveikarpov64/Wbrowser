#!/usr/bin/env bash
# sync-session.sh — exports the browser login session (cookies) to a file and restores it.
#
#   ./sync-session.sh export [path]   live browser → file
#   ./sync-session.sh import [path]   file → live browser
#   ./sync-session.sh status [path]   what is stored
#
# Default storage location: $WBROWSER_SESSION_FILE, or ./wbrowser-session.json if unset
#
# 🔴 This file is in the same class as a password — **cookies alone are enough to log in.**
#    This script writes the file as plaintext JSON. Keeping it safe is up to the user:
#      · When moving it to another machine, encrypt it first (age, gpg, git-crypt …)
#      · Do not commit it to the repository (it's already in .gitignore)
#      · Set the file permissions to 0600 (this script does that)
#
# 🔴 Why not copy the profile folder
#    Chrome invalidates a profile it doesn't recognize. Measured: 685 cookies → 3, sessions wiped out.
#    Reading via the official playwright API and writing back via the official API survives (76 → 76 confirmed).
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE="http://127.0.0.1:${WBROWSER_PORT:-7981}"

die() { echo "❌ $*" >&2; exit 1; }

CMD="${1:-status}"
# 🔴 The default must not live inside the repo — a user running `git add -A`
#    would commit their entire login. Use the OS state directory.
_state_dir() {
  if [ -n "${WBROWSER_STATE_DIR:-}" ]; then echo "$WBROWSER_STATE_DIR"; return; fi
  case "$(uname -s)" in
    Darwin) echo "$HOME/Library/Application Support/wbrowser" ;;
    MINGW*|MSYS*|CYGWIN*) echo "${LOCALAPPDATA:-$HOME}/wbrowser" ;;
    *) echo "${XDG_STATE_HOME:-$HOME/.local/state}/wbrowser" ;;
  esac
}
FILE="${2:-${WBROWSER_SESSION_FILE:-$(_state_dir)/session.json}}"

_browser_up() {
  # 🔴 Don't just look at "ok" — the engine being alive with no browser also returns 200.
  #    To read and write cookies the browser must actually be attached.
  curl -s --max-time 5 "$ENGINE/health" 2>/dev/null | grep -q '"browser": true'
}

case "$CMD" in

  export)
    _browser_up || die "The browser is not running — run node launch.js and try again (./wb status)"
    mkdir -p "$(dirname "$FILE")" 2>/dev/null
    python3 "$DIR/session_io.py" export "$ENGINE" "$FILE" || exit 1
    chmod 600 "$FILE" 2>/dev/null
    echo
    echo "🔴 This file is the login itself. Do not commit it to a repository."
    echo "   When moving it to another machine, encrypt it first. For example:"
    echo "     age -p -o session.age '$FILE'      # on the receiving side: age -d session.age > ..."
    ;;

  import)
    [ -f "$FILE" ] || die "No backup file: $FILE"
    # Prevent the accident of pushing ciphertext straight in (a file wrapped by age/gpg/git-crypt)
    head -c 32 "$FILE" | tr -d '\0' | grep -qE 'GITCRYPT|age-encryption|BEGIN PGP' \
      && die "This file is encrypted. Please decrypt it first, then import."
    _browser_up || die "The browser is not running — run node launch.js and try again"
    python3 "$DIR/session_io.py" import "$ENGINE" "$FILE" || exit 1
    ;;

  status)
    echo "Storage location: $FILE"
    if [ ! -f "$FILE" ]; then
      echo "  (not there yet — ./sync-session.sh export)"
    elif head -c 32 "$FILE" | tr -d '\0' | grep -qE 'GITCRYPT|age-encryption|BEGIN PGP'; then
      echo "  🔒 This file is encrypted (decrypt it, then import)"
    else
      python3 -c "
import json,sys
try:
    d=json.load(open(sys.argv[1],encoding='utf-8'))
    ck=d.get('cookies') or []
    doms=sorted({(c.get('domain') or '').lstrip('.') for c in ck})
    print(f'  {len(ck)} cookies / {len(doms)} domains')
    print('  Saved at:', d.get('savedAt','(unknown)'))
    print('  Domains:', ', '.join(doms[:12]) + (' …' if len(doms)>12 else ''))
except Exception as e:
    print('  ❌ Failed to read:', e)
" "$FILE"
      P=$(stat -c '%a' "$FILE" 2>/dev/null || stat -f '%Lp' "$FILE" 2>/dev/null)
      [ "$P" = "600" ] && echo "  permissions: 600 ✅" || echo "  🔴 permissions: ${P:-?} — chmod 600 recommended"
    fi
    ;;

  *)
    awk 'NR>1 && /^#/ {sub(/^# ?/,""); print; next} NR>1 {exit}' "${BASH_SOURCE[0]}"
    ;;
esac
