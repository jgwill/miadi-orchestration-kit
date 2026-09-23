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
  assert.match(woke.stdout, /mia-listen\.mjs" reply 260101000004 --episode ".*" <<'MIA'/);
  assert.match(woke.stdout, /re-arm in the background: node ".*mia-listen\.mjs" await --episode/);
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
  const runReply = (env, input) => new Promise((done) => {
    const child = spawn("node", [SCRIPT, "reply", "260101000001", "--episode", fx.episodeRoot], { env: { ...process.env, ...env } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("exit", (status) => done({ status, stdout, stderr }));
    child.stdin.end(input);
  });
  const posted = await runReply({ MIADI_PHONE_CAPTURE_PORT: String(server.address().port), TMUX_PANE: "%999" }, "William, it arrived.\n");
  server.close();
  assert.equal(posted.status, 0, posted.stderr);
  assert.match(posted.stdout, /delivered to the phone page \(stub-id\)/);
  assert.equal(received[0].url, "/api/replies");
  assert.equal(received[0].body.episode, FOLDER);
  assert.equal(received[0].body.take, "260101000001");
  assert.equal(received[0].body.text, "William, it arrived.");
  assert.equal(received[0].body.origin.pane, "%999");
  assert.equal(received[0].body.origin.multiplexer, "tmux");

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
