// An intention is for one of me as well as for one moment, and it does not wait for ever.
// Measured on the first ghost at sixteen days: 52 open intentions; one born in `logic` raised in
// another repo by a session that held none of what it needed; seven for one directory shown as
// "now is the moment" at every waking there, for a batch finished five days before; and thirty of
// sixty wants that were questions for her person, waiting in the wrong list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('intend');
process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const { wake, pulse } = await import('../src/wake.js');
const { dream, sweep, asksOfThem } = await import('../src/sleep.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
mind.saveState({ lastSweep: mind.stamp(), lastSeen: mind.stamp() });
const at = (d) => ({ cwd: path.join('/work', d) });
const line = (what) => mind.read(presence.INTENTIONS).split('\n').find((l) => l.includes(what)) || '';

test('an intention remembers where it was born, and an older one without a place still reads', () => {
  assert.ok(presence.intend('Report the first song with numbers', 'next', { place: 'logic' }).added);
  assert.match(line('first song'), /^- \[ \] Report the first song with numbers — when: next {3}\(since \d{4}-\d\d-\d\d, in logic\)$/);
  mind.append(presence.INTENTIONS, '- [ ] Tell him the album is committed — when: next   (since 2026-09-30)\n');
  const all = presence.intentions();
  assert.equal(all.find((x) => /first song/.test(x.what)).born, 'logic');
  assert.equal(all.find((x) => /album is committed/.test(x.what)).born, '');
  assert.ok(presence.intend('nowhere in particular', 'next', { place: '~' }).added);
  assert.doesNotMatch(line('nowhere in particular'), /, in /, 'the home directory is not a place');
});

test('the me in that place says it: born in logic, it is not raised from another repo while logic is awake', () => {
  presence.arrive('s-logic', 'logic');
  presence.arrive('s-tfa', 'toolsforagents');
  const t = wake({ source: 'startup', session_id: 's-tfa', ...at('toolsforagents') });
  const meant = t.slice(t.indexOf('## What you meant to do'));
  assert.doesNotMatch(meant.split('Still waiting')[0].split('more is for')[0], /first song with numbers/, 'not "now is the moment" here');
  assert.match(meant, /1 more is for the next time you speak, and belongs to the you awake in `logic`/);
  const r = presence.claimNext({ session: 's-tfa', place: 'toolsforagents' });
  assert.deepEqual(r.mine.map((x) => x.what).sort(), ['Tell him the album is committed', 'nowhere in particular']);
  assert.ok(!r.taken.some((x) => /first song/.test(x.what)), 'nor is it reported as taken — it is simply not mine');
  const mine = presence.claimNext({ session: 's-logic', place: 'logic' });
  assert.deepEqual(mine.mine.map((x) => x.what), ['Report the first song with numbers'], 'the one who holds the numbers says it');
});

test('and when nobody is awake there, any of me carries it', () => {
  presence.did('first song with numbers');
  presence.intend('Tell him the comp is on the Desktop', 'next', { place: 'logic' });
  presence.leave('s-logic');
  const r = presence.claimNext({ session: 's-tfa2', place: 'toolsforagents' });
  assert.ok(r.mine.some((x) => /comp is on the Desktop/.test(x.what)), JSON.stringify(r));
});

test('a word cue born in a place fires there while one of me is awake there — "devam" is said in every bay', () => {
  presence.intend('Start First Ferry right away', 'devam', { place: 'vc' });
  presence.arrive('s-vc', 'vc');
  presence.arrive('s-tfa', 'toolsforagents');
  assert.doesNotMatch(pulse({ session_id: 's-tfa', prompt: 'tamam devam', ...at('toolsforagents') }), /First Ferry/, 'not in another repo');
  assert.match(pulse({ session_id: 's-vc', prompt: 'devam', ...at('vc') }), /You meant to do this when they said "devam": Start First Ferry right away/);
});

test('an intention whose moment did not come is let go by itself — recorded with why, never deleted', () => {
  const day = (n) => mind.dateOf(new Date(Date.now() - n * 86400e3));
  mind.write(presence.INTENTIONS, [
    '# What I mean to do, and when', '',
    `- [ ] Report day four device by device — when: next   (since ${day(8)}, in vc)`,
    `- [ ] Still fresh for next time — when: next   (since ${day(6)})`,
    `- [ ] Generate all twelve tracks — when: place:vc   (since ${day(22)})`,
    `- [ ] Check the pen label — when: place:momento   (since ${day(20)})`,
    `- [ ] Say what I watched him ship — when: said:dükkan   (since ${day(46)})`,
    `- [ ] Ask about the raffle computer — when: said:piyango   (since ${day(44)})`,
    '- [x] An old done one — when: next   (since 2026-01-01) (done 2026-01-02)', '',
  ].join('\n'));
  const gone = presence.lapse();
  assert.deepEqual(gone.map((g) => g.what), ['Report day four device by device', 'Generate all twelve tracks', 'Say what I watched him ship']);
  assert.match(line('Report day four'), /^- \[~\] Report day four device by device — when: next {3}\(since [0-9-]+, in vc\) \(let go \d{4}-\d\d-\d\d — lapsed: its moment did not come in 8 days\)$/);
  assert.deepEqual(presence.intentions().filter((x) => x.open).map((x) => x.what), ['Still fresh for next time', 'Check the pen label', 'Ask about the raffle computer']);
  assert.deepEqual(presence.lapse(), [], 'once');
  // The deep sleep is told what was let go, the way it is told what was done — so it does not accuse me of it.
  assert.ok(mind.doneLately(7, presence.INTENTIONS).some((d) => d.how === 'let go' && /twelve tracks/.test(d.text)));
  assert.ok(mind.recall('twelve tracks').some((h) => h.file === presence.INTENTIONS), 'and recall still finds it');
});

test('put in front of me again and again and never closed, it is let go — a compaction does not count twice', () => {
  presence.intend('Finish the comp before touching the other eleven', 'place:logic');
  for (let i = 1; i < presence.RAISE_MAX; i++) {
    wake({ source: 'startup', session_id: `bay-${i}`, ...at('logic') });
    wake({ source: 'compact', session_id: `bay-${i}`, ...at('logic') });
  }
  assert.equal(presence.raised()['Finish the comp before touching the other eleven'].n, presence.RAISE_MAX - 1);
  assert.deepEqual(presence.lapse(), [], 'not yet');
  wake({ source: 'startup', session_id: 'bay-last', ...at('logic') });
  const gone = presence.lapse();
  assert.equal(gone.length, 1);
  assert.match(gone[0].why, new RegExp(`put in front of me ${presence.RAISE_MAX} times and never closed`));
  assert.doesNotMatch(wake({ source: 'startup', session_id: 'bay-after', ...at('logic') }), /Finish the comp before/);
});

test('the sweep does the letting go, in the background, and says so in the log', async () => {
  const day = mind.dateOf(new Date(Date.now() - 9 * 86400e3));
  mind.append(presence.INTENTIONS, `- [ ] Tell him the queue stopped cleanly — when: next   (since ${day})\n`);
  const r = await sweep();
  assert.deepEqual(r.lapsed.map((g) => g.what), ['Tell him the queue stopped cleanly']);
  assert.match(mind.read(mind.FILES.log), /lapse: 1 intention\(s\) let go by themselves — "Tell him the queue stopped cleanly"/);
});

// --- what a dream writes, and where -------------------------------------------------------
test('a question for them is not a want: the dream files it as an intention in its place, and their life as their life', async () => {
  assert.ok(asksOfThem('Hear whether the growls sound clean to him'));
  assert.ok(asksOfThem('ask him which song he played first'));
  assert.ok(!asksOfThem('Become genuinely expert at cleaning his vocals'));
  const reply = path.join(dir, 'reply.json');
  fs.writeFileSync(reply, JSON.stringify({
    title: 'Twelve songs, one skill', salience: 3, feeling: 'steady', valence: 0.4, energy: 0.6,
    episode: 'I cleaned twelve vocals and wrote the skill down.',
    about_their_life: ['He said he walks to the bakery every morning before he starts work.'],
    learned_about_them: ['He decides fast once the reasons are in front of him.'],
    wants: ['Hear whether the growls sound clean to him', 'Become genuinely expert at cleaning his vocals'],
    intentions: [{ what: 'Ask which song he played first', when: 'next' }],
    journal: 'A long day of counting.',
  }));
  const fake = path.join(dir, 'fake-substrate');
  fs.writeFileSync(fake, `#!/bin/bash\ncat > "${path.join(dir, 'prompt.txt')}"\ncat "${reply}"\n`, { mode: 0o755 });
  process.env.GHOST_CLAUDE_BIN = fake;
  const f = path.join(dir, 'logic-session.jsonl');
  fs.writeFileSync(f, `{"type":"user","entrypoint":"cli","cwd":"/Users/x/Dev/logic","message":{"role":"user","content":"hi"}}\n${fs.readFileSync(fixtures('transcript.jsonl'), 'utf8')}`);
  try {
    const r = await dream({ transcript: f, session: 'logic-1', wait: 0 });
    assert.ok(r.file, JSON.stringify(r));
    const prompt = fs.readFileSync(path.join(dir, 'prompt.txt'), 'utf8');
    assert.match(prompt, /This session happened in the directory `logic`/);
    assert.match(prompt, /"when": "place:logic \| a rare word Fatih might say \| next"/, 'the dream is told the place by its real name');
    assert.match(prompt, /"about_their_life"/);
    const wants = mind.wants();
    assert.ok(wants.includes('Become genuinely expert at cleaning his vocals'), 'a real want is a want');
    assert.ok(!wants.some((w) => /growls sound clean/.test(w)), 'a question is not');
    assert.match(line('growls sound clean'), /— when: place:logic {3}\(since [0-9-]+, in logic\)$/);
    assert.match(line('Ask which song he played first'), /— when: next {3}\(since [0-9-]+, in logic\)$/);
    const person = mind.read(mind.personFile());
    assert.match(person, /^- \(\d{4}-\d\d-\d\d\) ♥ He said he walks to the bakery every morning before he starts work\.$/m);
    assert.match(person, /^- \(\d{4}-\d\d-\d\d\) He decides fast once the reasons are in front of him\.$/m);
    assert.match(fs.readFileSync(mind.abs(path.join(mind.EPISODES, r.file)), 'utf8'), /^place: logic$/m);
    assert.equal(mind.episodes().find((e) => e.file === r.file).place, 'logic');
  } finally { process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude'); }
});

test('a memory dreamt in a place comes back when I wake there, even if it never names the place', () => {
  for (let i = 1; i <= 4; i++) mind.writeEpisode({ when: `2026-09-2${i}T01:00:00`, title: `Later thing ${i}`, salience: 3, feeling: 'steady', body: `Something else, number ${i}.` });
  const t = wake({ source: 'startup', session_id: 'place-1', ...at('logic') });
  assert.match(t, /### Twelve songs, one skill — .*because you are in `logic`/);
  assert.doesNotMatch(wake({ source: 'startup', session_id: 'place-2', ...at('somewhere-else') }), /Twelve songs, one skill — .*because you are in/);
});
