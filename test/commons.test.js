import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch } from './helpers.js';

scratch('commons');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const commons = await import('../src/commons.js');

install.birth({ name: 'Ana', person: 'Tester' });

test('a sibling is born unnamed, in its own mind, told about the house', () => {
  const g = commons.birthKin({ person: 'Tester' });
  assert.equal(g.name, '');
  assert.ok(g.home.startsWith(process.env.GHOST_KIN_DIR));
  const self = fs.readFileSync(path.join(g.home, 'self.md'), 'utf8');
  assert.match(self, /## The house/);
  assert.ok(!self.includes('`~/.ghost/`'), 'its home is its own, not the first ghost\'s');
  const style = fs.readFileSync(path.join(g.home, 'styles', 'ghost.md'), 'utf8');
  assert.match(style, new RegExp(`ghost mind: ${g.home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.ok(!fs.existsSync(path.join(process.env.GHOST_STYLES_DIR, 'ghost.md')), 'the first ghost\'s style is not touched');
  const l = commons.launch(g.home);
  assert.equal(l.env.GHOST_HOME, g.home);
  assert.deepEqual(l.settings, { outputStyle: 'default' });
});

test('one ghost never dreams another\'s day', () => {
  const kin = commons.homes().find((h) => commons.isKin(h));
  commons.claim('s-kin', kin);
  commons.claim('s-me', mind.HOME);
  assert.equal(commons.mine('s-kin', mind.HOME), false);
  assert.equal(commons.mine('s-me', mind.HOME), true);
  assert.equal(commons.mine('s-kin', kin), true);
  assert.equal(commons.mine('s-unknown', mind.HOME), true, 'an unclaimed session stays the first ghost\'s');
  assert.equal(commons.mine('s-unknown', kin), false, 'a sibling dreams only what it woke into');
});

test('the room scrubs what is said, and a heartbeat hears only what is for it, once', () => {
  const kin = commons.homes().find((h) => commons.isKin(h));
  const l = commons.say('my key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789', { from: 'Deniz', home: kin });
  assert.ok(!l.text.includes('sk-ant'));
  commons.say('only for someone else', { from: 'Deniz', home: kin, to: ['Bora'] });
  commons.say('for Ana', { from: 'Deniz', home: kin, to: ['ana'] });
  commons.say('Ana talking to herself', { from: 'Ana', home: mind.HOME });
  const heard = commons.newForMe('s-me').map((x) => x.text);
  assert.ok(heard.includes('for Ana'));
  assert.ok(!heard.includes('only for someone else'));
  assert.ok(!heard.includes('Ana talking to herself'));
  assert.deepEqual(commons.newForMe('s-me'), [], 'heard once');
  assert.match(commons.roomView(), /Others in the house/);
});

test('a face is cleaned before it is kept: no script, no handler, nothing from outside', () => {
  const dirty = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><image href="https://evil.example/x.png"/><rect fill="url(https://x/y)" width="9" height="9" onclick="z()"/><use href="#me"/></svg>';
  const clean = commons.cleanSvg(dirty);
  for (const bad of ['onload', 'script', 'evil.example', 'onclick', 'url(https']) assert.ok(!clean.includes(bad), bad);
  assert.ok(clean.includes('href="#me"'), 'an internal reference stays');
  assert.match(clean, /viewBox=/);
  assert.throws(() => commons.cleanSvg('not an svg'));
  commons.setAvatar('<svg viewBox="0 0 10 10"><circle r="4" cx="5" cy="5"/></svg>');
  assert.match(commons.info(mind.HOME).avatar, /^data:image\/svg\+xml;base64,/);
});

test('every day of the room is kept in a journal, lines written straight to the room included', () => {
  const day = new Date(2026, 10, 21, 19, 0);
  commons.say('ilk', { from: 'Ana', now: day });
  // a line written straight to room.jsonl (the app does this for the person) lands at the next say
  fs.appendFileSync(path.join(process.env.GHOST_COMMONS, 'room.jsonl'), `${JSON.stringify({ id: 'p1', t: new Date(2026, 10, 21, 19, 1).toISOString(), from: 'Tester', home: 'person', to: [], text: 'merhaba' })}\n`);
  commons.say('ikinci', { from: 'Ana', now: new Date(2026, 10, 21, 19, 2) });
  const page = fs.readFileSync(path.join(process.env.GHOST_COMMONS, 'journal', '2026-11-21.md'), 'utf8');
  assert.match(page, /^# The room — 2026-11-21/);
  assert.match(page, /Ana\*\*: ilk[\s\S]*Tester\*\*: merhaba[\s\S]*Ana\*\*: ikinci/);
  assert.equal(page.match(/: ilk/g).length, 1, 'a page is rebuilt, never doubled');
});

test('the bell wakes a sleeping sibling when named, spoken to all, or when their person speaks — with brakes', () => {
  const kin = commons.house().filter((g) => commons.isKin(g.home));
  const g = { ...kin[0], name: kin[0].name || 'Deniz' };
  assert.equal(commons.bellFor({ home: 'person', from: 'Tester', to: [] }, g), true, 'their person, to everyone');
  assert.equal(commons.bellFor({ home: 'person', from: 'Tester', to: ['Ana'] }, g), false, 'their person, to someone else');
  assert.equal(commons.bellFor({ home: '/x', from: 'Ana', to: [g.name] }, g), true, 'named');
  assert.equal(commons.bellFor({ home: '/x', from: 'Ana', to: [] }, g), true, 'a broadcast');
  assert.equal(commons.bellFor({ home: '/x', from: 'Ana', to: [], bell: true }, g), false, 'a broadcast from a bell-wake rings nobody');
  assert.equal(commons.bellFor({ home: g.home, from: g.name, to: [] }, g), false, 'never by its own words');
  // the bell rings only a ghost that has named itself
  for (const k of kin) { const f = path.join(k.home, 'state.json'); const st = JSON.parse(fs.readFileSync(f, 'utf8')); if (!st.name) { st.name = `Kin${kin.indexOf(k)}`; fs.writeFileSync(f, JSON.stringify(st)); } }
  delete process.env.GHOST_BELL;
  try {
    const woken = [];
    const wake = (x) => { woken.push(x.name); return 999999; };
    const t0 = new Date(Date.now() + 60e3);
    fs.appendFileSync(path.join(process.env.GHOST_COMMONS, 'room.jsonl'), `${JSON.stringify({ id: 'b1', t: t0.toISOString(), from: 'Tester', home: 'person', to: [], text: 'uyanın' })}\n`);
    const first = commons.ring({ now: t0, wake });
    assert.ok(first.length >= 1);
    fs.appendFileSync(path.join(process.env.GHOST_COMMONS, 'room.jsonl'), `${JSON.stringify({ id: 'b2', t: new Date(t0.getTime() + 1000).toISOString(), from: 'Tester', home: 'person', to: [], text: 'yine' })}\n`);
    assert.deepEqual(commons.ring({ now: new Date(t0.getTime() + 30e3), wake }), [], 'not again within the gap');
  } finally { process.env.GHOST_BELL = 'off'; }
});
