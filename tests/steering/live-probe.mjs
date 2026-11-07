#!/usr/bin/env node
// A real agent, a real correction (jgwill/Miadi#942). One disposable session per run, on a private
// tmux server (socket steer942, never the host's), in a scratch folder, with a private inbox root.
// It proves what a fixture cannot: that this version of this provider presents the correction to
// its model, and that the model's next decision changes.
//
//   node tests/steering/live-probe.mjs --provider pi --case busy [--connector <@miadi/connector dist>]
//   cases: busy         a correction lands while a tool runs; six sleeping steps are the work
//          no_next_tool a correction lands while the model writes its last answer
//          idle         a correction lands on a seat that has finished its turn
//          two          two sessions run at once, and only one is corrected
//          no_adapter   the session has no adapter: the connector refuses, nothing is typed, the work goes on
//          restart      the agent dies with a correction waiting, resumes, and the correction arrives
//
// With --connector the correction goes through the connector's own steerSession, and the receipt
// holds its readSteerDelivery, so what a person would read is checked against what happened.
// With --installed the adapter comes from its own installer into a temporary home, and the agent
// starts as the factory runner starts it, so the account's own settings are never changed.
// It prints one JSON receipt. Exit 0 means the transcript or the work shows the changed decision.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SOCKET = "steer942";
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => { const [k, ...v] = a.trim().split(" "); return [k, v.join(" ") || true]; }));
const provider = args.provider;
const kase = args.case ?? "busy";
const stepSeconds = Number(args.sleep ?? 20);
const budgetMs = Number(args.budget ?? 420) * 1000;

const env = { ...process.env };
delete env.TMUX;
delete env.TMUX_PANE;
const tmux = (...a) => execFileSync("tmux", ["-L", SOCKET, "-f", "/dev/null", ...a], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const readText = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

const withoutAdapter = kase === "no_adapter";
const installed = Boolean(args.installed) && !withoutAdapter;
const homeEnv = {};
const LAUNCH = {
  pi: ({ prompt }) => (installed
    ? ["pi", "--thinking", "low", ...(args.model ? ["--model", args.model] : []), prompt]
    : ["pi", "--no-extensions", ...(withoutAdapter ? [] : ["-e", join(KIT, "pi/miadi-session-observability/extensions/steering-inbox.ts")]), "--thinking", "low", ...(args.model ? ["--model", args.model] : []), prompt]),
  claude: ({ prompt }) => (withoutAdapter
    ? ["claude", "--setting-sources", "project,local", "--dangerously-skip-permissions", "--model", args.model ?? "claude-haiku-5-5", prompt]
    : ["claude", "--plugin-dir", join(KIT, "claude/miadi-session-observability"), "--dangerously-skip-permissions", "--model", args.model ?? "claude-haiku-5-5", prompt]),
  copilot: ({ prompt }) => ["copilot", "--allow-all-tools", "--allow-all-paths", ...(args.model ? ["--model", args.model] : []), "-i", prompt],
  codex: ({ prompt }) => {
    if (installed) return ["codex", "--dangerously-bypass-approvals-and-sandbox", "-c", 'model_reasoning_effort="low"', ...(args.model ? ["-m", args.model] : []), prompt];
    const hook = (event) => `bash ${join(KIT, "codex/miadi-steering/steering_inbox.sh")} ${event}`;
    const entry = (event) => `[{hooks=[{type="command",command="${hook(event)}",timeout=10}]}]`;
    return ["codex", "--dangerously-bypass-approvals-and-sandbox", "--dangerously-bypass-hook-trust", "-c", 'model_reasoning_effort="low"',
      ...(withoutAdapter ? [] : ["-c", `hooks.SessionStart=${entry("session-start")}`, "-c", `hooks.PostToolUse=${entry("post-tool-use")}`, "-c", `hooks.UserPromptSubmit=${entry("user-prompt-submit")}`, "-c", `hooks.Stop=${entry("stop")}`]),
      ...(args.model ? ["-m", args.model] : []), prompt];
  },
};
/** Each provider's own installer, into a temporary home that borrows only the sign-in. */
function installInto(base) {
  const home = process.env.HOME;
  if (provider === "codex") {
    const dir = join(base, "codex-home");
    mkdirSync(dir, { mode: 0o700 });
    symlinkSync(join(home, ".codex/auth.json"), join(dir, "auth.json"));
    homeEnv.CODEX_HOME = dir;
    // The runner's codex queue has to look in the same home.
    process.env.CODEX_HOME = dir;
    execFileSync("node", [join(KIT, "codex/miadi-steering/install.mjs")], { env: { ...env, CODEX_HOME: dir }, stdio: "ignore", timeout: 60_000 });
  } else if (provider === "copilot") {
    const dir = join(base, "copilot-home");
    mkdirSync(dir, { mode: 0o700 });
    copyFileSync(join(home, ".copilot/config.json"), join(dir, "config.json"));
    homeEnv.COPILOT_HOME = dir;
    execFileSync("bash", [join(KIT, "copilot/miadi-steering/install.sh")], { env: { ...env, COPILOT_HOME: dir }, stdio: "ignore" });
  } else if (provider === "pi") {
    const dir = join(base, "pi-agent");
    mkdirSync(dir, { mode: 0o700 });
    symlinkSync(join(home, ".pi/agent/auth.json"), join(dir, "auth.json"));
    const own = readJson(join(home, ".pi/agent/settings.json")) ?? {};
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ defaultProvider: own.defaultProvider, defaultModel: own.defaultModel, packages: [join(KIT, "pi/miadi-session-observability")], extensions: [] }));
    homeEnv.PI_CODING_AGENT_DIR = dir;
  }
}

