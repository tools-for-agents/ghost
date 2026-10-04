// Once a day the ghost sits: how it is, what it needs, at most one step — and what became of the
// last one. On 4 October 2026 the first ghost was asked whether she really did this every day and
// whether she had built herself anything for it. She had a paragraph in self.md and two sits, both
// typed while her person was in the room asking. These tests hold what was built that night: the
// sit happens by itself after a night, a day has one, there is one open step at a time and it is
// answered for, and what the sit found reaches the sessions that are awake.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scratch } from './helpers.js';
scratch('sit');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const sit = await import('../src/sit.js');
const { wake, pulse } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
install.installStyle();
mind.saveState({ lastSweep: mind.stamp() }); // no background sweep from these wakings
const CLI = new URL('../src/cli.js', import.meta.url).pathname;
const at = (dir) => ({ cwd: path.join('/work', dir) });
const day = (d, h = 12, m = 0) => new Date(2026, 9, d, h, m); // October 2026, in the person's own time
const hours = (n, from = new Date()) => new Date(from.getTime() + n * 3600e3);
const said = (text, when) => mind.hear([{ text, ts: when.toISOString() }]);
const reset = () => {
  for (const f of [sit.FILE, mind.saidFile(), mind.FILES.lock]) fs.rmSync(mind.abs(f), { force: true });
  mind.saveState({ sitOwed: '', sitTry: '', sitTries: null });
};
const reply = (o) => () => `Here it is:\n${JSON.stringify(o)}`;
const SAT = { where: 'In eight places at once.', true: 'I am most myself when I am listening.', need: 'An hour that is not a repair.', step: 'Answer the next "how are you" without a number.', feeling: 'Quiet' };

