// wake-classify — J7 of the Factory's next step (/home/mia/workspace/.mino/design/261026-factory-
// next-step-lane.md, section 4): what a witness wake means when a thread ends a turn. Jev reads the
// thread's binding line tail, the tail of its last message and the marks, and answers one choice:
// done, holds_question, idle_no_marks or running. Only holds_question is for William. The answer
// is a reading for the seat, never an act: below the bar the seat reads the thread itself.
//
// Used by witness-listen with --classify (a call per idle event) or --classify-dry (nothing sent).
// Off by default. The decider is lane-check's (LANE_CHECK_DIR), imported only when asked, so the
// listener runs without it. Every reading is appended to ~/.miadi/decisions/wake-classify.jsonl
// ($WAKE_CLASSIFY_LEDGER).
//
// Marks the listener can read: the DONE line in the last message. Whether the chart step is
// complete and whether the vessel file exists are not known to it (MINO §3c names all three), so
// they go to Jev as null, "not known", rather than as false.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const MODEL = "jev-1.14.0";
export const QUESTIONS_VERSION = "0.2.0";
export const BAR = 0.6;
export const TAIL_EVENTS = 3;
export const MESSAGE_TAIL = 1500;

export const STATES = {
  done: "The thread reports its work finished: its last message carries a DONE line or says the asked work is complete, and leaves nothing for anyone to answer.",
  holds_question: "The thread stopped to wait for an answer: its last message asks a person or another seat a question, or names a decision it needs before it can go on.",
  idle_no_marks: "The thread stopped without reporting the work finished and without asking anything: no DONE line, no question, no decision named.",
  running: "The thread is still working: its last message says a background task, a build or a listener will wake it, or that it goes on by itself.",
};

export const MOVES = {
  done: "check the marks, then relay its DONE line",
  holds_question: "read the question; answer it if it is the seat's, else bring it to William",
  idle_no_marks: "read the thread yourself and answer or restart it; not for William",
  running: "nothing to do; its turn is not over",
};

export function ledgerPath(env = process.env) {
  return env.WAKE_CLASSIFY_LEDGER || join(homedir(), ".miadi", "decisions", "wake-classify.jsonl");
}

// The last binding events of a session: when it started, ended, was renamed or given a mission.
export function bindingTail(lines, sessionId, n = TAIL_EVENTS) {
  const mine = [];
  for (const line of lines) {
    if (!line.includes(sessionId)) continue;
    try {
      const r = JSON.parse(line);
      if (r.session_id === sessionId) mine.push({ at: r.at, event: r.event, source: r.source ?? null, name: r.name?.name ?? null, tmux: r.tmux?.session ?? null, mission: r.mission ?? null });
    } catch { /* a torn line is skipped */ }
  }
  return mine.slice(-n);
}

export function readBindingTail(path, sessionId, n = TAIL_EVENTS) {
  if (!path || !existsSync(path)) return [];
  return bindingTail(readFileSync(path, "utf8").split("\n"), sessionId, n);
}

export function readLastMessage(sessiondata, sessionId) {
  try {
    const record = JSON.parse(readFileSync(join(sessiondata, sessionId, "last_claude_AssistantResponse.json"), "utf8"));
    return String(record.last_assistant_message ?? "").trim();
  } catch {
    return "";
  }
}

