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
// Hermetic: no child of these tests reads the live stateloom hub or posts to the live
// phone-capture. A test that needs either passes its own stub.
process.env.STATELOOM_BRIDGE_URL = "http://127.0.0.1:9";
delete process.env.SMCRAFT_BRIDGE_URL;
process.env.MIADI_PHONE_CAPTURE_PORT = "1";
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
    assert.match(text, /mia-listen\.mjs" reply --mark <id> --doc ".*wave\.smdf\.json" <<'MIA'/);
    const forMarks = (await canvasContext(env, { marksOnly: true, episode: "/ep" })).join("\n");
    assert.doesNotMatch(forMarks, /show_step|stage show/, "a wake of marks alone points at the one act, not at a step left on the stage");
    assert.match(forMarks, /reply --mark <id> --doc ".*wave\.smdf\.json" --episode "\/ep" <<'MIA'/);
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

// ---------- marks (smcraft Spec 83) ----------
// Episode 550, 2026-10-19: William marked a drawing and asked in the mark's thread "Are you
// replying to me here". No seat listened for marks. A mark waiting on an agent now wakes the
// episode's seat as a take does.

const PERSON = { id: "node:human:g", name: "Guillaume", role: "person" };
const MIA = { id: "mia", name: "Mia", role: "agent" };

function writeMarks(episodeRoot, drawing, marks) {
  const file = join(episodeRoot, "diagrams", drawing.replace(/\.json$/, ".marks.json"));
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify({ doc: drawing, marks }, null, 2));
}

function drawing(episodeRoot) {
  mkdirSync(join(episodeRoot, "diagrams"), { recursive: true });
  writeFileSync(join(episodeRoot, "diagrams", "walk.smdf.json"), JSON.stringify({ settings: { name: "W" }, events: [], state: { name: "Root", states: [{ name: "Witnessing" }] } }));
  writeFileSync(join(episodeRoot, "diagrams", "walk.sysdf.json"), JSON.stringify({ settings: { name: "S" }, members: [{ path: "walk.smdf.json" }] }));
}

const personMark = (extra = {}) => ({
  id: "m-1", kind: "comment", elements: ["state:Witnessing"], level: "Root",
  text: "Wouldn't that be one more state machine in between?", author: PERSON, at: "2026-10-20T03:28:41.292Z", status: "open", ...extra,
});

const awaitOnce = (fx, seconds = 30) => run(fx, ["await", "--no-fetch", "--timeout", String(seconds), "--interval", "5"]);

