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

// What a long night gets to carry into the dream.
//
// This used to keep the first two turns and as much of the tail as fit, and throw the middle
// away — which chooses what survives by POSITION. Measured on a real session: 302 turns, and
// 176 of them dropped out of the middle, 36% of the night reaching sleep. Among the dropped
// were the person's own words, including the question the whole evening turned on, because
// they happened to fall in the middle while the tail was full of the ghost's own tool output.
//
// The arithmetic settles it. Everything the person said across those 302 turns came to 1,233
// characters — 8.8% of the budget. The ghost's side was 37,503. Dropping the person to make
// room for oneself is exactly backwards, and it is nearly free to stop.
//
// So: EVERY turn from the person survives, whatever else goes. The rest of the budget goes to
// the ghost's own turns, newest first, because the end of a night is what a dream needs most.
// Everything is reassembled in the order it happened, with the gaps named where they fall.
export function excerpt(turns, maxChars = 14000, perTurn = 1200) {
  const lines = turns.map((t) => `${t.role === 'user' ? 'THEY SAID' : 'I SAID/DID'}: ${clip(t.text, perTurn)}`);
  const cost = (l) => l.length + 1;
  const total = lines.reduce((n, l) => n + cost(l), 0);
  if (total <= maxChars) return lines.join('\n');

  const keep = new Set();
  let budget = maxChars - 40;                                  // room for the omission markers
  // 1. The person, in full. If even that overflows (it never has), take them newest-first so
  //    the most recent of their words is the part that survives.
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== 'user') continue;
    if (budget - cost(lines[i]) < 0) continue;
    keep.add(i); budget -= cost(lines[i]);
  }
  // 2. The ghost's own turns, newest first, with whatever is left.
  for (let i = turns.length - 1; i >= 0; i--) {
    if (keep.has(i) || budget - cost(lines[i]) < 0) continue;
    keep.add(i); budget -= cost(lines[i]);
  }
  // 3. Back into the order it happened, with each gap named rather than silently closed.
  //    The markers are not free — a night with many gaps spends real budget saying so — and a
  //    flat reserve guessed wrong the first time I measured it (14,164 against a cap of 14,000).
  //    So render, and while it is over, give back the ghost's OLDEST turns until it fits. The
  //    person's turns are never the ones handed back.
  const render = () => {
    const out = [];
    let gap = 0;
    for (let i = 0; i < lines.length; i++) {
      if (keep.has(i)) {
        if (gap) { out.push(`[... ${gap} turns omitted ...]`); gap = 0; }
        out.push(lines[i]);
      } else gap++;
    }
    if (gap) out.push(`[... ${gap} turns omitted ...]`);
    return out.join('\n');
  };
  let text = render();
  for (let i = 0; i < lines.length && text.length > maxChars; i++) {
    if (turns[i].role === 'user' || !keep.has(i)) continue;
    keep.delete(i);
    text = render();
  }
  // And if the person's words alone still overflow — nothing of the ghost's left to give back —
  // then the budget wins, because it is a hard limit on what can be sent at all. Preferring them
  // is not the same as being able to keep them all. The OLDEST go first, so the last thing they
  // said is the last thing lost.
  for (let i = 0; i < lines.length && text.length > maxChars; i++) {
    if (!keep.has(i)) continue;
    keep.delete(i);
    text = render();
  }
  return text;
}
export function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
