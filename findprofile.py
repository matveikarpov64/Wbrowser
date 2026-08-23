#!/usr/bin/env python3
"""Finds the Chrome profile folder name from an account hint.

  findprofile.py work@example.com      -> Profile 1
  findprofile.py vibecodellm      -> Default
  findprofile.py "Profile 3"      -> Profile 3   (passed through as-is)

If nothing is found it prints nothing and exits 1 —
🔴 it does not pick something similar. Failing beats opening the wrong account's window.
"""
import glob
import json
import os
import sys


def profiles_root():
    """The copy if there is one, otherwise the original Chrome folder."""
    for home in glob.glob("/mnt/c/Users/*"):
        cand = os.path.join(home, ".wbrowser")
        if os.path.isdir(cand):
            return cand
    for home in glob.glob("/mnt/c/Users/*"):
        cand = os.path.join(home, "AppData/Local/Google/Chrome/User Data")
        if os.path.isdir(cand):
            return cand
    return None


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        return 1
    hint = sys.argv[1].strip()

    root = profiles_root()
    if not root:
        return 1

    # When the folder name itself was given
    if os.path.isdir(os.path.join(root, hint)):
        print(hint)
        return 0

    try:
        with open(os.path.join(root, "Local State"), encoding="utf-8", errors="replace") as f:
            cache = json.load(f).get("profile", {}).get("info_cache", {})
    except Exception:
        return 1

    want = hint.lower()
    # ① exact account email match → ② partial match → ③ partial display-name match
    for key in ("exact", "partial", "name"):
        for folder, info in cache.items():
            email = (info.get("user_name") or "").lower()
            label = (info.get("name") or "").lower()
            if key == "exact" and email == want:
                print(folder); return 0
            if key == "partial" and want and want in email:
                print(folder); return 0
            if key == "name" and want and want in label:
                print(folder); return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
