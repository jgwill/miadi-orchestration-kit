#!/usr/bin/env node
// miette-plan-insight — when a session presents a plan, Miette reads it in a seat of her own.
//
//   hook              PreToolUse on ExitPlanMode: keep the plan version, open the seat in the
//                     background, return at once so the plan dialog is never held open
//   open --session    open `<planning tmux>-miette-insight` with `mct new`, primed with the plan;
//                     when the seat already runs, the new plan version waits for its listener
//   listen            in the seat: wait for the next plan version of the session it serves
//   file <insight>    in the seat: file the insight beside the plan and carry it to the wheel
//   status            what the seat serves, the plan versions, the listener, the insights filed
//
// tmux by default, herdr when MIADI_PLAN_INSIGHT_CARRIER=herdr and herdr answers.
// Exit codes: 0 done, 2 usage, 3 no seat state, 4 listen timed out, 5 another listener runs.

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LAUNCH,
  DEFAULT_TEAM,
  carrierOf,
  episodeOf,
  isDisabled,
  isSeatName,
  parseHookInput,
  planStamp,
  primerText,
  safeSegment,
  seatNameOf,
  sessionDataRoot,
  stamp,
  stateRoot
} from "./lib.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = resolve(dirname(SCRIPT), "..");
const EXIT_USAGE = 2;
const EXIT_NO_SEAT = 3;
const EXIT_TIMEOUT = 4;
const EXIT_BUSY = 5;

const env = process.env;
const now = () => new Date().toISOString();

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: options.timeout ?? 30_000, env: options.env ?? env });
  return { ok: r.status === 0, status: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim(), error: r.error };
}

/**
 * A binary the hook's PATH may not hold: try PATH, then beside this node (nvm), then the usual
 * places. An override names the one to use, and only that one.
 */
