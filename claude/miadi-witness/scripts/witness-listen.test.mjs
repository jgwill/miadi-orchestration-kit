// node --test claude/miadi-witness/scripts/witness-listen.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ownSessionId, parseInputBlocks } from "./witness-listen.mjs";

const SCRIPT = fileURLToPath(new URL("./witness-listen.mjs", import.meta.url));
const SEAT_DIR = "/fixture/seat";
const ORIGINAL = "aaaaaaaa-0000-4000-8000-000000000001";
const FORK = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER = "cccccccc-0000-4000-8000-000000000003";

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "witness-listen-"));
  const fx = {
    base,
    sessions: join(base, "sessions"),
    sessiondata: join(base, "sessiondata"),
    bindings: join(base, "sessiondata", "data", "terminal_bindings.jsonl"),
    scratchpads: join(base, "scratchpads"),
    state: join(base, "state"),
    asks: join(base, "asks"),
    projects: join(base, "projects"),
  };
  for (const dir of [fx.sessions, join(fx.sessiondata, "data"), fx.scratchpads, fx.asks, fx.projects]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(base, "teams.json"), JSON.stringify({ teams: [{ id: "T3", name: "Witness", folders: [SEAT_DIR], name_patterns: ["^mino-"] }] }));
  writeFileSync(join(base, "seats.json"), JSON.stringify({ seats: [{ id: "mino", folder: SEAT_DIR, name_patterns: ["^mino-"] }] }));
  writeFileSync(join(fx.asks, "mino.json"), JSON.stringify({ version: 1, seat: "mino", asks: [
    { id: "ask-1", title: "A service on our own ports", status: "partial", words: [], evidence: [], history: [] },
    { id: "ask-2", title: "Something finished", status: "done", words: [], evidence: [], history: [] },
  ] }));
  writeFileSync(join(fx.scratchpads, "SCRATCHPAD-260929.md"), "# notes\n<input tmux_session_original_name=\"mino-old\">\nan old block\n</input>\n");
  writeFileSync(fx.bindings, "");
  bind(fx, ORIGINAL, { source: "startup", name: "mino-260926", cwd: SEAT_DIR });
  bind(fx, OTHER, { source: "startup", name: "elsewhere", cwd: "/fixture/other" });
  registry(fx, ORIGINAL, "busy", "mino-260926");
  return fx;
}

function bind(fx, id, { event = "session.start", source, name, cwd, argv = ["claude"] }) {
  appendFileSync(fx.bindings, `${JSON.stringify({ at: new Date().toISOString(), event, source, agent: "claude", session_id: id, cwd, argv, name: { name, former: [] }, tmux: { session: name, pane_id: "%1" } })}\n`);
}

// pid is this test process, which is alive, so the thread counts as running
function registry(fx, id, status, name) {
  // the registry names files <pid>.json; the number here only has to be unique per thread
  writeFileSync(join(fx.sessions, `${parseInt(id.slice(0, 4), 16)}.json`), JSON.stringify({
    pid: process.pid, sessionId: id, cwd: SEAT_DIR, name, status, statusUpdatedAt: Date.now(), updatedAt: Date.now(), tmux: `${name}:@1.%1`,
  }));
}

function env(fx) {
  return {
    ...process.env,
    WITNESS_CLAUDE_SESSIONS_DIR: fx.sessions,
    WITNESS_BINDINGS: fx.bindings,
    MIADI_SESSIONDATA_ROOT: fx.sessiondata,
    WITNESS_TEAMS_JSON: join(fx.base, "teams.json"),
    WITNESS_SEATS_JSON: join(fx.base, "seats.json"),
    WITNESS_CLAUDE_PROJECTS_DIR: fx.projects,
    WITNESS_SCRATCHPADS_DIR: fx.scratchpads,
    WITNESS_STATE_DIR: fx.state,
    WITNESS_ASKS_DIR: fx.asks,
    WITNESS_SETTLE_MS: "0",
  };
}

function run(fx, args) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args, "--self", "none"], { encoding: "utf8", env: env(fx), stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

const quiet = ["await", "--timeout", "1", "--interval", "1"];

test("the first status takes a baseline, so what was already there never wakes the seat", () => {
  const fx = fixture();
  const status = run(fx, ["status"]);
  assert.equal(status.code, 0);
  assert.match(status.stdout, /new baseline taken now/);
  assert.match(status.stdout, /1 input blocks · 1 threads/);
  const wait = run(fx, quiet);
  assert.equal(wait.code, 4);
  assert.match(wait.stdout, /no event in 1s/);
});

test("a new closed input block wakes the seat with its exact text; an unclosed one waits", () => {
  const fx = fixture();
  run(fx, ["status"]);
  const pad = join(fx.scratchpads, "SCRATCHPAD-260929.md");
  appendFileSync(pad, "<input tmux_session_original_name=\"mino-260929-fork-04\" fork_of_session=\"mino-x\">\n* Please witness 'kafka'.\n</input>\n<input>\nhalf typed");
  const wake = run(fx, quiet);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /^WITNESS WAKE · seat mino · 1 event/);
  assert.match(wake.stdout, /NEW INPUT FROM WILLIAM · SCRATCHPAD-260929\.md line 5 · addressed to mino-260929-fork-04/);
  assert.ok(wake.stdout.includes("<input tmux_session_original_name=\"mino-260929-fork-04\" fork_of_session=\"mino-x\">\n* Please witness 'kafka'.\n</input>"));
  assert.match(run(fx, ["status"]).stdout, /still open: 1 <input> block\(s\) without <\/input>/);
  assert.equal(run(fx, quiet).code, 4, "the same block never wakes twice");
});

