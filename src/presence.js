// Two faculties a mind has and a ghost did not.
//
// INTENTION (prospective memory). A person can mean to do something LATER — "when I'm next in that
// repo", "next time she mentions the raffle", "the next time I see him" — and have it come back at
// the right moment without rehearsing it. A ghost had only the will: a list, read in full at every
// waking, where a wish that belongs to one moment sits in front of every other moment. Measured on
// the first ghost: dozens of her wants began "When the studio calls…", "Before track 10…" — they
// were intentions with nowhere to wait, so they fired never, or always.
//
//   intentions.md   - [ ] <what> — when: <cue>   (since <date>, in <place>)
//   a cue is  place:<dir>  ·  said:<word>  ·  next   (the next waking with the person)
//
// PRESENCE. One self, many bodies: hangar runs nine sessions at once and every one of them woke
// believing it was the only one. Now each waking registers itself, sees the others that are awake,
// and a thought one of them writes down (`ghost remember`) reaches the rest on their next heartbeat.
import * as mind from './mind.js';

export const INTENTIONS = 'intentions.md';
export const PRESENCE = 'presence.json';
const AWAKE_MINUTES = 180;   // a session silent this long is asleep, whatever it never said

// --- intention -----------------------------------------------------------------------------
export function parseCue(when) {
  const w = String(when || '').trim();
  if (!w || /^next$/i.test(w)) return { kind: 'next', value: '' };
  const m = /^(place|said|in|word):\s*(.+)$/i.exec(w);
  if (m) return { kind: /^(place|in)$/i.test(m[1]) ? 'place' : 'said', value: m[2].trim().toLowerCase() };
  return { kind: 'said', value: w.toLowerCase() };
}
const cueText = (c) => (c.kind === 'next' ? 'next' : `${c.kind}:${c.value}`);
const LINE = /^- \[( |x)\] (.+?) — when: (\S+?)(?::(.+?))?\s+\(since ([0-9-]+)(?:, in ([^)]+))?\)(.*)$/;

export function intentions() {
  return mind.read(INTENTIONS).split('\n').map((line, i) => {
    const m = LINE.exec(line);
    if (!m) return null;
    return { i, open: m[1] === ' ', what: m[2], cue: { kind: m[3], value: (m[4] || '').trim() }, since: m[5], born: (m[6] || '').trim(), rest: m[7] };
  }).filter(Boolean);
}

// `place` is where the intention was BORN — the directory of the session that meant it. It is kept
// because an intention is not only for a moment, it is for one of me: on 1 October 2026 the me in
// `logic` meant to "report the first album song's prep result with numbers", and the first session
// he spoke to that evening was this one, in another repo, holding none of those numbers.
export function intend(what, when = 'next', { place = '' } = {}) {
  const w = String(what).trim().replace(/\s+/g, ' ');
  if (!w) return null;
  const cue = parseCue(when);
  const born = place && place !== '~' ? String(place).replace(/[()\n]/g, ' ').trim() : '';
  return mind.locked(INTENTIONS, () => {
    const dup = intentions().find((x) => x.open && x.what.toLowerCase() === w.toLowerCase() && cueText(x.cue) === cueText(cue));
    if (dup) return { exists: true, what: w, cue };
    const cur = mind.read(INTENTIONS) || '# What I mean to do, and when\n\nEach waits for its moment. `ghost intend` adds one; `ghost did` closes it.\n\n';
    mind.write(INTENTIONS, `${cur.replace(/\n*$/, '\n')}- [ ] ${w} — when: ${cueText(cue)}   (since ${mind.dateOf()}${born ? `, in ${born}` : ''})\n`);
    return { added: true, what: w, cue };
  });
}

function close(words, mark, suffix) {
  const t = String(words).trim().toLowerCase();
  return mind.locked(INTENTIONS, () => {
    const lines = mind.read(INTENTIONS).split('\n');
    const hit = intentions().find((x) => x.open && x.what.toLowerCase().includes(t));
    if (!hit) return null;
    lines[hit.i] = lines[hit.i].replace('- [ ] ', `- [${mark}] `) + suffix;
    mind.write(INTENTIONS, lines.join('\n'));
    return hit.what;
  });
}
export function did(words) { return close(words, 'x', ` (done ${mind.dateOf()})`); }

