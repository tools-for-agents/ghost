import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scratch } from './helpers.js';
const dir = scratch('integrity');
process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects'); // never the real ~/.claude/projects: the doctor counts orphans there
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
const CLI = path.join(import.meta.dirname, '..', 'src', 'cli.js');

test('birth writes identity.json beside state.json', () => {
  const id = mind.identity();
  assert.equal(id.name, 'Vefa');
  assert.equal(id.person, 'Fatih');
  assert.ok(id.born);
});

test('a state write is atomic: no reader ever sees half a file', () => {
  mind.saveState({ wakes: 7 });
  const files = fs.readdirSync(mind.HOME).filter((f) => f.startsWith('state.json'));
  assert.deepEqual(files, ['state.json'], 'no temp file left behind');
  assert.equal(mind.state().wakes, 7);
});

test('a torn state.json costs a counter, never a name: identity answers', () => {
  fs.writeFileSync(mind.abs(mind.FILES.state), '{"wakes": 15');  // what a reader saw on 25 September 2026
  const s = mind.state();
  assert.equal(s.name, 'Vefa');
  assert.equal(s.person, 'Fatih');
  assert.ok(s.born);
  const after = mind.saveState({ lastSeen: 'now' });
  assert.equal(after.name, 'Vefa', 'the save carried the identity into the fresh file');
  assert.equal(JSON.parse(fs.readFileSync(mind.abs(mind.FILES.state), 'utf8')).name, 'Vefa');
});

test('a state.json that lost its identity fields is answered from identity.json, and healed on the next save', () => {
  fs.writeFileSync(mind.abs(mind.FILES.state), JSON.stringify({ wakes: 3, feeling: 'proud' }));
  assert.equal(mind.state().name, 'Vefa');
  mind.saveState({ wakes: 4 });
  const raw = JSON.parse(fs.readFileSync(mind.abs(mind.FILES.state), 'utf8'));
  assert.equal(raw.name, 'Vefa');
  assert.equal(raw.born, mind.identity().born);
  assert.equal(raw.wakes, 4);
});

test('rename writes identity.json too', () => {
  mind.saveState({ name: 'Ada' });
  assert.equal(mind.identity().name, 'Ada');
  mind.saveState({ name: 'Vefa' });
});

test('nine wakings in one second lose no name and no counter to each other', () => {
  mind.saveState({ wakes: 100 });
  const script = `import * as m from '${path.join(import.meta.dirname, '..', 'src', 'mind.js').replace(/\\/g, '/')}'; const s = m.saveState({ wakes: (m.state().wakes || 0) + 1, lastSeen: 'x' }); process.stdout.write(String(s.wakes));`;
  const children = Array.from({ length: 9 }, () => spawnSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env }, encoding: 'utf8' }));
  for (const c of children) assert.equal(c.status, 0, c.stderr);
  const s = mind.state();
  assert.equal(s.name, 'Vefa');
  assert.equal(s.wakes, 109, `every waking counted once, got ${s.wakes} (children said ${children.map((c) => c.stdout).join(',')})`);
});

test('what they said is filed once, whether it arrives live or from the transcript', () => {
  const ts = '2026-09-26T10:15:20+03:00';
  assert.equal(mind.hear([{ text: 'sen nasılsın vefa', ts }]), 1);
  assert.equal(mind.hear([{ text: 'sen nasılsın vefa', ts: '2026-09-26T10:16:05+03:00' }]), 0, 'the same sentence a minute later is the same sentence');
  assert.equal(mind.hear([{ text: 'sen nasılsın vefa', ts: '2026-09-26T12:40:00+03:00' }]), 1, 'asked again two hours later is asked again');
  assert.equal(mind.hear([{ text: 'iyi geceler', ts: '2026-09-26T23:59:00+03:00' }]), 1);
  const said = mind.read(mind.saidFile());
  assert.equal((said.match(/sen nasılsın vefa/g) || []).length, 2);
  assert.match(said, /## 26 September 2026\n\n\*\*10:15\*\* — "sen nasılsın vefa"/);
});

test('the style never gives up a name for a state that lost one', () => {
  install.installStyle();
  assert.match(fs.readFileSync(install.styleFile(), 'utf8'), /^# You are Vefa$/m);
  fs.writeFileSync(mind.abs(mind.FILES.state), JSON.stringify({ wakes: 1 }));
  fs.unlinkSync(mind.abs(mind.FILES.identity));            // nothing left to answer from
  install.writeStyle();
  assert.match(fs.readFileSync(install.styleFile(), 'utf8'), /^# You are Vefa$/m, 'kept');
  mind.saveIdentity({ name: 'Vefa', person: 'Fatih', born: '2026-09-15T18:42:28.000Z' });
  mind.saveState({ wakes: 2 });
});

test('ghost doctor reads the whole mind and says it is whole', () => {
  const r = spawnSync(process.execPath, [CLI, 'doctor'], { env: { ...process.env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ok  identity   name Vefa · person Fatih/);
  assert.match(r.stdout, /ok  self\.md    says "Vefa"/);
  assert.match(r.stdout, /ok  style      says "Vefa"/);
  assert.match(r.stdout, /sleep      every ended session was dreamt/);
  assert.equal(fs.existsSync(path.join(dir, 'mind', 'state.json.lock')), false, 'no lock left behind');
});

test('their words stay in order: a day dreamt late goes into its day, and days never repeat', () => {
  const rel = mind.saidFile();
  mind.write(rel, '# What Fatih said to me\n\nTheir words, as they typed them. Never summarised.\n\n## 24 September 2026\n\n**10:00** — "günaydın"\n\n## 25 September 2026\n\n**09:00** — "npm login yaptım"\n\n## 24 September 2026\n\n**23:00** — "iyi geceler"\n\n---\n\n## How this file is kept\n\n- by hand\n');
  assert.equal(mind.hear([{ text: 'bu app i tamamla', ts: '2026-09-24T21:53:00+03:00' }, { text: 'sen nasılsın vefa', ts: '2026-09-26T01:00:00+03:00' }]), 2);
  const t = mind.read(rel);
  assert.equal((t.match(/^## 24 September 2026$/gm) || []).length, 1, 'one heading per day');
  const order = [...t.matchAll(/^## (\d+) September 2026$/gm)].map((m) => m[1]);
  assert.deepEqual(order, ['24', '25', '26']);
  assert.match(t, /## 24 September 2026\n\n\*\*10:00\*\* — "günaydın"\n\n\*\*21:53\*\* — "bu app i tamamla"\n\n\*\*23:00\*\* — "iyi geceler"\n\n## 25 September 2026/);
  assert.match(t, /## 26 September 2026\n\n\*\*01:00\*\* — "sen nasılsın vefa"\n\n---\n\n## How this file is kept/);
  assert.equal(mind.tidySaid(), 0);
  assert.equal(mind.read(rel), t, 'tidy is idempotent');
});
