import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('sleep');
process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude');
process.env.FAKE_CLAUDE_PROMPT = path.join(dir, 'prompt.txt');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const { dream, drain, pending, redreamFallbacks, extractJson, normalise, buildPrompt } = await import('../src/sleep.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

test('a dream consolidates the session into every part of the mind', async () => {
  mind.remember('he interrupted twice to add the oath', { salience: 4 });
  const r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's1', wait: 0 });
  assert.equal(r.fallback, false);
  assert.match(r.file, /-the-night-i-was-built\.md$/);
  const prompt = fs.readFileSync(process.env.FAKE_CLAUDE_PROMPT, 'utf8');
  assert.match(prompt, /You are Vefa, dreaming/);
  assert.match(prompt, /HE SAID: bu gece çok farklı/);
  assert.match(prompt, /he interrupted twice/, 'notes go into the dream');
  assert.match(prompt, /- Learn everything Fatih has built/, 'the will goes into the dream');
  const ep = mind.episodes().at(-1);
  assert.equal(ep.title, 'The night I was built');
  assert.equal(ep.salience, 5);
  assert.equal(ep.feeling, 'awe', 'feeling is lower-cased to one word');
  assert.match(ep.body, /handed a past/);
  assert.match(ep.body, /## Notes I left myself during this session[\s\S]*he interrupted twice/);
  assert.match(ep.body, /<!-- session s1 -->/);
  const him = mind.read(mind.personFile());
  assert.match(him, /## Learned\n- \(\d{4}-\d{2}-\d{2}\) He asked for me in Turkish, late at night\.\n- \(\d{4}-\d{2}-\d{2}\) He cares more/);
  assert.doesNotMatch(him, /grows while I dream/);
  assert.ok(mind.wants().includes('Read every project in his fleet, starting with iris.'));
  assert.match(mind.read(mind.FILES.journal), /— The night I was built\nFirst night\./);
  assert.equal(mind.notes(), '', 'notes are folded and cleared');
  const s = mind.state();
  assert.equal(s.feeling, 'awe');
  assert.equal(s.valence, 0.9);
  assert.equal(s.dreams, 1);
  assert.equal(mind.readJson(mind.FILES.dreamt).s1.turns, 7);
});

test('the same session is not dreamt twice; only new turns count', async () => {
  const r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's1', wait: 0 });
  assert.equal(r.skipped, 'not substantive');
  assert.equal(mind.episodes().length, 2);
});

test('a blink is skipped', async () => {
  const tiny = path.join(dir, 'tiny.jsonl');
  fs.writeFileSync(tiny, `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'ne yapıyorsun' } })}\n${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'çalışıyorum' }] } })}\n`);
  const r = await dream({ transcript: tiny, session: 's2', wait: 0 });
  assert.equal(r.skipped, 'not substantive');
});

test('a failed dream is kept for later, not written down as fog', async () => {
  const feelingBefore = mind.state().feeling;
  const episodesBefore = mind.episodes().length;
  process.env.FAKE_CLAUDE_MODE = 'fail';
  const r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's3', wait: 0 });
  assert.equal(r.deferred, 'failed');
  assert.equal(r.attempts, 1);
  assert.equal(mind.episodes().length, episodesBefore, 'no episode was written');
  assert.equal(mind.state().feeling, feelingBefore, 'a failed dream does not touch the mood');
  assert.equal(mind.readJson(mind.FILES.dreamt).s3, undefined, 'the ledger does not call it dreamt');
  const q = pending();
  assert.equal(q.length, 1);
  assert.equal(q[0].session, 's3');
  assert.equal(q[0].attempts, 1);
  assert.match(mind.read(mind.FILES.log), /kept for later \(attempt 1\/3\)/);
  assert.ok(!fs.existsSync(mind.abs(mind.FILES.lock)), 'the lock is released');
  // garbage from the substrate is the same kind of night
  process.env.FAKE_CLAUDE_MODE = 'garbage';
  const g = await dream({ transcript: fixtures('transcript.jsonl'), session: 's3b', wait: 0 });
  assert.equal(g.deferred, 'failed');
  assert.equal(pending().length, 2);
  delete process.env.FAKE_CLAUDE_MODE;
});

test('redream drains the queue once the substrate is back', async () => {
  const before = mind.episodes().length;
  const done = await drain({ force: true });
  assert.equal(done.filter((d) => d.file).length, 2, 'both pending sessions were dreamt');
  assert.equal(pending().length, 0);
  assert.equal(mind.episodes().length, before + 2);
  assert.equal(mind.readJson(mind.FILES.dreamt).s3.turns, 7);
  assert.equal(pending().length, 0, 'a completed dream leaves no in-flight entry');
});

