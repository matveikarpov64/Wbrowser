# Changelog

Notable changes per release. Dates are the release date; the repository history
has the detail.

---

## Unreleased

### Fixed
- **`wb shot` photographed the wrong tab.** It sent a bare `{"shot":true}` instead of
  going through the command builder, so no agent name was attached — and the engine
  resolves an empty agent to a *different* tab, the one owned by the unnamed agent.
  The result was a screenshot of a blank page while every other command in the same
  session worked correctly.

  Measured 2026-08-25: 4,742 bytes of white where the real page was 253,713. Nothing
  reported an error — the file was written, the command said `Saved:`, and the image
  looked plausible until opened. Found while testing whether screenshots could be
  strung together into a demo GIF.
- **`wb show` had the same defect**, which mattered more: it exists to raise the
  agent's window when you cannot tell which Chrome is which, and without the agent name
  it would touch whichever tab the unnamed agent owned — pointing at the wrong window
  while claiming to point at the right one.

---

## 0.4.3 — 2026-08-25

**Every dial read normal while the tool would not work. Fixed the leak, and made the
tool say what is wrong.**

### Fixed
- **The engine closes its browser connection on the way out.** Playwright creates an
  isolated "utility world" per frame when it attaches over CDP, and **Chrome keeps them
  for the life of the browser** — measured 2026-08-25: `browser.close()` does not remove
  them, so each fresh `connectOverCDP` leaves one per open tab behind regardless of how
  it ends. They are harmless sitting there, but the *next* connect receives one event per
  world, so attach time grows with every reconnect until it exceeds the timeout and the
  browser cannot be driven at all.

  🔵 Normal use does not reconnect: the engine attaches once and reuses it, verified by
  running `wb` commands and watching the count stay flat. The cost lands on **restarts** —
  and the shutdown handler does not prevent that, it only stops the engine holding a
  connection open when it should not. Restart the engine often enough and the browser
  still degrades, which is why the diagnostic below matters more than the handler.

  Measured: 723 stale worlds after a run of `kill -9` during development, and
  `connectOverCDP` could not finish in 25s. What made it expensive to find is that
  everything else looked healthy — Chrome reported `Responding=true`, `/json/version`
  and `/json/list` answered instantly, the websocket handshake completed in 2ms, and a
  raw CDP command came back in 7ms. Only a count was wrong, and nothing counted it.
- **Connect failures now say which failure it is.** "Chrome is not running" and "Chrome
  answers but will not attach" need different responses, and the second one is the case
  where retrying actively makes things worse. Both messages lead with the instruction —
  *do not retry, restart Chrome* — because someone hitting this is mid-task and reads
  one line before deciding. Measured: 723 → 911 stale worlds in twenty minutes, almost
  entirely from two people diagnosing the same failure.
- **`wb status` prints the engine's diagnosis.** It grepped `/health` for `"ok"` and
  discarded the rest, so the engine was reporting the real cause while status showed a
  bare `❌ Engine`. Someone read that output dozens of times and went looking outside
  the tool, because the tool appeared to have nothing to say.
- **`wb status` knows which profile it is driving.** `launch.js` records the profile in
  `runtime.json`; `whoami` never read it, so when Chrome 151 declined to report
  `userDataDir` over CDP the status line said `Profile unknown`. The answer was on disk
  the whole time — and `unknown` reads as a finding rather than a gap, which is worse
  than silence: it prompted a reasonable worry that the agent might be driving a
  personal Chrome. Guarded on the CDP port matching so a stale file is ignored.

---

## 0.4.2 — 2026-08-25

**A clone now gets everything: the tool, the instructions, and a label that cannot
silently go missing.**

### Added
- **The agent skill ships with the tool** — `skills/wbrowser/SKILL.md`, copied to
  `~/.claude/skills/wbrowser/` by `setup.sh`. Until now the binary landed on your PATH
  and nothing told your assistant the tool existed, so a fresh clone had `wb` available
  and no idea when to use it, how to find selectors, or what it must never do (type a
  password, print a cookie, close your Chrome). Installing a tool without its
  instructions is half an install.
  - Setup will not overwrite a `SKILL.md` you edited; it writes `SKILL.md.new` and says so.

