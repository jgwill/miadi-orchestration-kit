import { Outbox } from './state.js';

const $ = id => document.getElementById(id);
const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
const action = (text, onClick) => { const button = node('button', text); button.type = 'button'; button.addEventListener('click', onClick); return button; };
function say(text, error = false) { $('action-status').textContent = text; $('action-status').classList.toggle('error', error); }
async function request(path, payload, init = {}) {
  const response = await fetch(path, { credentials: 'same-origin', signal: AbortSignal.timeout(30000), ...(payload === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), ...init });
  const value = await response.json();
  if (!response.ok) { const error = new Error(value.error || 'Request failed'); error.status = response.status; throw error; }
  return value;
}
const outbox = new Outbox(localStorage, request);
let recording = false, starting = false, capture, recordingId, clock;
let refreshBusy = false, timer, sendBusy = false, authenticated = false, recentTakeId;
function setAuthenticated(value) {
  authenticated = value;
  $('send').disabled = !value || sendBusy;
  $('record').disabled = !value || starting || recording;
}
const messageViews = new Map(), takeViews = new Map();
try { $('composer').value = localStorage.getItem('kherix.draft') || ''; } catch { say('Device draft storage is unavailable. Sending is disabled if the outbox cannot be saved.', true); }
$('composer').addEventListener('input', () => { try { localStorage.setItem('kherix.draft', $('composer').value); } catch { say('The draft could not be saved on this device.', true); } });

