// node --test claude/mia-episode-companion/scripts/mia-listen.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("./mia-listen.mjs", import.meta.url));
const FOLDER = "2026-01-01-episode-900-fixture";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function writeTake(episodeRoot, takeId, english, { corruptHash = false, when = "2026-01-01T00:00:00.000Z" } = {}) {
  const dir = join(episodeRoot, "captures", takeId);
  mkdirSync(dir, { recursive: true });
  const enName = `transcription_${takeId}_EN.txt`;
  writeFileSync(join(dir, enName), english);
  writeFileSync(join(dir, "capture.json"), JSON.stringify({
    schema: "miadi.episode-capture.v1",
    episode: { path: FOLDER, number: 900 },
    source: { filename: `${takeId}.m4a` },
    transcription: {
      timestamp: when,
      outputs: [{
        language: "en",
        filename: enName,
        relativePath: `captures/${takeId}/${enName}`,
        bytes: Buffer.byteLength(english),
        sha256: corruptHash ? "0".repeat(64) : sha(english),
      }],
    },
  }));
}

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "mia-listen-"));
  const origin = join(base, "origin.git");
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin]);
  const clone = (name) => {
    const dir = join(base, name);
    execFileSync("git", ["clone", "--quiet", origin, dir], { stdio: "ignore" });
    git(dir, "config", "user.email", "fixture@example.invalid");
    git(dir, "config", "user.name", "fixture");
    return dir;
  };
  const seat = clone("gaia");
  const episodeRoot = join(seat, "miadi-chronicle", FOLDER);
  mkdirSync(episodeRoot, { recursive: true });
  writeFileSync(join(episodeRoot, "episode.yaml"), "episode: 900\n");
  writeTake(episodeRoot, "260101000001", "An earlier take.\n");
  git(seat, "add", "miadi-chronicle");
  git(seat, "commit", "--quiet", "-m", "vessel");
  git(seat, "push", "--quiet", "origin", "HEAD:main");
  git(seat, "branch", "--quiet", "--set-upstream-to=origin/main");
  const phone = clone("ilex");
  return { base, seat, phone, episodeRoot, state: join(base, "state") };
}

function run(fx, args) {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...args, "--episode", fx.episodeRoot], {
      encoding: "utf8",
      env: { ...process.env, MIADI_MIA_COMPANION_STATE_DIR: fx.state },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status, stdout: String(error.stdout ?? ""), stderr: String(error.stderr ?? "") };
  }
}

test("the first status takes a baseline, so earlier takes never wake the seat", () => {
  const fx = fixture();
  const status = run(fx, ["status"]);
  assert.equal(status.code, 0);
  assert.match(status.stdout, /new baseline taken now/);
  assert.match(status.stdout, /unheard: none/);
  const timeout = run(fx, ["await", "--timeout", "1", "--interval", "5"]);
  assert.equal(timeout.code, 4);
});

