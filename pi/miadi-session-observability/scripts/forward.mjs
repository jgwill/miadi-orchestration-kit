#!/usr/bin/env node
import { open, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomicJson, sessionPath, sessionRoot, sha256 } from '../lib/storage.mjs';

export async function forwardOnce({ root, id, url, token, fetchImpl = fetch }) {
  const dir = sessionPath(root, id), file = join(dir, '_pi_observability.jsonl');
  const cursorFile = join(dir, `.pi-forward-${sha256(url).slice(0, 16)}.json`);
  let info; try { info = await stat(file); } catch (e) { if (e.code === 'ENOENT') return 0; throw e; }
  let previous; try { previous = JSON.parse(await readFile(cursorFile, 'utf8')); } catch {}
  let offset = previous?.ino === info.ino && previous?.dev === info.dev && previous.offset <= info.size ? previous.offset : 0;
  const batch = []; let bytes = 0, consumed = 0;
  const handle = await open(file, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(3 * 1024 * 1024, info.size - offset));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset);
    const end = buffer.subarray(0, bytesRead).lastIndexOf(10);
    if (end < 0 && bytesRead === 3 * 1024 * 1024) throw Error('Journal record exceeds transport budget');
    // Strict LF framing; unfinished records and UTF-8 bytes wait for the next pass.
    const lines = buffer.subarray(0, end + 1).toString('utf8').split('\n'); lines.pop();
    for (const line of lines) {
      const size = Buffer.byteLength(line) + 1;
      if (bytes + size > 3 * 1024 * 1024 || batch.length === 25) break;
      const event = JSON.parse(line);
      if (!event.event_id || event.session_id !== id || !Number.isSafeInteger(event.seq)) throw Error('Invalid event journal');
      batch.push(event); consumed += size; bytes += size;
    }
  } finally { await handle.close(); }
  if (!batch.length) return 0;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const response = await fetchImpl(`${url}/events`, { method: 'POST', headers, body: JSON.stringify(batch), signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw Error(`Dashboard HTTP ${response.status}`);
  const ack = await response.json();
  if (!Array.isArray(ack.rejected) || ack.ingested + ack.rejected.length !== batch.length) throw Error('Incomplete dashboard acknowledgement');
  // The reference server reports duplicates and seq conflicts identically. Verify rejected IDs
  // instead of silently discarding an event when another producer reused (session_id, seq).
  for (const id of ack.rejected) {
    const event = batch.find(e => e.event_id === id);
    if (!event) throw Error('Unknown rejected event');
    const check = await fetchImpl(`${url}/sessions/${encodeURIComponent(event.session_id)}/events?since_seq=${event.seq - 1}&limit=1`,
      { headers, signal: AbortSignal.timeout(3000) });
    if (!check.ok || (await check.json()).events?.[0]?.event_id !== id) throw Error('Dashboard sequence conflict; cursor not advanced');
  }
  await atomicJson(cursorFile, { offset: offset + consumed, ino: info.ino, dev: info.dev });
  return batch.length;
}

async function main() {
  const args = process.argv.slice(2), ids = []; let watch = false;
  let root = sessionRoot(), url = process.env.OBS_SERVER_URL || 'http://127.0.0.1:43190';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session') ids.push(args[++i]);
    else if (args[i] === '--root') root = args[++i];
    else if (args[i] === '--url') url = args[++i];
    else if (args[i] === '--watch') watch = true;
    else throw Error('Usage: forward.mjs --session <id> [--session <id>] [--root <dir>] [--url <loopback-url>] [--watch]');
  }
  const parsed = new URL(url); url = parsed.origin;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw Error('Only loopback dashboard URLs are allowed; use an SSH tunnel');
  }
  if (!ids.length || ids.some(id => !id)) throw Error('Select at least one --session');
  const token = process.env.OBS_AUTH_TOKEN || (process.env.OBS_TOKEN_FILE ? (await readFile(process.env.OBS_TOKEN_FILE, 'utf8')).trim() : '');
  if (!token) throw Error('Set OBS_AUTH_TOKEN or OBS_TOKEN_FILE');
  do {
    let count = 0;
    try { for (const id of ids) count += await forwardOnce({ root, id, url, token }); }
    catch (error) {
      // Deliberately omit URLs, paths, response bodies and tokens from service logs.
      console.error('Pi forwarding failed; durable events retained, retry pending');
      if (!watch) throw Error('Forwarding failed');
    }
    if (!watch && count) continue;
    if (!watch) break;
    await new Promise(resolve => setTimeout(resolve, count ? 50 : 1000));
  } while (true);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
