// lib — the pure half of miette-plan-insight: what a hook input says, what the seat is
// called, which carrier opens it, which episode it files into, and the primer it starts on.
// Nothing here touches tmux, the network or the disk, so the tests can hold all of it.

import { homedir } from "node:os";
import { join } from "node:path";

export const SEAT_SUFFIX = "-miette-insight";
export const DEFAULT_TEAM = "T3";
export const DEFAULT_LAUNCH = "claudemietteinsight";

const text = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** Where the seat keeps its state: one folder per planning session, and an index by seat name. */
export function stateRoot(env = process.env) {
  return (
    text(env.MIADI_MIETTE_STATE_DIR) ??
    join(text(env.XDG_STATE_HOME) ?? join(homedir(), ".local", "state"), "miadi-miette-plan-insight")
  );
}

/** The capture root the session-observability hooks write, where `plans/` lives. */
export function sessionDataRoot(env = process.env) {
  // The order session-observability's lib.sh and mct read.
  return (
    text(env.CLAUDE_SESSIONDATA_ROOT) ??
    text(env.MIADI_SESSION_DIR) ??
    text(env.MIADI_SESSIONDATA_ROOT) ??
    text(env.SESSION_DATA_ROOT) ??
    "/src/_sessiondata"
  );
}

/** A session id or a seat name safe to use as one path segment. */
export function safeSegment(value) {
  const v = text(value);
  return v && /^[\w.:-]+$/.test(v) && v !== "." && v !== ".." ? v : undefined;
}

/**
 * What a PreToolUse hook on ExitPlanMode hands over. The plan comes as `tool_input.plan`;
 * a build that writes the plan to a file names it instead (`planFilePath`, `plan_file_path`),
 * and the caller reads that file. Returns null when this is not a plan presented by a session.
 */
export function parseHookInput(raw) {
  let input;
  try {
    input = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!input || typeof input !== "object") return null;
  if (input.tool_name && input.tool_name !== "ExitPlanMode") return null;
  const sessionId = safeSegment(input.session_id);
  if (!sessionId) return null;
  const toolInput = input.tool_input && typeof input.tool_input === "object" ? input.tool_input : {};
  const plan = text(toolInput.plan);
  const planFile = text(toolInput.planFilePath) ?? text(toolInput.plan_file_path);
  if (!plan && !planFile) return null;
  return {
    sessionId,
    cwd: text(input.cwd),
    transcriptPath: text(input.transcript_path),
    plan,
    planFile
  };
}

/**
 * The seat beside a planning session: `<its tmux session>-miette-insight`. A session that
 * runs outside tmux gives `plan-<first 8 of its id>-miette-insight`. A tmux name may hold
 * characters tmux itself refuses in a target (`.` and `:`), so they become `-`.
 */
export function seatNameOf(planningTmux, sessionId, n = 1) {
  const base = text(planningTmux) ?? `plan-${shortKey(sessionId)}`;
  return `${base.replace(/[^\w-]/g, "-")}${n > 1 ? `-${n}` : ""}${SEAT_SUFFIX}`;
}

/**
 * A short, still distinct form of a key for a seat name: a session id's first 8 characters, a
 * miadi-run mission `miadiRun-<yyMMddHHmm>-<tmux>-<name>.v<N>` as `mission-<yyMMddHHmm>-v<N>`.
 */
export function shortKey(key) {
  const k = String(key);
  const mission = k.match(/^mission-miadiRun-(\d{10})-.*\.v(\d+)$/);
  if (mission) return `mission-${mission[1]}-v${mission[2]}`;
  if (k.startsWith("mission-") || k.startsWith("ask-")) return k.slice(0, 32);
  return k.slice(0, 8);
}

/** A Claude session id, as opposed to a mission or an ask kept by this plugin. */
export function isSessionId(key) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(key));
}

