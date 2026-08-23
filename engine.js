// engine.js — a control engine that attaches over CDP to an already-running Chrome and drives it.
//
//   POST /act       { tab?, account?, agent?, goto?, click?, type?, press?,
//                     wait?, read?, shot?, eval?, console?, errors?, network? }
//   GET  /health    engine / browser status
//   GET  /tabs      open tabs
//   GET  /windows   windows per profile (account)
//   GET  /logins    cookie counts per domain (values are never returned)
//   GET  /session   export cookies   POST /session  restore cookies
//
// 🔴 This does not launch the browser — launch.js must already be running.
// 🔴 Bind to 127.0.0.1 only. This engine drives the browser the user is logged
//    into, so exposing it externally hands over every one of those sessions.
// 🔴 Cookie 'values' are never returned anywhere except /session.

const http = require('http');

// 🔴 Without playwright you only get a stack trace and never the words
//    "run npm install" (measured). Replace it with human-readable guidance.
try {
  require.resolve('playwright');
} catch {
  console.error('❌ playwright is not installed.');
  console.error('   Run this in this directory:  npm install');
  process.exit(1);
}

const { chromium } = require('playwright');
const { appendJournal } = require('./journal');

const PORT = process.env.WBROWSER_PORT || 7981;
// 🔵 CDP address. Accepts both WBROWSER_CDP (full URL) and WBROWSER_CDP_PORT (port only).
//    launch.js uses _PORT, and if the engine ignores it then whenever the user changes
//    the port the engine silently attaches to the default 9222 (= someone else's
//    browser). This actually went wrong that way.
const CDP = process.env.WBROWSER_CDP
  || `http://127.0.0.1:${process.env.WBROWSER_CDP_PORT || 9222}`;

let browser = null;
let ctx = null;
const tabs = new Map();          // name -> page

// The CDP connection can drop (Chrome quits / restarts). Check on every request
// whether it is still alive and reattach if it died — so we never fail silently
// on a dead handle.
async function connect() {
  if (browser && browser.isConnected()) return;
  browser = await chromium.connectOverCDP(CDP, { timeout: 10000 });
  ctx = browser.contexts()[0];
  if (!ctx) throw new Error('CDP has no context — Chrome is in a bad state.');
  tabs.clear();
  browser.on('disconnected', () => { browser = null; ctx = null; tabs.clear(); });
}

// 🔴 If the user has several profiles open, the same CDP shows windows for
//    multiple accounts at once. Grabbing "the first tab" means working under the
//    wrong account — which leads to real incidents like sending mail from the
//    wrong account. So we pick the account explicitly.
//
//    When attached over CDP, playwright gives a separate BrowserContext per
//    profile. contexts()[i] maps 1:1 to a profile, so we identify the account by
//    its context.
let ctxAccounts = new Map();      // BrowserContext -> account string (only once determined)

// 🔵 Console / network records. Kept per page in a ring buffer.
//    Records survive navigation (needed to see what broke things).
const RING = 300;                 // max entries kept per page
const pageLogs = new WeakMap();   // Page -> { console: [], errors: [], requests: [] }

function logsOf(page) {
  if (!pageLogs.has(page)) pageLogs.set(page, { console: [], errors: [], requests: [] });
  return pageLogs.get(page);
}

function push(arr, item) {
  arr.push(item);
  if (arr.length > RING) arr.shift();
}

// Attach listeners to a page only once. Attaching twice duplicates every log entry.
const wired = new WeakSet();
function wireLogging(page) {
  if (wired.has(page)) return;
  wired.add(page);
  const L = logsOf(page);

  page.on('console', (msg) => {
    push(L.console, {
      type: msg.type(),                    // log / warn / error / info …
      text: msg.text().slice(0, 2000),
      url: (msg.location() || {}).url || '',
      line: (msg.location() || {}).lineNumber,
      at: new Date().toISOString(),
    });
  });
  // Uncaught exceptions — the ones console.error never catches land here
  page.on('pageerror', (err) => {
    push(L.errors, {
      message: String(err && err.message ? err.message : err).slice(0, 2000),
      stack: String(err && err.stack ? err.stack : '').split('\n').slice(0, 5).join('\n'),
      at: new Date().toISOString(),
    });
  });
  // Failed requests — 404 / CORS / network errors
  page.on('requestfailed', (req) => {
    push(L.requests, {
      url: req.url().slice(0, 300),
      method: req.method(),
      failure: (req.failure() || {}).errorText || '',
      at: new Date().toISOString(),
    });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      push(L.requests, {
        url: res.url().slice(0, 300),
        method: res.request().method(),
        status: res.status(),
        at: new Date().toISOString(),
      });
    }
  });
}

