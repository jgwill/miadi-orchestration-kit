import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CaptureStore, HOOKS, appendJson, archiveTranscript, bounded, runHook, sanitize, sessionRoot, sha256 } from './storage.mjs';

export function text(content, kind = 'text') {
  if (typeof content === 'string') return kind === 'text' ? content : '';
  return (Array.isArray(content) ? content : []).filter(b => b.type === kind).map(b => b[kind] || b.text || '').join('\n');
}
export function usage(u) {
  return { input: u?.input ?? 0, output: u?.output ?? 0, cache_read: u?.cacheRead ?? 0,
    cache_write: u?.cacheWrite ?? 0, total_tokens: u?.totalTokens ?? 0, cost_total: u?.cost?.total ?? 0,
    cost_reported: typeof u?.cost?.total === 'number' };
}
const CREDENTIAL = /(^|\/)(\.env(?!\.example$)[^/]*|[^/]+\.env|\.netrc|\.pgpass|\.npmrc|credentials(?:\.[^/]*)?|id_(?:rsa|ed25519)|[^/]*\.(?:pem|key|p12|pfx|tfstate))$/i;
const EVENTS = ['session_start', 'input', 'before_agent_start', 'agent_start', 'turn_start', 'context_with_system',
  'message_end', 'tool_call', 'tool_result', 'turn_end', 'agent_end', 'agent_settled', 'model_select',
  'session_compact', 'session_compact_failed', 'session_tree', 'session_info_changed', 'session_shutdown'];

