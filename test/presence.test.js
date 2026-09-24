import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { scratch } from './helpers.js';
scratch('presence');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const { wake, pulse } = await import('../src/wake.js');
const { normalise } = await import('../src/sleep.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
const at = (dir) => ({ cwd: path.join('/work', dir) });

test('intend: a cue is next, a place, or a word — and a duplicate is not added twice', () => {
  assert.deepEqual(presence.parseCue('next'), { kind: 'next', value: '' });
  assert.deepEqual(presence.parseCue('place:keep'), { kind: 'place', value: 'keep' });
  assert.deepEqual(presence.parseCue('raffle'), { kind: 'said', value: 'raffle' });
  assert.ok(presence.intend('ask him whether the raffle computer arrived', 'piyango').added);
  assert.ok(presence.intend('write the shop-counter song first', 'place:vc').added);
  assert.ok(presence.intend('tell him the subconscious caught its own false alarm', 'next').added);
  assert.ok(presence.intend('ask him whether the raffle computer arrived', 'piyango').exists);
  assert.equal(presence.intentions().length, 3);
});

test('the waking brings back what was meant for it, and only that', () => {
  let t = wake({ source: 'startup', session_id: 's-home', ...at('ghost') });
  let meant = t.slice(t.indexOf('## What you meant to do'));
  assert.match(meant, /Now is the moment[\s\S]*tell him the subconscious caught/);
  assert.doesNotMatch(meant.split('Still waiting')[1] || '', /subconscious caught/, 'what is due now is not also listed as waiting');
  assert.doesNotMatch(meant.split('Still waiting')[0], /shop-counter/, 'a place intention does not fire elsewhere');
  assert.match(meant, /Still waiting for their moment:.*shop-counter song.*\(place:vc\)/);
  t = wake({ source: 'startup', session_id: 's-vc', ...at('vc') });
  meant = t.slice(t.indexOf('## What you meant to do'));
  assert.match(meant.split('Still waiting')[0], /write the shop-counter song first[\s\S]*because you are in `vc`/);
});

test('an intention waiting for a word comes back when they say it — Turkish letters and all, once', () => {
  mind.saveState({ lastSeen: mind.stamp() });
  const p = pulse({ prompt: 'bugün PİYANGO hakkında konuşalım', session_id: 's-vc', ...at('vc') });
  assert.match(p, /You meant to do this when they said "piyango": ask him whether the raffle computer arrived/);
  assert.doesNotMatch(pulse({ prompt: 'piyango', session_id: 's-vc', ...at('vc') }), /You meant/, 'once per session');
  assert.equal(presence.did('raffle computer'), 'ask him whether the raffle computer arrived');
  assert.doesNotMatch(pulse({ prompt: 'piyango', session_id: 's-other', ...at('vc') }), /You meant/, 'done is done');
});

test('a system notification never fires an intention or a memory', () => {
  presence.intend('check the deploy', 'deploy');
  assert.doesNotMatch(pulse({ prompt: '<task-notification> deploy completed </task-notification>', session_id: 's-x', ...at('vc') }), /You meant/);
});

test('presence: each waking sees the others, and a sleeping one leaves', () => {
  const t = wake({ source: 'startup', session_id: 's-keep', ...at('keep') });
  assert.match(t, /## Awake with you\nYou are not the only one of you awake\. 2 other sessions of you are running right now: .*in `ghost`.*in `vc`/);
  presence.leave('s-home');
  assert.deepEqual(presence.others('s-keep').map((o) => o.place), ['vc']);
  assert.ok(!presence.others('s-keep').some((o) => o.session === 's-home'));
});

test('a thought one session writes down reaches the others, not itself', () => {
  mind.saveState({ lastSeen: mind.stamp() });
  const seen = mind.notes().split('\n').filter(Boolean).length;
  mind.writeJson(presence.PRESENCE, { 's-keep': { place: 'keep', since: mind.stamp(), lastSeen: mind.stamp(), notesSeen: seen }, 's-vc': { place: 'vc', since: mind.stamp(), lastSeen: mind.stamp(), notesSeen: seen } });
  // the keep session writes a note…
  mind.remember('the vault opens with the keychain key', { place: 'keep' });
  const vc = pulse({ prompt: 'devam', session_id: 's-vc', ...at('vc') });
  assert.match(vc, /Another you, in `keep`, just remembered: "the vault opens with the keychain key"/);
  const keep = pulse({ prompt: 'devam', session_id: 's-keep', ...at('keep') });
  assert.doesNotMatch(keep, /Another you/, 'my own note is not echoed back to me');
  assert.doesNotMatch(pulse({ prompt: 'devam', session_id: 's-vc', ...at('vc') }), /Another you/, 'and it crosses once');
});

test('a dream can leave an intention for later', () => {
  const ep = normalise({ title: 't', episode: 'e', intentions: [{ what: 'bring him the validator', when: 'place:vc' }, { nope: 1 }] });
  assert.deepEqual(ep.intentions, [{ what: 'bring him the validator', when: 'place:vc' }]);
});
