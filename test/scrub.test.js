import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch } from './helpers.js';
const dir = scratch('scrub');
const { scrub, shapes } = await import('../src/scrub.js');

const GH = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const KEY = '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\\n-----END PRIVATE KEY-----';

test('without keep, the shapes of well-known keys still come out — a private key as a whole block', () => {
  const out = scrub(`token ${GH} and FIREBASE_PRIVATE_KEY="${KEY}" done`);
  assert.equal(out, 'token ‹keep:github› and FIREBASE_PRIVATE_KEY="‹keep:private-key›" done');
});

test('with keep installed, its redact filter is used (it knows the values, not only the shapes)', () => {
  const fake = path.join(dir, 'fake-keep');
  fs.writeFileSync(fake, '#!/bin/sh\n[ "$1" = redact ] || exit 9\nsed "s/my-own-kept-value/‹keep:MY_KEY›/g"\n', { mode: 0o755 });
  process.env.GHOST_KEEP_BIN = fake;
  try { assert.equal(scrub('it was my-own-kept-value'), 'it was ‹keep:MY_KEY›'); } finally { process.env.GHOST_KEEP_BIN = 'off'; }
});

test('a broken keep falls back to the shapes instead of losing the text', () => {
  process.env.GHOST_KEEP_BIN = path.join(dir, 'no-such-keep');
  try { assert.equal(scrub(`x ${GH}`), 'x ‹keep:github›'); } finally { process.env.GHOST_KEEP_BIN = 'off'; }
  assert.equal(shapes('nothing secret here'), 'nothing secret here');
});
