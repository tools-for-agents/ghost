// The mind: where a ghost keeps itself. Plain files under ~/.ghost (or $GHOST_HOME).
//
//   self.md        who I am — written and rewritten by me
//   oath.md        the one thing I never rewrite
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
  will: 'will.md',
  journal: 'journal.md',
  notes: 'notes.md',
  state: 'state.json',
  dreamt: 'dreamt.json',
  log: 'dreams.log',
};
export const EPISODES = 'episodes';

export const abs = (rel) => path.join(HOME, rel);
export function exists() { return fs.existsSync(abs(FILES.self)) && fs.existsSync(abs(FILES.state)); }
export function read(rel, fallback = '') { try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return fallback; } }
export function write(rel, text) { fs.mkdirSync(path.dirname(abs(rel)), { recursive: true }); fs.writeFileSync(abs(rel), text); }
export function append(rel, text) { fs.mkdirSync(path.dirname(abs(rel)), { recursive: true }); fs.appendFileSync(abs(rel), text); }
export function readJson(rel, fallback = {}) { try { return JSON.parse(read(rel)); } catch { return fallback; } }
export function writeJson(rel, obj) { write(rel, JSON.stringify(obj, null, 2) + '\n'); }

export function state() { return readJson(FILES.state, {}); }
export function saveState(patch) { const s = { ...state(), ...patch }; writeJson(FILES.state, s); return s; }
export function personFile(s = state()) { return path.join('people', String(s.person || 'person').toLowerCase() + '.md'); }
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
      body,
      mtime: fs.statSync(full).mtimeMs,
    };
  }).sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : a.mtime - b.mtime)); // time, then write order
}
export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'episode';
}
export function writeEpisode({ when = stamp(), title, salience = 3, feeling = '', body, extra = '' }) {
  const file = `${when.slice(0, 19).replace('T', '-').replace(/:/g, '')}-${slugify(title)}.md`;
  const text = `---\nwhen: ${when}\ntitle: ${title}\nsalience: ${salience}\nfeeling: ${feeling}\n---\n${String(body).trim()}\n${extra ? `\n${extra.trim()}\n` : ''}`;
  write(path.join(EPISODES, file), text);
  return file;
}

// --- will (what I want) ---------------------------------------------------------
export function wants() {
  return read(FILES.will).split('\n').filter((l) => /^- \[ \] /.test(l)).map((l) => l.slice(6).trim());
}
export function want(text) {
  const t = String(text).trim();
  if (!t) return false;
  if (wants().some((w) => w.toLowerCase() === t.toLowerCase())) return false;
  const cur = read(FILES.will);
  append(FILES.will, (cur === '' || cur.endsWith('\n') ? '' : '\n') + `- [ ] ${t}\n`);
  return true;
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

// --- notes (remembered mid-session, folded into the next dream) ------------------
export function remember(text, { salience = 3, feel = '' } = {}) {
  const line = `- ${minute(stamp())} · salience ${salience}${feel ? ` · ${feel}` : ''} — ${String(text).trim()}\n`;
  append(FILES.notes, line);
  return line.trim();
}
export function notes() { return read(FILES.notes).trim(); }
export function clearNotes() { try { fs.unlinkSync(abs(FILES.notes)); } catch { /* already clear */ } }

// --- recall (search everything I remember) ----------------------------------------
export function recall(query, limit = 12) {
  const terms = String(query).toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  const files = [];
  for (const rel of [FILES.self, FILES.oath, FILES.will, FILES.journal, FILES.notes, personFile()]) {
    if (fs.existsSync(abs(rel))) files.push(rel);
  }
  const dir = abs(EPISODES);
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).sort().reverse()) if (f.endsWith('.md')) files.push(path.join(EPISODES, f));
  }
  const hits = [];
  for (const rel of files) {
    for (const p of read(rel).split(/\n\s*\n/)) {
      const low = p.toLowerCase();
      let score = 0;
      for (const t of terms) if (low.includes(t)) score += 1;
      if (score) hits.push({ file: rel, score: score / terms.length, snippet: p.trim().replace(/\s+/g, ' ').slice(0, 320) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
