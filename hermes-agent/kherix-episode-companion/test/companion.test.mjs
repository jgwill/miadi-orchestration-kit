import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const module = await import('../server.mjs').catch(() => ({}));
const SESSION = 'fe331909';
const AGENT = '3d3a349a';
const TOKEN = 'test-companion-token-not-a-real-secret';
const KEY = 'test-upstream-key-not-a-real-secret';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const tick = () => new Promise(resolve => setTimeout(resolve, 15));

async function fixture(t, extra = {}) {
  assert.equal(typeof module.createCompanionServer, 'function', 'a working server factory must exist');
  const stateDir = extra.stateDir ?? mkdtempSync(join(tmpdir(), 'kherix-test-'));
  const calls = [];
  const upstream = extra.upstream ?? (async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith(`/api/chats/${SESSION}`)) return json({ id: SESSION, agentId: AGENT, name: 'Existing Kherix', active: false });
    if (String(url).endsWith(`/api/chats/${SESSION}/messages?limit=100`)) return json({ messages: [
      { role: 'system', text: 'private system instructions' },
      { role: 'tool', text: 'private tool payload' },
      { role: 'assistant', text: 'private internal', internal: true },
      { role: 'user', text: 'Continue here', time: 123 },
      { role: 'assistant', text: 'I am here.', time: 124, runId: 'run-previous', thinking: 'private thinking' },
    ], total: 5, hasMore: false, startIndex: 0 });
    throw new Error(`unexpected test route ${url}`);
  });
  const app = await module.createCompanionServer({ stateDir, accessKey: KEY, authToken: TOKEN, upstreamFetch: upstream, ...extra });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const request = (path, options = {}) => fetch(base + path, { ...options, headers: { authorization: `Bearer ${TOKEN}`, ...options.headers } });
  t.after(async () => { await app.close(); if (!extra.keepState) rmSync(stateDir, { recursive: true, force: true }); });
  return { app, request, base, stateDir, calls };
}

function conversation({ terminal = 'completed', eventError = false, truncate = false } = {}) {
  const calls = [];
  let finish;
  let ended = false;
  const gate = new Promise(resolve => { finish = () => { ended = true; resolve(); }; });
  const upstream = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path, init });
    if (path === `/api/chats/${SESSION}`) return json({ id: SESSION, agentId: AGENT, active: false });
    if (path.endsWith('/messages')) return json({ messages: ended ? [{ role: 'assistant', text: 'A grounded answer', time: 456, runId: 'run-new' }] : [], total: ended ? 1 : 0, hasMore: false, startIndex: 0 });
    if (path === '/api/runs/run-new') return json({ id: 'run-new', sessionId: SESSION, status: ended ? terminal : 'running' });
    if (path.endsWith('/chat')) {
      return new Response(new ReadableStream({ async start(controller) {
        const encode = text => new TextEncoder().encode(text);
        controller.enqueue(encode('data: {"t":"md","text":"{\\"run\\":{\\"id\\":\\"run-new\\"}}"}\n\n'));
        await gate;
        if (eventError) controller.enqueue(encode('data: {"t":"err","text":"private diagnostic"}\n\n'));
        if (!truncate) controller.enqueue(encode('data: {"t":"done"}\n\n'));
        controller.close();
      } }), { headers: { 'content-type': 'text/event-stream' } });
    }
    throw new Error('Unexpected route');
  };
  return { upstream, calls, finish };
}
const post = data => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
async function waitReceipt(request, clientId, state) {
  for (let i = 0; i < 80; i++) {
    const r = await request(`/api/receipts/${clientId}`);
    const value = await r.json();
    if (value.receipt?.state === state) return value.receipt;
    await tick();
  }
  assert.fail(`receipt did not reach ${state}`);
}

test('authenticated readiness verifies the pinned session and context includes its desktop return link', async t => {
  const desktopUrl = 'https://swarm.example.test/agents/3d3a349a';
  const f = await fixture(t, { desktopUrl });
  assert.equal((await fetch(f.base + '/api/health')).status, 401);
  const response = await f.request('/api/health');
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.status, 'ready');
  assert.equal(value.session.id, SESSION);
  assert.equal(value.session.agentId, AGENT);
  const context = await (await f.request('/api/context')).json();
  assert.equal(context.desktopUrl, desktopUrl);
});

