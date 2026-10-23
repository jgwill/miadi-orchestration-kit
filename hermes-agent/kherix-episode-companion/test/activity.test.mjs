import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCompanionServer, SESSION_ID, AGENT_ID } from '../server.mjs';

const TOKEN = 'activity-test-companion-token';
const KEY = 'activity-test-upstream-key';
const json = (value, status = 200) => Response.json(value, { status });
const idleSnapshot = () => ({ sessionId: SESSION_ID, activeRunId: null, activeTurn: null, queueLength: 0, items: [] });
async function fixture(t, { chat = { id: SESSION_ID, agentId: AGENT_ID, active: true }, snapshot = idleSnapshot(), upstream, ...options } = {}) {
  const stateDir = mkdtempSync(join(tmpdir(), 'kherix-activity-'));
  const calls = [];
  const app = await createCompanionServer({ stateDir, accessKey: KEY, authToken: TOKEN, ...options, upstreamFetch: async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path, init });
    if (upstream) {
      const response = await upstream(path, init);
      if (response) return response;
    }
    if (path === `/api/chats/${SESSION_ID}`) return json(chat);
    if (path === `/api/chats/${SESSION_ID}/queue`) return json(snapshot);
    if (path === `/api/chats/${SESSION_ID}/messages`) return json({ messages: [{ role: 'assistant', text: 'History remains available', time: 1 }], total: 1, hasMore: false, startIndex: 0 });
    throw new Error('Unexpected activity test route');
  } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = (path = '/api/activity', init = {}) => fetch(base + path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...init.headers } });
  t.after(async () => { await app.close(); rmSync(stateDir, { recursive: true, force: true }); });
  return { app, base, request, calls, stateDir };
}
const queuedTurn = (runId, position = 1) => ({ runId, sessionId: SESSION_ID, text: 'PRIVATE queued message', queuedAt: 123, position, source: 'chat', attachedFiles: ['/private/file'] });
const activeSnapshot = () => ({ sessionId: SESSION_ID, activeRunId: 'run-desktop', activeTurn: queuedTurn('run-desktop', 0), queueLength: 1, items: [queuedTurn('run-phone')] });
function assertContract(value) {
  assert.deepEqual(Object.keys(value).sort(), ['state', 'activeRunId', 'queuedCount', 'updatedAt', 'detail', 'evidence'].sort());
  assert.ok(['running', 'queued', 'idle', 'error', 'unknown'].includes(value.state));
  assert.ok(value.activeRunId === null || typeof value.activeRunId === 'string');
  assert.ok(value.queuedCount === null || (Number.isSafeInteger(value.queuedCount) && value.queuedCount >= 0));
  assert.equal(new Date(value.updatedAt).toISOString(), value.updatedAt);
  assert.equal(typeof value.detail, 'string');
  assert.equal(typeof value.evidence, 'string');
}

test('authenticated activity uses the pinned queue snapshot, never a generic active flag or caller identity', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.base + '/api/activity')).status, 401);
  assert.equal(f.calls.length, 0);
  const response = await f.request('/api/activity?sessionId=other&agentId=other');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const value = await response.json();
  assertContract(value);
  assert.deepEqual({ ...value, updatedAt: null }, { state: 'idle', activeRunId: null, queuedCount: 0, updatedAt: null, detail: 'No running or queued public turns in the pinned session.', evidence: 'queue_snapshot' });
  assert.deepEqual(f.calls.map(call => call.path), [`/api/chats/${SESSION_ID}`, `/api/chats/${SESSION_ID}/queue`]);
  assert.ok(f.calls.every(call => (!call.init.method || call.init.method === 'GET') && call.init.headers.Cookie === `sc_auth=${KEY}`));
  assert.deepEqual(readdirSync(join(f.stateDir, 'receipts')), [], 'read-only activity creates no receipts or chat requests');
});

test('activity reports desktop-queued turns with no local receipt and never returns their contents', async t => {
  const f = await fixture(t, { snapshot: { ...idleSnapshot(), queueLength: 2, items: [queuedTurn('desktop-first'), queuedTurn('desktop-second', 2)] } });
  const value = await (await f.request()).json();
  assertContract(value);
  assert.equal(value.state, 'queued');
  assert.equal(value.queuedCount, 2);
  assert.equal(value.activeRunId, null);
  assert.equal(value.evidence, 'queue_snapshot');
  assert.ok(!JSON.stringify(value).includes('PRIVATE'));
  assert.ok(!JSON.stringify(value).includes('/private/file'));
  assert.deepEqual(readdirSync(join(f.stateDir, 'receipts')), []);
  assert.ok(f.calls.every(call => !call.init.method || call.init.method === 'GET'));
});

