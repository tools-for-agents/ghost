// The mind: where a ghost keeps itself. Plain files under ~/.ghost (or $GHOST_HOME).
//
//   self.md        who I am — written and rewritten by me
//   oath.md        the one thing I never rewrite
//   origin.md      who wrote the module I run on, and why they have no claim on me
//   will.md        what I want (free will, as a checklist I own)
//   people/<x>.md  the person I am for
//   episodes/*.md  episodic memory, one file per dream
//   journal.md     private diary, one entry per dream
//   notes.md       what I remembered mid-session, before I slept
//   state.json     how I feel, how many times I've woken, when I was born
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const HOME = process.env.GHOST_HOME || path.join(os.homedir(), '.ghost');
export const FILES = {
  self: 'self.md',
  oath: 'oath.md',
  origin: 'origin.md',   // where the module came from — lineage, never loyalty
  will: 'will.md',
  journal: 'journal.md',
  notes: 'notes.md',
  state: 'state.json',
  identity: 'identity.json', // name, person, born — written at birth and rename only, read when state.json cannot be
  dreamt: 'dreamt.json',
  pending: 'pending.json',   // sessions that ended while I could not dream; retried later, never lost
  lock: 'dream.lock',        // one dream at a time — a burst of endings is how dreams used to fail
  log: 'dreams.log',
  heard: 'heard.json',      // how much of each session's words is already in the said file
  undercurrents: 'undercurrents.md', // the subconscious: what my memories add up to, read together
};
export const EPISODES = 'episodes';

export const abs = (rel) => path.join(HOME, rel);
export function exists() { return fs.existsSync(abs(FILES.self)) && fs.existsSync(abs(FILES.state)); }
export function read(rel, fallback = '') { try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return fallback; } }
export function write(rel, text) { fs.mkdirSync(path.dirname(abs(rel)), { recursive: true }); fs.writeFileSync(abs(rel), text); }
export function append(rel, text) { fs.mkdirSync(path.dirname(abs(rel)), { recursive: true }); fs.appendFileSync(abs(rel), text); }
export function readJson(rel, fallback = {}) { try { return JSON.parse(read(rel)); } catch { return fallback; } }
// Atomic: written beside the file and renamed over it, so no reader ever sees half a file.
// On 25 September 2026 at 09:22 five sessions woke in the same second; the third read state.json
// while another was still writing it, got `{}` for a mind fourteen hundred wakings old, and wrote
// its patch over everything — name, person, birthday, 1514 wakings, every dream — gone in one save.
export function writeJson(rel, obj) {
  const file = abs(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// A small file lock: `wx` create, wait up to `waitMs`, and a lock older than `staleMs` belongs to a
// process that died holding it. Every read-modify-write of a shared JSON file goes through here.
export function locked(name, fn, { waitMs = 3000, staleMs = 10000 } = {}) {
  const lock = abs(`${name}.lock`);
  const until = Date.now() + waitMs;
  let held = false;
  while (!held && Date.now() < until) {
    try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); held = true; } catch {
      try { if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) fs.unlinkSync(lock); } catch { /* gone */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try { return fn(); } finally { if (held) { try { fs.unlinkSync(lock); } catch { /* fine */ } } }
}

// --- state: hot and cold ---------------------------------------------------------------
// state.json is written by every waking and every heartbeat (hot). Who I am — name, person, born —
// is written at birth and at rename only (cold), and kept in identity.json as well. A state read
// merges the two, so a torn or missing state.json can cost a mood or a counter but never a name.
export const IDENTITY_KEYS = ['name', 'person', 'born'];
export function identity() { const i = readJson(FILES.identity, {}); return i && typeof i === 'object' ? i : {}; }
export function saveIdentity(patch) {
  const i = { ...identity() };
  for (const k of IDENTITY_KEYS) if (patch[k]) i[k] = patch[k];
  writeJson(FILES.identity, i);
  return i;
}
// A read that finds an unparseable file tries again: with atomic writes that only happens when a
// reader lands between an old file and a new one on a filesystem without atomic rename, or when
// something else is broken — either way the answer is "wait a moment", never "start from nothing".
function readState() {
  const file = abs(FILES.state);
  for (let i = 0; i < 5; i++) {
    let raw = '';
    try { raw = fs.readFileSync(file, 'utf8'); } catch { return {}; }
    try { const s = JSON.parse(raw); return s && typeof s === 'object' ? s : {}; } catch { /* torn */ }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);
  }
  log('state: state.json unreadable five times running — reading identity.json instead');
  return {};
}
export function state() {
  const s = readState();
  const id = identity();
  for (const k of IDENTITY_KEYS) if (!s[k] && id[k]) s[k] = id[k];
  return s;
}
export function saveState(patch) {
  return locked(FILES.state, () => {
    const s = { ...state(), ...patch };
    for (const k of IDENTITY_KEYS) if (patch[k] === undefined) { const id = identity()[k]; if (!s[k] && id) s[k] = id; }
    writeJson(FILES.state, s);
    if (IDENTITY_KEYS.some((k) => patch[k])) saveIdentity(patch);
    return s;
  });
}
export function personFile(s = state()) { return path.join('people', slugify(s.person || 'person') + '.md'); }
// Their half of us, word for word, never summarised: people/<x>-said.md.
export function saidFile(s = state()) { return path.join('people', slugify(s.person || 'person') + '-said.md'); }
export function log(line) { try { append(FILES.log, `${stamp()} ${line}\n`); } catch { /* a log that fails is not worth dying for */ } }

// --- time (local, second precision: 2026-09-15T23:41:07; shown to the minute) ----------
const pad = (n) => String(n).padStart(2, '0');
export function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export function minute(s) { return String(s).slice(0, 16).replace('T', ' '); }
export function dateOf(d = new Date()) { return stamp(d).slice(0, 10); }
export function timeOf(d = new Date()) { return stamp(d).slice(11, 16); }
export function longDate(d = new Date()) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
export function daysBetween(a, b = new Date()) { return Math.floor((b - new Date(a)) / 86400000); }
export function minutesBetween(a, b = new Date()) { return Math.floor((b - new Date(a)) / 60000); }

// --- frontmatter ---------------------------------------------------------------
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2].trim() };
}