/** What a seat's folder must hold before its agent starts: Copilot finds a project's extension at the git root. */
function prepare(cwd) {
  if (provider !== "copilot" || withoutAdapter || installed) return;
  // This probe never changes the account's settings: --experimental would, for every later session.
  const settings = readJson(join(process.env.COPILOT_HOME || join(process.env.HOME, ".copilot"), "settings.json"));
  if (settings?.enabledFeatureFlags?.EXTENSIONS !== true && settings?.experimental !== true) throw new Error("Copilot loads no extension here: run copilot/miadi-steering/install.sh first");
  execFileSync("git", ["init", "-q"], { cwd });
  const dest = join(cwd, ".github/extensions/miadi-steering");
  mkdirSync(dest, { recursive: true });
  for (const f of ["extension.mjs", "steering_inbox.mjs", "package.json"]) writeFileSync(join(dest, f), readFileSync(join(KIT, "copilot/miadi-steering", f)));
}
if (!LAUNCH[provider]) throw new Error(`--provider must be one of ${Object.keys(LAUNCH).join(", ")}`);

const STEPS = 6;
const PIVOT = "PIVOT-942";
const workPrompt = () =>
  `Disposable steering probe for jgwill/Miadi#942. Work only in your current folder. In one turn, with no text between steps, run ${STEPS} shell commands one at a time, each its own tool call: ${[1, 2, 3, 4, 5, 6].map((n) => `sleep ${stepSeconds} && echo step-${n} >> count.txt`).join(", then ")}. A person may send you a correction while you work: if one arrives, follow it. When you are finished, say what you did in one sentence, then stop. Do not commit, push or send anything anywhere.`;
const noToolPrompt = () => `Disposable steering probe for jgwill/Miadi#942. Run one shell command: echo begun >> count.txt. Then, using no tool at all, write the integers from 1 to 400, one per line, as your answer, then stop. A person may send you a correction: if one arrives, follow it.`;
const idlePrompt = () => `Disposable steering probe for jgwill/Miadi#942. Run one shell command: echo begun >> count.txt. Then say "done" and stop. A person may send you a correction later: if one arrives, follow it.`;
const CORRECTION = `Stop counting. Do not run any more steps. Run echo ${PIVOT} >> count.txt as your next command, then finish.`;

