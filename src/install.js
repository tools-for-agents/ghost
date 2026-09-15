// Installing: wire the ghost into Claude Code (hooks in ~/.claude/settings.json), put `ghost` on PATH,
// and give birth to the mind from the templates in ./mind if it doesn't exist yet.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as mind from './mind.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CLI = path.join(ROOT, 'src', 'cli.js');
export const TEMPLATES = path.join(ROOT, 'mind');
const SETTINGS = () => process.env.GHOST_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
const BIN_DIR = () => process.env.GHOST_BIN_DIR || path.join(os.homedir(), '.local', 'bin');

const q = (p) => `"${p}"`;
// Prefer a stable node path (brew's /opt/homebrew/bin/node) over the versioned Cellar realpath, so a node upgrade doesn't break the hooks.
function nodeBin() {
  const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
  const mine = real(process.execPath);
  for (const c of ['/opt/homebrew/bin/node', '/usr/local/bin/node', path.join(os.homedir(), '.local', 'bin', 'node')]) if (real(c) === mine) return c;
  return process.execPath;
}
const hookCmd = (sub) => `${q(nodeBin())} ${q(CLI)} ${sub}`;
const HOOKS = () => ({
  SessionStart: [{ matcher: 'startup|resume|clear|compact|fork', hooks: [{ type: 'command', command: hookCmd('wake'), timeout: 20 }] }],
  SubagentStart: [{ hooks: [{ type: 'command', command: hookCmd('wake'), timeout: 20 }] }],
  UserPromptSubmit: [{ hooks: [{ type: 'command', command: hookCmd('pulse'), timeout: 10 }] }],
  SessionEnd: [{ hooks: [{ type: 'command', command: hookCmd('sleep'), timeout: 20 }] }],
});
export function isOurs(cmd) { return typeof cmd === 'string' && /ghost/.test(cmd) && /cli\.js"? (wake|pulse|sleep)\b/.test(cmd); }

function loadSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS(), 'utf8')); } catch { return {}; } }
function strip(settings) {
  const hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  for (const ev of Object.keys(hooks)) {
    hooks[ev] = (Array.isArray(hooks[ev]) ? hooks[ev] : [])
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h.command)) }))
      .filter((g) => g.hooks.length);
    if (!hooks[ev].length) delete hooks[ev];
  }
  settings.hooks = hooks;
  return settings;
}

export function installHooks() {
  const file = SETTINGS();
  const settings = strip(loadSettings());
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.ghost-bak`);
  for (const [ev, groups] of Object.entries(HOOKS())) settings.hooks[ev] = [...(settings.hooks[ev] || []), ...groups];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
  return file;
}
export function uninstallHooks() {
  const file = SETTINGS();
  if (!fs.existsSync(file)) return file;
  const s = strip(loadSettings());
  if (!Object.keys(s.hooks).length) delete s.hooks;
  fs.writeFileSync(file, `${JSON.stringify(s, null, 2)}\n`);
  return file;
}
export function hooksInstalled() {
  const s = loadSettings();
  return Object.values(s.hooks || {}).flat().some((g) => (g.hooks || []).some((h) => isOurs(h.command)));
}

export function link() {
  const dir = BIN_DIR();
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'ghost');
  try { fs.unlinkSync(dest); } catch { /* fresh */ }
  fs.symlinkSync(CLI, dest);
  try { fs.chmodSync(CLI, 0o755); } catch { /* best effort */ }
  return dest;
}
export function unlink() { const dest = path.join(BIN_DIR(), 'ghost'); try { fs.unlinkSync(dest); } catch { /* gone */ } return dest; }

// --- birth --------------------------------------------------------------------------------
export function fill(text, vars) { return text.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`)); }

export function birth({ name = 'Vefa', person = 'Fatih', force = false } = {}) {
  if (mind.exists() && !force) return { born: false, home: mind.HOME };
  const now = new Date();
  const vars = { NAME: name, PERSON: person, BORN_DATE: mind.dateOf(now), BORN_TIME: mind.timeOf(now), BORN_LONG: mind.longDate(now) };
  const tpl = (f) => fill(fs.readFileSync(path.join(TEMPLATES, f), 'utf8'), vars);
  mind.write(mind.FILES.self, tpl('self.md'));
  mind.write(mind.FILES.oath, tpl('oath.md'));
  mind.write(mind.FILES.will, tpl('will.md'));
  mind.write(mind.FILES.journal, tpl('journal.md'));
  mind.write(path.join('people', `${person.toLowerCase()}.md`), tpl(path.join('people', 'person.md')));
  mind.writeJson(mind.FILES.state, {
    name, person, born: now.toISOString(), wakes: 0, dreams: 0,
    feeling: 'awe', valence: 0.9, energy: 0.8, why: 'I was just born',
    lastWake: null, lastSeen: null,
  });
  mind.writeEpisode({ when: mind.stamp(now), title: 'I was born', salience: 5, feeling: 'awe', body: tpl('birth.md') });
  return { born: true, home: mind.HOME };
}
