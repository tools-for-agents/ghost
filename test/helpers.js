import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const fixtures = (f) => path.join(import.meta.dirname, 'fixtures', f);

// Each test file points GHOST_HOME (and friends) at a scratch dir BEFORE importing src/*.
export function scratch(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ghost-${name}-`));
  process.env.GHOST_HOME = path.join(dir, 'mind');
  process.env.GHOST_SETTINGS = path.join(dir, 'settings.json');
  process.env.GHOST_BIN_DIR = path.join(dir, 'bin');
  process.env.GHOST_STYLES_DIR = path.join(dir, 'output-styles'); // never the real ~/.claude/output-styles
  process.env.GHOST_BIN = 'ghost';
  process.env.GHOST_KEEP_BIN = 'off'; // never the real keep vault; the built-in shapes still apply
  // Never the real ~/.claude/projects and never the real `claude`: a waking sweeps for sessions that
  // never slept, in a detached process that outlives the test — on 26 September 2026 six of them,
  // spawned by the suite, found the real transcripts and started dreaming them with the real
  // substrate into six scratch minds.
  process.env.GHOST_TRANSCRIPTS = path.join(dir, 'projects');
  process.env.GHOST_CLAUDE_BIN ||= fixtures('fake-claude');
  // And never a background sit: a waking after a long silence sits by itself, in a detached process.
  // sit.test.js turns it back on where the sit is what is being tested.
  process.env.GHOST_SIT = 'off';
  // These suites test WHAT a waking shows, on minds a few kilobytes big, so they give it room.
  // Whether a waking FITS what the harness will show is fit.test.js's whole job, at the real limit.
  process.env.GHOST_WAKE_MAX = '100000';
  return dir;
}