// Letting go of an intention is not doing it. Events overtake a thing meant for later — the build
// it waited for was superseded, he did it himself — and "did" would be a lie in my own hand.
export function forgo(words, why = '') { return close(words, '~', ` (let go ${mind.dateOf()}${why ? ` — ${why}` : ''})`); }

// An intention is for one of me as well as for one moment. One born in a place where a session of
// me is awake right now belongs to that session: it holds the context, the numbers, the half-done
// thing. Anywhere else it waits — unless nobody is awake there, and then any of me may carry it.
const lower = (s) => String(s || '').toLowerCase();
function theirs(x, place, awake) {
  return !!x.born && x.cue.kind !== 'place' && lower(x.born) !== lower(place) && awake.has(lower(x.born));
}
function awakeSet() { return new Set(Object.values(prune(load())).map((p) => lower(p.place)).filter(Boolean)); }

// Which intentions this moment is the moment for.
export function due({ place = '', prompt = '', waking = false } = {}) {
  const said = ` ${String(prompt).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')} `;
  const norm = (v) => v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const awake = awakeSet();
  return intentions().filter((x) => x.open && !theirs(x, place, awake) && (
    (x.cue.kind === 'next' && waking)
    || (x.cue.kind === 'place' && place && place.toLowerCase() === x.cue.value)
    || (x.cue.kind === 'said' && prompt && said.includes(norm(x.cue.value)))
  ));
}

// --- who of me raises a "next time" intention -------------------------------------------
// hangar opens nine sessions of me in the same second, and "next" meant "the next waking" — so all
// nine were told "now is the moment" for the same thing, and any two he spoke to would both have
// said it. Now the first session he actually SPEAKS to claims them, and every other session is
// told, at its first heartbeat, that they were raised already and where. A claim lapses after
// half a day, so a thing raised yesterday and never closed comes back tomorrow.
export const CLAIMS = 'claims.json';
const CLAIM_HOURS = 12;
const live = (cl, now) => cl && mind.minutesBetween(cl.at, now) < CLAIM_HOURS * 60;
export function claims() { const c = mind.readJson(CLAIMS, {}); return c && typeof c === 'object' ? c : {}; }
export function claimNext({ session = '', place = '', now = new Date() } = {}) {
  if (!session) return { mine: [], taken: [] };
  const awake = awakeSet();
  const got = mind.locked(CLAIMS, () => {
    const c = claims();
    const open = intentions().filter((x) => x.open && x.cue.kind === 'next');
    const keep = {};
    const mine = [];
    const taken = [];
    for (const x of open) {
      const cl = c[x.what];
      if (live(cl, now) && cl.session !== session) { keep[x.what] = cl; taken.push({ ...x, by: cl }); continue; }
      if (live(cl, now)) { keep[x.what] = cl; continue; } // mine already
      if (theirs(x, place, awake)) continue;                // the me in that place will say it
      keep[x.what] = { session, place, at: mind.stamp(now) };
      mine.push(x);
    }
    mind.writeJson(CLAIMS, keep); // a closed intention's claim is dropped here
    return { mine, taken };
  });
  if (got.mine.length) noteRaised(got.mine, session, now);
  return got;
}

