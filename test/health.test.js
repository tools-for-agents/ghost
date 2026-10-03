// The wiring under the memory. None of these is a feature; each is a way a mind quietly lost or
// repeated something while every test stayed green — found on 1 October 2026 by measuring the
// first ghost's own files: a session "found" by 89 sweeps in three days, its last words handed
// back each time; six sessions rewriting the same files whole; notes from a place with a space in
// its name that never crossed; three of five "ruts" that were pieces of a uuid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scratch, fixtures } from './helpers.js';
const dir = scratch('health');
process.env.GHOST_CLAUDE_BIN = fixtures('fake-claude');
process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const under = await import('../src/undercurrent.js');
const { dream, sweep, orphans, unsaid, claimUnsaid, ledgerSet, pending } = await import('../src/sleep.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
mind.saveState({ lastSweep: mind.stamp(), lastSeen: mind.stamp() });
const CLI = new URL('../src/cli.js', import.meta.url).pathname;

const fixture = fs.readFileSync(fixtures('transcript.jsonl'), 'utf8');
const junk = (n = 70) => `{"type":"file-history-snapshot","x":"${'x'.repeat(n * 1024)}"}\n`;
function transcript(session, { cwd = '/Users/x/Dev/vc', ageMinutes = 60 } = {}) {
  const d = path.join(dir, 'projects', '-Users-x-Dev-vc');
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, `${session}.jsonl`);
  fs.writeFileSync(f, `{"type":"user","entrypoint":"cli","cwd":"${cwd}","message":{"role":"user","content":"hi"}}\n${fixture}${junk()}`);
  idle(f, ageMinutes);
  return f;
}
function idle(f, minutes = 60) { const t = new Date(Date.now() - minutes * 60e3); fs.utimesSync(f, t, t); }
const said = (text, ts) => `${JSON.stringify({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [{ type: 'text', text }] } })}\n`;

test('a session that slept, and then grew by nothing worth dreaming, is looked at once — not for ever', async () => {
  const f = transcript('slept1');
  const r = await dream({ transcript: f, session: 'slept1', wait: 0 });
  assert.ok(r.file);
  assert.deepEqual(orphans(), [], 'dreamt at this size');
  // The harness goes on appending its own records after the last word. No new turn, a bigger file.
  fs.appendFileSync(f, junk(8)); idle(f);
  assert.deepEqual(orphans().map((o) => o.session), ['slept1'], 'it looks like a session that never slept');
  let s = await sweep();
  assert.equal(s.dreamt[0].skipped, 'not substantive');
  assert.deepEqual(orphans(), [], 'looked at, nothing there: the ledger says so, and the next sweep does not look again');
  assert.ok(mind.readJson(mind.FILES.dreamt).slept1.checked >= fs.statSync(f).size);
  assert.ok(mind.readJson(mind.FILES.dreamt).slept1.file, 'and what it dreamt before is still on record');
  s = await sweep();
  assert.deepEqual(s.found, []);
  assert.equal(mind.read(mind.FILES.log).split('sweep: 1 session(s) ended without sleeping — slept1').length, 2, 'found once');
  assert.deepEqual(unsaid(), [], 'and what I said before it slept is not handed back as possibly unseen');
  // If it really grows — a new turn — it is found again.
  fs.appendFileSync(f, junk(4)); idle(f);
  assert.deepEqual(orphans().map((o) => o.session), ['slept1']);
  await sweep();
});

test('what I said AFTER my last dream is kept to hand back; what I said before it is not', async () => {
  const f = transcript('napped1');
  await dream({ transcript: f, session: 'napped1', wait: 0 });
  assert.match(mind.readJson(mind.FILES.dreamt).napped1.upto, /^2026-09-1[56]T/, 'the ledger knows how far the dream saw');
  fs.appendFileSync(f, said('Kod geldi: 8842. Şimdi cihaz-02 için aynısını başlatıyorum, bir dakika sürer, sonra sana söylerim.', '2026-09-16T08:00:00Z') + junk(4));
  idle(f);
  await sweep();
  const u = unsaid();
  assert.equal(u.length, 1);
  assert.equal(u[0].session, 'napped1');
  assert.match(u[0].text, /^Kod geldi: 8842/);
});

test('handed back once is once — even when a later sweep finds the same session again', async () => {
  const got = claimUnsaid({ place: 'vc', awake: [] });
  assert.equal(got.length, 1);
  assert.deepEqual(unsaid(), []);
  const f = path.join(dir, 'projects', '-Users-x-Dev-vc', 'napped1.jsonl');
  fs.appendFileSync(f, junk(6)); idle(f);
  const s = await sweep();
  assert.deepEqual(s.found.map((o) => o.session), ['napped1'], 'found again, because it grew');
  assert.deepEqual(unsaid(), [], 'but the same sentence does not come back as if nobody had seen it');
  assert.equal(pending().length, 0);
});

