// Before a session becomes a memory, the secrets come out of it.
//
// A dream reads the whole transcript and hands it to the substrate, then writes what comes back
// into episodes, the journal and their said-file — files that are kept for ever and read at every
// waking. A key an agent once printed with `cat .env` would travel that whole way. Measured on the
// first ghost's machine: one Firebase private key was sitting in a transcript, waiting to be dreamt.
//
// If keep (tools-for-agents/keep) is installed, every value in its vault is masked, in every shape
// it knows (raw, URL, JSON, base64 at any alignment). Without it, the shapes of well-known keys are
// still masked here. Either way a secret becomes ‹keep:NAME›, and the dream is about the work.
import { spawnSync } from 'node:child_process';

const KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|(?:\\n|\\r|\s|[A-Za-z0-9+/=])*)/g;
const SHAPES = [
  ['anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/g],
  ['openai', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
  ['github', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}/g],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ['stripe', /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/g],
  ['google-api', /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ['npm', /\bnpm_[A-Za-z0-9]{36}\b/g],
];

export function shapes(text) {
  let s = String(text).replace(KEY_BLOCK, '‹keep:private-key›');
  for (const [label, re] of SHAPES) s = s.replace(re, `‹keep:${label}›`);
  return s;
}

export function scrub(text) {
  const s = String(text);
  if (!s) return s;
  const bin = process.env.GHOST_KEEP_BIN || 'keep';
  if (bin !== 'off') {
    const r = spawnSync(bin, ['redact', '--patterns'], { input: s, encoding: 'utf8', timeout: 30000, maxBuffer: 64e6 });
    if (!r.error && r.status === 0 && typeof r.stdout === 'string' && (r.stdout.length || !s.length)) return r.stdout;
  }
  return shapes(s);
}