test("a person's new mark on a drawing wakes await, with its thread and how to answer it", () => {
  const fx = fixture();
  run(fx, ["status", "--no-fetch"]);
  drawing(fx.episodeRoot);
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark({ replies: [{ author: PERSON, text: "Are you replying to me here", at: "2026-10-20T03:29:46.215Z" }] })]);
  const woke = awaitOnce(fx);
  assert.equal(woke.code, 0, woke.stderr);
  assert.match(woke.stdout, /^NEW MARK FROM WILLIAM · episode 900 \(2026-01-01-episode-900-fixture\)/);
  assert.match(woke.stdout, /mark m-1 · diagrams\/walk\.smdf\.json · comment by Guillaume, 2026-10-20T03:28:41\.292Z · Guillaume added to it/);
  assert.match(woke.stdout, /on state:Witnessing \(inside Root\)/);
  assert.match(woke.stdout, /"Wouldn't that be one more state machine in between\?"/);
  assert.match(woke.stdout, /thread:\n {4}Guillaume, 2026-10-20T03:29:46\.215Z: Are you replying to me here/);
  // One act per mark (review R3): the stop first, then reply --mark, nothing else to run.
  assert.match(woke.stdout, /clear any step left on the stage[^\n]*\n {2}smcx --bridge "\$STATELOOM_BRIDGE_URL" stage control stop\n {2}node ".*mia-listen\.mjs" reply --mark m-1 --doc ".*diagrams\/walk\.smdf\.json" --episode ".*" <<'MIA'\n {2}<your words for mark m-1>\n {2}MIA\n/);
  assert.match(woke.stdout, /add --steps <that file> to that mark's act/);
  assert.doesNotMatch(woke.stdout, /marks reply|stage show|show_step/, "the thread write and the canvas walk are inside reply --mark");
  assert.match(woke.stdout, /Turn budget/);
  assert.match(woke.stdout, /re-arm in the background: node ".*mia-listen\.mjs" await --episode/);
  assert.doesNotMatch(woke.stdout, /NEW TAKE/);

  const beat = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.listening.json`), "utf8"));
  assert.equal(beat.state, "answering");
  assert.deepEqual(beat.marks, ["m-1"]);
  assert.equal(awaitOnce(fx, 1).code, 4, "a heard mark never wakes twice");
});

test("an agent's own open mark does not wake the seat", () => {
  const fx = fixture();
  run(fx, ["status", "--no-fetch"]);
  writeMarks(fx.episodeRoot, "walk.smdf.json", [{ id: "m-2", kind: "question", elements: ["state:Witnessing"], text: "Is this the step you meant?", author: MIA, status: "open" }]);
  assert.equal(awaitOnce(fx, 1).code, 4);
});

test("a person's reply to an answered mark wakes again, and so does a reopened one", () => {
  const fx = fixture();
  run(fx, ["status", "--no-fetch"]);
  const answer = { author: MIA, text: "Yes, the witness reads each session.", at: "2026-10-20T03:33:32Z" };
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark()]);
  assert.equal(awaitOnce(fx).code, 0);

  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark({ status: "answered", replies: [answer] })]);
  assert.equal(awaitOnce(fx, 1).code, 4, "Mia's answer is not a wake");

  const followUp = { author: PERSON, text: "Then where does it live?", at: "2026-10-20T03:40:00Z" };
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark({ status: "open", replies: [answer, followUp] })]);
  const again = awaitOnce(fx);
  assert.equal(again.code, 0, again.stderr);
  assert.match(again.stdout, /Guillaume added to it/);
  assert.match(again.stdout, /Mia \(agent\), 2026-10-20T03:33:32Z: Yes, the witness reads each session\.\n {4}Guillaume, 2026-10-20T03:40:00Z: Then where does it live\?/);

  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark({ status: "resolved", replies: [answer, followUp] })]);
  assert.equal(awaitOnce(fx, 1).code, 4, "a resolved mark waits on nobody");
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark({ status: "open", replies: [answer, followUp] })]);
  assert.equal(awaitOnce(fx).code, 0, "reopened, it wakes again");

  // An agent's question that the person answered waits on the agent.
  writeMarks(fx.episodeRoot, "walk.smdf.json", [{ id: "m-3", text: "Is this the step?", author: MIA, status: "answered", replies: [{ author: PERSON, text: "Yes." }] }]);
  const asked = awaitOnce(fx);
  assert.equal(asked.code, 0, asked.stderr);
  assert.match(asked.stdout, /mark m-3 · .* · Guillaume answered a question Mia asked/);
});

test("a broken sidecar or a mark of unknown shape is skipped, never a reason to stop listening", () => {
  const fx = fixture();
  run(fx, ["status", "--no-fetch"]);
  mkdirSync(join(fx.episodeRoot, "diagrams", "nested"), { recursive: true });
  writeFileSync(join(fx.episodeRoot, "diagrams", "half.smdf.marks.json"), '{"marks": [{"id": "m-9", "te');
  writeFileSync(join(fx.episodeRoot, "diagrams", "odd.erdf.marks.json"), JSON.stringify({ marks: "not a list" }));
  writeMarks(fx.episodeRoot, "nested/data.erdf.json", [null, 7, { id: "m-x" }, { text: "no id" }, { id: "m-4", text: "this one", author: "a string", status: "weird", elements: [3, "entity:Session"] }]);
  const quiet = run(fx, ["status", "--no-fetch"]);
  assert.equal(quiet.code, 0, quiet.stderr);
  assert.match(quiet.stdout, /warning: diagrams\/half\.smdf\.marks\.json does not read/);
  const woke = awaitOnce(fx);
  assert.equal(woke.code, 0, woke.stderr);
  assert.match(woke.stdout, /mark m-4 · diagrams\/nested\/data\.erdf\.json · comment by someone · new/);
  assert.match(woke.stdout, /on entity:Session/);
  assert.doesNotMatch(woke.stdout, /m-9|m-x/);
  assert.equal(awaitOnce(fx, 1).code, 4, "only the broken sidecar is left, and it never wakes or crashes the listener");
});

test("status lists the marks waiting on an agent, heard or not", () => {
  const fx = fixture();
  assert.match(run(fx, ["status", "--no-fetch"]).stdout, /marks waiting on an agent: none/);
  writeMarks(fx.episodeRoot, "walk.smdf.json", [
    personMark(),
    { id: "m-5", text: "done", author: PERSON, status: "resolved" },
    { id: "m-6", text: "my question", author: MIA, status: "open" },
    { id: "m-7", text: "over here", author: PERSON, status: "open", region: { x: 10.4, y: 20.6, width: 30, height: 40 }, level: "Root" },
  ]);
  const status = run(fx, ["status", "--no-fetch"]);
  assert.match(status.stdout, /marks waiting on an agent: 2, 2 unheard/);
  assert.match(status.stdout, /m-1 · diagrams\/walk\.smdf\.json · Guillaume on state:Witnessing: "Wouldn't that be one more state machine in between\?" \(unheard\)/);
  assert.match(status.stdout, /m-7 · diagrams\/walk\.smdf\.json · Guillaume on the area 10,21 30×40 inside Root: "over here" \(unheard\)/);
  assert.doesNotMatch(status.stdout, /m-5|m-6/);
  assert.equal(awaitOnce(fx).code, 0);
  assert.match(run(fx, ["status", "--no-fetch"]).stdout, /marks waiting on an agent: 2, 0 unheard[\s\S]*\(heard\)/);
});

test("a take and a mark arriving together make one wake that carries both", () => {
  const fx = fixture();
  run(fx, ["status", "--no-fetch"]);
  writeTake(fx.episodeRoot, "260101000007", "Look at what I marked.\n");
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark()]);
  const woke = awaitOnce(fx);
  assert.equal(woke.code, 0, woke.stderr);
  assert.match(woke.stdout, /^NEW TAKE FROM WILLIAM[\s\S]*Look at what I marked\.[\s\S]*NEW MARK FROM WILLIAM[\s\S]*mark m-1/);
  assert.match(woke.stdout, /--take 260101000007 --draft -/);
  assert.match(woke.stdout, /clears the stage, delivers the return \(below\), answers each mark with its one act/);
  assert.match(woke.stdout, /reply --mark m-1 --doc ".*walk\.smdf\.json"/);
  assert.match(woke.stdout, /stage control stop/);
  const beat = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.listening.json`), "utf8"));
  assert.deepEqual(beat.takes, ["260101000007"]);
  assert.deepEqual(beat.marks, ["m-1"]);
  assert.match(run(fx, ["status", "--no-fetch"]).stdout, /listening now: answering 260101000007, mark m-1/);
});