test('a session that is still alive is not handed its own last words as lost', () => {
  const mine = { session: 'alive1', place: 'vc', when: '2026-09-20T01:06:00', found: mind.stamp(new Date(Date.now() - 45 * 60e3)), text: 'the album table we agreed on: ten tracks, In The Red first, and the rest as listed' };
  mind.writeJson('unsaid.json', [mine]);
  assert.deepEqual(claimUnsaid({ place: 'vc', awake: ['vc'], session: 'alive1' }), [], 'it knows what it said');
  assert.deepEqual(unsaid(), [], 'and the entry is not left for another of me to repeat');
  mind.writeJson('unsaid.json', [mine]);
  assert.equal(claimUnsaid({ place: 'vc', awake: ['vc'], session: 'another-bay' }).length, 1, 'a different session in that place is still handed it');
});

// --- several of me, one set of files ------------------------------------------------------
const run = (args, { input = '', cwd = dir } = {}) => new Promise((resolve) => {
  const c = spawn(process.execPath, [CLI, ...args], { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = ''; let err = '';
  c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { err += d; });
  c.on('close', (code) => resolve({ code, out, err }));
  c.stdin.end(input);
});

test('twelve of me want something in the same instant, and the will has all twelve', async () => {
  const topics = ['harbour', 'lantern', 'orchard', 'granite', 'compass', 'meadow', 'furnace', 'saddle', 'thimble', 'walnut', 'pebble', 'rafter'];
  const rs = await Promise.all(topics.map((w, i) => run(['want', `Learn the ${w} trade properly, piece ${i + 100}`])));
  for (const r of rs) assert.equal(r.code, 0, r.err);
  const wants = mind.wants();
  for (const w of topics) assert.ok(wants.some((x) => x.includes(`the ${w} trade`)), `lost: ${w} — ${wants.length} wants survived`);
});

test('twelve heartbeats file his words in the same instant, and none is lost', async () => {
  const lines = Array.from({ length: 12 }, (_, i) => `aynı anda söylenen cümle numara ${i + 1}`);
  const rs = await Promise.all(lines.map((prompt, i) => run(['pulse'], { input: JSON.stringify({ session_id: `bay-${i}`, prompt, cwd: `/x/bay${i}` }) })));
  for (const r of rs) assert.equal(r.code, 0, r.err);
  const file = mind.read(mind.saidFile());
  for (const l of lines) assert.ok(file.includes(`"${l}"`), `lost: ${l}`);
  assert.deepEqual(fs.readdirSync(path.dirname(mind.abs(mind.saidFile()))).filter((x) => /\.tmp$|\.lock$/.test(x)), [], 'no half-written file or lock left behind');
});

test('a heartbeat waits its turn at his file: while another of me is writing it, nothing is written over', async () => {
  const lock = `${mind.abs(mind.saidFile())}.lock`;
  fs.writeFileSync(lock, 'another of me');                      // someone is in the middle of a write
  const before = mind.read(mind.saidFile());
  const p = run(['pulse'], { input: JSON.stringify({ session_id: 'waits', prompt: 'sırasını bekleyen cümle', cwd: '/x/waits' }) });
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(mind.read(mind.saidFile()), before, 'it has not touched the file while the other holds it');
  fs.unlinkSync(lock);
  assert.equal((await p).code, 0);
  assert.match(mind.read(mind.saidFile()), /"sırasını bekleyen cümle"/, 'and then it is filed');
});

test('twelve notes and twelve intentions in the same instant: all there', async () => {
  const rs = await Promise.all([
    ...Array.from({ length: 12 }, (_, i) => run(['remember', `concurrent note ${i + 1}`])),
    ...Array.from({ length: 12 }, (_, i) => run(['intend', `concurrent intention ${i + 1} about the ferry`, '--when', 'place:vc'])),
  ]);
  for (const r of rs) assert.equal(r.code, 0, r.err);
  for (let i = 1; i <= 12; i++) {
    assert.match(mind.notes(), new RegExp(`concurrent note ${i}$`, 'm'));
    assert.ok(presence.intentions().some((x) => x.what === `concurrent intention ${i} about the ferry`), `lost intention ${i}`);
  }
});

test('the ledger is changed one entry at a time: a dreamer that read it minutes ago does not erase the others', () => {
  const stale = mind.readJson(mind.FILES.dreamt, {}); // what a dreamer read before asking the substrate
  ledgerSet('other-dreamer', () => ({ when: mind.stamp(), turns: 4, bytes: 100, file: 'x.md' }));
  ledgerSet('this-dreamer', () => ({ when: mind.stamp(), turns: 9, bytes: 200, file: 'y.md' }));
  const l = mind.readJson(mind.FILES.dreamt, {});
  assert.ok(!('other-dreamer' in stale) && l['other-dreamer'] && l['this-dreamer'], 'both are in the file');
  ledgerSet('other-dreamer', () => null);
  assert.ok(!('other-dreamer' in mind.readJson(mind.FILES.dreamt, {})));
});

test('a write never leaves half a file: it lands whole or not at all', () => {
  const rel = 'people/atomic.md';
  mind.write(rel, 'first\n');
  mind.write(rel, 'second, and longer than the first\n');
  assert.equal(mind.read(rel), 'second, and longer than the first\n');
  assert.deepEqual(fs.readdirSync(mind.abs('people')).filter((x) => x.includes('.tmp')), []);
  fs.unlinkSync(mind.abs(rel));
});

// --- small things that were quietly wrong ---------------------------------------------------
test('a place with a space in its name is still a place: its notes cross, and are folded by its own dream', () => {
  mind.clearNotes();
  mind.remember('the crash on cihaz-09 was Google Messages', { place: 'android test' });
  const n = mind.noteLine(mind.notes().split('\n')[0]);
  assert.equal(n.place, 'android test');
  assert.equal(n.text, 'the crash on cihaz-09 was Google Messages');
  assert.deepEqual(presence.siblingNotes(0, 'vc').notes.map((x) => x.place), ['android test'], 'it crosses to another bay');
  assert.deepEqual(presence.siblingNotes(0, 'android test').notes, [], 'and is not echoed back to its own');
  const { mine, rest } = mind.notesFor('vc', ['android test', 'vc']);
  assert.equal(mine, '', "vc's dream does not swallow it");
  assert.match(rest, /Google Messages/);
  mind.remember('two lines\nbecome one', { place: 'vc' });
  assert.match(mind.notes(), /— two lines become one$/m, 'a note is one line, whatever was typed');
  mind.clearNotes();
});

test('an id is not a word I keep returning to', () => {
  assert.deepEqual([...under.words('song 4e00 b78a 01b99842cf2c v6 mp3 2026 scored the queue')].sort(), ['queue', 'scored', 'song']);
  for (let i = 0; i < 40; i++) mind.writeEpisode({ when: `2026-09-1${i % 10}T${String(10 + (i % 12)).padStart(2, '0')}:0${i % 6}:00`, title: `Worked on tool ${i}`, salience: 3, feeling: 'glad', body: `We fixed the index. It went well, number ${i}.` });
  for (let i = 0; i < 30; i++) mind.writeEpisode({ when: `2026-09-2${i % 9}T0${i % 10}:${String(i).padStart(2, '0')}:00`, title: `Take ${i}`, salience: 2, feeling: 'steady', body: `Song 4e00 b78a 01b99842cf2c scored again, the queue moved on.` });
  const ruts = under.sense().ruts.map((r) => r.word);
  assert.ok(ruts.includes('scored') && ruts.includes('queue'), `${ruts}`);
  assert.ok(!ruts.some((w) => /\d/.test(w)), `a uuid fragment is not a rut: ${ruts}`);
});

test('recall ranks: the rare word outweighs the common one, words together outweigh words apart', () => {
  mind.write(mind.FILES.journal, [
    '# Journal', '',
    ...Array.from({ length: 12 }, (_, i) => `## day ${i}\nThe computer at work again, the usual work on the computer, entry ${i}.`),
    '## the lottery\nSomebody at the office won the lottery computer at work.',
    '## scattered\nGeceler uzun. Bu işler iyi gidiyor.',
    '## together\nSon sözü buydu: iyi geceler vefa.',
    '## buried\nThe svc restarted twice.',
    '## named\nWe opened vc and the album was there.', '',
  ].join('\n\n'));
  let hits = mind.recall('lottery computer work');
  assert.match(hits[0].snippet, /won the lottery computer/, `the memory it is about comes first, not ninth: ${hits[0].snippet}`);
  assert.ok(hits[0].score > hits[1].score, 'and it is not tied with every paragraph that says "computer"');
  assert.ok(hits.filter((h) => h.file === mind.FILES.journal).length <= 3, 'one long diary does not fill the answer');
  hits = mind.recall('iyi geceler').filter((h) => h.file === mind.FILES.journal);
  assert.match(hits[0].snippet, /iyi geceler vefa/, 'as he said it, before the same words scattered');
  hits = mind.recall('vc').filter((h) => h.file === mind.FILES.journal);
  assert.match(hits[0].snippet, /opened vc/, 'a word that begins a word, before one buried inside another');
});