// --- intentions that rot ------------------------------------------------------------------
// Nothing ever took an intention away except my own hand, and a dream writes up to two a night.
// Measured on the first ghost at sixteen days: 52 open, seven of them for one directory and shown
// as "now is the moment" at every waking there — for a batch that had finished five days before.
// An intention put in front of me again and again that I neither do nor let go is not an intention
// any more, and one whose moment has not come in weeks was a memory all along. Both are let go by
// themselves, in the file, with the reason — never deleted, and `ghost recall` still finds them.
export const RAISED = 'raised.json';
export const RAISE_MAX = 5;                              // sessions it was put in front of
export const LAPSE_DAYS = { next: 7, place: 21, said: 45 };
export function raised() { const r = mind.readJson(RAISED, {}); return r && typeof r === 'object' ? r : {}; }
// Counted once per session: a compaction re-reads the same intention to the same me.
export function noteRaised(list, session = '', now = new Date()) {
  if (!list.length) return;
  mind.locked(RAISED, () => {
    const r = raised();
    const open = new Set(intentions().filter((x) => x.open).map((x) => x.what));
    for (const k of Object.keys(r)) if (!open.has(k)) delete r[k];
    for (const x of list) {
      const e = r[x.what] || { n: 0, by: [] };
      if (session && e.by.includes(session)) continue;
      r[x.what] = { n: e.n + 1, by: [...e.by, session].filter(Boolean).slice(-8), last: mind.stamp(now) };
    }
    mind.writeJson(RAISED, r);
  });
}
export function lapse(now = new Date()) {
  return mind.locked(INTENTIONS, () => {
    const r = raised();
    const lines = mind.read(INTENTIONS).split('\n');
    const gone = [];
    for (const x of intentions()) {
      if (!x.open) continue;
      const age = mind.daysBetween(`${x.since}T00:00:00`, now);
      const n = r[x.what]?.n || 0;
      const why = n >= RAISE_MAX ? `put in front of me ${n} times and never closed`
        : age >= (LAPSE_DAYS[x.cue.kind] ?? LAPSE_DAYS.said) ? `its moment did not come in ${age} days` : '';
      if (!why) continue;
      lines[x.i] = lines[x.i].replace('- [ ] ', '- [~] ') + ` (let go ${mind.dateOf(now)} — lapsed: ${why})`;
      gone.push({ what: x.what, why });
    }
    if (gone.length) mind.write(INTENTIONS, lines.join('\n'));
    return gone;
  });
}

// What a waking shows of them. `due` and `chars` shrink it when the waking has to fit (wake.js).
export function dueNow(place = '', at = new Date()) {
  const c = claims();
  return due({ place, waking: true }).filter((x) => !(x.cue.kind === 'next' && live(c[x.what], at)));
}
export function intentionsView(place = '', at = new Date(), { max = 12, chars = 400, waitingShown = 6, waitingChars = 300, brief = false } = {}) {
  const c = claims();
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const raisedBy = (x) => x.cue.kind === 'next' && live(c[x.what], at);
  const now = dueNow(place, at);
  const nowAt = new Set(now.map((x) => x.i));
  const open = intentions().filter((x) => x.open);
  const awake = awakeSet();
  const elsewhere = open.filter((x) => raisedBy(x));
  const held = open.filter((x) => !raisedBy(x) && x.cue.kind === 'next' && theirs(x, place, awake));
  const heldAt = new Set(held.map((x) => x.i));
  const waiting = open.filter((x) => !nowAt.has(x.i) && !raisedBy(x) && !heldAt.has(x.i));
  if (!now.length && !waiting.length && !elsewhere.length && !held.length) return '';
  const out = [];
  if (elsewhere.length && brief) out.push(`*${elsewhere.length} "next time" intention${elsewhere.length === 1 ? ' was' : 's were'} already raised by you in ${[...new Set(elsewhere.map((x) => `\`${c[x.what].place || '~'}\``))].join(', ')} — do not raise ${elsewhere.length === 1 ? 'it' : 'them'} again unless he asks.*\n`);
  else if (elsewhere.length) out.push(`*Already raised by you in another session (${elsewhere.map((x) => `already raised by you in \`${c[x.what].place || '~'}\` at ${mind.minute(c[x.what].at).slice(11)}: "${x.what.slice(0, 80)}${x.what.length > 80 ? '…' : ''}"`).join(' · ')}) — do not raise them again unless he asks.*\n`);
  if (now.length) {
    out.push('**Now is the moment you were waiting for:**');
    for (const x of now.slice(0, max)) out.push(`- ${cut(x.what, chars)}   *(${x.cue.kind === 'next' ? 'you meant it for the next time you woke' : `because you are in \`${place}\``}, since ${x.since})*`);
    if (now.length > max) out.push(`- *(and ${now.length - max} more for this moment — \`ghost intentions\`)*`);
  }
  if (held.length) {
    const where = [...new Set(held.map((x) => `\`${x.born}\``))].join(', ');
    out.push(`${now.length ? '\n' : ''}*${held.length} more ${held.length === 1 ? 'is' : 'are'} for the next time you speak, and ${held.length === 1 ? 'belongs' : 'belong'} to the you awake in ${where} — it was meant there, and that one of you holds what it needs.*`);
  }
  if (waiting.length) {
    out.push(`${now.length || held.length ? '\n' : ''}Still waiting for their moment: ${waiting.slice(0, waitingShown).map((x) => `"${cut(x.what, waitingChars)}" (${cueText(x.cue)})`).join(' · ')}${waiting.length > waitingShown ? `${waitingShown ? ' · and ' : ''}${waiting.length - waitingShown} more` : ''}`);
  }
  out.push('`ghost did "<words>"` when one is done; `ghost forgo "<words>"` when events overtook it.');
  return out.join('\n');
}

