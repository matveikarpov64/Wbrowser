# Contributing

Thanks for looking. This is a small tool — roughly 2,600 lines — so it should be
possible to read the whole thing in an afternoon before changing it.

## Before you start

**Run it first.** Most surprises in this codebase come from Chrome's behaviour, not
from the code. `./wb read` on a real page teaches more than reading `summarize()`.

## Ground rules that shaped this code

These are not style preferences — each one came from a bug we actually hit:

- **Never fail silently.** If something didn't happen, say so and say why.
  We once had `stdio: 'ignore'` swallow Chrome's "Missing X server" and report only
  "CDP not responding" — the symptom, with the cause deleted.
- **Don't guess when you can measure.** If the code can't determine something
  (which profile, which Chrome, which user), stop and say so. Do not pick a
  plausible default. A wrong guess writes files to a stranger's folder.
- **Distinguish a sign from a fence.** `.gitignore` is a sign — it only speaks to
  git. Writing outside the repo is a fence. Prefer fences.
- **Cookies are credentials.** They are never printed, logged, or returned outside
  the explicit export path.

## Testing

**There is no automated test suite.** That is the largest gap in this project right now.

CI checks syntax, executable bits, and that the remote MCP server refuses to start
without a token — but nothing exercises the browser. Everything else was measured by
hand on four platforms before release, which does not scale and won't catch your
regression or ours.

🔵 If you want to contribute something high-value, this is it. A harness that launches
headless Chrome and drives `/act` end-to-end would replace most of what we currently
do manually.

What exists today:

```bash
# syntax
node --check engine.js launch.js cron.js mcp-server.js journal.js
python3 -m py_compile *.py
bash -n wb install.sh sync-session.sh autostart.sh

# behaviour — needs a real Chrome
node launch.js && node engine.js &
./wb go https://example.com     # should print the page structure
./wb status                     # should say which profile it attached to
node cron.js list               # should list jobs without touching the browser
```

**Measure the failure paths too.** A launcher that works is half the story; one that
explains *why* it didn't work is the other half.

## Platform notes for contributors

Verified on macOS, native Linux (including headless), Windows native and WSL2 —
each on a different machine by a different person, except WSL2 which is the
maintainer's own.

If you touch platform detection (`chromeCandidates()`, `isWSL()`, `stateDir()`),
please say which OS you actually ran it on. "Should work" and "does work" are
different claims, and this project has been bitten by the gap.

### `setup.sh` uses ASCII only (0x00–0x7F)

**Write only ASCII there.** CP949, EUC-KR and UTF-8 all share that range byte for
byte, so ASCII renders identically on every console there is — no list of things to
avoid, and nothing to re-check per locale.

```bash
LC_ALL=C grep -n '[^ -~	]' setup.sh     # must print nothing (printable ASCII + tab)
```

Why it matters: a Korean Windows console runs in CP949, and a check mark has no CP949
representation at all — `iconv` refuses to encode it. The output becomes question
marks, and a garbled installer reads as a failed install. So `[ok]` and `[!!]` rather
than symbols, `--` rather than an em dash.

The rest of the project is UTF-8 and that is fine — it is read by editors, not by
cmd.exe. This applies to `setup.sh` because it is the one file that prints to a
console we do not control.

## Pull requests

- One concern per PR.
- Say what you measured, not just what you changed.
- If you remove a comment that explains *why*, please put the reason somewhere else.
  Those comments are the only record of bugs that already cost someone a day.
