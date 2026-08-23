<div align="center">

# 🤖 Wbrowser

**Drive the Chrome you're already logged into — from your terminal, or from any AI assistant.**

No API keys. No integrations. No re-logging-in.
Your browser, your sessions, your machine.

[English](README.md) · [한국어](docs/README.ko.md) · [中文](docs/README.zh.md) · [Español](docs/README.es.md)

[![check](https://github.com/w-partners/Wbrowser/actions/workflows/check.yml/badge.svg)](https://github.com/w-partners/Wbrowser/actions/workflows/check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
![Platforms](https://img.shields.io/badge/macOS%20%C2%B7%20Linux%20%C2%B7%20WSL%20%C2%B7%20Windows-verified-success)
![Windows](https://img.shields.io/badge/Windows--native-verified-success)

</div>

---

## Why this exists

**Aside** — the AI browser that inspired this — is **macOS only** today. If you're on
Windows or Linux, you simply can't have it.

So we built the part that mattered, in a way that runs everywhere.

> **Need something? Build it.**
>
> That's the whole idea. Not a product waiting on someone else's roadmap —
> a small tool you own, on the machine you already use, in the browser you're
> already logged into. About 2,600 lines of JavaScript, Python and shell — small enough to read
> in an afternoon. Read it, change it, make it yours.

Wbrowser targets **Windows, macOS, Linux, and WSL** — because "which OS are you on?"
should never be the reason you can't automate your own browser.
Measured on macOS, native Linux, WSL2 and Windows-native — though not every check ran
on every platform (see [Platform notes](#platform-notes)).

---

## What is this?

Most automation tools give your AI a *fresh, empty* browser. So it can't see your email,
your dashboards, or anything behind a login — unless you hand over passwords or set up
API integrations for every single service.

Wbrowser takes the opposite approach: **you log in once, by hand, in a normal Chrome window.**
After that, your terminal (or your AI assistant) can drive that exact window — already
logged in, everywhere.

```bash
./wb go https://mail.example.com   # opens in YOUR logged-in session
./wb read                          # tells you what's on screen
./wb click '#compose'              # clicks it
```

**Wbrowser never sees your passwords.** You type them; Chrome stores them; Wbrowser
just drives the window that's already open.

---

## Quick start

```bash
git clone https://github.com/<you>/Wbrowser.git
cd Wbrowser
# Wbrowser drives your *system* Chrome, so Playwright's own browser
# download is unnecessary — skip it and save ~400MB:
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install

node launch.js       # 1. opens a dedicated Chrome window
                     # 2. log into your sites in that window (by hand!)
node engine.js       # 3. start the control engine
./wb go https://example.com
```

That's it. Step 2 is the only thing you ever do manually.

> **If `./wb` says "Permission denied"** — the executable bit didn't survive the
> clone (some setups strip it). Fix it once:
> ```bash
> chmod +x wb install.sh autostart.sh sync-session.sh
> ```

> **Headless servers (no display):** Wbrowser detects a missing `$DISPLAY` and
> launches Chrome headless automatically. Force it either way with
> `WBROWSER_HEADLESS=1` or `=0`. Note you can't log in by hand without a screen —
> use `./sync-session.sh import` to bring sessions over from a desktop machine.

> **Windows users:** run these inside WSL, or use `node` directly on Windows —
> both work. See [Platform notes](#platform-notes).

---

## Why a separate Chrome window?

Since **Chrome 136** (March 2025), `--remote-debugging-port` is **ignored** for
Chrome's default profile directory. Google made this change because attackers were
using remote debugging to steal cookies.

So a non-default `--user-data-dir` is now **mandatory**. Wbrowser creates one at
`~/.wbrowser` and launches Chrome there.

**This means your existing logins do not carry over.** You log in once in the new
window, and they persist there from then on.

> ⚠️ Copying your Chrome profile folder does **not** work. We tried: 685 cookies
> became 3, and every session cookie was dropped. Chrome invalidates profiles it
> doesn't recognize. Log in fresh — it takes a minute and it actually works.

---

## Commands

```bash
./wb go <url>              open a page, return its structure
./wb read                  summarize the current page
./wb click <selector>      click an element
./wb type <selector> <text>   fill an input
./wb press <key>           Enter, Tab, Escape, ArrowDown…
./wb eval '<js>'           run JavaScript in the page
./wb console [regex]       console logs + uncaught exceptions
./wb network               failed requests (4xx/5xx, CORS, timeouts)
./wb shot [file.png]       screenshot
./wb tabs                  open tabs, grouped by agent
./wb close                 close only the tabs you opened
./wb status                is everything up? which profile?
./wb show                  bring the browser window to the front
```

### Don't guess selectors

`./wb read` returns the *actual* clickable elements on the page:

```
inputs(1):
  - #searchbox_input  (Search the web without being tracked)
buttons(3): Search, Sign in, Settings
```

Copy from there. (We once guessed `input[name=q]` for a search box — it was a
`textarea`. `read` had the right answer all along.)

---

## Use it from an AI assistant (MCP)

Wbrowser speaks the [Model Context Protocol](https://modelcontextprotocol.io),
so any MCP-capable assistant can drive your browser.

**Local (stdio):**
```json
{
  "mcpServers": {
    "wbrowser": {
      "command": "node",
      "args": ["/path/to/Wbrowser/mcp-server.js"]
    }
  }
}
```

**Remote (HTTP):**
```bash
export WBROWSER_MCP_TOKEN=$(openssl rand -hex 32)
node mcp-server.js --http --port 7982 --host 127.0.0.1
```

Then just talk to your assistant:

> *"Open my dashboard and summarize today's numbers."*
> *"What's in my cart on that shopping site?"*

**Tools:** `browser_open` `browser_read` `browser_click` `browser_type` `browser_press`
`browser_eval` `browser_console` `browser_screenshot` `browser_tabs` `browser_status`

> 🔴 **The remote server refuses to start without a token.** This isn't optional —
> it drives a browser holding all your logins. Anyone who reaches that port becomes you.

---

## Scheduled jobs (cron)

Create `jobs/morning-check.json`:

```json
{
  "schedule": "0 9 * * 1-5",
  "tab": "morning",
  "steps": [
    { "goto": "https://dashboard.example.com", "wait": 2000 },
    { "eval": "document.querySelector('.total').innerText" },
    { "shot": true }
  ]
}
```

```bash
node cron.js list      # what's registered
node cron.js next      # when each job runs next
node cron.js run <name>   # run once, now
node cron.js daemon    # run on schedule
```

`0 9 * * 1-5` = *minute 0, hour 9, weekdays.* Standard 5-field cron.

### Irreversible actions are blocked by default

Unattended automation means **nobody is watching when it goes wrong.** So steps that
look like submit / payment / delete are **refused**:

```
⛔ step 2 blocked — looks irreversible (click: #submit-payment)
   If you meant it, add "allowIrreversible": true to the job file.
```

You opt in per job, not globally.

---

## Who's driving? (visual indicator)

When an agent is controlling the browser, you see it:

- **A translucent border** around the page, with a label: `🤖 my-agent in control`
- **The tab title** gets prefixed: `[my-agent] Dashboard`

The border fades after 6 seconds of inactivity, so "in control" actually means
*right now*. Colors are derived from the agent name, so multiple agents are
distinguishable at a glance.

The tab prefix survives navigation — a `MutationObserver` re-applies it whenever
the page rewrites its own title (which SPAs do constantly).

---

## Multiple accounts

Open several Chrome profiles in the same window (Chrome's profile switcher), and
Wbrowser can target them individually:

```bash
./wb -a work@example.com go https://mail.example.com
./wb windows                    # list open profiles
```

Or map sites to accounts in `accounts.json`:

```json
{
  "sites": {
    "mail.example.com": { "account": "work@example.com" }
  }
}
```

> 🔴 If you name an account that isn't open, Wbrowser **fails** instead of guessing.
> Sending mail from the wrong account is worse than an error message.

---

## Platform notes

| OS | Chrome auto-detection |
|---|---|
| **Windows** | `Program Files`, `AppData`, Edge fallback |
| **macOS** | `/Applications/Google Chrome.app`, Chromium, Edge |
| **Linux** | `google-chrome`, `chromium`, snap, Edge |
| **WSL** | Windows Chrome first (the browser you actually use) |

Override with `WBROWSER_CHROME=/path/to/chrome` if detection fails.

> **Tested on real hardware** (2026-08-24):
>
> | Platform | Chrome | Verified by | What was measured there |
> |---|---|---|---|
> | macOS 15 | 151 | independent reviewer | launch · engine · CLI · state paths |
> | Linux (native, headless) | 148 | independent reviewer | the above **+ security review** |
> | WSL2 + Windows Chrome | 151 | maintainer | the above |
> | Windows 10 (native) | 151 | independent reviewer | the above **+ end-to-end** |
>
> Not every check ran on every platform. The **security review** (no-token MCP refusal
> confirmed with `ss`, engine unreachable off-loopback) was done on Linux. The
> **end-to-end run** (`/health` → `/act` → real page extraction) was done on Windows.
> UNC paths (`\\wsl.localhost\...`) also work — measured, contrary to our expectation.
>
> Security was reviewed independently on Linux: with no token the MCP HTTP server
> exits and **never opens a socket** (verified with `ss`); the engine binds to
> `127.0.0.1` only and is unreachable over the tailnet.

---

## Security

This tool drives a browser that holds **all your logins**. Treat it accordingly.

- 🔴 **`127.0.0.1` is not a fence — it is "any process running as you gets in."**
  The Chrome debugging port (9222) has **no authentication**. Any local process on that
  machine — another app, an npm postinstall hook, a stray script — can attach and drive
  every session you are logged into. Measured: an unrelated process reached
  `GET http://127.0.0.1:9222/json/list` and enumerated the open tabs with no credentials.
  Only run this on a machine where you trust everything that runs as your user.
- The engine binds to **`127.0.0.1` only**. Never expose it directly.
- 🔴 `mcp-server.js --host 0.0.0.0` exists and **will bind to every interface**. The code
  prints a warning, but by then the port is already open. Use `127.0.0.1` unless you are
  on a trusted private network (VPN/tailnet), and always with a token.
- The MCP HTTP server **requires a token** and refuses to start without one.
- `./wb type` does **not** log what was typed — it might be a password.
- Cookie values are **never** printed, logged, or returned by any command.
- **Do not** use this to enter passwords, card numbers, or government IDs.
  Log in by hand; Wbrowser reuses the session.

### Session backup

```bash
./sync-session.sh export   # cookies → encrypted store
./sync-session.sh import   # restore on another machine
./sync-session.sh status
```

> 🔴 **Cookies are as sensitive as passwords** — they *are* the login. The script
> refuses to write unless the destination is actually encrypted, and refuses to
> restore from ciphertext it can't decrypt.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `WBROWSER_CHROME` | auto-detect | Chrome executable path |
| `WBROWSER_PROFILE_DIR` | `~/.wbrowser` | Profile directory |
| `WBROWSER_PROFILE` | `Default` | Profile name within it |
| `WBROWSER_CDP_PORT` | `9222` | Chrome debugging port |
| `WBROWSER_PORT` | `7981` | Control engine port |
| `WBROWSER_AGENT` | auto | Name shown in banner and tab |
| `WBROWSER_MCP_TOKEN` | — | **Required** for remote MCP |
| `WBROWSER_NOTES` | — | Directory for daily work logs (optional) |

---

## Run on boot

```bash
# Linux / WSL (systemd user service)
./install.sh
systemctl --user status wbrowser
```

The engine starts automatically. The **browser** still needs launching — it's a
desktop process, and it should be your choice when it opens.

---

## Known limitations

- **No natural-language loop built in.** The agent picks selectors; `read` gives it
  the real ones, so it doesn't have to guess.
- **Chrome/Chromium only.** Firefox has no CDP.
- **One CDP port = one Chrome process.** Profiles opened from within that window are
  visible; a separately-launched Chrome is not.

---

## Contributing & security

- [CONTRIBUTING.md](CONTRIBUTING.md) — the rules that shaped this code, and how to test it
- [SECURITY.md](SECURITY.md) — 🔴 the threat model. Read it before running this on a
  shared machine: the Chrome debugging port has **no authentication**, so any local
  process running as you can drive your sessions.

Found a security problem? Please open a
[private advisory](https://github.com/w-partners/Wbrowser/security/advisories/new)
rather than a public issue.

## License

MIT — see [LICENSE](LICENSE).
