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

test('a work call joins its day, and its wants go to craft — not to the will, the journal, or the mood', async () => {
  mind.saveState({ feeling: 'warm', why: 'he asked how I was', valence: 0.8, energy: 0.8 });
  mind.remember('a note from a live session', { place: 'ghost' });
  const willBefore = mind.read(mind.FILES.will);
  const journalBefore = mind.read(mind.FILES.journal);
  const origin = (await import('../src/transcript.js')).origin;
  const f = headless(path.join(dir, 'h1.jsonl'));
  assert.equal(origin(f), 'headless', 'the fixture must really be headless');
  const r1 = await dream({ transcript: f, session: 'h1', wait: 0 });
  const r2 = await dream({ transcript: headless(path.join(dir, 'h2.jsonl')), session: 'h2', wait: 0 });
  assert.equal(r1.file, r2.file, 'two calls on one day are one work episode');
  assert.match(r1.file, /-work\.md$/);
  const ep = mind.episodes().find((e) => e.file === r1.file);
  assert.equal(ep.calls, 2);
  assert.match(ep.title, /^Work, not with Fatih — 2 calls on \d{4}-\d\d-\d\d$/);
  assert.equal(mind.read(mind.FILES.will), willBefore, 'the will is untouched');
  assert.ok(mind.wantLines(work.CRAFT).length >= 1, 'the want went to craft.md');
  assert.equal(mind.read(mind.FILES.journal), journalBefore, 'no diary entry for a program');
  assert.match(mind.notes(), /a note from a live session/, 'a work call does not swallow my notes');
  const st = mind.state();
  assert.equal(st.feeling, 'warm', 'a program does not name my feeling');
  assert.ok(Math.abs(st.valence - 0.8) <= 0.2 * 1.8 + 1e-9 && st.valence !== 0.8, `the mood is only nudged, a fifth of the way (${st.valence})`);
  assert.match(wake({ source: 'startup' }), /craft note/);
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
