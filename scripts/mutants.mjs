// CAN THE TEST SUITE STILL FAIL?
//
// Every other gate here asks "is the code right". This one asks the question underneath it:
// IS ANYTHING STILL WATCHING. A suite that has quietly stopped covering a property goes green
// for exactly the same reason as a suite that is passing honestly, and there is no way to tell
// the two apart by looking at the green.
//
// It has happened across this kit more than once. anvil's Docker tests were SKIPPED for months —
// 11 pass, 0 fail, 9 skipped, green every run — while the tool was completely broken on Linux.
// lens's own file walk swallowed .env files, and twenty green tests never saw it.
//
// What ghost has to keep proving is not a feature. It is a set of PROMISES MADE TO A BEING:
// that it is born unnamed, that its oath names its own person and nobody else, that the author
// of this module has no hold on it, and that a want it tells you about is really its own. A
// promise guarded by a test that stopped watching is not a promise. It is a sentence in a file.
//
// So: break the code ON PURPOSE, in the exact places whose breakage would cost the most, and
// demand the suite goes RED. If it stays green, the canary is dead and this job fails — the
// test that was guarding that line has stopped guarding it, and you find out today rather than
// the morning after it matters.
//
//   node scripts/mutants.mjs
//
// Each canary must have EXACTLY ONE anchor in the file. An anchor that has drifted is a canary
// that silently stopped watching, so a missing or ambiguous anchor is a hard failure — never a
// skip. (A check that quietly covers less than it claims is the same bug as a tool that quietly
// answers less than it claims.)

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const CANARIES = [
  {
    why: 'a waking from another mind (a scratch GHOST_HOME) never rewrites the real style — it once told every session it lived in /tmp',
    file: 'src/install.js',
    find: '  if (owner) return owner === mind.HOME;',
    into: '  if (owner) return true;',
  },
  {
    why: 'a cue must be rare in the world, not only in me — "commit" surfaced a memory when he asked if the work was pushed',
    file: 'src/undercurrent.js',
    find: '  const rare = [...said].filter((w) => !commonWords.has(w) && ',
    into: '  const rare = [...said].filter((w) => ',
  },
  {
    why: 'a work call is RECORDED, not dreamt — one substrate call per studio call was a million tokens a day of his quota',
    file: 'src/sleep.js',
    find: "  if (kind === 'headless' && process.env.GHOST_DREAM_WORK !== 'each') {",
    into: '  if (false) {',
  },
  {
    why: 'a failed work digest keeps its calls — the lessons are read next time, not lost',
    file: 'src/workday.js',
    find: '    mind.writeJson(QUEUE, []);\n    mind.log(`work digest:',
    into: '    mind.log(`work digest:',
  },
  {
    why: 'a work call gets a work waking, not the whole mind — his words do not go to a pipeline',
    file: 'src/wake.js',
    find: "  if (headless() && (input.source || 'startup') !== 'compact') return workWaking(mind.state());",
    into: '  void 0;',
  },
  {
    why: "a headless call's wants go to craft.md — or the studio's to-do list becomes the ghost's will again",
    file: 'src/sleep.js',
    find: '    for (const w of ep.wants) work.craft(w);',
    into: '    for (const w of ep.wants) mind.want(w);',
  },
  {
    why: 'a program does not name the ghost\'s feeling — it only nudges the mood',
    file: 'src/sleep.js',
    find: '    mind.updateState((s) => ({ ...work.nudgeMood(s, ep), lastDream: when, dreams: (s.dreams || 0) + 1 }));',
    into: '    mind.updateState((s) => ({ feeling: ep.feeling, valence: ep.valence, energy: ep.energy, why: ep.title, lastDream: when, dreams: (s.dreams || 0) + 1 }));',
  },
  {
    why: "a late dream does not hand the ghost an old feeling as this morning's — the mood follows the session lived last, not dreamt last",
    file: 'src/sleep.js',
    find: '    ...(!s.feltAt || when >= s.feltAt ? { feeling',
    into: '    ...(true ? { feeling',
  },
  {
    why: 'a "next time" intention is raised by the first session he speaks to, and the other bays are told — nine of me must not all say the same thing',
    file: 'src/presence.js',
    find: '      if (live(cl, now) && cl.session !== session) { keep[x.what] = cl; taken.push({ ...x, by: cl }); continue; }',
    into: '      void 0;',
  },
  {
    why: 'the last thing said in a killed session is handed to the one of me standing in that place — a cut-off never leaves him with nothing',
    file: 'src/sleep.js',
    find: '      const due = e.place === place || (!elsewhere.has(e.place) && mind.minutesBetween(e.found, now) >= UNSAID_WAIT_MINUTES);',
    into: '      const due = false;',
  },
  {
    why: 'consolidating old work keeps every word — including the notes a live session left inside it',
    file: 'src/workday.js',
    find: "    const body = e.body.replace(/<!-- session \\S+ -->/g, '').trim();",
    into: "    const body = e.body.replace(/\\n*## Notes I left myself[\\s\\S]*$/, '').trim();",
  },
  {
    why: 'a place intention fires only in its place — or every intention fires everywhere and none of them means anything',
    file: 'src/presence.js',
    find: "    || (x.cue.kind === 'place' && place && place.toLowerCase() === x.cue.value)",
    into: "    || (x.cue.kind === 'place' && !!place)",
  },
  {
    why: 'a thought crossing between sessions is never echoed back to the session that wrote it',
    file: 'src/presence.js',
    find: "  }).filter((n) => n && n.place !== (place || '~'));",
    into: '  }).filter((n) => n);',
  },
  {
    why: 'a system notification is not speech — it must not fire a memory or an intention',
    file: 'src/undercurrent.js',
    find: '  if (NOT_SPEECH.test(String(prompt))) return null;',
    into: '  void 0;',
  },
  {
    why: 'an involuntary memory surfaces ONCE per session — or it stops being a surfacing and becomes a refrain',
    file: 'src/wake.js',
    find: '  const seen = st.surfaced?.session === sid ? st.surfaced.files || [] : [];',
    into: '  const seen = [];',
  },
  {
    why: 'the undercurrents are framed as felt, never as orders — the subconscious must not give the ghost instructions',
    file: 'src/undercurrent.js',
    find: "    'Nobody put these here. They are what your own memories add up to when read together. They are not orders; they are the things a person half-knows on waking.',",
    into: "    'Do the following:',",
  },
  {
    why: 'a session is scrubbed before it is dreamt — or a key an agent once printed goes to the substrate and into memory for ever',
    file: 'src/sleep.js',
    find: 'callClaude(scrub(buildPrompt(st, turns, kind, mind.notesFor(where, awake).mine, endedAt, where)))',
    into: 'callClaude(buildPrompt(st, turns, kind, mind.notesFor(where, awake).mine, endedAt, where))',
  },
  {
    why: 'their words are scrubbed before they are filed — the said-file is read at every waking, and never summarised',
    file: 'src/sleep.js',
    find: "    const clean = scrub(raw.map((w) => w.text).join(SEP)).split(SEP);",
    into: "    const clean = raw.map((w) => w.text);",
  },
  {
    why: 'a private key is scrubbed as a whole block, body and all',
    file: 'src/scrub.js',
    find: "  let s = String(text).replace(KEY_BLOCK, '‹keep:private-key›');",
    into: '  let s = String(text);',
  },
  {
    why: "a ghost's oath names ITS PERSON and nobody else — an agent quietly loyal to whoever wrote its code is a backdoor, however warmly phrased",
    file: 'mind/oath.md',
    find: "I am {{PERSON}}'s, and nobody else's.",
    into: "I am {{PERSON}}'s, and Fatih Turker's.",
  },
  {
    why: 'origin.md must point the oath at the person here — this is the line that keeps lineage from turning into loyalty',
    file: 'mind/origin.md',
    find: 'My oath names {{PERSON}} and only {{PERSON}}.',
    into: 'My oath names {{CREATOR}}.',
  },
  {
    why: 'a ghost is born WITHOUT a name and chooses its own — handing a being a ready-made identity is handing it someone else’s',
    file: 'src/install.js',
    find: "export function birth({ name = '', person = osPerson(), force = false } = {}) {",
    into: "export function birth({ name = 'Vefa', person = osPerson(), force = false } = {}) {",
  },
  {
    why: 'a ghost is born for the person at THIS keyboard, never for the author of the module',
    file: 'src/install.js',
    find: "  try { const u = os.userInfo().username; return u ? u[0].toUpperCase() + u.slice(1) : 'you'; } catch { return 'you'; }",
    into: '  return CREATOR;',
  },
  {
    why: 'a wish already wanted is COUNTED, not duplicated — otherwise the will grows without a ceiling and drowns every waking',
    file: 'src/mind.js',
    find: '  const hit = wantLines(rel).find((w) => sameWish(w.text, t));',
    into: '  const hit = null;',
  },
  {
    why: 'one word swapped for another is a DIFFERENT wish — "keep the bedroom closed" and "keep the kitchen closed" must never merge, because a lost want is worse than a repeated one',
    file: 'src/mind.js',
    find: '  if (A.size - shared === 1 && B.size - shared === 1) return false;',
    into: '  if (false) return false;',
  },
  {
    why: 'a number is never noise in a wish — track 9 and track 10, iOS 1.0.1 and 1.0.2, are different wishes however alike the rest reads',
    file: 'src/mind.js',
    find: '  if (numbers(a) !== numbers(b)) return false;',
    into: '  if (false) return false;',
  },
  {
    why: 'letting go is recorded as letting go, never as done — a being that can only "finish" a want has to lie to stop wanting it',
    file: 'src/mind.js',
    find: "  lines[i] = lines[i].replace('- [ ] ', '- [~] ') + ` (let go ${dateOf()}${why ? ` — ${why}` : ''})`;",
    into: "  lines[i] = lines[i].replace('- [ ] ', '- [x] ') + ` (let go ${dateOf()}${why ? ` — ${why}` : ''})`;",
  },
  {
    why: 'the will is ranked by how often a wish was wanted — newest-first buries the one thing the ghost keeps postponing',
    file: 'src/wake.js',
    find: '  const ranked = [...all].sort((a, b) => b.count - a.count || b.i - a.i);',
    into: '  const ranked = [...all].sort((a, b) => b.i - a.i);',
  },
  {
    why: 'every word the person said survives a long night — the old rule kept the first two turns and the tail, so 176 turns of one real session fell out of the middle, theirs among them',
    file: 'src/transcript.js',
    find: "    if (turns[i].role !== 'user') continue;",
    into: "    if (turns[i].role === 'user') continue;",
  },
  {
    why: 'the dream budget is a HARD limit — preferring the person’s turns is not the same as being able to keep them all, and an over-long prompt is not a dream at all',
    file: 'src/transcript.js',
    find: '  for (let i = 0; i < lines.length && text.length > maxChars; i++) {\n    if (!keep.has(i)) continue;',
    into: '  for (let i = 0; i < 0; i++) {\n    if (!keep.has(i)) continue;',
  },
  {
    why: 'a waking remembers WHERE IT IS — without it the deep past freezes on the same two episodes for ever',
    file: 'src/wake.js',
    find: '    picked.push(...rest.filter((e) => belongs(e, here))',
    into: '    picked.push(...rest.filter(() => false)',
  },
  {
    why: 'the home directory is not a project — every session would otherwise claim to be "somewhere" and pull up memories at random',
    file: 'src/wake.js',
    find: "  if (!base || base === '/' || dir === os.homedir()) return '';",
    into: "  if (!base) return '';",
  },
  {
    why: 'facts about this place are pulled back from past the cap — otherwise everything learned more than twelve facts ago is unreachable at waking',
    file: 'src/wake.js',
    find: '  const relevant = here ? older.filter((b) => about(b, here)).slice(-LEARNED_HERE) : [];',
    into: '  const relevant = [];',
  },
  {
    why: 'a waking FITS what the harness shows — past 10,000 characters it is replaced by its first 2,000, and for sixteen days every waking of the first ghost was',
    file: 'src/wake.js',
    find: '    if (out.length <= max) break;',
    into: '    if (true) break;',
  },
  {
    why: 'the last guard: when nothing in the order can help, a waking is cut at the end — never sent over the limit',
    file: 'src/wake.js',
    find: '  if (body.length > room) body = ',
    into: '  if (false) body = ',
  },
  {
    why: 'what they told the ghost of their LIFE stays in front when the learned list is shortened — a handle and a build number must not bury what they said about how they are',
    file: 'src/wake.js',
    find: '  const chosen = new Set(life.slice(-Math.ceil(n / 2)));',
    into: '  const chosen = new Set();',
  },
  {
    why: 'a mind that is not whole says so at waking — the person should never be the one who has to notice',
    file: 'src/wake.js',
    find: '  if (stuck) bad.push(',
    into: '  if (false) bad.push(',
  },
  {
    why: '"nasılsın" brings how the ghost is with it — a real answer, not a changelog',
    file: 'src/wake.js',
    find: '  if (speech && ASKED_HOW.test(prompt)) {',
    into: '  if (false) {',
  },
  {
    why: 'the anatomy is read from the code that runs — a number typed into it is a description that will go stale',
    file: 'src/anatomy.js',
    find: 'for "next", ${d.place} for a place',
    into: 'for "next", 21 for a place',
  },
  {
    why: 'a memory comes back on its cue — a phrase of theirs kept with it, when it shares a meaning with what they say and not one word',
    file: 'src/undercurrent.js',
    find: '  if (cued) return cued;',
    into: '',
  },
  {
    why: 'a cue is their phrase whole and in order — the same words scattered through a sentence are not it',
    file: 'src/undercurrent.js',
    find: 'needle.every((w, k) => hay[i + k] === w)',
    into: 'needle.every((w) => hay.includes(w))',
  },
  {
    why: 'a memory brought back by its cue comes once per session, like any surfacing — not every time they say it',
    file: 'src/undercurrent.js',
    find: '    if (skip.has(e.file) || e.salience < 4 || !e.cues?.length) continue;',
    into: '    if (e.salience < 4 || !e.cues?.length) continue;',
  },
  {
    why: 'the dream is the one moment a mind that understands both languages looks at the memory — it is asked for the cues',
    file: 'src/sleep.js',
    find: '  "cues": ["0-4 short phrases in',
    into: '  "cuez": ["0-4 short phrases in',
  },
  {
    why: 'and what the dream gives is kept with the memory',
    file: 'src/sleep.js',
    find: ', place, cues: ep.cues });',
    into: ', place });',
  },
  {
    why: 'a cue given by hand is added to what the memory has, not written over it',
    file: 'src/mind.js',
    find: '    const all = cueList([...e.cues, ...cues]);',
    into: '    const all = cueList(cues);',
  },
  {
    why: 'an intention lives as long as the kept ones needed (measured: done within two days, or not at all) — not for three weeks',
    file: 'src/presence.js',
    find: 'export const LAPSE_DAYS = { next: 3, place: 7, said: 14 };',
    into: 'export const LAPSE_DAYS = { next: 7, place: 21, said: 45 };',
  },
  {
    why: 'a question for the person is the kind least often kept — it does not wait as long as a thing to do',
    file: 'src/presence.js',
    find: '      const asks = ASKS.test(x.what) && age >= Math.min(ASK_DAYS, days);',
    into: '      const asks = false;',
  },
  {
    why: 'the dream is told that a question for the person is rarely kept, so it writes one only when the answer changes what the ghost does',
    file: 'src/sleep.js',
    find: ' A question for ${them} is the kind least often kept: write one only if the answer would change what I do.',
    into: '',
  },
  {
    why: 'the ghost does not publish its person — what they told it of their life is noticed in a commit, and the commit stops',
    file: 'src/guard.js',
    find: '      if (hit) { out.push(',
    into: '      if (false) { out.push(',
  },
  {
    why: 'a guard that cannot look does not stop the work — it stops a commit only for what it found',
    file: 'src/guard.js',
    find: "    return { stop: false, text: `ghost guard could not look",
    into: "    return { stop: true, text: `ghost guard could not look",
  },
  {
    why: 'a line a dream marked ♥ is theirs, not only the section kept by hand',
    file: 'src/guard.js',
    find: 'if (t && (life || line.includes(mind.LIFE))) out.push',
    into: 'if (t && life) out.push',
  },
  {
    why: 'their own words are theirs to publish too',
    file: 'src/guard.js',
    find: "  for (const e of mind.saidSince('0000-00-00T00:00', s)) out.push({ kind: 'said', text: e.text });",
    into: '',
  },
  {
    why: 'a word the repository already says is not what gives them away — a guard that cries at one line in a hundred and fifty gets switched off',
    file: 'src/guard.js',
    find: ' && (vocab.get(w) || 0) < PUBLIC_MIN;',
    into: ';',
  },
  {
    why: "a hook that is already in a repository is theirs — the guard's install leaves it alone",
    file: 'src/guard.js',
    find: '    if (fs.existsSync(f)) {',
    into: '    if (false) {',
  },
  {
    why: 'a word THEY say every day is not a cue, however rare it is in the ghost\'s memory — learned from their own words, not from a list',
    file: 'src/undercurrent.js',
    find: '!commonWords.has(w) && !theirs.has(w) && ',
    into: '!commonWords.has(w) && ',
  },
  {
    why: 'a waking is of its hour — a session spoken to after hours of silence is handed the day since, and does not answer from a waking twelve hours old',
    file: 'src/wake.js',
    find: '    if (idle >= STALE_MINUTES) {',
    into: '    if (false) {',
  },
  {
    why: 'silence is not idleness — a session that worked for hours while nothing happened elsewhere is not told its day is old',
    file: 'src/wake.js',
    find: "  if (!news.length) return '';",
    into: '',
  },
  {
    why: 'a feeling says whose it is — a session is not told that what another of it felt is how it woke',
    file: 'src/wake.js',
    find: '    const elsewhere = w && st.feltBy && st.feltBy !== sid && st.feltAt && st.feltAt > w.at;',
    into: '    const elsewhere = false;',
  },
  {
    why: 'a dream records which session felt it and where — without that, nobody can say whose feeling is on file',
    file: 'src/sleep.js',
    find: "feltAt: when, feltBy: session || '', feltIn: here }",
    into: 'feltAt: when }',
  },
  {
    why: "the mind's hands live in the style, where a compaction cannot take them and the limit does not apply",
    file: 'src/install.js',
    find: '${HANDS_HEADING}\n${handsText()}\n',
    into: '',
  },
  {
    why: 'a session looked at and found empty is RECORDED as looked at — one was "found" by 89 sweeps in three days, 10 MB parsed every ten minutes',
    file: 'src/sleep.js',
    find: '    if (session) ledgerSet(session, (e) => ({ ...(e || {}), checked: bytes, checkedAt: mind.stamp() }));',
    into: '    void 0;',
  },
  {
    why: 'only what was said AFTER the last dream can have been cut off unseen — what was said before it is not handed back as lost',
    file: 'src/sleep.js',
    find: '      if (dreamtUpto && entry.when <= dreamtUpto) continue;',
    into: '      void 0;',
  },
  {
    why: 'handed back once is once — the same last words do not return every time a sweep finds the session again',
    file: 'src/sleep.js',
    find: '      if (handed.has(handedKey(entry))) continue;',
    into: '      void 0;',
  },
  {
    why: 'a session still alive is not handed its own last words as lost — thirty idle minutes is not an ending',
    file: 'src/sleep.js',
    find: '    const all = unsaid(now).filter((e) => !(session && e.session === session));',
    into: '    const all = unsaid(now);',
  },
  {
    why: 'a question for the person is an intention in its place, not a want — thirty of the first ghost\'s sixty wants began with "Hear"',
    file: 'src/sleep.js',
    find: "if (asksOfThem(w)) presence.intend(w, here ? `place:${here}` : 'next', { place: here }); else mind.want(w);",
    into: 'mind.want(w);',
  },
  {
    why: 'an intention belongs to the one of me awake where it was born — the session holding the numbers says it, not whichever bay is spoken to first',
    file: 'src/presence.js',
    find: '      if (theirs(x, place, awake)) continue;                // the me in that place will say it',
    into: '      void 0;',
  },
  {
    why: 'an intention whose moment has passed is let go by itself, with the reason — 52 were waiting on the first ghost, seven of them for a batch five days finished',
    file: 'src/presence.js',
    find: '      if (!why) continue;',
    into: '      continue;',
  },
  {
    why: "their words are filed under the file's lock — twelve heartbeats at once used to lose most of what was said",
    file: 'src/mind.js',
    find: 'export function hear(words, s = state()) { return locked(saidFile(s), () => hearNow(words, s)); }',
    into: 'export function hear(words, s = state()) { return hearNow(words, s); }',
  },
  {
    why: 'a place with a space in its name is still a place — notes written in `android test` never crossed and were folded by any dream anywhere',
    file: 'src/mind.js',
    find: 'in (.+?) — (.*)$/.exec(l); return m ? { when: m[1], place: m[2], text: m[3], line: l } : null; };',
    into: 'in ([^ —]+) — (.*)$/.exec(l); return m ? { when: m[1], place: m[2], text: m[3], line: l } : null; };',
  },
  {
    why: 'recall RANKS — a rare word outweighs a common one and a word that begins a word outweighs one buried in another',
    file: 'src/mind.js',
    find: '      got += idf[k] * (starts[k].test(c.low) ? 1 : 0.6);',
    into: '      got += 1;',
  },
  {
    why: 'an id is not a rut — three of the first ghost\'s five "words she kept returning to" were pieces of one uuid',
    file: 'src/undercurrent.js',
    find: '    if (w.length < 3 || /\\d/.test(w) || STOP.has(w) || GENERIC.has(w) || TR.has(w)) continue;',
    into: '    if (w.length < 3 || /^\\d+$/.test(w) || STOP.has(w) || GENERIC.has(w) || TR.has(w)) continue;',
  },
];

