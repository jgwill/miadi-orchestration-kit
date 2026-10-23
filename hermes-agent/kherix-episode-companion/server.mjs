#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync, readFileSync, writeFileSync, readdirSync, existsSync, renameSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { createSpeechTools } from './media.mjs';
import { homedir } from 'node:os';

export const SESSION_ID = 'fe331909';
export const AGENT_ID = '3d3a349a';
const hash = value => createHash('sha256').update(value).digest('hex');
class Refusal extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

function serveBytes(req, res, bytes, mime) {
  const headers = { 'content-type': mime, 'accept-ranges': 'bytes', 'cache-control': 'private, no-store' };
  let start = 0, end = bytes.length - 1, status = 200;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match && (match[1] || match[2])) {
      if (!match[1]) { start = Math.max(0, bytes.length - Number(match[2])); }
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    }
    if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length || (!match[1] && Number(match[2]) === 0)) {
      res.writeHead(416, { ...headers, 'content-range': `bytes */${bytes.length}`, 'content-length': 0 }); res.end(); return;
    }
    status = 206; headers['content-range'] = `bytes ${start}-${end}/${bytes.length}`;
  }
  res.writeHead(status, { ...headers, 'content-length': end - start + 1 });
  res.end(req.method === 'HEAD' ? undefined : bytes.subarray(start, end + 1));
}