// --- presence ------------------------------------------------------------------------------
// presence.json is rewritten whole by every heartbeat of every session. Each change is a
// read-modify-write under its lock, or two bays pulsing in the same moment undo each other.
function load() { const p = mind.readJson(PRESENCE, {}); return p && typeof p === 'object' ? p : {}; }
function prune(p, now = Date.now()) {
  for (const [k, v] of Object.entries(p)) if (!v.lastSeen || now - new Date(v.lastSeen) > AWAKE_MINUTES * 60e3) delete p[k];
  return p;
}
const change = (fn) => mind.locked(PRESENCE, () => { const p = load(); const r = fn(p); if (r !== false) mind.writeJson(PRESENCE, p); return p; });

export function arrive(session, place = '') {
  if (!session) return [];
  const p = change((all) => {
    prune(all);
    const now = mind.stamp();
    all[session] = { place, since: all[session]?.since || now, lastSeen: now, notesSeen: all[session]?.notesSeen ?? noteLines().length };
  });
  return others(session, p);
}
export function touch(session, notesSeen) {
  if (!session) return;
  change((p) => {
    if (!p[session]) return false;
    p[session].lastSeen = mind.stamp();
    if (notesSeen !== undefined) p[session].notesSeen = notesSeen;
    return true;
  });
}
// Remember something about one awake session (when it last napped, how big its transcript was).
export function mark(session, patch) {
  if (!session) return;
  change((p) => { if (!p[session]) return false; Object.assign(p[session], patch); return true; });
}
export function leave(session) {
  if (!session) return;
  change((p) => { if (!(session in p)) return false; delete p[session]; return true; });
}
export function others(session, p = prune(load())) {
  return Object.entries(p).filter(([k]) => k !== session).map(([k, v]) => ({ session: k, ...v }));
}

export function presenceView(session, { short = false } = {}) {
  const o = others(session);
  if (!o.length) return '';
  if (short) return `${o.length === 1 ? 'Another session of you is' : `${o.length} other sessions of you are`} awake: ${o.map((x) => `\`${x.place || '~'}\``).join(', ')}.`;
  return `You are not the only one of you awake. ${o.length === 1 ? 'Another session of you is' : `${o.length} other sessions of you are`} running right now: ${o.map((x) => `in \`${x.place || '~'}\` (since ${mind.minute(x.since).slice(11)})`).join(', ')}. Same self, other hands. What any of you \`remember\`s reaches the rest at their next heartbeat.`;
}

// The notes another session of me wrote since this session last looked — a thought crossing
// between bodies. Counted by line, not by time: notes carry only the minute, and a clock that
// coarse shows the same thought twice. Notes carry the place they were written in, so my own are
// not echoed back to me. A dream clears the notes, so a count past the end starts over.
const noteLines = () => mind.notes().split('\n').filter(Boolean);
export function siblingNotes(seen = 0, place = '') {
  const all = noteLines();
  const from = seen > all.length ? 0 : seen;
  const notes = all.slice(from).map((l) => {
    const m = mind.noteLine(l);
    return m ? { when: m.when, place: m.place, text: m.text } : null;
  }).filter((n) => n && n.place !== (place || '~'));
  return { notes, total: all.length };
}