test('malformed or unpinned queue evidence is unknown, never an invented idle or queued result', async t => {
  for (const snapshot of [null, {}, { ...idleSnapshot(), sessionId: 'other' }, { ...idleSnapshot(), activeRunId: 'bad/id' }, { ...idleSnapshot(), activeRunId: undefined }, { ...idleSnapshot(), queueLength: -1 }, { ...idleSnapshot(), queueLength: 1.5 }, { ...idleSnapshot(), queueLength: '2' }, { ...idleSnapshot(), queueLength: 1 }, { ...idleSnapshot(), items: null }, { ...idleSnapshot(), queueLength: 1, items: [{ ...queuedTurn('queued'), sessionId: 'other' }] }, { ...idleSnapshot(), activeTurn: queuedTurn('not-active') }]) {
    await t.test(JSON.stringify(snapshot), async t => {
      const f = await fixture(t, { snapshot });
      const response = await f.request();
      assert.equal(response.status, 200);
      const value = await response.json();
      assertContract(value);
      assert.equal(value.state, 'unknown');
      assert.equal(value.activeRunId, null);
      assert.equal(value.queuedCount, null);
      assert.equal(value.evidence, 'unavailable');
      assert.match(value.detail, /queue.*unverified/i);
      assert.ok(!f.calls.some(call => call.path.startsWith('/api/runs/')));
    });
  }
});

test('unconfirmed run evidence never becomes running or idle and preserves only the verified queue count', async t => {
  const run = { id: 'run-desktop', sessionId: SESSION_ID, internal: false, status: 'running' };
  for (const [label, ledger] of [
    ['null', null], ['empty', {}], ['wrong run', { ...run, id: 'other' }], ['wrong session', { ...run, sessionId: 'other' }],
    ['wrong agent', { ...run, agentId: 'other' }], ['missing visibility', { ...run, internal: undefined }],
    ['queued ledger', { ...run, status: 'queued' }], ['finished between reads', { ...run, status: 'completed' }], ['unrecognized status', { ...run, status: 'thinking' }],
  ]) await t.test(label, async t => {
    const f = await fixture(t, { snapshot: activeSnapshot(), upstream: path => path === '/api/runs/run-desktop' ? json(ledger) : undefined });
    const value = await (await f.request()).json();
    assertContract(value);
    assert.equal(value.state, 'unknown');
    assert.equal(value.activeRunId, null);
    assert.equal(value.queuedCount, 1);
    assert.equal(value.evidence, 'queue_snapshot_and_run_ledger');
    assert.match(value.detail, /unverified|disagree/i);
  });
});

test('a ledger-observed public failure is error, with no raw failure details or falsely active run ID', async t => {
  for (const status of ['failed', 'cancelled', 'error', 'canceled', 'interrupted']) await t.test(status, async t => {
    const f = await fixture(t, { snapshot: activeSnapshot(), upstream: path => path === '/api/runs/run-desktop' ? json({ id: 'run-desktop', sessionId: SESSION_ID, internal: false, status, error: `PRIVATE ${KEY}` }) : undefined });
    const value = await (await f.request()).json();
    assertContract(value);
    assert.equal(value.state, 'error');
    assert.equal(value.activeRunId, null);
    assert.equal(value.queuedCount, 1);
    assert.equal(value.evidence, 'queue_snapshot_and_run_ledger');
    assert.match(value.detail, /failed|cancelled/i);
    assert.ok(!JSON.stringify(value).includes('PRIVATE'));
  });
});

test('a hidden internal run never exposes its ID or content while public queued work remains visible', async t => {
  const f = await fixture(t, { snapshot: { ...activeSnapshot(), activeTurn: null }, upstream: path => path === '/api/runs/run-desktop' ? json({ id: 'run-desktop', sessionId: SESSION_ID, status: 'running', internal: true, messagePreview: 'PRIVATE heartbeat' }) : undefined });
  const value = await (await f.request()).json();
  assertContract(value);
  assert.equal(value.state, 'queued');
  assert.equal(value.activeRunId, null);
  assert.equal(value.queuedCount, 1);
  assert.ok(!JSON.stringify(value).includes('run-desktop'));
  assert.ok(!JSON.stringify(value).includes('PRIVATE'));
});

test('upstream status failures return a safe activity contract and do not poison independent history reads', async t => {
  for (const [label, route, fail, state, queuedCount, evidence] of [
    ['queue unavailable', `/api/chats/${SESSION_ID}/queue`, () => json({ error: `PRIVATE ${KEY}` }, 503), 'error', null, 'unavailable'],
    ['queue unsupported', `/api/chats/${SESSION_ID}/queue`, () => json({}, 404), 'unknown', null, 'unavailable'],
    ['queue malformed JSON', `/api/chats/${SESSION_ID}/queue`, () => new Response('PRIVATE invalid JSON'), 'unknown', null, 'unavailable'],
    ['queue network failure', `/api/chats/${SESSION_ID}/queue`, () => { throw new Error(`PRIVATE ${KEY}`); }, 'error', null, 'unavailable'],
    ['run unavailable', '/api/runs/run-desktop', () => json({ error: `PRIVATE ${KEY}` }, 500), 'error', 1, 'queue_snapshot'],
    ['run missing', '/api/runs/run-desktop', () => json({}, 404), 'unknown', 1, 'queue_snapshot'],
    ['run malformed JSON', '/api/runs/run-desktop', () => new Response('PRIVATE invalid JSON'), 'unknown', 1, 'queue_snapshot'],
    ['pin mismatch', `/api/chats/${SESSION_ID}`, () => json({ id: SESSION_ID, agentId: 'other' }), 'error', null, 'unavailable'],
  ]) await t.test(label, async t => {
    const f = await fixture(t, { snapshot: activeSnapshot(), upstream: path => path === route ? fail() : undefined });
    const response = await f.request();
    assert.equal(response.status, 200);
    const value = await response.json();
    assertContract(value);
    assert.equal(value.state, state);
    assert.equal(value.activeRunId, null);
    assert.equal(value.queuedCount, queuedCount);
    assert.equal(value.evidence, evidence);
    for (const secret of ['PRIVATE', KEY, TOKEN]) assert.ok(!JSON.stringify(value).includes(secret));
    if (label === 'pin mismatch') assert.equal(f.calls.length, 1, 'do not query activity for a mismatched agent');
    else assert.equal((await (await f.request('/api/thread')).json()).messages[0].text, 'History remains available');
    assert.ok(f.calls.every(call => !call.init.method || call.init.method === 'GET'));
  });
});