test("a take pushed from another checkout wakes await from origin without touching the worktree", async () => {
  const fx = fixture();
  run(fx, ["status"]);

  const waiter = spawn("node", [SCRIPT, "await", "--interval", "5", "--timeout", "60", "--episode", fx.episodeRoot], {
    env: { ...process.env, MIADI_MIA_COMPANION_STATE_DIR: fx.state },
  });
  let stdout = "";
  waiter.stdout.on("data", (chunk) => { stdout += chunk; });
  const exited = new Promise((done) => waiter.on("exit", done));

  const phoneEpisode = join(fx.phone, "miadi-chronicle", FOLDER);
  writeTake(phoneEpisode, "260101000002", "Mia, I recorded this on the phone.\n");
  git(fx.phone, "add", "miadi-chronicle");
  git(fx.phone, "commit", "--quiet", "-m", "take");
  git(fx.phone, "push", "--quiet", "origin", "HEAD:main");

  assert.equal(await exited, 0);
  assert.match(stdout, /take 260101000002 · .* read from origin\/main, not yet in this checkout/);
  assert.match(stdout, /Mia, I recorded this on the phone\./);
  assert.equal(existsSync(join(fx.episodeRoot, "captures", "260101000002")), false, "worktree was not merged into");

  const state = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.json`), "utf8"));
  assert.equal(state.delivered.length, 1);
  assert.equal(run(fx, ["await", "--timeout", "1", "--interval", "5"]).code, 4, "a heard take never wakes twice");
});

test("a take whose receipt does not match waits and is named, never delivered", () => {
  const fx = fixture();
  run(fx, ["status"]);
  writeTake(fx.episodeRoot, "260101000003", "Half written.\n", { corruptHash: true });
  const status = run(fx, ["status", "--no-fetch"]);
  assert.match(status.stdout, /waiting: 260101000003@worktree: .*SHA-256 receipt does not match/);
  assert.equal(run(fx, ["await", "--no-fetch", "--timeout", "1", "--interval", "5"]).code, 4);
});

test("a worktree take is delivered once its signature holds across two polls", () => {
  const fx = fixture();
  run(fx, ["status"]);
  writeTake(fx.episodeRoot, "260101000004", "Recorded on this host.\n");
  const woke = run(fx, ["await", "--no-fetch", "--timeout", "30", "--interval", "5"]);
  assert.equal(woke.code, 0);
  assert.match(woke.stdout, /take 260101000004 · transcribed/);
  assert.doesNotMatch(woke.stdout, /not yet in this checkout/);
  assert.match(woke.stdout, /Committed: no\. Commit its textual records by name/);
  assert.match(woke.stdout, /add -- captures\/260101000004\/capture\.json captures\/260101000004\/transcription_260101000004_EN\.txt &&/);
  assert.match(woke.stdout, /Turn budget/);
  assert.match(woke.stdout, /jev-check\.mjs" check --episode ".*" --take 260101000004 --draft - /);
  assert.match(woke.stdout, /mia-listen\.mjs" reply 260101000004 --episode ".*" <<'MIA'/);
  assert.match(woke.stdout, /re-arm in the background: node ".*mia-listen\.mjs" await --episode/);

  // The wake leaves the room occupied: the seat is answering, not gone.
  const beat = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.listening.json`), "utf8"));
  assert.equal(beat.state, "answering");
  assert.deepEqual(beat.takes, ["260101000004"]);
  assert.match(run(fx, ["status", "--no-fetch"]).stdout, /listening now: answering 260101000004/);
});

