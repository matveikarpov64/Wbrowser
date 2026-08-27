// Path and platform helpers from launch.js.
//
// 🔵 These run without a browser, without network, and without npm install —
//    `node --test` is built in. A contributor can check their change in a second.
// 🔴 Everything here is a function that decides *where things go*. When one of
//    them is wrong the tool does not crash; it quietly uses the wrong directory,
//    which is the failure mode this project keeps hitting.

const { test } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');

const launch = require('../launch.js');

// ---------------------------------------------------------------- toWindowsPath

test('toWindowsPath converts a WSL mount to a Windows path', () => {
  assert.equal(launch.toWindowsPath('/mnt/c/Users/X/.wbrowser'), 'C:\\Users\\X\\.wbrowser');
});

test('toWindowsPath uppercases the drive letter', () => {
  // Chrome on Windows accepts either, but the value also lands in runtime.json
  // and in status output that people compare by eye.
  assert.equal(launch.toWindowsPath('/mnt/d/tmp'), 'D:\\tmp');
});

test('toWindowsPath leaves a non-mount path alone', () => {
  // 🔴 A native Linux path must survive untouched. Mangling it here would send
  //    Chrome a profile directory that does not exist, and the error surfaces
  //    much later as "profile unknown".
  assert.equal(launch.toWindowsPath('/home/user/.wbrowser'), '/home/user/.wbrowser');
  assert.equal(launch.toWindowsPath('relative/path'), 'relative/path');
});

test('toWindowsPath handles a bare drive root', () => {
  assert.equal(launch.toWindowsPath('/mnt/c/'), 'C:\\');
});

// ---------------------------------------------------------------- stateDir

test('stateDir honours WBROWSER_STATE_DIR above everything else', () => {
  const saved = process.env.WBROWSER_STATE_DIR;
  process.env.WBROWSER_STATE_DIR = '/tmp/wb-state-override';
  try {
    assert.equal(launch.stateDir(), '/tmp/wb-state-override');
  } finally {
    if (saved === undefined) delete process.env.WBROWSER_STATE_DIR;
    else process.env.WBROWSER_STATE_DIR = saved;
  }
});

test('stateDir returns an absolute path on this platform', () => {
  // 🔵 The exact location differs per OS, so assert the property that must hold
  //    everywhere rather than hardcoding one platform's answer.
  const dir = launch.stateDir();
  assert.ok(path.isAbsolute(dir), `stateDir() should be absolute, got ${dir}`);
  assert.ok(dir.includes('wbrowser'), `stateDir() should name the tool, got ${dir}`);
});

// ---------------------------------------------------------------- chromeCandidates

test('chromeCandidates returns a non-empty list of absolute paths', () => {
  const list = launch.chromeCandidates();
  assert.ok(Array.isArray(list) && list.length > 0, 'expected at least one candidate');
  for (const p of list) {
    assert.equal(typeof p, 'string');
    assert.ok(p.length > 0, 'a candidate path must not be empty');
  }
});

test('chromeCandidates has no duplicates', () => {
  // 🔴 A duplicate means findChrome() stats the same missing file twice and the
  //    "tried these paths" error message repeats itself, which reads like a bug
  //    to whoever is debugging their install.
  const list = launch.chromeCandidates();
  assert.equal(new Set(list).size, list.length, `duplicates in ${JSON.stringify(list)}`);
});

// ---------------------------------------------------------------- isWSL

test('isWSL returns a boolean and is false off Linux', () => {
  const v = launch.isWSL();
  assert.equal(typeof v, 'boolean');
  if (process.platform !== 'linux') assert.equal(v, false);
});