async function accountOf(context) {
  if (ctxAccounts.has(context)) return ctxAccounts.get(context);
  // Open chrome://version in that context and read the profile path.
  // Do it once and cache it — doing it on every request is slow.
  let acc = null;
  let probe = null;
  try {
    // 🔵 If a chrome://version tab is already open, reuse it. Opening a new one
    //    every time piles up tabs.
    const reuse = context.pages().find((p) => !p.isClosed() && p.url().startsWith('chrome://version'));
    probe = reuse || await context.newPage();
    if (!reuse) {
      await probe.goto('chrome://version', { waitUntil: 'domcontentloaded', timeout: 8000 });
    }
    const text = await probe.evaluate(() => document.body.innerText);
    // 🔵 Match only the 'Profile Path' row. The Command Line row contains the same
    //    path, so matching too broadly drags in the whole flag list (measured 2026-08-23).
    //    (The Korean alternative in the regex below matches Chrome's Korean UI — do not remove it.)
    // 🔵 Paths contain spaces ("Profile 1", "User Data"). Cutting at whitespace
    //    truncates to 'Profile' and reports the wrong account (measured 2026-08-23).
    //    Capture to end of line and only trim trailing whitespace.
    const m = text.match(/(?:프로필 경로|Profile Path)\s*[:\s]\s*([A-Za-z]:\\[^\r\n]+)/);
    acc = m ? m[1].trim() : null;
  } catch { /* if unreadable leave it null — we do not guess */ } finally {
    // Close only the tab we opened. Never close a tab the user opened.
    if (probe && !probe.isClosed() && probe.url().startsWith('chrome://version')) {
      try { await probe.close(); } catch { /* noop */ }
    }
  }
  ctxAccounts.set(context, acc);
  return acc;
}

// Pick a context by account hint (part of an email / a profile name).
// strict=true throws when nothing matches (the user named the account explicitly).
// strict=false falls back to the default window (the account was inferred from the mapping).
async function pickContext(hint, strict) {
  const all = browser.contexts();
  if (!hint) return ctx || all[0];
  const wanted = String(hint).toLowerCase();
  for (const c of all) {
    const path = (await accountOf(c)) || '';
    if (path.toLowerCase().includes(wanted)) return c;
    // Also allow matching by profile folder name (Profile 3, Default)
    const prof = path.split('\\').pop() || '';
    if (prof.toLowerCase() === wanted) return c;
  }
  if (strict) {
    // 🔴 If the user named an account and that window is not open, fail —
    //    stopping is better than working under the wrong account.
    throw new Error(`No window is open for the '${hint}' account. `
      + `Open that profile in Chrome and try again (check with ./wb windows).`);
  }
  return ctx || all[0];
}

async function getTab(name, accountHint, strict, agent) {
  await connect();
  // 🔵 Partition tabs per agent — if I overwrite a tab another agent was using,
  //    the two pieces of work tangle (agents run in parallel).
  const key = `${agent || ''}::${accountHint || ''}::${name || 'main'}`;
  const existing = tabs.get(key);
  if (existing && !existing.isClosed()) return existing;

  const targetCtx = await pickContext(accountHint, strict);
  // 'main' inherits an existing tab in that context. Creating a new tab pushes the
  // screen the user was looking at into the background and leaves us wandering in a
  // blank tab while the logged-in tab sits unused.
  let page;
  if ((name || 'main') === 'main') {
    page = targetCtx.pages().find((p) => !p.isClosed() && !p.url().startsWith('chrome://'))
        || targetCtx.pages().find((p) => !p.isClosed())
        || await targetCtx.newPage();
  } else {
    page = await targetCtx.newPage();
  }
  tabs.set(key, page);
  wireLogging(page);       // start recording console / errors / failed requests from here on
  return page;
}

