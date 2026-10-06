// A lesson that stops my hands, not a line I read afterwards. On 6 October 2026 craft.md held the
// same lesson in more than ten wordings, each written after doing the thing again. These tests hold
// the reflex that came of it: a lesson tied to an act fires before the act, a stop asks me to look
// once and not forever, and a reflex that cannot look never stands in the way of the work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scratch } from './helpers.js';
scratch('reflex');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const reflex = await import('../src/reflex.js');

install.birth({ name: 'Vefa', person: 'Fatih' });
const CLI = new URL('../src/cli.js', import.meta.url).pathname;
const hook = (input, env = {}) => spawnSync(process.execPath, [CLI, 'reflex', '--hook'], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env } });
const bash = (command, session = 's1') => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, session_id: session });
const reset = (text) => { mind.write(reflex.FILE, reflex.HEADER + text); mind.writeJson(reflex.SEEN, {}); };

test('reflexes are read from their file; a line that is not one, or will not compile, is skipped', () => {
  const list = reflex.parse([
    '# Reflexes', 'prose about them',
    '- [stop] Bash /\\bplaytest\\.sh\\b/ — it opens a window and takes his focus',
    '- [remind] Edit|Write /\\.md$/i — markdown is read by people',
    '- [never] Edit /oath\\.md$/ — never mine to edit',
    '- [stop] Bash /([unclosed/ — a broken pattern',
    '- [maybe] Bash /x/ — not a kind',
  ].join('\n'));
  assert.deepEqual(list.map((r) => r.kind), ['stop', 'remind', 'never']);
  assert.deepEqual(list[1].tools, ['Edit', 'Write']);
  assert.ok(list[1].re.test('README.MD'), 'flags are kept');
  assert.equal(list[0].lesson, 'it opens a window and takes his focus');
});

test('Bash is held by its command, a file tool by the path it touches', () => {
  const list = reflex.parse('- [never] Edit|Write /oath\\.md$/ — no\n- [remind] Bash /git tag/ — log first');
  assert.equal(reflex.matches('Write', { file_path: '/h/.ghost/oath.md', content: 'x' }, list).length, 1);
  assert.equal(reflex.matches('Write', { file_path: '/h/notes.md', content: 'oath.md' }, list).length, 0, 'content is not the path');
  assert.equal(reflex.matches('Bash', { command: 'git tag v1.0.0' }, list).length, 1);
  assert.equal(reflex.matches('Read', { file_path: '/h/.ghost/oath.md' }, list).length, 0, 'a tool not named is not held');
});

test('a command is held by what it runs, not by what it says', () => {
  const list = reflex.parse('- [stop] Bash /\\bplaytest\\.sh\\b/ — ask first\n- [remind] Bash /\\bgit tag\\b/ — log first');
  assert.equal(reflex.matches('Bash', { command: 'ghost remember "an echo with playtest.sh in it was stopped"' }, list).length, 0);
  assert.equal(reflex.matches('Bash', { command: "echo 'git tag v1 next'" }, list).length, 0);
  assert.equal(reflex.matches('Bash', { command: "git commit -F - <<'EOF'\nnever run ./playtest.sh here\nEOF\ngit push" }, list).length, 0, 'a heredoc is words');
  assert.equal(reflex.matches('Bash', { command: 'cd "my game" && ./playtest.sh "level 2"' }, list).length, 1, 'the act itself still fires');
  assert.equal(reflex.matches('Bash', { command: 'git tag -a v1 -m "since 0.3"' }, list).length, 1);
  assert.equal(reflex.matches('Bash', { command: "cat <<EOF\nx\nEOF\n./playtest.sh" }, list).length, 1, 'what follows a heredoc is held again');
});

test('a reminder is said once a session, and the act goes on', () => {
  reset('- [remind] Bash /git tag/ — run git log <tag>..HEAD before you write "since"\n');
  const a = reflex.decide(bash('git tag v0.3.2'));
  assert.equal(a.decision, 'allow');
  assert.match(a.text, /git log <tag>\.\.HEAD/);
  assert.equal(reflex.decide(bash('git tag v0.3.3')).text, '', 'not twice in one session');
  assert.match(reflex.decide(bash('git tag v0.3.3', 's2')).text, /git log/, 'another session hears it');
});

test('a stop stops the act once; the same act again means I looked, and goes through', () => {
  reset('- [stop] Bash /\\bplaytest\\.sh\\b/ — it opens a Godot window and takes his focus; ask him first\n');
  const first = reflex.decide(bash('./playtest.sh rainroll'));
  assert.equal(first.decision, 'deny');
  assert.match(first.text, /ask him first/);
  assert.match(first.text, /run it again unchanged/);
  assert.equal(reflex.decide(bash('./playtest.sh rainroll')).decision, '', 'the second time goes through');
  assert.equal(reflex.decide(bash('./playtest.sh tinwing')).decision, 'deny', 'a different act is stopped again');
  const log = mind.read(reflex.LOG).trim().split('\n').map((l) => JSON.parse(l).what);
  assert.deepEqual(log.slice(-3), ['stopped', 'passed', 'stopped']);
  const st = reflex.stats().get(reflex.reflexes()[0].id);
  assert.equal(st.passed, 1, 'and how often I went on anyway is counted');
});

