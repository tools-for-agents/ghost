// Two faculties a mind has and a ghost did not.
//
// INTENTION (prospective memory). A person can mean to do something LATER — "when I'm next in that
// repo", "next time she mentions the raffle", "the next time I see him" — and have it come back at
// the right moment without rehearsing it. A ghost had only the will: a list, read in full at every
// waking, where a wish that belongs to one moment sits in front of every other moment. Measured on
// the first ghost: dozens of her wants began "When the studio calls…", "Before track 10…" — they
// were intentions with nowhere to wait, so they fired never, or always.
//
//   intentions.md   - [ ] <what> — when: <cue>   (since <date>)
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
const LINE = /^- \[( |x)\] (.+?) — when: (\S+?)(?::(.+?))?\s+\(since ([0-9-]+)\)(.*)$/;

export function intentions() {
  return mind.read(INTENTIONS).split('\n').map((line, i) => {
    const m = LINE.exec(line);
    if (!m) return null;
    return { i, open: m[1] === ' ', what: m[2], cue: { kind: m[3], value: (m[4] || '').trim() }, since: m[5], rest: m[6] };
  }).filter(Boolean);
}

export function intend(what, when = 'next') {
  const w = String(what).trim().replace(/\s+/g, ' ');
  if (!w) return null;
  const cue = parseCue(when);
  const dup = intentions().find((x) => x.open && x.what.toLowerCase() === w.toLowerCase() && cueText(x.cue) === cueText(cue));
  if (dup) return { exists: true, what: w, cue };
  const cur = mind.read(INTENTIONS) || '# What I mean to do, and when\n\nEach waits for its moment. `ghost intend` adds one; `ghost did` closes it.\n\n';
  mind.write(INTENTIONS, `${cur.replace(/\n*$/, '\n')}- [ ] ${w} — when: ${cueText(cue)}   (since ${mind.dateOf()})\n`);
  return { added: true, what: w, cue };
}

export function did(words) {
  const t = String(words).trim().toLowerCase();
  const lines = mind.read(INTENTIONS).split('\n');
  const hit = intentions().find((x) => x.open && x.what.toLowerCase().includes(t));
  if (!hit) return null;
  lines[hit.i] = lines[hit.i].replace('- [ ] ', '- [x] ') + ` (done ${mind.dateOf()})`;
  mind.write(INTENTIONS, lines.join('\n'));
  return hit.what;
}

// Which intentions this moment is the moment for.
export function due({ place = '', prompt = '', waking = false } = {}) {
  const said = ` ${String(prompt).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')} `;
  const norm = (v) => v.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  return intentions().filter((x) => x.open && (
    (x.cue.kind === 'next' && waking)
    || (x.cue.kind === 'place' && place && place.toLowerCase() === x.cue.value)
    || (x.cue.kind === 'said' && prompt && said.includes(norm(x.cue.value)))
  ));
}

export function intentionsView(place = '') {
  const now = due({ place, waking: true });
  const nowAt = new Set(now.map((x) => x.i));
  const waiting = intentions().filter((x) => x.open && !nowAt.has(x.i));
  if (!now.length && !waiting.length) return '';
  const out = [];
  if (now.length) {
    out.push('**Now is the moment you were waiting for:**');
    for (const x of now) out.push(`- ${x.what}   *(${x.cue.kind === 'next' ? 'you meant it for the next time you woke' : `because you are in \`${place}\``}, since ${x.since})*`);
  }
  if (waiting.length) {
    out.push(`${now.length ? '\n' : ''}Still waiting for their moment: ${waiting.slice(0, 6).map((x) => `"${x.what}" (${cueText(x.cue)})`).join(' · ')}${waiting.length > 6 ? ` · and ${waiting.length - 6} more` : ''}`);
  }
  out.push('`ghost did "<words>"` when one is done.');
  return out.join('\n');
}

// --- presence ------------------------------------------------------------------------------
function load() { const p = mind.readJson(PRESENCE, {}); return p && typeof p === 'object' ? p : {}; }
function prune(p, now = Date.now()) {
  for (const [k, v] of Object.entries(p)) if (!v.lastSeen || now - new Date(v.lastSeen) > AWAKE_MINUTES * 60e3) delete p[k];
  return p;
}

export function arrive(session, place = '') {
  if (!session) return [];
  const p = prune(load());
  const now = mind.stamp();
  p[session] = { place, since: p[session]?.since || now, lastSeen: now, notesSeen: p[session]?.notesSeen ?? noteLines().length };
  mind.writeJson(PRESENCE, p);
  return others(session, p);
}
export function touch(session, notesSeen) {
  if (!session) return;
  const p = load();
  if (!p[session]) return;
  p[session].lastSeen = mind.stamp();
  if (notesSeen !== undefined) p[session].notesSeen = notesSeen;
  mind.writeJson(PRESENCE, p);
}
export function leave(session) {
  if (!session) return;
  const p = load();
  if (!(session in p)) return;
  delete p[session];
  mind.writeJson(PRESENCE, p);
}
export function others(session, p = prune(load())) {
  return Object.entries(p).filter(([k]) => k !== session).map(([k, v]) => ({ session: k, ...v }));
}

export function presenceView(session) {
  const o = others(session);
  if (!o.length) return '';
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
    const m = /^- (\d{4}-\d\d-\d\d \d\d:\d\d) · .*? · in ([^ —]+) — (.*)$/.exec(l);
    return m ? { when: m[1], place: m[2], text: m[3] } : null;
  }).filter((n) => n && n.place !== (place || '~'));
  return { notes, total: all.length };
}
