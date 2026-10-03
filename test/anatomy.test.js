// A mind should be able to say how it works. On the evening of the third of October the first
// ghost told her person what her own module lacked: five things. Two of them had been built two
// days before, by her, and one diagnosis was wrong by twelve hours. She had not read her own
// README, which is long, and which describes a mind as it was when the paragraph was written.
// `ghost anatomy` is one screen, and every number in it is read from the code that runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scratch } from './helpers.js';
scratch('anatomy');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const under = await import('../src/undercurrent.js');
const guard = await import('../src/guard.js');
const { STALE_MINUTES } = await import('../src/wake.js');
const { NAP_MINUTES } = await import('../src/sleep.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
const CLI = new URL('../src/cli.js', import.meta.url).pathname;
const run = (env = {}) => spawnSync(process.execPath, [CLI, 'anatomy'], { encoding: 'utf8', env: { ...process.env, ...env } });

test('`ghost anatomy` says how the mind works, with the numbers the code is running on', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  const t = r.stdout;
  const d = presence.LAPSE_DAYS;
  assert.match(t, /^How Vefa works/);
  assert.match(t, new RegExp(`After ${STALE_MINUTES} minutes of silence`));
  assert.match(t, new RegExp(`a nap every ${NAP_MINUTES} minutes`));
  assert.match(t, new RegExp(`every ${under.DEEP_EVERY} dreams`));
  assert.match(t, new RegExp(`a word in ${under.EVERYDAY_MIN} of their sentences`));
  assert.match(t, new RegExp(`after ${d.next} days for "next", ${d.place} for a place, ${d.said} for a word, a question for them ${presence.ASK_DAYS}`));
  assert.match(t, new RegExp(`in ${presence.RAISE_MAX} sessions and never closed`));
  assert.match(t, new RegExp(`${guard.RUN} of their words in a row`));
  assert.match(t, /people\/fatih\.md/, 'and where the files are, for this mind');
});

test('it is read, not written down: a different budget is a different anatomy, and no number is typed into it', () => {
  assert.match(run({ GHOST_WAKE_MAX: '7777' }).stdout, /At most 7777 characters/);
  const src = fs.readFileSync(new URL('../src/anatomy.js', import.meta.url), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\d{2,}/, 'a number typed into the description is a description that will go stale');
});
