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

There is no test suite yet. What we do have:

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

Verified on macOS, native Linux and WSL2. Windows-native is implemented but has not
been measured — if you run it there, a report either way is genuinely useful.

If you touch platform detection (`chromeCandidates()`, `isWSL()`, `stateDir()`),
please say which OS you actually ran it on. "Should work" and "does work" are
different claims, and this project has been bitten by the gap.

## Pull requests

- One concern per PR.
- Say what you measured, not just what you changed.
- If you remove a comment that explains *why*, please put the reason somewhere else.
  Those comments are the only record of bugs that already cost someone a day.
