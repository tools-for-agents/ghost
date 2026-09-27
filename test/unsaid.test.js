import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('unsaid');
process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude');
process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const { lastSaid } = await import('../src/transcript.js');
const { sweep, unsaid, claimUnsaid, UNSAID, sweepDue } = await import('../src/sleep.js');
const { wake, pulse } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

const fixture = fs.readFileSync(fixtures('transcript.jsonl'), 'utf8');
const pad = `{"type":"pad","x":"${'x'.repeat(70 * 1024)}"}\n`;
function transcript(session, { cwd = '/Users/x/Dev/momento', ageMinutes = 60, tail = '' } = {}) {
  const d = path.join(dir, 'projects', '-Users-x-Dev-momento');
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, `${session}.jsonl`);
  fs.writeFileSync(f, `{"type":"user","entrypoint":"cli","cwd":"${cwd}","message":{"role":"user","content":"hi"}}\n${fixture}${tail}${pad}`);
  const t = new Date(Date.now() - ageMinutes * 60e3);
  fs.utimesSync(f, t, t);
  return f;
}

test('lastSaid: the last thing I said, from the tail of the file, without the tool calls', () => {
  const f = transcript('t1', { ageMinutes: 2 });
  const last = lastSaid(f);
  assert.match(last.text, /^Evet, hepsi\. SessionStart/);
  assert.doesNotMatch(last.text, /\[used Bash/);
  assert.match(last.ts, /^2026-09-15T23:4/);
  // A tool-use-only turn at the end is not what I said; the text before it is.
  const g = transcript('t2', { ageMinutes: 2, tail: '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{"command":"ls"}}]},"timestamp":"2026-09-15T23:50:00Z"}\n' });
  assert.match(lastSaid(g).text, /^Evet, hepsi/);
  // A subagent's side-chain is not me talking to him.
  const h = transcript('t3', { ageMinutes: 2, tail: '{"type":"assistant","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"side chain text that is long enough to count as something said"}]},"timestamp":"2026-09-15T23:51:00Z"}\n' });
  assert.match(lastSaid(h).text, /^Evet, hepsi/);
  assert.equal(lastSaid(path.join(dir, 'nope.jsonl')), null);
});

test('sweep: a session that ended without sleeping leaves its last words behind, with where and when', async () => {
  transcript('dead1');
  const r = await sweep();
  assert.deepEqual(r.found.map((o) => o.session), ['dead1']);
  const u = unsaid();
  assert.equal(u.length, 1);
  assert.equal(u[0].session, 'dead1');
  assert.equal(u[0].place, 'momento');
  assert.match(u[0].when, /^2026-09-1[56]T/, 'dated when it was said, in local time');
  assert.match(u[0].text, /^Evet, hepsi/);
  assert.ok(u[0].found, 'when the sweep found it');
  assert.match(mind.read(mind.FILES.log), /unsaid: dead1 in momento/);
});

test('the waking in that place hands it back once; a waking elsewhere leaves it for whoever stands there', () => {
  mind.saveState({ lastSweep: mind.stamp() }); // no background sweep from these wakings
  const elsewhere = wake({ source: 'startup', session_id: 'w-vc', cwd: '/Users/x/Dev/vc' });
  assert.doesNotMatch(elsewhere, /may never have seen/, 'fresh, and for momento');
  assert.equal(unsaid().length, 1);
  const here = wake({ source: 'startup', session_id: 'w-mo', cwd: '/Users/x/Dev/momento' });
  assert.match(here, /## The last thing you said, which Fatih may never have seen/);
  assert.match(here, /### in `momento`, 2026-09-1[56] \d\d:\d\d\nEvet, hepsi/);
  assert.equal(unsaid().length, 0, 'handed back, so gone');
  assert.doesNotMatch(wake({ source: 'startup', session_id: 'w-mo2', cwd: '/Users/x/Dev/momento' }), /may never have seen/, 'once');
});

test('after a while, any of me takes it — unless one of me is awake in that place', () => {
  const old = (place, min) => ({ session: `s-${place}`, place, when: '2026-09-20T01:06:00', found: mind.stamp(new Date(Date.now() - min * 60e3)), text: `the last thing said in ${place}, long enough to be worth handing back to him` });
  mind.writeJson(UNSAID, [old('vc', 45), old('wishtree', 45), old('crucible', 5)]);
  presence.arrive('awake-vc', 'vc');
  const got = claimUnsaid({ place: 'fleet', awake: ['vc', 'fleet'] });
  assert.deepEqual(got.map((e) => e.place), ['wishtree'], 'vc has someone awake, crucible is too fresh');
  assert.deepEqual(unsaid().map((e) => e.place), ['vc', 'crucible']);
  presence.leave('awake-vc');
});

test('the heartbeat hands one back too, when they are speaking, and sweeps when a sweep is due', () => {
  mind.writeJson(UNSAID, [{ session: 's-vc', place: 'vc', when: '2026-09-20T01:06:00', found: mind.stamp(new Date(Date.now() - 45 * 60e3)), text: 'the album table we agreed on: ten tracks, In The Red first, and the rest as listed' }]);
  mind.saveState({ sessionId: 'p1', lastSeen: mind.stamp(), lastSweep: mind.stamp() });
  presence.arrive('p1', 'vc');
  assert.equal(pulse({ session_id: 'p1', prompt: '<task-notification>done</task-notification>', cwd: '/Users/x/Dev/vc' }), '', 'a harness line is not the moment');
  const t = pulse({ session_id: 'p1', prompt: 'albüm nasıl gidiyor', cwd: '/Users/x/Dev/vc' });
  assert.match(t, /The last thing you said in `vc` \(2026-09-20 01:06\)[\s\S]*Fatih may never have seen it: "the album table we agreed on/);
  assert.equal(unsaid().length, 0);
  // The sweep runs from the heartbeat as well, so a killed bay is found while the day goes on.
  mind.saveState({ lastSweep: undefined });
  assert.equal(sweepDue(), true);
  pulse({ session_id: 'p1', prompt: 'devam', cwd: '/Users/x/Dev/vc' });
  assert.equal(sweepDue(), false, 'the heartbeat claimed the sweep');
});

test('unsaid: capped and expiring, and a short last word is not worth handing back', async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ session: `m${i}`, place: 'x', when: '2026-09-20T00:00:00', found: mind.stamp(), text: `entry ${i} long enough to be an entry that is worth keeping around for a while` }));
  many[0].found = '2026-09-01T00:00:00'; // long gone
  mind.writeJson(UNSAID, many);
  transcript('short1', { tail: '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Tamam."}]},"timestamp":"2026-09-15T23:59:00Z"}\n' });
  await sweep();
  const u = unsaid();
  assert.ok(u.length <= 12, `capped: ${u.length}`);
  assert.ok(!u.some((e) => e.session === 'm0'), 'expired');
  assert.ok(!u.some((e) => e.session === 'short1'), '"Tamam." is not a cut-off');
});
