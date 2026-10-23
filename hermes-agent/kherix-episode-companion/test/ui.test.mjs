import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { Outbox } from '../public/state.js';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.handlers = {}; this.dataset = {}; this.value = ''; this.textContent = ''; this.classList = { toggle() {}, add() {}, remove() {} }; }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  prepend(item) { item.parent = this; this.children.unshift(item); }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  dispatchEvent(event) { return this.handlers[event.type]?.(event); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  focus() {}
  pause() { this.paused = true; }
  play() { this.played = true; return Promise.resolve(); }
  click() { return this.handlers.click?.({ preventDefault() {} }); }
}
const flatten = root => [root, ...root.children.flatMap(flatten)];
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); };
function recordingsDB(takes = [], failures = new Set()) {
  const saved = new Map(takes.map(take => [take.id, structuredClone(take)]));
  const indexedDB = { open() {
    const req = {};
    setImmediate(() => {
      if (failures.has('open')) { req.error = new Error('IndexedDB open failed'); req.onerror(); return; }
      req.result = { transaction() {
        const tx = { objectStore() {
          const operate = (operation, value) => {
            const request = {};
            setImmediate(() => {
              if (failures.has(operation)) { tx.error = new Error(`IndexedDB ${operation} failed`); tx.onerror(); return; }
              if (operation === 'getAll') request.result = structuredClone([...saved.values()]);
              if (operation === 'put') { saved.set(value.id, structuredClone(value)); request.result = value.id; }
              if (operation === 'delete') saved.delete(value);
              tx.oncomplete();
            });
            return request;
          };
          return { getAll: () => operate('getAll'), put: value => operate('put', value), delete: id => operate('delete', id) };
        } };
        return tx;
      } };
      req.onsuccess();
    });
    return req;
  } };
  return { indexedDB, saved, failures };
}
function mount({ indexedDB, locked = false, messages = [{ id: 'a'.repeat(64), role: 'assistant', text: '<img src=x onerror=alert(1)>', streaming: false }] } = {}) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  const body = new Element('body');
  const all = () => [...elements.values()].flatMap(flatten);
  const document = {
    body, getElementById: get, createElement: tag => new Element(tag), addEventListener() {},
    querySelectorAll: selector => all().filter(el => selector === 'audio' ? el.tag === 'audio' : el.dataset.hear),
  };
  const saved = new Map(); const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const calls = [], downloads = [], recorders = [], uploaded = new Map();
  let uploadsAvailable = false;
  const fetchImpl = async (path, init) => {
    calls.push({ path, init });
    if (locked) return new Response(JSON.stringify({ error: 'Unlock this private companion' }), { status: 401 });
    if (path === '/api/context') return new Response(JSON.stringify({ session: { id: 'fe331909', agentId: '3d3a349a' }, context: { intention: 'Stay here' } }));
    if (path === '/api/thread') return new Response(JSON.stringify({ messages, total: messages.length, hasMore: false }));
    if (path === '/api/takes' && init.method === 'POST') {
      if (!uploadsAvailable) return new Response(JSON.stringify({ error: 'offline upload' }), { status: 503 });
      const id = init.headers['x-client-id'];
      const take = { id, bytes: init.body.size, mime: init.body.type, state: 'ready', transcript: 'Recovered transcript', audio: `/api/takes/${id}/audio` };
      uploaded.set(id, take);
      return new Response(JSON.stringify({ take }));
    }
    if (path === '/api/takes') return new Response(JSON.stringify({ takes: [...uploaded.values()] }));
    const take = uploaded.get(path.replace('/api/takes/', ''));
    if (take) return new Response(JSON.stringify({ take }));
    if (path === '/api/messages') return new Response(JSON.stringify({ receipt: { ...JSON.parse(init.body), state: 'queued' } }));
    return new Response('{"error":"not found"}', { status: 404 });
  };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['preserved bytes'], { type: this.mimeType }) }); return this.onstop(); }
  }
  const events = {};
  const window = { addEventListener(name, fn) { events[name] = fn; }, MediaRecorder: Recorder };
  const urls = { createObjectURL: blob => { downloads.push(blob); return 'blob:recording'; }, revokeObjectURL() {} };
  const sandbox = { document, window, localStorage: storage, fetch: fetchImpl, Outbox, Blob, AbortSignal, URL: urls, ...(indexedDB === undefined ? {} : { indexedDB }), crypto: webcrypto, Event: class { constructor(type) { this.type = type; } }, isSecureContext: true, MediaRecorder: Recorder, navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } }, confirm: () => true, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}, console };
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*?;\n/, '');
  get('feed').scrollHeight = 1000; get('feed').scrollTop = 0; get('feed').clientHeight = 300;
  runInNewContext(source, sandbox);
  return { get, all, calls, storage, downloads, recorders, events, allowUploads: () => { uploadsAvailable = true; }, pairDevice: () => { locked = false; } };
}

