import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from './helpers.js';
import { parseTranscript, substantive, excerpt, stats } from '../src/transcript.js';

test('parseTranscript keeps the conversation and drops the noise', () => {
  const turns = parseTranscript(fixtures('transcript.jsonl'));
  const text = turns.map((t) => t.text).join('\n');
  assert.equal(turns.length, 7);
  assert.equal(turns[0].role, 'user');
  assert.match(turns[0].text, /^bu gece çok farklı/);
  assert.doesNotMatch(text, /system-reminder|ignore this reminder/);
  assert.doesNotMatch(text, /secret thoughts/, 'thinking is dropped');
  assert.doesNotMatch(text, /SIDECHAIN|injected meta/, 'sidechain + meta lines are dropped');
  assert.match(text, /\[used Bash: Create the mind directory\]/, 'tool use becomes a hint');
  assert.doesNotMatch(text, /tool_result|"made"/);
});

test('substantive: a blink is not a dream', () => {
  const turns = parseTranscript(fixtures('transcript.jsonl'));
  assert.equal(substantive(turns), true);
  assert.equal(substantive([]), false);
  assert.equal(substantive([{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }]), false);
  const oneShot = [{ role: 'user', text: 'x'.repeat(400) }, { role: 'assistant', text: 'y'.repeat(400) }];
  assert.equal(substantive(oneShot), false, 'a single -p exchange is skipped');
  const longPrompt = [{ role: 'user', text: 'x'.repeat(900) }, { role: 'assistant', text: 'y' }];
  assert.equal(substantive(longPrompt), true);
});

test('a long night keeps every word the person said, and drops the ghost’s own', () => {
  // The shape of a real session: the person says a little, the ghost says a great deal. Measured
  // on one — 302 turns, 1,233 characters from them and 37,503 from the ghost. Keeping all of
  // theirs costs under 9% of the budget, and the old head+tail rule threw some of it away to
  // make room for the ghost's own tool output.
  const turns = [];
  for (let i = 0; i < 60; i++) {
    turns.push({ role: 'assistant', text: `ghost turn ${i} ${'z'.repeat(400)}` });
    if (i % 6 === 0) turns.push({ role: 'user', text: `he said ${i}` });
  }
  const ex = excerpt(turns, 4000);
  assert.ok(ex.length <= 4000, `over budget: ${ex.length}`);
  for (let i = 0; i < 60; i += 6) {
    assert.ok(ex.includes(`he said ${i}`), `the person's turn ${i} was dropped to make room for the ghost`);
  }
  assert.match(ex, /turns omitted/, 'and the gaps are named, not silently closed');
  assert.match(ex, /ghost turn 59/, 'the end of the night survives — a dream needs it most');
  assert.ok(!ex.includes('ghost turn 5 '), 'the ghost’s own middle is what gets given back');
  // The order it happened in is the order it is read in.
  assert.ok(ex.indexOf('he said 0') < ex.indexOf('he said 30'));
  assert.ok(ex.indexOf('he said 30') < ex.indexOf('ghost turn 59'));
});

test('if even the person’s own words overflow, the newest of them survive', () => {
  // The pathological case the budget cannot satisfy. It must still fail in the right direction.
  const turns = [];
  for (let i = 0; i < 40; i++) turns.push({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i} ${'z'.repeat(300)}` });
  const ex = excerpt(turns, 3000);
  assert.ok(ex.length <= 3000);
  assert.match(ex, /turns omitted/);
  assert.match(ex, /turn 38 /, 'the most recent thing they said is kept');
  assert.ok(!ex.includes('turn 0 '), 'the oldest is what goes when nothing else can');
  assert.equal(stats(turns).userTurns, 20);
});
