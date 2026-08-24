# Changelog

Notable changes per release. Dates are the release date; the repository history
has the detail.

---

## 0.3.0 — 2026-08-24

**One command to install, and it survives being run twice.**

### Added
- `setup.sh` — installs from nothing in one line on macOS, Linux and WSL. Checks
  what you have, clones, installs, puts `wb` on your PATH, opens the browser.
  Windows-native gets sent to a documented PowerShell route instead: `wb` is a
  bash script and does not run there, so `node bin\wbrowser.js` stands in for it.
- Setup stops a running engine and MCP server before installing, and waits for
  the ports to free. Re-running it lands you in a known state rather than a
  second copy that dies on `EADDRINUSE` while the old one keeps serving.
- CI now rejects non-ASCII in `setup.sh`, and `CONTRIBUTING.md` says why.

### Fixed
- `wb` resolves symlinks before locating its own directory, so putting it on your
  PATH (`ln -s .../wb ~/.local/bin/wb`) works. It previously looked for
  `engine.js` next to the symlink and failed there.
- The clone URL in all four READMEs contained a `<your-account>` placeholder —
  copying the first command failed.

### Documentation
- "After a reboot" — one command, `wb up`, in all four languages. The boot
  section previously covered only the systemd service, which starts the engine
  and not the browser, so it never answered the actual question.
- macOS and Windows are now told there is no auto-start installer yet, rather
  than being left to infer it from a Linux-only snippet.
- A warning not to hand-roll a shortcut passing `--remote-debugging-port` on your
  normal profile: Chrome 136 (March 2025) ignores it there and says nothing, so
  it looks like Wbrowser is broken.

### Notes for anyone verifying
`setup.sh` is deliberately pure ASCII. A Korean Windows console runs in CP949,
where a check mark has no representation at all — the output becomes question
marks and a garbled installer reads as a failed install. ASCII shares 0x00–0x7F
with CP949, EUC-KR and UTF-8, so it renders the same everywhere.

The Windows-native path in `setup.sh` has been code-reviewed but not executed —
the machine that verified Windows for 0.1.0 currently cannot run Windows binaries
from WSL. Treat it as unverified until someone runs it.

---

## 0.2.0 — 2026-08-24

**Hand a tab over mid-task.**

### Added
- `./wb tabs` is numbered and shows who is driving each tab.
- `./wb take <#>` hands a tab you are on to the agent, which carries on from the
  page you built — no re-login, no re-navigating.
- `./wb release` gives it back, label and all.

### Fixed
- **An agent could take over the tab you were reading.** The default `main` tab
  adopted whatever page was already open, which was usually yours; it would then
  click and type there and relabel the title. Checking which tabs look "unused"
  cannot fix this — a tab you opened by hand is claimed by nobody and looks free
  by every test — so adoption was removed. An agent now opens its own tabs and
  drives only those.
- The tab key included the account, which is only resolved for commands carrying
  a URL. A `goto` and the `read` right after it keyed differently, so the second
  opened a fresh page where your work had been.
- Restarting the engine abandoned every tab it was driving while those tabs sat
  open in Chrome. The agent and tab name are now written into the page itself and
  adopted back. Each probe is capped at 800ms — `evaluate` waits for a ready
  page, and one mid-navigation tab otherwise stalls the whole scan.
- Tab numbering comes from the engine alone. It used to be counted in two places,
  so `take 3` could mean a different tab than the 3 you had just read.

### Changed
- The version lives only in `package.json`; `mcp-server.js` reads it. Two copies
  of a version number drift the moment someone bumps one of them.

---

## 0.1.0 — 2026-08-23

First public release. Drive the Chrome you are already logged into, from your
terminal or any AI assistant.

- Cross-platform: macOS, Linux, Windows and WSL — one launcher.
- Uses your existing sessions. No re-login; your password is never handed over.
- Per-agent tabs, with a translucent border and an `[agent]` tab label showing
  who is driving.
- MCP server: stdio locally, or HTTP with a mandatory token.
- Scheduled jobs, with submit/pay/delete blocked by default in unattended runs.
- Console and network inspection, including uncaught exceptions.

Verified on four platforms, each by a different person on a different machine —
except WSL2, which is the maintainer's own.