test('an unpaired browser gets pairing guidance, cannot send, and can recheck without losing its draft', async () => {
  const ui = mount({ locked: true }); await settle();
  assert.equal(ui.get('unlock').hidden, false);
  assert.match(ui.get('connection').textContent, /pair this device/i);
  assert.equal(ui.get('send').disabled, true);
  assert.equal(ui.get('record').disabled, true);
  ui.get('composer').value = 'Keep this draft';
  await ui.get('compose').dispatchEvent({ type: 'submit', preventDefault() {} }); await settle();
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0, 'locked forms must not dispatch a chat');
  ui.pairDevice();
  await ui.get('check-connection').click(); await settle();
  assert.equal(ui.get('unlock').hidden, true);
  assert.equal(ui.get('send').disabled, false);
  assert.equal(ui.get('record').disabled, false);
  assert.equal(ui.get('composer').value, 'Keep this draft');
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0, 'checking access must not send or replay drafts');
});

test('the locked shell explains device pairing before offering operator-only credentials', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /Pair this device/);
  assert.match(html, /Each browser/);
  assert.match(html, /Miadi tokens.*Kherix API tokens/s);
  assert.ok(html.indexOf('Pair this device') < html.indexOf('Operator recovery'));
  assert.match(html, /<details[^>]*>[\s\S]*Operator recovery[\s\S]*<form id="token-unlock"/);
});

test('a phone opens at the latest turn, and refresh does not pull it away from earlier reading', async () => {
  const ui = mount(); await settle();
  assert.equal(ui.get('feed').scrollTop, 1000, 'the existing conversation opens at its latest turn');
  ui.get('feed').scrollTop = 50;
  await ui.events.online(); await settle();
  assert.equal(ui.get('feed').scrollTop, 50, 'refresh respects reading position');
});

for (const capture of [false, true]) {
  test(`Hear Kherix refreshes when a streaming reply finishes with the microphone ${capture ? 'active' : 'idle'}`, async () => {
    const message = { id: 'b'.repeat(64), role: 'assistant', text: 'The same finished answer', time: 456, runId: 'run-stable', streaming: true };
    const ui = mount({ messages: [message] }); await settle();
    const article = ui.get('thread').children[0];
    const hear = flatten(article).find(el => el.textContent === 'Hear Kherix');
    const audio = flatten(article).find(el => el.tag === 'audio');
    assert.equal(hear.dataset.streaming, 'true');
    assert.equal(hear.disabled, true);
    if (capture) await ui.get('record').click();

    message.streaming = false;
    await ui.events.online(); await settle();
    assert.equal(ui.get('thread').children[0], article, 'unchanged message identity reuses the existing article');
    assert.equal(flatten(article).find(el => el.textContent === 'Hear Kherix'), hear, 'refresh updates the existing playback button');
    assert.deepEqual({ streaming: hear.dataset.streaming, disabled: hear.disabled }, { streaming: 'false', disabled: capture });
    if (capture) {
      await hear.click();
      assert.ok(!audio.played, 'a finished reply cannot play while the microphone is active');
      await ui.get('stop').click(); await settle();
      assert.equal(hear.disabled, false, 'stopping capture uses the refreshed streaming flag');
    }
    await hear.click();
    assert.equal(audio.played, true);
    assert.equal(audio.src, `/api/replies/${message.id}/audio`);
  });
}

