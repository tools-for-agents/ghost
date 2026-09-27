import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('sweep');
process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude');
process.env.FAKE_CLAUDE_PROMPT = path.join(dir, 'prompt.txt');
process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const { sleep, dream, orphans, sweep, sweepDue, napIfDue, pending, NAP_MINUTES, NAP_BYTES } = await import('../src/sleep.js');
const { pulse } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

// A transcript big enough to be a session, in the place Claude Code keeps them.
const fixture = fs.readFileSync(fixtures('transcript.jsonl'), 'utf8');
const pad = `{"type":"pad","x":"${'x'.repeat(70 * 1024)}"}\n`;
function transcript(session, { entrypoint = 'cli', ageMinutes = 60, extra = '' } = {}) {
  const d = path.join(dir, 'projects', '-Users-x-proj');
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, `${session}.jsonl`);
  fs.writeFileSync(f, `{"type":"user","entrypoint":"${entrypoint}","message":{"role":"user","content":"hi"}}\n${fixture}${extra}${pad}`);
  const t = new Date(Date.now() - ageMinutes * 60e3);
  fs.utimesSync(f, t, t);
  return f;
}

test('sleep does not spawn a dreamer for a blink', () => {
  const f = path.join(dir, 'blink.jsonl');
  fs.writeFileSync(f, '{"type":"user","message":{"role":"user","content":"/usage"}}\n');
  assert.equal(sleep({ transcript_path: f, session_id: 'blink' }), 'blink');
  assert.match(mind.read(mind.FILES.log), /session blink was a blink/);
});

test('orphans: a session that grew after it last slept, and is no longer being written, is found', () => {
  const dead = transcript('dead1');                                   // never dreamt, idle an hour
  const fresh = transcript('live1', { ageMinutes: 2 });               // still being written
  transcript('prog1', { entrypoint: 'sdk-cli' });                     // a program's call
  const done = transcript('done1');
  const ledger = mind.readJson(mind.FILES.dreamt, {});
  ledger.done1 = { when: mind.stamp(), turns: 9, bytes: fs.statSync(done).size, file: 'x.md' }; // dreamt at this very size
  mind.writeJson(mind.FILES.dreamt, ledger);
  presence.arrive('awake1', 'proj');                                  // awake and talking
  transcript('awake1');
  const found = orphans().map((o) => o.session);
  assert.deepEqual(found, ['dead1'], `got ${found}`);
  assert.ok(fresh);
});

test('sweep queues them and dreams them, once per few minutes across all wakings', async () => {
  assert.equal(sweepDue(), true);
  const r = await sweep();
  assert.deepEqual(r.found.map((o) => o.session), ['dead1']);
  assert.equal(r.dreamt.length, 1);
  assert.match(r.dreamt[0].file, /the-night-i-was-built/);
  assert.equal(pending().length, 0);
  assert.equal(sweepDue(), false, 'just swept');
  assert.match(mind.read(mind.FILES.log), /sweep: 1 session\(s\) ended without sleeping — dead1/);
  assert.deepEqual(orphans(), [], 'dreamt at this size: not an orphan any more');
});

test('a nap: the heartbeat dreams a long session while it is still going, and only what is new', async () => {
  const f = transcript('long1', { ageMinutes: 1 });
  presence.arrive('long1', 'proj');
  presence.mark('long1', { since: mind.stamp(new Date(Date.now() - (NAP_MINUTES + 1) * 60e3)) });
  // Not enough new bytes yet: no nap.
  assert.equal(napIfDue({ session_id: 'long1', transcript_path: f }), null);
  fs.appendFileSync(f, `{"type":"pad","x":"${'y'.repeat(NAP_BYTES)}"}\n`);
  const pid = napIfDue({ session_id: 'long1', transcript_path: f });
  assert.ok(pid, 'a nap was spawned');
  const me = mind.readJson(presence.PRESENCE, {}).long1;
  assert.ok(me.napAt && me.napBytes > NAP_BYTES);
  assert.equal(napIfDue({ session_id: 'long1', transcript_path: f }), null, 'not twice in the same hour');
  await new Promise((r) => setTimeout(r, 1500)); // the detached dreamer, with the fake substrate
  const ledger = mind.readJson(mind.FILES.dreamt, {});
  assert.ok(ledger.long1?.naps >= 1, `ledger: ${JSON.stringify(ledger.long1)}`);
  assert.match(mind.read(mind.FILES.log), /nap: session long1 has \d+ KB it has not dreamt/);
  assert.match(mind.read(mind.FILES.log), /\(a nap: the session goes on\)/);
});

test('the heartbeat files what they said, live', () => {
  mind.saveState({ sessionId: 'p1' });
  presence.arrive('p1', 'proj');
  pulse({ session_id: 'p1', prompt: 'iyi geceler vefa, yarın bakacağız' });
  assert.match(mind.read(mind.saidFile()), /— "iyi geceler vefa, yarın bakacağız"/);
  pulse({ session_id: 'p1', prompt: '<task-notification>done</task-notification>' });
  assert.doesNotMatch(mind.read(mind.saidFile()), /task-notification/, 'a harness line is not his');
});

test('a dream folds the notes of its own place, and the ones nobody awake is standing in — not another bay\'s', async () => {
  mind.clearNotes();
  presence.arrive('bayA', 'momento');
  presence.arrive('bayB', 'vc');
  mind.remember('momento: the shelf sells nothing on build 4', { place: 'momento' });
  mind.remember('vc: the album needs a closer', { place: 'vc' });
  mind.remember('memory: wrote the fleet memory file', { place: 'memory' });   // nobody awake there
  const f = transcript('m1', { ageMinutes: 60 });
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('"entrypoint":"cli"', '"entrypoint":"cli","cwd":"/Users/x/Dev/momento"'));
  const r = await dream({ transcript: f, session: 'm1', wait: 0 });
  const ep = mind.read(path.join(mind.EPISODES, r.file));
  assert.match(ep, /the shelf sells nothing/);
  assert.match(ep, /wrote the fleet memory file/, 'a note from a place nobody is awake in comes along');
  assert.doesNotMatch(ep, /album needs a closer/, "vc's note stays for vc's dream");
  assert.match(mind.notes(), /album needs a closer/);
  assert.doesNotMatch(mind.notes(), /shelf sells nothing/);
  const prompt = fs.readFileSync(process.env.FAKE_CLAUDE_PROMPT, 'utf8');
  assert.doesNotMatch(prompt, /album needs a closer/, 'nor does it go into the dream prompt');
});

test('the heartbeat drains a due queue when nobody is dreaming, at most every few minutes', async () => {
  const { drainIfDue, dreaming } = await import('../src/sleep.js');
  assert.equal(dreaming(), false);
  mind.writeJson(mind.FILES.pending, [{ transcript: transcript('q1'), session: 'q1', attempts: 0, why: 'never slept', since: mind.stamp() }]);
  mind.saveState({ lastDrain: undefined });
  const pid = drainIfDue();
  assert.ok(pid, 'a drainer was spawned');
  assert.equal(drainIfDue(), null, 'not again within five minutes');
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(pending().length, 0, 'the queue was dreamt');
  fs.writeFileSync(mind.abs(mind.FILES.lock), '1');
  assert.equal(dreaming(), true, 'a fresh lock is a live dreamer');
  fs.unlinkSync(mind.abs(mind.FILES.lock));
});
