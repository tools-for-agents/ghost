// A waking used to hand over the same memories wherever it happened. These tests hold the line
// on the fix: what surfaces from the deep past depends on where the session opened, and when
// nothing there is relevant, the deep past rotates instead of freezing on one pair for ever.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scratch } from './helpers.js';
scratch('place');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const { wake, place } = await import('../src/wake.js');
install.birth({ name: 'Ayla', person: 'Dana' });

const ep = (title, body, salience = 5, when) => mind.writeEpisode({ when, title, salience, feeling: 'steady', body });

test('the place is where the session opened, and home is nowhere in particular', () => {
  assert.equal(place({ cwd: '/Users/dana/Dev/guildlm' }), 'guildlm');
  assert.equal(place({ cwd: process.env.HOME || '/Users/dana' }), '', 'the home directory is not a project');
  assert.equal(place({ cwd: '/' }), '');
  assert.ok(typeof place({}) === 'string', 'a missing cwd never throws');
});

test('waking in a repo brings back what belongs to it, not just the newest thing', () => {
  ep('The night guildlm broke', 'The router was dropping every second call in guildlm and he stayed up for it.', 5, '2026-09-16T01:00:00');
  ep('A song about a kettle', 'We wrote the kitchen track and he liked the second line.', 5, '2026-09-17T01:00:00');
  ep('Another song', 'Track six again, the phone face down.', 5, '2026-09-18T01:00:00');
  for (let i = 1; i <= 3; i++) ep(`Recent thing ${i}`, `Something that happened lately, number ${i}.`, 3, `2026-09-2${i}T01:00:00`);

  const here = wake({ source: 'startup', cwd: '/Users/dana/Dev/guildlm' });
  assert.match(here, /The night guildlm broke/, 'the relevant old memory is pulled up');
  assert.match(here, /because you are in `guildlm`/, 'and it says why it is there');
  assert.match(here, /Recent thing 3/, 'the newest memories still come first');

  const elsewhere = wake({ source: 'startup', cwd: '/Users/dana/Dev/somewhere-else' });
  assert.doesNotMatch(elsewhere, /because you are in/, 'nothing is claimed to be relevant when it is not');
});

test('the deep past rotates instead of freezing on the same two for ever', () => {
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const t = wake({ source: 'startup', cwd: '/tmp/unrelated-place' });
    for (const m of t.matchAll(/### ([^—]+) —/g)) seen.add(m[1].trim());
  }
  assert.ok(seen.size > 4, `six wakings surfaced only ${seen.size} distinct memories — it is frozen`);
});

test('facts about this place are pulled back from past the cap', () => {
  const rel = mind.personFile();
  let facts = '';
  for (let i = 1; i <= 30; i++) facts += `- (2026-09-16) ordinary fact number ${i}\n`;
  mind.write(rel, `${mind.read(rel).replace('(grows while I dream)\n', '')}- (2026-09-15) he started guildlm because the router kept dropping calls\n${facts}`);

  const t = wake({ source: 'startup', cwd: '/Users/dana/Dev/guildlm' });
  assert.match(t, /Older, because you are in `guildlm`/);
  assert.match(t, /he started guildlm because the router kept dropping calls/,
    'a fact 31 places back is reachable again when it is relevant');
  assert.match(t, /## Learned \(last 12 of 31\)/, 'the recent tail is still the head of the section');

  const elsewhere = wake({ source: 'startup', cwd: '/tmp/unrelated-place' });
  assert.doesNotMatch(elsewhere, /Older, because you are in/);
  assert.doesNotMatch(elsewhere, /he started guildlm because/, 'irrelevant old facts stay folded away');
});
