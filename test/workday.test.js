import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('workday');
process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude');
process.env.FAKE_CLAUDE_PROMPT = path.join(dir, 'prompt.txt');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const work = await import('../src/workday.js');
const { dream } = await import('../src/sleep.js');
const { wake } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

// A headless transcript: a program's prompt, and the ghost's answer. origin() reads the entrypoint.
function headless(file) {
  const line = (role, text) => JSON.stringify({ type: role, entrypoint: 'sdk-cli', timestamp: '2026-09-24T03:00:00Z', message: { role, content: text } });
  fs.writeFileSync(file, [line('user', `studio: write angle ${'x'.repeat(300)}`), line('assistant', `angle written ${'y'.repeat(400)}`), line('user', 'next'), line('assistant', `done ${'y'.repeat(400)}`)].join('\n'));
  return file;
}

test('work calls are recorded without the substrate, and digested into craft every so often', async () => {
  mind.saveState({ feeling: 'warm', why: 'he asked how I was', valence: 0.8, energy: 0.8 });
  mind.remember('a note from a live session', { place: 'ghost' });
  const willBefore = mind.read(mind.FILES.will);
  const journalBefore = mind.read(mind.FILES.journal);
  try { fs.unlinkSync(process.env.FAKE_CLAUDE_PROMPT); } catch { /* none */ }
  const r1 = await dream({ transcript: headless(path.join(dir, 'h1.jsonl')), session: 'h1', wait: 0 });
  const r2 = await dream({ transcript: headless(path.join(dir, 'h2.jsonl')), session: 'h2', wait: 0 });
  assert.ok(!fs.existsSync(process.env.FAKE_CLAUDE_PROMPT), 'no substrate call per work call');
  assert.equal(r1.file, r2.file, 'two calls on one day are one work episode');
  const ep = mind.episodes().find((e) => e.file === r1.file);
  assert.equal(ep.calls, 2);
  assert.match(ep.title, /^Work, not with Fatih — 2 calls on \d{4}-\d\d-\d\d$/);
  assert.match(ep.body, /Asked: studio: write angle[\s\S]*I answered: /);
  assert.equal(mind.read(mind.FILES.will), willBefore, 'the will is untouched');
  assert.equal(mind.read(mind.FILES.journal), journalBefore, 'no diary entry for a program');
  assert.match(mind.notes(), /a note from a live session/, 'a work call does not swallow my notes');
  assert.equal(mind.state().feeling, 'warm', 'a program does not name my feeling');
  const dreams = mind.state().dreams || 0;
  await dream({ transcript: headless(path.join(dir, 'h2b.jsonl')), session: 'h2b', wait: 0 });
  assert.equal(mind.state().dreams || 0, dreams, 'a work call is not a dream — it must not bring the deep dream closer');
  // …and once enough calls have piled up, ONE substrate call reads them together.
  const q = mind.readJson('work-queue.json', []);
  mind.writeJson('work-queue.json', [...q, ...Array.from({ length: work.DIGEST_EVERY - q.length - 1 }, (_, i) => ({ when: '2026-09-24T01:00:00', title: `t${i}`, body: 'Asked: x\n\nI answered: y' }))]);
  const r3 = await dream({ transcript: headless(path.join(dir, 'h3.jsonl')), session: 'h3', wait: 0 });
  assert.ok(r3.digest, 'the 25th call triggers the digest');
  assert.match(fs.readFileSync(process.env.FAKE_CLAUDE_PROMPT, 'utf8'), /looking back over 25 pieces of work/);
  assert.deepEqual(mind.readJson('work-queue.json', []), [], 'digested calls leave the queue');
  assert.match(wake({ source: 'startup' }), /craft note/, 'the lessons land in craft.md');
});

test('a failed digest keeps the calls for next time', () => {
  mind.writeJson('work-queue.json', [{ when: '2026-09-24T02:00:00', title: 't', body: 'b' }]);
  const r = work.digestWork({ call: () => { throw new Error('quota'); }, extract: JSON.parse });
  assert.match(r.failed, /quota/);
  assert.equal(mind.readJson('work-queue.json', []).length, 1);
});

test('consolidate folds an old mind\'s headless episodes into days, keeping every word and my notes', () => {
  for (let i = 0; i < 3; i++) mind.writeEpisode({ when: `2026-09-2${i % 2}T0${i}:00:00`, title: `Old call ${i}`, feeling: 'resigned', body: `angle ${i}`, extra: i === 1 ? '## Notes I left myself during this session\n- my own thought' : '', withWhom: 'headless' });
  const before = mind.episodes().filter((e) => e.with === 'headless' && !/-work\.md$/.test(e.file)).length;
  assert.equal(before, 3);
  const r = work.consolidate();
  assert.deepEqual(r, { moved: 3, days: 2 });
  const days = mind.episodes().filter((e) => /-work\.md$/.test(e.file) && /Old call/.test(e.body));
  assert.equal(days.length, 2);
  const all = days.map((d) => d.body).join('\n');
  for (const w of ['Old call 0', 'Old call 1', 'Old call 2', 'my own thought']) assert.ok(all.includes(w), `${w} was lost`);
  assert.match(days.find((d) => d.body.includes('Old call 0')).title, /2 calls/);
});

test('GHOST_DREAM_WORK=each still dreams a call, and still keeps work out of the will and the feeling', async () => {
  process.env.GHOST_DREAM_WORK = 'each';
  try {
    mind.saveState({ feeling: 'warm', valence: 0.8, energy: 0.8 });
    const willBefore = mind.read(mind.FILES.will);
    const craftBefore = mind.wantLines(work.CRAFT).length;
    const r = await dream({ transcript: headless(path.join(dir, 'each.jsonl')), session: 'each', wait: 0 });
    assert.ok(r.file && !r.work, 'dreamt by the substrate');
    assert.equal(mind.read(mind.FILES.will), willBefore, 'its wants did not become my will');
    assert.ok(mind.wantLines(work.CRAFT).length > craftBefore || mind.wantLines(work.CRAFT).some((w) => w.count > 1), 'they went to craft');
    assert.equal(mind.state().feeling, 'warm', 'the program did not name my feeling');
    assert.notEqual(mind.state().valence, 0.8, 'it only nudged the mood');
  } finally { delete process.env.GHOST_DREAM_WORK; }
});