// Summarize the page structure — so we drive by selector, not by coordinates.
// Coordinate-based driving silently clicks the wrong place when the window size
// or scroll position changes.
async function summarize(page) {
  return page.evaluate(() => {
    const txt = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const links = [...document.querySelectorAll('a[href]')].filter(vis).slice(0, 20)
      .map((a) => ({ text: txt(a.innerText), href: a.href })).filter((x) => x.text);
    const buttons = [...document.querySelectorAll('button, input[type=submit], [role=button]')]
      .filter(vis).slice(0, 15)
      .map((b) => txt(b.innerText || b.value)).filter(Boolean);
    const inputs = [...document.querySelectorAll('input, textarea, select')]
      .filter(vis).slice(0, 15)
      .map((i) => ({
        tag: i.tagName.toLowerCase(), type: i.type || '', name: i.name || '',
        id: i.id || '', placeholder: i.placeholder || '',
      }))
      .filter((x) => x.name || x.id || x.placeholder);
    // 🔴 Never return document.cookie (session-hijacking vector).
    return {
      title: document.title,
      url: location.href,
      h1: txt((document.querySelector('h1') || {}).innerText),
      // 🔴 Do not use txt() here — that helper truncates at 60 chars (it is for labels).
      //    Clean up the body text separately. Otherwise text is always 60 chars
      //    (measured 2026-08-23).
      text: (document.body ? document.body.innerText : '')
        .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 3000),
      links,
      buttons,
      inputs,
    };
  });
}

// accounts.json — site↔account mapping. Read on every request (the file is small,
// and edits by the user must take effect without a restart).
function accountForUrl(url) {
  if (!url) return null;
  try {
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync(`${__dirname}/accounts.json`, 'utf8'));
    const host = new URL(url).hostname.replace(/^www\./, '');
    const sites = cfg.sites || {};
    // Exact match first, then walk up the parent domains (for a.b.com also check b.com)
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts.slice(i).join('.');
      if (sites[key]) return sites[key].account || sites[key];
    }
    return cfg.defaultAccount || null;
  } catch {
    return null;   // A broken config must not stop operation. Use the default window.
  }
}

// 🔵 Show on screen that the browser is under control — a translucent border band
//    plus the agent name. It must be immediately visible on screen that we are driving.
//
//    Design principles:
//    · pointer-events:none — if the band intercepted clicks the user could not click there
//    · top z-index + position:fixed — shows up regardless of the site's layout
//    · self-expiring — it must disappear when work ends, or "currently controlled" means nothing
//    · reattaches after navigation (it is called on every act)
const BANNER_TTL_MS = 6000;
const titleScripted = new WeakSet();

// 🔵 Stamp the agent name into the tab label and **keep it there**.
//
//    Problem: the stamp disappears on navigation, because the site overwrites
//    document.title with its own value. SPAs especially refresh the title on every
//    route change, so stamping once does not survive.
//
//    Solution: watch <title> with a MutationObserver and re-apply the prefix the
//    moment it goes missing.
//    · Registering via addInitScript applies it automatically to **every subsequent
//      navigation** as well.
//    · Re-entrancy guard: the observer fires even while we are writing, so a flag blocks it.
async function stampTitle(page, agent) {
  const install = (tag) => {
    const KEY = '__wbrowserTitleGuard';
    window.__wbrowserAgent = tag;
    const apply = () => {
      if (window[KEY]) return;                 // we are writing right now — prevent recursion
      const want = `[${window.__wbrowserAgent}] `;
      const cur = document.title || '';
      if (cur.startsWith(want)) return;
      window[KEY] = true;
      try {
        document.title = want + cur.replace(/^\[[^\]]*\]\s*/, '');
      } finally {
        window[KEY] = false;
      }
    };
    apply();
    if (window.__wbrowserTitleObs) return;      // already observing
    const head = document.head || document.documentElement;
    if (!head) return;
    window.__wbrowserTitleObs = new MutationObserver(apply);
    window.__wbrowserTitleObs.observe(head, {
      subtree: true, childList: true, characterData: true,
    });
  };

  try {
    // Apply immediately to the current page
    await page.evaluate(install, agent);
  } catch { /* blocked on chrome:// and similar pages */ }

  try {
    // Also apply to every document opened from now on (register once per tab)
    if (!titleScripted.has(page)) {
      titleScripted.add(page);
      await page.addInitScript(install, agent);
    }
  } catch { /* even if registration fails, the immediate apply above still holds */ }
}

