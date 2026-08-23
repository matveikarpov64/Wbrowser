// journal.js — writes browser activity to a markdown journal (optional feature).
//
// Where it writes:  <WBROWSER_NOTES>/wbrowser-YYYY-MM-DD.md   (one file per day)
//   · Any single folder works — an Obsidian vault, a git repo, or a plain directory.
//   · If WBROWSER_NOTES is unset, **nothing is recorded at all** (off by default).
//
// 🔴 What is never recorded:
//   · values entered via type (they may be passwords)
//   · code run via eval and whatever it returns (tokens and personal data end up in there)
//   · cookies and headers of any kind
//   Selectors and URLs are kept — you need them to trace what happened, and they aren't secrets.

const fs = require('fs');
const path = require('path');

// Folder to write into. If unset the feature is off — we never invent a path to write to.
function notesRoot() {
  const p = (process.env.WBROWSER_NOTES || '').trim();
  return p || null;
}

function pad(n) { return String(n).padStart(2, '0'); }
function stamp(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function clock(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

// One-line summary. The done array is what the engine actually performed.
function summarize(cmd) {
  const parts = [];
  if (cmd.goto) parts.push(`open → ${cmd.goto}`);
  if (cmd.click) parts.push(`click \`${cmd.click}\``);
  // 🔴 Never keep what was typed. Only which field it went into.
  if (cmd.type) parts.push(`type → \`${cmd.type.selector}\` (value not logged)`);
  if (cmd.press) parts.push(`key ${cmd.press}`);
  if (cmd.eval) parts.push('eval (code/result not logged)');
  if (cmd.shot) parts.push('screenshot');
  if (cmd.newtab) parts.push('new tab');
  if (!parts.length && cmd.read) parts.push('read page');
  if (!parts.length) return null;      // read-only lookups aren't recorded
  return parts.join(' · ');
}

function appendJournal(cmd, result, meta) {
  const root = notesRoot();
  if (!root) return { ok: true, disabled: true };   // feature is off — not an error

  const summary = summarize(cmd);
  if (!summary) return { ok: true, skipped: true };

  const now = new Date();
  const file = path.join(root, `wbrowser-${stamp(now)}.md`);

  const page = result && result.page ? result.page : null;
  const title = page && page.title ? page.title.replace(/^\[[^\]]+\]\s*/, '') : '';
  const url = page && page.url ? page.url : (cmd.goto || '');
  const who = (meta && meta.agent) || 'wbrowser';
  const acct = (result && result.account) || '';

  let line = `- **${clock(now)}** \`${who}\` · ${summary}`;
  if (title) line += `\n    - result: ${title}`;
  if (url) line += `\n    - url: ${url}`;
  if (acct) line += `\n    - profile: ${acct}`;
  if (result && result.evalError) line += `\n    - ❌ error: ${result.evalError}`;

  try {
    fs.mkdirSync(root, { recursive: true });
    if (!fs.existsSync(file)) {
      const head = `# Wbrowser log — ${stamp(now)}\n\n`
        + '> Written automatically. Typed values, executed code and cookies are never recorded.\n\n';
      fs.writeFileSync(file, head, 'utf8');
    }
    fs.appendFileSync(file, `${line}\n`, 'utf8');
    return { ok: true, file };
  } catch (e) {
    // 🔴 Never fail silently. The caller puts this in the response.
    return { ok: false, why: e.message };
  }
}

module.exports = { appendJournal, notesRoot };
