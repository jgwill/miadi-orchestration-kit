import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCompanionServer } from '../server.mjs';
const pairing = await import('../pair.mjs').catch(() => ({}));

async function fixture(t) {
  const stateDir = mkdtempSync(join(tmpdir(), 'kherix-pair-'));
  const app = await createCompanionServer({ stateDir, authToken: 'test-private-companion-token', upstreamFetch: async () => new Response(JSON.stringify({ id: 'fe331909', agentId: '3d3a349a' })) });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await app.close(); rmSync(stateDir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { stateDir, base, post: code => fetch(base + '/api/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }) };
}

test('a local pairing grant is private, single-use and yields an HttpOnly session cookie', async t => {
  const f = await fixture(t);
  assert.equal(typeof pairing.createPairing, 'function');
  const link = pairing.createPairing({ stateDir: f.stateDir, publicUrl: 'https://phone.example.test' });
  const code = new URL(link).hash.slice('#pair='.length);
  assert.match(code, /^[A-Za-z0-9_-]{43}$/);
  const stored = readFileSync(join(f.stateDir, 'pairing.json'), 'utf8');
  assert.ok(!stored.includes(code));
  assert.equal(statSync(join(f.stateDir, 'pairing.json')).mode & 0o777, 0o600);
  assert.equal((await f.post('incorrect-code')).status, 401);
  const response = await f.post(code);
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  assert.equal((await fetch(f.base + '/api/context', { headers: { cookie: cookie.split(';')[0] } })).status, 200);
  assert.equal((await f.post(code)).status, 401);
});

test('expired or superseded pairing grants cannot unlock the companion', async t => {
  const f = await fixture(t);
  assert.equal(typeof pairing.createPairing, 'function');
  const code = options => new URL(pairing.createPairing({ stateDir: f.stateDir, publicUrl: 'https://phone.example.test', ...options })).hash.slice(6);
  const expired = code({ now: Date.now() - 20 * 60 * 1000 });
  assert.equal((await f.post(expired)).status, 401);
  const previous = code(); const current = code();
  assert.equal((await f.post(previous)).status, 401);
  assert.equal((await f.post(current)).status, 200);
});

test('phone pairing strips the fragment before authentication, and includes no automatic chat send', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /history\.replaceState\(/);
  assert.match(source, /request\('\/api\/pair'/);
  assert.ok(source.indexOf('history.replaceState(') < source.indexOf("request('/api/pair'"));
});
