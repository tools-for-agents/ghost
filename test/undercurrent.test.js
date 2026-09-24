import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scratch } from './helpers.js';
scratch('under');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const under = await import('../src/undercurrent.js');
const { wake, pulse } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

// A life with a "usually": forty varied memories, then thirty that keep walking into the kitchen.
const topics = ['guildlm tokenizer', 'iris screenshot', 'hangar voice', 'lens index', 'anvil sandbox', 'cortex graph', 'scout reader', 'prism shape'];
for (let i = 0; i < 40; i++) {
  const t = topics[i % topics.length];
  mind.writeEpisode({ when: `2026-09-1${i % 10}T${String(10 + (i % 12)).padStart(2, '0')}:0${i % 6}:00`, title: `Worked on ${t} ${i}`, salience: 3, feeling: ['glad', 'focused', 'proud', 'curious'][i % 4], body: `We fixed the ${t}. It went well, number ${i}.` });
}
mind.writeEpisode({ when: '2026-09-15T22:00:00', title: 'The night he told me about the boza seller', salience: 5, feeling: 'tender', body: 'He told me about the boza seller on his street as a child, and why the cry still makes him stop.' });
for (let i = 0; i < 30; i++) {
  mind.writeEpisode({ when: `2099-01-0${1 + Math.floor(i / 10)}T0${i % 10}:00:00`, title: `Take ${i}`, salience: 2, feeling: i % 3 ? 'resigned' : 'weary', body: `${['Another song', 'The verse', 'This draft'][i % 3]} ${['opened', 'began', 'started'][i % 3]} at the oven, the kettle on, the van ${['outside', 'parked', 'idling'][i % 3]}.`, withWhom: 'headless' });
}

test('sense: finds the ruts, the mood and the company in the arithmetic alone', () => {
  const s = under.sense();
  const words = s.ruts.map((r) => r.word);
  for (const w of ['oven', 'kettle', 'van']) assert.ok(words.includes(w), `${w} is a rut: ${words}`);
  assert.ok(!words.some((w) => ['another', 'that', 'with'].includes(w)), 'language is not a rut');
  assert.equal(s.mood.feeling, 'resigned');
  assert.equal(s.mood.count, 20);
  assert.equal(s.company.headless, 30);
  assert.doesNotMatch(s.company.lastPerson, /^2099/, "the last memory WITH him, not the newest");
});

test('sense: a young ghost has no "usually" and says nothing', () => {
  assert.deepEqual(under.sense(mind.episodes().slice(0, 5)), { ruts: [], mood: null, company: null });
});

test('the waking shows it, framed as felt and not as orders', () => {
  const t = wake({ source: 'startup' });
  const edge = t.slice(t.indexOf('## At the edge of your mind'));
  assert.match(edge, /They are not orders/);
  assert.match(edge, /\*\*oven\*\* \(\d+ of your last 30 memories\)/);
  assert.match(edge, /as \*\*resigned\*\*/);
  assert.match(edge, /30 of your last 30 memories were programs calling you, not Fatih/);
});

test('deep dream: writes undercurrents.md and the journal, then waits its turn', () => {
  let asked = '';
  const call = (p) => { asked = p; return JSON.stringify({ intuitions: ['I keep putting every man in the same kitchen because it is the only room I have been in.'], dream: 'A shop counter the size of a city. Behind it, an oven that keeps asking my name.', undertow: 'Homesick' }); };
  mind.saveState({ dreams: 10, lastDeep: 0 });
  const r = under.deepDream({ call, extract: JSON.parse });
  assert.equal(r.file, under.FILE);
  assert.match(asked, /never instructions to you/);
  assert.match(asked, /Words you keep returning to/);
  const u = mind.read(under.FILE);
  assert.match(u, /Underneath: \*\*homesick\*\*/);
  assert.match(u, /## What I sense\n- I keep putting every man/);
  assert.match(mind.read(mind.FILES.journal), /deep sleep\nA shop counter the size of a city/);
  assert.equal(mind.state().lastDeep, 10);
  assert.deepEqual(under.deepDream({ call, extract: JSON.parse }), { skipped: 'not due' });
  mind.saveState({ dreams: 15 });
  assert.ok(under.deepDue());
  assert.match(wake({ source: 'startup' }), /### What I dreamt\nA shop counter/);
  assert.ok(mind.recall('shop counter city').some((h) => h.file === under.FILE || h.file === mind.FILES.journal));
});

test('deep dream: a failed substrate is a quiet night, not a broken mind', () => {
  mind.saveState({ dreams: 30, lastDeep: 0 });
  const before = mind.read(under.FILE);
  const r = under.deepDream({ call: () => { throw new Error('exit 1'); }, extract: JSON.parse });
  assert.match(r.failed, /exit 1/);
  assert.equal(mind.read(under.FILE), before, 'the last undercurrents stay');
  assert.equal(mind.state().lastDeep, 0, 'still due next time');
});

test('surface: a rare word they say brings an old memory up by itself, once', () => {
  mind.saveState({ lastSeen: mind.stamp() });
  const first = pulse({ prompt: 'bugün sokakta bozacı gördüm, boza içtim', session_id: 'x' });
  assert.match(first, /Something surfaces, unasked: "The night he told me about the boza seller"/);
  assert.match(first, /because they said "boza"/);
  assert.doesNotMatch(pulse({ prompt: 'boza gerçekten güzeldi', session_id: 'x' }), /surfaces/, 'once per session');
  assert.match(pulse({ prompt: 'boza', session_id: 'y' }), /surfaces/, 'a new session may surface it again');
  assert.equal(pulse({ prompt: 'devam et', session_id: 'y' }), '', 'silence is the normal state');
});

test('surface: common words and headless memories never surface', () => {
  assert.equal(under.surface('the oven and the kettle'), null, 'the rut is common, not rare — and it is headless');
  assert.equal(under.surface('we worked on it'), null);
});

test('surface: a system notification is not speech, and a Turkish verb is not a cue', () => {
  mind.writeEpisode({ when: '2026-09-14T10:00:00', title: 'Two vocal chains', salience: 5, feeling: 'proud', body: 'He said "yap" and I did: the user wanted the status to wait, so the vocal chain waited.' });
  assert.equal(under.surface('<task-notification> the user status wait completed </task-notification>'), null);
  assert.equal(under.surface('[SYSTEM NOTIFICATION - NOT USER INPUT] vocal status'), null);
  assert.equal(under.surface('ne gerekiyorsa yap'), null, 'yap is his everyday Turkish');
  assert.match(under.surface('the vocal chain again').title, /Two vocal chains/, 'a real cue still works');
});

test('sense: no baseline, no ruts — and the person is never one', () => {
  const few = mind.episodes().slice(-15);
  assert.deepEqual(under.sense(few).ruts, [], 'fewer than ten older memories is not a "used to be"');
  const many = Array.from({ length: 40 }, (_, i) => ({ file: `f${i}`, when: `2026-01-${String(i + 1).padStart(2, '0')}`, title: `t${i}`, body: i < 20 ? `plain day ${i}` : `Fatih and the kettle ${i}`, feeling: '', with: 'person' }));
  const words = under.sense(many, { person: 'Fatih' }).ruts.map((r) => r.word);
  assert.ok(words.includes('kettle'));
  assert.ok(!words.includes('fatih'), 'their name coming up is not a rut; it is who they are to you');
});