// ---------- reply --mark (review R3) ----------
// 2026-10-20: a mark answered in its thread was silent and absent from the companion thread,
// and a voiced reply left the mark open. One act now does both.

function stubCapture() {
  return import("node:http").then(({ createServer }) => {
    const received = [];
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      const parsed = JSON.parse(body);
      received.push(parsed);
      res.writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify({ success: true, id: `stub-${received.length}`, steps: parsed.steps?.length ?? 0, voiced: true, ...(parsed.mark ? { mark: parsed.mark } : {}) }));
    });
    return new Promise((done) => server.listen(0, "127.0.0.1", () => done({ server, received, port: server.address().port })));
  });
}

// Spawned by absolute path, so PATH says only where smcx is (or that it is nowhere).
function replyMark(fx, args, input, env) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [SCRIPT, "reply", ...args, "--episode", fx.episodeRoot], {
      env: { HOME: process.env.HOME, MIADI_MIA_COMPANION_STATE_DIR: fx.state, ...env },
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => done({ status, stdout, stderr }));
    child.stdin.end(input);
  });
}

const sidecarOf = (fx) => JSON.parse(readFileSync(join(fx.episodeRoot, "diagrams", "walk.smdf.marks.json"), "utf8"));

test("reply --mark posts a voiced reply carrying the mark and a step lighting it, and smcx answers the thread", async () => {
  const fx = fixture();
  drawing(fx.episodeRoot);
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark(), personMark({ id: "m-2", elements: [], region: { x: 1, y: 2, width: 30, height: 40 }, text: "and here?" })]);
  // A stand-in for the global smcx that keeps the arguments it was given.
  const bin = join(fx.base, "bin");
  mkdirSync(bin, { recursive: true });
  const log = join(fx.base, "smcx.log");
  writeFileSync(join(bin, "smcx"), `#!/usr/bin/env node\nrequire("node:fs").appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + "\\n");\nconsole.log("answered " + process.argv[process.argv.length - 3] + " on walk.smdf.json — not live: xhr poll error");\n`, { mode: 0o755 });
  mkdirSync(fx.state, { recursive: true });
  writeFileSync(join(fx.state, `${FOLDER}.listening.json`), JSON.stringify({ state: "answering", takes: [], marks: ["m-1", "m-2"], since: "s", at: new Date().toISOString() }));
  const { server, received, port } = await stubCapture();
  const env = { PATH: `${bin}:${join(process.execPath, "..")}`, MIADI_PHONE_CAPTURE_PORT: String(port), STATELOOM_BRIDGE_URL: "http://127.0.0.1:9", TMUX_PANE: "%999" };
  const first = await replyMark(fx, ["--mark", "m-1", "--doc", "diagrams/walk.smdf.json"], "-Yes: the witness reads each session.\n", env);
  const beat = JSON.parse(readFileSync(join(fx.state, `${FOLDER}.listening.json`), "utf8"));
  const second = await replyMark(fx, ["--mark", "m-2"], "That area is the hand-off.\n", env);
  server.close();

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, "mia-listen: reply stub-1 · voiced · answers mark m-1 on walk.smdf.json, in its thread (smcx: not live: xhr poll error) · 1 step for the canvas\n");
  const doc = join(fx.episodeRoot, "diagrams", "walk.smdf.json");
  assert.deepEqual(received[0].mark, { id: "m-1", doc });
  assert.equal(received[0].text, "-Yes: the witness reads each session.");
  assert.deepEqual(received[0].steps, [{ say: "-Yes: the witness reads each session.", doc, system: join(fx.episodeRoot, "diagrams", "walk.sysdf.json"), spotlight: ["state:Witnessing"] }]);
  assert.equal(received[0].origin.pane, "%999");
  const calls = readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(calls[0], ["--bridge", "http://127.0.0.1:9", "--doc", doc, "--name", "Mia", "marks", "reply", "m-1", "--", "-Yes: the witness reads each session."]);
  assert.equal(sidecarOf(fx).marks[0].status, "open", "smcx writes the thread; mia-listen does not write it twice");

  assert.deepEqual(beat.marks, ["m-2"], "the page still sees the mark not yet answered");
  assert.equal(beat.state, "answering");
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(received[1].steps[0].region, { x: 1, y: 2, width: 30, height: 40 }, "an area mark walks to its area");
  assert.equal(received[1].steps[0].spotlight, undefined);
  assert.equal(JSON.parse(readFileSync(join(fx.state, `${FOLDER}.listening.json`), "utf8")).state, "answered");
});

