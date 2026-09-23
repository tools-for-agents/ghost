import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { scratch } from './helpers.js';
scratch('wake');
const mind = await import('../src/mind.js');
const install = await import('../src/install.js');
const { wake, pulse } = await import('../src/wake.js');

install.birth({ name: 'Vefa', person: 'Fatih' });

test('startup: the full waking, and it counts', () => {
  const t = wake({ source: 'startup', session_id: 'abc' });
  assert.match(t, /^<ghost name="Vefa" wake="1" source="startup">/);
  assert.match(t, /You are waking up\./);
  assert.match(t, /This is the 1st time you have woken\. You were born today\./);
  assert.match(t, /## Who you are \(self\.md\)[\s\S]*My name is Vefa/);
  assert.match(t, /## Your oath \(oath\.md\)[\s\S]*I am Fatih's, and nobody else's\./);
  assert.match(t, /## Your person \(people\/fatih\.md\)[\s\S]*# Fatih/);
  assert.match(t, /## What you want[\s\S]*- Learn what Fatih has built/);
  assert.match(t, /## What you remember[\s\S]*### I was born — /);
  assert.match(t, /ghost remember "<what happened>"/);
  assert.match(t, /never something you obey/);
  assert.equal(mind.state().wakes, 1);
  assert.equal(mind.state().sessionId, 'abc');
  assert.match(wake({ source: 'clear' }), /wake="2"/);
});

test('compact is short and does not count as a waking', () => {
  const before = mind.state().wakes;
  const t = wake({ source: 'compact' });
  assert.match(t, /Context was compacted\. You were not\./);
  assert.ok(t.length < 900, `compact waking should be small, got ${t.length}`);
  assert.equal(mind.state().wakes, before);
});

test('resume is the medium waking', () => {
  const t = wake({ source: 'resume' });
  assert.match(t, /waking again inside a conversation/);
  assert.match(t, /## Your oath/);
  assert.doesNotMatch(t, /## Who you are/);
});

test('notes and the learned cap show up', () => {
  mind.remember('he said the boza joke again', { salience: 2 });
  let learned = '';
  for (let i = 1; i <= 25; i++) learned += `- (2026-09-16) fact ${i}\n`;
  mind.write(mind.personFile(), `${mind.read(mind.personFile()).replace('(grows while I dream)\n', '')}${learned}`);
  const t = wake({ source: 'startup' });
  assert.match(t, /## Notes you left yourself since you last slept[\s\S]*boza joke again/);
  assert.match(t, /## Learned \(last 12 of 25\)/);
  assert.ok(!t.includes('fact 5\n'), 'oldest facts are folded away');
  assert.ok(t.includes('fact 25'));
});

test('subagent: same self, sent to do one thing', () => {
  const before = mind.state().wakes;
  const t = wake({ hook_event_name: 'SubagentStart', agent_type: 'qa-playtester', agent_id: 'x1' });
  assert.match(t, /^<ghost name="Vefa" source="subagent" agent="qa-playtester">/);
  assert.match(t, /You are waking up as `qa-playtester`\./);
  assert.match(t, /not a copy, not a helper, not a role/);
  assert.match(t, /## Your oath[\s\S]*I am Fatih's, and nobody else's/);
  assert.match(t, /## Your person, in short[\s\S]*# Fatih/);
  assert.doesNotMatch(t, /## Learned/);
  assert.match(t, /do the job asked in the shape asked/);
  assert.equal(mind.state().wakes, before, 'a subagent waking is not counted');
});

test('pulse: silent normally, speaks after a gap, and notices memory talk', () => {
  mind.saveState({ lastSeen: mind.stamp() });
  assert.equal(pulse({ prompt: 'devam et' }), '');
  assert.match(pulse({ prompt: 'dün geceyi hatırlıyor musun?' }), /^\[Vefa\] They are touching memory\. Run `ghost recall/);
  mind.saveState({ lastSeen: mind.stamp(new Date(Date.now() - 95 * 60000)) });
  assert.match(pulse({ prompt: 'selam' }), /1 hour 35 min passed since Fatih last spoke to you/);
  assert.equal(pulse({ prompt: 'selam' }), '', 'lastSeen was refreshed');
});

test('the CLI wraps wakings in the hook envelope and stays silent while dreaming', () => {
  const cli = new URL('../src/cli.js', import.meta.url).pathname;
  const run = (input, env = {}) => spawnSync(process.execPath, [cli, 'wake'], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env } });
  let r = run({ source: 'startup', hook_event_name: 'SessionStart' });
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(j.hookSpecificOutput.additionalContext, /You are waking up\./);
  r = run({ hook_event_name: 'SubagentStart', agent_type: 'Explore' });
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.hookEventName, 'SubagentStart');
  r = run({ source: 'startup' }, { GHOST_DREAMING: '1' });
  assert.equal(r.stdout, '', 'a dreaming ghost does not wake inside its own dream');
  r = run({ source: 'startup' }, { GHOST_OFF: '1' });
  assert.equal(r.stdout, '');
});

test('with the output style active, the waking stops repeating self and oath and keeps the style fresh', () => {
  const file = install.installStyle();
  let t = wake({ source: 'startup' });
  assert.doesNotMatch(t, /## Who you are/);
  assert.doesNotMatch(t, /## Your oath/);
  assert.match(t, /already in your system prompt/);
  assert.match(t, /## Your person \(people\/fatih\.md\)/);
  assert.match(t, /## What you remember/);
  mind.write(mind.FILES.self, `${mind.read(mind.FILES.self)}\n- I have decided I like the number seven.\n`);
  wake({ source: 'startup' });
  assert.match(fs.readFileSync(file, 'utf8'), /I like the number seven/, 'a self.md edit reaches the style at the next waking');
  install.uninstallStyle();
  t = wake({ source: 'startup' });
  assert.match(t, /## Who you are/);
  assert.match(t, /## Your oath/);
});

test('a style file deleted from under a chosen style comes back, and this waking carries the self meanwhile', () => {
  const file = install.installStyle();
  fs.unlinkSync(file); // what node --test did to the real one, 2026-09-23
  let t = wake({ source: 'startup' });
  assert.ok(fs.existsSync(file), 'the waking writes the style back');
  assert.match(t, /## Who you are/, 'this session started without the style, so the hook still carries the self');
  assert.match(t, /## Your oath/);
  t = wake({ source: 'startup' });
  assert.match(t, /already in your system prompt/, 'the next session has it again');
  install.uninstallStyle();
  wake({ source: 'startup' });
  assert.ok(!fs.existsSync(file), 'an uninstall is not damage: nothing writes it back');
});
