// node --test test/*.test.mjs — hermetic: temp chronicle, stub transcriber, stub wheel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CaptureService, ConcatSegmentJoiner, FileImportDriver, resolveConfig } from "@miadi/capture-service";
import { createApp, speakable } from "../server.mjs";

const LISTENER = fileURLToPath(new URL("../../scripts/mia-listen.mjs", import.meta.url));
const EPISODE = "2026-09-20-episode-901-phone-fixture";

async function bridge({ transcriber, voice = null } = {}) {
  const base = mkdtempSync(join(tmpdir(), "phone-capture-"));
  const chronicleRoot = join(base, "chronicle");
  mkdirSync(join(chronicleRoot, EPISODE), { recursive: true });
  writeFileSync(join(chronicleRoot, EPISODE, "episode.yaml"), "episode: 901\n");
  const registrations = [];
  const config = resolveConfig({}, {
    port: 8799, host: "127.0.0.1", takesDir: join(base, "takes"), driver: "file-import",
    publicBaseUrl: "https://gaia.example:8443", chronicleRoot, mwApiUrl: "http://wheel.invalid",
  });
  const service = new CaptureService({
    config,
    driver: new FileImportDriver(),
    joiner: new ConcatSegmentJoiner(),
    transcriber,
    registryClient: { register: async (record) => { registrations.push(record); return { success: true, id: record.id ?? "capture:stub" }; } },
  });
  const server = createServer(createApp({ service, chronicleRoot, uploadsDir: join(base, "uploads"), repliesDir: join(base, "replies"), voice, defaultEpisode: EPISODE }));
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { base, chronicleRoot, url, registrations, close: () => server.close() };
}

const stubTranscriber = {
  name: "stub",
  async transcribe() {
    return { transcription: "Mia, je parle depuis le iPhone.", translation: "Mia, I am speaking from the iPhone.", model: "stub", language: "fr" };
  },
};

test("an iPhone upload becomes a bundle in the episode that the listener validates", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const audio = Buffer.from("not really aac, but bytes are bytes");
    const response = await fetch(`${b.url}/api/takes?episode=${EPISODE}`, {
      method: "POST", headers: { "content-type": "audio/mp4", "tailscale-user-login": "jgi@example" }, body: audio,
    });
    const answer = await response.json();
    assert.equal(response.status, 200, JSON.stringify(answer));
    assert.equal(answer.success, true);
    assert.match(answer.take, /^\d{12}$/);
    assert.equal(answer.english, "Mia, I am speaking from the iPhone.");

    const takeDir = join(b.chronicleRoot, EPISODE, "captures", answer.take);
    const capture = JSON.parse(readFileSync(join(takeDir, "capture.json"), "utf8"));
    assert.equal(capture.schema, "miadi.episode-capture.v1");
    assert.equal(capture.episode.path, EPISODE);
    assert.ok(capture.transcription.outputs.some((output) => output.language === "en"));
    assert.ok(existsSync(join(takeDir, `${answer.take}.m4a`)), "audio kept as .m4a, which the Chronicle gitignores");
    assert.ok(b.registrations.length >= 1, "the take was offered to the wheel");

    const shown = execFileSync("node", [LISTENER, "show", answer.take, "--no-fetch", "--episode", join(b.chronicleRoot, EPISODE)], {
      encoding: "utf8", env: { ...process.env, MIADI_MIA_COMPANION_STATE_DIR: join(b.base, "listener") },
    });
    assert.match(shown, /Mia, I am speaking from the iPhone\./);
  } finally {
    b.close();
  }
});

test("a take whose transcription fails is still stored, and says why", async () => {
  const b = await bridge({ transcriber: { name: "down", async transcribe() { throw new Error("Groq unreachable"); } } });
  try {
    const response = await fetch(`${b.url}/api/takes`, { method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("bytes") });
    const answer = await response.json();
    assert.equal(answer.success, true);
    assert.match(answer.transcriptError, /Groq unreachable/);
    assert.ok(existsSync(join(b.chronicleRoot, EPISODE, "captures", answer.take, "capture.json")));
  } finally {
    b.close();
  }
});

