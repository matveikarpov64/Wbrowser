# Security Policy

## What this tool actually does

Wbrowser drives a Chrome instance that holds **all of your logged-in sessions**.
Anyone who can reach the control ports can act as you on every site you are signed
into. Please read this before running it on a shared or untrusted machine.

## Threat model

| Surface | Default | What it means |
|---|---|---|
| Chrome CDP port (9222) | `127.0.0.1`, **no authentication** | 🔴 Any local process running as your user can attach and drive every session. This is Chrome's design, not something Wbrowser adds — but it is the sharpest edge here. |
| Control engine (7981) | `127.0.0.1` only | Same "any local process as you" property. |
| MCP over HTTP (7982) | **refuses to start without a token** | Constant-time bearer comparison. `--host 0.0.0.0` binds every interface — the code warns, but by then the port is open. |
| Session export | plaintext JSON, `0600` | Cookies **are** the login. Encrypt before moving between machines. |

**`127.0.0.1` is not a fence.** It means "any process running as you gets in."
Only run Wbrowser where you trust everything that runs under your user account.

## What Wbrowser deliberately does not do

- It never asks for, stores, or types passwords. You log in by hand; it reuses the session.
- Cookie values are never printed, logged, or returned by any command except the
  explicit `sync-session.sh export`.
- `wb type` does not log what was typed — it may be a credential.
- Scheduled jobs refuse steps that look irreversible (submit / payment / delete)
  unless that job explicitly opts in with `"allowIrreversible": true`.

## What this project is and isn't responsible for

Wbrowser is a thin layer over Chrome's DevTools Protocol. The sharp edges below are
**Chrome's design**, inherited by every tool in this category — we did not add them,
and we cannot remove them:

- The debugging port has no authentication.
- A profile with `--remote-debugging-port` is drivable by any local process as you.
- Chrome 136+ refuses this on the default profile precisely because of that.

What we *are* responsible for: not making it worse, and telling you where the edges
are. That's why the table above exists rather than a "secure by design" claim.

Like all MIT software, this comes with no warranty. If you run it on a machine where
you don't trust every process running as your user, the exposure is real regardless of
what this project does.

## Reporting a vulnerability

Please open a [private security advisory](https://github.com/w-partners/Wbrowser/security/advisories/new)
rather than a public issue. Include the version, OS, and a reproduction if you have one.

If you do not get a response within 14 days, feel free to open a public issue saying
only that you are waiting on an advisory — no details.

## Supported versions

This project is young. Only the latest release on `main` receives fixes.