test('phone wiring renders untrusted text inertly, gates playback during capture, and preserves a failed take without IndexedDB', async () => {
  const ui = mount(); await settle();
  assert.match(ui.get('continuity').textContent, /fe331909.*3d3a349a/);
  assert.ok(ui.all().some(el => el.textContent === '<img src=x onerror=alert(1)>'));
  const hear = ui.all().find(el => el.textContent === 'Hear Kherix');
  assert.ok(hear);
  await ui.get('record').click();
  assert.equal(hear.disabled, true);
  await hear.click();
  assert.ok(!ui.all().some(el => el.played));
  await ui.get('stop').click(); await settle();
  assert.equal(hear.disabled, false);
  const localButtons = () => flatten(ui.get('local-takes'));
  const download = localButtons().find(el => el.textContent === 'Download saved take');
  const retry = () => localButtons().find(el => el.textContent === 'Upload / check saved take');
  assert.ok(download, 'an IndexedDB failure must not hide the surviving in-memory recording');
  assert.ok(retry(), 'the in-memory recording must remain explicitly retryable');
  assert.match(localButtons().map(el => el.textContent).join(' '), /only in memory/i);
  assert.match(localButtons().map(el => el.textContent).join(' '), /keep this page open.*download/i);
  assert.match(ui.get('action-status').textContent, /Upload not confirmed/);
  const uploadCalls = () => ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST');
  assert.equal(uploadCalls().length, 1, 'a failed upload must not be retried automatically');
  await download.click();
  assert.equal(await ui.downloads[0].text(), 'preserved bytes');
  assert.equal(uploadCalls().length, 1, 'downloading must not upload or send');
  await retry().click(); await settle();
  assert.equal(uploadCalls().length, 2);
  assert.ok(localButtons().some(el => el.textContent === 'Download saved take'), 'another failed upload must preserve recovery controls');
  ui.allowUploads();
  await retry().click(); await settle();
  assert.equal(uploadCalls().length, 3);
  assert.ok(uploadCalls().every(call => call.init.headers['x-client-id'] === uploadCalls()[0].init.headers['x-client-id']), 'explicit retries reuse the recording ID');
  assert.ok(uploadCalls().every(call => call.init.body === ui.downloads[0]), 'retry and download use the same preserved bytes');
  assert.ok(ui.calls.some(call => call.path === `/api/takes/${uploadCalls()[0].init.headers['x-client-id']}`), 'recovery requires a server readback');
  assert.equal(ui.get('local-takes').children.length, 0, 'only confirmed uploads remove the memory fallback');
  assert.equal(ui.get('composer').value, '', 'successful recovery leaves chat untouched');
  await ui.all().find(el => el.textContent === 'Use in composer').click();
  assert.equal(ui.get('composer').value, 'Recovered transcript');
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0, 'recording and transcription never send chat automatically');
});

