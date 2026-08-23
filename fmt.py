#!/usr/bin/env python3
"""Prints wb's JSON responses in a human-readable form.

Left as an inline `python3 -c`, it breaks once shell quoting and f-string escaping
get mixed together (it actually broke — 2026-08-23). Keeping it as a file removes that layer.
"""
import json
import sys


def sel_of(x):
    """Builds a selector pointing at an input field. Most specific first: id > name > tag."""
    if x.get("id"):
        return "#" + x["id"]
    if x.get("name"):
        return "[name=%s]" % x["name"]
    return x.get("tag") or "?"


def main():
    raw = sys.stdin.read()
    try:
        d = json.loads(raw)
    except Exception:
        # If it can't be parsed, show the raw text as-is. We do not swallow it silently.
        print(raw.strip() or "(empty response — is the engine up? ./wb status)")
        return 1

    if "error" in d:
        print("❌ " + str(d["error"]))
        return 1

    if d.get("done"):
        # Also print which account's window it happened in — essential when there are several accounts.
        acct = d.get("account")
        prefix = "[%s] " % acct if acct else ""
        print("· " + prefix + ", ".join(d["done"]))

    # eval result
    if "result" in d:
        v = d["result"]
        print("  result:", json.dumps(v, ensure_ascii=False)[:1200]
              if not isinstance(v, str) else v[:1200])
    if d.get("evalError"):
        print("  ❌ execution error:", d["evalError"])

    ICON = {"error": "🔴", "warning": "🟡", "warn": "🟡", "info": "🔵", "log": "  ", "debug": "  "}

    con = d.get("console")
    if con is not None:
        print("  console (%d)" % len(con))
        for m in con:
            where = ""
            if m.get("url"):
                where = "  ← %s:%s" % (m["url"].rsplit("/", 1)[-1][:28], m.get("line", ""))
            print("   %s %s%s" % (ICON.get(m.get("type"), "  "),
                                  (m.get("text") or "").replace("\n", " ")[:110], where))
        if not con:
            print("   (none)")

    errs = d.get("errors")
    if errs is not None:
        print("  uncaught exceptions (%d)" % len(errs))
        for e in errs:
            print("   🔴 %s" % (e.get("message") or "")[:110])
            for ln in (e.get("stack") or "").split("\n")[1:3]:
                if ln.strip():
                    print("      %s" % ln.strip()[:100])
        if not errs:
            print("   (none)")

    net = d.get("network")
    if net is not None:
        print("  failed requests (%d)" % len(net))
        for r in net:
            tag = r.get("status") or r.get("failure") or "?"
            print("   🔴 %-22s %s" % (str(tag)[:22], (r.get("url") or "")[:80]))
        if not net:
            print("   (none)")

    p = d.get("page")
    if not p:
        return 0

    print("  title:", p.get("title"))
    print("  url  :", (p.get("url") or "")[:100])
    if p.get("h1"):
        print("  h1  :", p["h1"])

    links = p.get("links") or []
    if links:
        print("  links(%d):" % len(links))
        for a in links[:8]:
            print("    - %s  →  %s" % (a.get("text", ""), (a.get("href") or "")[:60]))

    buttons = p.get("buttons") or []
    if buttons:
        print("  buttons(%d): %s" % (len(buttons), ", ".join(buttons[:8])))

    inputs = p.get("inputs") or []
    if inputs:
        print("  inputs(%d):" % len(inputs))
        for x in inputs[:8]:
            hint = x.get("placeholder") or x.get("type") or ""
            print("    - %s  (%s)" % (sel_of(x), hint))

    return 0


if __name__ == "__main__":
    sys.exit(main())
