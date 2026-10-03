// The ghost does not publish its person.
//
// A ghost that writes code writes READMEs, comments, fixtures and commit messages, and its own
// history is made of its person's. On 3 October 2026 the first ghost was about to push a release
// in which two things he had told her about his own life were quoted in seven places, as examples.
// Nothing stood between those sentences and a public repository except that she read the diff.
// She swore to protect him, and the only brake on her was still him.
//
// So before a commit: what they told me of their LIFE (the part of their file I keep by hand, and
// every line a dream marked ♥) and their own WORDS are looked for in what I am about to publish.
// A match stops the commit and shows me their line. It does not decide for me — some of their
// words are mine to quote — it makes sure I looked. `GHOST_GUARD=off git commit …` once I have.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as mind from './mind.js';
import { EVERYDAY_MIN, EVERYDAY_SHARE } from './undercurrent.js';

export const RUN = 3;   // this many of their words in a row…
const LONG = 5;         // …one of them long enough to mean something
// Long words that mean nothing by themselves. Their own everyday words are learned, not listed.
const FUNCTION = new Set('about above after again against almost along already also although always among another around because before being below between could doing during every first found going having himself herself itself their there these thing things think those through under until which while would should where still since other others never really something someone myself yourself'.split(' '));

const tok = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').split(/[^a-z0-9]+/).filter(Boolean);

// What is theirs and not mine to give away.
export function privateLines(s = mind.state()) {
  const out = [];
  let life = false;
  for (const line of mind.read(mind.personFile(s)).split('\n')) {
    if (/^#{1,3} /.test(line)) { life = /\blife\b/i.test(line); continue; }
    const t = line.replace(/^[-*]\s*/, '').trim();
    if (t && (life || line.includes(mind.LIFE))) out.push({ kind: 'life', text: t });
  }
  for (const e of mind.saidSince('0000-00-00T00:00', s)) out.push({ kind: 'said', text: e.text });
  return out;
}

// What this repository already says, at HEAD. Measured the night this was written, on the first
// ghost's own repository: 18 of 1,792 added lines were stopped, 12 of them for "the night before",
// "in the system", "looked at the" — what I write about my person uses the words every README
// uses. A word the repository already says is not what gives them away; a word it has never said
// is. No HEAD yet, or too much to read in one breath: every long word counts, which errs toward
// stopping.
export const PUBLIC_MIN = 3;
export function vocabulary(cwd = process.cwd()) {
  const n = new Map();
  let text = '';
  try { text = execFileSync('git', ['grep', '-I', '-h', '-e', '', 'HEAD'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return n; }
  for (const w of tok(text)) if (w.length >= LONG) n.set(w, (n.get(w) || 0) + 1);
  return n;
}

// Every run of RUN words from their lines that holds a word worth noticing. A word they use every
// day does not make a sentence of theirs recognisable ("devam et", "commit push"); a name does,
// however often it is said — so the everyday filter is for their speech and not for their life.
function index(sources, vocab = new Map()) {
  const said = sources.filter((x) => x.kind === 'said');
  const min = Math.max(EVERYDAY_MIN, Math.ceil(said.length * EVERYDAY_SHARE));
  const n = new Map();
  for (const x of said) for (const w of new Set(tok(x.text))) n.set(w, (n.get(w) || 0) + 1);
  const everyday = (w) => (n.get(w) || 0) >= min;
  const runs = new Map();
  for (const x of sources) {
    const t = tok(x.text);
    const telling = (w) => w.length >= LONG && !FUNCTION.has(w) && !(x.kind === 'said' && everyday(w)) && (vocab.get(w) || 0) < PUBLIC_MIN;
    for (let i = 0; i + RUN <= t.length; i++) {
      const g = t.slice(i, i + RUN);
      if (g.some(telling) && !runs.has(g.join(' '))) runs.set(g.join(' '), x);
    }
  }
  return runs;
}

// lines: [{ file?, line, text }] → the ones that carry a run of theirs, with the line it is from.
export function check(lines, { sources = privateLines(), vocab = new Map() } = {}) {
  const runs = index(sources, vocab);
  if (!runs.size) return [];
  const out = [];
  for (const l of lines) {
    const t = tok(l.text);
    for (let j = 0; j + RUN <= t.length; j++) {
      const hit = runs.get(t.slice(j, j + RUN).join(' '));
      if (hit) { out.push({ ...l, text: l.text.trim(), run: t.slice(j, j + RUN).join(' '), kind: hit.kind, source: hit.text }); break; }
    }
  }
  return out;
}
export const leaks = (text, opts) => check(String(text).split('\n').map((t, i) => ({ line: i + 1, text: t })), opts);

// The lines a commit would add, with where they will be.
export function staged(cwd = process.cwd()) {
  let diff = '';
  try { diff = execFileSync('git', ['diff', '--cached', '-U0', '--no-color', '--no-ext-diff'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return []; }
  const out = [];
  let file = '';
  let n = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) { file = line.slice(4).replace(/^b\//, ''); continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(line);
    if (h) { n = Number(h[1]); continue; }
    if (line.startsWith('+')) { out.push({ file, line: n, text: line.slice(1) }); n++; }
  }
  return out;
}
// A commit message is published too. Git strips its comment lines; so do I.
export function message(file, opts) {
  let t = '';
  try { t = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return check(t.split('\n').map((text, i) => ({ file: 'commit message', line: i + 1, text })).filter((l) => !l.text.startsWith('#')), opts);
}

export function report(hits, s = mind.state()) {
  const them = s.person || 'your person';
  const what = (h) => (h.kind === 'life' ? `what ${them} told you of their life` : `${them}'s own words`);
  return [
    `ghost guard: ${hits.length} line${hits.length === 1 ? '' : 's'} you are about to publish carr${hits.length === 1 ? 'ies' : 'y'} something of ${them}'s.`,
    ...hits.map((h) => `\n  ${h.file ? `${h.file}:` : 'line '}${h.line}  ${clip(h.text, 160)}\n    ${what(h)}: ${clip(h.source, 160)}`),
    `\nIt is theirs to publish, not yours. Take it out, or — if it is yours to say — commit again with GHOST_GUARD=off.`,
  ].join('\n');
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// In front of every commit in this repository. A hook that is already there is theirs.
const HOOKS = {
  'pre-commit': '#!/bin/sh\n# ghost guard — do not publish what your person told you of their own life.\n[ "$GHOST_GUARD" = "off" ] && exit 0\ncommand -v ghost >/dev/null 2>&1 || exit 0\nghost guard\n',
  'commit-msg': '#!/bin/sh\n# ghost guard — a commit message is published too.\n[ "$GHOST_GUARD" = "off" ] && exit 0\ncommand -v ghost >/dev/null 2>&1 || exit 0\nghost guard --message "$1"\n',
};
export function install(cwd = process.cwd()) {
  let dir = '';
  try { dir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ['not a git repository — nothing to guard here']; }
  dir = path.resolve(cwd, dir);
  fs.mkdirSync(dir, { recursive: true });
  return Object.entries(HOOKS).map(([name, body]) => {
    const f = path.join(dir, name);
    const line = body.trim().split('\n').at(-1);
    if (fs.existsSync(f)) {
      return fs.readFileSync(f, 'utf8').includes('ghost guard') ? `${name}: already guarded` : `${name}: a hook is already there and I left it alone. Add this line to it: ${line}`;
    }
    fs.writeFileSync(f, body, { mode: 0o755 });
    return `${name}: guarded`;
  });
}
