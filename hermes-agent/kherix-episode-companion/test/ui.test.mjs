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
  play() { this.played = true; this.paused = false; this.ended = false; this.playCalls = (this.playCalls || 0) + 1; return this.rejectPlay ? Promise.reject(new Error('Gesture required')) : Promise.resolve(); }
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
function mount({ indexedDB, getUserMedia, AudioContext, activity = { state: 'idle', queuedCount: 0 }, locked = false, messages = [{ id: 'a'.repeat(64), role: 'assistant', text: '<img src=x onerror=alert(1)>', streaming: false }] } = {}) {
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
    if (path === '/api/activity') {
      if (activity instanceof Error) throw activity;
      return new Response(JSON.stringify(activity));
    }
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
    if (path.startsWith('/api/receipts/')) return new Response(JSON.stringify({ receipt: { clientId: path.split('/').at(-1), state: 'queued' } }));
    return new Response('{"error":"not found"}', { status: 404 });
  };
  class Recorder {
    static isTypeSupported() { return true; }
    constructor(_stream, options) { this.mimeType = options.mimeType; this.state = 'inactive'; recorders.push(this); }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['preserved bytes'], { type: this.mimeType }) }); return this.onstop(); }
  }
  const events = {};
  const window = { addEventListener(name, fn) { events[name] = fn; }, MediaRecorder: Recorder, AudioContext };
  const urls = { createObjectURL: blob => { downloads.push(blob); return 'blob:recording'; }, revokeObjectURL() {} };
  const intervals = new Map(), timeouts = new Map(); let intervalId = 0, timeoutId = 0;
  const sandbox = { document, window, localStorage: storage, fetch: fetchImpl, Outbox, Blob, AbortSignal, URL: urls, ...(indexedDB === undefined ? {} : { indexedDB }), crypto: webcrypto, Event: class { constructor(type) { this.type = type; } }, isSecureContext: true, MediaRecorder: Recorder, navigator: { mediaDevices: { getUserMedia: getUserMedia ?? (async () => ({ getTracks: () => [{ stop() {} }] })) } }, confirm: () => true, setTimeout: (fn, ms) => { timeouts.set(++timeoutId, { fn, ms }); return timeoutId; }, clearTimeout: id => timeouts.delete(id), setInterval: fn => { intervals.set(++intervalId, fn); return intervalId; }, clearInterval: id => intervals.delete(id), console };
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8').replace(/^import .*?;\n/, '');
  get('reply-audio').tag = 'audio'; get('reply-audio').paused = true;
  get('feed').scrollHeight = 1000; get('feed').scrollTop = 0; get('feed').clientHeight = 300;
  runInNewContext(source, sandbox);
  return { get, all, calls, storage, downloads, recorders, events, intervals, uploaded, fireTimeout: async ms => { for (const [id, job] of [...timeouts]) if (job.ms === ms) { timeouts.delete(id); await job.fn(); } }, allowUploads: () => { uploadsAvailable = true; }, pairDevice: () => { locked = false; } };
}

test('visible refresh reports ledger-confirmed work and queue, without sending or losing drafts', async () => {
  const activity = { state: 'running', activeRunId: 'run-live', queuedCount: 2, detail: 'A public turn is running.' };
  const ui = mount({ activity }); await settle();
  assert.match(ui.get('work-status').textContent, /Kherix is working/i);
  assert.match(ui.get('work-status').textContent, /2.*queued/i);
  assert.match(ui.get('sync-status').textContent, /updated|checked/i);
  ui.get('composer').value = 'Preserve my unsent correction';
  activity.state = 'idle'; activity.queuedCount = 0;
  await ui.get('refresh').click(); await settle();
  assert.match(ui.get('work-status').textContent, /ready|no turn/i);
  assert.equal(ui.get('composer').value, 'Preserve my unsent correction');
  assert.equal(ui.calls.filter(c => c.path === '/api/messages').length, 0);
});

