import test from 'node:test';
import assert from 'node:assert/strict';
const client = await import('../public/state.js').catch(() => ({}));
function memory() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) }; }

test('browser outbox persists before transport, reconnects read-only and retries only explicitly with the same ID', async () => {
  assert.equal(typeof client.Outbox, 'function');
  const storage = memory(); const calls = [];
  let reachable = false;
  const request = async (path, payload) => {
    calls.push({ path, payload });
    if (payload) {
      assert.ok(storage.getItem('kherix.outbox').includes('Remember my words'));
      if (!reachable) throw new Error('offline');
      return { receipt: { clientId: payload.clientId, text: payload.text, state: 'queued' } };
    }
    const error = new Error('not found'); error.status = 404; throw error;
  };
  const outbox = new client.Outbox(storage, request, () => 'client-stable-id');
  const sent = await outbox.submit('Remember my words');
  assert.equal(sent.state, 'checking_delivery');
  assert.equal(calls.length, 1);
  const reconnected = new client.Outbox(storage, request);
  await reconnected.refresh();
  assert.equal(reconnected.items[0].state, 'not_found');
  assert.ok(calls.slice(1).every(c => !c.payload));
  await reconnected.submit('Remember my words');
  assert.equal(calls.filter(c => c.payload).length, 1);
  reachable = true;
  await reconnected.retry('client-stable-id');
  assert.equal(calls.filter(c => c.payload).length, 2);
  assert.equal(calls.at(-1).payload.clientId, 'client-stable-id');
  assert.equal(reconnected.items[0].state, 'queued');
  await reconnected.retry('client-stable-id');
  assert.equal(calls.filter(c => c.payload).length, 2, 'known receipts are never resent');
});