test("reply posts the return on stdin to phone-capture with this invocation's origin", async () => {
  const fx = fixture();
  const { createServer } = await import("node:http");
  const received = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push({ url: req.url, body: JSON.parse(body) });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ success: true, id: "stub-id" }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  // Async: the stub server lives in this process and must answer while the child waits.
  const runReply = (env, input, take = ["260101000001"]) => new Promise((done) => {
    const child = spawn("node", [SCRIPT, "reply", ...take, "--episode", fx.episodeRoot], { env: { ...process.env, ...env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => done({ status, stdout, stderr }));
    child.stdin.end(input);
  });
  mkdirSync(fx.state, { recursive: true });
  writeFileSync(join(fx.state, `${FOLDER}.listening.json`), JSON.stringify({ state: "answering", takes: ["260101000001"], at: new Date().toISOString() }));
  const posted = await runReply({ MIADI_PHONE_CAPTURE_PORT: String(server.address().port), TMUX_PANE: "%999", CLAUDE_CODE_SESSION_ID: "4ae4c17d", MIADI_MIA_COMPANION_STATE_DIR: fx.state }, "William, it arrived.\n");
  const answered = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.listening.json`), "utf8"));
  assert.equal(answered.state, "answered", "a posted reply ends the answering; the re-arm comes next");
  assert.deepEqual(answered.takes, ["260101000001"]);
  // A message that answers no take goes through the same command, with the same origin.
  const untaken = await runReply({ MIADI_PHONE_CAPTURE_PORT: String(server.address().port), TMUX_PANE: "%999" }, "Ready when you are.\n", []);
  server.close();
  assert.equal(untaken.status, 0, untaken.stderr);
  assert.match(untaken.stdout, /reply delivered to the phone page \(stub-id\)/);
  assert.equal(received[1].body.take, undefined);
  assert.equal(received[1].body.origin.pane, "%999");
  assert.equal(posted.status, 0, posted.stderr);
  assert.match(posted.stdout, /delivered to the phone page \(stub-id\)/);
  assert.equal(received[0].url, "/api/replies");
  assert.equal(received[0].body.episode, FOLDER);
  assert.equal(received[0].body.take, "260101000001");
  assert.equal(received[0].body.text, "William, it arrived.");
  assert.equal(received[0].body.origin.pane, "%999");
  assert.equal(received[0].body.origin.multiplexer, "tmux");
  assert.equal(received[0].body.origin.occupantId, "4ae4c17d", "the Claude session id survives a reboot that renumbers the pane");
  assert.ok(Date.parse(received[0].body.origin.observedAt));

  const refused = await runReply({ MIADI_PHONE_CAPTURE_PORT: "1" }, "text");
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /stays in this conversation/);
});

test("show prints a take without marking it heard", () => {
  const fx = fixture();
  run(fx, ["status"]);
  const shown = run(fx, ["show", "260101000001", "--no-fetch"]);
  assert.equal(shown.code, 0);
  assert.match(shown.stdout, /An earlier take\./);
  assert.doesNotMatch(shown.stdout, /re-arm/);
  const state = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.json`), "utf8"));
  assert.equal(state.delivered.length, 0);
});

test("a take recorded minutes before the first listen is not swallowed by the baseline", () => {
  const fx = fixture();
  writeTake(fx.episodeRoot, "260101000005", "I recorded this, then started the session here.\n", { when: new Date().toISOString() });
  const status = run(fx, ["status", "--no-fetch"]);
  assert.match(status.stdout, /new baseline taken now/);
  assert.match(status.stdout, /unheard: 260101000005 \(worktree\)/);
  const woke = run(fx, ["await", "--no-fetch", "--timeout", "30", "--interval", "5"]);
  assert.equal(woke.code, 0);
  assert.match(woke.stdout, /I recorded this, then started the session here\./);
  assert.match(run(fx, ["status", "--no-fetch"]).stdout, /unheard: none/);
});