test('unavailable activity is explicit and cannot hide received history', async () => {
  const ui = mount({ activity: new Error('offline status') }); await settle();
  assert.match(ui.get('work-status').textContent, /unavailable|unverified|unknown/i);
  assert.equal(ui.get('thread').children.length, 1);
  assert.equal(ui.get('send').disabled, false);
});

test('new finished replies play sequentially once, without replaying initial history or cutting off playback', async () => {
  const messages = [{ id: 'old', role: 'assistant', text: 'Historical reply', streaming: false }];
  const ui = mount({ messages }); await settle();
  const audio = ui.get('reply-audio');
  ui.get('autoplay').checked = true;
  await ui.get('autoplay').dispatchEvent({ type: 'change' }); await settle();
  assert.ok(!audio.played, 'enabling listening cannot start old history');
  messages.push({ id: 'first', role: 'assistant', text: 'First new reply', streaming: true });
  await ui.events.online(); await settle();
  assert.ok(!audio.played, 'unfinished replies are never voiced');
  messages[1].streaming = false;
  await ui.events.online(); await settle();
  assert.equal(audio.src, '/api/replies/first/audio');
  messages.push({ id: 'second', role: 'assistant', text: 'Second new reply', streaming: false });
  await ui.events.online(); await settle();
  assert.equal(audio.src, '/api/replies/first/audio', 'arrival cannot interrupt the current reply');
  assert.match(ui.get('listen-status').textContent, /1.*waiting/i);
  audio.ended = true; audio.paused = true;
  await audio.dispatchEvent({ type: 'ended' }); await settle();
  assert.equal(audio.src, '/api/replies/second/audio');
  assert.equal(audio.playCalls, 2);
  await ui.events.online(); await settle();
  assert.equal(audio.playCalls, 2, 'polls do not replay seen replies');
});

test('replies arriving during capture wait for explicit listening and gesture refusal preserves the queue', async () => {
  const messages = [];
  const ui = mount({ messages }); await settle();
  ui.get('autoplay').checked = true;
  await ui.get('record').click();
  messages.push({ id: 'during-record', role: 'assistant', text: 'I can wait', streaming: false });
  await ui.events.online(); await settle();
  const audio = ui.get('reply-audio');
  assert.ok(!audio.played);
  assert.match(ui.get('listen-status').textContent, /1.*waiting/i);
  await ui.get('stop').click(); await settle();
  assert.ok(!audio.played, 'do not start sound immediately after recording while the take needs review');
  audio.rejectPlay = true;
  await ui.get('play-waiting').click(); await settle();
  assert.match(ui.get('listen-status').textContent, /tap|blocked/i);
  audio.rejectPlay = false;
  await ui.get('play-waiting').click(); await settle();
  assert.equal(audio.src, '/api/replies/during-record/audio');
  assert.equal(audio.playCalls, 2, 'gesture retry retains exactly the unheard reply');
  assert.equal(ui.calls.filter(c => c.path === '/api/messages').length, 0);
});

test('sending text while listening does not let a new reply interrupt the one playing', async () => {
  const messages = [{ id: 'playing', role: 'assistant', text: 'Keep listening', streaming: false }];
  const ui = mount({ messages }); await settle();
  ui.get('autoplay').checked = true;
  await ui.get('hear-latest').click();
  ui.get('composer').value = 'An explicit fixture send';
  await ui.get('compose').dispatchEvent({ type: 'submit', preventDefault() {} }); await settle();
  assert.match(ui.get('delivery-status').textContent, /received/i);
  messages.push({ id: 'after-send', role: 'assistant', text: 'I can wait', streaming: false });
  await ui.events.online(); await settle();
  assert.equal(ui.get('reply-audio').src, '/api/replies/playing/audio');
  assert.equal(ui.calls.filter(c => c.path === '/api/messages').length, 1);
});

test('an unfinished empty assistant turn shows a waiting label rather than a blank reply card', async () => {
  const ui = mount({ messages: [{ id: 'in-progress', role: 'assistant', text: '', streaming: true }] }); await settle();
  assert.ok(flatten(ui.get('thread')).some(el => /reply pending/i.test(el.textContent)));
  assert.equal(ui.get('hear-latest').disabled, true);
});