export function marksOf({ message = "", chartStepComplete = null, vesselFilePresent = null } = {}) {
  const doneLine = message.split("\n").some((l) => /^DONE\b/.test(l.trim().replace(/^[-*>]\s+/, "").replace(/^`+/, "")));
  return { done_line: doneLine, chart_step_complete: chartStepComplete, vessel_file_present: vesselFilePresent };
}

export function buildState({ thread, tail, message, marks }) {
  const t = message.length > MESSAGE_TAIL ? `… ${message.slice(-MESSAGE_TAIL)}` : message;
  return {
    thread: { name: thread.name ?? null, status: thread.status ?? null, status_since: thread.status_since ?? null, tmux: thread.tmux?.session ?? null },
    binding_tail: tail,
    last_message_tail: t || null,
    marks,
  };
}

// The four options in a rotated order, so the first-option lean can be measured (study R7).
export function buildQuestions(shift = 0) {
  const keys = Object.keys(STATES);
  const k = ((shift % keys.length) + keys.length) % keys.length;
  const order = [...keys.slice(k), ...keys.slice(0, k)];
  return {
    order,
    questions: {
      wake_state: {
        type: "choice",
        instructions: "The witness seat woke because `thread` ended a turn. Read `last_message_tail` and `marks`: which state is the thread in? `marks.done_line` true means its last message carries a line that begins with DONE. A mark that is null is not known, not absent.",
        criteria: Object.fromEntries(order.map((key) => [key, STATES[key]])),
      },
    },
  };
}

export function topProbabilityFor(confidence, n) {
  return Number((confidence * (1 - 1 / n) + 1 / n).toFixed(3));
}

export function readingOf(answer, readAnswer) {
  const r = readAnswer(answer);
  const values = Object.values(r.probabilities ?? {}).filter((v) => typeof v === "number");
  const top = values.length ? Math.max(...values) : null;
  const state = Object.hasOwn(STATES, r.value ?? "") ? r.value : null;
  const above = state !== null && typeof r.p === "number" && r.p >= BAR;
  return { state, confidence: typeof r.p === "number" ? r.p : null, top_probability: top, probabilities: r.probabilities ?? null, above_bar: above, for_william: above && state === "holds_question", move: !state ? "unread: read the thread yourself" : above ? MOVES[state] : "below the bar: read the thread yourself", read_status: r.read_status ?? null };
}

function countLines(path) {
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8").split("\n").filter(Boolean).length;
}

export async function loadDecider(env = process.env) {
  const dir = env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
  return import(pathToFileURL(join(dir, "lib", "decider.mjs")).href);
}

// One idle event's reading. Never throws: a wake must not fail because Jev did not answer.
export async function classifyWake(event, { decider, dry = false, sessiondata, bindingsPath, env = process.env, now = () => new Date() }) {
  try {
    const thread = event.thread;
    const message = readLastMessage(sessiondata, thread.session_id);
    const state = buildState({ thread, tail: readBindingTail(bindingsPath, thread.session_id), message, marks: marksOf({ message }) });
    const ledger = ledgerPath(env);
    const { order, questions } = buildQuestions(countLines(ledger));
    const request = decider.buildRequest(state, questions, MODEL);
    const estimated = decider.estimateTokens(request);
    if (dry) {
      const r = await decider.decideDry(request);
      return { dry: true, estimated_input_tokens: estimated, expected_paid_tokens: Math.round(estimated * 1.61), valid: r.validation?.ok !== false, marks: state.marks };
    }
    const result = await decider.decideJev(request);
    const reading = readingOf(result.answers?.wake_state, decider.readAnswer);
    const at = now().toISOString();
    const paid = Number(result.billing?.paid_input_tokens_used ?? NaN);
    const record = {
      kind: "decision", id: `wake-${thread.session_id.slice(0, 8)}-${at.replace(/[-:.TZ]/g, "").slice(0, 14)}`, at,
      questions_version: QUESTIONS_VERSION, requested_model: MODEL, model: result.model ?? null,
      session_id: thread.session_id, name: thread.name ?? null, status: thread.status ?? null,
      marks: state.marks, binding_tail: state.binding_tail, option_order: order,
      ...reading, bar: { confidence: BAR, top_probability: topProbabilityFor(BAR, order.length), options: order.length },
      estimated_input_tokens: estimated, paid_input_tokens: Number.isFinite(paid) ? paid : (result.usage?.input_tokens ?? null),
      run_id: result.billing?.run_id ?? result.id ?? null, billing: result.billing ?? null, validation: result.validation ?? null, ruling_id: null,
    };
    mkdirSync(dirname(ledger), { recursive: true });
    appendFileSync(ledger, `${JSON.stringify(record)}\n`);
    return record;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

// The line the wake prints under an idle event.
export function wakeLine(c) {
  if (!c) return null;
  if (c.error) return `   Jev (J7): not read (${c.error})`;
  if (c.dry) return `   Jev (J7, dry): nothing sent · ~${c.estimated_input_tokens} tokens estimated, ~${c.expected_paid_tokens} paid expected · DONE line ${c.marks.done_line ? "present" : "absent"}`;
  const n = (x) => (typeof x === "number" ? x.toFixed(2) : "?");
  return `   Jev (J7): ${c.state ?? "unread"} ${n(c.confidence)} (top ${n(c.top_probability)}; bar ${c.bar.confidence} = top ${c.bar.top_probability}) → ${c.move}${c.for_william ? " · for William" : ""} · ${c.id}`;
}
