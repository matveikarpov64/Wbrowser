#!/usr/bin/env node
// bin/wbrowser.js — entry point when installed via npm.
//
//   wbrowser launch     start the browser
//   wbrowser engine     start the control engine
//   wbrowser mcp [...]  MCP server (--http requires a token)
//   wbrowser cron [...] scheduled jobs
//   wbrowser <other>    forwarded to the wb script (go/read/click/…)
//
// 🔵 wb is a bash script, so it cannot run directly on Windows.
//    In that case this entry point explains why — never fail silently.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const [cmd, ...rest] = process.argv.slice(2);

function run(file, args, opts = {}) {
  const p = spawn(process.execPath, [path.join(ROOT, file), ...args], {
    stdio: 'inherit', ...opts,
  });
  p.on('exit', (code) => process.exit(code === null ? 1 : code));
  p.on('error', (e) => {
    console.error(`❌ ${file} failed to run: ${e.message}`);
    process.exit(1);
  });
}

function runShell(args) {
  const wb = path.join(ROOT, 'wb');
  if (!fs.existsSync(wb)) {
    console.error('❌ cannot find the wb script:', wb);
    process.exit(1);
  }
  // 🔴 Without the exec bit this dies with "Permission denied" (measured: git stored
  //    it as 0644). Calling bash directly sidesteps that.
  const sh = process.platform === 'win32' ? null : 'bash';
  if (!sh) {
    console.error('❌ This subcommand needs bash.');
    console.error('   On Windows, use it inside WSL or call these directly:');
    console.error('     node engine.js   /   node launch.js   /   node mcp-server.js');
    process.exit(1);
  }
  const p = spawn(sh, [wb, ...args], { stdio: 'inherit', cwd: ROOT });
  p.on('exit', (code) => process.exit(code === null ? 1 : code));
  p.on('error', (e) => { console.error(`❌ ${e.message}`); process.exit(1); });
}

switch (cmd) {
  case 'launch': run('launch.js', rest); break;
  case 'engine': run('engine.js', rest); break;
  case 'mcp': run('mcp-server.js', rest); break;
  case 'cron': run('cron.js', rest); break;
  case undefined:
  case '-h':
  case '--help':
    console.log(`Wbrowser — drive the Chrome you're already logged into

  wbrowser launch          open the dedicated Chrome window
  wbrowser engine          start the control engine
  wbrowser mcp [--http]    MCP server (--http requires WBROWSER_MCP_TOKEN)
  wbrowser cron <sub>      scheduled jobs: list | next | run <name> | daemon

  wbrowser go <url>        open a page
  wbrowser read            summarize the current page
  wbrowser click <sel>     click an element
  wbrowser status          is everything up?

Docs: https://github.com/w-partners/Wbrowser`);
    break;
  default: runShell([cmd, ...rest]);
}