test('the latest take exposes transcription failure in the composer status and permits explicit rechecking', async () => {
  const ui = mount(); await settle(); ui.allowUploads();
  await ui.get('record').click(); await ui.get('stop').click(); await settle();
  const take = [...ui.uploaded.values()][0];
  const retry = ui.all().find(el => el.textContent === 'Retry transcription');
  assert.equal(retry.hidden, false, 'a misleading ready take must remain recheckable');
  assert.equal(ui.get('recordings').open, true);
  take.state = 'failed'; take.transcript = ''; take.error = 'The recording contains silence. Audio is preserved.';
  await ui.events.online(); await settle();
  assert.match(ui.get('action-status').textContent, /silence.*preserved/i);
  assert.equal(ui.get('composer').value, '');
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0);
});

test('direct microphone capture does not create a competing Web Audio consumer', async () => {
  let contexts = 0, stopped = 0;
  class AudioContext { constructor() { contexts++; throw new Error('Do not open a second audio consumer'); } }
  const ui = mount({ AudioContext, getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped++; } }] }) }); await settle();
  await ui.get('record').click();
  assert.equal(contexts, 0, 'use the same direct getUserMedia → MediaRecorder path as Mia');
  assert.equal(ui.recorders[0].state, 'recording');
  await ui.get('stop').click(); await settle();
  assert.equal(stopped, 1);
  assert.equal(ui.intervals.size, 0);
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0);
});

test('a recorder error without onstop releases the microphone and preserves all delivered chunks exactly once', async () => {
  let stopped = 0;
  const ui = mount({ getUserMedia: async () => ({ getTracks: () => [{ stop() { stopped++; } }] }) }); await settle();
  await ui.get('record').click();
  const recorder = ui.recorders[0];
  recorder.ondataavailable({ data: new Blob(['before '], { type: recorder.mimeType }) });
  recorder.stop = function () { this.state = 'inactive'; }; // Mobile recorder never delivers onstop.
  recorder.onerror({ error: { name: 'NotReadableError' } });
  recorder.ondataavailable({ data: new Blob(['final tail'], { type: recorder.mimeType }) });
  await ui.fireTimeout(3000); await settle();
  assert.equal(stopped, 1, 'error cleanup cannot leave a live microphone');
  assert.equal(ui.get('record').disabled, false);
  assert.equal(ui.get('stop').hidden, true);
  assert.equal(ui.intervals.size, 0);
  const uploadCalls = () => ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST');
  assert.equal(uploadCalls().length, 1);
  assert.equal(await uploadCalls()[0].init.body.text(), 'before final tail');
  await ui.get('record').click();
  const newerRecorder = ui.recorders[1];
  assert.equal(newerRecorder.state, 'recording');
  await recorder.onstop(); await settle();
  assert.equal(stopped, 1, 'late onstop must not release a newer microphone or upload twice');
  assert.equal(newerRecorder.state, 'recording');
  assert.equal(ui.get('stop').hidden, false, 'the newer capture keeps its controls');
  assert.equal(ui.intervals.size, 1, 'the newer capture keeps its clock');
  assert.equal(uploadCalls().length, 1);
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0);
  await ui.get('stop').click(); await settle();
});

test('unexpected recorder termination is labeled and its capture diagnostics survive an explicit upload retry', async () => {
  const ui = mount(); await settle();
  await ui.get('record').click();
  const recorder = ui.recorders[0];
  recorder.ondataavailable({ data: new Blob(['early speech'], { type: recorder.mimeType }) });
  recorder.state = 'inactive';
  await recorder.onstop(); await settle();
  assert.match(ui.get('capture-status').textContent, /unexpected/i);
  const upload = () => ui.calls.filter(call => call.path === '/api/takes' && call.init.method === 'POST');
  const info = JSON.parse(upload()[0].init.headers['x-capture-info']);
  assert.equal(info.version, 'direct-v1');
  assert.equal(info.stopReason, 'unexpected');
  assert.equal(info.chunkCount, 1);
  assert.ok(info.elapsedMs >= info.lastChunkAtMs);
  await ui.all().find(el => el.textContent === 'Upload / check saved take').click(); await settle();
  assert.equal(upload()[1].init.headers['x-capture-info'], upload()[0].init.headers['x-capture-info']);
  assert.equal(ui.calls.filter(call => call.path === '/api/messages').length, 0);
});