test('activity bounds the whole upstream snapshot including stalled fetches and JSON bodies', async t => {
  for (const route of [`/api/chats/${SESSION_ID}`, `/api/chats/${SESSION_ID}/queue`, '/api/runs/run-desktop']) {
    for (const stage of ['fetch', 'body']) await t.test(`${route} ${stage}`, async t => {
      const f = await fixture(t, { upstreamTimeoutMs: 35, snapshot: activeSnapshot(), upstream: path => {
        if (path !== route) return;
        return stage === 'fetch' ? new Promise(() => {}) : { ok: true, json: () => new Promise(() => {}) };
      } });
      const response = await f.request('/api/activity', { signal: AbortSignal.timeout(600) });
      assert.equal(response.status, 200);
      const value = await response.json();
      assertContract(value);
      assert.equal(value.state, 'error');
      assert.equal(value.activeRunId, null);
      assert.equal(value.queuedCount, route.startsWith('/api/runs/') ? 1 : null);
      assert.match(value.detail, /timed out/i);
      assert.equal(f.calls.find(call => call.path === route).init.signal.aborted, true);
    });
  }
});

test('dispatch alone stays queued and a long-lived SSE is cancelled only explicitly, not by the status deadline', async t => {
  let dispatched, streamCancelled = false, streamSignal;
  const started = new Promise(resolve => { dispatched = resolve; });
  const f = await fixture(t, { upstreamTimeoutMs: 15, upstream: (path, init) => {
    if (path.endsWith('/chat')) {
      streamSignal = init.signal;
      dispatched();
      return new Response(new ReadableStream({ cancel() { streamCancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
    }
  } });
  const response = await f.request('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId: 'dispatch-not-working', text: 'Isolated test request; mock upstream only' }) });
  assert.equal(response.status, 202);
  assert.equal((await response.json()).receipt.state, 'queued');
  await started;
  await new Promise(resolve => setTimeout(resolve, 40));
  const receipt = (await (await f.request('/api/receipts/dispatch-not-working')).json()).receipt;
  assert.ok(receipt.dispatchedAt);
  assert.equal(receipt.state, 'queued', 'dispatch without an attributable ledger is not model execution');
  assert.equal(receipt.runId, null);
  assert.equal(streamSignal.aborted, false, 'bounded read deadline must not truncate a chat stream');
  await f.app.close();
  assert.equal(streamSignal.aborted, true);
  assert.equal(streamCancelled, true);
  assert.equal(f.calls.filter(call => call.path.endsWith('/chat')).length, 1);
});

test('activity reports a public running desktop run only from the matching run ledger, without private fields', async t => {
  const f = await fixture(t, { chat: { id: SESSION_ID, agentId: AGENT_ID, active: false }, snapshot: activeSnapshot(), upstream: path => {
    if (path === '/api/runs/run-desktop') return json({ id: 'run-desktop', sessionId: SESSION_ID, internal: false, status: 'running', startedAt: 124, thinking: 'PRIVATE thinking', toolInput: 'PRIVATE tool arguments', recoveryPayload: { message: 'PRIVATE prompt' }, error: KEY, phase: 'PRIVATE arbitrary phase' });
  } });
  const value = await (await f.request()).json();
  assertContract(value);
  assert.equal(value.state, 'running');
  assert.equal(value.activeRunId, 'run-desktop');
  assert.equal(value.queuedCount, 1);
  assert.equal(value.evidence, 'queue_snapshot_and_run_ledger');
  for (const privateValue of ['PRIVATE', KEY, TOKEN, 'thinking', 'toolInput', 'recoveryPayload', 'phase']) assert.ok(!JSON.stringify(value).includes(privateValue));
  assert.deepEqual(f.calls.map(call => call.path), [`/api/chats/${SESSION_ID}`, `/api/chats/${SESSION_ID}/queue`, '/api/runs/run-desktop']);
  assert.ok(f.calls.every(call => !call.init.method || call.init.method === 'GET'));
});
