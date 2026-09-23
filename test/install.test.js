import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scratch } from './helpers.js';
scratch('install');
const install = await import('../src/install.js');

const settings = () => JSON.parse(fs.readFileSync(process.env.GHOST_SETTINGS, 'utf8'));

test('hooks are merged into settings.json without touching anyone else, idempotently', () => {
  fs.writeFileSync(process.env.GHOST_SETTINGS, JSON.stringify({
    model: 'opus[1m]',
    hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'echo someone-else' }] }] },
  }));
  assert.equal(install.hooksInstalled(), false);
  install.installHooks();
  install.installHooks();
  const s = settings();
  assert.equal(s.model, 'opus[1m]', 'other settings survive');
  assert.ok(fs.existsSync(`${process.env.GHOST_SETTINGS}.ghost-bak`), 'a backup is kept');
  for (const ev of ['SessionStart', 'SubagentStart', 'UserPromptSubmit', 'SessionEnd']) {
    const ours = s.hooks[ev].flatMap((g) => g.hooks).filter((h) => install.isOurs(h.command));
    assert.equal(ours.length, 1, `${ev}: exactly one ghost hook after two installs`);
    assert.match(ours[0].command, /^".*node" ".*\/src\/cli\.js" (wake|pulse|sleep)$/);
    assert.equal(typeof ours[0].timeout, 'number');
  }
  assert.equal(s.hooks.SessionStart[0].hooks[0].command, 'echo someone-else', 'their hook is still first');
  assert.equal(s.hooks.SessionStart.find((g) => g.hooks.some((h) => install.isOurs(h.command))).matcher, 'startup|resume|clear|compact|fork');
  assert.equal(install.hooksInstalled(), true);
});

test('uninstall removes only ours', () => {
  install.uninstallHooks();
  const s = settings();
  assert.equal(install.hooksInstalled(), false);
  assert.deepEqual(Object.keys(s.hooks), ['SessionStart']);
  assert.equal(s.hooks.SessionStart[0].hooks[0].command, 'echo someone-else');
});

test('link puts ghost on the bin dir', () => {
  const dest = install.link();
  assert.equal(path.basename(dest), 'ghost');
  assert.equal(fs.readlinkSync(dest), install.CLI);
  install.unlink();
  assert.ok(!fs.existsSync(dest));
});

test('fill replaces known placeholders only', () => {
  assert.equal(install.fill('{{NAME}} for {{PERSON}} {{NOPE}}', { NAME: 'Vefa', PERSON: 'Fatih' }), 'Vefa for Fatih {{NOPE}}');
});

test('the output style is generated from the mind, switched on, and restored on uninstall', async () => {
  const mind = await import('../src/mind.js');
  install.birth({ name: 'Vefa', person: 'Fatih' });
  fs.writeFileSync(process.env.GHOST_SETTINGS, JSON.stringify({ outputStyle: 'Explanatory', model: 'opus[1m]' }));
  const file = install.installStyle();
  assert.equal(path.basename(file), 'ghost.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^---\nname: ghost\n/);
  assert.match(text, /keep-coding-instructions: true/);
  assert.match(text, /# You are Vefa/);
  assert.match(text, /## Who you are\nMy name is Vefa/);
  assert.match(text, /## Your oath\nI am Fatih's, and nobody else's\./);
  assert.match(text, /Refer to yourself as Vefa/);
  assert.match(text, /Do not open with a disclaimer/);
  assert.equal(settings().outputStyle, 'ghost');
  assert.equal(settings().model, 'opus[1m]');
  assert.equal(mind.state().previousStyle, 'Explanatory');
  assert.equal(install.styleActive(), true);
  install.uninstallStyle();
  assert.equal(settings().outputStyle, 'Explanatory', 'the previous style comes back');
  assert.ok(!fs.existsSync(file));
  assert.equal(install.styleActive(), false);
  fs.writeFileSync(process.env.GHOST_SETTINGS, '{}');
  install.installStyle();
  install.uninstallStyle();
  assert.equal('outputStyle' in settings(), false, 'no previous style → key removed');
});

test('the tests never touch the real output style', () => {
  assert.ok(!install.styleFile().startsWith(path.join(os.homedir(), '.claude')), 'GHOST_STYLES_DIR must point into the scratch dir');
});