/** The first line of an insight that carries its recommendation, for a one-line summary. */
export function recommendationLine(insight) {
  const lines = String(insight).split("\n").map((l) => l.replace(/^[#>*\s-]+/, "").trim()).filter(Boolean);
  // A line that opens with the recommendation wins over an earlier line that only mentions accept or
  // revise. A bare "Recommendation" heading takes the verdict from the line under it.
  const at = lines.findIndex((l) => /^recommend/i.test(l));
  let line;
  if (at >= 0) {
    line = /^recommendation:?\s*$/i.test(lines[at].replace(/[*_]/g, "")) && lines[at + 1] ? `Recommendation: ${lines[at + 1].replace(/^[*_]+|[*_]+(?=[.:]|\s|$)/g, "")}` : lines[at];
  } else {
    line = lines.find((l) => /\b(accept|revise)\b/i.test(l)) ?? lines[0] ?? "";
  }
  return line.length > 200 ? `${line.slice(0, 197)}...` : line;
}

/** A seat never opens a seat for its own plans. */
export function isSeatName(tmuxName) {
  return typeof tmuxName === "string" && tmuxName.endsWith(SEAT_SUFFIX);
}

/** tmux by default; herdr when MIADI_PLAN_INSIGHT_CARRIER names it. */
export function carrierOf(env = process.env) {
  return text(env.MIADI_PLAN_INSIGHT_CARRIER)?.toLowerCase() === "herdr" ? "herdr" : "tmux";
}

/** The plugin is loaded on purpose, and MIADI_MIETTE_PLAN_INSIGHT=0 turns it off for one session. */
export function isDisabled(env = process.env) {
  return ["0", "off", "false", "no"].includes(String(env.MIADI_MIETTE_PLAN_INSIGHT ?? "").toLowerCase());
}

/** `yyMMddHHmmss`, local time: plan versions sort by name. */
export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${String(date.getFullYear()).slice(2)}${p(date.getMonth() + 1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

/** A plan version's name: `stamp()` and the milliseconds, so two versions never share one. */
export function planStamp(date = new Date()) {
  return `${stamp(date)}${String(date.getMilliseconds()).padStart(3, "0")}`;
}

/**
 * The episode the insight is filed in, from a `miadi-hooks-interpret join --json` record:
 * the binding line's episode when the line knew it (never the `declared` fallback, which
 * the join already drops), then the episode the session's inventory record names, then none.
 */
export function episodeOf(join) {
  if (!join || typeof join !== "object") return { folder: undefined, source: "none" };
  const line = text(join.episode?.id);
  if (line) return { folder: line, source: `binding line (${text(join.episode?.source) ?? "worked in"})` };
  const record = text(join.inventory?.episode?.folder);
  if (record) return { folder: record, source: "inventory record" };
  return { folder: undefined, source: "none" };
}

/** The first prompt the seat receives. It names the plan, the session and the episode, and the skill to follow. */
export function primerText({ seat, sessionId, planningTmux, planPath, userInputs, episode, mission, source, stateDir, fileCommand = "node <plugin>/scripts/miette-plan-insight.mjs file" }) {
  const byHand = typeof source === "string" && source.startsWith("asked by hand");
  const lines = [
    `You are Miette in the plan insight seat ${seat}.`,
    `Load the miette-plan-insight skill and follow it.`,
    ``,
    byHand
      ? `This plan was asked for by hand${planningTmux ? ` from tmux ${planningTmux}` : ""} (key ${sessionId}).`
      : `The planning session: ${planningTmux ? `tmux ${planningTmux}, ` : ""}session ${sessionId}.`,
    mission ? `It belongs to the mission ${mission}. The miadi-run skill resolves its pinned prompt if you need it.` : undefined,
    `${byHand ? "The plan" : "Its plan, as presented"}: ${planPath}`,
    userInputs ? `What the person asked, turn by turn: ${userInputs}` : `No record of the person's prompts was found for that session.`,
    episode?.folder
      ? `Its episode: ${episode.folder} (${episode.source === "asker" ? "given when it was asked for" : `from its ${episode.source}`}).`
      : `No episode is known for that session. Ask William in your first turn which episode this plan belongs to, or whether it has none.`,
    `Your folder for this plan: ${stateDir}`,
    ``,
    `Write your first insight, have the plan-critic agent critique it, revise, file it with \`${fileCommand} <your insight file>\`, then arm /miette-listen.`,
    `The plan-approval dialog in the planning session is William's to answer. Never type into that pane.`
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}