export async function createCompanionServer(options = {}) {
  const stateDir = options.stateDir ?? join(homedir(), '.local/state/kherix-episode-companion');
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  chmodSync(stateDir, 0o700);
  const upstreamFetch = options.upstreamFetch ?? fetch;
  const upstreamUrl = options.swarmclawUrl ?? 'http://127.0.0.1:3456';
  async function upstream(path, init = {}) {
    const response = await upstreamFetch(upstreamUrl + path, { ...init, headers: { ...init.headers, Cookie: `sc_auth=${options.accessKey}` }, redirect: 'error' });
    if (!response.ok) throw Object.assign(new Refusal(502, 'Pinned SwarmClaw request failed'), { upstreamStatus: response.status });
    return response;
  }
  // A read deadline includes both headers and JSON consumption. Never apply it
  // to the long-lived chat SSE, which retains its explicit cancellation signal.
  async function boundedRead(work) {
    const controller = new AbortController();
    controllers.add(controller);
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => controller.abort(new Refusal(504, 'Upstream read timed out')), options.upstreamTimeoutMs ?? 4000);
    try { return await Promise.race([aborted, work(controller.signal)]); }
    finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      controllers.delete(controller);
    }
  }
  async function session(signal) {
    const value = await (await upstream(`/api/chats/${SESSION_ID}`, { signal })).json();
    if (value.id !== SESSION_ID || value.agentId !== AGENT_ID) throw new Refusal(409, 'Pinned session identity is missing or mismatched');
    return { id: value.id, agentId: value.agentId, name: value.name, active: value.active === true };
  }
  const cleanText = value => {
    let text = typeof value === 'string' ? value : '';
    for (const secret of [options.accessKey, options.groqKey, options.authToken].filter(Boolean)) text = text.replaceAll(secret, '[redacted]');
    return text.replace(/\b(?:gsk_|sk-proj-|sk-)[A-Za-z0-9_-]{20,}\b/g, '[redacted]');
  };
  const send = (res, status, value) => sendJson(res, status, JSON.parse(JSON.stringify(value, (key, item) => typeof item === 'string' ? cleanText(item) : item)));
  function publicMessage(value) {
    return { id: hash(JSON.stringify([value.role, value.time, value.runId, value.text])), role: value.role, text: cleanText(value.text), time: value.time ?? null, runId: value.runId ?? null, streaming: value.streaming === true };
  }
  async function history() {
    await session();
    const value = await (await upstream(`/api/chats/${SESSION_ID}/messages?limit=100`)).json();
    return {
      messages: value.messages.filter(m => ['user', 'assistant'].includes(m.role) && !m.internal && typeof m.text === 'string').map(publicMessage),
      total: value.total, hasMore: value.hasMore, startIndex: value.startIndex,
    };
  }
  const activityResult = (state, detail, evidence = 'unavailable', queuedCount = null, activeRunId = null) => ({ state, activeRunId, queuedCount, updatedAt: new Date().toISOString(), detail, evidence });
  const validRunId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
  const validTurn = value => value && value.sessionId === SESSION_ID && validRunId(value.runId);
  async function activity() {
    let queuedCount = null;
    try {
      return await boundedRead(async signal => {
        await session(signal);
        // Authoritative SwarmClaw: chats/[id]/queue -> getSessionQueueSnapshot.
        // Counts exclude internal turns; an active pointer alone is not enough.
        const snapshot = await (await upstream(`/api/chats/${SESSION_ID}/queue`, { signal })).json();
        if (!snapshot || snapshot.sessionId !== SESSION_ID || (snapshot.activeRunId !== null && !validRunId(snapshot.activeRunId))
          || !Number.isSafeInteger(snapshot.queueLength) || snapshot.queueLength < 0 || !Array.isArray(snapshot.items) || snapshot.items.length !== snapshot.queueLength
          || snapshot.items.some(item => !validTurn(item))
          || (snapshot.activeTurn != null && (!validTurn(snapshot.activeTurn) || snapshot.activeTurn.runId !== snapshot.activeRunId))) {
          return activityResult('unknown', 'Queue activity is unverified; refresh to check again.');
        }
        queuedCount = snapshot.queueLength;
        if (snapshot.activeRunId) {
          // runs/[id] -> getUnifiedRunById, backed by the session run ledger.
          const ledger = await (await upstream(`/api/runs/${encodeURIComponent(snapshot.activeRunId)}`, { signal })).json();
          const matching = ledger?.id === snapshot.activeRunId && ledger.sessionId === SESSION_ID && (ledger.agentId === undefined || ledger.agentId === AGENT_ID);
          if (matching && ledger.internal === true && queuedCount > 0) {
            return activityResult('queued', 'Public turns are queued; no public running turn is confirmed.', 'queue_snapshot_and_run_ledger', queuedCount);
          }
          if (matching && ledger.internal === false) {
            if (ledger.status === 'running') return activityResult('running', 'A public turn is running in the pinned session.', 'queue_snapshot_and_run_ledger', queuedCount, ledger.id);
            if (['failed', 'error', 'cancelled', 'canceled', 'interrupted'].includes(ledger.status)) return activityResult('error', 'The observed public run failed or was cancelled; refresh to check current activity.', 'queue_snapshot_and_run_ledger', queuedCount);
          }
          return activityResult('unknown', 'Run activity is unverified or the run and queue snapshots disagree; refresh to check again.', 'queue_snapshot_and_run_ledger', queuedCount);
        }
        return activityResult(queuedCount > 0 ? 'queued' : 'idle', queuedCount > 0 ? 'Public turns are queued in the pinned session.' : 'No running or queued public turns in the pinned session.', 'queue_snapshot', queuedCount);
      });
    } catch (error) {
      const unavailable = error.upstreamStatus === 404 || error instanceof SyntaxError;
      const detail = error.status === 409 ? 'Pinned session identity could not be verified; activity is unavailable.'
        : error.status === 504 ? 'Activity read timed out; history can be checked independently.'
          : unavailable ? 'Upstream activity evidence is unavailable or unverified; refresh to check again.'
            : 'Activity could not be read from SwarmClaw; history can be checked independently.';
      return activityResult(unavailable ? 'unknown' : 'error', detail, queuedCount === null ? 'unavailable' : 'queue_snapshot', queuedCount);
    }
  }
  function context() {
    let value = {};
    try { value = JSON.parse(readFileSync(join(stateDir, 'context.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Refusal(503, 'Context file is invalid'); }
    const out = {};
    const nestedKeys = new Set(['address', 'stableAddress', 'path', 'url', 'id', 'title', 'name', 'kind', 'status', 'ref', 'label', 'description']);
    const cleanMetadata = (item, depth = 0) => {
      if (depth > 5) return null;
      if (typeof item === 'string') return cleanText(item).slice(0, 20000);
      if (Array.isArray(item)) return item.slice(0, 100).map(value => cleanMetadata(value, depth + 1));
      if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).filter(([key]) => nestedKeys.has(key)).map(([key, value]) => [key, cleanMetadata(value, depth + 1)]));
      return typeof item === 'number' || typeof item === 'boolean' ? item : null;
    };
    for (const key of ['intention', 'envisionedResult', 'corrections', 'pendingWork', 'source', 'staging', 'episode', 'stableAddress']) {
      if (value[key] !== undefined) out[key] = cleanMetadata(value[key]);
    }
    return out;
  }
  const receipts = new Map();
  const jobs = new Set();
  const controllers = new Set();
  let closed = false;
  const receiptsDir = join(stateDir, 'receipts');
  mkdirSync(receiptsDir, { recursive: true, mode: 0o700 });
  chmodSync(receiptsDir, 0o700);
  for (const name of readdirSync(receiptsDir).filter(name => /^[0-9a-f]{64}\.json$/.test(name))) {
    const receipt = JSON.parse(readFileSync(join(receiptsDir, name), 'utf8'));
    if (receipt.sessionId !== SESSION_ID || receipt.agentId !== AGENT_ID || hash(receipt.clientId) + '.json' !== name) throw new Error('Stored receipt identity mismatch');
    receipts.set(receipt.clientId, receipt);
    if (!['completed', 'error'].includes(receipt.state)) saveReceipt(receipt, { state: 'unknown_execution', error: 'Service restarted with uncertain execution. Never resent automatically.' });
  }
  function durableBytes(file, bytes) {
    const temporary = `${file}.${randomUUID()}.tmp`;
    writeFileSync(temporary, bytes, { mode: 0o600 });
    const fd = openSync(temporary, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, file);
    const dir = openSync(dirname(file), 'r');
    try { fsyncSync(dir); } finally { closeSync(dir); }
  }
  function durableJson(file, value) { durableBytes(file, JSON.stringify(value) + '\n'); }
  const takes = new Map();
  const takesDir = join(stateDir, 'takes');
  mkdirSync(takesDir, { recursive: true, mode: 0o700 });
  chmodSync(takesDir, 0o700);
  for (const name of readdirSync(takesDir).filter(name => /^[0-9a-f]{64}\.json$/.test(name))) {
    const take = JSON.parse(readFileSync(join(takesDir, name), 'utf8'));
    if (hash(take.id) + '.json' !== name) throw new Error('Stored take identity mismatch');
    takes.set(take.id, take);
    if (['stored', 'transcribing'].includes(take.state)) saveTake(take, { state: 'interrupted', error: 'Transcription was interrupted. Audio is preserved; retry explicitly.' });
  }
  const publicTake = take => ({ id: take.id, state: take.state, bytes: take.bytes, mime: take.mime, capture: take.capture ?? null, transcript: take.transcript ?? '', error: take.error ?? null, createdAt: take.createdAt, audio: `/api/takes/${take.id}/audio` });
  function captureInfo(header) {
    if (header === undefined) return null; // Older clients and explicit audio uploads remain supported.
    if (typeof header !== 'string' || header.length > 2048) throw new Refusal(400, 'Invalid capture diagnostics');
    let value;
    try { value = JSON.parse(header); } catch { throw new Refusal(400, 'Invalid capture diagnostics'); }
    const limits = { elapsedMs: 86400000, lastChunkAtMs: 86400000, chunkCount: 100000, muteCount: 100000, endedCount: 100000 };
    const keys = new Set(['version', 'stopReason', 'errorName', ...Object.keys(limits)]);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.has(key)) || value.version !== 'direct-v1'
      || !['requested', 'recorder-error', 'track-ended', 'unexpected', 'limit', 'stop-timeout'].includes(value.stopReason)
      || typeof value.errorName !== 'string' || !/^[A-Za-z]{0,64}$/.test(value.errorName)
      || Object.entries(limits).some(([key, max]) => !Number.isSafeInteger(value[key]) || value[key] < 0 || value[key] > max)
      || value.lastChunkAtMs > value.elapsedMs) throw new Refusal(400, 'Invalid capture diagnostics');
    return value;
  }
  function saveTake(take, fields = {}) {
    if (closed) return take;
    Object.assign(take, fields, { updatedAt: new Date().toISOString() });
    durableJson(join(takesDir, `${hash(take.id)}.json`), take);
    takes.set(take.id, take);
    return take;
  }
  function track(work) {
    const job = new Promise(resolve => setImmediate(resolve)).then(() => { if (!closed) return work(); });
    jobs.add(job); job.finally(() => jobs.delete(job)).catch(() => {});
  }
  function transcribeTake(take) {
    track(async () => {
      saveTake(take, { state: 'transcribing', error: null });
      try {
        if (!options.transcribe) throw new Error('STT unavailable');
        const transcript = await options.transcribe({ path: join(takesDir, `${hash(take.id)}.audio`), mime: take.mime, language: 'en' });
        if (typeof transcript !== 'string' || !transcript.trim()) throw new Error('Empty transcript');
        saveTake(take, { state: 'ready', transcript: cleanText(transcript), error: null });
      } catch (error) {
        const explanation = error.code === 'NO_USABLE_AUDIO'
          ? 'The recording contains silence or an extremely quiet microphone signal. Audio is preserved; check the microphone signal and record again.'
          : 'Transcription failed. Recording is preserved; you can retry or download it.';
        saveTake(take, { state: 'failed', transcript: error.code === 'NO_USABLE_AUDIO' ? '' : take.transcript, error: explanation });
      }
    });
  }
  function saveReceipt(receipt, fields = {}) {
    if (closed) return receipt;
    Object.assign(receipt, fields, { updatedAt: new Date().toISOString() });
    durableJson(join(receiptsDir, `${hash(receipt.clientId)}.json`), receipt);
    receipts.set(receipt.clientId, receipt);
    return receipt;
  }
  async function reconcile(receipt) {
    if (!receipt.runId) {
      saveReceipt(receipt, { state: 'unknown_execution', error: 'No attributable run was returned. Inspect the existing session; this receipt will not be resent.' });
      return;
    }
    const ledger = await (await upstream(`/api/runs/${encodeURIComponent(receipt.runId)}`)).json();
    if (ledger.id !== receipt.runId || ledger.sessionId !== SESSION_ID) throw new Refusal(502, 'Run identity did not match the pinned session');
    if (['queued', 'running'].includes(ledger.status)) saveReceipt(receipt, { state: ledger.status, evidence: 'run_ledger' });
    else if (['failed', 'error', 'cancelled', 'canceled', 'interrupted'].includes(ledger.status)) saveReceipt(receipt, { state: 'error', evidence: 'run_ledger', error: 'Run failed or was cancelled; inspect the existing session before retrying' });
    else if (ledger.status === 'completed') {
      const thread = await history();
      if (thread.messages.some(m => m.role === 'assistant' && m.runId === receipt.runId && !m.streaming && m.text.trim())) {
        saveReceipt(receipt, { state: 'completed', evidence: 'ledger_and_history', error: null });
      } else {
        saveReceipt(receipt, { state: 'reply_unverified', evidence: 'run_ledger', error: 'The run finished, but final reply attribution is unavailable. Read the conversation; nothing will be resent automatically.' });
      }
    }
  }
  async function execute(receipt) {
    const controller = new AbortController();
    controllers.add(controller);
    try {
      await session();
      // Dispatch is not evidence that SwarmClaw has started the model. The
      // attributable run ledger promotes this receipt to running on readback.
      saveReceipt(receipt, { state: 'queued', dispatchedAt: new Date().toISOString() });
      const response = await upstream(`/api/chats/${SESSION_ID}/chat`, {
        method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ message: receipt.text, internal: false, queueMode: 'followup' }), signal: controller.signal,
      });
      const reader = response.body.getReader();
      const cancel = () => { reader.cancel().catch(() => {}); };
      controller.signal.addEventListener('abort', cancel, { once: true });
      let buffer = '';
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll('\r\n', '\n');
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
            if (!data) continue;
            const event = JSON.parse(data);
            if (event.t === 'md' && !receipt.runId) {
              let metadata;
              try { metadata = JSON.parse(event.text); } catch { continue; }
              if (typeof metadata?.run?.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(metadata.run.id)) saveReceipt(receipt, { runId: metadata.run.id });
            }
            if (event.t === 'err') saveReceipt(receipt, { state: 'error', error: 'SwarmClaw reported a run failure; inspect the existing session before retrying' });
            if (event.t === 'done') saveReceipt(receipt, { streamEnded: true });
          }
        }
      } finally { controller.signal.removeEventListener('abort', cancel); reader.releaseLock(); }
      if (receipt.state !== 'error') await reconcile(receipt);
    } catch {
      saveReceipt(receipt, receipt.dispatchedAt
        ? { state: 'unknown_execution', error: 'Execution is uncertain; inspect the existing session. This receipt will not be resent.' }
        : { state: 'error', error: 'Pinned session could not be verified. Nothing was forwarded; no replacement session was created.' });
    }
    finally { controllers.delete(controller); }
  }
  async function readBody(req, limit) {
    if (Number(req.headers['content-length']) > limit) throw new Refusal(413, 'Request body too large');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > limit) throw new Refusal(413, 'Request body too large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async function readJson(req) {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new Refusal(415, 'Use application/json');
    const body = await readBody(req, 64 * 1024);
    let value;
    try { value = JSON.parse(body.toString('utf8')); } catch { throw new Refusal(400, 'Invalid JSON'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Refusal(400, 'Use a JSON object');
    return value;
  }
  function checkBrowserBoundary(req) {
    const localHost = `127.0.0.1:${server.address()?.port}`;
    const publicOrigin = options.publicUrl ? new URL(options.publicUrl).origin : null;
    const hosts = new Set([localHost, `localhost:${server.address()?.port}`, `[::1]:${server.address()?.port}`, publicOrigin && new URL(publicOrigin).host]);
    if (!hosts.has(req.headers.host)) throw new Refusal(403, 'Host is not configured');
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new Refusal(403, 'Cross-site requests are not allowed');
    if (req.headers.origin) {
      const expected = publicOrigin ?? `http://${req.headers.host}`;
      if (req.headers.origin !== expected) throw new Refusal(403, 'Cross-origin requests are not allowed');
    }
  }
  const speechDir = join(stateDir, 'speech');
  mkdirSync(speechDir, { recursive: true, mode: 0o700 }); chmodSync(speechDir, 0o700);
  const voicing = new Map();
  async function replyAudio(id) {
    const thread = await history();
    const message = thread.messages.find(m => m.id === id && m.role === 'assistant' && !m.streaming && m.text.trim());
    if (!message) throw new Refusal(404, 'No speakable assistant reply in the pinned history');
    const voice = options.voice ?? 'en-US-GuyNeural';
    const path = join(speechDir, `${hash(`${id}:${voice}`)}.mp3`);
    if (!existsSync(path)) {
      if (!voicing.has(path)) voicing.set(path, (async () => {
        if (!options.synthesize) throw new Refusal(503, 'Kherix speech rendering is not configured');
        if (message.text.length > 20000) throw new Refusal(413, 'Reply is too long to voice in one request');
        durableBytes(`${path}.txt`, message.text);
        try {
          const bytes = await options.synthesize({ text: message.text, voice, outputPath: path });
          if (!bytes?.length) throw new Error('No speech bytes');
          durableBytes(path, bytes);
        } catch { throw new Refusal(502, 'Kherix voice could not render this reply; its text remains available'); }
      })().finally(() => voicing.delete(path)));
      await voicing.get(path);
    }
    return readFileSync(path);
  }
  const constantEqual = (left, right) => timingSafeEqual(Buffer.from(hash(String(left))), Buffer.from(hash(String(right))));
  const sign = text => createHmac('sha256', options.authToken || '').update(text).digest('hex');
  function unlock(res) {
    const value = `${Date.now() + 12 * 60 * 60 * 1000}.${randomUUID()}`;
    res.setHeader('set-cookie', `kherix_auth=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${options.publicUrl?.startsWith('https:') ? '; Secure' : ''}`);
    return send(res, 200, { authenticated: true });
  }
  function authenticate(req) {
    if (!options.authToken) throw new Refusal(503, 'Companion authentication is not configured');
    const bearer = req.headers.authorization?.replace(/^Bearer /, '');
    if (req.headers.authorization?.startsWith('Bearer ') && bearer && constantEqual(bearer, options.authToken)) return;
    const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('kherix_auth='))?.slice(12);
    if (cookie) {
      const [expiry, nonce, signature] = cookie.split('.');
      if (/^\d+$/.test(expiry) && Number(expiry) > Date.now() && nonce && signature && constantEqual(signature, sign(`${expiry}.${nonce}`))) return;
    }
    throw new Refusal(401, 'Unlock this private companion');
  }
  const server = createServer(async (req, res) => {
    try {
      checkBrowserBoundary(req);
      res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      res.setHeader('x-content-type-options', 'nosniff');
      res.setHeader('referrer-policy', 'no-referrer');
      res.setHeader('permissions-policy', 'microphone=(self), camera=()');
      const url = new URL(req.url, 'http://companion');
      const assets = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/state.js': ['state.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'] };
      if (req.method === 'GET' && assets[url.pathname]) {
        const [file, type] = assets[url.pathname];
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
        return res.end(readFileSync(new URL(`./public/${file}`, import.meta.url)));
      }
      if (req.method === 'POST' && url.pathname === '/api/pair') {
        if (!options.authToken) throw new Refusal(503, 'Companion authentication is not configured');
        const body = await readJson(req);
        let grant;
        try { grant = JSON.parse(readFileSync(join(stateDir, 'pairing.json'), 'utf8')); } catch { throw new Refusal(401, 'Pairing link is invalid or expired; request a new one on the desktop'); }
        if (typeof body.code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.code) || !Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now() || !constantEqual(hash(body.code), grant.digest)) throw new Refusal(401, 'Pairing link is invalid or expired; request a new one on the desktop');
        // Consume synchronously before issuing the cookie. Never persist the raw code.
        durableJson(join(stateDir, 'pairing.json'), { digest: '', expiresAt: 0 });
        return unlock(res);
      }
      if (req.method === 'POST' && url.pathname === '/api/auth') {
        if (!options.authToken) throw new Refusal(503, 'Companion authentication is not configured');
        const body = await readJson(req);
        if (!constantEqual(body.token || '', options.authToken)) throw new Refusal(401, 'Companion token was refused');
        return unlock(res);
      }
      if (options.allowedLogin && (req.headers['tailscale-user-login'] || req.headers['x-forwarded-for']) && req.headers['tailscale-user-login'] !== options.allowedLogin) throw new Refusal(403, 'Forwarded login is not allowed');
      authenticate(req);
      const audioRoute = url.pathname.match(/^\/api\/replies\/([0-9a-f]{64})\/audio$/);
      if (audioRoute && ['GET', 'HEAD'].includes(req.method)) return serveBytes(req, res, await replyAudio(audioRoute[1]), 'audio/mpeg');
      if (req.method === 'POST' && url.pathname === '/api/takes') {
        const id = req.headers['x-client-id'];
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(id)) throw new Refusal(400, 'A stable x-client-id recording ID is required');
        const mime = req.headers['content-type']?.split(';')[0].trim().toLowerCase();
        if (!['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm'].includes(mime)) throw new Refusal(415, 'Record mp4, m4a, wav or webm audio');
        const capture = captureInfo(req.headers['x-capture-info']);
        const bytes = await readBody(req, 25 * 1024 * 1024);
        if (!bytes.length) throw new Refusal(400, 'Recording is empty');
        const digest = hash(bytes);
        const earlier = takes.get(id);
        if (earlier) {
          if (earlier.digest !== digest || earlier.mime !== mime) throw new Refusal(409, 'Recording ID already belongs to different bytes');
          return send(res, 202, { take: publicTake(earlier), duplicate: true });
        }
        durableBytes(join(takesDir, `${hash(id)}.audio`), bytes);
        const take = saveTake({ id, mime, capture, digest, bytes: bytes.length, state: 'stored', createdAt: new Date().toISOString() });
        send(res, 202, { take: publicTake(take) }); transcribeTake(take); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/takes') return send(res, 200, { takes: [...takes.values()].map(publicTake).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) });
      const takeAction = url.pathname.match(/^\/api\/takes\/([A-Za-z0-9_-]{8,100})\/(audio|transcribe)$/);
      if (takeAction) {
        const take = takes.get(takeAction[1]);
        if (!take) throw new Refusal(404, 'Take not found');
        if (req.method === 'GET' && takeAction[2] === 'audio') {
          res.writeHead(200, { 'content-type': take.mime, 'cache-control': 'private, no-store' });
          res.end(readFileSync(join(takesDir, `${hash(take.id)}.audio`))); return;
        }
        if (req.method === 'POST' && takeAction[2] === 'transcribe') {
          await readJson(req);
          if (!['transcribing', 'stored'].includes(take.state)) {
            saveTake(take, { state: 'stored', error: null }); transcribeTake(take);
          }
          return send(res, 202, { take: publicTake(take) });
        }
      }
      const takeRoute = url.pathname.match(/^\/api\/takes\/([A-Za-z0-9_-]{8,100})$/);
      if (req.method === 'GET' && takeRoute) {
        const take = takes.get(takeRoute[1]);
        if (!take) throw new Refusal(404, 'Take not found');
        return send(res, 200, { take: publicTake(take) });
      }
      if (req.method === 'POST' && url.pathname === '/api/messages') {
        const { text, clientId } = await readJson(req);
        if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(clientId)) throw new Refusal(400, 'clientId must be 8–100 letters, digits, dashes or underscores');
        if (typeof text !== 'string' || !text.trim()) throw new Refusal(400, 'Message text is required');
        if (text.length > 20000) throw new Refusal(413, 'Message text is limited to 20000 characters');
        const earlier = receipts.get(clientId);
        if (earlier) {
          if (earlier.text !== text) throw new Refusal(409, 'clientId already belongs to different text');
          return send(res, 202, { receipt: earlier, duplicate: true });
        }
        const receipt = saveReceipt({ id: randomUUID(), clientId, text, state: 'queued', sessionId: SESSION_ID, agentId: AGENT_ID, createdAt: new Date().toISOString(), runId: null });
        send(res, 202, { receipt });
        const job = new Promise(resolve => setImmediate(resolve)).then(() => execute(receipt));
        jobs.add(job); job.finally(() => jobs.delete(job));
        return;
      }
      const receiptRoute = url.pathname.match(/^\/api\/receipts\/([A-Za-z0-9_-]+)$/);
      if (req.method === 'GET' && receiptRoute) {
        const receipt = receipts.get(receiptRoute[1]);
        if (!receipt) throw new Refusal(404, 'Receipt not found');
        if (receipt.runId && !['completed', 'error'].includes(receipt.state)) {
          try { await session(); await reconcile(receipt); } catch { /* Read-only reconciliation never replays a request. */ }
        }
        return send(res, 200, { receipt });
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { status: 'ready', session: await session() });
      if (req.method === 'GET' && url.pathname === '/api/context') return send(res, 200, { session: await session(), context: context(), desktopPath: `/agents/${AGENT_ID}`, desktopUrl: options.desktopUrl || null });
      if (req.method === 'GET' && url.pathname === '/api/activity') return send(res, 200, await activity());
      if (req.method === 'GET' && url.pathname === '/api/thread') return send(res, 200, await history());
      throw new Refusal(404, 'Route not found');
    } catch (error) { send(res, error.status ?? 500, { error: error.status ? error.message : 'Companion request failed' }); }
  });
  return { server, async close() {
    if (closed) return;
    closed = true;
    for (const controller of controllers) controller.abort();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await Promise.allSettled([...jobs]);
  } };
}

async function main() {
  process.umask(0o077);
  const config = loadConfig();
  if (!config.authToken) throw new Error('Companion authentication must be configured with KHERIX_COMPANION_AUTH_TOKEN');
  if (!config.accessKey) throw new Error('SwarmClaw ACCESS_KEY is not configured');
  const tools = createSpeechTools({ groqKey: config.groqKey, edgeTts: config.edgeTts });
  const app = await createCompanionServer({ ...config, ...tools });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject); app.server.listen(config.port, config.host, resolve);
  });
  console.log(`Kherix companion listening on loopback port ${config.port}; pinned session ${SESSION_ID}, agent ${AGENT_ID}.`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    const deadline = setTimeout(() => process.exit(0), 5000); deadline.unref();
    await app.close(); clearTimeout(deadline); process.exit(0);
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Only configuration errors are printed. Never echo an upstream/provider exception.
    const safe = /^(Companion|SwarmClaw|Public URL|M1 session|A configured)/.test(error.message) ? error.message : 'Startup failed; verify the private configuration and listener';
    console.error(safe); process.exitCode = 1;
  });
}
