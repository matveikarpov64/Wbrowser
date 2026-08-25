#!/usr/bin/env python3
"""Turns wb's arguments into the engine's command JSON.

Building JSON by concatenating strings in the shell breaks once quotes, backslashes,
or non-ASCII text get mixed in. A single " in a search term is enough to silently
send the wrong command.

Usage: mkcmd.py <op> [args...]
"""
import json
import os
import sys


def build(argv):
    if not argv:
        raise SystemExit("mkcmd: no op given")
    op, rest = argv[0], argv[1:]

    if op == "go":
        return {"goto": rest[0], "read": True}
    if op == "read":
        return {"read": True}
    if op == "click":
        return {"click": rest[0], "wait": 1200, "read": True}
    if op == "type":
        # Preserve spaces in the text as-is — join all the remaining arguments.
        # 🔵 --fast sets the value in one shot instead of typing it. Quicker on long text
        #    in a plain field, but it is not what a person does, and sites that re-render
        #    while you type will drop part of it. Opt-in for that reason.
        args = list(rest)
        fast = False
        if "--fast" in args:
            args.remove("--fast")
            fast = True
        cmd = {"type": {"selector": args[0], "text": " ".join(args[1:])}}
        if fast:
            cmd["type"]["fast"] = True
        return cmd
    if op == "press":
        return {"press": rest[0], "wait": 1800, "read": True}
    if op == "shot":
        return {"shot": True}
    if op == "console":
        # If a first argument is present, use it as a filter (regex)
        c = {"console": True, "errors": True, "limit": 60}
        if rest:
            c["filter"] = " ".join(rest)
        return c
    if op == "errors":
        return {"errors": True, "limit": 60}
    if op == "network":
        c = {"network": True, "limit": 60}
        if rest:
            c["filter"] = " ".join(rest)
        return c
    if op == "eval":
        return {"eval": " ".join(rest)}
    raise SystemExit("mkcmd: unknown op %r" % op)


if __name__ == "__main__":
    cmd = build(sys.argv[1:])
    # The account comes in via an environment variable — mixed in as a positional
    # argument it becomes indistinguishable from the text.
    acct = os.environ.get("WIN_ACCOUNT_RESOLVED", "").strip()
    if acct:
        cmd["account"] = acct
    # 🔵 Attach which agent opened the tab to its title — the user has to be able to
    #    tell them apart by eye in the Chrome tab bar. If we don't pass it, no marker appears.
    agent = os.environ.get("WIN_AGENT", "").strip()
    if agent:
        cmd["agent"] = agent
    print(json.dumps(cmd, ensure_ascii=False))
