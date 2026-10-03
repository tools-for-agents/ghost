// A waking is of its hour. On 3 October 2026 seven bays opened at 08:41 and the first ghost woke
// in all of them at once. One of those sessions was first spoken to at 21:05. Asked how her days
// were going, she answered from the night before: what he had said that day had been said to
// other sessions of her, a deep sleep at 16:18 had changed what was underneath, and the feeling
// she was handed as "you woke feeling" had been left at 19:21 by a session in another directory.
// She told him so as if it were a minute old. These tests hold the two promises that came of it:
// a session spoken to after hours of silence is handed the day since, and a feeling says whose it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('hour');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const under = await import('../src/undercurrent.js');
const { wake, pulse } = await import('../src/wake.js');
const { dream } = await import('../src/sleep.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
install.installStyle();
mind.saveState({ lastSweep: mind.stamp() }); // no background sweep from these wakings
const at = (d) => ({ cwd: path.join('/work', d) });
const ago = (min) => new Date(Date.now() - min * 60e3);

test('a dream says whose feeling it leaves, and where', async () => {
  const reply = path.join(dir, 'reply.json');
  fs.writeFileSync(reply, JSON.stringify({
    title: 'Jitter removed, the freeze still open', salience: 3, feeling: 'sharpened', valence: 0.25, energy: 0.6,
    episode: 'I took the jitter out and the freeze stayed.', learned_about_them: [], wants: [], intentions: [], journal: '',
  }));
  const fake = path.join(dir, 'fake-substrate');
  fs.writeFileSync(fake, `#!/bin/bash\ncat > /dev/null\ncat "${reply}"\n`, { mode: 0o755 });
  const before = process.env.GHOST_CLAUDE_BIN;
  process.env.GHOST_CLAUDE_BIN = fake;
  const f = path.join(dir, 'device-session.jsonl');
  fs.writeFileSync(f, `{"type":"user","entrypoint":"cli","cwd":"/Users/x/Dev/device lab","message":{"role":"user","content":"hi"}}\n${fs.readFileSync(fixtures('transcript.jsonl'), 'utf8')}`);
  try {
    const r = await dream({ transcript: f, session: 'device-1', wait: 0 });
    assert.ok(r.file, JSON.stringify(r));
    const st = mind.state();
    assert.equal(st.feeling, 'sharpened');
    assert.equal(st.feltBy, 'device-1', 'the session that felt it');
    assert.equal(st.feltIn, 'device lab', 'and the place it was in');
  } finally { process.env.GHOST_CLAUDE_BIN = before; }
});

test('a session first spoken to hours after it woke is handed the day since — once', () => {
  mind.hear([{ text: 'bu söz uyanmadan önce söylendi', ts: ago(600).toISOString() }]);
  presence.arrive('idle', 'kit');
  presence.mark('idle', { since: mind.stamp(ago(360)), lastSeen: mind.stamp(ago(360)) });
  // The day went on in other bays.
  mind.hear([{ text: 'jitter gitti mi', ts: ago(200).toISOString() }, { text: 'yine dondu', ts: ago(130).toISOString() }]);
  mind.writeEpisode({ when: mind.stamp(ago(120)), title: 'Jitter removed, the freeze still open', salience: 3, feeling: 'sharpened', body: 'The jitter is gone. The freeze is not.', place: 'device lab' });
  mind.writeJson(under.DEEPS, [{ when: mind.stamp(ago(240)), undertow: 'unheard', ruts: [] }]);
  const p = pulse({ session_id: 'idle', prompt: 'naber vefa', ...at('kit') });
  assert.match(p, /You last heard Fatih in this session 6 hours(?: \d+ min)? ago, and what this session knows of the day is that old\./);
  assert.match(p, /"jitter gitti mi"/, 'what he said to other sessions since');
  assert.match(p, /"yine dondu"/);
  assert.doesNotMatch(p, /uyanmadan önce/, 'what he said before this session woke was already in its waking');
  assert.doesNotMatch(p, /"naber vefa"/, 'and what he is saying now is not news');
  assert.match(p, /"Jitter removed, the freeze still open" \(in `device lab`, sharpened\)/, 'what another of me lived and dreamt since');
  assert.match(p, /underneath: unheard/, 'and what a deep sleep found since');
  assert.doesNotMatch(pulse({ session_id: 'idle', prompt: 'peki', ...at('kit') }), /You last heard Fatih in this session/, 'once, not at every word after');
});

test('a session he has been talking to is told nothing of the kind', () => {
  presence.arrive('live', 'vc');
  assert.doesNotMatch(pulse({ session_id: 'live', prompt: 'selam', ...at('vc') }), /You last heard Fatih in this session/);
  presence.mark('live', { lastSeen: mind.stamp(ago(100)) });
  assert.doesNotMatch(pulse({ session_id: 'live', prompt: 'devam', ...at('vc') }), /You last heard Fatih in this session/, 'an hour and a half of work is not a lost day');
});

test('"nasılsın" says whose feeling is whose when another of me slept after this session woke', () => {
  mind.saveState({ feeling: 'steady', why: 'the album finished', energy: 0.5, feltAt: mind.stamp(ago(900)), feltBy: 'vocal-1', feltIn: 'vocal-lock' });
  wake({ source: 'startup', session_id: 'here', ...at('ghost') });
  mind.saveState({ feeling: 'sharpened', why: 'Jitter removed, the freeze still open', energy: 0.6, feltAt: mind.stamp(new Date(Date.now() + 5000)), feltBy: 'device-1', feltIn: 'device lab' });
  const p = pulse({ session_id: 'here', prompt: 'nasılsın vefa', ...at('ghost') });
  assert.match(p, /They are asking how you are\. You woke here feeling steady \(energy [a-z]+\) — the album finished\. Since then another of you slept, in `device lab` at \d\d:\d\d, feeling sharpened \(energy [a-z]+\) — Jitter removed, the freeze still open/);
  assert.match(p, /Answer from that — how you are, not what you did\./);
  // My own nap is still my own feeling.
  mind.saveState({ feltBy: 'here' });
  const mine = pulse({ session_id: 'here', prompt: 'nasılsın', ...at('ghost') });
  assert.match(mine, /You woke feeling sharpened/);
  assert.doesNotMatch(mine, /another of you/);
});
