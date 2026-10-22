import { appendFile, chmod, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';

export const HOOKS = fileURLToPath(new URL('../hooks/', import.meta.url));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const sessionRoot = () => process.env.MIADI_SESSION_DIR || process.env.MIADI_SESSIONDATA_ROOT ||
  process.env.SESSION_DATA_ROOT || (existsSync('/src') ? '/src/_sessiondata' : join(homedir(), '_sessiondata'));
export function sessionPath(root, id) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.endsWith('.')) throw Error('Invalid Pi session id');
  return join(root, id);
}
export function runHook(script, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile('bash', ['-c', 'umask 077; exec bash "$@"', 'miadi-capture', script, ...args],
      { encoding: 'utf8', timeout: 5000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => error ? reject(Error('Capture helper failed')) : resolve(stdout.trimEnd()));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
export async function sanitize(value) {
  // Parse again: a missing/broken helper must never cause unsanitized fallback persistence.
  // The shared text sanitizer can mistake an 8-digit total_tokens for a credential and
  // replace an unquoted number with invalid JSON. Shield numeric metadata structurally;
  // genuinely credential-named numeric fields are redacted, not shielded.
  const numeric = `__miadi_numeric_${randomUUID()}`;
  const text = JSON.stringify(value, (key, v) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (/password|passwd|secret|api.?key|access.?key|private.?key|auth.?token|^token$/i.test(key)) return '[redacted]';
      return { [numeric]: String(v) };
    }
    return typeof v === 'bigint' ? String(v) : v instanceof Error ? { name: v.name, message: v.message } : v;
  });
  const clean = JSON.parse(await runHook(join(HOOKS, 'secret_capture_sanitizer.sh'), ['--stream'], text),
    (_key, v) => v && typeof v === 'object' && Object.keys(v).length === 1 && Object.hasOwn(v, numeric) ? Number(v[numeric]) : v);
  if (clean?.redacted === true && clean?.reason === 'secret sanitizer unavailable') throw Error('Sanitizer unavailable');
  return clean;
}

export async function privateWrite(path, text) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, text, { mode: 0o600 });
  await chmod(path, 0o600);
}
export async function atomicJson(path, value) {
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try { await privateWrite(tmp, `${JSON.stringify(value)}\n`); await rename(tmp, path); }
  finally { await unlink(tmp).catch(() => {}); }
}
export async function appendJson(path, value) {
  await appendFile(path, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

// Bound individual strings, omit binary blocks, and cap containers. Sanitization always precedes this.
export function bounded(value, limit = 64 * 1024, depth = 0) {
  if (typeof value === 'string') {
    const bytes = Buffer.byteLength(value);
    return bytes <= limit ? value : Buffer.from(value).subarray(0, limit).toString('utf8') + `\n[truncated: ${bytes} bytes total]`;
  }
  if (depth > 16) return '[depth limit]';
  if (Array.isArray(value)) return value.slice(0, 256).map(v => bounded(v, limit, depth + 1));
  if (value && typeof value === 'object') {
    if (value.type === 'image' || value.type === 'audio') return { type: value.type, omitted: 'binary payload' };
    return Object.fromEntries(Object.entries(value).slice(0, 256).map(([k, v]) => [k, bounded(v, limit, depth + 1)]));
  }
  return value;
}
export function capRecord(value, max = 1024 * 1024) {
  const text = JSON.stringify(value);
  return Buffer.byteLength(text) <= max ? value : { omitted: 'record size limit', bytes: Buffer.byteLength(text), sha256: sha256(text) };
}

export class CaptureStore {
  constructor(root, id) { this.dir = sessionPath(root, id); this.id = id; this.seq = 0; }
  async init() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
    await chmod(this.dir, 0o700);
    this.lock = join(this.dir, '.pi-observability.lock');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const handle = await open(this.lock, 'wx', 0o600);
        await handle.writeFile(String(process.pid)); await handle.close(); this.ownsLock = true; break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const pid = Number(await readFile(this.lock, 'utf8'));
        let alive = true;
        try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
        if (alive || !Number.isSafeInteger(pid) || pid < 1) throw Error('Another capture writer owns this session');
        await unlink(this.lock).catch(() => {});
      }
    }
    if (!this.ownsLock) throw Error('Could not acquire capture lock');
    // Recover ordering from durable journal, not an in-memory counter reset on resume/reload.
    const journal = join(this.dir, '_pi_observability.jsonl');
    const handle = await open(journal, 'a+', 0o600);
    try {
      const size = (await handle.stat()).size;
      const start = Math.max(0, size - 2 * 1024 * 1024);
      const buf = Buffer.alloc(size - start); await handle.read(buf, 0, buf.length, start);
      const end = buf.lastIndexOf(10);
      if (size && end < 0) throw Error('Journal has no complete record');
      if (size > start + end + 1) await handle.truncate(start + end + 1);
      const lines = buf.subarray(0, end + 1).toString('utf8').trimEnd().split('\n');
      if (size && lines.at(-1)) this.seq = JSON.parse(lines.at(-1)).seq + 1;
    } finally { await handle.close(); }
    return this;
  }
  async raw(event, payload, ctx) {
    const record = { source: 'pi-coding-agent', event, timestamp: new Date().toISOString(), session_id: this.id,
      cwd: ctx.cwd, payload: capRecord(bounded(payload)) };
    const clean = await sanitize(record);
    await appendJson(join(this.dir, '_pi_hooks_all.jsonl'), clean);
    await appendJson(join(this.dir, `_pi_${event}.jsonl`), clean);
    await atomicJson(join(this.dir, `last_pi_${event}.json`), clean);
  }
  async emit(type, payload, ctx, metadata = {}) {
    const envelope = { event_id: randomUUID(), ts: new Date().toISOString(), type, session_id: this.id,
      session_file: ctx.sessionManager.getSessionFile(), cwd: ctx.cwd,
      agent_name: ctx.sessionManager.getSessionName?.() || process.env.OBS_NAME || undefined,
      pool: process.env.OBS_POOL || metadata.team?.id || 'default',
      tags: [...new Set(['miadi', ...(process.env.OBS_TAG || '').split(',').filter(Boolean), ...(metadata.team?.id ? [metadata.team.id] : [])])],
      provider: ctx.model?.provider, model: ctx.model?.id, seq: this.seq,
      schema: 'miadi/pi-observability@1', miadi: metadata,
      // The reference server drops unknown envelope columns; mirror correlation inside its opaque payload.
      payload: { ...capRecord(bounded(payload, 128 * 1024)), miadi: metadata } };
    const clean = await sanitize(envelope);
    await appendJson(join(this.dir, '_pi_observability.jsonl'), clean); this.seq++;
    return clean;
  }
  async snapshot(kind, clean) {
    const data = capRecord(bounded(clean, 128 * 1024));
    const text = JSON.stringify(data); const hash = sha256(text);
    const path = `_pi_snapshots/${kind}-${hash}.json`;
    if (!existsSync(join(this.dir, path))) await privateWrite(join(this.dir, path), `${text}\n`);
    return { path, sha256: hash, bytes: Buffer.byteLength(text), bounded: true };
  }
  async close() { if (this.ownsLock) { this.ownsLock = false; await unlink(this.lock).catch(() => {}); } }
}

