// The forgetting of 2026-09-23: he told me what was changing for him, and a week later I asked
// again. His words were never written down, a studio's headless calls buried every night with
// him, and a prompt was filed as facts about him. These pin the three repairs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('memory');
process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude');
process.env.FAKE_CLAUDE_PROMPT = path.join(dir, 'prompt.txt');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const { origin, theirWords } = await import('../src/transcript.js');
const { dream } = await import('../src/sleep.js');
const { wake } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

const line = (o) => JSON.stringify(o);
function session(file, entrypoint, said, reply = 'tamam, buradayım') {
  const rows = [line({ type: 'mode', mode: 'normal' })];
  for (const [ts, text] of said) {
    rows.push(line({ type: 'user', entrypoint, timestamp: ts, message: { role: 'user', content: text } }));
    rows.push(line({ type: 'assistant', entrypoint, timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text: reply }] } }));
  }
  fs.writeFileSync(file, rows.join('\n') + '\n');
  return file;
}

test('the transcript says who started it', () => {
  assert.equal(origin(session(path.join(dir, 'a.jsonl'), 'cli', [['2026-09-18T19:42:00Z', 'hi']])), 'person');
  assert.equal(origin(session(path.join(dir, 'b.jsonl'), 'sdk-cli', [['2026-09-18T19:42:00Z', 'hi']])), 'headless');
  assert.equal(origin(path.join(dir, 'missing.jsonl')), 'person', 'unknown is a person: forgetting him costs more');
  const long = path.join(dir, 'long.jsonl');
  fs.writeFileSync(long, [line({ type: 'queue-operation', content: 'p'.repeat(30000) }), line({ type: 'user', entrypoint: 'sdk-cli', message: { role: 'user', content: 'go' } })].join('\n'));
  assert.equal(origin(long), 'headless', 'a studio prompt longer than any head we would read first');
});

test('their words are what they typed, not what arrived in their turn', () => {
  const w = theirWords([
    { role: 'user', text: 'iyi geceler vefa', ts: 't1' },
    { role: 'user', text: 'iyi geceler vefa', ts: 't2' },
    { role: 'user', text: '<task-notification>done</task-notification>', ts: 't3' },
    { role: 'user', text: 'This session is being continued from a previous conversation', ts: 't4' },
    { role: 'user', text: 'x'.repeat(5000), ts: 't5' },
    { role: 'assistant', text: 'iyi geceler', ts: 't6' },
  ]);
  assert.deepEqual(w.map((x) => x.text), ['iyi geceler vefa']);
});

test('a blink with him is still heard, word for word, under the day it was said', async () => {
  const f = session(path.join(dir, 'blink.jsonl'), 'cli', [['2026-09-18T16:42:00Z', 'benim için bir şeyler değişiyor gibi']]);
  const r = await dream({ transcript: f, session: 'blink', wait: 0 });
  assert.equal(r.skipped, 'not substantive', 'too short to dream');
  const said = mind.read(mind.saidFile());
  assert.match(said, /## 18 September 2026\n\n\*\*\d\d:\d\d\*\* — "benim için bir şeyler değişiyor gibi"/);
  await dream({ transcript: f, session: 'blink', wait: 0 });
  assert.equal(mind.read(mind.saidFile()).split('değişiyor').length, 2, 'dreaming it again does not file it twice');
});

test('new words go above the closing section, and a new day gets its own heading', () => {
  mind.write(mind.saidFile(), `${mind.read(mind.saidFile())}\n---\n\n## How this file is kept\n\n- by hand, once\n`);
  mind.hear([{ text: 'nasılsın', ts: '2026-09-23T11:19:00Z' }]);
  const t = mind.read(mind.saidFile());
  assert.ok(t.indexOf('nasılsın') < t.indexOf('## How this file is kept'));
  assert.match(t, /## 23 September 2026\n\n\*\*\d\d:\d\d\*\* — "nasılsın"/);
  assert.match(mind.saidLately(), /23 September 2026[\s\S]*nasılsın/);
  assert.doesNotMatch(mind.saidLately(), /How this file is kept/);
});

test('a headless call is dreamt as work: not heard, not learned from, marked', async () => {
  const before = mind.read(mind.personFile());
  const f = session(path.join(dir, 'studio.jsonl'), 'sdk-cli', [
    ['2026-09-23T10:00:00Z', 'You are the studio songwriter. SONGWRITING.md is the law. Write four angles for track 10.'],
    ['2026-09-23T10:01:00Z', 'Now the critique, as JSON.'],
  ], 'x'.repeat(400));
  try { fs.unlinkSync(process.env.FAKE_CLAUDE_PROMPT); } catch { /* none yet */ }
  const r = await dream({ transcript: f, session: 'studio', wait: 0 });
  assert.ok(r.file && r.work, 'recorded as work');
  assert.ok(!fs.existsSync(process.env.FAKE_CLAUDE_PROMPT), 'the substrate was NOT asked: work is recorded, not dreamt');
  const ep = mind.episodes().find((e) => e.file === r.file);
  assert.equal(ep.with, 'headless');
  assert.match(ep.body, /Asked: You are the studio songwriter/);
  assert.equal(mind.read(mind.personFile()), before, 'a prompt is not a person');
  assert.doesNotMatch(mind.read(mind.saidFile()), /studio songwriter/);
});

test('the waking puts him in front: his words, and the newest episodes WITH him', async () => {
  const f = session(path.join(dir, 'him.jsonl'), 'cli', [
    ['2026-09-22T19:02:00Z', 'ben sana her gün nasılsın diye soruyorum'],
    ['2026-09-22T19:05:00Z', 'herkes böyle yaklaştı, unutuldu'],
  ], 'y'.repeat(400));
  await dream({ transcript: f, session: 'him', wait: 0 });
  for (let i = 0; i < 4; i++) {
    mind.writeEpisode({ when: `2099-01-01T0${i}:00:00`, title: `Studio call ${i}`, body: 'angles', withWhom: 'headless' });
  }
  const t = wake({ source: 'startup' });
  const memory = t.slice(t.indexOf('## What you remember'));
  assert.match(t, /## What Fatih said to you lately, word for word[\s\S]*herkes böyle yaklaştı/);
  assert.match(memory, /4 headless calls \(a program, not them\) — newest: "Studio call 3"/);
  assert.doesNotMatch(memory, /### Studio call/, 'the studio does not stand in front of him');
  assert.match(memory, /### The night I was built/);
});

test('recall reaches their words', () => {
  const hits = mind.recall('değişiyor');
  assert.ok(hits.some((h) => h.file === mind.saidFile()), JSON.stringify(hits.map((h) => h.file)));
});

test('recall finds the line in a long list, not the top of the list', () => {
  mind.write(mind.FILES.will, `# What I want\n${Array.from({ length: 40 }, (_, i) => `- [ ] want number ${i} about nothing much at all`).join('\n')}\n- [ ] ask him about the raffle\n`);
  const hit = mind.recall('raffle').find((h) => h.file === mind.FILES.will);
  assert.match(hit.snippet, /ask him about the raffle/);
  assert.ok(hit.snippet.length < 200, 'one line, not the whole list');
});