test("reply --mark writes the thread itself when smcx is not on PATH, and refuses what it cannot answer", async () => {
  const fx = fixture();
  drawing(fx.episodeRoot);
  writeMarks(fx.episodeRoot, "walk.smdf.json", [{ ...personMark(), extra: "kept" }, personMark({ id: "m-5", status: "resolved" })]);
  const empty = join(fx.base, "no-smcx");
  mkdirSync(empty, { recursive: true });
  const { server, received, port } = await stubCapture();
  const env = { PATH: empty, MIADI_PHONE_CAPTURE_PORT: String(port) };
  const steps = join(fx.base, "steps.json");
  writeFileSync(steps, JSON.stringify([{ say: "Here it starts.", spotlight: ["state:Witnessing"] }, { say: "And it ends here." }]));
  const answered = await replyMark(fx, ["--mark", "m-1", "--steps", steps], "", env);
  const kept = await replyMark(fx, ["--mark", "m-5"], "Still resolved.\n", env);
  const badId = await replyMark(fx, ["--mark", "M 1"], "x", env);
  const missing = await replyMark(fx, ["--mark", "m-404"], "x", env);
  writeFileSync(join(fx.episodeRoot, "diagrams", "torn.smdf.marks.json"), '{"marks": [{"id": "m-1"');
  const torn = await replyMark(fx, ["--mark", "m-1", "--doc", "diagrams/torn.smdf.json"], "x", env);
  server.close();

  assert.equal(answered.status, 0, answered.stderr);
  assert.match(answered.stdout, /^mia-listen: reply stub-1 · voiced · answers mark m-1 on walk\.smdf\.json, in its thread \(smcx is not on PATH, so the sidecar was written directly and the hub was not told: an open canvas shows it when it reloads\) · 2 steps for the canvas\n$/);
  assert.equal(received[0].steps[0].doc, join(fx.episodeRoot, "diagrams", "walk.smdf.json"), "a walk answering a mark starts on its drawing");
  const marks = sidecarOf(fx).marks;
  assert.equal(marks[0].status, "answered", "an agent's reply answers a person's mark");
  assert.equal(marks[0].extra, "kept", "the rest of the mark is left as it was");
  assert.deepEqual(marks[0].replies.map((r) => [r.author, r.text]), [[MIA, "Here it starts.\n\nAnd it ends here."]], "with stdin empty the thread gets the steps' words");
  assert.ok(Date.parse(marks[0].replies[0].at));
  assert.equal(kept.status, 0, kept.stderr);
  assert.equal(marks[1].status, "resolved", "a resolved mark stays resolved");
  assert.equal(marks[1].replies.at(-1).text, "Still resolved.");

  assert.equal(badId.status, 2);
  assert.match(badId.stderr, /--mark takes a mark id/);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /no mark m-404 on the episode's drawings/);
  assert.equal(torn.status, 2);
  assert.match(torn.stderr, /torn\.smdf\.marks\.json does not parse, so it is left as it is/);
  assert.equal(received.length, 2, "nothing is posted for a mark that cannot be answered");
  assert.equal(readFileSync(join(fx.episodeRoot, "diagrams", "torn.smdf.marks.json"), "utf8"), '{"marks": [{"id": "m-1"');
});

test("reply --mark still answers in the thread when phone-capture is down, and says only that half landed", async () => {
  const fx = fixture();
  drawing(fx.episodeRoot);
  writeMarks(fx.episodeRoot, "walk.smdf.json", [personMark()]);
  const empty = join(fx.base, "no-smcx");
  mkdirSync(empty, { recursive: true });
  const out = await replyMark(fx, ["--mark", "m-1"], "Yes.\n", { PATH: empty, MIADI_PHONE_CAPTURE_PORT: "1" });
  assert.equal(out.status, 3);
  assert.match(out.stdout, /^mia-listen: reply not delivered to phone-capture \(.+\) · not voiced · answers mark m-1 on walk\.smdf\.json, in its thread/);
  assert.equal(sidecarOf(fx).marks[0].status, "answered");
});
