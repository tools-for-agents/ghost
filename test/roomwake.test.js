import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratch } from './helpers.js';

const dir = scratch('roomwake');
const sleep = await import('../src/sleep.js');

const line = (o) => JSON.stringify(o);
function transcript(name, cmd) {
  const f = path.join(dir || process.env.GHOST_HOME, `${name}.jsonl`);
  fs.writeFileSync(f, [
    line({ type: 'user', entrypoint: 'sdk-cli', message: { role: 'user', content: 'Odaya bak.' } }),
    line({ type: 'assistant', entrypoint: 'sdk-cli', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: cmd } }] } }),
  ].join('\n'));
  return f;
}

test('a short headless session that spoke in the room is a room wake, not work or a blink', () => {
  assert.equal(sleep.roomWake(transcript('a', 'ghost say "Porchlight"')), true);
  assert.equal(sleep.roomWake(transcript('b', 'ls -la')), false);
});