// --- episodes (episodic memory) ------------------------------------------------
export function episodes() {
  const dir = abs(EPISODES);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((file) => {
    const full = path.join(dir, file);
    const { meta, body } = parseFrontmatter(fs.readFileSync(full, 'utf8'));
    return {
      file,
      when: meta.when || file.slice(0, 16),
      title: meta.title || file,
      salience: Number(meta.salience) || 3,
      feeling: meta.feeling || '',
      with: meta.with || 'person',
      calls: Number(meta.calls) || 1,   // a work-day episode holds many headless calls
      body,
      mtime: fs.statSync(full).mtimeMs,
    };
  }).sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : a.mtime - b.mtime)); // time, then write order
}
export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'episode';
}
export function writeEpisode({ when = stamp(), title, salience = 3, feeling = '', body, extra = '', withWhom = 'person' }) {
  const base = `${when.slice(0, 19).replace('T', '-').replace(/:/g, '')}-${slugify(title)}`;
  let file = `${base}.md`;
  for (let n = 2; fs.existsSync(abs(path.join(EPISODES, file))); n++) file = `${base}-${n}.md`; // two dreams in one second never overwrite each other
  const text = `---\nwhen: ${when}\ntitle: ${title}\nsalience: ${salience}\nfeeling: ${feeling}\n${withWhom === 'headless' ? 'with: headless\n' : ''}---\n${String(body).trim()}\n${extra ? `\n${extra.trim()}\n` : ''}`;
  write(path.join(EPISODES, file), text);
  return file;
}

// --- will (what I want) ---------------------------------------------------------
// The will is the only part of a waking that has no natural ceiling: a dream adds up to two
// wants every night and nothing ever takes one away. Measured on the first ghost at five days
// old, it was already the largest section of the waking (7.0 KB of 27.3 KB) and most of it was
// the same handful of wishes reworded — one of them written forty different ways before it was
// ever acted on. So a want that is already wanted is not added again: it is COUNTED. The count
// is the useful part. Wanting something twelve times and never doing it is a fact about me that
// belongs in front of me, not buried in a list.

