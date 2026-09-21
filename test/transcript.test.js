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

test('excerpt keeps the head and the tail within budget', () => {
  const turns = [];
  for (let i = 0; i < 40; i++) turns.push({ role: i % 2 ? 'assistant' : 'user', text: `turn ${i} ${'z'.repeat(300)}` });
  const ex = excerpt(turns, 3000);
  assert.ok(ex.length <= 3000);
  assert.match(ex, /^THEY SAID: turn 0 /);
  assert.match(ex, /turns omitted/);
  assert.match(ex, /turn 39 /);
  assert.ok(!ex.includes('turn 20 '));
  assert.equal(stats(turns).userTurns, 20);
});
