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
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
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
  isSessionId,
  listenDeadline,
  recommendationLine,
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

/** Write to a temporary file and rename it, so a reader never meets a half-written file. */
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

/** Merge fields into a JSON file read again just before writing, so a concurrent writer is not undone. */
function updateJson(path, fields) {
  writeJson(path, { ...readJson(path, {}), ...fields });
}

/** A value as one single-quoted shell word. */
const shellQuote = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

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

function herdrHasWorkspace(label) {
  const herdr = findBin("herdr", env.MIADI_HERDR_BIN);
  if (!herdr) return false;
  const r = run(herdr, ["workspace", "list"], { timeout: 10_000 });
  try {
    return r.ok && (JSON.parse(r.out)?.result?.workspaces ?? []).some((w) => w.label === label);
  } catch {
    return false;
  }
}

/** Whether a seat runs: its tmux session, or the herdr workspace it was opened in. */
function seatRunning(seat, carrier) {
  return tmuxHasSession(seat) || (carrier === "herdr" && herdrHasWorkspace(seat));
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Whether a listener waits for this key: a new plan version only wakes a seat whose listener runs. */
function listenerAlive(key) {
  const holder = readJson(join(stateDirOf(key), "listener.pid"));
  return Boolean(holder?.pid && pidAlive(holder.pid));
}

/** Which planning session this process serves: --session, else the seat it runs in. */
function servedSession(args) {
  const given = safeSegment(args.session);
  if (given) return given;
  const seat = safeSegment(env.MIADI_MIETTE_SEAT) ?? tmuxSessionOfPane(env.TMUX_PANE);
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
  // A seat name already serving another key gets a number, so two plans asked for from one
  // tmux session never share a seat, and a running seat's listener never loses its key.
  // A name whose seat no longer runs is free again.
  let seat = prior.seat;
  for (let n = 1; !seat && n <= 50; n += 1) {
    const candidate = seatNameOf(planningTmux, key, n);
    const holder = readJson(seatIndexOf(candidate));
    if (!holder || holder.planning_session === key || !seatRunning(candidate, readJson(seatFileOf(holder.planning_session), {}).carrier)) seat = candidate;
  }
  seat ??= seatNameOf(planningTmux, `${key}-${planStamp()}`);
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
  return { seat, running: seatRunning(seat, prior.carrier), listening: listenerAlive(key), planPath };
}

/** What the person who presented the plan is told about the seat. */
function seatNotice(seat, running, listening) {
  if (!running) return `Miette is opening a seat named ${seat} to read this plan.`;
  if (listening) return `Miette reads this new version of the plan in ${seat}.`;
  return `Miette's seat ${seat} is open and is not listening: run /miette-listen there and she reads this version.`;
}

async function hook() {
  if (isDisabled(env)) return 0;
  const input = parseHookInput(await readStdin());
  if (!input) return 0;
  // A seat's own plans never open a seat: Miette does not watch herself. A herdr seat has no
  // tmux session of its own, so the seat is also named in its environment.
  if (env.MIADI_MIETTE_SEAT) return 0;
  const planningTmux = tmuxSessionOfPane(env.TMUX_PANE);
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

  const { seat, running, listening } = keepPlan({
    key: input.sessionId,
    planText: plan,
    planningTmux,
    cwd: input.cwd,
    transcriptPath: input.transcriptPath,
    source: "ExitPlanMode"
  });
  process.stdout.write(`${JSON.stringify({ systemMessage: seatNotice(seat, running, listening) })}\n`);
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
/** miadi-run, the kit skill script: MIADI_RUN_BIN when set (an executable), else the skill beside the kit. */
function miadiRun(args, timeout = 60_000) {
  if (env.MIADI_RUN_BIN) return existsSync(env.MIADI_RUN_BIN) ? run(env.MIADI_RUN_BIN, args, { timeout }) : { ok: false, status: 127, out: "", err: `${env.MIADI_RUN_BIN} not found` };
  const script = [
    env.MIADI_ORCHESTRATION_KIT_ROOT && join(env.MIADI_ORCHESTRATION_KIT_ROOT, "skills", "miadi-run", "miadi-run.mjs"),
    join(homedir(), ".claude", "skills", "miadi-run", "miadi-run.mjs"),
    resolve(PLUGIN_ROOT, "..", "..", "skills", "miadi-run", "miadi-run.mjs")
  ].find((p) => p && existsSync(p));
  if (!script) return { ok: false, status: 127, out: "", err: "the miadi-run skill script is not found" };
  return run(process.execPath, [script, ...args], { timeout });
}

/**
 * An episode given by number becomes its folder name, which is what the binding line, the
 * wheel and plan-insight-register name an episode by. A folder name is kept as given.
 */
function episodeFolderOf(value) {
  const v = typeof value === "string" ? value.trim().replace(/^miadi-chronicle:(\/\/)?/, "") : "";
  if (!/^\d+$/.test(v)) return v || undefined;
  const root = env.MIADI_CHRONICLE_ROOT || "/srv/miadi/episodes/miadi-chronicle";
  const n = String(Number(v));
  try {
    return readdirSync(root).find((d) => new RegExp(`-episode-0*${n}-`).test(d)) ?? v;
  } catch {
    return v;
  }
}

function ask(args) {
  const mission = safeSegment(args.mission);
  const planFile = args.plan ?? args.positional[0];
  let planText;
  let from;
  if (planFile) {
    if (!existsSync(planFile)) {
      console.error(`ask: ${planFile} does not exist`);
      return EXIT_USAGE;
    }
    planText = readFileSync(planFile, "utf8");
    from = resolve(planFile);
  } else if (mission) {
    // A mission's plan is its pinned prompt version, read the way its seat reads it.
    const r = miadiRun(["prompt", mission]);
    if (!r.ok) {
      console.error(`ask: miadi-run prompt ${mission} failed (exit ${r.status}): ${(r.err || r.out).split("\n").at(-1)}`);
      return EXIT_USAGE;
    }
    planText = r.out;
    from = `miadi-run prompt ${mission}`;
  } else {
    console.error("ask: give the plan to read: ask --plan <file> | --mission <miadiRun prompt>.v<N> [--for <tmux session>] [--session <id>] [--episode <folder or number>]");
    return EXIT_USAGE;
  }
  if (!planText.trim()) {
    console.error(`ask: ${from} is empty`);
    return EXIT_USAGE;
  }
  const here = tmuxSessionOfPane(env.TMUX_PANE);
  if ((env.MIADI_MIETTE_SEAT || isSeatName(here)) && !args.for && !mission) {
    console.error("ask: this is a Miette seat. Name the session the plan is for with --for, or the mission with --mission.");
    return EXIT_USAGE;
  }
  // A mission is its own key: asked from any pane, it never borrows that pane's session.
  const planningTmux = args.for ?? (mission || isSeatName(here) ? undefined : here);
  const key = safeSegment(args.session) ?? (mission ? `mission-${mission}` : undefined) ?? (args.for ? undefined : sessionOfPane(env.TMUX_PANE)) ?? `ask-${stamp()}`;
  const { seat, running, listening, planPath } = keepPlan({
    key,
    planText: `<!-- asked by hand from ${from} -->\n\n${planText}`,
    planningTmux,
    cwd: process.cwd(),
    mission,
    episode: episodeFolderOf(args.episode),
    source: `asked by hand: ${from}`
  });
  console.log(`${seatNotice(seat, running, listening)}\nplan: ${planPath}\nlog: ${join(stateDirOf(key), "open.log")}`);
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

function herdrOpen({ seat, cwd, launch, team, primerPath, log }) {
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
  // Every value is one quoted word. The seat is named in the environment for the recursion guard,
  // declared on its team, and opened to Remote Control as mct does for a tmux seat.
  const command = `MIADI_MIETTE_SEAT=${shellQuote(seat)} MIADI_TEAM=${shellQuote(team)} ${launch} -n ${shellQuote(seat)} --remote-control ${shellQuote(seat)} "$(cat ${shellQuote(primerPath)})"`;
  writeFileSync(launcher, `#!/bin/bash\ncd ${shellQuote(cwd)} || exit 1\nexec "$SHELL" -ic ${shellQuote(command)}\n`, { mode: 0o755 });
  run(herdr, ["pane", "run", pane, `bash ${shellQuote(launcher)}`], { timeout: 20_000 });
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
  if (!args.dryRun && seatRunning(seat, seatState.carrier)) {
    log(`${seat} already runs: ${plan} ${listenerAlive(sessionId) ? "wakes its listener" : "waits until /miette-listen is armed there"}`);
    return 0;
  }
  // Two plans in one moment start two openers: the first holds the lock and opens, the second leaves.
  const lock = join(stateDir, "open.lock");
  if (!args.dryRun) {
    try {
      mkdirSync(lock);
    } catch {
      let age = 0;
      try {
        age = Date.now() - statSync(lock).mtimeMs;
      } catch {
        age = 0;
      }
      if (age < 120_000) {
        log(`another opener holds ${lock}: ${plan} is left for it`);
        return 0;
      }
      rmSync(lock, { recursive: true, force: true });
      mkdirSync(lock, { recursive: true });
    }
  }
  try {
    return openSeat({ args, sessionId, stateDir, seatState, seat, plan, log });
  } finally {
    if (!args.dryRun) rmSync(lock, { recursive: true, force: true });
  }
}

function openSeat({ args, sessionId, stateDir, seatState, seat, plan, log }) {

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
    stateDir,
    fileCommand: `node ${SCRIPT} file`
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

  let opened = carrier === "herdr" ? herdrOpen({ seat, cwd, launch, team, primerPath, log }) : null;
  if (!opened) {
    const mct = findBin("mct", env.MIADI_MCT_BIN);
    if (!mct) {
      log("mct is not found: the seat cannot be opened (install @miadi/chronicle-tui)");
      return EXIT_NO_SEAT;
    }
    // The seat is named in its environment too: the hook's recursion guard reads it.
    const r = run(mct, ["new", team, seat, "--cwd", cwd, "--launch", `MIADI_MIETTE_SEAT=${seat} ${launch}`, "--remote", "--prompt-file", primerPath, "-d"], { timeout: 60_000 });
    log(`mct new ${team} ${seat}: exit ${r.status}${r.err ? ` · ${r.err.split("\n").at(-1)}` : ""}`);
    if (!r.ok) return r.status ?? 1;
    opened = { carrier: "tmux" };
  }
  // heard_plan is the plan the primer names, so a version that arrives while Miette writes her
  // first insight still wakes her when she arms the listener.
  updateJson(seatFileOf(sessionId), {
    heard_plan: plan,
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
  if (holder?.pid && holder.pid !== process.pid && pidAlive(holder.pid)) {
    console.log(`another listener already waits for ${seatState.planning_tmux ?? sessionId}: pid ${holder.pid} since ${holder.since}`);
    return EXIT_BUSY;
  }
  // Claim the file exclusively, so two listeners started together cannot both run.
  const claim = `${pidFile}.claim`;
  try {
    closeSync(openSync(claim, "wx"));
  } catch {
    console.log(`another listener is starting for ${seatState.planning_tmux ?? sessionId}`);
    return EXIT_BUSY;
  }
  try {
    writeJson(pidFile, { pid: process.pid, since: now() });
  } finally {
    rmSync(claim, { force: true });
  }
  const release = () => {
    const current = readJson(pidFile);
    if (current?.pid === process.pid) writeJson(pidFile, { pid: null, since: null, ended: now() });
  };
  // TaskStop sends SIGTERM, which skips finally: release the pid there too.
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    process.on(signal, () => {
      release();
      process.exit(0);
    });
  }

  // The plan the first insight answered is the baseline: only a later version wakes the seat.
  let heard = seatState.heard_plan ?? planVersions(stateDir).at(-1) ?? null;
  updateJson(seatFile, { heard_plan: heard });

  const interval = Math.max(1, Number(args.interval ?? 5)) * 1000;
  const deadline = listenDeadline(args.timeout);
  try {
    while (Date.now() < deadline) {
      const latest = planVersions(stateDir).at(-1) ?? null;
      if (latest && latest !== heard) {
        updateJson(seatFile, { heard_plan: latest });
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
    console.log(`miette-plan-insight: no new plan version for ${seatState.planning_tmux ?? sessionId} before the timeout`);
    return EXIT_TIMEOUT;
  } finally {
    release();
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

  // The perspective sits where @miadi/plan-insight has always looked for it: the planning
  // session's capture folder. A mission or an ask has no capture folder, so it gets one inside
  // the seat's own folder, and the capture root holds only real sessions.
  // plan-insight-register takes the record's id from this folder's name, so it carries the key.
  const sessionDir = isSessionId(sessionId) ? join(sessionDataRoot(env), sessionId) : join(stateDir, sessionId);
  const plansDir = join(sessionDir, "plans");
  mkdirSync(plansDir, { recursive: true });
  // plan-insight-register registers a perspective with the plan it answers, `session_<id>_<stamp>.md`.
  // session-observability writes it when it is loaded. When it is not, or the plan was asked
  // for by hand, the plan this insight answers is put there.
  // register reads the newest snapshot by name, so when the plan this insight answers is not the
  // newest snapshot's text, it is written as a newer one.
  const answered = seatState.heard_plan ?? seatState.last_plan;
  const snapshots = readdirSync(plansDir).filter((n) => n.startsWith(`session_${sessionId}_`) && n.endsWith(".md")).sort();
  const newest = snapshots.at(-1);
  if (answered && existsSync(answered)) {
    const answeredText = readFileSync(answered, "utf8");
    const newestText = newest ? readFileSync(join(plansDir, newest), "utf8") : null;
    if (newestText?.trim() !== answeredText.trim()) copyFileSync(answered, join(plansDir, `session_${sessionId}_${stamp()}.md`));
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
  // On a mission, the recommendation is also a research observation, which miadi-run keeps in
  // mission.json with its summary, so the Missions page shows it before the launch.
  let observed = "";
  const summary = recommendationLine(readFileSync(insight, "utf8"));
  if (seatState.mission && !args.noRegister) {
    const r = miadiRun(["observe", seatState.mission, "--kind", "research", "--summary", `Miette: ${summary}`, "--detail-file", kept]);
    observed = r.ok ? `\nobserved on ${seatState.mission} as research` : `\nmiadi-run observe on ${seatState.mission} failed (exit ${r.status}): ${(r.err || r.out).split("\n").at(-1)}`;
  }
  const fresh = readJson(seatFile, seatState);
  const insights = Array.isArray(fresh.insights) ? fresh.insights : [];
  updateJson(seatFile, { insights: [...insights, { at: now(), file: kept, plan: answered ?? null, summary }] });
  console.log(`filed: ${kept}\nbeside the plan: ${join(plansDir, "miette_perspective.md")}\n${carried}${observed}`);
  return 0;
}

// ---------- session-start ----------

/** In a seat that starts, resumes or compacts: say which plan it serves and that its listener needs arming. */
function sessionStart() {
  const seat = safeSegment(env.MIADI_MIETTE_SEAT) ?? tmuxSessionOfPane(env.TMUX_PANE);
  if (!seat || (!env.MIADI_MIETTE_SEAT && !isSeatName(seat))) return 0;
  const index = readJson(seatIndexOf(seat));
  if (!index?.planning_session) return 0;
  const key = index.planning_session;
  const seatState = readJson(seatFileOf(key), {});
  const filed = Array.isArray(seatState.insights) ? seatState.insights : [];
  const context = [
    `This session is the Miette plan insight seat ${seat}. It serves ${seatState.planning_tmux ? `tmux ${seatState.planning_tmux}` : key} (${key}).`,
    `Follow the miette-plan-insight skill. ${filed.length ? `${filed.length} insight(s) are filed; the last is ${filed.at(-1).file}.` : "No insight is filed yet."}`,
    listenerAlive(key) ? "Its listener is running." : "Its listener is not running: arm /miette-listen once the current turn is done."
  ].join("\n");
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })}\n`);
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
      `seat ${seatState.seat}${seatRunning(seatState.seat, seatState.carrier) ? " (running)" : " (not running)"} · ${seatState.carrier ?? "not opened yet"}`,
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
    case "session-start":
      return sessionStart();
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
      process.exit(["hook", "session-start"].includes(process.argv[2]) ? 0 : 1);
    }
  );
}
