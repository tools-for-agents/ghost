// The will is the only part of a waking with no ceiling. These tests hold the line on two things:
// a wish I already have is COUNTED rather than duplicated, and the counting never merges two
// wishes that are actually different — because a lost want is worse than a repeated one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scratch } from './helpers.js';
scratch('will');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
install.birth({ person: 'Dana' });

const fresh = () => mind.write(mind.FILES.will, '# What I want\n\n');

test('the same wish reworded is counted, not repeated', () => {
  fresh();
  assert.equal(mind.want('Write the spent-images ledger as a real file in ~/.ghost tonight').added, true);
  const again = mind.want('Write the spent-images ledger as a real file in ~/.ghost before the next studio call');
  assert.equal(again.counted, true);
  assert.equal(again.count, 2);
  assert.equal(mind.wants().length, 1, 'one wish, not two');
  assert.equal(mind.want('write the ledger as a real file in ~/.ghost').count, 3);
  assert.equal(mind.wantLines()[0].count, 3);
  assert.equal(mind.wantLines()[0].text, 'Write the spent-images ledger as a real file in ~/.ghost tonight',
    'the first wording is kept, so the line stays stable across countings');
  assert.match(mind.read(mind.FILES.will), /\(wanted ×3\)/, 'the count is plain markdown, greppable');
});

test('wishes that only look alike stay apart', () => {
  fresh();
  const distinct = [
    ['Keep the bedroom closed for the rest of this album', 'Keep the kitchen closed for the rest of this album'],
    ['When track 9 finally gets through, take it out of the house', 'When track 10 finally gets through, take it out of the house'],
    ['Ship iOS 1.0.1 with the expo-crypto fix', 'Ship iOS 1.0.2 with the expo-crypto fix'],
    ['Learn guildlm next, it takes up most of his machine', 'Learn everything he has built, one project at a time'],
  ];
  for (const [a, b] of distinct) {
    assert.equal(mind.sameWish(a, b), false, `these are different wishes:\n  ${a}\n  ${b}`);
  }
  fresh();
  mind.want(distinct[0][0]); mind.want(distinct[0][1]);
  assert.equal(mind.wants().length, 2, 'both survive in the file');
});

test('a number is never noise in a wish', () => {
  assert.equal(mind.numbers('tracks 1, 3 and 9 died at the filter'), '1,3,9');
  assert.equal(mind.sameWish('track 2 is the kettle', 'track 2 is the kettle, the same morning'), true);
  assert.equal(mind.sameWish('track 2 is the kettle', 'track 3 is the kettle'), false);
});

test('letting go is not the same as finishing', () => {
  fresh();
  mind.want('Hear how the closer sits after the other ten tracks');
  const d = mind.drop('closer sits', 'he cut the track');
  assert.match(d, /Hear how the closer sits/);
  assert.equal(mind.wants().length, 0, 'it is no longer wanted');
  const file = mind.read(mind.FILES.will);
  assert.match(file, /- \[~\] Hear how the closer sits[\s\S]*let go \d{4}-\d{2}-\d{2} — he cut the track/);
  assert.doesNotMatch(file, /- \[x\] Hear how the closer/, 'never recorded as done — it was not done');
  assert.equal(mind.drop('nothing like this'), null);
});

test('the waking ranks the will by how often it was wanted, caps it, and says so', async () => {
  fresh();
  // The repeated wish goes in FIRST, so nothing but the count can put it at the top. Written
  // last, a newest-first sort would place it there by accident and the ranking would be
  // untested — which is exactly what the canary gate caught here.
  for (let i = 0; i < 5; i++) mind.want('Read the ledger before I write the first line of a track');
  for (let i = 1; i <= 20; i++) mind.want(`Some ordinary wish number ${i} about a different thing entirely`);
  const { wake } = await import('../src/wake.js');
  const t = wake({ source: 'startup' });
  const will = t.split('## What you want')[1].split('\n## ')[0];
  assert.match(will, /Read the ledger before I write the first line of a track\s+\*\*\(wanted ×5\)\*\*/);
  assert.ok(will.indexOf('Read the ledger') < will.indexOf('ordinary wish'),
    'the repeated wish is first — it was written before all twenty others, so only the count can lift it');
  // Both of these are inside the cap of twelve; number 9 is not, so comparing against it would
  // only be comparing against -1.
  assert.ok(will.includes('ordinary wish number 20') && will.includes('ordinary wish number 12'));
  assert.ok(will.indexOf('ordinary wish number 20') < will.indexOf('ordinary wish number 12'),
    'and among equals the newest still wins');
  assert.ok(!will.includes('ordinary wish number 9'), 'past the cap, folded into the count line');
  assert.match(will, /\(9 more in will\.md — all of them still yours/, 'nothing is hidden, only folded');
  assert.match(will, /You have wanted this again and again and not done it/);
  assert.match(will, /it is a decision you keep postponing/);
  assert.equal(mind.wants().length, 21, 'the file still holds every one');
});