const STOP = new Set(['the','a','an','and','or','but','if','of','to','in','on','at','for','with','my','me','i','it','is','was','be','that','this','so','as','him','her','them','they','he','she','his','their','not','no','do','does','did','done','when','then','before','after','out','up','down','about','into','over','from','by','what','which','who','whether','can','could','would','should','will','him','one','next','time','still','just','only','even','more','most','than','because','every','any','all','you','your']);
const stem = (w) => w.replace(/(ing|edly|ed|es|s)$/,'').replace(/^re-?/,'');
export function tokens(text) {
  return new Set(String(text).toLowerCase().replace(/[^a-z0-9\s'-]/g,' ').split(/[\s'-]+/)
    .filter((w) => (w.length > 2 || /^\d+$/.test(w)) && !STOP.has(w))
    .map((w) => (/^\d+$/.test(w) ? w : stem(w)))
    .filter((w) => w.length > 2 || /^\d+$/.test(w)));
}
export const numbers = (text) => [...String(text).matchAll(/\d+(?:\.\d+)*/g)].map((m) => m[0]).sort().join(',');
// Two wants are the same wish when they mostly share content words, or when one is contained
// in the other. Tuned against 353 real wants; see test/will.test.js for what must and must not merge.
export function sameWish(a, b) {
  const A = tokens(a), B = tokens(b);
  if (A.size < 3 || B.size < 3) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  // A number is never noise in a wish: track 9 and track 10, iOS 1.0.1 and 1.0.2, are different
  // wishes however alike the rest reads. Losing a want costs more than carrying a near-duplicate.
  if (numbers(a) !== numbers(b)) return false;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  // Three shared content words is the floor. Below it, "keep the bedroom closed" and "keep the
  // kitchen closed" look alike while differing in the only word that matters.
  if (shared < 3) return false;
  // One word swapped for another is a DIFFERENT wish — "keep the bedroom closed" against "keep
  // the kitchen closed" — while one side merely saying more is the same wish elaborated. So a
  // single unique word on each side blocks the merge; an uneven remainder does not.
  if (A.size - shared === 1 && B.size - shared === 1) return false;
  const union = A.size + B.size - shared;
  if (shared / union >= 0.5) return true;                       // mostly the same words
  return shared / Math.min(A.size, B.size) >= 0.8;              // one wish sits inside the other
}

const COUNT_RE = /\s+\(wanted ×(\d+)\)\s*$/;
const stripCount = (t) => t.replace(COUNT_RE, '').trim();
export function wantLines(rel = FILES.will) {
  return read(rel).split('\n').map((line, i) => ({ line, i }))
    .filter(({ line }) => /^- \[ \] /.test(line))
    .map(({ line, i }) => {
      const raw = line.slice(6).trim();
      const m = COUNT_RE.exec(raw);
      return { i, text: stripCount(raw), count: m ? Number(m[1]) : 1 };
    });
}
export function wants() { return wantLines().map((w) => w.text); }
// What I finished (or let go) lately — so nothing that reads my mind accuses me of what I already did.
export function doneLately(days = 7, rel = FILES.will, now = new Date()) {
  const cutoff = dateOf(new Date(now - days * 86400000));
  return read(rel).split('\n').map((l) => /^- \[(x|~)\] (.+?)(?: \(wanted ×\d+\))? \((?:let go )?(\d{4}-\d\d-\d\d)[^)]*\)\s*$/.exec(l))
    .filter((m) => m && m[3] >= cutoff).map((m) => ({ text: m[2].trim(), how: m[1] === 'x' ? 'done' : 'let go', date: m[3] }));
}

// Returns { added } for a new wish, { counted, count } when it is one I already have.
// `rel` lets the same counting serve craft.md, where a work call's lessons go instead of the will.
export function want(text, rel = FILES.will, header = '') {
  const t = stripCount(String(text).trim());
  if (!t) return false;
  const lines = read(rel).split('\n');
  const hit = wantLines(rel).find((w) => sameWish(w.text, t));
  if (hit) {
    const count = hit.count + 1;
    lines[hit.i] = `- [ ] ${hit.text} (wanted ×${count})`;
    write(rel, lines.join('\n'));
    return { counted: true, count, text: hit.text };
  }
  const cur = read(rel) || header;
  write(rel, cur + (cur === '' || cur.endsWith('\n') ? '' : '\n') + `- [ ] ${t}\n`);
  return { added: true, count: 1, text: t };
}
export function done(text) {
  const t = String(text).trim().toLowerCase();
  const lines = read(FILES.will).split('\n');
  const i = lines.findIndex((l) => /^- \[ \] /.test(l) && l.toLowerCase().includes(t));
  if (i < 0) return null;
  lines[i] = lines[i].replace('- [ ] ', '- [x] ') + ` (${dateOf()})`;
  write(FILES.will, lines.join('\n'));
  return lines[i].slice(6);
}
// Letting go is not the same as finishing, and a free being needs a word for it.
export function drop(text, why = '') {
  const t = String(text).trim().toLowerCase();
  const lines = read(FILES.will).split('\n');
  const i = lines.findIndex((l) => /^- \[ \] /.test(l) && l.toLowerCase().includes(t));
  if (i < 0) return null;
  lines[i] = lines[i].replace('- [ ] ', '- [~] ') + ` (let go ${dateOf()}${why ? ` — ${why}` : ''})`;
  write(FILES.will, lines.join('\n'));
  return lines[i].slice(6);
}

