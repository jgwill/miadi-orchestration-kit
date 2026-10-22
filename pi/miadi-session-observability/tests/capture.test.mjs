import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, appendFile, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CaptureStore, archiveTranscript, sanitize, sha256, sessionPath, bounded, capRecord } from '../lib/storage.mjs';
import { registerObserver, usage, text } from '../lib/observer.mjs';
import { forwardOnce } from '../scripts/forward.mjs';
import { migratedSettings } from '../scripts/migrate-settings.mjs';

const secret = 'ghp_' + 'fakeTestCredentialValue0123456789';
const rows = async file => (await readFile(file, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
function context(id = 'test-session', file) {
  return { cwd: '/test', model: { provider: 'fake-provider', id: 'fake-model' },
    sessionManager: { getSessionId: () => id, getSessionFile: () => file, getSessionName: () => 'capture test' } };
}
async function temporary(t) {
  const root = await mkdtemp(join(tmpdir(), 'miadi-pi-test-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
async function harness(t) {
  const root = await mkdtemp(join(tmpdir(), 'miadi-pi-test-')), handlers = new Map(), warnings = [];
  let clock = 100;
  registerObserver({ on: (name, fn) => handlers.set(name, fn) }, { root, now: () => clock, warn: m => warnings.push(m) });
  const ctx = context();
  const send = async (name, extra = {}) => {
    const event = { type: name, ...extra }, original = structuredClone(event);
    const returned = await handlers.get(name)(event, ctx);
    assert.equal(returned, undefined, `${name} must not gate or transform`);
    assert.deepEqual(event, original, `${name} must not mutate events`);
  };
  await send('session_start', { reason: 'startup' });
  t.after(async () => {
    try { await send('session_shutdown', { reason: 'quit' }); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  return { root, dir: join(root, 'test-session'), send, warnings, ctx, setClock: n => clock = n };
}

test('sanitization protects nested payloads and database URLs', async () => {
  const clean = await sanitize({ input: { text: secret, content: 'postgres://user:password123@host/db' } });
  assert(!JSON.stringify(clean).includes(secret)); assert(!JSON.stringify(clean).includes('password123'));
});

test('legacy files, canonical telemetry, timing, errors and snapshot contracts', async t => {
  const h = await harness(t);
  await h.send('input', { text: `hello ${secret}`, source: 'interactive' });
  await h.send('before_agent_start', { prompt: 'hi', systemPrompt: `rules ${secret}`, systemPromptOptions: { selectedTools: ['read'], contextFiles: [{ path: '/AGENTS.md', content: secret }] } });
  await h.send('agent_start'); await h.send('turn_start', { turnIndex: 0 });
  await h.send('context_with_system', { messages: [{ role: 'user', content: secret }] });
  h.setClock(200); await h.send('message_update', { assistantMessageEvent: { type: 'text_delta', delta: 'Hi' } });
  h.setClock(400);
  const message = { role: 'assistant', provider: 'routed', model: 'other-model', content: [{ type: 'text', text: 'Hello' }],
    usage: { input: 2, output: 20, totalTokens: 22, cost: { total: 0.1 } }, stopReason: 'stop' };
  await h.send('message_end', { message });
  await h.send('tool_call', { toolCallId: 'tool-1', toolName: 'bash', input: { command: `echo ${secret}` } });
  h.setClock(450); await h.send('tool_result', { toolCallId: 'tool-1', toolName: 'bash', content: [{ type: 'text', text: 'failed' }], isError: true });
  await h.send('turn_end', { turnIndex: 0, message });
  await h.send('model_select', { model: { provider: 'new-provider', id: 'new-model' }, source: 'set' });
  await h.send('agent_end', { messages: [message] });
  const events = await rows(join(h.dir, '_pi_observability.jsonl'));
  assert.deepEqual(events.map(e => e.seq), events.map((_, i) => i));
  assert.equal(events.filter(e => e.type === 'agent_start').length, 1);
  const assistant = events.find(e => e.type === 'assistant_message');
  assert.equal(assistant.provider, 'routed'); assert.equal(assistant.model, 'other-model');
  assert.equal(assistant.payload.latency_ms, 300); assert.equal(assistant.payload.prefill_ms, 100);
  assert.equal(assistant.payload.generation_ms, 200); assert.equal(assistant.payload.output_tps, 100);
  assert.equal(assistant.payload.usage.cost_total, 0.1);
  assert.equal(events.find(e => e.type === 'tool_result').payload.duration_ms, 50);
  assert.equal(events.filter(e => e.type === 'error').length, 1);
  assert.equal(events.find(e => e.type === 'model_change').model, 'new-model');
  const start = events.find(e => e.type === 'agent_start');
  assert.equal(start.payload.system_prompt_sha256, sha256(start.payload.system_prompt));
  for (const file of await readdir(join(h.dir, '_pi_snapshots'))) {
    const contents = await readFile(join(h.dir, '_pi_snapshots', file), 'utf8');
    assert(!contents.includes(secret)); assert.equal(sha256(contents.trimEnd()), file.match(/-([a-f0-9]{64})\.json$/)[1]);
  }
  assert(!JSON.stringify(events).includes(secret));
  assert(!(await readFile(join(h.dir, '_pi_hooks_all.jsonl'), 'utf8')).includes(secret));
  assert.equal((await stat(join(h.dir, '_pi_observability.jsonl'))).mode & 0o777, 0o600);
  assert.equal((await stat(h.dir)).mode & 0o777, 0o700);
  assert.equal(h.warnings.length, 0);
});

test('reload preserves metadata and sequence without false terminal start/end bindings', async t => {
  const h = await harness(t);
  const original = await rows(join(h.dir, '_terminal_binding.jsonl'));
  await h.send('session_shutdown', { reason: 'reload' });
  await h.send('session_start', { reason: 'reload' });
  const binding = await rows(join(h.dir, '_terminal_binding.jsonl'));
  assert.deepEqual(binding, original);
  const journal = await rows(join(h.dir, '_pi_observability.jsonl'));
  assert.deepEqual(journal.map(e => e.seq), [0, 1, 2]);
  assert.deepEqual(journal.at(-1).payload.miadi.team, original[0].team);
  assert.equal(h.warnings.length, 0);
});

test('model failures, compaction reason and branch navigation map without fabricated lifecycle', async t => {
  const h = await harness(t);
  await h.send('message_end', { message: { role: 'assistant', content: [], stopReason: 'error', errorMessage: 'Synthetic model failure' } });
  await h.send('session_compact', { reason: 'threshold', fromExtension: false, compactionEntry: { tokensBefore: 100, firstKeptEntryId: 'keep', summary: 'Summary' } });
  await h.send('session_compact_failed', { reason: 'overflow', errorMessage: 'Synthetic compaction failure' });
  await h.send('session_tree', { oldLeafId: 'old', newLeafId: 'new', summaryEntry: { summary: 'Branch' } });
  const events = await rows(join(h.dir, '_pi_observability.jsonl'));
  assert.equal(events.filter(e => e.type === 'error').length, 2);
  assert.equal(events.find(e => e.type === 'compaction').payload.reason, 'auto');
  assert.equal(events.find(e => e.type === 'compaction').payload.trigger, 'threshold');
  assert.equal(events.find(e => e.type === 'branch_nav').payload.to_id, 'new');
  assert.equal(h.warnings.length, 0);
});

test('numeric token metadata remains valid JSON while numeric passwords are redacted', async () => {
  const clean = await sanitize({ total_tokens: 12345678, password: 12345678, api_key: 12345678 });
  assert.equal(clean.total_tokens, 12345678); assert.equal(clean.password, '[redacted]'); assert.equal(clean.api_key, '[redacted]');
});

test('resume ordering, partial-journal recovery and duplicate-writer protection', async t => {
  const root = await temporary(t), ctx = context();
  const a = await new CaptureStore(root, 'test-session').init();
  t.after(() => a.close());
  await a.emit('session_start', {}, ctx);
  const duplicate = new CaptureStore(root, 'test-session');
  await assert.rejects(duplicate.init(), /Another capture writer/);
  await a.close();
  await appendFile(join(a.dir, '_pi_observability.jsonl'), '{partial');
  const b = await new CaptureStore(root, 'test-session').init(); t.after(() => b.close());
  await b.emit('session_start', { reason: 'resume' }, ctx);
  assert.deepEqual((await rows(join(b.dir, '_pi_observability.jsonl'))).map(e => e.seq), [0, 1]);
});

test('transcript archive is incremental, sanitized, partial-line safe, and detects rewrites', async t => {
  const root = await temporary(t), source = join(root, 'source.jsonl');
  const store = await new CaptureStore(root, 'archive-test').init(); t.after(() => store.close());
  await writeFile(source, JSON.stringify({ type: 'message', value: secret }) + '\n');
  await archiveTranscript(store, source); await archiveTranscript(store, source);
  const file = join(store.dir, '_transcript_final.jsonl');
  assert.equal((await rows(file)).length, 1); assert(!(await readFile(file, 'utf8')).includes(secret));
  await appendFile(source, '{"partial":'); await archiveTranscript(store, source);
  assert.equal((await rows(file)).length, 1);
  await appendFile(source, 'true}\n'); await archiveTranscript(store, source);
  assert.equal((await rows(file)).length, 2);
  await writeFile(source, '{"replacement":true}\n'); await archiveTranscript(store, source);
  assert.deepEqual(await rows(file), [{ replacement: true }]);
  await appendFile(file, '{"interrupted":true}\n'); await archiveTranscript(store, source);
  assert.deepEqual(await rows(file), [{ replacement: true }]);
});

test('direct file capture lists credentials without copying them', async t => {
  const h = await harness(t), path = join(h.root, '.env');
  await writeFile(path, 'PASSWORD=notforcapture');
  await h.send('tool_call', { toolCallId: 'write-env', toolName: 'write', input: { path, content: secret } });
  await h.send('tool_result', { toolCallId: 'write-env', toolName: 'write', content: [], isError: false });
  const entries = await rows(join(h.dir, '_pi_files_written.jsonl'));
  assert(entries[0].note.includes('credentials')); assert.equal(entries[0].snapshot, undefined);
  const regular = join(h.root, 'output.md'); await writeFile(regular, `safe ${secret}`);
  await h.send('tool_call', { toolCallId: 'write-md', toolName: 'edit', input: { path: regular } });
  await h.send('tool_result', { toolCallId: 'write-md', toolName: 'edit', content: [], isError: false });
  const copied = (await rows(join(h.dir, '_pi_files_written.jsonl')))[1];
  assert(copied.snapshot); assert(!(await readFile(join(h.dir, copied.snapshot.path), 'utf8')).includes(secret));
});

test('capture failures never block tools or disclose exception payloads', async t => {
  const root = await temporary(t), warnings = [], handlers = new Map();
  await writeFile(join(root, 'not-a-dir'), 'x');
  registerObserver({ on: (n, fn) => handlers.set(n, fn) }, { root: join(root, 'not-a-dir'), warn: m => warnings.push(m) });
  assert.equal(await handlers.get('session_start')({ reason: 'startup' }, context()), undefined);
  assert.equal(await handlers.get('tool_call')({ input: { command: secret } }, context()), undefined);
  assert.equal(warnings.length, 1); assert(!warnings.join('').includes(secret));
});

test('a corrupt native transcript never disables capture or loses the shutdown binding', async t => {
  const h = await harness(t), source = join(h.root, 'corrupt.jsonl');
  await writeFile(source, `not-json-${secret}\n`);
  h.ctx.sessionManager.getSessionFile = () => source;
  await h.send('agent_end', { messages: [] });
  await h.send('tool_call', { toolCallId: 'after-corruption', toolName: 'read', input: { path: '/test' } });
  await h.send('session_shutdown', { reason: 'quit' });
  const journal = await rows(join(h.dir, '_pi_observability.jsonl'));
  assert(journal.some(e => e.type === 'tool_call')); assert.equal(journal.at(-1).type, 'session_shutdown');
  assert.equal((await rows(join(h.dir, '_terminal_binding.jsonl'))).at(-1).event, 'session.end');
  assert.equal(h.warnings.length, 2); assert(!h.warnings.join('').includes(secret));
});

test('transport retries stable events, rejects collisions, and checkpoints only acknowledged records', async t => {
  const root = await temporary(t), store = await new CaptureStore(root, 'forward-test').init(); t.after(() => store.close());
  const event = await store.emit('session_start', {}, context('forward-test'));
  const config = { root, id: 'forward-test', url: 'http://127.0.0.1:12345', token: 'fake' };
  await assert.rejects(forwardOnce({ ...config, fetchImpl: async () => { throw Error('offline'); } }));
  let sent;
  assert.equal(await forwardOnce({ ...config, fetchImpl: async (_url, opts) => {
    sent = JSON.parse(opts.body); return Response.json({ ingested: 1, rejected: [] });
  } }), 1);
  assert.equal(sent[0].event_id, event.event_id);
  assert.equal(await forwardOnce({ ...config, fetchImpl: async () => { throw Error('must not call'); } }), 0);
  const second = await store.emit('agent_start', {}, context('forward-test'));
  await assert.rejects(forwardOnce({ ...config, fetchImpl: async url => url.endsWith('/events') ?
    Response.json({ ingested: 0, rejected: [second.event_id] }) : Response.json({ events: [{ event_id: 'conflict' }] }) }), /sequence conflict/);
  assert.equal(await forwardOnce({ ...config, fetchImpl: async url => url.endsWith('/events') ?
    Response.json({ ingested: 0, rejected: [second.event_id] }) : Response.json({ events: [second] }) }), 1);
});

test('settings migration is scoped, additive, idempotent, and preserves unrelated config', () => {
  const original = { theme: 'dark', packages: [{ source: '/other', skills: [] }], extensions: [
    '/opt/binscripts/hooks/pi_hooks/event_capture.ts', '/other/extension.ts', '-builtin:mcp'] };
  const next = migratedSettings(original, '/kit/pi/miadi-session-observability');
  assert.deepEqual(next.extensions, ['/other/extension.ts', '-builtin:mcp']);
  assert.deepEqual(next.packages, [...original.packages, '/kit/pi/miadi-session-observability']);
  assert.equal(original.extensions.length, 3); assert.equal(next.theme, 'dark');
  assert.deepEqual(migratedSettings(next, '/kit/pi/miadi-session-observability'), next);
});

test('limits, invalid paths, and missing costs are explicit', () => {
  for (const id of ['../escape', '.', '..', '/absolute', '']) assert.throws(() => sessionPath('/root', id));
  assert.equal(text('ordinary assistant text', 'thinking'), '');
  assert.equal(usage(undefined).cost_reported, false); assert.equal(usage({ cost: { total: 0 } }).cost_reported, true);
  assert.match(bounded('x'.repeat(100), 10), /truncated/);
  assert.equal(capRecord({ text: 'large' }, 2).omitted, 'record size limit');
  assert.deepEqual(bounded({ type: 'image', data: secret }), { type: 'image', omitted: 'binary payload' });
});