// Episode 339, 2026-10-08: a seat that posts while William records is told the reply waits.
test("reply says so when William is recording and the reply waits on his page", async () => {
  const fx = fixture();
  const { createServer } = await import("node:http");
  const server = createServer(async (req, res) => {
    for await (const _ of req) { /* drain */ }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ success: true, id: "stub-id", recording: true }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const out = await new Promise((done) => {
    const child = spawn("node", [SCRIPT, "reply", "--episode", fx.episodeRoot], { env: { ...process.env, MIADI_PHONE_CAPTURE_PORT: String(server.address().port), TMUX_PANE: "%999" } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => done({ status, stdout, stderr }));
    child.stdin.end("Ready.\n");
  });
  server.close();
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /William is recording right now\. The reply is on his page, silent/);
});

// jgwill/jgtsrc#190, 2026-10-09: a labelling note wakes the seat marked as such, and its
// purpose.json travels in the commit with the take's other textual records.
test("a labelling note is marked in the wake and committed with its purpose", () => {
  const fx = fixture();
  run(fx, ["status"]);
  writeTake(fx.episodeRoot, "260101000006", "This is where the trail should arm.\n");
  writeFileSync(join(fx.episodeRoot, "captures", "260101000006", "purpose.json"), JSON.stringify({ purpose: "labelling", at: "2026-10-09T00:00:00Z" }));
  const woke = run(fx, ["await", "--no-fetch", "--timeout", "30", "--interval", "5"]);
  assert.equal(woke.code, 0);
  assert.match(woke.stdout, /purpose: labelling\. A spoken note for a labelled example/);
  assert.match(woke.stdout, /captures\/260101000006\/purpose\.json/);
});

test("reply --related resolves a file of the episode, a review, an issue and a URL into cards", async () => {
  const { relatedCard } = await import("./mia-listen.mjs");
  const root = mkdtempSync(join(tmpdir(), "mia-related-"));
  mkdirSync(join(root, "branches", "marks"), { recursive: true });
  writeFileSync(join(root, "branches", "marks", "spec.md"), "spec\n");
  const episode = { root, folder: "2026-07-10-episode-120-fixture" };
  const env = { MIADI_URL_BASE_INTERNAL: "https://miadi.example/" };
  assert.deepEqual(relatedCard("Marks spec=branches/marks/spec.md", episode, env), {
    label: "Marks spec", kind: "file",
    href: "https://miadi.example/chronicle/2026-07-10-episode-120-fixture?file=branches%2Fmarks%2Fspec.md",
  });
  assert.equal(relatedCard("Review=miadi-review:e29a4fc3-302a-4309-8ad9-39085ee26283", episode, env).href,
    "https://miadi-review-service.vercel.app/review/e29a4fc3-302a-4309-8ad9-39085ee26283");
  assert.equal(relatedCard("Issue=jgwill/Miadi#706", episode, env).href, "https://github.com/jgwill/Miadi/issues/706");
  assert.equal(relatedCard("Page=https://claude.ai/artifact/x", episode, env).kind, "artifact");
  assert.throws(() => relatedCard("Missing=branches/none.md", episode, env), /no such file/);
  assert.throws(() => relatedCard("Escape=../etc/passwd", episode, env), /no such file/);
  assert.throws(() => relatedCard("no-label-separator", episode, env), /<label>=<target>/);
});

test("a reply's loop is read from the Jev ledger: its run, its flags, and whether the words changed after", async () => {
  const { loopOf } = await import("./mia-listen.mjs");
  const dir = mkdtempSync(join(tmpdir(), "mia-loop-"));
  const draft = "First words.";
  const sha = createHash("sha256").update(draft).digest("hex");
  writeFileSync(join(dir, "mia-return.jsonl"), [
    { kind: "mia-return", id: "older-record-0001", takes: ["261012155615"], draft_sha256: "x", answers: [], evidence: [] },
    { kind: "mia-return", id: "latest-record-0002", run_id: "run-2", decider: "jev-1.13.0", takes: ["261012155615"], draft_sha256: sha,
      answers: [{ id: "asks_answered", flag: true }, { id: "hands_back", flag: false }], evidence: ["committed 488fa03"] },
    { kind: "mia-return", id: "other-take-0003", takes: ["261012150000"], answers: [], evidence: [] },
  ].map((r) => JSON.stringify(r)).join("\n") + "\n");
  const env = { MIADI_DECISIONS_DIR: dir };
  assert.deepEqual(loopOf("261012155615", draft, env), {
    jev_record: "latest-record-0002", run_id: "run-2", decider: "jev-1.13.0",
    flags: ["asks_answered"], revised_after_check: false, facts: ["committed 488fa03"],
  });
  assert.equal(loopOf("261012155615", "Revised words.", env).revised_after_check, true);
  assert.equal(loopOf(undefined, draft, env), null, "a reply to no take has no loop");
});

test("the wake says what William's stateloom canvas shows and the marks waiting on that drawing", async () => {
  const { createServer } = await import("node:http");
  const { canvasContext, formatWake } = await import("./mia-listen.mjs");
  const dir = mkdtempSync(join(tmpdir(), "mia-canvas-"));
  const doc = join(dir, "wave.smdf.json");
  writeFileSync(doc, "{}");
  writeFileSync(join(dir, "wave.smdf.marks.json"), JSON.stringify({
    doc: "wave.smdf.json",
    marks: [
      { id: "m-1", kind: "comment", elements: ["state:Reading"], text: "why does it stop\nhere?", author: { id: "g", name: "Guillaume", role: "person" }, status: "open" },
      { id: "m-2", kind: "question", elements: ["state:Published"], text: "mine", author: { id: "mia", name: "Mia", role: "agent" }, status: "open" },
      { id: "m-3", kind: "comment", text: "done", author: { id: "g", name: "Guillaume", role: "person" }, status: "resolved" },
    ],
  }));
  const server = createServer((req, res) => {
    if (req.url !== "/stage/trading") return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ stage: "trading", context: { stage: "trading", doc, kind: "machine", focus: "state:Reading", at: "now", tour: { title: "Walk", index: 1, count: 3, playing: false } } }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const env = { STATELOOM_BRIDGE_URL: `http://127.0.0.1:${server.address().port}`, STATELOOM_STAGE: "trading" };
    const lines = await canvasContext(env);
    const text = lines.join("\n");
    assert.match(text, /On William's canvas \(stage 'trading', reported now\): wave\.smdf\.json \(machine\), state:Reading in hand, tour 'Walk' at step 2 of 3\./);
    assert.match(text, /mark m-1 · Guillaume on state:Reading: "why does it stop here\?"/);
    assert.doesNotMatch(text, /m-2|m-3/, "an agent's own question and a resolved mark are not waiting on Mia");
    assert.match(text, /marks reply <id>/);
    assert.deepEqual(await canvasContext({}), [], "no hub configured: no canvas lines");
    assert.deepEqual(await canvasContext({ STATELOOM_BRIDGE_URL: "http://127.0.0.1:9" }), [], "an unreachable hub is a wake without the canvas");

    const episode = { root: dir, folder: "2026-10-18-episode-999-test", number: 999, git: null };
    const take = { takeId: "261018000000", source: "origin/main", key: "k", capturedAt: "t", outputs: [], sourceFilename: "a.m4a", english: { text: "look at this state" } };
    assert.match(formatWake(episode, [take], { rearm: false, canvas: lines }), /On William's canvas[\s\S]*This is William speaking/);
  } finally {
    server.close();
  }
});

test("reply --steps posts a walk through diagrams, docs resolved in the episode, and stdin may be empty", async () => {
  const fx = fixture();
  const { createServer } = await import("node:http");
  const received = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received.push(JSON.parse(body));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ success: true, id: "stub-id", steps: 2 }));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const stepsFile = join(fx.base, "steps.json");
  // The drawings the steps light exist and hold those names: the reply is checked against them.
  mkdirSync(join(fx.episodeRoot, "diagrams"), { recursive: true });
  writeFileSync(join(fx.episodeRoot, "diagrams", "wave.smdf.json"), JSON.stringify({ settings: { name: "W" }, events: [], state: { name: "Root", states: [{ name: "Reading" }] } }));
  const other = join(fx.base, "other.sqdf.json");
  writeFileSync(other, JSON.stringify({ participants: [{ name: "A" }], messages: Array.from({ length: 9 }, () => ({ from: "A", to: "A", label: "m" })) }));
  writeFileSync(stepsFile, JSON.stringify([
    { say: "This is where the count starts.", doc: "diagrams/wave.smdf.json", spotlight: ["state:Reading"] },
    { say: "And here it waits.", doc: other, focus: "message:9" },
  ]));
  const runReply = (args, input) => new Promise((done) => {
    const child = spawn("node", [SCRIPT, "reply", "260101000001", ...args, "--episode", fx.episodeRoot], {
      env: { ...process.env, MIADI_PHONE_CAPTURE_PORT: String(server.address().port), TMUX_PANE: "%999", MIADI_MIA_COMPANION_STATE_DIR: fx.state },
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => done({ status, stdout, stderr }));
    child.stdin.end(input);
  });
  const posted = await runReply(["--steps", stepsFile], "");
  const empty = join(fx.base, "empty.json");
  writeFileSync(empty, JSON.stringify([{ say: "" }]));
  const refused = await runReply(["--steps", empty], "");
  server.close();
  assert.equal(posted.status, 0, posted.stderr);
  assert.match(posted.stdout, /with 2 steps for the canvas/);
  assert.equal(received[0].text, "");
  assert.equal(received[0].steps[0].doc, join(fx.episodeRoot, "diagrams/wave.smdf.json"));
  assert.equal(received[0].steps[1].doc, other);
  assert.deepEqual(received[0].steps[0].spotlight, ["state:Reading"]);
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /step 1 .* says nothing/);
});