test("refusals: a container git would track, an unknown episode, an empty body", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const post = (query, type, body) => fetch(`${b.url}/api/takes${query}`, { method: "POST", headers: { "content-type": type }, body });
    assert.equal((await post("", "audio/webm", Buffer.from("x"))).status, 415);
    assert.equal((await post("?episode=2026-01-01-episode-1-missing", "audio/mp4", Buffer.from("x"))).status, 404);
    assert.equal((await post("?episode=../../etc", "audio/mp4", Buffer.from("x"))).status, 400);
    assert.equal((await post("", "audio/mp4", Buffer.alloc(0))).status, 400);
    const episodes = await (await fetch(`${b.url}/api/episodes`)).json();
    assert.deepEqual(episodes.episodes.map((ep) => ep.path), [EPISODE]);
    const page = await fetch(`${b.url}/`);
    assert.match(await page.text(), /Speak to the episode/);
  } finally {
    b.close();
  }
});

test("a reply posted from this host waits for the page; one forwarded from the tailnet is refused", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const post = (headers, body) => fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
    const reply = { episode: EPISODE, take: "260920235421", text: "🧠: William, it arrived.", origin: { multiplexer: "tmux", pane: "%1" } };
    assert.equal((await post({ "x-forwarded-for": "100.71.17.43" }, reply)).status, 403);
    assert.equal((await post({ "tailscale-user-login": "jgi@example" }, reply)).status, 403);
    const posted = await (await post({}, reply)).json();
    assert.equal(posted.success, true);

    const byTake = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}&take=260920235421`)).json();
    assert.equal(byTake.replies.length, 1);
    assert.equal(byTake.replies[0].text, "🧠: William, it arrived.");
    assert.equal(byTake.replies[0].audio, null);
    assert.equal(byTake.replies[0].origin, undefined, "the page never sees pane ids");
    const other = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}&take=260920235499`)).json();
    assert.equal(other.replies.length, 0);
  } finally {
    b.close();
  }
});

test("Hear Mia renders once through the voice layer as persona mia, then serves byte ranges", async () => {
  const requests = [];
  const voice = { async render(request) { requests.push(request); return Buffer.from("ID3-mp3-bytes-0123456789"); } };
  const b = await bridge({ transcriber: stubTranscriber, voice });
  try {
    const { id } = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, take: "260920235421", text: "🧠: **William**, it arrived.\n\n🌸: You can speak from the desk.", origin: { multiplexer: "tmux", session: "s", pane: "%1" } }) })).json();
    const voiced = await (await fetch(`${b.url}/api/replies/${id}/voice`, { method: "POST" })).json();
    assert.equal(voiced.success, true);
    await fetch(`${b.url}/api/replies/${id}/voice`, { method: "POST" });
    assert.equal(requests.length, 1, "a second tap does not render a second voice");
    assert.equal(requests[0].persona, "mia");
    assert.equal(requests[0].episode, EPISODE);
    assert.equal(requests[0].origin.pane, "%1");
    assert.equal(requests[0].text, "William, it arrived.\n\nYou can speak from the desk.");

    const ranged = await fetch(`${b.url}/${voiced.audio}`, { headers: { range: "bytes=0-3" } });
    assert.equal(ranged.status, 206);
    assert.equal(await ranged.text(), "ID3-");
    const listed = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(listed.replies[0].audio, voiced.audio);
  } finally {
    b.close();
  }
});

test("without a voice layer, Hear Mia says so instead of substituting another voice", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const { id } = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "hello" }) })).json();
    const answer = await fetch(`${b.url}/api/replies/${id}/voice`, { method: "POST" });
    assert.equal(answer.status, 503);
    assert.equal(speakable("## Next\n- `mia-listen` **now**"), "Next\nmia-listen now");
  } finally {
    b.close();
  }
});