async function showBanner(page, agent) {
  try {
    await page.evaluate(({ tag, ttl }) => {
      const ID = '__wbrowser_ctrl_banner';
      let el = document.getElementById(ID);
      if (!el) {
        el = document.createElement('div');
        el.id = ID;
        document.documentElement.appendChild(el);
      }
      // Derive the color from the agent name — several agents attached at once stay distinguishable.
      let h = 0;
      for (let i = 0; i < tag.length; i += 1) h = (h * 31 + tag.charCodeAt(i)) % 360;

      el.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'pointer-events:none',                       // 🔴 must not intercept clicks
        `border:6px solid hsla(${h},85%,55%,0.55)`,
        'box-sizing:border-box',
        `box-shadow:inset 0 0 22px hsla(${h},85%,55%,0.28)`,
        'transition:opacity .25s',
      ].join(';');

      // Name badge (top-left)
      let lab = el.firstElementChild;
      if (!lab) { lab = document.createElement('div'); el.appendChild(lab); }
      lab.textContent = `🤖 ${tag} in control`;
      lab.style.cssText = [
        'position:absolute', 'top:0', 'left:14px',
        `background:hsla(${h},85%,45%,0.88)`, 'color:#fff',
        'font:600 12px/1 system-ui,"Malgun Gothic",sans-serif',
        'padding:5px 11px', 'border-radius:0 0 7px 7px',
        'letter-spacing:.2px', 'white-space:nowrap',
      ].join(';');

      // Disappears on its own once work stops. The next act refreshes the timer.
      if (window.__wbrowserBannerTimer) clearTimeout(window.__wbrowserBannerTimer);
      el.style.opacity = '1';
      window.__wbrowserBannerTimer = setTimeout(() => {
        const n = document.getElementById(ID);
        if (!n) return;
        n.style.opacity = '0';
        setTimeout(() => { const m = document.getElementById(ID); if (m) m.remove(); }, 300);
      }, ttl);
    }, { tag: agent, ttl: BANNER_TTL_MS });
  } catch {
    // Scripts are blocked on chrome:// pages and the like. A failed banner must not block the work.
  }
}