test("editing a block below its first line does not wake the seat again", () => {
  const fx = fixture();
  run(fx, ["status"]);
  const pad = join(fx.scratchpads, "SCRATCHPAD-260929.md");
  writeFileSync(pad, readFileSync(pad, "utf8").replace("an old block\n", "an old block\nwith a line added later\n"));
  assert.equal(run(fx, quiet).code, 4);
});

test("a new thread of the seat wakes it with its parent; a thread elsewhere does not", () => {
  const fx = fixture();
  run(fx, ["status"]);
  bind(fx, OTHER.replace("cccc", "dddd"), { source: "startup", name: "not-ours", cwd: "/fixture/other" });
  bind(fx, FORK, { source: "fork", name: "mino-260926", cwd: SEAT_DIR, argv: ["claude", "--resume", ORIGINAL, "--fork-session"] });
  bind(fx, FORK, { event: "session.rename", source: "", name: "mino-260929-fork-06-topic", cwd: SEAT_DIR });
  const wake = run(fx, quiet);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /1 event/);
  assert.match(wake.stdout, /NEW THREAD · mino-260929-fork-06-topic \(bbbbbbbb/);
  assert.match(wake.stdout, /fork of mino-260926 \(recorded: fork line, --resume <session id>\)/);
  assert.doesNotMatch(wake.stdout, /not-ours/);
});

test("--only-watched wakes for the watched session and its forks, not for the rest of the seat", () => {
  const fx = fixture();
  registry(fx, OTHER, "busy", "elsewhere");
  const only = ["await", "--timeout", "1", "--interval", "1", "--watch", OTHER, "--only-watched"];
  run(fx, ["status"]);
  assert.equal(run(fx, only).code, 4, "a session named with --watch is not news to the seat that named it");
  bind(fx, FORK, { source: "fork", name: "mino-260926", cwd: SEAT_DIR, argv: ["claude", "--resume", ORIGINAL, "--fork-session"] });
  registry(fx, ORIGINAL, "idle", "mino-260926");
  assert.equal(run(fx, only).code, 4, "a fork of an unwatched seat thread and its going idle stay quiet");
  const OTHER_FORK = "eeeeeeee-0000-4000-8000-000000000005";
  bind(fx, OTHER_FORK, { source: "fork", name: "elsewhere-fork1", cwd: "/fixture/other", argv: ["claude", "--resume", OTHER, "--fork-session"] });
  registry(fx, OTHER, "idle", "elsewhere");
  const wake = run(fx, only);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /NEW THREAD · elsewhere-fork1 \(eeeeeeee/);
  assert.match(wake.stdout, /THREAD WENT IDLE · elsewhere \(cccccccc/);
  assert.match(wake.stdout, /--watch "cccccccc-0000-4000-8000-000000000003" --only-watched/);
  assert.equal(run(fx, quiet).code, 4, "a later listener without the flag has no backlog of seat threads");
});

test("--only-watched wakes for input blocks addressed to the watched session, not to others", () => {
  const fx = fixture();
  registry(fx, OTHER, "busy", "elsewhere");
  const only = ["await", "--timeout", "1", "--interval", "1", "--watch", OTHER, "--only-watched"];
  run(fx, ["status"]);
  appendFileSync(join(fx.scratchpads, "SCRATCHPAD-260929.md"), "<input tmux_session_original_name=\"someone-else\">\nnot for the watched session\n</input>\n");
  assert.equal(run(fx, only).code, 4, "a block addressed to an unwatched session stays quiet");
  appendFileSync(join(fx.scratchpads, "SCRATCHPAD-260929.md"), "<input tmux_session_original_name=\"elsewhere\">\nfor the watched session\n</input>\n");
  const wake = run(fx, only);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /for the watched session/);
  assert.doesNotMatch(wake.stdout, /not for the watched session/);
  assert.equal(run(fx, quiet).code, 4, "a later listener without the flag has no backlog of input blocks");
});

test("a thread that goes from busy to idle wakes the seat with its last message; idle to idle does not", () => {
  const fx = fixture();
  run(fx, ["status"]);
  registry(fx, ORIGINAL, "idle", "mino-260926");
  mkdirSync(join(fx.sessiondata, ORIGINAL), { recursive: true });
  writeFileSync(join(fx.sessiondata, ORIGINAL, "last_claude_AssistantResponse.json"), JSON.stringify({ last_assistant_message: "Step 6 passed; the page is published." }));
  const wake = run(fx, quiet);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /THREAD WENT IDLE · mino-260926 \(aaaaaaaa.*busy → idle/);
  assert.match(wake.stdout, /its last message: "Step 6 passed; the page is published\."/);
  assert.equal(run(fx, quiet).code, 4);
});