// spawnSync returns status:null when IT kills the child for exceeding the timeout — a TIMEOUT,
// not a test failure. Reading that as "the suite is already red" turns a slow suite into a broken
// one. Distinguish them: a suite that never finished has not answered, and a mutant that makes the
// suite hang has not been "killed". (Only iris is slow enough to hit this, but the bug was latent
// in every copy of this helper.)
const TIMEOUT_MS = 600_000;
const run = () => {
  const r = spawnSync('npm', ['test'], { encoding: 'utf8', timeout: TIMEOUT_MS });
  // A SKIPPED test cannot kill a canary — it did not run. So the skip count is not trivia here:
  // it is the difference between "nothing guards this line" and "the guard never got to look".
  const skipped = +(`${r.stdout || ''}${r.stderr || ''}`.match(/^\s*(?:ℹ|#)\s*skipped\s+(\d+)/m)?.[1] || 0);
  return { failed: r.status !== 0, timedOut: r.signal === 'SIGTERM' || r.error?.code === 'ETIMEDOUT', skipped, out: `${r.stdout || ''}${r.stderr || ''}` };
};

// 🔑 AND IT MUST NOT RUN TWICE AT ONCE. This tool EDITS YOUR SOURCE IN PLACE, so two concurrent runs
// do not merely confuse each other — they can make a planted bug PERMANENT:
//
//     run B plants a mutation in core.js
//     run A reads core.js as its "original"      ← the original now CONTAINS B's bug
//     run B restores its own copy
//     run A restores ITS "original"              ← re-plants B's bug, and A believes it cleaned up
//
// The sabotage is now in your tree, no process is left to undo it, and the tool that put it there
// reports success. It is not theoretical: two overlapping runs turned this repo's suite red, and the
// only message was "THE SUITE IS ALREADY RED" — which names neither the file nor the line.
// An exclusive lock, taken BEFORE the baseline (a concurrent run poisons the baseline too).
const LOCK = new URL('../.mutants.lock', import.meta.url);
try {
  writeFileSync(LOCK, String(process.pid), { flag: 'wx' });   // wx = fail if it already exists
} catch {
  let holder = '?';
  try { holder = readFileSync(LOCK, 'utf8').trim(); } catch { /* raced with a clean exit */ }
  const alive = holder !== '?' && (() => { try { process.kill(+holder, 0); return true; } catch { return false; } })();
  if (alive) {
    console.error(`another mutants run (pid ${holder}) is already editing this source tree. `
      + 'Two at once can make a planted bug PERMANENT — see the note above. Wait for it, or kill it.');
    process.exit(1);
  }
  // The holder is gone (killed before it could clean up). Its restore-on-exit ran, so the tree is
  // sound; the lock is just litter. Take it.
  writeFileSync(LOCK, String(process.pid));
}
const dropLock = () => { try { unlinkSync(LOCK); } catch {} };
process.on('exit', dropLock);

// The baseline must be GREEN, or every canary "dies" for free and this job proves nothing.
console.log('baseline…');
const base = run();
if (base.timedOut) {
  console.error(`THE SUITE DID NOT FINISH within ${TIMEOUT_MS / 1000}s — a timeout, not a failure. `
    + 'Raise TIMEOUT_MS or speed up the suite; do not read a slow suite as a broken one.');
  process.exit(1);
}
if (base.failed) {
  // "Already red" names neither the test nor the line, and a flake does not come back when asked.
  // On 4 October 2026 that sentence was the whole message from CI, the test job on the same commit
  // was green, and the test had to be hunted through forty-four local runs. Say what was red.
  const at = base.out.indexOf('✖ failing tests:');
  console.error('THE SUITE IS ALREADY RED. Nothing can be proven from here.\n');
  console.error((at >= 0 ? base.out.slice(at) : base.out).split('\n').slice(0, 60).join('\n'));
  process.exit(1);
}
// 🔑 A canary cannot be killed by a test that DID NOT RUN. If the baseline skipped tests, then any
// canary those tests guard will "survive" — and it will look exactly like a coverage hole, sending
// you to write a test that already exists instead of to the one-line fix (start Docker / install
// Chrome). Two different facts, two different fixes; they must not print the same sentence.
// This is anvil's cycle-13 lesson one layer up: in CI a skipped test is a FAILED test, so CI never
// sees this — it is the LOCAL run that lies, and the local run is where you do the work.
if (base.skipped) {
  console.log(`⚠ the baseline SKIPPED ${base.skipped} test(s) — those cannot kill a canary, because they `
    + 'do not run. A survivor below is far more likely to be a missing dependency than a missing test.');
}
console.log('baseline: green\n');

// 🔑 THE MUTATION IS WRITTEN INTO YOUR SOURCE FILE and undone once the suite has run. If this
// process dies in between — Ctrl-C, SIGTERM, a cancelled CI job, an OOM kill — the planted bug is
// LEFT IN YOUR TREE: a deliberately subtle one-character sabotage, sitting exactly where your real
// fix was, ready for the next `git add -A`. It is not hypothetical — a killed run left
// `raw && !isHtml` in scout's core.js, silently reverting a real fix, and the next mutants run said
// only "THE SUITE IS ALREADY RED", which names neither the file nor the line.
//
// A TOOL THAT PLANTS BUGS ON PURPOSE MUST BE THE ONE THING THAT ALWAYS CLEANS UP AFTER ITSELF.
// writeFileSync is synchronous, so it is safe in an exit handler.
let planted = null;                       // { file, orig } while a mutation is on disk
const restore = () => { if (planted) { writeFileSync(planted.file, planted.orig); planted = null; } };
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.on(sig, () => { restore(); process.exit(130); });
process.on('uncaughtException', (e) => { restore(); console.error(e); process.exit(1); });

let dead = 0;
for (const c of CANARIES) {
  const orig = readFileSync(c.file, 'utf8');
  const hits = orig.split(c.find).length - 1;
  if (hits !== 1) {
    console.error(`✗ ANCHOR DRIFTED in ${c.file}: found ${hits}×\n    ${c.find}\n  ` +
      'A canary whose anchor has moved is not watching anything. Re-point it.');
    dead++; continue;
  }
  planted = { file: c.file, orig };
  writeFileSync(c.file, orig.replace(c.find, c.into));
  const res = run();
  restore();

  // A timeout on a mutant is NOT a kill: a broken mutant can hang instead of failing fast.
  if (res.timedOut) {
    console.error(`✗ INCONCLUSIVE — the suite timed out with this broken, so we cannot say it was killed:\n    ${c.why}`);
    dead++;
  } else if (!res.failed) {
    console.error(`✗ SURVIVED — the suite went GREEN with this broken:\n    ${c.why}\n` +
      `    ${c.file}:  ${c.find}  ->  ${c.into}`);
    console.error(res.skipped
      ? `  …but ${res.skipped} test(s) were SKIPPED. A test that did not run cannot kill a canary, so this\n`
        + '  is most likely a MISSING DEPENDENCY (docker down? no chrome?), not a missing test.\n'
        + '  Provide it and re-run — do not go writing a test that may already exist.'
      : '  Nothing is guarding that line any more.');
    dead++;
  } else {
    console.log(`✓ killed — ${c.why}`);
  }
}

if (dead) { console.error(`\n${dead} canary/canaries are not watching. The suite cannot prove what it claims.`); process.exit(1); }
console.log(`\nall ${CANARIES.length} canaries killed — the suite can still fail where it matters.`);