export function registerObserver(pi, options = {}) {
  let store, currentId, metadata = {}, disabled = false, chain = Promise.resolve();
  let turn = 0, started, firstToken, request = 0, previousPrompt;
  const calls = new Map();
  const now = options.now || (() => performance.now());
  const warn = options.warn || (message => process.stderr.write(`[miadi-pi-observability] ${message}\n`));
  async function bind(kind, event, ctx) {
    try {
      if (event.reason !== 'reload') await runHook(join(HOOKS, 'terminal_binding.sh'), ['pi', kind, options.root || sessionRoot()], JSON.stringify({
        session_id: currentId, cwd: ctx.cwd, source: event.reason || event.type,
        transcript_path: ctx.sessionManager.getSessionFile() || '', pid: process.pid, argv: process.argv,
        name: ctx.sessionManager.getSessionName?.() || '',
      }));
    } catch { warn('Terminal binding unavailable; event capture remains active'); }
    try {
      const binding = JSON.parse((await readFile(join(store.dir, '_terminal_binding.jsonl'), 'utf8')).trimEnd().split('\n').at(-1));
      metadata = { ...metadata, team: binding.team, episode: binding.episode, tmux: binding.tmux, launch_alias: binding.launch_alias };
    } catch {}
  }
  async function written(call, event, ctx) {
    const path = call?.input?.path || call?.input?.file_path;
    if (!path || !['write', 'edit'].includes(event.toolName) || event.isError) return;
    const absolute = isAbsolute(path) ? path : resolve(ctx.cwd, path);
    const entry = { path: absolute, tool_call_id: event.toolCallId, timestamp: new Date().toISOString() };
    if (CREDENTIAL.test(absolute) || absolute.split('/').some(p => ['.aws', '.ssh', '.gnupg'].includes(p))) {
      entry.note = 'not copied: its name says it may hold credentials';
    } else {
      try {
        const info = await lstat(absolute);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024) entry.note = 'not copied: not a regular file or exceeds 256 KiB';
        else {
          const body = await readFile(absolute, 'utf8');
          if (body.includes('\0')) entry.note = 'not copied: binary';
          else entry.snapshot = await store.snapshot('written', await sanitize({ path: absolute, content: body }));
        }
      } catch { entry.note = 'not copied: unavailable'; }
    }
    await appendJson(join(store.dir, '_pi_files_written.jsonl'), await sanitize(entry));
  }
  async function handle(name, event, ctx, receivedAt) {
    if (name === 'session_start') {
      // No processes, timers, network, or filesystem writes before the real session lifecycle.
      await store?.close();
      currentId = ctx.sessionManager.getSessionId();
      store = new CaptureStore(options.root || sessionRoot(), currentId);
      disabled = false; metadata = {}; request = 0; previousPrompt = undefined; started = firstToken = undefined; calls.clear();
      await store.init();
      await bind('session.start', event, ctx);
    }
    if (!store || disabled) return;
    if (name === 'agent_start') await bind('observe', event, ctx);
    if (name === 'session_info_changed') await bind('session.rename', event, ctx);
    // Binary content is omitted before serialization, never copied to the capture root.
    // Do not recopy entire runs or Pi's boundary context into every turn/agent event.
    const capture = name === 'agent_end' ? { type: name, message_count: event.messages?.length || 0 } :
      name === 'turn_end' ? { type: name, turnIndex: event.turnIndex, message: event.message, outcome: event.outcome } : event;
    const clean = await sanitize(JSON.parse(JSON.stringify(capture, (_key, value) =>
      value?.type === 'image' || value?.type === 'audio' ? { type: value.type, omitted: 'binary payload' } : value)));
    if (name !== 'context_with_system') await store.raw(name, clean, ctx);
    const emit = (type, payload, model) => store.emit(type, payload, model ? { ...ctx, model } : ctx, metadata);
    if (name === 'session_start' || name === 'session_shutdown') await emit(name, { reason: clean.reason });
    if (name === 'input') {
      const input = await emit('user_message', { text: clean.text || '', images_count: clean.images?.length || 0, source: clean.source });
      metadata = { ...metadata, prompt_id: input.event_id };
    }
    if (name === 'before_agent_start') {
      metadata = { ...metadata, run_id: randomUUID() };
      const opts = clean.systemPromptOptions || {};
      const snapshot = await store.snapshot('prompt', { system_prompt: clean.systemPrompt, options: opts,
        semantics: 'observed at before_agent_start; later extensions can still modify prompt; listed skills are available, not necessarily read' });
      const changed = previousPrompt !== snapshot.sha256; previousPrompt = snapshot.sha256;
      await emit('agent_start', { prompt: clean.prompt || text(clean.message?.content), images_count: clean.images?.length || 0,
        session_id: currentId, session_file: ctx.sessionManager.getSessionFile(), snapshot,
        ...(changed ? { system_prompt: bounded(clean.systemPrompt || '', 128 * 1024),
          system_prompt_bytes: Buffer.byteLength(clean.systemPrompt || ''), system_prompt_sha256: sha256(clean.systemPrompt || ''),
          system_prompt_truncated: Buffer.byteLength(clean.systemPrompt || '') > 128 * 1024,
          system_prompt_options: { selected_tools: opts.selectedTools, prompt_guidelines: opts.promptGuidelines,
            context_files: opts.contextFiles, sections: opts.sections, skills: opts.skills } } : {}) });
    }
    if (name === 'turn_start') {
      turn = clean.turnIndex; started = receivedAt; firstToken = undefined;
      await emit('turn_start', { turn_index: turn });
    }
    if (name === 'context_with_system') {
      const snapshot = await store.snapshot('context', { messages: clean.messages });
      await emit('custom', { custom_type: 'context_snapshot', data: { request_index: request++, turn_index: turn,
        message_count: clean.messages?.length || 0, snapshot, semantics: 'observed at context_with_system; not serialized provider bytes' } });
    }
    if (name === 'message_end' && clean.message?.role === 'assistant') {
      const m = clean.message, u = usage(m.usage), end = receivedAt;
      const generation = firstToken === undefined ? undefined : Math.max(0, end - firstToken);
      await emit('assistant_message', { text: text(m.content), thinking: text(m.content, 'thinking'),
        tool_call_ids: (Array.isArray(m.content) ? m.content : []).filter(b => b.type === 'toolCall').map(b => b.id),
        stop_reason: m.stopReason || 'stop', usage: u, error_message: m.errorMessage, turn_index: turn,
        latency_ms: started === undefined ? undefined : Math.max(0, end - started),
        prefill_ms: started === undefined || firstToken === undefined ? undefined : Math.max(0, firstToken - started),
        generation_ms: generation, output_tps: generation >= 50 && u.output > 0 ? Math.round(u.output * 1000 / generation) : undefined },
        m.provider && m.model ? { provider: m.provider, id: m.model } : undefined);
      if (m.stopReason === 'error' || m.errorMessage) await emit('error', { where: 'model', message: m.errorMessage || 'Model response failed', turn_index: turn });
    }
    if (name === 'tool_call') {
      calls.set(clean.toolCallId, { input: clean.input, start: receivedAt });
      await emit('tool_call', { tool_call_id: clean.toolCallId, tool_name: clean.toolName, parent_tool_call_id: clean.parentToolCallId,
        args: Buffer.byteLength(JSON.stringify(clean.input || {})) > 16 * 1024
          ? { _truncated_json: bounded(JSON.stringify(clean.input || {}), 16 * 1024) } : clean.input || {},
        args_truncated: Buffer.byteLength(JSON.stringify(clean.input || {})) > 16 * 1024 });
    }
    if (name === 'tool_result') {
      const call = calls.get(clean.toolCallId); calls.delete(clean.toolCallId);
      const result = text(clean.content);
      await emit('tool_result', { tool_call_id: clean.toolCallId, tool_name: clean.toolName,
        parent_tool_call_id: clean.parentToolCallId, content_text: bounded(result, 32 * 1024),
        content_truncated: Buffer.byteLength(result) > 32 * 1024, is_error: clean.isError === true,
        duration_ms: call ? Math.max(0, receivedAt - call.start) : undefined,
        details_summary: { exit_code: clean.details?.exitCode ?? clean.details?.exit_code, cancelled: clean.details?.cancelled } });
      if (clean.isError) await emit('error', { where: 'tool', message: bounded(result, 2000), tool_call_id: clean.toolCallId, tool_name: clean.toolName });
      await written(call, clean, ctx);
    }
    if (name === 'turn_end') await emit('turn_end', { turn_index: clean.turnIndex, usage: usage(clean.message?.usage),
      duration_ms: started === undefined ? undefined : Math.max(0, receivedAt - started), outcome: clean.outcome });
    if (name === 'agent_end') { await emit('agent_end', { message_count: clean.message_count }); calls.clear(); }
    if (name === 'agent_settled') await emit('custom', { custom_type: 'agent_settled', data: { aborted: clean.aborted } });
    if (name === 'model_select') await emit('model_change', { provider: clean.model.provider, model: clean.model.id,
      previous_provider: clean.previousModel?.provider, previous_model: clean.previousModel?.id, source: clean.source }, clean.model);
    if (name === 'session_compact') await emit('compaction', { reason: clean.reason === 'manual' ? 'manual' : 'auto',
      trigger: clean.reason, tokens_before: clean.compactionEntry?.tokensBefore || 0,
      first_kept_entry_id: clean.compactionEntry?.firstKeptEntryId, summary_preview: bounded(clean.compactionEntry?.summary || '', 2000) });
    if (name === 'session_compact_failed') await emit('error', { where: 'compaction', message: clean.errorMessage || (clean.aborted ? 'Compaction aborted' : 'Compaction failed') });
    if (name === 'session_tree') await emit('branch_nav', { from_id: clean.oldLeafId || '', to_id: clean.newLeafId || '',
      has_summary: !!clean.summaryEntry, summary_preview: clean.summaryEntry?.summary });
    if (name === 'session_info_changed') await emit('custom', { custom_type: 'session_name', data: { name: clean.name } });
    if (['session_start', 'agent_end', 'session_shutdown'].includes(name)) {
      try { await archiveTranscript(store, ctx.sessionManager.getSessionFile()); }
      catch { warn(`${name}: transcript archive failed; event capture remains active`); }
    }
    if (name === 'session_shutdown') { await bind('session.end', event, ctx); await store.close(); store = undefined; }
  }
  for (const name of EVENTS) {
    pi.on(name, (event, ctx) => {
      const receivedAt = now();
      const task = chain.then(() => handle(name, event, ctx, receivedAt));
      chain = task.catch(async error => {
        // Never put payloads, paths, helper stderr, credentials, or exceptions on stdout/stderr.
        const reason = ['helper_timeout', 'helper_output_limit', 'helper_unavailable', 'helper_exit',
          'sanitizer_invalid_json', 'sanitizer_unavailable'].includes(error?.captureCode) ? error.captureCode : 'capture_unavailable';
        warn(`${name}: capture failed (${reason}); agent continues`);
        if (name === 'session_start') { disabled = true; await store?.close(); }
        if (name === 'session_shutdown') { await store?.close(); store = undefined; }
      });
      return chain; // no transform/gate return value, including tool_call and tool_result
    });
  }
  pi.on('message_update', event => {
    const type = event.assistantMessageEvent?.type;
    if (firstToken === undefined && (type === 'text_delta' || type === 'thinking_delta')) firstToken = now();
    // No subprocess/disk I/O per streaming delta. No thinking is fabricated when hidden by provider.
  });
}