test("Jev's reading of an idle event is off by default; --classify-dry adds its line and keeps the flag on re-arm", () => {
  const fx = fixture();
  run(fx, ["status"]);
  registry(fx, ORIGINAL, "idle", "mino-260926");
  mkdirSync(join(fx.sessiondata, ORIGINAL), { recursive: true });
  writeFileSync(join(fx.sessiondata, ORIGINAL, "last_claude_AssistantResponse.json"), JSON.stringify({ last_assistant_message: "DONE K6 · tests pass" }));
  assert.doesNotMatch(run(fx, ["peek"]).stdout, /Jev \(J7/);
  const wake = run(fx, [...quiet, "--classify-dry"]);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /its last message: "DONE K6 · tests pass"\n {3}Jev \(J7, dry\): nothing sent · ~\d+ tokens estimated, ~\d+ paid expected · DONE line present/);
  assert.match(wake.stdout, /Re-arm in the background: node ".*witness-listen\.mjs" await --seat mino --classify-dry/);
});

test("a thread whose turn ends with a background command running (status shell) wakes the seat too", () => {
  const fx = fixture();
  run(fx, ["status"]);
  registry(fx, ORIGINAL, "shell", "mino-260926");
  const wake = run(fx, quiet);
  assert.equal(wake.code, 0);
  assert.match(wake.stdout, /THREAD WENT IDLE · mino-260926 \(aaaaaaaa.*busy → shell/);
  assert.equal(run(fx, quiet).code, 4, "shell to shell does not wake again");
});

test("the wake carries the open asks and a turn budget, and re-arms with the same arguments", () => {
  const fx = fixture();
  run(fx, ["status"]);
  registry(fx, ORIGINAL, "idle", "mino-260926");
  const wake = run(fx, [...quiet, "--watch", "elsewhere"]);
  assert.match(wake.stdout, /Open asks \(1, ledger .*mino\.json\):\n  ask-1 partial · A service on our own ports/);
  assert.doesNotMatch(wake.stdout, /ask-2/);
  assert.match(wake.stdout, /Turn budget \(miadi-witness\)/);
  assert.match(wake.stdout, /witness-editor agent once/);
  assert.match(wake.stdout, /5\. Re-arm in the background: node ".*witness-listen\.mjs" await --seat mino --watch "elsewhere"/);
  assert.match(run(fx, ["peek"]).stdout, /nothing waiting/);
});

test("await wakes on an event that arrives while it waits", async () => {
  const fx = fixture();
  run(fx, ["status"]);
  const child = spawn("node", [SCRIPT, "await", "--interval", "1", "--timeout", "20", "--self", "none"], { env: env(fx) });
  let stdout = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  await new Promise((done) => setTimeout(done, 1500));
  assert.match(run(fx, ["status"]).stdout, /listening now: yes/);
  const second = run(fx, quiet);
  assert.equal(second.code, 5, "a second listener for the same seat is refused");
  assert.match(second.stdout, /already has a listener/);
  appendFileSync(join(fx.scratchpads, "SCRATCHPAD-260929.md"), "<input>\nlate\n</input>\n");
  const code = await new Promise((done) => child.on("exit", done));
  assert.equal(code, 0);
  assert.match(stdout, /NEW INPUT FROM WILLIAM/);
  assert.match(run(fx, ["status"]).stdout, /listening now: no/);
});

test("an <input> quoted inside a sentence is a mention, not a block", () => {
  const text = "see the part `<input tmux_session_original_name=\"x\">` above\n<input to=\"y\">\nreal\n</input>\n";
  const { blocks, unclosed } = parseInputBlocks(text, "S.md");
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].attrs, { to: "y" });
  assert.equal(unclosed, 0);
});

test("an unclosed block does not swallow the closed block below it", () => {
  const text = "<input>\nfirst, never closed\n\n<input>\nsecond, never closed\n\n<input tmux=\"t-261001\">\nthird\n</input>\n";
  const { blocks, unclosed } = parseInputBlocks(text, "S.md");
  assert.equal(unclosed, 2);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].attrs, { tmux: "t-261001" });
  assert.equal(blocks[0].line, 7);
  assert.match(blocks[0].text, /^<input tmux="t-261001">\nthird\n<\/input>$/);
});

test("helpers: block attributes with straight or curly quotes, and this process's own session", () => {
  const { blocks } = parseInputBlocks("<input type=ava goal=“ a goal “>\nx\n</input>", "S.md");
  assert.deepEqual(blocks[0].attrs, { type: "ava", goal: " a goal " });
  const threads = { [ORIGINAL]: { session_id: ORIGINAL, live: true, pid: process.pid } };
  assert.equal(ownSessionId(threads), ORIGINAL);
  assert.equal(ownSessionId({}), null);
});