async function act(cmd) {
  const tab = cmd.tab || 'main';
  // If account is given explicitly use it, otherwise look the URL up in the mapping.
  const explicit = !!cmd.account;
  const acct = cmd.account || (cmd.goto ? accountForUrl(cmd.goto) : null);
  let page = await getTab(tab, acct, explicit, cmd.agent);
  const done = [];

  if (cmd.newtab) {
    const c = await pickContext(acct, explicit);
    page = await c.newPage();
    tabs.set(`${cmd.agent || ''}::${acct || ''}::${tab}`, page);
    done.push('newtab');
  }
  if (cmd.goto) {
    await page.goto(cmd.goto, { waitUntil: 'domcontentloaded', timeout: 30000 });
    done.push(`goto ${cmd.goto}`);
  }
  if (cmd.click) { await page.click(cmd.click, { timeout: 10000 }); done.push(`click ${cmd.click}`); }
  if (cmd.type) {
    await page.fill(cmd.type.selector, cmd.type.text, { timeout: 10000 });
    // 🔵 Never log what was typed — it may be a password.
    done.push(`type -> ${cmd.type.selector}`);
  }
  if (cmd.press) { await page.keyboard.press(cmd.press); done.push(`press ${cmd.press}`); }

  // 🔵 Make it visible who is in control.
  //    ① tab title    — tells them apart in the tab bar
  //    ② border band  — shows on screen right away who is touching this window
  //
  // 🔴 Do not narrow this condition to goto/click/newtab. Work done only through
  //    eval/type/press would get no indicator — a tab that submitted 20 entries
  //    actually ended up with no indicator at all.
  if (cmd.agent) {
    await stampTitle(page, cmd.agent);
    await showBanner(page, cmd.agent);
  }
  if (cmd.wait) { await page.waitForTimeout(Math.min(cmd.wait, 15000)); done.push(`wait ${cmd.wait}ms`); }

  // Run JS — equivalent to typing straight into the console.
  // 🔴 This runs arbitrary code in the page context, which is another reason this
  //    engine must stay bound to 127.0.0.1 only.
  let evalResult;
  let evalError;
  if (cmd.eval) {
    try {
      const out = await page.evaluate((src) => {
        // eslint-disable-next-line no-new-func
        const v = (0, eval)(src);
        // Non-serializable values such as DOM nodes fall back to a string
        try { JSON.stringify(v); return v; } catch { return String(v); }
      }, cmd.eval);
      evalResult = out;
      done.push('eval');
    } catch (e) {
      evalError = e.message.split('\n')[0];
      done.push('eval(failed)');
    }
  }

  // 🔴 Always return which account window this ran in. Without it you can work under
  //    the wrong account and never know — that is where incidents like mail sent from
  //    the wrong account start.
  let usedProfile = null;
  try {
    const p = await accountOf(page.context());
    usedProfile = p ? (p.split('\\').pop() || p) : null;
  } catch { /* keep going even if it cannot be read */ }

  const result = { tab, account: usedProfile, done };
  if (evalResult !== undefined) result.result = evalResult;
  if (evalError) result.evalError = evalError;

  // Query console / errors / failed requests. Can be narrowed with filter (a regex).
  if (cmd.console || cmd.errors || cmd.network) {
    const L = logsOf(page);
    const rx = cmd.filter ? new RegExp(cmd.filter, 'i') : null;
    const take = (arr, n) => (rx ? arr.filter((x) => rx.test(JSON.stringify(x))) : arr)
      .slice(-(n || 50));
    if (cmd.console) result.console = take(L.console, cmd.limit);
    if (cmd.errors) result.errors = take(L.errors, cmd.limit);
    if (cmd.network) result.network = take(L.requests, cmd.limit);
  }
  if (cmd.shot) {
    const buf = await page.screenshot({ fullPage: !!cmd.fullPage });
    result.screenshot_b64 = buf.toString('base64');
  }
  if (cmd.read || cmd.goto || cmd.click || cmd.press || cmd.newtab) {
    result.page = await summarize(page);
  }

  // Work journal (optional). Only recorded when WBROWSER_NOTES is set.
  // 🔴 Report journal failures in the response too — never allow a state where
  //    nothing gets recorded silently.
  const j = appendJournal(cmd, result, { agent: cmd.agent });
  if (!j.ok) result.journalError = j.why;
  else if (j.file) result.journal = j.file;

  return result;
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => resolve(b));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    if (req.method === 'GET' && req.url === '/health') {
      // 🔵 /health asks "is the engine alive". The browser not being up yet is not an
      //    engine error but a normal state — answer 200 and report it via browser:false.
      //    🔴 Returning 500 makes systemd / monitoring restart a perfectly healthy engine
      //    over and over (measured: 500 + ECONNREFUSED when no CDP).
      try {
        await connect();
        const v = ctx.pages();
        return res.end(JSON.stringify({
          ok: true, browser: true, cdp: CDP, openTabs: v.length,
        }, null, 2));
      } catch (e) {
        return res.end(JSON.stringify({
          ok: true,               // the engine is alive
          browser: false,         // the browser is not there yet
          cdp: CDP,
          hint: 'The browser is not running — start it with node launch.js.',
          detail: e.message.split('\n')[0],
        }, null, 2));
      }
    }
    // 🔴 Session backup / restore. This is the only path where cookie 'values' travel.
    //    This endpoint is another reason the 127.0.0.1 binding is mandatory.
    if (req.method === 'GET' && req.url === '/session') {
      await connect();
      const c = ctx || browser.contexts()[0];
      const cookies = await c.cookies();
      return res.end(JSON.stringify({
        savedAt: new Date().toISOString(),
        profile: (await accountOf(c) || '').split('\\').pop() || null,
        cookies,
      }, null, 2));
    }
    if (req.method === 'POST' && req.url === '/session') {
      await connect();
      const c = ctx || browser.contexts()[0];
      const body = JSON.parse((await readBody(req)) || '{}');
      const cookies = body.cookies || [];
      if (!Array.isArray(cookies) || !cookies.length) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'cookies are empty' }));
      }
      // Do not add expired cookies — the browser would discard them anyway.
      const nowSec = Date.now() / 1000;
      const fresh = cookies.filter((k) => !k.expires || k.expires < 0 || k.expires > nowSec);
      await c.addCookies(fresh);
      return res.end(JSON.stringify({
        ok: true, added: fresh.length, skippedExpired: cookies.length - fresh.length,
      }, null, 2));
    }
    if (req.method === 'GET' && req.url === '/logins') {
      // What we are logged into. 🔴 Never return cookie 'values' — that is a
      // session-hijacking vector. Only count domain names and quantities.
      await connect();
      const out = [];
      for (const c of browser.contexts()) {
        const path = await accountOf(c);
        const cookies = await c.cookies();
        const roots = new Map();
        for (const ck of cookies) {
          const h = (ck.domain || '').replace(/^\./, '');
          const parts = h.split('.');
          const two = ['co', 'com', 'or', 'ne', 'go', 'ac'].includes(parts[parts.length - 2])
            ? parts.slice(-3) : parts.slice(-2);
          const root = two.join('.');
          if (root) roots.set(root, (roots.get(root) || 0) + 1);
        }
        out.push({
          profile: path ? (path.split('\\').pop() || path) : null,
          totalCookies: cookies.length,
          domains: [...roots.entries()].sort((a, b) => b[1] - a[1])
            .map(([d, n]) => ({ domain: d, count: n })),
        });
      }
      return res.end(JSON.stringify({ contexts: out }, null, 2));
    }
    if (req.method === 'GET' && req.url === '/windows') {
      // Show open windows per account. When the user adds a profile it shows up here.
      await connect();
      const out = [];
      for (const c of browser.contexts()) {
        const path = await accountOf(c);
        const prof = path ? (path.split('\\').pop() || '') : null;
        out.push({
          profilePath: path,
          profile: prof,
          isAgentOnly: !!(path && path.includes('.wbrowser')),
          tabs: c.pages().filter((p) => !p.isClosed())
            .map((p) => ({ url: p.url(), title: undefined })),
        });
      }
      return res.end(JSON.stringify({ windows: out }, null, 2));
    }
    if (req.method === 'GET' && req.url === '/tabs') {
      await connect();
      const list = ctx.pages().filter((p) => !p.isClosed())
        .map((p) => ({ url: p.url() }));
      const named = [...tabs.entries()].filter(([, p]) => !p.isClosed())
        .map(([name, p]) => ({ name, url: p.url() }));
      return res.end(JSON.stringify({ open: list, named }, null, 2));
    }
    if (req.method === 'POST' && req.url === '/act') {
      const cmd = JSON.parse((await readBody(req)) || '{}');
      return res.end(JSON.stringify(await act(cmd), null, 2));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message.split('\n')[0] }, null, 2));
  }
});

// 🔴 Bind to 127.0.0.1 only. This engine drives the browser the user is logged into,
//    so leaving it open hands over every one of those sessions.
//    If external exposure is needed, put gate.js (PIN) in front of it.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`WBROWSER_ENGINE_UP http://127.0.0.1:${PORT}  → cdp ${CDP}`);
});