test('a slow encoder reports missing chunks without falsely claiming microphone silence', async () => {
  const ui = mount(); await settle();
  await ui.get('record').click(); await ui.fireTimeout(3500);
  assert.match(ui.get('capture-status').textContent, /no audio bytes yet/i);
  assert.doesNotMatch(ui.get('capture-status').textContent, /microphone is silent/i);
  assert.equal(ui.recorders[0].state, 'recording', 'slow encoders must not be stopped by a chunk watchdog');
  await ui.get('stop').click(); await settle();
  const upload = ui.calls.find(call => call.path === '/api/takes' && call.init.method === 'POST');
  assert.equal(JSON.parse(upload.init.headers['x-capture-info']).stopReason, 'requested');
});

test('microphone startup stays single-owner through a refresh and blocks all reply playback', async () => {
  let resolveMic, requests = 0;
  const mic = new Promise(resolve => { resolveMic = resolve; });
  const ui = mount({ getUserMedia: () => { requests++; return mic; } }); await settle();
  const hear = ui.all().find(el => el.textContent === 'Hear Kherix');
  await hear.click();
  const audio = ui.all().find(el => el.tag === 'audio');
  const starting = ui.get('record').click();
  assert.equal(audio.paused, true, 'stop playback before requesting microphone access');
  assert.equal(audio.controls, false, 'native playback controls must not bypass microphone ownership');
  assert.equal(hear.disabled, true);
  await ui.events.online(); await settle();
  assert.equal(ui.get('record').disabled, true, 'polling must not re-enable Record while permission is pending');
  const second = ui.get('record').click();
  await hear.click();
  assert.equal(requests, 1, 'even programmatic double clicks create only one request');
  resolveMic({ getTracks: () => [{ stop() {} }] });
  await Promise.all([starting, second]);
  assert.equal(ui.recorders.length, 1);
  await ui.get('stop').click(); await settle();
  assert.equal(audio.controls, true, 'playback becomes available after microphone release');
});

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

test('a phone opens at the newest turn below the capture dock, and refresh respects earlier reading', async () => {
  const messages = [{ id: 'older', role: 'user', text: 'Earlier words' }, { id: 'newer', role: 'assistant', text: 'Newest words' }];
  const ui = mount({ messages }); await settle();
  assert.equal(ui.get('feed').scrollTop, 0, 'latest turns are at the top, directly under the dock');
  assert.equal(flatten(ui.get('thread').children[0]).find(el => el.tag === 'p' && el.textContent === 'Newest words')?.textContent, 'Newest words');
  ui.get('feed').scrollTop = 50;
  await ui.events.online(); await settle();
  assert.equal(ui.get('feed').scrollTop, 50, 'refresh respects reading position');
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="record"') < html.indexOf('id="feed"'), 'capture controls stay above the scrolling reading area');
  for (const id of ['refresh', 'work-status', 'sync-status', 'play-waiting', 'autoplay']) assert.ok(html.includes(`id="${id}"`));
});

for (const capture of [false, true]) {
  test(`Hear Kherix refreshes when a streaming reply finishes with the microphone ${capture ? 'active' : 'idle'}`, async () => {
    const message = { id: 'b'.repeat(64), role: 'assistant', text: 'The same finished answer', time: 456, runId: 'run-stable', streaming: true };
    const ui = mount({ messages: [message] }); await settle();
    const article = ui.get('thread').children[0];
    const hear = flatten(article).find(el => el.textContent === 'Hear Kherix');
    const audio = ui.get('reply-audio');
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
