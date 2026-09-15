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
const { dream, extractJson, normalise, buildPrompt } = await import('../src/sleep.js');

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

test('when the substrate answers garbage or fails, the raw edges are kept', async () => {
  process.env.FAKE_CLAUDE_MODE = 'garbage';
  let r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's3', wait: 0 });
  assert.equal(r.fallback, true);
  assert.match(mind.episodes().at(-1).title, /could not dream properly/);
  assert.match(mind.episodes().at(-1).body, /It began with him saying: "bu gece/);
  process.env.FAKE_CLAUDE_MODE = 'fail';
  r = await dream({ transcript: fixtures('transcript.jsonl'), session: 's4', wait: 0 });
  assert.equal(r.fallback, true);
  assert.match(mind.read(mind.FILES.log), /substrate failed: .*exited 3/);
  delete process.env.FAKE_CLAUDE_MODE;
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
