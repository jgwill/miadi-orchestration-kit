// The steering inbox of one Pi session: Pi's half of the contract in jgwill/Miadi
// packages/connector/STEERING.md (jgwill/Miadi#942). lib/steering_inbox.mjs is the same file every
// provider's adapter carries, and it holds the inbox: its layout, its order and every check made
// at consumption.
//
// Pi has the door this needs. pi.sendUserMessage(text, { deliverAs: "steer" }) puts the correction
// in the queue Pi drains after the current assistant turn has run its tool calls, before the next
// model request, so nothing is typed, no running tool is touched, and an idle session starts a run
// by itself. The message is a user message, because a person wrote it.
import { readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { announce, claimPending, IDENTITIES, receipt, retire, safe, statSafe, steeringRoot, withLock } from './steering_inbox.mjs';

const POLL_MS = 1000;
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export const PI_IDENTITY = { ...IDENTITIES.pi, adapter_version: VERSION };

const textOf = (content) => (typeof content === 'string' ? content : (Array.isArray(content) ? content : []).map((b) => b?.text ?? '').join('\n'));

export function registerSteeringInbox(pi, options = {}) {
  const env = options.env ?? process.env;
  let seat = null;

  function close() {
    if (!seat) return;
    clearInterval(seat.timer);
    seat.watcher?.close();
    seat = null;
  }

  /** Whatever waits goes to Pi now. Pi's queue owns the moment, and the same call starts a run when Pi is idle. */
  function deliver() {
    if (!seat) return;
    const { id, dir } = seat;
    const now = Date.now();
    const claimed = withLock(dir, now, () => claimPending(dir, id, now));
    for (const c of claimed ?? []) {
      try {
        pi.sendUserMessage(c.text, { deliverAs: 'steer' });
        seat.unseen.add(c.envelope.steer);
        receipt(dir, { steer: c.envelope.steer, state: 'emitted', hook_event: 'pi.sendUserMessage steer' });
      } catch (error) {
        receipt(dir, { steer: c.envelope.steer, state: 'emit_failed', reason: error?.message ?? String(error) });
      }
    }
  }

  function watchPending() {
    const pending = join(seat.dir, 'pending');
    if (!statSafe(pending)) return;
    try {
      seat.watcher = watch(pending, deliver);
      seat.watcher.on('error', () => {
        seat?.watcher?.close();
        if (seat) seat.watcher = undefined;
      });
    } catch {
      // The poll below carries it.
    }
  }

  pi.on('session_start', (event, ctx) => {
    close();
    const id = ctx.sessionManager.getSessionId();
    if (!id) return;
    announce({ session_id: id, transcript_path: ctx.sessionManager.getSessionFile() || undefined, source: event.reason || 'startup' }, env, { ...PI_IDENTITY, pid: process.pid });
    const dir = join(steeringRoot(env), safe(id));
    if (!statSafe(join(dir, 'adapter.json'))) return;
    seat = { id, dir, unseen: new Set(), watcher: undefined, timer: undefined };
    seat.timer = setInterval(() => {
      if (seat && !seat.watcher) watchPending();
      deliver();
    }, POLL_MS);
    seat.timer.unref?.();
    deliver();
  });

  // The request about to go to the model holds the correction: the adapter's own reading of it, one step before Pi's session file says so.
  pi.on('context', (event) => {
    if (!seat?.unseen.size) return;
    const text = (event.messages ?? []).map((m) => textOf(m.content)).join('\n');
    for (const steer of [...seat.unseen]) {
      if (!text.includes(steer)) continue;
      seat.unseen.delete(steer);
      receipt(seat.dir, { steer, state: 'in_model_request', hook_event: 'context' });
    }
  });

  pi.on('session_shutdown', (event, ctx) => {
    const id = seat?.id ?? ctx?.sessionManager?.getSessionId?.();
    close();
    if (id) retire({ session_id: id }, env);
  });
}
