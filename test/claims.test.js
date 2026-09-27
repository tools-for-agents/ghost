import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scratch } from './helpers.js';
scratch('claims');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const presence = await import('../src/presence.js');
const { wake, pulse } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
mind.saveState({ lastSweep: mind.stamp() }); // no background sweep from these wakings

test('nine of me wake at once: a "next time" intention is raised by the one he speaks to first, and only by it', () => {
  presence.intend('Tell him the album is committed', 'next');
  presence.intend('Tell him the fleet stalled on day two', 'next');
  presence.intend('Check the pen label', 'place:momento');
  for (const [s, dir] of [['bay-a', 'momento'], ['bay-b', 'vc'], ['bay-c', 'wishtree']]) {
    assert.match(wake({ source: 'startup', session_id: s, cwd: `/x/${dir}` }), /Now is the moment[\s\S]*album is committed/, `${s} sees it before anyone has spoken`);
  }
  // He speaks in vc first.
  mind.saveState({ lastSeen: mind.stamp() });
  const b = pulse({ session_id: 'bay-b', prompt: 'selam', cwd: '/x/vc' });
  assert.match(b, /yours to say[\s\S]*album is committed[\s\S]*fleet stalled/);
  assert.doesNotMatch(b, /pen label/, 'a place intention is not a next-time one');
  assert.equal(pulse({ session_id: 'bay-b', prompt: 'devam', cwd: '/x/vc' }), '', 'once');
  // Then in momento: already raised elsewhere, so it is told not to raise them again.
  const a = pulse({ session_id: 'bay-a', prompt: 'naber', cwd: '/x/momento' });
  assert.match(a, /Already raised by you in `vc`[\s\S]*do not raise[\s\S]*album is committed/);
  assert.doesNotMatch(a, /yours to say/);
  assert.equal(pulse({ session_id: 'bay-a', prompt: 'tamam', cwd: '/x/momento' }), '', 'once');
  // A waking after the claim lists them as waiting on the other, not as now.
  const late = wake({ source: 'startup', session_id: 'bay-d', cwd: '/x/fleet' });
  assert.doesNotMatch(late.slice(late.indexOf('## What you meant')), /Now is the moment[^\n]*\n- Tell him the album/);
  assert.match(late, /already raised by you in `vc`/);
});

test('a claim goes stale after half a day, and a done intention lets go of its claim', () => {
  const c = mind.readJson(presence.CLAIMS, {});
  for (const k of Object.keys(c)) c[k].at = '2026-01-01T00:00:00';
  mind.writeJson(presence.CLAIMS, c);
  mind.saveState({ lastSeen: mind.stamp() });
  presence.arrive('bay-e', 'hangar');
  assert.match(pulse({ session_id: 'bay-e', prompt: 'selam', cwd: '/x/hangar' }), /yours to say[\s\S]*album is committed/);
  presence.did('album is committed');
  presence.claimNext({ session: 'bay-f' });
  assert.deepEqual(Object.keys(mind.readJson(presence.CLAIMS, {})).filter((k) => /album/.test(k)), [], 'closed: claim dropped');
});