function renderContext(data) {
  $('continuity').textContent = `Same session ${data.session.id} · agent ${data.session.agentId}`;
  $('presence').textContent = data.session.active ? 'Session active' : 'Same thread';
  $('context').replaceChildren();
  const fields = { intention: 'Intention', envisionedResult: 'Envisioned result', corrections: 'Corrections', pendingWork: 'Pending work', source: 'Source', staging: 'Staging', episode: 'Episode', stableAddress: 'Stable address' };
  for (const [key, label] of Object.entries(fields)) {
    const value = data.context[key];
    if (value === undefined || value === null) continue;
    const text = Array.isArray(value) ? value.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n') : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    $('context').append(node('dt', label), node('dd', text));
  }
  if (!$('context').children.length) $('context').append(node('dd', 'No mission metadata has been supplied yet. The existing session is still the authority.'));
  if (data.desktopUrl) { $('desktop').href = data.desktopUrl; $('desktop').hidden = false; }
}
function renderThread(data) {
  const feed = $('feed');
  const followLatest = messageViews.size === 0 || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 100;
  $('empty').hidden = data.messages.length > 0;
  $('empty').textContent = 'No visible messages yet in this existing session.';
  $('history-note').textContent = data.hasMore ? `Showing the latest history window (upstream total ${data.total}). Earlier messages remain in SwarmClaw.` : '';
  const ids = new Set(data.messages.map(m => m.id));
  for (const [id, view] of messageViews) if (!ids.has(id)) { view.element.remove(); messageViews.delete(id); }
  for (const message of data.messages) {
    let view = messageViews.get(message.id);
    if (!view) {
      const element = node('article', undefined, `message ${message.role}`);
      const byline = node('p', message.role === 'assistant' ? 'Kherix' : 'You', 'byline');
      const words = node('p', message.text, 'words'); element.append(byline, words);
      view = { element, words };
      if (message.role === 'assistant') {
        const audio = node('audio'); audio.controls = !(starting || recording); audio.preload = 'none'; audio.hidden = true;
        audio.addEventListener('play', () => { if (starting || recording) audio.pause(); });
        audio.addEventListener('error', () => say('Kherix audio is unavailable. The reply text is preserved; try Hear Kherix again.', true));
        const hear = action('Hear Kherix', () => {
          if (starting || recording) return say('Stop the microphone before listening.', true);
          document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
          audio.hidden = false;
          audio.src = `/api/replies/${message.id}/audio`;
          audio.play().catch(() => say('Audio did not start. Try the player, or retry Hear Kherix.', true));
        });
        hear.dataset.hear = 'true';
        element.append(hear, audio); view.hear = hear;
      }
      $('thread').append(element); messageViews.set(message.id, view);
    }
    view.words.textContent = message.text;
    if (view.hear) {
      view.hear.dataset.streaming = String(message.streaming);
      view.hear.disabled = starting || recording || message.streaming;
    }
  }
  if (followLatest) feed.scrollTop = feed.scrollHeight;
}
function renderReceipts() {
  $('receipts').replaceChildren(); $('receipt-count').textContent = outbox.items.length ? `(${outbox.items.length})` : '';
  for (const item of outbox.items.slice(-30).reverse()) {
    const row = node('div', undefined, 'receipt');
    row.append(node('strong', item.state.replaceAll('_', ' ')), node('p', item.text), node('p', item.clientId, 'id'));
    if (item.error) row.append(node('p', item.error, ['error', 'unknown_execution', 'checking_delivery'].includes(item.state) ? 'error' : 'muted'));
    if (item.state === 'not_found') row.append(action('Retry this same ID', async () => {
      try { await outbox.retry(item.clientId); renderReceipts(); await refresh(); } catch (error) { say(error.message, true); }
    }));
    $('receipts').append(row);
  }
}
function renderTakes(data) {
  for (const take of data.takes) {
    let view = takeViews.get(take.id);
    if (!view) {
      const element = node('div', undefined, 'take');
      const title = node('strong'); const status = node('p');
      const label = node('label', 'Editable transcript'); label.htmlFor = `transcript-${take.id}`;
      const transcript = node('textarea'); transcript.id = label.htmlFor; transcript.rows = 3;
      transcript.addEventListener('input', () => { transcript.dataset.edited = 'true'; });
      const use = action('Use in composer', () => {
        if ($('composer').value.trim() && !confirm('Replace the current composer draft with this transcript?')) return;
        $('composer').value = transcript.value; $('composer').dispatchEvent(new Event('input')); $('composer').focus();
        say('Transcript is a draft. Edit it, then press Send. Nothing has been sent.');
      });
      const download = node('a', 'Download recording'); download.href = take.audio; download.download = `kherix-${take.id}.${take.mime.includes('webm') ? 'webm' : take.mime.includes('wav') ? 'wav' : 'm4a'}`;
      const retry = action('Retry transcription', async () => { try { recentTakeId = take.id; view.state = undefined; await request(`/api/takes/${take.id}/transcribe`, {}); await refresh(); } catch (error) { say(error.message, true); } });
      const diagnostics = node('p', '', 'muted');
      element.append(title, status, diagnostics, label, transcript, use, download, retry);
      $('takes').prepend(element); view = { element, title, status, diagnostics, transcript, use, retry }; takeViews.set(take.id, view);
    }
    view.title.textContent = `${take.state} · ${take.bytes} bytes`;
    view.status.textContent = take.error || `Recording ${take.id}`;
    view.status.classList.toggle('error', Boolean(take.error));
    view.diagnostics.textContent = take.capture ? `Capture ${take.capture.version}: ${(take.capture.elapsedMs / 1000).toFixed(1)}s elapsed · ${take.capture.chunkCount} chunks · ${take.capture.stopReason}` : '';
    if (!view.transcript.dataset.edited) view.transcript.value = take.transcript;
    view.use.disabled = !view.transcript.value.trim();
    view.retry.hidden = ['stored', 'transcribing'].includes(take.state);
    if (take.id === recentTakeId && view.state !== take.state) {
      if (take.error) say(take.error, true);
      else if (take.state === 'ready') say('Transcript ready in Saved recordings & transcripts. Review it, then use it in the composer. Nothing has been sent.');
      else say('Recording safely stored. Transcribing… Nothing has been sent.');
    }
    view.state = take.state;
  }
}
async function sendText(text) {
  if (!authenticated) return say('Pair this device before sending. Your draft stays here.', true);
  if (!text.trim() || sendBusy) return;
  sendBusy = true; $('send').disabled = true;
  try {
    const item = await outbox.submit(text);
    if (!['checking_delivery', 'not_found', 'unknown_execution'].includes(item.state)) {
      if ($('composer').value === text) { $('composer').value = ''; localStorage.setItem('kherix.draft', ''); }
      say(`Receipt: ${item.state}. This stays in the existing session.`);
    } else { say('Delivery needs checking. Your draft and request ID are saved; no automatic resend.', true); $('delivery').open = true; }
    renderReceipts(); await refresh();
  } catch (error) { say(error.message || 'The outbox could not be saved. Nothing was sent.', true); }
  finally { sendBusy = false; $('send').disabled = !authenticated; }
}
$('compose').addEventListener('submit', event => { event.preventDefault(); sendText($('composer').value); });
$('token-unlock').addEventListener('submit', async event => {
  event.preventDefault(); const token = $('token').value; $('token').value = '';
  try { await request('/api/auth', { token }); $('unlock').hidden = true; await refresh(); } catch (error) { say(error.message, true); }
});
$('check-connection').addEventListener('click', refresh);
async function refresh() {
  if (refreshBusy) return;
  clearTimeout(timer); refreshBusy = true;
  try {
    const [context, thread, takes] = await Promise.all([request('/api/context'), request('/api/thread'), request('/api/takes'), outbox.refresh()]);
    renderContext(context); renderThread(thread); renderTakes(takes); renderReceipts();
    setAuthenticated(true);
    $('unlock').hidden = true; $('connection').classList.remove('error');
    $('connection').textContent = 'Connected · the same conversation. No automatic resends.';
    await renderLocalTakes();
  } catch (error) {
    if (error.status === 401) { $('unlock').hidden = false; setAuthenticated(false); }
    $('connection').classList.add('error');
    $('connection').textContent = error.status === 401 ? 'Locked · pair this device to continue. Your draft is kept.' : `Reconnecting · drafts are saved. ${error.message}`;
    $('presence').textContent = 'Not verified';
  } finally { refreshBusy = false; timer = setTimeout(refresh, 4000); }
}
window.addEventListener('online', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

// IndexedDB keeps the recording bytes, including snapshots during capture. No token is stored here.
let database;
function openRecordings() {
  if (!database) database = new Promise((resolve, reject) => {
    const req = indexedDB.open('kherix-recordings', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('takes', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  return database;
}
async function localRecordings(operation, value) {
  const db = await openRecordings();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('takes', operation === 'getAll' ? 'readonly' : 'readwrite');
    const store = tx.objectStore('takes'); const req = value === undefined ? store[operation]() : store[operation](value);
    tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
let backup = Promise.resolve();
const memoryTakes = new Map();
function snapshot(id, blob, state, capture) {
  const value = { id, blob, mime: blob.type, bytes: blob.size, state, capture, createdAt: new Date().toISOString(), backedUp: false };
  memoryTakes.set(id, value);
  backup = backup.catch(() => {}).then(() => localRecordings('put', value)).then(() => { value.backedUp = true; });
  backup.catch(() => say('Local recording backup failed. Keep this page open until the server confirms the upload.', true));
  return backup;
}
async function uploadRecording(take) {
  try {
    say('Saving recording and preparing an editable transcript…');
    const result = await request('/api/takes', undefined, { method: 'POST', headers: { 'content-type': take.mime, 'x-client-id': take.id, ...(take.capture ? { 'x-capture-info': JSON.stringify(take.capture) } : {}) }, body: take.blob, signal: AbortSignal.timeout(120000) });
    const confirmed = await request(`/api/takes/${result.take.id}`);
    if (confirmed.take.bytes !== take.blob.size) throw new Error('Stored byte count did not match');
    await localRecordings('delete', take.id).catch(() => {}); memoryTakes.delete(take.id);
    recentTakeId = take.id;
    say('Recording is safely stored. Transcribing… Nothing has been sent.'); $('recordings').open = true; await refresh();
    $('feed').scrollTop = $('feed').scrollHeight;
  } catch (error) { say(`Upload not confirmed: ${error.message}. The bytes are available below. If device backup failed, keep this page open or download before leaving.`, true); $('recordings').open = true; }
  await renderLocalTakes();
}
function downloadLocal(take) {
  const url = URL.createObjectURL(take.blob); const a = node('a'); a.href = url; a.download = `kherix-${take.id}.${take.mime.includes('webm') ? 'webm' : 'm4a'}`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function renderLocalTakes() {
  let saved = [];
  try { saved = await localRecordings('getAll'); }
  catch { /* In-memory bytes remain recoverable when device storage is unavailable. */ }
  const takes = new Map(saved.map(take => [take.id, { ...take, backedUp: true }]));
  for (const [id, take] of memoryTakes) takes.set(id, take);
  $('local-takes').replaceChildren();
  for (const take of [...takes.values()].filter(take => take.bytes && take.id !== (recording ? recordingId : null))) {
    const row = node('div', undefined, 'take');
    row.append(node('strong', take.backedUp ? 'Saved on this device' : 'Only in memory — not saved on this device'), node('p', `${take.state} · ${take.bytes} bytes · ${take.id}`));
    if (!take.backedUp) row.append(node('p', 'Keep this page open and download this recording before leaving. Device backup has not been confirmed.', 'error'));
    row.append(action('Upload / check saved take', () => uploadRecording(take)), action('Download saved take', () => downloadLocal(take)));
    $('local-takes').append(row);
  }
}
function recordingUI(active) {
  recording = active; $('record').hidden = active; $('stop').hidden = !active;
  $('record').disabled = !authenticated || starting || active;
  document.querySelectorAll('button[data-hear]').forEach(button => { button.disabled = starting || active || button.dataset.streaming === 'true'; });
  document.querySelectorAll('audio').forEach(audio => { audio.controls = !(starting || active); if (starting || active) audio.pause(); });
  if (!active) { clearInterval(clock); $('record-clock').textContent = ''; }
}
$('record').addEventListener('click', async () => {
  if (!authenticated) return say('Pair this device before recording. Existing saved takes stay available.', true);
  if (starting || recording) return;
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return say('Recording needs HTTPS and a browser with microphone recording support.', true);
  starting = true; recordingUI(false); say('Opening the microphone…');
  $('capture-status').textContent = 'Direct capture · keep this page visible and the screen on.';
  let mic;
  try {
    // One microphone consumer, as in Mia's working capture page. No Web Audio graph.
    mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(mic, mime ? { mimeType: mime } : {});
    const id = crypto.randomUUID(), chunks = [], startedAt = Date.now(); recordingId = id;
    let finished = false, guard, watchdog;
    const info = { version: 'direct-v1', elapsedMs: 0, chunkCount: 0, lastChunkAtMs: 0, stopReason: 'unexpected', muteCount: 0, endedCount: 0, errorName: '' };
    const elapsed = () => Math.min(86400000, Math.max(0, Date.now() - startedAt));
    const finish = async () => {
      if (finished) return;
      finished = true; clearTimeout(guard); clearTimeout(watchdog); info.elapsedMs = elapsed();
      $('capture-status').textContent = `${info.stopReason === 'requested' ? 'Capture stopped' : `Capture interrupted (${info.stopReason})`} after ${(info.elapsedMs / 1000).toFixed(1)}s · ${chunks.length} chunks. This is capture timing, not proof of speech.`;
      mic.getTracks().forEach(track => track.stop());
      if (capture === current) { capture = undefined; starting = false; recordingUI(false); $('stop').disabled = false; }
      const blob = new Blob(chunks, { type: recorder.mimeType.split(';')[0] });
      if (!blob.size) return say('The recorder produced no audio bytes. Nothing was sent.', true);
      try { await snapshot(id, blob, 'ready', { ...info }); } catch { /* Memory still owns the original bytes. */ }
      if (blob.size <= 25 * 1024 * 1024) await uploadRecording({ id, blob, mime: blob.type, capture: { ...info } });
      else await renderLocalTakes();
    };
    const current = { stop(reason = 'requested') {
      if (finished) return;
      if (info.stopReason === 'unexpected') info.stopReason = reason;
      $('stop').disabled = true;
      guard ??= setTimeout(() => { info.stopReason = 'stop-timeout'; return finish(); }, 3000);
      try { if (recorder.state !== 'inactive') return recorder.stop(); } catch { /* Preserve delivered chunks at the deadline. */ }
    } };
    capture = current;
    recorder.ondataavailable = event => {
      if (finished || !event.data.size) return; chunks.push(event.data);
      info.chunkCount = Math.min(100000, chunks.length); info.lastChunkAtMs = elapsed();
      const blob = new Blob(chunks, { type: recorder.mimeType.split(';')[0] || event.data.type.split(';')[0] });
      $('capture-status').textContent = `${blob.size} audio bytes received · keep this page visible. Speech is checked after Stop.`;
      snapshot(id, blob, 'partial', { ...info, elapsedMs: elapsed() });
      if (blob.size > 25 * 1024 * 1024) { say('Recording reached the upload limit. It will remain available for download.', true); current.stop('limit'); }
    };
    for (const track of mic.getTracks()) {
      track.addEventListener?.('mute', () => { if (!finished) { info.muteCount = Math.min(100000, info.muteCount + 1); $('capture-status').textContent = 'The browser muted the microphone. Keep the page visible; stop to preserve this take.'; } });
      track.addEventListener?.('ended', () => { if (!finished) { info.endedCount++; current.stop('track-ended'); } });
    }
    recorder.onerror = event => { if (finished) return; info.errorName = String(event?.error?.name || 'RecorderError').replace(/[^A-Za-z]/g, '').slice(0, 64); say('The recorder reported a problem. Finishing and preserving available audio…', true); current.stop('recorder-error'); };
    recorder.onstop = finish;
    recorder.start(1000); starting = false; recordingUI(true); say('Recording. Reply playback is paused. Stop to transcribe; sending is separate.');
    watchdog = setTimeout(() => { if (!finished && !chunks.length) $('capture-status').textContent = 'No audio bytes yet. Some browsers deliver bytes only at Stop; this does not prove microphone silence. Keep speaking, then Stop.'; }, 3500);
    clock = setInterval(() => { $('record-clock').textContent = `${Math.floor((Date.now() - startedAt) / 1000)}s`; }, 1000);
  } catch (error) { mic?.getTracks().forEach(track => track.stop()); capture = undefined; starting = false; recordingUI(false); say(`Microphone could not start: ${error.message}`, true); }
  finally { $('record').disabled = !authenticated || starting || recording; }
});
$('stop').addEventListener('click', () => capture?.stop());
async function start() {
  const fragment = typeof location !== 'undefined' ? new URLSearchParams(location.hash.slice(1)) : null;
  const code = fragment?.get('pair');
  if (code) {
    history.replaceState(null, '', location.pathname + location.search);
    try { await request('/api/pair', { code }); }
    catch (error) {
      $('pair-status').textContent = 'This pairing link could not unlock this browser. It may already be used or expired. Ask Kherix for a fresh private QR on the desktop, then scan it again.';
      say(error.message, true);
    }
  }
  renderReceipts(); renderLocalTakes(); refresh();
}
start();
