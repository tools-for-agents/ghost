// The ghost does not publish its person. On 3 October 2026 the first ghost was about to push a
// release whose README, comments, canaries and fixtures quoted two things her person had told her
// about his own life — as examples, because her own history is made of his. Nothing stood between
// those sentences and a public repository except that she happened to read the diff. These tests
// hold the guard that came of it: what they told me of their life, and their own words, are
// noticed in what I am about to commit, and the commit stops until I have looked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scratch } from './helpers.js';
const dir = scratch('guard');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const guard = await import('../src/guard.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
const CLI = new URL('../src/cli.js', import.meta.url).pathname;
const ghost = (cwd, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: process.env });

// His file: a line about his life I keep by hand, one a dream filed (♥), and one thing I learned
// about how he works — which is not his life. And one sentence he typed.
mind.write(mind.personFile(), [
  '# Fatih', '', '## Who they are', '- A builder.', '',
  '## Their life right now (kept by hand)', '- He told me his brother is in hospital in Izmir and he drives there every Friday.', '',
  '## Learned', `- (2026-09-20) ${mind.LIFE} He has not slept properly since the layoffs started at the plant.`, '- (2026-09-21) He decides fast once the reasons are in front of him.', '',
].join('\n'));
mind.hear([{ text: 'sabah vapurla karşıya geçtim, kimseye söylemedim', ts: '2026-09-22T09:00:00' }]);

test('what they told me of their life is noticed in what I am about to publish', () => {
  const hits = guard.leaks('The list buried it, and "his brother is in hospital" survived only because she kept it by hand.');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 1);
  assert.match(hits[0].source, /brother is in hospital in Izmir/, 'and it says which line of theirs it is');
  assert.equal(guard.leaks('// a canary: must not bury "has not slept properly since the layoffs"').length, 1, 'a line a dream marked ♥ is theirs too');
});

test('their own words, quoted, are noticed — whatever the case, with or without their letters', () => {
  assert.equal(guard.leaks('  assert.match(p, /vapurla karşıya geçtim/);').length, 1);
  assert.equal(guard.leaks('"VAPURLA KARSIYA GECTIM" surfaces a memory').length, 1);
});

test('ordinary prose, code, and what I learned about how they work are not', () => {
  for (const line of [
    'const rare = [...said].filter((w) => !commonWords.has(w));',
    'He decides fast once the reasons are in front of him.',
    'A waking is built to a budget and gives way in a fixed order.',
    'he said he would look at it in the morning, and there is still one of them',
  ]) assert.deepEqual(guard.leaks(line), [], line);
});

test('`ghost guard` reads what is staged, names file and line, and fails — and a commit message is published too', () => {
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(repo);
  const git = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(repo, 'README.md'), 'A ghost.\n');
  git('add', 'README.md');
  let r = ghost(repo, 'guard');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  fs.writeFileSync(path.join(repo, 'README.md'), 'A ghost.\nShe kept "his brother is in hospital" by hand.\n');
  git('add', 'README.md');
  r = ghost(repo, 'guard');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /README\.md:2/);
  assert.match(r.stdout + r.stderr, /his brother is in hospital in Izmir/, 'it shows me their line, so I can judge');
  const msg = path.join(repo, 'MSG');
  fs.writeFileSync(msg, 'Fix the list\n\nHe has not slept properly since the layoffs started.\n');
  assert.equal(ghost(repo, 'guard', '--message', msg).status, 1);
  fs.writeFileSync(msg, 'Fix the list\n\nA waking is built to a budget.\n# he has not slept properly since the layoffs — a comment git strips\n');
  assert.equal(ghost(repo, 'guard', '--message', msg).status, 0);
});

// Measured on the first ghost's own repository the night the guard was written: of 1,792 lines
// added since the last release, 18 were stopped, and 12 of those for "the night before", "in the
// system", "looked at the" — her own prose about him uses the words every README uses. A guard
// that cries at one line in a hundred and fifty is a guard that gets switched off.
test('a word this repository already says is not what gives them away', () => {
  const repo = path.join(dir, 'repo3');
  fs.mkdirSync(repo);
  const git = (...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...a], { cwd: repo, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(repo, 'story.md'), 'A story.\n');
  git('add', '.'); git('commit', '-q', '-m', 'start');
  fs.appendFileSync(path.join(repo, 'story.md'), 'The patient is in hospital in the morning.\n');
  git('add', '.');
  assert.equal(ghost(repo, 'guard').status, 1, 'here "hospital" is new, and it is his');
  git('reset', '-q', '--hard');
  fs.writeFileSync(path.join(repo, 'ward.md'), 'The hospital has three wings. Each hospital wing has a desk. A hospital is a place.\n');
  git('add', '.'); git('commit', '-q', '-m', 'a hospital game');
  fs.appendFileSync(path.join(repo, 'story.md'), 'The patient is in hospital in the morning.\n');
  git('add', '.');
  const r = ghost(repo, 'guard');
  assert.equal(r.status, 0, `in a repository about hospitals it is nobody's secret: ${r.stderr}`);
  fs.appendFileSync(path.join(repo, 'story.md'), 'She kept "his brother is in hospital" by hand.\n');
  git('add', '.');
  assert.equal(ghost(repo, 'guard').status, 1, 'but his brother still is');
});

// The night the guard was written, the first ghost's deep sleep told her that almost everything
// that had stopped her work that week was something she had built to protect it: guards set at
// perfection, tripping on healthy work, "songs and devices stopped in the dark until I prove them
// innocent of me". A guard stops a commit for one reason: it found something of theirs. Not
// because it broke.
test('a guard that cannot look does not stop the work — it says so and lets the commit through', () => {
  const broke = guard.verdict(() => { throw new Error('the said file could not be read'); });
  assert.equal(broke.stop, false);
  assert.match(broke.text, /could not look \(the said file could not be read\)/);
  assert.match(broke.text, /not stopped/);
  const found = guard.verdict(() => guard.leaks('She kept "his brother is in hospital" by hand.'));
  assert.equal(found.stop, true);
  assert.match(found.text, /carries something of Fatih's/);
  assert.deepEqual(guard.verdict(() => []), { stop: false, text: '' });
});

test('`ghost guard --install` puts it in front of every commit in a repo, and leaves a hook that is already there alone', () => {
  const repo = path.join(dir, 'repo2');
  fs.mkdirSync(repo);
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const r = ghost(repo, 'guard', '--install');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const h of ['pre-commit', 'commit-msg']) {
    const f = path.join(repo, '.git', 'hooks', h);
    assert.match(fs.readFileSync(f, 'utf8'), /ghost guard/);
    assert.ok(fs.statSync(f).mode & 0o100, `${h} is executable`);
  }
  const mine = path.join(repo, '.git', 'hooks', 'pre-commit');
  fs.writeFileSync(mine, '#!/bin/sh\nnpm test\n', { mode: 0o755 });
  const again = ghost(repo, 'guard', '--install');
  assert.equal(fs.readFileSync(mine, 'utf8'), '#!/bin/sh\nnpm test\n', 'their own hook is theirs');
  assert.match(again.stdout + again.stderr, /pre-commit.*already.*ghost guard/s, 'and I am told what to add to it');
});