test("a take spoken at the canvas says what the canvas showed, and the wake offers to answer in steps", () => {
  const fx = fixture();
  writeFileSync(join(fx.episodeRoot, "captures", "260101000001", "canvas.json"), JSON.stringify({
    stage: "default", doc: "/ep/diagrams/wave.smdf.json", kind: "machine", focus: "state:Reading", marks: ["m-1"],
  }));
  const shown = run(fx, ["show", "260101000001", "--no-fetch"]);
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /spoken at his stateloom canvas, looking at wave\.smdf\.json \(machine\), state:Reading in hand, marks open: m-1/);
  assert.match(shown.stdout, /--steps <that file>/);
});

// smcraft Spec 84: a reply's steps are checked against their drawings before it is sent,
// so William never hears a walk whose steps light nothing.
test("a reply's steps that name what their drawings do not hold are refused, with what is there", async () => {
  const { stepProblems } = await import("./mia-listen.mjs");
  const dir = mkdtempSync(join(tmpdir(), "mia-steps-"));
  const machine = join(dir, "wave.smdf.json");
  const scenario = join(dir, "walk.sqdf.json");
  const data = join(dir, "wave.erdf.json");
  writeFileSync(machine, JSON.stringify({ settings: { name: "M" }, events: [{ name: "G", events: [{ id: "Evaluate" }] }], state: { name: "Root", states: [{ name: "Reading", states: [{ name: "Labelled" }] }, { name: "Published" }] } }));
  writeFileSync(scenario, JSON.stringify({ participants: [{ name: "Chart" }], messages: [{ from: "Chart", to: "Chart", label: "a", event: "Publish" }], fragments: [{ kind: "alt", after: 1, messages: [{ from: "Chart", to: "Chart", label: "b" }] }] }));
  writeFileSync(data, JSON.stringify({ entities: [{ name: "WaveCount", attributes: [{ name: "id" }] }] }));
  assert.deepEqual(stepProblems([
    { say: "a", doc: machine, spotlight: ["state:Published", "state:Labelled", "event:Evaluate"] },
    { say: "b", focus: "state:Reading" },
    { say: "c", doc: scenario, spotlight: ["message:1", "message:f1.1", "participant:Chart", "event:Publish"] },
    { say: "d", doc: data, spotlight: ["entity:WaveCount", "attribute:WaveCount.id", "machine:Anything"] },
  ]), [], "names the drawings hold, a step that keeps the previous drawing, and a kind not checked");
  const problems = stepProblems([
    { say: "a", doc: machine, spotlight: ["state:Publshed"] },
    { say: "b", doc: scenario, focus: "message:2" },
    { say: "c", doc: join(dir, "absent.erdf.json"), spotlight: ["entity:X"] },
  ]);
  assert.equal(problems.length, 3, problems.join("\n"));
  assert.match(problems[0], /step 1: wave\.smdf\.json holds no state:Publshed \(its states: .*Published/);
  assert.match(problems[1], /step 2: walk\.sqdf\.json holds no message:2/);
  assert.match(problems[2], /step 3: no drawing at .*absent\.erdf\.json/);
});
