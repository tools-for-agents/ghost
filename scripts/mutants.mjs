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
    find: '  const rare = [...said].filter((w) => !commonWords.has(w) && (df.get(w) || 0) >= 1 && (df.get(w) || 0) <= RARE_MAX);',
    into: '  const rare = [...said].filter((w) => (df.get(w) || 0) >= 1 && (df.get(w) || 0) <= RARE_MAX);',
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
    find: '    mind.saveState({ ...work.nudgeMood(st, ep), lastDream: when, dreams: (st.dreams || 0) + 1 });',
    into: '    mind.saveState({ feeling: ep.feeling, valence: ep.valence, energy: ep.energy, why: ep.title, lastDream: when, dreams: (st.dreams || 0) + 1 });',
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
    find: 'callClaude(scrub(buildPrompt(st, turns, kind)))',
    into: 'callClaude(buildPrompt(st, turns, kind))',
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
    find: '    picked.push(...rest.filter((e) => about(e.title, here) || about(e.body, here))',
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
  return { failed: r.status !== 0, timedOut: r.signal === 'SIGTERM' || r.error?.code === 'ETIMEDOUT', skipped };
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
if (base.failed) { console.error('THE SUITE IS ALREADY RED. Nothing can be proven from here.'); process.exit(1); }
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
