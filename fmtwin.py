#!/usr/bin/env python3
"""Shows the /windows response together with the account names.

The engine only knows the profile 'path'. Which account that path belongs to is
owned by Chrome's Local State (info_cache), so we join the two here.
"""
import json
import os
import sys


def account_map(user_data_dir):
    """Profile folder name -> account email. Empty dict if it can't be read."""
    ls = os.path.join(user_data_dir, "Local State")
    try:
        with open(ls, encoding="utf-8", errors="replace") as f:
            cache = json.load(f).get("profile", {}).get("info_cache", {})
    except Exception:
        return {}
    return {k: (v.get("user_name") or v.get("name") or "") for k, v in cache.items()}


def wsl(win_path):
    if not win_path or len(win_path) < 3 or win_path[1] != ":":
        return None
    return "/mnt/%s/%s" % (win_path[0].lower(), win_path[2:].replace("\\", "/").lstrip("/"))


def main():
    try:
        d = json.load(sys.stdin)
    except Exception:
        print("❌ Could not read the engine response — ./wb status")
        return 1
    if "error" in d:
        print("❌", d["error"])
        return 1

    wins = d.get("windows") or []
    if not wins:
        print("No open windows.")
        return 0

    # The account dictionary is keyed off the User Data folder, so build it only once
    amap = {}
    for w in wins:
        p = w.get("profilePath")
        if p and "User Data" in p:
            base = wsl(p.rsplit("\\", 1)[0])
            if base:
                amap = account_map(base)
                break

    print("%d open browser windows" % len(wins))
    print()
    for w in wins:
        prof = w.get("profile")
        path = w.get("profilePath")
        if w.get("isAgentOnly"):
            label = "🔴 Empty dedicated window (no logins)"
        elif prof and amap.get(prof):
            label = "✅ %s" % amap[prof]
        elif prof:
            label = "🔵 %s (account unconfirmed)" % prof
        else:
            label = "🔵 Profile unknown"

        print("  %s" % label)
        if prof and not w.get("isAgentOnly"):
            print("     select with: --account %s   or  --account %s"
                  % (prof, (amap.get(prof) or "").split("@")[0] or prof))
        for t in (w.get("tabs") or [])[:6]:
            u = t.get("url") or ""
            if u.startswith("chrome://"):
                continue
            print("     · %s" % u[:78])
        print()

    if not amap and any(w.get("profilePath") for w in wins):
        print("🔵 Could not read the account names — please select by profile folder name.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