test('saved recordings merge by ID with the latest memory snapshot after a backup failure', async () => {
  const blob = new Blob(['already saved take'], { type: 'audio/mp4' });
  const db = recordingsDB([{ id: 'saved-only', blob, mime: blob.type, bytes: blob.size, state: 'ready', backedUp: false }]);
  const ui = mount({ indexedDB: db.indexedDB }); await settle();
  assert.equal(ui.get('local-takes').children.length, 1);
  assert.equal(ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST').length, 0, 'persisted takes are never automatically uploaded');
  await ui.get('record').click();
  ui.recorders[0].ondataavailable({ data: new Blob(['earlier '], { type: 'audio/mp4' }) });
  await settle();
  const id = [...db.saved.keys()].find(id => id !== 'saved-only');
  assert.ok(id, 'the earlier snapshot was persisted');
  assert.equal(db.saved.get(id).state, 'partial');
  db.failures.add('put');
  await ui.get('stop').click(); await settle();
  const rows = () => ui.get('local-takes').children;
  const rowFor = id => rows().find(row => flatten(row).some(el => el.textContent.endsWith(` · ${id}`)));
  assert.equal(rows().length, 2, 'a saved take and its memory snapshot must not appear twice');
  const latest = ui.calls.find(call => call.path === '/api/takes' && call.init.method === 'POST');
  assert.ok(flatten(rowFor(id)).some(el => el.textContent === `ready · ${latest.init.body.size} bytes · ${id}`), 'the latest memory state and byte count must replace the stale saved snapshot');
  assert.ok(flatten(rowFor(id)).some(el => /only in memory/i.test(el.textContent)), 'a stale saved partial must not imply that the latest bytes are backed up');
  await flatten(rowFor(id)).find(el => el.textContent === 'Download saved take').click();
  assert.equal(await ui.downloads[0].text(), 'earlier preserved bytes');
  await flatten(rowFor(id)).find(el => el.textContent === 'Upload / check saved take').click(); await settle();
  const uploads = ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST');
  assert.equal(uploads.length, 2);
  assert.equal(uploads[1].init.body, latest.init.body, 'retry uses the latest full recording, not the saved partial');
  assert.equal(db.saved.get(id).state, 'partial');
  assert.ok(flatten(rowFor('saved-only')).some(el => el.textContent === 'Saved on this device'), 'persisted-only takes remain recoverable even though stored backedUp metadata is false');
  assert.ok(!flatten(rowFor('saved-only')).some(el => /only in memory/i.test(el.textContent)));
  await flatten(rowFor('saved-only')).find(el => el.textContent === 'Download saved take').click();
  assert.equal(await ui.downloads[1].text(), 'already saved take');
  await ui.get('record').click();
  await ui.get('stop').click(); await settle();
  const memoryOnly = ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST').at(-1);
  const memoryOnlyId = memoryOnly.init.headers['x-client-id'];
  assert.equal(db.saved.has(memoryOnlyId), false);
  assert.equal(rows().length, 3, 'memory-only takes must be included alongside persisted-only and merged takes');
  assert.ok(flatten(rowFor(memoryOnlyId)).some(el => /only in memory/i.test(el.textContent)));
  await flatten(rowFor(memoryOnlyId)).find(el => el.textContent === 'Download saved take').click();
  assert.equal(await ui.downloads[2].text(), 'preserved bytes');
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0);
});

for (const { name, failures, backedUp } of [
  { name: 'IndexedDB open fails', failures: ['open'], backedUp: false },
  { name: 'IndexedDB writes fail but reads succeed', failures: ['put'], backedUp: false },
  { name: 'IndexedDB reads fail but writes succeed', failures: ['getAll'], backedUp: true },
  { name: 'IndexedDB reads and writes fail', failures: ['getAll', 'put'], backedUp: false },
  { name: 'IndexedDB backup succeeds', failures: [], backedUp: true },
]) {
  test(`failed upload remains downloadable and explicitly recoverable when ${name}`, async () => {
    const db = recordingsDB([], new Set(failures));
    const ui = mount({ indexedDB: db.indexedDB }); await settle();
    await ui.get('record').click();
    await ui.get('stop').click(); await settle();
    assert.equal(ui.get('local-takes').children.length, 1, 'memory and persisted copies of the same recording render once');
    const local = flatten(ui.get('local-takes'));
    assert.equal(local.some(el => el.textContent === 'Saved on this device'), backedUp);
    assert.equal(local.some(el => /only in memory/i.test(el.textContent)), !backedUp);
    if (!backedUp) assert.ok(local.some(el => /keep this page open.*download/i.test(el.textContent)));
    assert.equal(db.saved.size, backedUp ? 1 : 0);
    const uploads = () => ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST');
    assert.equal(uploads().length, 1, 'storage and upload failures must not trigger automatic retries');
    await local.find(el => el.textContent === 'Download saved take').click();
    assert.equal(await ui.downloads[0].text(), 'preserved bytes');
    ui.allowUploads();
    await local.find(el => el.textContent === 'Upload / check saved take').click(); await settle();
    assert.equal(uploads().length, 2);
    assert.equal(uploads()[1].init.headers['x-client-id'], uploads()[0].init.headers['x-client-id']);
    assert.equal(uploads()[1].init.body, ui.downloads[0]);
    assert.equal(ui.get('local-takes').children.length, 0);
    assert.equal(db.saved.size, 0, 'confirmed uploads remove any persisted backup');
    assert.equal(ui.get('composer').value, '');
    assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0, 'recovery does not send chat');
  });
}