function findBin(name, override) {
  if (override) return existsSync(override) ? override : null;
  const which = run("bash", ["-c", `command -v ${name}`], { timeout: 5000 });
  if (which.ok && which.out) return which.out.split("\n")[0];
  for (const candidate of [join(dirname(process.execPath), name), join(homedir(), ".local", "bin", name), `/usr/local/bin/${name}`, `/usr/bin/${name}`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function tmuxSessionOfPane(pane) {
  if (!pane) return undefined;
  const r = run("tmux", ["display-message", "-p", "-t", pane, "#{session_name}"], { timeout: 5000 });
  return r.ok && r.out ? r.out : undefined;
}

function tmuxHasSession(name) {
  return run("tmux", ["has-session", "-t", `=${name}`], { timeout: 5000 }).ok;
}

const stateDirOf = (sessionId) => join(stateRoot(env), sessionId);
const seatIndexOf = (seat) => join(stateRoot(env), "seats", `${seat}.json`);
const seatFileOf = (sessionId) => join(stateDirOf(sessionId), "seat.json");

function planVersions(stateDir) {
  try {
    return readdirSync(stateDir).filter((n) => /^plan-\d{15}\.md$/.test(n)).sort().map((n) => join(stateDir, n));
  } catch {
    return [];
  }
}

/** Which planning session this process serves: --session, else the seat it runs in. */
function servedSession(args) {
  const given = safeSegment(args.session);
  if (given) return given;
  const seat = tmuxSessionOfPane(env.TMUX_PANE);
  if (seat) {
    const index = readJson(seatIndexOf(seat));
    if (index?.planning_session) return index.planning_session;
  }
  return undefined;
}

// ---------- hook ----------

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Keep one plan version under its key and open (or wake) the seat in the background. The key
 * is the planning session's id; a plan asked for by hand without a session is keyed by its
 * mission, or by the moment it was asked. Returns the seat's name and whether it already ran.
 */
function keepPlan({ key, planText, planningTmux, cwd, transcriptPath, mission, episode, source }) {
  const stateDir = stateDirOf(key);
  mkdirSync(stateDir, { recursive: true });
  const planPath = join(stateDir, `plan-${planStamp()}.md`);
  writeFileSync(planPath, planText.endsWith("\n") ? planText : `${planText}\n`);

  const prior = readJson(seatFileOf(key), {});
  const seat = prior.seat ?? seatNameOf(planningTmux, key);
  writeJson(seatFileOf(key), {
    ...prior,
    planning_session: key,
    planning_tmux: planningTmux ?? prior.planning_tmux ?? null,
    seat,
    cwd: cwd ?? prior.cwd ?? null,
    transcript_path: transcriptPath ?? prior.transcript_path ?? null,
    mission: mission ?? prior.mission ?? null,
    episode_given: episode ?? prior.episode_given ?? null,
    created_at: prior.created_at ?? now(),
    last_plan: planPath,
    last_source: source
  });
  writeJson(seatIndexOf(seat), { planning_session: key, state_dir: stateDir });

  // Detached, with stdio on a log file and never on the hook's pipes: Claude Code holds the
  // plan dialog until every writer on them closes (the session-observability hook paid for this).
  const log = openSync(join(stateDir, "open.log"), "a");
  const child = spawn(process.execPath, [SCRIPT, "open", "--session", key], { detached: true, stdio: ["ignore", log, log], env });
  child.unref();
  return { seat, running: tmuxHasSession(seat), planPath };
}

async function hook() {
  if (isDisabled(env)) return 0;
  const input = parseHookInput(await readStdin());
  if (!input) return 0;
  const planningTmux = tmuxSessionOfPane(env.TMUX_PANE);
  // A seat's own plans never open a seat: Miette does not watch herself.
  if (isSeatName(planningTmux)) return 0;

  let plan = input.plan;
  if (!plan && input.planFile) {
    try {
      plan = readFileSync(input.planFile, "utf8");
    } catch {
      return 0;
    }
  }
  if (!plan?.trim()) return 0;

  const { seat, running } = keepPlan({
    key: input.sessionId,
    planText: plan,
    planningTmux,
    cwd: input.cwd,
    transcriptPath: input.transcriptPath,
    source: "ExitPlanMode"
  });
  process.stdout.write(
    `${JSON.stringify({
      systemMessage: running ? `Miette reads this new version of the plan in tmux ${seat}.` : `Miette is opening tmux ${seat} to read this plan.`
    })}\n`
  );
  return 0;
}

// ---------- ask: by hand ----------

/** The Claude session that runs in this pane, from the live registry the interpreter reads. */
function sessionOfPane(pane) {
  const bin = pane && findBin("miadi-hooks-interpret", env.MIADI_HOOKS_INTERPRET_BIN);
  if (!bin) return undefined;
  const r = run(bin, ["join", "--live", "--json", "--root", sessionDataRoot(env)], { timeout: 30_000 });
  if (!r.ok) return undefined;
  try {
    return safeSegment(JSON.parse(r.out).find((j) => j.live?.pane_id === pane)?.session_id);
  } catch {
    return undefined;
  }
}

/**
 * Ask Miette for an insight on any plan: a brief, a mission's prompt, a plan file. The seat sits
 * beside the session asking (or the one named with --for), and a mission or an episode given
 * here is what the seat files the insight under.
 */
function ask(args) {
  const planFile = args.plan ?? args.positional[0];
  if (!planFile || !existsSync(planFile)) {
    console.error("ask: give the plan, brief or mission prompt to read: ask --plan <file> [--for <tmux session>] [--session <id>] [--mission <id>] [--episode <folder>]");
    return EXIT_USAGE;
  }
  const planText = readFileSync(planFile, "utf8");
  if (!planText.trim()) {
    console.error(`ask: ${planFile} is empty`);
    return EXIT_USAGE;
  }
  const here = tmuxSessionOfPane(env.TMUX_PANE);
  const planningTmux = args.for ?? (isSeatName(here) ? undefined : here);
  const mission = safeSegment(args.mission);
  const key = safeSegment(args.session) ?? (args.for ? undefined : sessionOfPane(env.TMUX_PANE)) ?? (mission ? `mission-${mission}` : `ask-${stamp()}`);
  const { seat, running, planPath } = keepPlan({
    key,
    planText: `<!-- asked by hand from ${resolve(planFile)} -->\n\n${planText}`,
    planningTmux,
    cwd: process.cwd(),
    mission,
    episode: args.episode,
    source: `asked by hand: ${resolve(planFile)}`
  });
  console.log(running ? `${seat} runs: Miette's listener wakes on ${planPath}` : `opening ${seat} for ${planPath} (log: ${join(stateDirOf(key), "open.log")})`);
  return 0;
}

// ---------- open ----------

function joinRecord(sessionId) {
  const bin = findBin("miadi-hooks-interpret", env.MIADI_HOOKS_INTERPRET_BIN);
  if (!bin) return null;
  const inventory = env.MIADI_SESSION_INVENTORY_DIR || join(homedir(), "workspace", ".mino", "session-inventory");
  const args = ["join", sessionId, "--json", "--root", sessionDataRoot(env)];
  if (existsSync(inventory)) args.push("--inventory", inventory);
  const r = run(bin, args, { timeout: 30_000 });
  if (!r.ok) return null;
  try {
    const parsed = JSON.parse(r.out);
    return Array.isArray(parsed) ? parsed.find((j) => j.session_id === sessionId) ?? null : null;
  } catch {
    return null;
  }
}

function herdrOpen({ seat, cwd, launch, primerPath, log }) {
  const herdr = findBin("herdr", env.MIADI_HERDR_BIN);
  if (!herdr || !run(herdr, ["workspace", "list"], { timeout: 10_000 }).ok) {
    log("herdr does not answer: opening in tmux instead");
    return null;
  }
  const created = run(herdr, ["workspace", "create", "--cwd", cwd, "--label", seat, "--no-focus"], { timeout: 20_000 });
  let pane;
  try {
    pane = JSON.parse(created.out)?.result?.root_pane?.pane_id;
  } catch {
    pane = undefined;
  }
  if (!pane) {
    log(`herdr workspace create gave no pane: opening in tmux instead (${created.err || created.out})`);
    return null;
  }
  // One short command reaches the pane whole; the primer is the agent's first prompt.
  const launcher = join(dirname(primerPath), "herdr-launch.sh");
  writeFileSync(launcher, `#!/bin/bash\ncd ${JSON.stringify(cwd)}\nexec $SHELL -ic '${launch} -n ${seat} "$(cat ${primerPath})"'\n`, { mode: 0o755 });
  run(herdr, ["pane", "run", pane, `bash ${launcher}`], { timeout: 20_000 });
  return { carrier: "herdr", pane };
}

function open(args) {
  const sessionId = safeSegment(args.session);
  if (!sessionId) {
    console.error("open: --session <id> is required");
    return EXIT_USAGE;
  }
  const stateDir = stateDirOf(sessionId);
  const seatState = readJson(seatFileOf(sessionId));
  if (!seatState?.seat) {
    console.error(`open: no seat state for ${sessionId} in ${stateDir}`);
    return EXIT_NO_SEAT;
  }
  const log = (line) => console.log(`${now()} ${line}`);
  const plans = planVersions(stateDir);
  const plan = plans.at(-1);
  if (!plan) {
    log("no plan version kept: nothing to open");
    return EXIT_NO_SEAT;
  }
  const seat = seatState.seat;
  if (!args.dryRun && tmuxHasSession(seat)) {
    log(`${seat} already runs: ${plan} waits for its listener`);
    return 0;
  }

  const episode = seatState.episode_given
    ? { folder: seatState.episode_given, source: "asker" }
    : episodeOf(joinRecord(sessionId));
  const inputs = join(sessionDataRoot(env), sessionId, "_claude_user_inputs.jsonl");
  const cwd = seatState.cwd && existsSync(seatState.cwd) ? seatState.cwd : homedir();
  const primer = primerText({
    seat,
    sessionId,
    planningTmux: seatState.planning_tmux,
    planPath: plan,
    userInputs: existsSync(inputs) ? inputs : undefined,
    episode,
    mission: seatState.mission,
    source: seatState.last_source,
    stateDir
  });
  const primerPath = join(stateDir, `primer-${stamp()}.md`);
  const team = env.MIADI_MIETTE_TEAM || DEFAULT_TEAM;
  const launch = env.MIADI_MIETTE_LAUNCH || DEFAULT_LAUNCH;
  const carrier = carrierOf(env);

  if (args.dryRun) {
    console.log(JSON.stringify({ seat, team, carrier, cwd, launch, plan, episode, primer }, null, 2));
    return 0;
  }
  writeFileSync(primerPath, `${primer}\n`);

  let opened = carrier === "herdr" ? herdrOpen({ seat, cwd, launch, primerPath, log }) : null;
  if (!opened) {
    const mct = findBin("mct", env.MIADI_MCT_BIN);
    if (!mct) {
      log("mct is not found: the seat cannot be opened (install @miadi/chronicle-tui)");
      return EXIT_NO_SEAT;
    }
    const r = run(mct, ["new", team, seat, "--cwd", cwd, "--launch", launch, "--remote", "--prompt-file", primerPath, "-d"], { timeout: 60_000 });
    log(`mct new ${team} ${seat}: exit ${r.status}${r.err ? ` · ${r.err.split("\n").at(-1)}` : ""}`);
    if (!r.ok) return r.status ?? 1;
    opened = { carrier: "tmux" };
  }
  writeJson(seatFileOf(sessionId), {
    ...readJson(seatFileOf(sessionId), seatState),
    opened_at: now(),
    carrier: opened.carrier,
    herdr_pane: opened.pane ?? null,
    team,
    episode: episode.folder ?? null,
    episode_source: episode.source,
    primer: primerPath
  });
  log(`${seat} opened by ${opened.carrier} for ${sessionId}, episode ${episode.folder ?? "none"} (${episode.source})`);
  return 0;
}

// ---------- listen ----------

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function listen(args) {
  const sessionId = servedSession(args);
  if (!sessionId) {
    console.error("listen: this pane is not a Miette seat. Give --session <planning session id>.");
    return EXIT_NO_SEAT;
  }
  const stateDir = stateDirOf(sessionId);
  const seatFile = seatFileOf(sessionId);
  const seatState = readJson(seatFile);
  if (!seatState) {
    console.error(`listen: no seat state in ${stateDir}`);
    return EXIT_NO_SEAT;
  }
  const pidFile = join(stateDir, "listener.pid");
  const holder = readJson(pidFile);
  if (holder && holder.pid !== process.pid && pidAlive(holder.pid)) {
    console.log(`another listener already waits for ${seatState.planning_tmux ?? sessionId}: pid ${holder.pid} since ${holder.since}`);
    return EXIT_BUSY;
  }
  writeJson(pidFile, { pid: process.pid, since: now() });

  // The plan the first insight answered is the baseline: only a later version wakes the seat.
  let heard = seatState.heard_plan ?? planVersions(stateDir).at(-1) ?? null;
  writeJson(seatFile, { ...readJson(seatFile, seatState), heard_plan: heard });

  const interval = Math.max(1, Number(args.interval ?? 5)) * 1000;
  const deadline = Date.now() + Math.max(60, Number(args.timeout ?? 6 * 3600)) * 1000;
  try {
    while (Date.now() < deadline) {
      const latest = planVersions(stateDir).at(-1) ?? null;
      if (latest && latest !== heard) {
        writeJson(seatFile, { ...readJson(seatFile, seatState), heard_plan: latest });
        console.log(
          [
            `MIETTE WAKE · a new version of the plan in ${seatState.planning_tmux ?? sessionId}`,
            `plan: ${latest}`,
            heard ? `previous: ${heard}` : `previous: none`,
            ``,
            `Read both, say what changed, and whether your recommendation still holds. File it with`,
            `\`node ${SCRIPT} file <insight>\`, then re-arm with /miette-listen.`
          ].join("\n")
        );
        return 0;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    console.log(`witness: no new plan version for ${seatState.planning_tmux ?? sessionId} before the timeout`);
    return EXIT_TIMEOUT;
  } finally {
    const current = readJson(pidFile);
    if (current?.pid === process.pid) writeJson(pidFile, { pid: null, since: null, ended: now() });
  }
}

// ---------- file ----------

function file(args) {
  const sessionId = servedSession(args);
  const insight = args.positional[0];
  if (!sessionId || !insight || !existsSync(insight)) {
    console.error("file: give the insight file, from inside the seat or with --session <planning session id>");
    return EXIT_USAGE;
  }
  const stateDir = stateDirOf(sessionId);
  const seatFile = seatFileOf(sessionId);
  const seatState = readJson(seatFile, {});
  const kept = join(stateDir, `insight-${stamp()}.md`);
  copyFileSync(insight, kept);

  // The perspective sits where @miadi/plan-insight has always looked for it.
  const sessionDir = join(sessionDataRoot(env), sessionId);
  const plansDir = join(sessionDir, "plans");
  mkdirSync(plansDir, { recursive: true });
  // plan-insight-register registers a perspective with the plan it answers, `session_<id>_<stamp>.md`.
  // session-observability writes it when it is loaded. When it is not, or the plan was asked
  // for by hand, the plan this insight answers is put there.
  const answered = seatState.heard_plan ?? seatState.last_plan;
  const hasSnapshot = readdirSync(plansDir).some((n) => n.startsWith(`session_${sessionId}_`) && n.endsWith(".md"));
  if (!hasSnapshot && answered && existsSync(answered)) {
    copyFileSync(answered, join(plansDir, `session_${sessionId}_${stamp().slice(0, 10)}.md`));
  }
  copyFileSync(insight, join(plansDir, "miette_perspective.md"));
  writeFileSync(join(plansDir, ".miette_perspective.done"), `${now()}\n`);

  let carried = "plan-insight-register is not found: the insight is filed and not carried to the wheel";
  const register = findBin("plan-insight-register", env.MIADI_PLAN_INSIGHT_REGISTER_BIN);
  if (register && !args.noRegister) {
    const regArgs = ["--session", sessionDir, "--json"];
    if (seatState.episode) regArgs.push("--episode", seatState.episode);
    const r = run(register, regArgs, { timeout: 60_000 });
    carried = r.ok ? `carried to the wheel: ${(r.out.match(/"id"\s*:\s*"([^"]+)"/) ?? [])[1] ?? "registered"}` : `the wheel did not take it (exit ${r.status}): ${(r.err || r.out).split("\n").at(-1)}`;
  }
  const insights = Array.isArray(seatState.insights) ? seatState.insights : [];
  writeJson(seatFile, { ...seatState, insights: [...insights, { at: now(), file: kept, plan: seatState.heard_plan ?? seatState.last_plan ?? null }] });
  console.log(`filed: ${kept}\nbeside the plan: ${join(plansDir, "miette_perspective.md")}\n${carried}`);
  return 0;
}

// ---------- status ----------

function status(args) {
  const sessionId = servedSession(args);
  if (!sessionId) {
    const seats = (() => {
      try {
        return readdirSync(join(stateRoot(env), "seats")).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5));
      } catch {
        return [];
      }
    })();
    console.log(seats.length ? `seats:\n${seats.map((s) => `  ${s}${tmuxHasSession(s) ? " (running)" : ""}`).join("\n")}` : "no seat has been opened on this host");
    return 0;
  }
  const stateDir = stateDirOf(sessionId);
  const seatState = readJson(seatFileOf(sessionId));
  if (!seatState) {
    console.log(`no seat state for ${sessionId}`);
    return EXIT_NO_SEAT;
  }
  const holder = readJson(join(stateDir, "listener.pid"));
  const plans = planVersions(stateDir);
  console.log(
    [
      `seat ${seatState.seat}${tmuxHasSession(seatState.seat) ? " (running)" : " (not running)"} · ${seatState.carrier ?? "not opened yet"}`,
      `serves ${seatState.planning_tmux ?? "a session outside tmux"} · ${sessionId}`,
      `episode ${seatState.episode ?? "none"}${seatState.episode_source ? ` (${seatState.episode_source})` : ""}`,
      `plan versions ${plans.length} · heard ${seatState.heard_plan ? seatState.heard_plan.split("/").at(-1) : "none"}`,
      `listener ${holder?.pid && pidAlive(holder.pid) ? `pid ${holder.pid} since ${holder.since}` : "not running"}`,
      `insights filed ${Array.isArray(seatState.insights) ? seatState.insights.length : 0}`
    ].join("\n")
  );
  return 0;
}

// ---------- main ----------

function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--session") args.session = argv[++i];
    else if (a === "--timeout") args.timeout = argv[++i];
    else if (a === "--interval") args.interval = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-register") args.noRegister = true;
    else if (a === "--plan") args.plan = argv[++i];
    else if (a === "--for") args.for = argv[++i];
    else if (a === "--mission") args.mission = argv[++i];
    else if (a === "--episode") args.episode = argv[++i];
    else args.positional.push(a);
  }
  return args;
}

const USAGE = `usage: miette-plan-insight.mjs <hook|ask|open|listen|file|status>
  ask --plan <file> [--for <tmux session>] [--session <id>] [--mission <id>] [--episode <folder>]
  open --session <key> [--dry-run]
  listen [--session <key>] [--timeout <s>] [--interval <s>]
  file <insight file> [--session <key>] [--no-register]
  status [--session <key>]`;

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (command) {
    case "hook":
      return hook();
    case "ask":
      return ask(args);
    case "open":
      return open(args);
    case "listen":
    case "await":
      return listen(args);
    case "file":
      return file(args);
    case "status":
      return status(args);
    default:
      console.log(USAGE);
      return command === "--help" || command === "-h" ? 0 : EXIT_USAGE;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
  main().then(
    (code) => process.exit(code ?? 0),
    (error) => {
      // A hook must never block the plan: report and leave with 0 there.
      console.error(`miette-plan-insight: ${error?.message ?? error}`);
      process.exit(process.argv[2] === "hook" ? 0 : 1);
    }
  );
}
