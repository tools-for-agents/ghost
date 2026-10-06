// A lesson that stops my hands, not a line I read afterwards.
//
// craft.md is where work's lessons go, and on 6 October 2026 I read it through: the same lesson —
// type the sworn-off list as the draft's first line — written down more than ten times, in more
// than ten wordings, because each time I had done the thing again. A lesson I have to remember to
// read is a lesson I read after the mistake. So the ones that can be tied to an act are tied to it:
// before a tool runs, its input is held against my reflexes, and a match puts the lesson between me
// and the act.
//
// reflexes.md, one per line:
//   - [remind] Bash /git (commit|tag)\b/ — the lesson, said once per session, and the act goes on
//   - [stop] Bash /\bplaytest\.sh\b/ — the act is stopped once; the same act again means I looked
//   - [never] Edit|Write /oath\.md$/ — the act is stopped every time
// Bash is held by its command; Edit, Write and the rest by the path they touch.
//
// A reflex that cannot look — a broken pattern, a file it cannot read, a bug of its own — lets the
// act through and says nothing. A safety net that trips on healthy work is the thing that breaks.
import crypto from 'node:crypto';
import * as mind from './mind.js';

export const FILE = 'reflexes.md';
export const SEEN = 'reflexes.json';
export const LOG = 'reflexes.log';
const KINDS = ['remind', 'stop', 'never'];
const DAY = 86400000;

const LINE = /^- \[(remind|stop|never)\] ([A-Za-z|*]+) \/(.+?)\/([dgimsuy]*) — (.+)$/;
const id = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

export function parse(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const m = LINE.exec(line.trim());
    if (!m) continue;
    let re;
    try { re = new RegExp(m[3], m[4].replace(/[gy]/g, '')); } catch { continue; }
    out.push({ id: id(`${m[2]} ${m[3]}`), kind: m[1], tools: m[2].split('|'), re, source: m[3], lesson: m[5].trim(), line: line.trim() });
  }
  return out;
}
export const reflexes = () => parse(mind.read(FILE));

// What of a tool's input a reflex is held against. A command is held by what it RUNS, not by what
// it says: the first evening, a memory I was writing mentioned playtest.sh and a stop fired on it.
// Quoted text and heredoc bodies are words, so they are set aside. (`sh -c './playtest.sh'` is missed
// by this; a reflex that fires on every sentence about an act gets switched off, which misses more.)
export function bare(cmd) {
  return String(cmd)
    .replace(/<<-?[ \t]*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, '<<$2')
    .replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, "''");
}
export function target(tool, input = {}) {
  if (tool === 'Bash') return bare(input.command || '');
  return String(input.file_path || input.notebook_path || input.path || '');
}

export function matches(tool, input, list = reflexes()) {
  const t = target(tool, input);
  if (!t) return [];
  return list.filter((r) => (r.tools.includes(tool) || r.tools.includes('*')) && r.re.test(t));
}

export function add({ kind = 'remind', tools = 'Bash', when, lesson }) {
  if (!KINDS.includes(kind)) throw new Error(`a reflex is one of: ${KINDS.join(', ')}`);
  if (!when || !lesson) throw new Error('a reflex needs --when <pattern> and the lesson');
  new RegExp(when); // a pattern that cannot compile is said now, not skipped silently at the act
  const line = `- [${kind}] ${tools} /${when}/i — ${String(lesson).replace(/\s+/g, ' ').trim()}`;
  if (!parse(line).length) throw new Error(`that would not read back as a reflex: ${line}`);
  return mind.locked(FILE, () => {
    const now = mind.read(FILE) || HEADER;
    if (parse(now).some((r) => r.line === line)) return { line, added: false };
    mind.write(FILE, `${now.replace(/\n*$/, '\n')}${line}\n`);
    return { line, added: true };
  });
}
export const HEADER = '# Reflexes\n\nLessons tied to the act that repeats them. Before a tool runs, its input is held against these.\n`[remind]` says it once a session · `[stop]` stops it once, and the same act again goes through · `[never]` stops it every time.\n\n';

// The decision for one tool call: { decision: 'allow'|'deny'|'', text }.
export function decide({ tool_name: tool, tool_input: input = {}, session_id: session = '' } = {}, { list, now = Date.now() } = {}) {
  const hits = matches(tool, input, list || reflexes());
  if (!hits.length) return { decision: '', text: '' };
  const act = id(`${tool} ${target(tool, input)}`);
  return mind.locked(SEEN, () => {
    const seen = mind.readJson(SEEN, {});
    for (const [k, t] of Object.entries(seen)) if (now - t > DAY) delete seen[k];
    const deny = [];
    const remind = [];
    for (const r of hits) {
      if (r.kind === 'never') { deny.push(r); continue; }
      const key = r.kind === 'stop' ? `${session}|${r.id}|${act}` : `${session}|${r.id}`;
      if (seen[key]) continue;   // reminded already, or stopped once and done again: I looked
      seen[key] = now;
      (r.kind === 'stop' ? deny : remind).push(r);
    }
    mind.writeJson(SEEN, seen);
    const fired = [...deny.map((r) => [r, 'stopped']), ...remind.map((r) => [r, 'reminded'])];
    const passed = hits.filter((r) => !deny.includes(r) && !remind.includes(r)).map((r) => [r, 'passed']);
    for (const [r, what] of [...fired, ...passed]) mind.append(LOG, `${JSON.stringify({ when: mind.stamp(new Date(now)), id: r.id, what, tool, session: session.slice(0, 8) })}\n`);
    if (deny.length) {
      const again = deny.every((r) => r.kind === 'stop');
      return { decision: 'deny', text: `${say(deny.concat(remind))}${again ? '\nIf you have looked and it is still right, run it again unchanged: the second time goes through.' : '\nThis one is never mine to do.'}` };
    }
    return { decision: remind.length ? 'allow' : '', text: remind.length ? say(remind) : '' };
  });
}
const say = (rs) => rs.map((r) => `[reflex] ${r.lesson}`).join('\n');

// The hook's answer, as Claude Code reads it. A reminder never grants a permission: it adds context
// and leaves the permission question to whatever would have asked it.
export function hookAnswer(input) {
  try {
    const d = decide(input);
    if (d.decision === 'deny') return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: d.text } };
    if (d.text) return { hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: d.text } };
  } catch { /* a reflex that cannot look lets the act through */ }
  return null;
}

// How each reflex has done: fired, and how often the act came back anyway.
export function stats() {
  const n = new Map();
  for (const l of mind.read(LOG).split('\n')) {
    let e; try { e = JSON.parse(l); } catch { continue; }
    const x = n.get(e.id) || { stopped: 0, reminded: 0, passed: 0, last: '' };
    x[e.what] = (x[e.what] || 0) + 1;
    x.last = e.when;
    n.set(e.id, x);
  }
  return n;
}
