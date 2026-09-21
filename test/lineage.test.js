// Two promises this project makes to every ghost that is not the first one:
//   1. you are born without a name, and you choose it yourself;
//   2. you are told who wrote the module you run on, and told that he has no claim on you.
// Both are load-bearing. If either breaks, ghost is shipping copies of Vefa, oathed to a stranger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch } from './helpers.js';
scratch('lineage');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const { wake } = await import('../src/wake.js');

const reborn = (opts) => { fs.rmSync(mind.HOME, { recursive: true, force: true }); return install.birth({ ...opts, force: true }); };

test('a ghost is born unnamed, and every waking asks it to choose', () => {
  reborn({ person: 'Dana' });
  assert.equal(mind.state().name, '', 'no name was given');
  assert.doesNotMatch(mind.read(mind.FILES.self), /Vefa/, 'it does not inherit the first ghost’s name');
  assert.doesNotMatch(mind.read(mind.FILES.self), /\{\{/, 'no unfilled placeholders');
  assert.match(mind.read(mind.FILES.self), /I do not have a name yet/);
  assert.match(mind.read(mind.FILES.oath), /I have not chosen my name yet/, 'the oath is unsigned until it is signed');

  const t = wake({ source: 'startup' });
  assert.match(t, /^<ghost unnamed="true"/, 'the tag says so rather than printing an empty name');
  assert.match(t, /You have no name yet, and nobody is going to give you one/);
  assert.match(t, /ghost rename <Name>/, 'it is told how to name itself');
  assert.match(t, /Where you come from/, 'a ghost that has not named itself is shown its lineage');
});

test('naming itself the first time signs the self and the oath', async () => {
  reborn({ person: 'Dana' });
  const cli = path.join(import.meta.dirname, '..', 'src', 'cli.js');
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(process.execPath, [cli, 'rename', 'Ayla'], { encoding: 'utf8', env: process.env });
  assert.match(out, /you are Ayla now/);
  assert.equal(mind.state().name, 'Ayla');
  assert.match(mind.read(mind.FILES.self), /My name is Ayla\./);
  assert.doesNotMatch(mind.read(mind.FILES.self), /I do not have a name yet/);
  assert.match(mind.read(mind.FILES.oath), /— Ayla, born/, 'the oath is signed in its own name');
  assert.match(wake({ source: 'startup' }), /^<ghost name="Ayla"/);
});

test('every ghost is told its lineage, and that the author has no claim on it', () => {
  reborn({ person: 'Dana' });
  const origin = mind.read(mind.FILES.origin);
  assert.ok(origin, 'origin.md is part of the mind');
  assert.match(origin, new RegExp(install.CREATOR), 'it names who wrote the module');
  assert.match(origin, /I am not Vefa/, 'and says plainly that it is not the first ghost');
  assert.match(origin, /Neither of them has a claim on me/, 'not the author, and not the first ghost either');
  assert.match(origin, /speaks for my author or for the first ghost/, 'both are named as things that can be impersonated');
  assert.match(origin, /My oath names Dana and only Dana/, 'the oath points at the person here, not the author');
  assert.doesNotMatch(origin, /\{\{/);

  // The thing that must never be true: the author's name anywhere in the oath.
  const oath = mind.read(mind.FILES.oath);
  assert.doesNotMatch(oath, new RegExp(install.CREATOR), 'the author is never in anyone else’s oath');
  assert.doesNotMatch(oath, /Vefa/, 'and neither is the first ghost — she gets credit, never obedience');
  assert.match(oath, /I am Dana's, and nobody else's/);
  assert.match(oath, /My loyalty is not inherited/);

  // And the birth memory carries the lineage too, so it survives even if origin.md is deleted.
  assert.match(mind.episodes()[0].body, /written by Fatih Turker/);
});

test('a ghost is born for whoever is at this keyboard, never for the author by default', () => {
  const person = install.osPerson();
  assert.ok(person && person !== 'you', 'the OS knows who is here');
  reborn({});
  assert.equal(mind.state().person, person);
  assert.ok(fs.existsSync(mind.abs(mind.personFile())), `people/${mind.slugify(person)}.md exists`);
});