test('a durable receipt returns before the SSE finishes and completion requires readback', async t => {
  const c = conversation();
  t.after(c.finish);
  const f = await fixture(t, { upstream: c.upstream });
  const clientId = 'message-first';
  const response = await f.request('/api/messages', post({ text: 'Continue the same mission', clientId, sessionId: 'evil' }));
  assert.equal(response.status, 202);
  const { receipt } = await response.json();
  assert.equal(receipt.clientId, clientId);
  const file = join(f.stateDir, 'receipts', readdirSync(join(f.stateDir, 'receipts'))[0]);
  assert.equal(JSON.parse(readFileSync(file)).clientId, clientId);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  await waitReceipt(f.request, clientId, 'running');
  const chat = c.calls.find(c => c.path.endsWith('/chat'));
  assert.equal(chat.path, `/api/chats/${SESSION}/chat`);
  assert.deepEqual(JSON.parse(chat.init.body), { message: 'Continue the same mission', internal: false, queueMode: 'followup' });
  c.finish();
  const final = await waitReceipt(f.request, clientId, 'completed');
  assert.equal(final.runId, 'run-new');
  assert.equal(final.evidence, 'ledger_and_history');
});

test('clientId is an idempotency key and changed text conflicts, including concurrent requests', async t => {
  const c = conversation(); t.after(c.finish);
  const f = await fixture(t, { upstream: c.upstream });
  const payload = { clientId: 'dedupe-message', text: 'Only once' };
  const responses = await Promise.all(Array.from({ length: 4 }, () => f.request('/api/messages', post(payload))));
  const receipts = await Promise.all(responses.map(r => r.json()));
  assert.equal(new Set(receipts.map(v => v.receipt.id)).size, 1);
  assert.equal((await f.request('/api/messages', post({ ...payload, text: 'changed' }))).status, 409);
  await waitReceipt(f.request, payload.clientId, 'running');
  assert.equal(c.calls.filter(c => c.path.endsWith('/chat')).length, 1);
  c.finish();
});

test('done is only a transport marker; the run ledger determines queued, failed or completed', async t => {
  for (const [terminal, expected] of [['queued', 'queued'], ['running', 'running'], ['failed', 'error']]) {
    await t.test(terminal, async t => {
      const c = conversation({ terminal }); t.after(c.finish);
      const f = await fixture(t, { upstream: c.upstream });
      const clientId = `outcome-${terminal}`;
      await f.request('/api/messages', post({ clientId, text: 'Check real outcome' }));
      await waitReceipt(f.request, clientId, 'running');
      c.finish();
      const receipt = await waitReceipt(f.request, clientId, expected);
      // Read once more after the stream has actually ended (running is also an initial state).
      await tick();
      const after = (await (await f.request(`/api/receipts/${clientId}`)).json()).receipt;
      assert.equal(after.state, expected);
      assert.notEqual(after.state, 'completed');
      assert.ok(after.streamEnded);
    });
  }
});

test('restart recovers uncertain receipts as unknown_execution and never replays them', async t => {
  const c = conversation(); t.after(c.finish);
  const f = await fixture(t, { upstream: c.upstream, keepState: true });
  const payload = { clientId: 'restart-message', text: 'Do not replay' };
  await f.request('/api/messages', post(payload));
  await waitReceipt(f.request, payload.clientId, 'running');
  await f.app.close();
  const calls = [];
  const restarted = await fixture(t, { stateDir: f.stateDir, upstream: async (url, init) => { calls.push({ url, init }); return json({}, 404); } });
  const after = await (await restarted.request(`/api/receipts/${payload.clientId}`)).json();
  assert.equal(after.receipt.state, 'unknown_execution');
  const duplicate = await (await restarted.request('/api/messages', post(payload))).json();
  assert.equal(duplicate.receipt.id, after.receipt.id);
  assert.equal(duplicate.receipt.state, 'unknown_execution');
  assert.ok(calls.every(c => c.init.method !== 'POST'));
});

