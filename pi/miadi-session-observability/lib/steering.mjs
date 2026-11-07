// The steering inbox of one Pi session: Pi's half of the contract in jgwill/Miadi
// packages/connector/STEERING.md (jgwill/Miadi#942). lib/steering_inbox.mjs is the same file every
// provider's adapter carries, and it holds the inbox: its layout, its order and every check made
// at consumption.
//
// Pi has the door this needs. pi.sendUserMessage(text, { deliverAs: "steer" }) puts the correction
// in the queue Pi drains after the current assistant turn has run its tool calls, before the next
// model request, so nothing is typed, no running tool is touched, and an idle session starts a run
// by itself. The message is a user message, because a person wrote it.
//
// sendUserMessage reports nothing back, and Pi refuses a prompt during compaction. Its `input` event
// fires only once Pi has taken the words, so that is the receipt: a hand-off with no input event in
// HANDOFF_MS goes back to the inbox and is tried again. Words that reach no model before the run settles
// (a person's abort returns them to their editor) leave a receipt saying so, and are not sent again.
import { readFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { announce, claimPending, IDENTITIES, receipt, retire, returnToPending, safe, statSafe, steeringRoot, withLock } from './steering_inbox.mjs';

const POLL_MS = 1000;
const HANDOFF_MS = 3000;
const RETRY_MS = 10_000;
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

  /** A hand-off Pi never took goes back to the inbox. */
  function settleHandoffs(now) {
    for (const [steer, h] of seat.handoff) {
      if (now - h.at < HANDOFF_MS) continue;
      seat.handoff.delete(steer);
      returnToPending(seat.dir, h.name, steer, 'Pi did not take it: it refuses a prompt during compaction');
      seat.holdUntil = now + RETRY_MS;
    }
  }

  /** Whatever waits goes to Pi now. Pi's queue owns the moment, and the same call starts a run when Pi is idle. */
  function deliver() {
    if (!seat) return;
    const { id, dir } = seat;
    const now = Date.now();
    settleHandoffs(now);
    if (now < seat.holdUntil) return;
    const claimed = withLock(dir, now, () => claimPending(dir, id, now));
    for (const c of claimed ?? []) {
      seat.handoff.set(c.envelope.steer, { name: c.name, at: now });
      try {
        pi.sendUserMessage(c.text, { deliverAs: 'steer' });
      } catch (error) {
        seat.handoff.delete(c.envelope.steer);
        returnToPending(dir, c.name, c.envelope.steer, error?.message ?? String(error));
        seat.holdUntil = now + RETRY_MS;
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
    seat = { id, dir, unseen: new Set(), handoff: new Map(), holdUntil: 0, watcher: undefined, timer: undefined };
    seat.timer = setInterval(() => {
      if (seat && !seat.watcher) watchPending();
      deliver();
    }, POLL_MS);
    seat.timer.unref?.();
    deliver();
  });

  // Pi has taken the words: from here its own queue owns them.
  pi.on('input', (event) => {
    if (!seat?.handoff.size) return;
    for (const [steer] of seat.handoff) {
      if (!String(event.text ?? '').includes(steer)) continue;
      seat.handoff.delete(steer);
      seat.unseen.add(steer);
      receipt(seat.dir, { steer, state: 'emitted', hook_event: 'pi.sendUserMessage steer' });
    }
  });

  // Nothing more will run: words still unread will not reach this model unless someone sends them again.
  pi.on('agent_settled', () => {
    if (!seat?.unseen.size) return;
    for (const steer of seat.unseen) receipt(seat.dir, { steer, state: 'left_provider_queue', reason: 'the run ended before a model request held it' });
    seat.unseen.clear();
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