### Changed
- **`setup.sh` now registers the systemd user service itself** on Linux and WSL,
  instead of printing a suggestion to run `./install.sh` afterwards. A step people have
  to read about at the end is a step most people skip — and the symptom shows up much
  later, as "Engine is not running" in some other session after a reboot.
  - Where systemd is unavailable (common on WSL) it says so and tells you to run
    `wb up` after a reboot, rather than failing quietly or claiming success.
- `setup.sh` gained a `warn` helper. Three of the new steps can legitimately not run,
  and each one now prints why. A step that silently skips looks exactly like one that
  worked.

### Fixed
- **The tab label could not be turned off by accident.** `wb` derives the agent name
  from the working directory (`.../AGENT/<name>`), and when it could not find one it
  returned an empty string — on the reasoning that no name is better than a made-up
  one. The effect was the opposite of safe: the `[agent] ` title prefix and the
  "in control" banner simply did not appear, with no warning, while the automation
  worked normally. So the one feature that tells a human an agent is driving their
  window was off, silently, and nothing said so.

  Measured 2026-08-25: running `./wb go` from the repository root — which is what a
  fresh clone does — produced a plain `Google` title and no banner. It now falls back
  to `agent@<user>`. A generic name still makes the true claim: something automated is
  driving this tab.
- **`wb tabs` no longer truncates the owner column.** It cut names to 13 characters,
  so `wbrowser-primary::main` printed as `wbrowser-prim`, and an unnamed agent printed
  as `::main` — which reads as though the tab belongs to nobody. This column exists to
  answer "whose tab is this"; a cut name answers it wrongly rather than not at all.
  The column is now sized to the data.

---

## 0.4.1 — 2026-08-25

**Published to npm, and registered so the MCP Registry can verify we own it.**

### Added
- `server.json` — the MCP Registry manifest. Declares this as an npm package with a
  stdio transport under the name `io.github.w-partners/wbrowser`.
- `mcpName` in `package.json`. The registry verifies ownership by checking that this
  matches the name in `server.json`, so the two are kept in step deliberately.

### Changed
- Package description no longer says "already-logged-in Chrome". It never was — you
  sign into a dedicated profile once, by hand (see 0.4.0's README correction). The
  npm page renders this string, so leaving it would have republished the same claim
  we had just removed from the README.
- `.gitignore` allows `/server.json`. The ignore file is an allow-list, so a new
  top-level file is invisible until it is named — the same thing happened to
  `/scripts/` in 0.4.0.

---

## 0.4.0 — 2026-08-24

**You can now tell which version you have, and whether a newer one exists.**

### Added
- `./wb version` (also `--version`, `-v`) — prints your version and checks GitHub
  for a newer release. Until now a clone had no way to answer either question, so
  nobody downstream could know an update existed.
  - 🔴 A failed lookup says *"could not reach GitHub"*, never *"up to date"*.
    Offline and current are different facts and are reported differently.
  - Skip the network check with `WBROWSER_NO_UPDATE_CHECK=1`. It never blocks the
    command and never changes its exit status.
  - Tells forks how to pull upstream, since a fork does not follow this repo.
- `scripts/install-hooks.sh` + `scripts/pre-commit` — the pre-commit guard now
  ships as a normal file you can install. It only ever lived in `.git/hooks`,
  which git does not clone, so CONTRIBUTING told people to install something the
  repo did not contain. Installing is explicit: it never touches `core.hooksPath`,
  is not wired into `npm install`, and refuses to overwrite an existing hook.

### Fixed
- `.gitignore` allow-list had no entry for `/scripts/`, so new source files there
  were silently ignored — the opposite of what an allow-list is for.

### Documentation
- Says plainly what the arrangement is: nothing is copied. The profile holds
  cookies; your data stays on the provider's servers, and the agent reaches it the
  way your phone does. Both halves are stated — no stale copy and no second store
  to secure, but also no sandbox: when the agent opens your mail, it is your mail,
  with exactly your access. All four languages.
- Verification tables now say the same thing in both places, and WSL2 is marked
  maintainer self-verified in all four languages — the badge previously flattened
  that distinction by covering it with a single "verified".
- The zh and es editions gained the intro verification table they were missing;
  those readers could not previously see who had checked what.
- Records that headless was confirmed from process arguments, and why the
  User-Agent cannot answer that question.

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
