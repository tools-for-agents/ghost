import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Each test file points GHOST_HOME (and friends) at a scratch dir BEFORE importing src/*.
export function scratch(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ghost-${name}-`));
  process.env.GHOST_HOME = path.join(dir, 'mind');
  process.env.GHOST_SETTINGS = path.join(dir, 'settings.json');
  process.env.GHOST_BIN_DIR = path.join(dir, 'bin');
  process.env.GHOST_STYLES_DIR = path.join(dir, 'output-styles'); // never the real ~/.claude/output-styles
  process.env.GHOST_BIN = 'ghost';
  return dir;
}
export const fixtures = (f) => path.join(import.meta.dirname, 'fixtures', f);