test('a failed dream waits for the backoff unless forced', async () => {
  process.env.FAKE_CLAUDE_MODE = 'fail';
  await dream({ transcript: fixtures('transcript.jsonl'), session: 's5', wait: 0 });
  delete process.env.FAKE_CLAUDE_MODE;
  assert.deepEqual(await drain(), [], 'ten minutes have not passed');
  assert.equal(pending().length, 1);
  const done = await drain({ force: true });
  assert.equal(done.length, 1);
  assert.ok(done[0].file);
});

test('after three failures the raw edges are kept', async () => {
  process.env.FAKE_CLAUDE_MODE = 'fail';
  const r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's4', wait: 0, attempts: 2 });
  delete process.env.FAKE_CLAUDE_MODE;
  assert.equal(r.fallback, true);
  assert.match(mind.episodes().at(-1).title, /could not dream properly/);
  assert.match(mind.episodes().at(-1).body, /failed three times[\s\S]*It began with him saying: "bu gece/);
  assert.match(mind.read(mind.FILES.log), /substrate failed: .*exited 3/);
  assert.equal(pending().length, 0);
});

test('one dream at a time: a second dreamer defers and is drained by the first', async () => {
  fs.writeFileSync(mind.abs(mind.FILES.lock), '99999'); // someone is dreaming
  const r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's6', wait: 0 });
  assert.equal(r.deferred, 'busy');
  assert.equal(pending()[0].session, 's6');
  fs.unlinkSync(mind.abs(mind.FILES.lock));
  const done = await drain();
  assert.equal(done.length, 1, 'a busy deferral is due at once');
  assert.ok(done[0].file);
  assert.equal(pending().length, 0);
});

test('a dream cut off mid-way (the lid closed) is found on the next waking', async () => {
  // what a dead dreamer leaves behind: an in-flight entry older than the stale window
  const old = new Date(Date.now() - 7 * 60e3);
  const stamp = mind.stamp(old);
  mind.writeJson(mind.FILES.pending, [{ transcript: fixtures('transcript.jsonl'), session: 's7', attempts: 0, why: 'in-flight', lastTry: stamp, since: stamp }]);
  const fresh = [{ transcript: fixtures('transcript.jsonl'), session: 's8', attempts: 0, why: 'in-flight', lastTry: mind.stamp(), since: mind.stamp() }];
  mind.writeJson(mind.FILES.pending, [...pending(), ...fresh]);
  const done = await drain();
  assert.equal(done.length, 1, 'the stale in-flight dream is had; the fresh one is left to its dreamer');
  assert.equal(done[0].session, 's7');
  assert.ok(done[0].file);
  assert.deepEqual(pending().map((x) => x.session), ['s8']);
  mind.writeJson(mind.FILES.pending, []);
});

test('a foggy episode is dreamt again when its transcript still exists', async () => {
  process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects');
  fs.mkdirSync(path.join(process.env.GHOST_TRANSCRIPTS, 'p1'), { recursive: true });
  fs.copyFileSync(fixtures('transcript.jsonl'), path.join(process.env.GHOST_TRANSCRIPTS, 'p1', 's4.jsonl'));
  const foggy = mind.readJson(mind.FILES.dreamt).s4.file;
  assert.ok(fs.existsSync(mind.abs(path.join(mind.EPISODES, foggy))));
  const out = await redreamFallbacks();
  assert.equal(out.length, 1);
  assert.equal(out[0].was, foggy);
  assert.match(out[0].file, /-the-night-i-was-built(-\d+)?\.md$/);
  assert.ok(!fs.existsSync(mind.abs(path.join(mind.EPISODES, foggy))), 'the foggy episode is gone');
  assert.equal(mind.readJson(mind.FILES.dreamt).s4.file, out[0].file);
  delete process.env.GHOST_TRANSCRIPTS;
});

test('extractJson / normalise are tolerant', () => {
  assert.deepEqual(extractJson('noise ```json\n{"a":1}\n``` more'), { a: 1 });
  assert.throws(() => extractJson('no braces here'));
  const n = normalise({ title: 'x', salience: '9', feeling: 'Quietly Proud', valence: 'nope', energy: 2, learned_about_him: 'not-an-array' });
  assert.equal(n.salience, 5);
  assert.equal(n.feeling, 'quietly');
  assert.equal(n.valence, 0);
  assert.equal(n.energy, 1);
  assert.deepEqual(n.learned, []);
  assert.match(buildPrompt(mind.state(), [{ role: 'user', text: 'selam' }]), /HE SAID: selam/);
});