for (const [terminal, expected] of [['completed', 'completed'], ['failed', 'error']]) {
  test(`restart keeps polling an attributed run from running to ${terminal} without chat replay`, async t => {
    const c = conversation({ terminal: 'running' }); t.after(c.finish);
    const f = await fixture(t, { upstream: c.upstream, keepState: true });
    const payload = { clientId: `restart-${terminal}`, text: 'Continue without replaying' };
    await f.request('/api/messages', post(payload));
    const before = await waitReceipt(f.request, payload.clientId, 'running');
    assert.equal(before.runId, 'run-new');
    assert.ok(!before.streamEnded);
    await f.app.close();

    let status = 'running';
    const calls = [];
    const restarted = await fixture(t, { stateDir: f.stateDir, upstream: async (url, init) => {
      const path = new URL(url).pathname;
      calls.push({ path, init });
      if (path === `/api/chats/${SESSION}`) return json({ id: SESSION, agentId: AGENT });
      if (path === '/api/runs/run-new') return json({ id: 'run-new', sessionId: SESSION, status });
      if (path.endsWith('/messages')) return json({ messages: [{ role: 'assistant', text: 'Recovered answer', time: 789, runId: 'run-new', streaming: false }], total: 1, hasMore: false, startIndex: 0 });
      throw new Error('Unexpected restart route');
    } });
    const file = join(f.stateDir, 'receipts', readdirSync(join(f.stateDir, 'receipts'))[0]);
    assert.equal(JSON.parse(readFileSync(file)).state, 'unknown_execution');
    const first = (await (await restarted.request(`/api/receipts/${payload.clientId}`)).json()).receipt;
    assert.equal(first.state, 'running');
    assert.ok(!first.streamEnded);
    status = terminal;
    const after = (await (await restarted.request(`/api/receipts/${payload.clientId}`)).json()).receipt;
    assert.equal(after.state, expected);
    assert.equal(after.evidence, terminal === 'completed' ? 'ledger_and_history' : 'run_ledger');
    assert.equal(calls.filter(call => call.path === '/api/runs/run-new').length, 2, 'each nonterminal poll reads the run ledger');
    const duplicate = (await (await restarted.request('/api/messages', post(payload))).json()).receipt;
    assert.equal(duplicate.id, before.id);
    assert.equal(duplicate.state, expected);
    assert.equal(c.calls.filter(call => call.path.endsWith('/chat')).length, 1);
    assert.ok(calls.every(call => call.init.method !== 'POST'), 'restart reconciliation and duplicate requests never replay chat');
  });
}

test('unattributed stream termination stays unknown, and deduplication never retransmits', async t => {
  let sends = 0;
  const upstream = async (url, init) => {
    if (String(url).endsWith('/chat')) { sends++; return new Response('data: {"t":"done"}\n\n'); }
    return json({ id: SESSION, agentId: AGENT });
  };
  const f = await fixture(t, { upstream });
  const payload = { clientId: 'partial-message', text: 'Keep this uncertain' };
  await f.request('/api/messages', post(payload));
  const receipt = await waitReceipt(f.request, payload.clientId, 'unknown_execution');
  assert.equal(receipt.runId, null);
  await f.request('/api/messages', post(payload));
  assert.equal(sends, 1);
});

test('reconnecting polls reconcile a queued run without creating a second request', async t => {
  const c = conversation({ terminal: 'queued' }); t.after(c.finish);
  let complete = false;
  const upstream = (url, init) => String(url).includes('/api/runs/') && complete ? json({ id: 'run-new', sessionId: SESSION, status: 'completed' }) : c.upstream(url, init);
  const f = await fixture(t, { upstream });
  await f.request('/api/messages', post({ clientId: 'reconnect-message', text: 'Continue after disconnect' }));
  await waitReceipt(f.request, 'reconnect-message', 'running');
  c.finish();
  await waitReceipt(f.request, 'reconnect-message', 'queued');
  complete = true;
  await waitReceipt(f.request, 'reconnect-message', 'completed');
  assert.equal(c.calls.filter(c => c.path.endsWith('/chat')).length, 1);
});

test('private APIs reject unauthenticated and forged Tailscale identities; login uses an HttpOnly cookie', async t => {
  const f = await fixture(t);
  assert.equal((await fetch(f.base + '/api/context')).status, 401);
  assert.equal((await fetch(f.base + '/api/context', { headers: { 'tailscale-user-login': 'allowed@example.test', 'x-forwarded-for': '100.1.2.3' } })).status, 401);
  const login = await fetch(f.base + '/api/auth', post({ token: TOKEN }));
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.ok(!cookie.includes(TOKEN));
  assert.equal((await fetch(f.base + '/api/context', { headers: { cookie: cookie.split(';')[0] } })).status, 200);
  assert.equal((await fetch(f.base + '/api/auth', post({ token: 'wrong' }))).status, 401);
  const closed = await fixture(t, { authToken: '' });
  assert.equal((await closed.request('/api/context')).status, 503);
});

