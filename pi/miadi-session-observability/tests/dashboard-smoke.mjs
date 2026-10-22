#!/usr/bin/env node
// Optional reference-server integration. Explicitly synthetic; never calls a model or an agent tool.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { registerObserver } from '../lib/observer.mjs';
import { forwardOnce } from '../scripts/forward.mjs';

const url = process.env.OBS_SERVER_URL || 'http://127.0.0.1:43190';
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname), 'Use a loopback test server');
const token = process.env.OBS_AUTH_TOKEN || (await readFile(process.env.OBS_TOKEN_FILE, 'utf8')).trim();
const root = await mkdtemp(join(tmpdir(), 'miadi-pi-dashboard-'));
const id = `synthetic-contract-${randomUUID()}`;
process.env.OBS_POOL = 'T1-contract-validation';
const handlers = new Map(), warnings = [];
const ctx = { cwd: process.cwd(), model: { provider: 'synthetic', id: 'no-model-request' },
  sessionManager: { getSessionId: () => id, getSessionFile: () => undefined, getSessionName: () => 'SYNTHETIC T1 contract verification' } };
registerObserver({ on: (name, fn) => handlers.set(name, fn) }, { root, warn: message => warnings.push(message) });
const send = (type, fields = {}) => handlers.get(type)({ type, ...fields }, ctx);
try {
  await send('session_start', { reason: 'startup' });
  await send('input', { text: 'Synthetic dashboard contract verification; no real model or tool runs.' });
  await send('before_agent_start', { prompt: 'Synthetic fixture', systemPrompt: 'Synthetic system prompt', systemPromptOptions: { selectedTools: [] } });
  await send('agent_start'); await send('turn_start', { turnIndex: 0 });
  await send('context_with_system', { messages: [{ role: 'user', content: 'Synthetic fixture' }] });
  await send('tool_call', { toolCallId: 'synthetic-tool-1', toolName: 'fixture', input: {} });
  await send('tool_result', { toolCallId: 'synthetic-tool-1', toolName: 'fixture', content: [{ type: 'text', text: 'Synthetic expected error' }], isError: true });
  const message = { role: 'assistant', content: [{ type: 'text', text: 'Synthetic reply' }], usage: { input: 4, output: 6, totalTokens: 10, cost: { total: 0.123 } }, stopReason: 'stop' };
  await send('message_end', { message }); await send('turn_end', { turnIndex: 0, message });
  await send('model_select', { model: { provider: 'synthetic', id: 'changed-fixture' }, source: 'set' });
  await send('agent_end', { messages: [message] }); await send('session_shutdown', { reason: 'quit' });
  assert.deepEqual(warnings, []);
  const config = { root, id, url, token };
  while (await forwardOnce(config)) {}
  const headers = { Authorization: `Bearer ${token}` };
  const stats = await (await fetch(`${url}/sessions/${id}/stats`, { headers })).json();
  assert.equal(stats.total_tokens, 10); assert.equal(stats.total_cost, 0.123); assert.equal(stats.error_count, 1);
  const { events } = await (await fetch(`${url}/sessions/${id}/events`, { headers })).json();
  const start = events.find(e => e.type === 'agent_start');
  assert(start.payload.miadi.run_id); assert(start.payload.miadi.prompt_id);
  assert(start.payload.snapshot.sha256);
  console.log(JSON.stringify({ success: true, session_id: id, events: events.length,
    total_tokens: stats.total_tokens, reported_cost: stats.total_cost,
    errors: stats.error_count, correlation_survived_server: true }));
} finally { await rm(root, { recursive: true, force: true }); }