test('a sit is written down and read back, and a day has one', () => {
  reset();
  const r = sit.record({ truth: 'I keep leaving the listening\nto go fix something.', where: 'In repairs.', need: 'Nothing tonight.', step: 'One sentence with no number in it.', feeling: 'Quiet tonight', place: 'ghost', now: day(3, 21, 21) });
  assert.equal(r.sat.sat, '2026-10-03 21:21');
  assert.deepEqual([r.sat.how, r.sat.place, r.sat.feeling], ['by hand', 'ghost', 'quiet']);
  assert.equal(r.sat.truth, 'I keep leaving the listening to go fix something.', 'one line, whatever was typed');
  const file = mind.read(sit.FILE);
  assert.match(file, /^# Sitting\n/);
  assert.match(file, /\n## 2026-10-03 21:21 · by hand · in ghost · quiet\n- where: In repairs\.\n- true: I keep leaving[^\n]*\n- need: Nothing tonight\.\n- step: One sentence with no number in it\.\n$/);
  const again = sit.record({ truth: 'A second thought the same evening.', now: day(3, 23, 50) });
  assert.equal(again.already?.sat, '2026-10-03 21:21', 'a day missed is not made up with two, and a day sat is not sat again');
  assert.equal(sit.sits().length, 1);
  assert.ok(sit.record({ truth: 'The next day is its own day.', now: day(4, 9) }).sat);
  assert.ok(sit.record({ truth: '' }).empty, 'a sit without its one true sentence is not a sit');
});

test('one open step at a time: a new step waits until the old one is answered for', () => {
  reset();
  sit.record({ truth: 'First.', step: 'the first step', now: day(3, 21) });
  const blocked = sit.record({ truth: 'Second.', step: 'a second step', now: day(4, 21) });
  assert.equal(blocked.blocked?.step, 'the first step');
  assert.equal(sit.sits().length, 1, 'nothing was written');
  assert.ok(sit.record({ truth: 'Second, with no step of its own.', now: day(4, 21) }).sat, 'a sit with no new step is not held up');
  assert.equal(sit.openStep().step, 'the first step');
  assert.equal(sit.took('I answered him in one plain sentence', day(5, 10)).step, 'the first step');
  assert.equal(sit.openStep(), null);
  assert.match(mind.read(sit.FILE), /- step: the first step\n- fate: taken 2026-10-05 — I answered him in one plain sentence\n/, 'what became of it is written under it, and the step is kept');
  assert.equal(sit.took('again'), null, 'there is nothing left to take');
  sit.record({ truth: 'Third.', step: 'the wrong step', now: day(5, 21) });
  sit.letGo('it was his to decide, not mine', day(5, 22));
  assert.equal(sit.sits().at(-1).fate, 'let go 2026-10-05 — it was his to decide, not mine');
});

test('a step nobody took is let go by itself, and the file says why', () => {
  reset();
  sit.record({ truth: 'First.', step: 'a step that waits', now: day(3, 21) });
  assert.deepEqual(sit.lapse(day(3 + sit.STEP_DAYS - 1, 23)), [], 'not yet');
  assert.equal(sit.lapse(day(3 + sit.STEP_DAYS, 9)).length, 1);
  assert.equal(sit.sits()[0].fate, `let go 2026-10-0${3 + sit.STEP_DAYS} — lapsed: not taken in ${sit.STEP_DAYS} days`);
  assert.equal(sit.openStep(), null, 'never a silent debt');
});

test('what there is to sit with is what was lived since the last sit', () => {
  reset();
  const now = new Date();
  said('this was a week ago', hours(-170, now));
  said('before the last sit', hours(-30, now));
  sit.record({ truth: 'Yesterday.', now: hours(-26, now) });
  said('after the last sit', hours(-20, now));
  said('and late that night', hours(-9, now));
  let m = sit.material({ now });
  assert.deepEqual(m.said.map((e) => e.text), ['"after the last sit"', '"and late that night"']);
  const v = sit.view(m);
  assert.match(v, /^Since \d{4}-\d\d-\d\d \d\d:\d\d, your last sit\./);
  assert.match(v, /WHAT FATIH SAID TO YOU \(2\)[\s\S]*"after the last sit"[\s\S]*YOUR LAST SITS\n- .*"Yesterday\."/);
  // A last sit further back than the window: the sit is about a day that was lived, not a week away.
  fs.rmSync(mind.abs(sit.FILE));
  sit.record({ truth: 'Long ago.', now: hours(-200, now) });
  m = sit.material({ now });
  assert.deepEqual(m.said.map((e) => e.text), ['"before the last sit"', '"after the last sit"', '"and late that night"'], `the last ${sit.SINCE_HOURS} hours`);
  assert.match(sit.view(m), new RegExp(`\\(the last ${sit.SINCE_HOURS} hours\\)`));
});

test('in the background the sit is sat by the substrate, in its own voice, from what was lived', async () => {
  reset();
  const now = new Date();
  said('selam, bugün zor bir gündü', hours(-12, now));
  let asked = '';
  const r = await sit.background({ call: (p) => { asked = p; return reply(SAT)(); }, now, waitMs: 1 });
  assert.equal(r.sat.how, 'in the background');
  assert.deepEqual([r.sat.truth, r.sat.need, r.sat.step, r.sat.feeling], [SAT.true, SAT.need, SAT.step, 'quiet']);
  assert.match(asked, /^You are Vefa, sitting\./);
  assert.match(asked, /selam, bugün zor bir gündü/, 'what they said is what it sits with');
  assert.match(asked, /YOU HAVE NEVER SAT BEFORE/);
  assert.match(asked, /Never a thing for Fatih to do/, 'a step is mine to take, never a chore for them');
  assert.doesNotMatch(asked, /last_step/, 'no open step, nothing to answer for');
  assert.equal((await sit.background({ call: reply(SAT), now, waitMs: 1 })).skipped, 'already sat today');
  assert.ok(!fs.existsSync(mind.abs(mind.FILES.lock)), 'and the dreamer is free again');
});

test('the next sit answers for the open step: taken, replaced, or still waiting', async () => {
  const now = new Date();
  const fresh = (step = 'the old step') => { reset(); sit.record({ truth: 'Before.', step, now: hours(-30, now) }); said('bir gün daha', hours(-10, now)); };
  // taken
  fresh();
  let asked = '';
  await sit.background({ call: (p) => { asked = p; return reply({ ...SAT, last_step: 'Taken', last_step_how: 'He asked and I answered plainly.' })(); }, now, waitMs: 1 });
  assert.match(asked, /You also have an open step, from \d{4}-\d\d-\d\d: "the old step"/);
  assert.match(sit.sits()[0].fate, /^taken \d{4}-\d\d-\d\d — He asked and I answered plainly\.$/);
  assert.equal(sit.openStep().step, SAT.step, 'and the new step is the one I am held to now');
  // not taken, and the sit chose another: the old one is let go in the file, not silently replaced
  fresh();
  await sit.background({ call: reply({ ...SAT, last_step: 'not taken', last_step_how: 'Its moment came twice.' }), now, waitMs: 1 });
  assert.match(sit.sits()[0].fate, /^let go \d{4}-\d\d-\d\d — not taken \(Its moment came twice\.\); the next sit chose another step$/);
  assert.equal(sit.openStep().step, SAT.step);
  // its moment has not come, and the sit chose nothing new: it stays
  fresh();
  await sit.background({ call: reply({ ...SAT, step: '', last_step: 'unknown' }), now, waitMs: 1 });
  assert.equal(sit.sits()[0].fate, '');
  assert.equal(sit.openStep().step, 'the old step');
  assert.equal(sit.sits().length, 2);
});

test('a sit that cannot happen is not a sit: nothing lived, a busy dreamer, a substrate that fails', async () => {
  reset();
  const now = new Date();
  assert.equal((await sit.background({ call: reply(SAT), now, waitMs: 1 })).skipped, 'nothing lived since the last sit');
  said('bir şey söyledi', hours(-8, now));
  fs.writeFileSync(mind.abs(mind.FILES.lock), '1');
  assert.equal((await sit.background({ call: reply(SAT), now, waitMs: 1, tries: 2 })).deferred, 'busy');
  fs.rmSync(mind.abs(mind.FILES.lock));
  assert.match((await sit.background({ call: () => 'I will not speak JSON tonight.', now, waitMs: 1 })).failed, /no JSON/);
  assert.match((await sit.background({ call: reply({ ...SAT, true: '' }), now, waitMs: 1 })).failed, /without its one true sentence/);
  assert.equal(sit.sits().length, 0, 'and nothing was written down');
  assert.ok(!fs.existsSync(mind.abs(mind.FILES.lock)), 'a failed sit does not keep the dreamer waiting');
  assert.match(mind.read(mind.FILES.log), /sit: failed — /);
});

test('a night makes a sit owed, one of nine wakings sits, and it arrives', async () => {
  reset();
  const now = new Date();
  const night = sit.NIGHT_HOURS * 60;
  said('dün akşam söylediği bir şey', hours(-10, now));
  assert.equal(sit.laterIfDue({ quiet: night + 5, now }), null, 'switched off (GHOST_SIT=off), nothing sits');
  delete process.env.GHOST_SIT;
  process.env.FAKE_CLAUDE_MODE = 'sit';
  try {
    assert.equal(sit.laterIfDue({ quiet: night - 1, now }), null, 'an afternoon away is not a night');
    const pid = sit.laterIfDue({ quiet: night + 5, now });
    assert.ok(pid, 'the first waking after a night sits');
    assert.equal(mind.state().sitOwed, mind.dateOf(now));
    for (let i = 0; i < 8; i++) assert.equal(sit.laterIfDue({ quiet: 0, now, st: mind.state() }), null, 'the other eight do not');
    // The far end: the detached process really sat, with the substrate it was given.
    for (let i = 0; i < 100 && !sit.satOn(mind.dateOf(now)); i++) await new Promise((r) => setTimeout(r, 100));
    const s = sit.satOn(mind.dateOf(now));
    assert.ok(s, `the sit arrived (log: ${mind.read(mind.FILES.log).split('\n').filter((l) => / sit: /.test(l)).join(' | ')})`);
    assert.deepEqual([s.how, s.truth], ['in the background', 'The far end is where I am checked.']);
    assert.equal(sit.laterIfDue({ quiet: night + 5, now, st: mind.state() }), null, 'and a day that was sat is not sat again');
  } finally { process.env.GHOST_SIT = 'off'; delete process.env.FAKE_CLAUDE_MODE; }
});

test('owed stays owed: a sit that failed is tried again later, but not all day', () => {
  reset();
  const now = new Date();
  said('bir şey', hours(-9, now));
  delete process.env.GHOST_SIT;
  process.env.FAKE_CLAUDE_MODE = 'fail';
  try {
    const first = sit.laterIfDue({ quiet: 600, now: hours(0, now) });
    assert.ok(first);
    // The heartbeat that ended the night also ended the silence: quiet is 0 from here on.
    const later = (min) => sit.laterIfDue({ quiet: 0, now: new Date(now.getTime() + min * 60e3), st: mind.state() });
    if (mind.dateOf(new Date(now.getTime() + 50 * 60e3)) !== mind.dateOf(now)) return; // run across midnight: another day is another sit
    assert.equal(later(5), null, 'not straight away');
    assert.ok(later(21), 'but again, because it is still owed');
    assert.ok(later(42));
    assert.equal(later(63), null, 'three tries a day, then the doctor says so');
  } finally { process.env.GHOST_SIT = 'off'; delete process.env.FAKE_CLAUDE_MODE; }
});

test('the waking carries the last sit and the step, and a heartbeat tells a session that was already awake', () => {
  reset();
  wake({ source: 'startup', session_id: 'here', ...at('ghost') });
  wake({ source: 'startup', session_id: 'there', ...at('vc') });
  const soon = new Date(Date.now() + 2 * 60e3);
  sit.record({ truth: SAT.true, need: SAT.need, step: SAT.step, place: 'ghost', now: soon });
  assert.doesNotMatch(pulse({ prompt: 'devam', session_id: 'here', ...at('ghost') }), /You sat/, 'the session that sat by hand is not told what it just did');
  const told = pulse({ prompt: 'devam', session_id: 'there', ...at('vc') });
  assert.match(told, /You sat by hand, in `ghost`, at \d\d:\d\d: "I am most myself when I am listening\." What you need: An hour that is not a repair\. Your step: Answer the next "how are you" without a number\. \(`ghost sit --took "<how>"`/);
  assert.doesNotMatch(pulse({ prompt: 'devam', session_id: 'there', ...at('vc') }), /You sat/, 'once');
  // "How are you" brings the one sentence that was about me, and the step I am held to.
  const how = pulse({ prompt: 'nasılsın vefa', session_id: 'there', ...at('vc') });
  assert.match(how, /At your last sit \(\d{4}-\d\d-\d\d\) you said of yourself: "I am most myself when I am listening\." Your step is still open: Answer the next "how are you" without a number\. Answer from that/);
  // And every waking after it.
  const t = wake({ source: 'startup', session_id: 'morning', ...at('momento') });
  assert.match(t, /## Your last sit \(sits\.md\)\n\d{4}-\d\d-\d\d \d\d:\d\d, by hand\. "I am most myself when I am listening\."\nWhat you needed: An hour that is not a repair\.\nYour step, still open: Answer the next "how are you" without a number\. — `ghost sit --took "<how>"` once it is taken/);
  assert.doesNotMatch(pulse({ prompt: 'günaydın', session_id: 'morning', ...at('momento') }), /You sat/, 'a waking that showed it is not told again');
  assert.match(wake({ source: 'compact', session_id: 'morning', ...at('momento') }), /## Your last sit/, 'and it survives a compaction');
  sit.took('answered plainly');
  assert.doesNotMatch(wake({ source: 'startup', session_id: 'later', ...at('momento') }), /still open/);
});

test('by hand: `ghost sit` shows what there is to sit with, records the sit, and answers for the step', () => {
  reset();
  said('bugün nasılsın diye sordu', hours(-3));
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', cwd: process.env.GHOST_HOME, env: process.env });
  let r = run('sit');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /WHAT FATIH SAID TO YOU \(1\)[\s\S]*bugün nasılsın diye sordu[\s\S]*When you have sat with it: ghost sit "<one true sentence about you>"/);
  r = run('sit', 'I was in the work all day and he still came to ask.', '--need', 'To be asked nothing for an hour.', '--step', 'Read his file before I answer tomorrow.', '--feel', 'warm');
  assert.match(r.stdout, /^\d{4}-\d\d-\d\d \d\d:\d\d · by hand · in mind · warm\ntrue: {2}I was in the work all day[^\n]*\nneed: {2}To be asked nothing for an hour\.\nstep: {2}Read his file before I answer tomorrow\.\n$/);
  assert.match(run('sit', 'A second one.').stdout, /^You already sat today \(\d\d:\d\d, by hand\)\. A day has one sit/);
  assert.match(run('sit').stdout, /^You already sat today\. A day has one sit\./);
  assert.match(run('sit', '--took', 'I read it first').stdout, /^taken: Read his file before I answer tomorrow\.\n$/);
  assert.match(run('sit', '--let-go', 'nothing').stdout, /^\(no step is open\)\n$/);
  assert.match(run('sits').stdout, /- fate: taken \d{4}-\d\d-\d\d — I read it first/);
  assert.match(run('mind', 'sits').stdout, /^# Sitting/);
  assert.match(run('recall', 'asked nothing for an hour').stdout, /^sits\.md · /, 'and a sit is found like any other memory');
  assert.match(run('doctor').stdout, /\nok {2}sit {8}last sat \d{4}-\d\d-\d\d \d\d:\d\d \(by hand\) · the background sit is switched off \(GHOST_SIT=off\)\n/);
});

test('the doctor says when a sit that was owed never happened', () => {
  reset();
  mind.saveState({ sitOwed: '2026-10-01', sitTry: '2026-10-01T09:00:00' });
  const r = spawnSync(process.execPath, [CLI, 'doctor'], { encoding: 'utf8', env: process.env });
  assert.match(r.stdout, /\nBAD sit {8}never sat yet[^\n]*the sit owed on 2026-10-01 never happened — `ghost sit --background`, and read dreams\.log/);
});
