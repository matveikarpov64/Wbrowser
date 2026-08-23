#!/usr/bin/env python3
"""Exports the browser session (cookies) to a file and imports it back.

🔴 Never print cookie values to the screen. Report only counts and domains.
   Cookies alone are enough to log in, so treat them in the same class as a password.

Usage: session_io.py <export|import> <engine-url> <file-path>
"""
import json
import os
import sys
import urllib.request


def roots(cookies):
    """Counts domains folded to two levels (a.b.google.com → google.com)."""
    out = {}
    for c in cookies:
        h = (c.get("domain") or "").lstrip(".")
        parts = h.split(".")
        if len(parts) >= 3 and parts[-2] in ("co", "com", "or", "ne", "go", "ac"):
            key = ".".join(parts[-3:])
        else:
            key = ".".join(parts[-2:]) if len(parts) >= 2 else h
        if key:
            out[key] = out.get(key, 0) + 1
    return out


def do_export(engine, path):
    try:
        with urllib.request.urlopen(engine + "/session", timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print("❌ Could not read the session from the engine:", e)
        return 1

    cookies = data.get("cookies") or []
    if not cookies:
        print("❌ No cookies — is this really a logged-in browser? (./wb logins)")
        return 1

    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)          # atomic swap — never leaves a half-written file behind
    os.chmod(path, 0o600)

    r = roots(cookies)
    print(f"✅ Backup complete — {len(cookies)} cookies / {len(r)} domains")
    print("   Profile:", data.get("profile") or "(unknown)")
    top = sorted(r.items(), key=lambda x: -x[1])[:10]
    print("   " + ", ".join(f"{d}({n})" for d, n in top))
    return 0


def do_import(engine, path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print("❌ Could not read the backup file:", e)
        return 1

    cookies = data.get("cookies") or []
    if not cookies:
        print("❌ The backup has no cookies")
        return 1

    body = json.dumps({"cookies": cookies}).encode()
    req = urllib.request.Request(engine + "/session", data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            res = json.loads(r.read().decode("utf-8"))
    except Exception as e:
        print("❌ Restore failed:", e)
        return 1

    if res.get("error"):
        print("❌", res["error"])
        return 1

    print(f"✅ Restore complete — {res.get('added')} injected")
    if res.get("skippedExpired"):
        print(f"   🔵 Skipped {res['skippedExpired']} expired cookies")
    print("   Backed up at:", data.get("savedAt", "(unknown)"))
    print("   🔵 Refresh the site and the logged-in state will show up.")
    return 0


def main():
    if len(sys.argv) < 4:
        print("Usage: session_io.py <export|import> <engine-url> <file-path>")
        return 2
    op, engine, path = sys.argv[1], sys.argv[2], sys.argv[3]
    if op == "export":
        return do_export(engine, path)
    if op == "import":
        return do_import(engine, path)
    print("Unknown command:", op)
    return 2


if __name__ == "__main__":
    sys.exit(main())