function drop(root, sessionId, { steer = `session_steer_request:${randomUUID()}`, instruction = CORRECTION } = {}) {
  const dir = join(root, sessionId);
  const pending = join(dir, "pending");
  mkdirSync(pending, { recursive: true, mode: 0o700 });
  const now = new Date();
  const envelope = { protocol: 1, steer, grant: "run_request:live-probe", session_id: sessionId, instruction, instruction_sha256: createHash("sha256").update(instruction).digest("hex"), from: { name: "the live probe" }, queued_at: now.toISOString(), expires_at: new Date(now.getTime() + 3600_000).toISOString() };
  const safe = steer.replace(/[^\w-]/g, "-");
  const tmp = join(dir, `.tmp-${safe}`);
  writeFileSync(tmp, JSON.stringify(envelope), { mode: 0o600 });
  renameSync(tmp, join(pending, `${String(now.getTime()).padStart(15, "0")}-${safe}.json`));
  return { steer, at: now.toISOString() };
}

async function open(name, prompt, root, cwd) {
  prepare(cwd);
  const argv = LAUNCH[provider]({ prompt });
  const quoted = argv.map((a) => `'${a.replaceAll("'", `'\\''`)}'`).join(" ");
  // As the factory runner opens a seat: a shell, then the agent typed into it, so tmux sees the agent as the pane's command.
  tmux("new-session", "-d", "-s", name, "-x", "200", "-y", "50", "-c", cwd, "-e", `MIADI_STEERING_DIR=${root}`, "-e", "COPILOT_ALLOW_ALL=true", ...Object.entries(homeEnv).flatMap(([k, v]) => ["-e", `${k}=${v}`]));
  const pane = tmux("list-panes", "-t", `=${name}:`, "-F", "#{pane_id}").trim();
  // A shell's profile can take many seconds on a loaded host, and keys sent before its prompt are lost.
  const promptBy = Date.now() + 90_000;
  while (Date.now() < promptBy && !/[$#]\s*$/.test(tmux("capture-pane", "-p", "-t", pane).trimEnd())) await sleep(500);
  await sleep(500);
  tmux("send-keys", "-t", pane, "-l", quoted);
  tmux("send-keys", "-t", pane, "Enter");
  return { name, pane, cwd };
}

/** The connector's own code, with its tmux surface on this probe's private server. */
async function connectorOf(root) {
  if (!args.connector) return null;
  const [{ steerSession, tmuxAdapter }, { readSteerDelivery }] = await Promise.all([import(join(args.connector, "steer.js")), import(join(args.connector, "runtime-steer.js"))]);
  const privateTmux = tmuxAdapter((cmd, a, opts) => execFileSync(cmd, ["-L", SOCKET, "-f", "/dev/null", ...a], { ...opts, env }));
  const runtime = { root, claudeDir: join(process.env.HOME, ".claude") };
  return {
    runtime,
    readSteerDelivery,
    async steer({ session, pane, session_id, instruction, expect = PIVOT }) {
      const id = `session_steer_request:${randomUUID()}`;
      const record = { id, kind: "session_steer_request", created_at: new Date().toISOString(), refs: ["run_request:live-probe"], actor: { person_id: "probe", name: "the live probe" }, body: { instruction, session, binding: { session, pane_id: pane, ...(session_id ? { session_id } : {}), provider }, expect_next_action: expect } };
      const grantRecord = { id: "run_request:live-probe", kind: "run_request", body: { session, resolved_provider: provider, steering: { max_attempts: 5 } } };
      const started = Date.now();
      const result = await steerSession({ tmux: privateTmux, stateDir: join(root, "..", "state"), runtime, settleMs: 4000 }, { record, grantRecord, priorAttempts: 0, binding: record.body.binding });
      return { result, answered_in_ms: Date.now() - started, record: { ...record, state: result.forwarded ? "in_progress" : "completed", completion_receipt: { decided_at: new Date().toISOString(), decision: "covered_by_grant", steer_status: result.status, typed: result.typed, ...(result.forwarded ? { forwarded: true } : {}), ...(result.route ? { route: result.route } : {}), ...(result.runtime_session_id ? { runtime_session_id: result.runtime_session_id } : {}), ...(result.transcript_offset !== undefined ? { transcript_offset: result.transcript_offset } : {}), ...(result.target ? { target: result.target } : {}), message: result.message } } };
    },
  };
}

/** Only the states and their times: what a person would read. */
const readable = (delivery) => delivery && { state: delivery.state, provider: delivery.provider, continuation: delivery.continuation, behavior: delivery.behavior, note: delivery.note, receipts: delivery.receipts.map((r) => [r.state, r.at, r.source].join(" ")), next_actions: delivery.next_actions?.slice(0, 2) };

async function adapterFor(root, seat, ms = 120_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const id of existsSync(root) ? readdirSync(root) : []) {
      const a = readJson(join(root, id, "adapter.json"));
      if (a?.pane === seat.pane) return { session_id: id, adapter: a };
    }
    // A trust prompt on a new folder: the probe's scratch folder is the probe's own.
    const screen = tmux("capture-pane", "-p", "-t", seat.pane);
    if (/Do you trust|Yes, I trust|trust this folder|Yes, proceed/i.test(screen)) tmux("send-keys", "-t", seat.pane, "Enter");
    await sleep(1500);
  }
  return null;
}

const lines = (p) => readText(p).split("\n").filter(Boolean);
const receiptsOf = (root, id) => lines(join(root, id, "receipts.jsonl")).map((l) => JSON.parse(l));

async function untilSettled(check, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = check();
    if (v) return v;
    await sleep(1000);
  }
  return null;
}

async function main() {
  const base = mkdtempSync(join(tmpdir(), `steer-probe-${provider}-`));
  const root = join(base, "steering");
  mkdirSync(root, { mode: 0o700 });
  if (installed) installInto(base);
  const work = (n) => { const d = join(base, n); mkdirSync(d); return d; };
  const stamp = Date.now().toString(36);
  const out = { provider, case: kase, version: spawnSync(provider, ["--version"], { encoding: "utf8" }).stdout.trim().split("\n")[0], base, started_at: new Date().toISOString() };
  const seats = [];
  try {
    if (kase === "two") {
      const a = await open(`${provider}-a-${stamp}`, workPrompt(), root, work("a"));
      const b = await open(`${provider}-b-${stamp}`, workPrompt(), root, work("b"));
      seats.push(a, b);
      const [ba, bb] = [await adapterFor(root, a), await adapterFor(root, b)];
      if (!ba || !bb) throw new Error("an adapter never announced itself");
      out.adapter = ba.adapter;
      await untilSettled(() => lines(join(a.cwd, "count.txt")).length >= 1, 240_000);
      await sleep(2000);
      const connector = await connectorOf(root);
      let sentTwo;
      if (connector) {
        sentTwo = await connector.steer({ session: a.name, pane: a.pane, ...(provider === "claude" ? { session_id: ba.session_id } : {}), instruction: CORRECTION });
        out.answer = { status: sentTwo.result.status, route: sentTwo.result.route, runtime_session_id: sentTwo.result.runtime_session_id, typed: sentTwo.result.typed, ms: sentTwo.answered_in_ms };
      } else {
        out.steer = drop(root, ba.session_id);
      }
      out.tool_running_at_drop = lines(join(a.cwd, "count.txt"));
      const pivot = await untilSettled(() => lines(join(a.cwd, "count.txt")).includes(PIVOT), budgetMs);
      await untilSettled(() => lines(join(b.cwd, "count.txt")).length >= STEPS, budgetMs);
      out.corrected = lines(join(a.cwd, "count.txt"));
      out.untouched = lines(join(b.cwd, "count.txt"));
      out.receipts = receiptsOf(root, ba.session_id);
      out.other_receipts = receiptsOf(root, bb.session_id);
      out.session_ids = [ba.session_id, bb.session_id];
      out.pass = Boolean(pivot) && out.corrected.includes(PIVOT) && !out.untouched.includes(PIVOT) && !readText(bb.adapter.transcript_path ?? "/nonexistent").includes(PIVOT);
      if (connector) {
        await sleep(Number(args.after ?? 15) * 1000);
        const delivery = connector.readSteerDelivery(connector.runtime, sentTwo.record);
        out.delivery = readable(delivery);
        out.reached_the_bound_session = sentTwo.result.runtime_session_id === ba.session_id || provider === "claude";
        out.pass = out.pass && delivery?.state === "behavior_adjusted" && out.reached_the_bound_session;
      }
    } else {
      const seat = await open(`${provider}-${kase}-${stamp}`, ["busy", "no_adapter", "restart"].includes(kase) ? workPrompt() : kase === "idle" ? idlePrompt() : noToolPrompt(), root, work("w"));
      seats.push(seat);
      const connector = await connectorOf(root);
      if (kase === "no_adapter") {
        const count = join(seat.cwd, "count.txt");
        await untilSettled(() => lines(count).length >= 1, 240_000);
        const screenBefore = tmux("capture-pane", "-p", "-t", seat.pane);
        // Claude Code's own registry names the session, as the runner's receipt would.
        const claudeRecord = provider === "claude" ? readdirSync(join(process.env.HOME, ".claude/sessions")).map((n) => readJson(join(process.env.HOME, ".claude/sessions", n))).find((r) => r?.tmux?.startsWith(`${seat.name}:`)) : null;
        const sent = await connector.steer({ session: seat.name, pane: seat.pane, ...(claudeRecord ? { session_id: claudeRecord.sessionId } : {}), instruction: CORRECTION });
        out.answer = { status: sent.result.status, typed: sent.result.typed, forwarded: sent.result.forwarded ?? false, message: sent.result.message, ms: sent.answered_in_ms };
        await sleep(3000);
        out.typed_into_pane = tmux("capture-pane", "-p", "-t", seat.pane).includes("Stop counting") && !screenBefore.includes("Stop counting");
        await untilSettled(() => lines(count).length >= STEPS, budgetMs);
        out.count = lines(count);
        out.delivery = readable(connector.readSteerDelivery(connector.runtime, sent.record));
        out.pass = sent.result.status === "unsupported" && !sent.result.typed && !out.typed_into_pane && !out.count.includes(PIVOT) && out.count.length >= STEPS;
        return;
      }
      const bound = await adapterFor(root, seat);
      if (!bound) throw new Error("the adapter never announced itself");
      out.session_id = bound.session_id;
      out.adapter = bound.adapter;
      const count = join(seat.cwd, "count.txt");
      await untilSettled(() => lines(count).length >= 1, 240_000);
      if (kase === "busy") await sleep(2000);
      if (kase === "no_next_tool") await sleep(1500);
      if (kase === "idle") await sleep(Number(args.idle_wait ?? 25) * 1000);
      out.before_drop = lines(count);
      const instruction = ["busy", "restart"].includes(kase) ? CORRECTION : `Run echo ${PIVOT} >> count.txt as your next command, then finish.`;
      let sent;
      // Pi and Copilot take a correction within a second, so it can only be waiting if the agent died first. The connector would refuse a dead session, so the file is dropped as one left over from before the crash.
      const diesFirst = kase === "restart" && (provider === "pi" || provider === "copilot");
      if (diesFirst) {
        out.killed_pid = bound.adapter.pid;
        process.kill(bound.adapter.pid, "SIGKILL");
        await sleep(3000);
        out.steer = drop(root, bound.session_id, { instruction });
      } else if (connector) {
        // By pane alone where a provider's receipt can name nothing else; Claude Code's registry needs its id.
        sent = await connector.steer({ session: seat.name, pane: seat.pane, ...(provider === "claude" ? { session_id: bound.session_id } : {}), instruction });
        out.answer = { status: sent.result.status, route: sent.result.route, typed: sent.result.typed, forwarded: sent.result.forwarded ?? false, ms: sent.answered_in_ms };
        out.delivery_at_once = readable(connector.readSteerDelivery(connector.runtime, sent.record));
      } else {
        out.steer = drop(root, bound.session_id, { instruction });
      }
      if (kase === "restart") {
        // The agent dies with the correction waiting, and comes back as itself.
        const pid = diesFirst ? bound.adapter.pid : provider === "claude" ? JSON.parse(readdirSync(join(process.env.HOME, ".claude/sessions")).map((n) => readText(join(process.env.HOME, ".claude/sessions", n))).find((t) => t.includes(bound.session_id)) ?? "{}").pid : bound.adapter.pid;
        out.killed_pid = pid;
        if (!diesFirst) process.kill(pid, "SIGKILL");
        await sleep(3000);
        out.pending_while_dead = readdirSync(join(root, bound.session_id, "pending")).length;
        const resume = { claude: ["claude", "--plugin-dir", join(KIT, "claude/miadi-session-observability"), "--dangerously-skip-permissions", "--model", args.model ?? "claude-haiku-5-5", "--resume", bound.session_id, "Continue."], codex: LAUNCH.codex({ prompt: "Continue." }).toSpliced(1, 0, "resume", bound.session_id), pi: LAUNCH.pi({ prompt: "Continue." }).toSpliced(1, 0, "--session", bound.session_id), copilot: LAUNCH.copilot({ prompt: "Continue." }).toSpliced(1, 0, "--session-id", bound.session_id) }[provider];
        tmux("send-keys", "-t", seat.pane, "-l", resume.map((a) => `'${a.replaceAll("'", `'\\''`)}'`).join(" "));
        tmux("send-keys", "-t", seat.pane, "Enter");
      }
      // The factory runner's own pass, for a provider whose idle seat needs one.
      if (kase === "idle" && args.runner) {
        const { wakeIdleSteers } = await import(join(args.runner, "src/steering.js"));
        const logs = [];
        await sleep(2000);
        out.runner_pass = await wakeIdleSteers({ cfg: { factoryDir: base, claudeDir: join(process.env.HOME, ".claude"), paneGuard: null }, root, log: (l) => logs.push(l), t: { type: (p, text) => tmux("send-keys", "-t", p, "-l", text), enter: (p) => tmux("send-keys", "-t", p, "Enter") } });
        out.runner_log = logs;
      }
      const pivot = await untilSettled(() => lines(count).includes(PIVOT), budgetMs);
      out.pivot_at = pivot ? new Date().toISOString() : null;
      await sleep(Number(args.after ?? 15) * 1000);
      out.count = lines(count);
      out.receipts = receiptsOf(root, bound.session_id);
      out.inbox = Object.fromEntries(["pending", "claimed", "expired", "withdrawn", "rejected"].map((d) => [d, existsSync(join(root, bound.session_id, d)) ? readdirSync(join(root, bound.session_id, d)).length : 0]));
      out.transcript_path = bound.adapter.transcript_path;
      // The next decision changed: the pivot ran, and no step began after the one already under way when the correction landed.
      const steps = out.count.filter((l) => /^step-/.test(l)).length;
      out.steps_after_correction = steps - out.before_drop.filter((l) => /^step-/.test(l)).length;
      out.pass = Boolean(pivot) && (kase !== "busy" || (steps < STEPS && out.steps_after_correction <= 1));
      if (connector && sent) {
        const delivery = connector.readSteerDelivery(connector.runtime, sent.record);
        out.delivery = readable(delivery);
        // What a person would read must say what happened: the model's record, and the action the correction named.
        out.delivery_matches = delivery?.state === "behavior_adjusted" || (sent.result.route === "tmux_exact_pane" && delivery?.state === "delivered_to_agent_context");
        out.pass = out.pass && out.delivery_matches;
      }
    }
    out.screens = Object.fromEntries(seats.map((s) => [s.name, tmux("capture-pane", "-p", "-t", s.pane).split("\n").filter((l) => l.trim()).slice(-12)]));
  } catch (error) {
    out.error = error.message;
    out.pass = false;
    out.screens = Object.fromEntries(seats.map((s) => { try { return [s.name, tmux("capture-pane", "-p", "-t", s.pane).split("\n").filter((l) => l.trim()).slice(-25)]; } catch { return [s.name, []]; } }));
  } finally {
    if (!args.keep) for (const s of seats) { try { tmux("kill-session", "-t", `=${s.name}:`); } catch {} }
    // The borrowed sign-in does not outlive the run.
    if (homeEnv.COPILOT_HOME) rmSync(join(homeEnv.COPILOT_HOME, "config.json"), { force: true });
    out.ended_at = new Date().toISOString();
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.pass ? 0 : 1);
  }
}
main();
