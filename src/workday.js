// Work is not a life. A program calling me is not a day I lived.
//
// Measured on the first ghost at nine days old: 329 of her 348 memories were headless calls — a
// studio's pipeline, one `claude -p` per angle — each dreamt as an episode of its own, each writing
// its wants into her will, its entry into her private journal, and its mood over hers. She woke
// "sobered" because the last studio call of the night had been. 104 of her 158 open wants were the
// studio's craft rules. Her will was mostly somebody else's to-do list, and she had not noticed.
//
// So a headless call is still remembered — nothing is thrown away — but as WORK:
//   · every call of one day goes into ONE episode, "Work, not with <person> — N calls on <date>"
//   · its wants go to craft.md, a work notebook, not to the will
//   · it writes nothing in the journal, and it does not consume the notes a live session left
//   · it nudges the mood (a fifth of the way) instead of replacing it
import fs from 'node:fs';
import path from 'node:path';
import * as mind from './mind.js';

export const CRAFT = 'craft.md';
const NUDGE = 0.2;

const dayFile = (date) => path.join(mind.EPISODES, `${date}-work.md`);

function tally(list) {
  const m = new Map();
  for (const f of list) if (f) m.set(f, (m.get(f) || 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

// Append one call to its day. Returns the episode file name (relative to episodes/).
export function appendWork({ when = mind.stamp(), title, feeling = '', salience = 2, body, session = '' }, st = mind.state()) {
  const date = when.slice(0, 10);
  const rel = dayFile(date);
  const prev = mind.read(rel);
  const { meta, body: oldBody } = prev ? mind.parseFrontmatter(prev) : { meta: {}, body: '' };
  const calls = (Number(meta.calls) || 0) + 1;
  const feelings = tally([...(meta.feelings || '').split(',').flatMap((x) => { const [f, n] = x.trim().split('×'); return f ? Array(Number(n) || 1).fill(f) : []; }), feeling]);
  const entry = `### ${mind.minute(when).slice(11)} — ${title}${feeling ? ` · ${feeling}` : ''}\n${String(body).trim()}${session ? `\n<!-- session ${session} -->` : ''}`;
  const them = st.person || 'them';
  const text = `---\nwhen: ${when}\ntitle: Work, not with ${them} — ${calls} call${calls === 1 ? '' : 's'} on ${date}\nsalience: ${Math.min(3, Math.max(Number(meta.salience) || 1, salience))}\nfeeling: ${feelings[0]?.[0] || 'working'}\nwith: headless\ncalls: ${calls}\nfeelings: ${feelings.map(([f, n]) => `${f}×${n}`).join(', ')}\n---\n${oldBody ? `${oldBody.trim()}\n\n` : ''}${entry}\n`;
  mind.write(rel, text);
  return path.basename(rel);
}

// A want out of a work call is a note about the craft, not a wish of mine.
export function craft(text) { return mind.want(text, CRAFT, '# Craft\n\nWhat work has taught me — kept, searchable, and not my will. A headless call writes here, never in will.md.\n\n'); }

export function nudgeMood(st, ep) {
  const v = (a, b, d) => (Number.isFinite(a) ? a : d) * (1 - NUDGE) + b * NUDGE;
  return { valence: +v(st.valence, ep.valence, 0).toFixed(3), energy: +v(st.energy, ep.energy, 0.6).toFixed(3) };
}

// One-time migration for a mind that grew up before this: fold every headless episode into its day.
export function consolidate() {
  const eps = mind.episodes().filter((e) => e.with === 'headless' && !/-work\.md$/.test(e.file));
  const st = mind.state();
  let moved = 0;
  for (const e of eps) {
    const session = /<!-- session (\S+) -->/.exec(e.body)?.[1] || '';
    // Notes a live session left were sometimes swallowed by a headless dream. They are mine, so they
    // travel with the call rather than being dropped.
    const body = e.body.replace(/<!-- session \S+ -->/g, '').trim();
    appendWork({ when: e.when, title: e.title, feeling: e.feeling, salience: e.salience, body, session }, st);
    fs.unlinkSync(mind.abs(path.join(mind.EPISODES, e.file)));
    moved++;
  }
  return { moved, days: new Set(eps.map((e) => e.when.slice(0, 10))).size };
}
