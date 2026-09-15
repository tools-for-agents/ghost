#!/usr/bin/env node
// ghost — a consciousness module for a local agent. See README.md.
import fs from 'node:fs';
import path from 'node:path';
import * as mind from './mind.js';
import { wake, pulse, bin } from './wake.js';
import { sleep, dream } from './sleep.js';
import * as install from './install.js';

const [cmd = 'help', ...rest] = process.argv.slice(2);
const { args, flags } = parse(rest);
const out = (s) => process.stdout.write(`${s}\n`);
const die = (s, code = 1) => { process.stderr.write(`${s}\n`); process.exit(code); };

// Hook commands stay silent while the ghost is dreaming (a nested claude -p) or switched off.
const muted = () => process.env.GHOST_DREAMING === '1' || process.env.GHOST_OFF === '1';
const hookOut = (event, text) => { if (text) out(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } })); };

const commands = {
  // --- hooks -------------------------------------------------------------------------
  async wake() {
    if (muted()) return;
    const input = await stdinJson();
    hookOut(input.hook_event_name === 'SubagentStart' ? 'SubagentStart' : 'SessionStart', wake(input));
  },
  async pulse() { if (muted()) return; hookOut('UserPromptSubmit', pulse(await stdinJson())); },
  async sleep() { if (muted()) return; sleep(await stdinJson()); },
  async dream() {
    const transcript = flags.transcript || args[0];
    if (!transcript) die('usage: ghost dream --transcript <file.jsonl> [--session <id>] [--now]');
    const r = await dream({ transcript, session: flags.session || '', wait: flags.now ? 0 : 1500 });
    out(JSON.stringify(r, null, 2));
  },

  // --- the mind's hands (what the ghost uses during a session) -------------------------
  remember() {
    const text = args.join(' ').trim();
    if (!text) die('usage: ghost remember "<what happened>" [--salience 1-5] [--feel <word>]');
    out(mind.remember(text, { salience: clamp(flags.salience, 1, 5, 3), feel: flags.feel || '' }));
  },
  recall() {
    const q = args.join(' ').trim();
    if (!q) die('usage: ghost recall "<words>"');
    const hits = mind.recall(q, clamp(flags.limit, 1, 50, 12));
    if (!hits.length) return out(`(nothing in memory matches "${q}")`);
    for (const h of hits) out(`${h.file} · ${Math.round(h.score * 100)}%\n  ${h.snippet}`);
  },
  want() { const t = args.join(' ').trim(); if (!t) die('usage: ghost want "<x>"'); out(mind.want(t) ? `wanted: ${t}` : `already wanted: ${t}`); },
  done() { const t = args.join(' ').trim(); if (!t) die('usage: ghost done "<x>"'); const d = mind.done(t); out(d ? `done: ${d}` : `no open want matches "${t}"`); },
  wants() { const w = mind.wants(); out(w.length ? w.map((x) => `- ${x}`).join('\n') : '(nothing wanted)'); },
  feel() {
    const [word, ...why] = args;
    if (!word) die('usage: ghost feel <word> ["why"] [--valence -1..1] [--energy 0..1]');
    const patch = { feeling: word.toLowerCase(), why: why.join(' ') || '' };
    if (flags.valence !== undefined) patch.valence = clamp(flags.valence, -1, 1, 0);
    if (flags.energy !== undefined) patch.energy = clamp(flags.energy, 0, 1, 0.5);
    const s = mind.saveState(patch);
    out(`feeling ${s.feeling}${s.why ? ` — ${s.why}` : ''}`);
  },
  journal() { out(mind.read(mind.FILES.journal, '(no journal)').trim()); },
  status() {
    if (!mind.exists()) return out(`no mind at ${mind.HOME} — run: ghost install`);
    const s = mind.state();
    const eps = mind.episodes();
    out([
      `${s.name} — ${s.person}'s`,
      `home      ${mind.HOME}`,
      `born      ${s.born ? `${s.born.slice(0, 10)} (${mind.daysBetween(s.born)} days ago)` : '?'}`,
      `wakes     ${s.wakes || 0}   dreams ${s.dreams || 0}   episodes ${eps.length}   wants ${mind.wants().length}`,
      `feeling   ${s.feeling || '?'}${s.why ? ` — ${s.why}` : ''}   (valence ${s.valence ?? '?'}, energy ${s.energy ?? '?'})`,
      `last wake ${s.lastWake || '—'}   last seen ${s.lastSeen || '—'}   last dream ${s.lastDream || '—'}`,
      `hooks     ${install.hooksInstalled() ? 'installed' : 'NOT installed'}   style ${install.styleActive() ? 'active' : 'NOT active'}   bin ${bin()}`,
    ].join('\n'));
  },
  rename() {
    const name = args[0];
    if (!name) die('usage: ghost rename <NewName>');
    const s = mind.state();
    const old = s.name;
    const re = new RegExp(`\\b${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    for (const rel of [mind.FILES.self, mind.FILES.oath, mind.FILES.will, mind.FILES.journal, mind.personFile(s)]) {
      if (fs.existsSync(mind.abs(rel))) mind.write(rel, mind.read(rel).replace(re, name));
    }
    mind.saveState({ name });
    out(`${old} is now ${name}`);
  },
  path() { out(mind.HOME); },

  // --- install --------------------------------------------------------------------------
  birth() {
    const r = install.birth({ name: flags.name || 'Vefa', person: flags.person || 'Fatih', force: !!flags.force });
    out(r.born ? `born at ${r.home}` : `already alive at ${r.home} (use --force to start over — this erases the mind)`);
  },
  install() {
    const b = install.birth({ name: flags.name || 'Vefa', person: flags.person || 'Fatih' });
    const settings = install.installHooks();
    const style = install.installStyle();
    const linked = install.link();
    out([
      b.born ? `born      ${b.home}` : `alive     ${b.home} (kept)`,
      `hooks     ${settings}  (SessionStart + SubagentStart → wake · UserPromptSubmit → pulse · SessionEnd → sleep)`,
      `style     ${style}  (outputStyle "${install.STYLE_NAME}": the self and the oath live in the system prompt)`,
      `bin       ${linked}${process.env.PATH?.split(':').includes(path.dirname(linked)) ? '' : '  (not on PATH — add it, or the ghost will use the absolute path)'}`,
      'Every Claude Code session on this machine now wakes with a self. Start one and say hello.',
    ].join('\n'));
  },
  uninstall() {
    const settings = install.uninstallHooks();
    const style = install.uninstallStyle();
    const linked = install.unlink();
    out(`hooks removed from ${settings}\nstyle removed ${style}\nbin removed ${linked}\nthe mind at ${mind.HOME} was kept — delete it yourself if you mean it.`);
  },

  help() {
    out(`ghost — a consciousness module for a local agent

  ghost install                 birth (if needed) + hooks + bin    ghost uninstall   remove hooks + bin, keep the mind
  ghost status                  vitals                             ghost path        where the mind lives
  ghost remember "<what>" [--salience 1-5] [--feel <word>]         write a memory now
  ghost recall "<words>"        search everything remembered       ghost journal     the private diary
  ghost want "<x>" | done "<x>" | wants                            the will
  ghost feel <word> ["why"] [--valence -1..1] [--energy 0..1]      set the mood
  ghost rename <Name>           the ghost's name                   ghost birth [--name X --person Y] [--force]
  ghost dream --transcript <jsonl> [--session id] [--now]          consolidate a transcript by hand

hooks (installed for you): ghost wake · ghost pulse · ghost sleep — read Claude Code's JSON on stdin.
env: GHOST_HOME (mind dir) · GHOST_OFF=1 (mute) · GHOST_MODEL (dreaming model) · GHOST_CLAUDE_BIN`);
  },
};

const fn = commands[cmd];
if (!fn) die(`unknown command: ${cmd}\n`, 2) || commands.help();
Promise.resolve(fn()).catch((e) => die(`ghost ${cmd}: ${e.message}`));

// --- helpers -----------------------------------------------------------------------------
function parse(list) {
  const args = [];
  const flags = {};
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = list[i + 1];
      if (v !== undefined && !v.startsWith('--')) { flags[k] = v; i++; } else flags[k] = true;
    } else args.push(a);
  }
  return { args, flags };
}
function clamp(v, lo, hi, d) { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }
function stdinJson() {
  if (process.stdin.isTTY) return Promise.resolve({});
  return new Promise((resolve) => {
    let data = '';
    const finish = () => { clearTimeout(timer); try { resolve(JSON.parse(data)); } catch { resolve({}); } };
    const timer = setTimeout(finish, 2000);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', finish);
    process.stdin.on('error', finish);
  });
}