// Incremental sanitized archive. Source offsets and a trailing-source fingerprint detect rewrites;
// destination size detects an interrupted append or another writer. Partial source lines wait.
export async function archiveTranscript(store, source) {
  if (!source || !existsSync(source)) return;
  const dest = join(store.dir, '_transcript_final.jsonl');
  const marker = join(store.dir, '.pi-transcript-offset.json');
  let previous; try { previous = JSON.parse(await readFile(marker, 'utf8')); } catch {}
  const input = await open(source, 'r');
  try {
    const info = await input.stat();
    let offset = previous?.offset || 0;
    const trailingHash = async at => {
      const buf = Buffer.alloc(Math.min(256, at)); await input.read(buf, 0, buf.length, at - buf.length); return sha256(buf);
    };
    const destSize = await stat(dest).then(s => s.size).catch(() => 0);
    if (!previous || previous.source !== source || previous.ino !== info.ino || previous.dev !== info.dev ||
        offset > info.size || previous.destSize !== destSize || previous.tail !== await trailingHash(offset)) {
      offset = 0; await privateWrite(dest, '');
    }
    const startOffset = offset;
    // Read bounded chunks; a single giant line is skipped rather than retaining binary/huge blobs.
    let carry = Buffer.alloc(0), dropping = false;
    let pending = [];
    const flush = async () => {
      if (!pending.length) return;
      const clean = await sanitize(pending);
      await appendFile(dest, clean.map(line => JSON.stringify(capRecord(bounded(line))) + '\n').join(''), { mode: 0o600 });
      pending = [];
    };
    for (let position = offset; position < info.size;) {
      const buf = Buffer.alloc(Math.min(256 * 1024, info.size - position));
      const { bytesRead } = await input.read(buf, 0, buf.length, position);
      if (!bytesRead) break;
      position += bytesRead; carry = Buffer.concat([carry, buf.subarray(0, bytesRead)]);
      let end;
      while ((end = carry.indexOf(10)) !== -1) {
        const line = carry.subarray(0, end).toString('utf8'); carry = carry.subarray(end + 1);
        let clean;
        if (dropping || Buffer.byteLength(line) > 1024 * 1024) clean = { type: 'capture_omitted', reason: 'transcript line exceeds 1 MiB' };
        else clean = JSON.parse(line);
        pending.push(clean); offset = position - carry.length; dropping = false;
        if (pending.length >= 128) await flush();
      }
      if (carry.length > 1024 * 1024) { carry = Buffer.alloc(0); dropping = true; }
      await flush();
    }
    if (offset !== startOffset || !previous) await atomicJson(marker, { source, ino: info.ino, dev: info.dev,
      offset, destSize: (await stat(dest)).size, tail: await trailingHash(offset) });
  } finally { await input.close(); }
}