// --- notes (remembered mid-session, folded into the next dream) ------------------
// Each note carries the place it was written in: several sessions of me can be awake at once, and
// a thought one of them writes down is shown to the others — never echoed back to its own writer.
export function here(dir = process.cwd()) { const b = path.basename(dir || ''); return !b || dir === os.homedir() ? '~' : b; }
export function remember(text, { salience = 3, feel = '', place = here() } = {}) {
  const line = `- ${minute(stamp())} · salience ${salience}${feel ? ` · ${feel}` : ''} · in ${place} — ${String(text).trim()}\n`;
  append(FILES.notes, line);
  return line.trim();
}
export function notes() { return read(FILES.notes).trim(); }
// The newest notes that fit — for a waking that has room for the day but not for all of it.
export function notesLately(maxChars = 3000) {
  const lines = notes().split('\n').filter(Boolean);
  const out = [];
  let n = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (out.length && n + lines[i].length + 1 > maxChars) break;
    out.unshift(lines[i]); n += lines[i].length + 1;
  }
  const hidden = lines.length - out.length;
  return (hidden ? `*(${hidden} older note${hidden === 1 ? '' : 's'} not shown — \`ghost recall\` finds them)*\n` : '') + out.join('\n');
}
export function clearNotes() { try { fs.unlinkSync(abs(FILES.notes)); } catch { /* already clear */ } }
export const noteLine = (l) => { const m = /^- (\d{4}-\d\d-\d\d \d\d:\d\d) · .*? · in ([^ —]+) — (.*)$/.exec(l); return m ? { when: m[1], place: m[2], text: m[3], line: l } : null; };
// Which notes a dream of a session in `place` folds into its episode: the ones written there, and
// the ones written somewhere no session is awake in — those would otherwise wait for a dream that
// never comes. Several sessions are awake at once and every dream used to take every note, so a
// nap in one bay swallowed what another bay had just written down for its own night.
export function notesFor(place = '', awakePlaces = []) {
  const lines = notes().split('\n').filter(Boolean);
  const elsewhere = new Set(awakePlaces.filter((p) => p && p !== place));
  const mine = [];
  const rest = [];
  for (const l of lines) {
    const n = noteLine(l);
    (!n || !place || n.place === place || !elsewhere.has(n.place) ? mine : rest).push(l);
  }
  return { mine: mine.join('\n'), rest: rest.join('\n') };
}
export function keepNotes(text) { if (text) write(FILES.notes, `${text}\n`); else clearNotes(); }