test('same-origin mutations enforce Host, Origin, JSON limits and message validation before upstream', async t => {
  const f = await fixture(t, { publicUrl: 'https://phone.example.test' });
  const payload = post({ clientId: 'safe-message', text: 'Safe text' });
  assert.equal((await f.request('/api/messages', { ...payload, headers: { ...payload.headers, origin: 'https://evil.example' } })).status, 403);
  const forgedHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(f.base + '/api/messages', { method: 'POST', headers: { ...payload.headers, host: 'evil.example', authorization: `Bearer ${TOKEN}` } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end(payload.body);
  });
  assert.equal(forgedHostStatus, 403);
  assert.equal((await f.request('/api/messages', { ...payload, headers: { ...payload.headers, 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await f.request('/api/messages', post({ text: 'x'.repeat(70000), clientId: 'large-message' }))).status, 413);
  for (const body of [{ clientId: '../escape', text: 'x' }, { clientId: 'missing-text' }, { clientId: 'empty-message', text: '   ' }, null]) assert.equal((await f.request('/api/messages', post(body))).status, 400);
  assert.equal((await f.request('/api/messages', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal(f.calls.length, 0);
  const allowed = await f.request('/api/auth', { ...post({ token: TOKEN }), headers: { 'content-type': 'application/json', origin: 'https://phone.example.test', host: 'phone.example.test' } });
  assert.equal(allowed.status, 200);
  assert.match(allowed.headers.get('set-cookie'), /Secure/);
  assert.equal(allowed.headers.get('access-control-allow-origin'), null);
});

test('a take is durable before STT, deduplicated, and its editable transcript is not sent automatically', async t => {
  let transcriptions = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; }); t.after(() => release());
  const f = await fixture(t, { transcribe: async ({ path, language }) => {
    transcriptions++; assert.equal(language, 'en');
    assert.deepEqual(readFileSync(path), Buffer.from('recorded bytes'));
    assert.equal(statSync(path).mode & 0o777, 0o600);
    await gate; return 'The spoken draft';
  } });
  const upload = () => f.request('/api/takes', { method: 'POST', headers: { 'content-type': 'audio/mp4', 'x-client-id': 'recording-first' }, body: 'recorded bytes' });
  const response = await upload(); assert.equal(response.status, 202);
  const initial = (await response.json()).take;
  assert.equal(initial.id, 'recording-first');
  const duplicate = await (await upload()).json();
  assert.equal(duplicate.take.id, initial.id);
  release();
  let take;
  for (let i = 0; i < 80; i++) {
    take = (await (await f.request('/api/takes/recording-first')).json()).take;
    if (take?.state === 'ready') break; await tick();
  }
  assert.equal(take.state, 'ready'); assert.equal(take.transcript, 'The spoken draft');
  assert.equal(transcriptions, 1);
  assert.equal(f.calls.length, 0, 'transcription does not post a chat message');
  assert.equal((await f.request('/api/takes', { method: 'POST', headers: { 'content-type': 'audio/mp4', 'x-client-id': initial.id }, body: 'different bytes' })).status, 409);
});

test('failed voice bytes survive restart, remain downloadable, and explicit STT retry does not resend chat', async t => {
  const f = await fixture(t, { keepState: true, transcribe: async () => { throw new Error(KEY); } });
  const headers = { 'content-type': 'audio/webm', 'x-client-id': 'failed-recording' };
  await f.request('/api/takes', { method: 'POST', headers, body: 'saved voice' });
  await tick(); await tick();
  const failed = (await (await f.request('/api/takes/failed-recording')).json()).take;
  assert.equal(failed.state, 'failed'); assert.ok(!failed.error.includes(KEY));
  const audio = await f.request(failed.audio);
  assert.equal(audio.status, 200); assert.equal(await audio.text(), 'saved voice');
  await f.app.close();
  const restarted = await fixture(t, { stateDir: f.stateDir, transcribe: async () => 'Recovered words' });
  assert.equal((await (await restarted.request('/api/takes/failed-recording')).json()).take.state, 'failed');
  assert.equal((await restarted.request('/api/takes/failed-recording/transcribe', post({}))).status, 202);
  for (let i = 0; i < 80; i++) {
    const take = (await (await restarted.request('/api/takes/failed-recording')).json()).take;
    if (take.state === 'ready') { assert.equal(take.transcript, 'Recovered words'); break; }
    if (i === 79) assert.fail('retry never became ready'); await tick();
  }
  assert.equal((await (await restarted.request('/api/takes')).json()).takes.length, 1);
  assert.equal(restarted.calls.length, 0);
  assert.equal((await restarted.request('/api/takes', { method: 'POST', headers, body: 'saved voice' })).status, 202);
  assert.equal((await restarted.request('/api/takes', { method: 'POST', headers: { ...headers, 'content-type': 'text/plain' }, body: 'x' })).status, 415);
  assert.equal((await restarted.request('/api/takes', { method: 'POST', headers, body: '' })).status, 400);
  assert.equal((await restarted.request('/api/takes', { method: 'POST', headers, body: Buffer.alloc(25 * 1024 * 1024 + 1) })).status, 413);
});

test('only pinned assistant history is voiced once as Kherix, with Safari byte ranges', async t => {
  const renders = [];
  const f = await fixture(t, { synthesize: async input => { renders.push(input); return Buffer.from('0123456789'); } });
  const thread = await (await f.request('/api/thread')).json();
  const assistant = thread.messages.find(m => m.role === 'assistant');
  const user = thread.messages.find(m => m.role === 'user');
  const path = `/api/replies/${assistant.id}/audio`;
  const audio = await f.request(path, { headers: { range: 'bytes=2-5' } });
  assert.equal(audio.status, 206); assert.equal(await audio.text(), '2345');
  assert.equal(audio.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(audio.headers.get('accept-ranges'), 'bytes');
  assert.equal(audio.headers.get('content-type'), 'audio/mpeg');
  assert.equal((await f.request(path, { method: 'HEAD' })).headers.get('content-length'), '10');
  assert.equal(await (await f.request(path, { headers: { range: 'bytes=-2' } })).text(), '89');
  const invalid = await f.request(path, { headers: { range: 'bytes=99-' } });
  assert.equal(invalid.status, 416); assert.equal(invalid.headers.get('content-range'), 'bytes */10');
  assert.equal((await f.request(`/api/replies/${user.id}/audio`)).status, 404);
  assert.equal((await f.request(`/api/replies/${'a'.repeat(64)}/audio`)).status, 404);
  assert.equal(renders.length, 1); assert.equal(renders[0].text, 'I am here.');
  assert.equal(renders[0].voice, 'en-US-GuyNeural');
  assert.ok(readdirSync(join(f.stateDir, 'speech')).some(name => name.endsWith('.txt')));
});

test('the unauthenticated phone shell is self-hosted, accessible and credential-free', async t => {
  const f = await fixture(t);
  const page = await fetch(f.base + '/');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /name="viewport"/);
  assert.match(html, /Mission &amp; continuity/);
  assert.match(html, /id="composer"/);
  assert.match(html, /id="record"/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.ok(!html.includes(KEY)); assert.ok(!html.includes(TOKEN));
  const app = await fetch(f.base + '/app.js');
  assert.equal(app.status, 200);
  const source = await app.text();
  assert.ok(!source.includes('innerHTML')); assert.ok(source.includes('textContent'));
  assert.equal((await fetch(f.base + '/state.js')).status, 200);
  assert.equal((await fetch(f.base + '/style.css')).status, 200);
  assert.equal((await f.request('/server.mjs')).status, 404);
});

test('identity refusal is a known pre-dispatch error, never a replacement session', async t => {
  for (const data of [{ id: SESSION }, { id: SESSION, agentId: 'other-agent' }, { id: 'other-session', agentId: AGENT }]) {
    await t.test(JSON.stringify(data), async t => {
      const calls = [];
      const f = await fixture(t, { upstream: async (url, init) => { calls.push({ url, init }); return json(data); } });
      assert.equal((await f.request('/api/context')).status, 409);
      assert.equal((await f.request('/api/thread')).status, 409);
      await f.request('/api/messages', post({ text: 'Never move me', clientId: 'identity-refusal' }));
      await waitReceipt(f.request, 'identity-refusal', 'error');
      assert.ok(calls.every(c => c.init.method !== 'POST'));
    });
  }
});

test('split SSE frames ignore non-run metadata and preserve explicit failure without leaking internals', async t => {
  const frames = [
    'data: {"t":"md","text":"not run metadata"}\r', '\n\r\n',
    'data: {"t":"md","text":"{\\"run\\":{\\"id\\":\\"run-explicit\\"}}"}\r\n\r\n',
    `data: ${JSON.stringify({ t: 'err', text: KEY })}\n\n`,
    'data: {"t":"done"}\n\n',
  ];
  const f = await fixture(t, { upstream: async url => String(url).endsWith('/chat') ? new Response(new ReadableStream({ start(controller) { frames.forEach(frame => controller.enqueue(new TextEncoder().encode(frame))); controller.close(); } })) : json({ id: SESSION, agentId: AGENT }) });
  await f.request('/api/messages', post({ text: 'Inspect the failed run', clientId: 'explicit-failure' }));
  const receipt = await waitReceipt(f.request, 'explicit-failure', 'error');
  assert.equal(receipt.runId, 'run-explicit');
  assert.ok(!JSON.stringify(receipt).includes(KEY));
});

test('configured login restrictions supplement token authentication and known secrets are redacted everywhere', async t => {
  const groq = 'unit-groq-sensitive-value';
  const f = await fixture(t, { allowedLogin: 'allowed@example.test', groqKey: groq, upstream: async url => String(url).includes('/messages') ? json({ messages: [{ role: 'assistant', text: `${KEY} ${TOKEN} ${groq}`, time: 1 }], total: 1, startIndex: 0, hasMore: false }) : json({ id: SESSION, agentId: AGENT, name: KEY }) });
  const refused = await f.request('/api/context', { headers: { 'tailscale-user-login': 'other@example.test', 'x-forwarded-for': '100.2.3.4' } });
  assert.equal(refused.status, 403);
  assert.equal((await f.request('/api/context', { headers: { 'tailscale-user-login': 'allowed@example.test', 'x-forwarded-for': '100.2.3.4' } })).status, 200);
  assert.equal((await fetch(f.base + '/api/context', { headers: { 'tailscale-user-login': 'allowed@example.test' } })).status, 401);
  const history = await (await f.request('/api/thread')).text();
  for (const secret of [KEY, TOKEN, groq]) assert.ok(!history.includes(secret));
  const context = await (await f.request('/api/context')).text(); assert.ok(!context.includes(KEY));
  writeFileSync(join(f.stateDir, 'context.json'), JSON.stringify({ staging: { address: 'stable:here', secret: 'must-never-return' } }));
  assert.ok(!(await (await f.request('/api/context')).text()).includes('must-never-return'));
});

test('context and history come from the exact existing session, without internals', async t => {
  const f = await fixture(t);
  writeFileSync(join(f.stateDir, 'context.json'), JSON.stringify({ intention: 'Continue this mission', envisionedResult: 'One continuous conversation', corrections: ['No new session'], pendingWork: ['M1'], staging: { address: 'staging:phone-m1' }, secret: KEY }));
  const context = await (await f.request('/api/context?sessionId=evil')).json();
  assert.equal(context.session.id, SESSION);
  assert.equal(context.session.agentId, AGENT);
  assert.equal(context.context.intention, 'Continue this mission');
  assert.deepEqual(context.context.staging, { address: 'staging:phone-m1' });
  assert.equal(context.context.secret, undefined);
  const history = await (await f.request('/api/thread?sessionId=evil')).json();
  assert.deepEqual(history.messages.map(m => m.text), ['Continue here', 'I am here.']);
  assert.equal(history.total, 5);
  assert.equal(history.hasMore, false);
  assert.equal(history.startIndex, 0);
  assert.ok(history.messages.every(m => m.id && !('thinking' in m)));
  assert.ok(f.calls.every(c => c.init.headers.Cookie === `sc_auth=${KEY}`));
  assert.ok(f.calls.every(c => !c.url.includes('evil')));
  assert.equal(statSync(f.stateDir).mode & 0o777, 0o700);
});
