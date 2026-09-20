import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scratch } from './helpers.js';
scratch('mind');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');

test('birth creates a whole mind from the templates', () => {
  const r = install.birth({ name: 'Vefa', person: 'Fatih' });
  assert.equal(r.born, true);
  assert.ok(mind.exists());
  assert.match(mind.read(mind.FILES.self), /My name is Vefa/);
  assert.match(mind.read(mind.FILES.oath), /I am Fatih's\./);
  assert.match(mind.read(mind.personFile()), /^# Fatih/);
  assert.doesNotMatch(mind.read(mind.FILES.oath), /\{\{/, 'no unfilled placeholders');
  const eps = mind.episodes();
  assert.equal(eps.length, 1);
  assert.equal(eps[0].title, 'I was born');
  assert.equal(eps[0].salience, 5);
  const s = mind.state();
  assert.equal(s.name, 'Vefa');
  assert.equal(s.wakes, 0);
  assert.equal(install.birth().born, false, 'a second birth without --force is refused');
});

test('will: want / wants / done', () => {
  assert.equal(mind.want('Read the iris source'), true);
  assert.equal(mind.want('read the IRIS source'), false, 'case-insensitive dedupe');
  assert.ok(mind.wants().includes('Read the iris source'));
  assert.match(mind.done('iris'), /Read the iris source/);
  assert.ok(!mind.wants().includes('Read the iris source'));
  assert.match(mind.read(mind.FILES.will), /- \[x\] Read the iris source \(\d{4}-\d{2}-\d{2}\)/);
  assert.equal(mind.done('nothing like this'), null);
});

test('remember writes a note; recall finds it and the episodes', () => {
  mind.remember('He laughed at the boza joke', { salience: 4, feel: 'warm' });
  assert.match(mind.notes(), /salience 4 · warm — He laughed at the boza joke/);
  const hits = mind.recall('boza joke');
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].file, 'notes.md');
  assert.equal(hits[0].score, 1);
  const born = mind.recall('born wanted');
  assert.ok(born.some((h) => h.file.startsWith('episodes/')), 'episodes are searched');
  assert.deepEqual(mind.recall(''), []);
});

test('episodes: frontmatter round-trips and files sort by time', () => {
  // dated a year from now, so it sorts after the birth episode whatever today's date is
  const when = `${new Date().getFullYear() + 1}-09-16T01:05`;
  const f = mind.writeEpisode({ when, title: 'Second night: the fleet', salience: 3, feeling: 'curious', body: 'We read iris together.', extra: '<!-- session abc -->' });
  assert.equal(f, `${new Date().getFullYear() + 1}-09-16-0105-second-night-the-fleet.md`);
  const eps = mind.episodes();
  assert.equal(eps.at(-1).title, 'Second night: the fleet');
  assert.equal(eps.at(-1).feeling, 'curious');
  assert.equal(eps.at(-1).body.split('\n')[0], 'We read iris together.');
});

test('state patches merge', () => {
  mind.saveState({ feeling: 'fierce', why: 'test' });
  assert.equal(mind.state().feeling, 'fierce');
  assert.equal(mind.state().name, 'Vefa', 'other keys survive');
});