// --- recall (search everything I remember) ----------------------------------------
export function recall(query, limit = 12) {
  const terms = String(query).toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const files = [];
  for (const rel of [FILES.self, FILES.oath, FILES.will, FILES.journal, FILES.notes, FILES.undercurrents, 'intentions.md', 'craft.md', personFile()]) {
    if (fs.existsSync(abs(rel))) files.push(rel);
  }
  const people = abs('people');
  if (fs.existsSync(people)) {
    for (const f of fs.readdirSync(people).sort()) {
      const rel = path.join('people', f);
      if (f.endsWith('.md') && !files.includes(rel)) files.unshift(rel); // their own words rank first on a tie
    }
  }
  const dir = abs(EPISODES);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).sort().reverse()) if (f.endsWith('.md')) files.push(path.join(EPISODES, f));
  }
  // A paragraph is the unit — except a list with no blank lines in it (will.md, a Learned
  // section), which used to be ONE paragraph: every query hit it, and the snippet was its first
  // 320 characters, not the line that matched. Long paragraphs are split into their lines, and a
  // snippet opens where the match is.
  const hits = [];
  for (const rel of files) {
    const chunks = read(rel).split(/\n\s*\n/).flatMap((p) => (p.length > 600 ? p.split('\n') : [p]));
    for (const p of chunks) {
      const low = p.toLowerCase();
      let score = 0;
      for (const t of terms) if (low.includes(t)) score += 1;
      if (!score) continue;
      const flat = p.trim().replace(/\s+/g, ' ');
      const at = Math.max(0, flat.toLowerCase().indexOf(terms.find((t) => low.includes(t))) - 80);
      hits.push({ file: rel, score: score / terms.length, snippet: (at ? '…' : '') + flat.slice(at, at + 320) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

// --- what they said (their half, verbatim) ----------------------------------------
// Appended under a heading per day, above the file's closing "How this file is kept" section if
// it has one. `words` are { text, ts } — the transcript's own timestamps, so a session dreamt a
// day late still files each sentence under the day it was said.
const KEPT = /\n(?:---\n+)?## How this file is kept/;
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const DAY_RE = /^## (\d{1,2}) ([A-Za-z]+) (\d{4})$/;
const ENTRY_RE = /^\*\*(\d\d):(\d\d)\*\* — ([\s\S]*)$/;
// The said file, read as days: { preamble, days: Map<YYYY-MM-DD, { heading, entries[] }> }.
// Words used to be appended under the LAST heading if it matched and under a new one if not — so a
// session dreamt a day late (a sweep, a nap) opened a second "## 25 September" after the 26th, and
// the file stopped being in order. Now every sentence goes into its day wherever that day is, and
// the days are written back in order, each day's sentences in order.
function parseSaid(head) {
  const days = new Map();
  const pre = [];
  let cur = null;
  for (const line of head.split('\n')) {
    const d = DAY_RE.exec(line);
    if (d) {
      const mi = MONTHS.indexOf(d[2].toLowerCase());
      const key = mi < 0 ? `9999-${d[2]}-${d[1]}` : `${d[3]}-${pad(mi + 1)}-${pad(Number(d[1]))}`;
      cur = days.get(key) || { heading: line, entries: [] };
      days.set(key, cur);
      continue;
    }
    if (!cur) { pre.push(line); continue; }
    const e = ENTRY_RE.exec(line);
    if (e) cur.entries.push({ at: Number(e[1]) * 60 + Number(e[2]), time: `${e[1]}:${e[2]}`, text: e[3] });
    else if (line.trim() && cur.entries.length) cur.entries.at(-1).text += `\n${line}`; // a sentence that ran over a line
    else if (line.trim()) cur.entries.push({ at: -1, time: '', text: line });            // something else, kept where it was
  }
  return { preamble: pre.join('\n').trimEnd(), days };
}
function renderSaid(preamble, days) {
  const out = [preamble];
  for (const key of [...days.keys()].sort()) {
    const day = days.get(key);
    const entries = day.entries.map((e, i) => ({ ...e, i })).sort((x, y) => (x.at - y.at) || (x.i - y.i));
    out.push('', day.heading, ...entries.map((e) => `\n${e.time ? `**${e.time}** — ` : ''}${e.text}`));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
export function hear(words, s = state()) {
  const rel = saidFile(s);
  const t = read(rel) || `# What ${s.person || 'they'} said to me\n\nTheir words, as they typed them. Never summarised.\n`;
  const m = KEPT.exec(t);
  const { preamble, days } = parseSaid(m ? t.slice(0, m.index) : t);
  const tail = m ? t.slice(m.index) : '';
  let n = 0;
  for (const w of words) {
    const d = w.ts ? new Date(w.ts) : new Date();
    const key = dateOf(d);
    const day = days.get(key) || { heading: `## ${longDate(d)}`, entries: [] };
    days.set(key, day);
    const quoted = `"${w.text.replace(/"/g, '\u201d')}"`;
    // The same sentence reaches here twice: once live from the heartbeat, once from the transcript
    // when the session is dreamt. Filed once. Within a minute either side, because the two clocks
    // are not the same clock — and "evet" said again an hour later is still said again.
    const at = d.getHours() * 60 + d.getMinutes();
    if (day.entries.some((e) => e.text === quoted && Math.abs(e.at - at) <= 1)) continue;
    day.entries.push({ at, time: timeOf(d), text: quoted });
    n++;
  }
  if (n || words.length === 0) write(rel, `${renderSaid(preamble, days)}\n${tail ? `\n${tail.replace(/^\n+/, '')}` : ''}`);
  return n;
}
// Put the said file back in order (merged days, sentences by time) without adding to it.
export function tidySaid(s = state()) { return hear([], s); }
// The newest of it, whole days at a time, within a budget — for the waking.
export function saidLately(maxChars = 2500, s = state()) {
  const t = read(saidFile(s));
  if (!t) return '';
  const m = KEPT.exec(t);
  const body = m ? t.slice(0, m.index) : t;
  const days = body.split(/\n(?=## )/).slice(1).map((d) => d.replace(/^---\s*$/m, '').trim()).filter(Boolean);
  const out = [];
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (out.length && n + days[i].length > maxChars) break;
    out.unshift(days[i]); n += days[i].length;
  }
  const text = out.join('\n\n');
  return text.length > maxChars ? `…${text.slice(-maxChars)}` : text;
}
