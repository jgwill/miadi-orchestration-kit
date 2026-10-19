// node --test claude/miadi-witness/scripts/inventory.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./inventory.mjs", import.meta.url));
const SEAT = "/fixture/seat";
const NEW = "aaaaaaaa-0000-4000-8000-000000000001";
const KEPT = "bbbbbbbb-0000-4000-8000-000000000002";
const OLD = "cccccccc-0000-4000-8000-000000000003";
const TRAP = "dddddddd-0000-4000-8000-000000000004";

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "witness-inventory-"));
  const fx = {
    base,
    bindings: join(base, "sessiondata", "data", "terminal_bindings.jsonl"),
    sessiondata: join(base, "sessiondata"),
    inventory: join(base, "inventory"),
    projects: join(base, "projects"),
  };
  mkdirSync(join(fx.sessiondata, "data"), { recursive: true });
  mkdirSync(fx.inventory);
  const seatTranscripts = join(fx.projects, SEAT.replace(/[^A-Za-z0-9]/g, "-"));
  mkdirSync(seatTranscripts, { recursive: true });
  writeFileSync(join(base, "seats.json"), JSON.stringify({ seats: [{ id: "mino", folder: SEAT }] }));
  writeFileSync(fx.bindings, "");
  bind(fx, NEW, { name: "new-one", tmux: "tmux-new" });
  bind(fx, KEPT, { name: "kept-one", tmux: "tmux-kept" });
  mkdirSync(join(fx.sessiondata, NEW));
  writeFileSync(join(fx.sessiondata, NEW, "_claude_user_inputs.jsonl"), `${JSON.stringify({ prompt: "please build the loop" })}\n`);
  writeFileSync(join(fx.sessiondata, NEW, "_claude_PreToolUse.jsonl"), "{}\n{}\n");
  writeFileSync(join(fx.inventory, `ONGOING-tmux-kept.json`), JSON.stringify({
    version: "1.0.0", session_id: KEPT, tmux_session_name: "tmux-kept", status: "in_progress",
    mission: "an agent wrote this", work_completed: [{ title: "kept" }], observations: [{ at: "x", by: "witness", what: "seen" }],
  }));
  writeFileSync(join(fx.inventory, "ONGOING-no-id.json"), JSON.stringify({ tmux_session_name: "tmux-lost", session_id: "[PENDING]" }));
  // the seat read two panes before binding lines existed: "old-name" and, separately, a
  // longer name that starts with it
  const lines = [
    { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", input: { command: "tmux send-keys -t 'old-name' '/exit' Enter; tmux capture-pane -t 'old-name' -p" } }] } },
    { type: "user", timestamp: "2026-09-27T08:50:18Z", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: `Resume this session with: claude --resume ${OLD}` }] } },
    { type: "assistant", message: { content: [{ type: "tool_use", id: "t2", input: { command: "tmux capture-pane -t 'old-name-cont' -p" } }] } },
    { type: "user", timestamp: "2026-09-27T09:00:00Z", message: { content: [{ type: "tool_result", tool_use_id: "t2", content: `claude --resume ${TRAP}` }] } },
  ];
  writeFileSync(join(seatTranscripts, "seat.jsonl"), `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
  return fx;
}

function bind(fx, id, { name, tmux, event = "session.start", source = "startup", argv = ["claude"] }) {
  appendFileSync(fx.bindings, `${JSON.stringify({
    at: "2026-09-29T10:00:00.000Z", event, source, agent: "claude", session_id: id, cwd: "/fixture/not-a-repo", argv,
    name: { name, former: [] }, tmux: { session: tmux, pane_id: "%9" }, team: { id: "T3", source: "folder" }, launch_alias: "claudeyolo",
  })}\n`);
}

function run(fx, args) {
  const env = {
    ...process.env,
    WITNESS_BINDINGS: fx.bindings,
    MIADI_SESSIONDATA_ROOT: fx.sessiondata,
    WITNESS_INVENTORY_DIR: fx.inventory,
    WITNESS_CLAUDE_PROJECTS_DIR: fx.projects,
    WITNESS_SEATS_JSON: join(fx.base, "seats.json"),
  };
  try {
    return { code: 0, stdout: execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (error) {
    return { code: error.status, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

const read = (fx, file) => JSON.parse(readFileSync(join(fx.inventory, file), "utf8"));

test("plan is a dry run: it lists what it would write and writes nothing", () => {
  const fx = fixture();
  const before = readdirSync(fx.inventory).sort();
  const plan = run(fx, ["plan"]);
  assert.equal(plan.code, 0);
  assert.match(plan.stdout, /plan \(dry run, nothing written\)/);
  assert.match(plan.stdout, new RegExp(`create    ${NEW}\\.json · new record`));
  assert.match(plan.stdout, /update    ONGOING-tmux-kept\.json · claude_session_name filled, cwd filled, team filled, binding added, hook_capture added/);
  assert.match(plan.stdout, /ONGOING-no-id\.json: session_id is "\[PENDING\]", not a session id/);
  assert.deepEqual(readdirSync(fx.inventory).sort(), before);
});

test("write creates a record keyed by session id from the binding line and the hook capture", () => {
  const fx = fixture();
  assert.equal(run(fx, ["write"]).code, 2, "write needs --session or --all");
  run(fx, ["write", "--session", NEW]);
  const record = read(fx, `${NEW}.json`);
  assert.equal(record.session_id, NEW);
  assert.equal(record.tmux_session_name, "tmux-new");
  assert.equal(record.status, "in_progress");
  assert.equal(record.binding.launch_alias, "claudeyolo");
  assert.deepEqual([record.hook_capture.user_inputs, record.hook_capture.tool_uses], [1, 2]);
  assert.equal(record.hook_capture.last_input, "please build the loop");
  assert.equal(existsSync(join(fx.inventory, "ONGOING-tmux-kept.json")) && read(fx, "ONGOING-tmux-kept.json").binding, undefined, "only the named session is written");
  assert.match(run(fx, ["plan", "--session", NEW]).stdout, /unchanged /);
});

test("an update adds facts in place and never touches what an agent wrote", () => {
  const fx = fixture();
  run(fx, ["write", "--session", KEPT]);
  const record = read(fx, "ONGOING-tmux-kept.json");
  assert.equal(record.mission, "an agent wrote this");
  assert.deepEqual(record.work_completed, [{ title: "kept" }]);
  assert.equal(record.status, "in_progress");
  assert.equal(record.binding.tmux.session, "tmux-kept");
  assert.equal(record.observations.length, 2);
  assert.match(record.observations[1].what, /Facts updated/);
  assert.equal(existsSync(join(fx.inventory, `${KEPT}.json`)), false, "no second file for the same session");
});

test("verify-names: a headless -p child bound in the same pane is not the pane's session", () => {
  const fx = fixture();
  const CHILD = "eeeeeeee-0000-4000-8000-000000000005";
  bind(fx, CHILD, { name: "scratchpad-57", tmux: "tmux-new", argv: ["claude", "-p", "--plugin-dir", "x"] });
  bind(fx, CHILD, { name: "scratchpad-57", tmux: "tmux-new", event: "session.end", argv: ["claude", "-p", "--plugin-dir", "x"] });
  const [bound] = JSON.parse(run(fx, ["verify-names", "tmux-new", "--json"]).stdout);
  assert.deepEqual([bound.verified, bound.session_id], [true, NEW]);
});

test("verify-names: a binding line, an exact pane reading, or unverified", () => {
  const fx = fixture();
  const out = run(fx, ["verify-names", "tmux-new", "old-name", "never-seen", "--json"]);
  const [bound, read_, unknown] = JSON.parse(out.stdout);
  assert.equal(out.code, 1, "one unverified name makes the exit 1");
  assert.deepEqual([bound.verified, bound.session_id], [true, NEW]);
  assert.match(bound.basis, /binding line/);
  assert.deepEqual([read_.verified, read_.session_id], [true, OLD], "the reading of old-name-cont is not a reading of old-name");
  assert.match(read_.basis, /pane reading at 2026-09-27T08:50:18Z/);
  assert.equal(unknown.verified, false);
  assert.equal(unknown.session_id, undefined);
});

// ---------- the five links (P2, 2026-10-05) ----------

test("a new record carries the five links, and the question is filled from the first input", () => {
  const fx = fixture();
  run(fx, ["write", "--session", NEW]);
  const record = read(fx, `${NEW}.json`);
  assert.deepEqual(Object.keys(record.links), ["question", "trace", "evidence", "criteria", "judgment"]);
  assert.equal(record.links.question.length, 1);
  assert.equal(record.links.question[0].note, "please build the loop");
  assert.match(record.links.question[0].ref, /^file:.*_claude_user_inputs\.jsonl#1$/);
  assert.deepEqual(record.links.criteria, [], "an empty link stays, empty");
});

test("link adds a reference once; an unknown kind is refused", () => {
  const fx = fixture();
  run(fx, ["write", "--session", NEW]);
  assert.match(run(fx, ["link", "--session", NEW, "--kind", "trace", "--ref", "acme/tools@abcdef1"]).stdout, /linked .* trace link: acme\/tools@abcdef1/);
  assert.match(run(fx, ["link", "--session", NEW, "--kind", "trace", "--ref", "acme/tools@abcdef1"]).stdout, /already holds/);
  assert.equal(run(fx, ["link", "--session", NEW, "--kind", "vibes", "--ref", "x"]).code, 2);
  run(fx, ["link", "--session", NEW, "--kind", "derived_from", "--ref", KEPT]);
  const record = read(fx, `${NEW}.json`);
  assert.equal(record.links.trace.length, 1);
  assert.equal(record.derived_from, KEPT);
});

test("links --check verifies a commit only in a tree whose origin names the repository", () => {
  const fx = fixture();
  const repos = join(fx.base, "repos");
  const tree = join(repos, "acme", "tools");
  mkdirSync(tree, { recursive: true });
  const git = (...a) => execFileSync("git", ["-C", tree, ...a], { encoding: "utf8" }).trim();
  git("init", "-q");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "one");
  const sha = git("rev-parse", "HEAD");
  git("remote", "add", "origin", "git@example.com:acme/tools.git");
  run(fx, ["write", "--session", NEW]);
  run(fx, ["link", "--session", NEW, "--kind", "trace", "--ref", `acme/tools@${sha.slice(0, 7)}`]);
  const env = { WITNESS_REPOS_ROOT: repos };
  const ok = runEnv(fx, ["links", "--session", NEW, "--check"], env);
  assert.equal(ok.code, 0, ok.stdout);
  assert.match(ok.stdout, /trace\s+checked acme\/tools@/);
  run(fx, ["link", "--session", NEW, "--kind", "trace", "--ref", "acme/tools@0000000"]);
  const bad = runEnv(fx, ["links", "--session", NEW, "--check"], env);
  assert.equal(bad.code, 1);
  assert.match(bad.stdout, /FAILED acme\/tools@0000000/);
  git("remote", "set-url", "origin", "git@example.com:someone/else.git");
  const elsewhere = runEnv(fx, ["links", "--session", NEW, "--check"], env);
  assert.match(elsewhere.stdout, /unchecked acme\/tools@.*no local tree of acme\/tools whose origin names it/);
});

function runEnv(fx, args, extra) {
  const saved = {};
  for (const [k, v] of Object.entries(extra)) { saved[k] = process.env[k]; process.env[k] = v; }
  try { return run(fx, args); } finally { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
}

test("the question skips messages between sessions, and an origin must name the repository after / or :", async () => {
  const { firstInput, originNames } = await import("./links-lib.mjs");
  const fx = fixture();
  const dir = join(fx.sessiondata, TRAP);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "_claude_user_inputs.jsonl"), [
    JSON.stringify({ prompt: "<cross-session-message from=\"x\">hello</cross-session-message>" }),
    JSON.stringify({ prompt: "what William actually asked" }),
  ].join("\n") + "\n");
  const first = firstInput(fx.sessiondata, TRAP);
  assert.equal(first.text, "what William actually asked");
  assert.match(first.ref, /#2$/);
  assert.equal(originNames("git@github.com:jgwill/Miadi.git", "jgwill/Miadi"), true);
  assert.equal(originNames("https://github.com/jgwill/Miadi", "will/Miadi"), false);
  assert.equal(originNames("ssh://mia@gaia:/srv/git/jgwill/episodes.git", "jgwill/episodes"), true);
});

test("a review the session is named after or handed becomes an evidence link, once", () => {
  const fx = fixture();
  const REVIEWED = "eeeeeeee-0000-4000-8000-000000000005";
  const A = "a425d070-fc40-43a1-8a26-024a290e8c95";
  const B = "09de3362-2418-4172-8250-fdcd913c0aa0";
  bind(fx, REVIEWED, { name: `review-261019-${A}`, tmux: `review-261019-${A}` });
  mkdirSync(join(fx.sessiondata, REVIEWED));
  writeFileSync(join(fx.sessiondata, REVIEWED, "_claude_user_inputs.jsonl"), [
    { prompt: `${"x".repeat(900)} from : https://miadi-review-service.vercel.app/review/${A} and miadi-review://${B}` },
    { prompt: `<cross-session-message from="x">miadi-review://ffffffff-0000-4000-8000-000000000006</cross-session-message>` },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n");
  assert.equal(run(fx, ["write", "--session", REVIEWED]).code, 0);
  const evidence = read(fx, `${REVIEWED}.json`).links.evidence;
  assert.deepEqual(evidence.map((e) => e.ref), [
    `https://miadi-review-service.vercel.app/review/${A}`,
    `https://miadi-review-service.vercel.app/review/${B}`,
  ]);
  assert.match(evidence[0].note, /session name review-261019-/);
  assert.match(run(fx, ["plan", "--session", REVIEWED]).stdout, new RegExp(`unchanged\\s+${REVIEWED}`));
});
