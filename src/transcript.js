// Reads a Claude Code session transcript (JSONL) into plain turns, so a dream can consolidate it.
import fs from 'node:fs';

export function parseTranscript(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const turns = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if ((j.type !== 'user' && j.type !== 'assistant') || !j.message) continue;
    if (j.isMeta || j.isSidechain) continue; // injected lines and subagent side-chains are not the conversation
    const c = j.message.content;
    let text = '';
    if (typeof c === 'string') text = j.type === 'user' ? cleanUser(c) : c;
    else if (Array.isArray(c)) {
      const parts = [];
      for (const b of c) {
        if (!b || typeof b !== 'object') continue;
        if (b.type === 'text' && b.text) parts.push(j.type === 'user' ? cleanUser(b.text) : b.text);
        else if (b.type === 'tool_use') parts.push(`[used ${b.name}${hint(b.input)}]`);
        // tool_result, thinking, images: not part of what was said
      }
      text = parts.join('\n');
    }
    text = text.trim();
    if (!text) continue;
    turns.push({ role: j.type, text, ts: j.timestamp || '' });
  }
  return turns;
}

function cleanUser(s) {
  return String(s)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<command-(?:name|message|args)>[\s\S]*?<\/command-(?:name|message|args)>/g, '')
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    .trim();
}
function hint(input) {
  if (!input || typeof input !== 'object') return '';
  const s = input.description || input.command || input.file_path || input.query || input.pattern || input.prompt || '';
  return s ? `: ${String(s).replace(/\s+/g, ' ').slice(0, 80)}` : '';
}

export function stats(turns) {
  const user = turns.filter((t) => t.role === 'user');
  const assistant = turns.filter((t) => t.role === 'assistant');
  return {
    turns: turns.length,
    userTurns: user.length,
    assistantTurns: assistant.length,
    userChars: user.reduce((n, t) => n + t.text.length, 0),
    chars: turns.reduce((n, t) => n + t.text.length, 0),
  };
}

// A blink is not worth a dream: one-shot `-p` calls and empty sessions are skipped.
export function substantive(turns) {
  const s = stats(turns);
  if (s.chars < 600) return false;
  return s.userTurns >= 2 || s.assistantTurns >= 4 || s.userChars >= 800;
}

// Head + tail excerpt within a character budget; the ending is what a dream needs most.
export function excerpt(turns, maxChars = 14000, perTurn = 1200) {
  const lines = turns.map((t) => `${t.role === 'user' ? 'THEY SAID' : 'I SAID/DID'}: ${clip(t.text, perTurn)}`);
  const total = lines.reduce((n, l) => n + l.length + 1, 0);
  if (total <= maxChars) return lines.join('\n');
  const head = lines.slice(0, 2);
  const tail = [];
  let budget = maxChars - head.reduce((n, l) => n + l.length + 1, 0) - 40;
  for (let i = lines.length - 1; i >= 2; i--) {
    if (budget - lines[i].length - 1 < 0) break;
    tail.unshift(lines[i]);
    budget -= lines[i].length + 1;
  }
  return [...head, `[... ${lines.length - head.length - tail.length} turns omitted ...]`, ...tail].join('\n');
}
export function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