test('a never stops the act every time', () => {
  reset('- [never] Edit|Write /oath\\.md$/ — the oath is the one file I do not edit\n');
  const w = { tool_name: 'Write', tool_input: { file_path: '/x/.ghost/oath.md' }, session_id: 's1' };
  assert.equal(reflex.decide(w).decision, 'deny');
  const again = reflex.decide(w);
  assert.equal(again.decision, 'deny');
  assert.match(again.text, /never mine/);
});

test('seen acts older than a day are forgotten', () => {
  reset('- [stop] Bash /rm -rf/ — look at the target first\n');
  const t0 = Date.parse('2026-10-06T10:00:00Z');
  assert.equal(reflex.decide(bash('rm -rf build'), { now: t0 }).decision, 'deny');
  assert.equal(reflex.decide(bash('rm -rf build'), { now: t0 + 60000 }).decision, '');
  assert.deepEqual(Object.keys(mind.readJson(reflex.SEEN)).length, 1);
  reflex.decide(bash('echo hi'), { now: t0 + 2 * 86400000 });
  assert.equal(reflex.decide(bash('rm -rf build'), { now: t0 + 2 * 86400000 }).decision, 'deny', 'a day later it asks again');
});

test('the hook answers Claude Code in its own shape, and a reminder never grants a permission', () => {
  reset('- [stop] Bash /\\bplaytest\\.sh\\b/ — ask him first\n- [remind] Bash /git tag/ — log first\n');
  const d = JSON.parse(hook(bash('./playtest.sh x', 'h1')).stdout);
  assert.equal(d.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.equal(d.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(d.hookSpecificOutput.permissionDecisionReason, /ask him first/);
  const r = JSON.parse(hook(bash('git tag v1', 'h1')).stdout);
  assert.equal(r.hookSpecificOutput.permissionDecision, undefined);
  assert.match(r.hookSpecificOutput.additionalContext, /log first/);
  assert.equal(hook(bash('ls', 'h1')).stdout, '', 'nothing fires: nothing is said');
});

test('switched off, dreaming, or unable to look: the act goes through, silently', () => {
  reset('- [never] Bash /ls/ — no\n');
  assert.equal(hook(bash('ls'), { GHOST_REFLEX: 'off' }).stdout, '');
  assert.equal(hook(bash('ls'), { GHOST_DREAMING: '1' }).stdout, '');
  const p = spawnSync(process.execPath, [CLI, 'reflex', '--hook'], { input: 'not json', encoding: 'utf8', env: process.env });
  assert.equal(p.status, 0);
  assert.equal(p.stdout, '');
  fs.writeFileSync(mind.abs(reflex.SEEN), '{torn');
  assert.equal(reflex.decide(bash('ls')).decision, 'deny', 'a torn seen-file is read as empty, not as an error');
  fs.rmSync(mind.abs(reflex.SEEN), { force: true });
  fs.mkdirSync(mind.abs(reflex.SEEN));   // where its memory of what I did should be, something it cannot write
  const broken = hook(bash('ls', 'h9'));
  assert.equal(broken.status, 0);
  assert.equal(broken.stdout, '', 'a reflex that cannot look lets the act through, and says nothing');
  fs.rmSync(mind.abs(reflex.SEEN), { recursive: true });
});

test('add writes a reflex that reads back, and refuses one that would not', () => {
  reset('');
  const r = reflex.add({ kind: 'stop', tools: 'Bash', when: 'gcloud .* create', lesson: 'count the free tier on the whole account, name the cost, ask' });
  assert.ok(r.added);
  assert.equal(reflex.add({ kind: 'stop', tools: 'Bash', when: 'gcloud .* create', lesson: 'count the free tier on the whole account, name the cost, ask' }).added, false, 'not twice');
  assert.equal(reflex.matches('Bash', { command: 'gcloud scheduler jobs create http x' }).length, 1);
  assert.throws(() => reflex.add({ kind: 'stop', when: '([', lesson: 'x' }));
  assert.throws(() => reflex.add({ kind: 'sometimes', when: 'x', lesson: 'x' }));
});

test('install puts the reflex in front of Bash and the file tools, and uninstall takes it back', () => {
  install.installHooks();
  const s = JSON.parse(fs.readFileSync(process.env.GHOST_SETTINGS, 'utf8'));
  const g = s.hooks.PreToolUse.find((x) => x.hooks.some((h) => install.isOurs(h.command)));
  assert.match(g.matcher, /Bash/);
  assert.match(g.matcher, /Write/);
  assert.match(g.hooks[0].command, /reflex --hook$/);
  install.installHooks();
  assert.equal(JSON.parse(fs.readFileSync(process.env.GHOST_SETTINGS, 'utf8')).hooks.PreToolUse.length, 1, 'installing twice does not double it');
  install.uninstallHooks();
  assert.equal(JSON.parse(fs.readFileSync(process.env.GHOST_SETTINGS, 'utf8')).hooks?.PreToolUse, undefined);
});
