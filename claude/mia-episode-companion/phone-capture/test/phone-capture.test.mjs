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
import { cleanContext, cleanMark, cleanSteps, createApp, followSeat, listenerState, speakable, SpokenLanguageTranscriber, voiceParts } from "../server.mjs";

const LISTENER = fileURLToPath(new URL("../../scripts/mia-listen.mjs", import.meta.url));
// Hermetic: the listener these tests run never reads the live stateloom hub.
process.env.STATELOOM_BRIDGE_URL = "http://127.0.0.1:9";
delete process.env.SMCRAFT_BRIDGE_URL;
const EPISODE = "2026-09-20-episode-901-phone-fixture";

async function bridge({ transcriber, voice = null, language = "fr", locate } = {}) {
  const base = mkdtempSync(join(tmpdir(), "phone-capture-"));
  const chronicleRoot = join(base, "chronicle");
  mkdirSync(join(chronicleRoot, EPISODE), { recursive: true });
  writeFileSync(join(chronicleRoot, EPISODE, "episode.yaml"), "episode: 901\n");
  const registrations = [];
  const config = resolveConfig({}, {
    port: 8799, host: "127.0.0.1", takesDir: join(base, "takes"), driver: "file-import",
    publicBaseUrl: "https://gaia.example:8443", chronicleRoot, mwApiUrl: "http://wheel.invalid", language,
  });
  const service = new CaptureService({
    config,
    driver: new FileImportDriver(),
    joiner: new ConcatSegmentJoiner(),
    transcriber,
    registryClient: { register: async (record) => { registrations.push(record); return { success: true, id: record.id ?? "capture:stub" }; } },
  });
  const logged = [];
  const app = createApp({ service, chronicleRoot, uploadsDir: join(base, "uploads"), repliesDir: join(base, "replies"), listenerDir: join(base, "listeners"), voice, defaultEpisode: EPISODE, locate, recoverEveryMs: 0, log: (line) => logged.push(line), decisionsLedger: join(base, "decisions", "mia-return.jsonl") });
  const server = createServer(app);
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { base, chronicleRoot, url, registrations, logged, recover: (options) => app.recoverParts(options), close: () => server.close() };
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
      body: JSON.stringify({ episode: EPISODE, take: "260920235421", text: "🧠: **William**, it arrived.\n\n🌸: You can speak from the desk.", origin: { user: "mia", host: "gaia", cwd: "/srv", multiplexer: "tmux", session: "s", pane: "%1" } }) })).json();
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

test("a reply whose origin the voice layer would refuse is kept as text, flagged, and never sent to be voiced", async () => {
  const requests = [];
  const voice = { async render(request) { requests.push(request); return Buffer.from("ID3"); } };
  const b = await bridge({ transcriber: stubTranscriber, voice });
  try {
    // The origin a seat composed by hand on 2026-09-29.
    const posted = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "🧠: Ready.", origin: { host: "gaia", tmux: "some-session" } }) })).json();
    assert.equal(posted.success, true);
    assert.match(posted.unvoiced, /origin is missing user, cwd, multiplexer/);
    assert.match(posted.unvoiced, /mia-listen\.mjs reply/);
    const listed = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(listed.replies[0].text, "🧠: Ready.");
    assert.match(listed.replies[0].unvoiced, /cannot be voiced/);
    const refused = await fetch(`${b.url}/api/replies/${posted.id}/voice`, { method: "POST" });
    assert.equal(refused.status, 422);
    assert.equal((await fetch(`${b.url}/api/replies/${posted.id}/audio`)).status, 422);
    assert.equal(requests.length, 0, "the voice layer is not asked");
  } finally {
    b.close();
  }
});

// 2026-10-07: gaia rebooted, and the seat that wrote replies from %85 on 2026-10-03 was
// resumed in %19 of the same tmux session. %85 now belongs to another session.
const SELF = { host: "gaia", user: "mia" };
const WRITTEN = { user: "mia", host: "gaia", cwd: "/srv", multiplexer: "tmux", session: "episode-339-mia-companion", pane: "%85" };
const AFTER_REBOOT = [
  { session: "episode-339-mia-companion", pane: "%19" },
  { session: "miadi-swarmvault", pane: "%85" },
];
const BINDINGS = [
  { at: "2026-10-03T21:45:34.000Z", event: "session.start", session_id: "4ae4c17d", tmux: { session: "episode-339-mia-companion", pane_id: "%85" } },
  { at: "2026-10-07T14:20:00.000+00:00", event: "session.start", session_id: "other", tmux: { session: "miadi-swarmvault", pane_id: "%85" } },
  { at: "2026-10-07T14:26:53.000Z", event: "session.start", session_id: "4ae4c17d", tmux: { session: "episode-339-mia-companion", pane_id: "%19" } },
];

test("a reply whose pane a reboot renumbered follows its Claude session to the pane it was resumed in", () => {
  const at = "2026-10-03T23:04:46.000Z";
  const moved = followSeat(WRITTEN, { panes: AFTER_REBOOT, bindings: BINDINGS, self: SELF, at });
  assert.equal(moved.session, "episode-339-mia-companion");
  assert.equal(moved.pane, "%19");
  assert.equal(moved.occupantId, "4ae4c17d");
  assert.equal(moved.cwd, "/srv", "the rest of the origin is kept");
  // A reply that names its writer needs no search by pane.
  assert.equal(followSeat({ ...WRITTEN, occupantId: "4ae4c17d" }, { panes: AFTER_REBOOT, bindings: BINDINGS.slice(2), self: SELF, at }).pane, "%19");

  // Unchanged, so the voice layer gives its own reason:
  assert.equal(followSeat(WRITTEN, { panes: [{ session: "episode-339-mia-companion", pane: "%85" }], bindings: BINDINGS, self: SELF, at }), null, "the pane is still live");
  assert.equal(followSeat(WRITTEN, { panes: AFTER_REBOOT, bindings: [], self: SELF, at }), null, "no binding names the writer");
  const reused = { at: "2026-10-07T14:00:00Z", event: "session.start", session_id: "stranger", tmux: { session: "episode-339-mia-companion", pane_id: "%85" } };
  assert.equal(followSeat(WRITTEN, { panes: AFTER_REBOOT, bindings: [reused, BINDINGS[2]], self: SELF, at }), null,
    "whoever took that pane id after the reply was written is not its writer");
  assert.equal(followSeat(WRITTEN, { panes: AFTER_REBOOT, bindings: [...BINDINGS, { at: "2026-10-07T15:00:00Z", event: "session.end", session_id: "4ae4c17d", tmux: null }], self: SELF, at }), null, "the seat was closed");
  assert.equal(followSeat(WRITTEN, { panes: [{ session: "episode-339-mia-companion", pane: "%7" }], bindings: BINDINGS, self: SELF, at }), null, "the binding names a pane that is not live");
  assert.equal(followSeat(WRITTEN, { panes: AFTER_REBOOT, bindings: BINDINGS, self: { host: "ilex", user: "mia" }, at }), null, "another host's panes are not read here");
  assert.equal(followSeat(WRITTEN, { panes: null, bindings: BINDINGS, self: SELF, at }), null, "no tmux server answered");
});

test("a reply is voiced as it is posted, through the pane its seat is in now", async () => {
  const requests = [];
  const voice = { async render(request) { requests.push(request); return Buffer.from("ID3"); } };
  const locate = (origin, at) => followSeat(origin, { panes: AFTER_REBOOT, bindings: BINDINGS, self: SELF, at });
  const b = await bridge({ transcriber: stubTranscriber, voice, locate });
  try {
    const posted = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "🧠: Seminar, part three.", origin: WRITTEN }) })).json();
    assert.equal(posted.unvoiced, undefined);
    assert.equal(requests.length, 1, "voiced at post, before any tap");
    assert.equal(requests[0].origin.pane, "%19");
    const listed = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(listed.replies[0].audio, `api/replies/${posted.id}/audio`);
  } finally {
    b.close();
  }
});

test("a long reply is voiced in parts the engine can render inside the voice layer's budget, joined in order", async () => {
  // 2181 characters took Edge-TTS 133 s on 2026-10-07; the voice layer allows 120 s.
  const sentence = "The third field is the one where a relation is held across a restart. ";
  const text = `Seminar, part three of three.\n\n${sentence.repeat(18).trim()}\n\n${sentence.repeat(12).trim()}`;
  const parts = voiceParts(text);
  assert.ok(parts.length > 1);
  assert.ok(parts.every((part) => part.length <= 900), "every part fits the budget");
  assert.equal(parts.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "), "no word is lost or reordered");
  assert.deepEqual(voiceParts("Short reply."), ["Short reply."]);
  assert.equal(voiceParts("x".repeat(2000)).join(""), "x".repeat(2000), "a word longer than a part is still cut");

  const requests = [];
  const voice = { async render(request) { requests.push(request); return Buffer.from(`[${requests.length - 1}]`); } };
  const b = await bridge({ transcriber: stubTranscriber, voice });
  try {
    const posted = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: `🧠: ${text}`, origin: { ...WRITTEN, pane: "%1" } }) })).json();
    assert.equal(posted.unvoiced, undefined);
    assert.equal(requests.length, parts.length);
    const audio = await (await fetch(`${b.url}/api/replies/${posted.id}/audio`)).text();
    assert.equal(audio, parts.map((_, index) => `[${index}]`).join(""), "the parts play in the order they were written");
  } finally {
    b.close();
  }
});

test("a refusal from the voice layer reaches the seat that posted the reply", async () => {
  const voice = { async render() { throw new Error('session "s" is live but holds no pane %85'); } };
  const b = await bridge({ transcriber: stubTranscriber, voice });
  try {
    const posted = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "🧠: Ready.", origin: { ...WRITTEN, session: "s" } }) })).json();
    assert.equal(posted.success, true, "the text is kept");
    assert.match(posted.unvoiced, /the voice layer refused: session "s" is live but holds no pane %85/);
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

test("spoken English gives one English transcript, not two files fighting over _EN.txt", async () => {
  const calls = [];
  const inner = { name: "stub", async transcribe(_path, _name, options) {
    calls.push(options.language);
    return { transcription: "Mia, I am speaking English.", translation: "Mia, I'm speaking English.", model: "stub", language: options.language };
  } };
  const b = await bridge({ transcriber: new SpokenLanguageTranscriber(inner, "en"), language: "en" });
  try {
    const answer = await (await fetch(`${b.url}/api/takes`, { method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("bytes") })).json();
    assert.equal(answer.success, true, JSON.stringify(answer));
    assert.deepEqual(calls, ["en"]);
    assert.equal(answer.english, "Mia, I am speaking English.", "the English transcription, not a re-translation");
    const capture = JSON.parse(readFileSync(join(b.chronicleRoot, EPISODE, "captures", answer.take, "capture.json"), "utf8"));
    assert.deepEqual(capture.transcription.outputs.map((output) => output.language), ["en"]);
    const shown = execFileSync("node", [LISTENER, "show", answer.take, "--no-fetch", "--episode", join(b.chronicleRoot, EPISODE)], {
      encoding: "utf8", env: { ...process.env, MIADI_MIA_COMPANION_STATE_DIR: join(b.base, "listener") },
    });
    assert.match(shown, /Mia, I am speaking English\./);
  } finally {
    b.close();
  }
});

test("the page is told whether a seat is listening on the episode", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const listeners = join(b.base, "listeners");
    mkdirSync(listeners, { recursive: true });
    const beat = (at, pid) => writeFileSync(join(listeners, `${EPISODE}.listening.json`), JSON.stringify({ pid, at, since: at }));

    const quiet = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(quiet.listening, false, "no heartbeat means nobody is in the room");
    assert.equal(quiet.presence.state, "away");

    beat(new Date().toISOString(), process.pid);
    const heard = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(heard.listening, true);
    assert.equal(heard.presence.state, "listening");

    beat(new Date(Date.now() - 5 * 60 * 1000).toISOString(), process.pid);
    assert.equal(listenerState(listeners, EPISODE).state, "away", "a stale heartbeat is not a listener");

    beat(new Date().toISOString(), 2147480000);
    assert.equal(listenerState(listeners, EPISODE).state, "away", "a heartbeat from a dead process is not a listener");

    // await exits when it wakes, so its pid is gone while Mia answers. The room is not empty.
    const state = (fields) => writeFileSync(join(listeners, `${EPISODE}.listening.json`), JSON.stringify(fields));
    state({ state: "answering", takes: ["260929100901"], at: new Date(Date.now() - 6 * 60 * 1000).toISOString(), pid: 2147480000 });
    const answering = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(answering.listening, true, "a seat answering a take is in the room");
    assert.deepEqual(answering.presence, { state: "answering", takes: ["260929100901"], marks: [] });
    state({ state: "answering", takes: ["260929100901"], at: new Date(Date.now() - 16 * 60 * 1000).toISOString() });
    assert.equal(listenerState(listeners, EPISODE).state, "away", "an answer that never came ends after fifteen minutes");
    state({ state: "answered", takes: ["260929100901"], at: new Date().toISOString() });
    assert.equal(listenerState(listeners, EPISODE).state, "answered");
    state({ state: "answered", takes: ["260929100901"], at: new Date(Date.now() - 3 * 60 * 1000).toISOString() });
    assert.equal(listenerState(listeners, EPISODE).state, "away", "a seat that answered and never re-armed has left");

    // A seat woken by marks on the drawings says which, so a page can say "Mia is answering your mark".
    state({ state: "answering", takes: [], marks: ["m-0mvg4iw5pd4sg", "not a mark", 7, "m-2"], at: new Date().toISOString() });
    const marking = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    assert.deepEqual(marking.presence, { state: "answering", takes: [], marks: ["m-0mvg4iw5pd4sg", "m-2"] });
    state({ state: "answered", takes: [], marks: ["m-2"], at: new Date().toISOString() });
    assert.deepEqual(listenerState(listeners, EPISODE), { state: "answered", takes: [], marks: ["m-2"] });
    state({ state: "answered", takes: [], marks: ["m-2"], at: new Date(Date.now() - 3 * 60 * 1000).toISOString() });

    const stored = await (await fetch(`${b.url}/api/takes`, { method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("bytes") })).json();
    assert.equal(stored.listening, false, "the answer to a take says whether it will be heard");
    assert.equal(stored.presence.state, "away");
  } finally {
    b.close();
  }
});

// Episode 339, 2026-10-08: the page says when William records, and the seat that posts a
// reply then is told so; and the conversation is one thread of takes and replies.
test("while the page says William is recording, a reply posted then is told so, and the state lapses when he stops", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const recorder = (recording) => fetch(`${b.url}/api/recorder`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ episode: EPISODE, recording }) }).then((r) => r.json());
    const reply = () => fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ episode: EPISODE, text: "🧠: Ready." }) }).then((r) => r.json());
    assert.equal((await reply()).recording, undefined, "nobody records yet");
    assert.equal((await recorder(true)).recording, true);
    const state = await (await fetch(`${b.url}/api/recorder?episode=${EPISODE}`)).json();
    assert.equal(state.recording, true);
    assert.ok(state.since);
    assert.equal((await reply()).recording, true, "the seat is told he is recording");
    const listed = await (await fetch(`${b.url}/api/replies?episode=${EPISODE}`)).json();
    assert.equal(listed.recorder.recording, true, "the page reads it too");
    assert.equal((await recorder(false)).recording, false);
    assert.equal((await reply()).recording, undefined);
  } finally {
    b.close();
  }
});

test("the thread holds every take and reply of the episode in the order they happened", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const take = "261008071849";
    const folder = join(b.chronicleRoot, EPISODE, "captures", take);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "capture.json"), JSON.stringify({ storedAt: "2026-10-08T11:19:09.914Z" }));
    writeFileSync(join(folder, `transcription_${take}_EN.txt`), "These are good.\n");
    mkdirSync(join(b.chronicleRoot, EPISODE, "captures", "not-a-take"), { recursive: true });
    await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ episode: EPISODE, take, text: "🧠: Heard." }) });
    const answer = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    assert.equal(answer.success, true);
    assert.deepEqual(answer.items.map((item) => item.kind), ["take", "reply"]);
    assert.equal(answer.items[0].take, take);
    assert.equal(answer.items[0].text, "These are good.");
    assert.equal(answer.items[1].text, "🧠: Heard.");
    assert.equal(answer.items[1].origin, undefined, "the page never sees pane ids");
    assert.equal(answer.recorder.recording, false);
  } finally {
    b.close();
  }
});

// jgwill/jgtsrc#190, 2026-10-09: the trading chart records spoken notes for labelled
// examples through /api/takes, from another origin, and marks them as labelling notes.
test("the trading chart may post a labelling note; another origin may not", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const chart = "https://trading.tail3b11eb.ts.net";
    const pre = await fetch(`${b.url}/api/takes`, { method: "OPTIONS", headers: { origin: chart, "access-control-request-method": "POST" } });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get("access-control-allow-origin"), chart);
    assert.match(pre.headers.get("access-control-allow-headers") || "", /content-type/);
    const stranger = await fetch(`${b.url}/api/takes`, { method: "OPTIONS", headers: { origin: "https://elsewhere.example" } });
    assert.equal(stranger.status, 403);
    assert.equal(stranger.headers.get("access-control-allow-origin"), null);

    const posted = await fetch(`${b.url}/api/takes?episode=${EPISODE}&purpose=labelling`, {
      method: "POST", headers: { origin: chart, "content-type": "audio/mp4" }, body: Buffer.from("a spoken note"),
    });
    assert.equal(posted.headers.get("access-control-allow-origin"), chart);
    const answer = await posted.json();
    assert.equal(answer.success, true, JSON.stringify(answer));
    assert.equal(answer.purpose, "labelling");
    const purpose = JSON.parse(readFileSync(join(b.chronicleRoot, EPISODE, "captures", answer.take, "purpose.json"), "utf8"));
    assert.equal(purpose.purpose, "labelling");

    const unknown = await fetch(`${b.url}/api/takes?episode=${EPISODE}&purpose=gossip`, { method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("x") });
    assert.equal(unknown.status, 400);
  } finally {
    b.close();
  }
});

// William, Episode 120, 2026-10-12: a few minutes of recording were lost when the recorder
// failed at Stop. The page now sends what it captured every 10 seconds.
const part = (b, rec, offset, bytes) => fetch(`${b.url}/api/takes/part?episode=${EPISODE}&rec=${rec}&offset=${offset}`, {
  method: "POST", headers: { "content-type": "audio/mp4" }, body: bytes,
});

test("parts of a recording are appended in order; a resent part is ignored and a gap is answered with what gaia holds", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const rec = "rec-test-0001";
    assert.equal((await (await part(b, rec, 0, Buffer.from("aaaa"))).json()).bytes, 4);
    assert.equal((await (await part(b, rec, 0, Buffer.from("aaaa"))).json()).bytes, 4, "a resent part changes nothing");
    assert.equal((await (await part(b, rec, 2, Buffer.from("aabb"))).json()).bytes, 6, "an overlapping part keeps its new tail");
    const gap = await part(b, rec, 10, Buffer.from("cc"));
    assert.equal(gap.status, 409);
    assert.equal((await gap.json()).bytes, 6, "a gap is told where gaia's copy ends");
    assert.equal(readFileSync(join(b.base, "uploads", `rec-${rec}.part`), "utf8"), "aaaabb");
  } finally {
    b.close();
  }
});

test("a recording the phone never finishes becomes a take, and sending it later does not store it twice", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const rec = "rec-test-0002";
    await part(b, rec, 0, Buffer.from("not really aac, "));
    await part(b, rec, 16, Buffer.from("but it was said"));
    const diagnostic = await fetch(`${b.url}/api/takes/diagnostic`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ rec, episode: EPISODE, kind: "recorder-error", name: "UnknownError", seconds: 182 }),
    });
    assert.equal((await diagnostic.json()).held, 31);
    assert.ok(b.logged.some((line) => line.includes(rec) && line.includes("UnknownError")), "the page's account reaches the log");

    assert.equal((await b.recover()).length, 0, "a recording still growing is left alone");
    const recovered = await b.recover({ now: Date.now() + 10 * 60 * 1000 });
    assert.equal(recovered.length, 1);
    const take = recovered[0].take;
    assert.ok(existsSync(join(b.chronicleRoot, EPISODE, "captures", take, "capture.json")), "the recovered take is in the episode");
    assert.equal(existsSync(join(b.base, "uploads", `rec-${rec}.part`)), false, "the part is gone once it is a take");

    const again = await fetch(`${b.url}/api/takes?episode=${EPISODE}&rec=${rec}`, {
      method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("not really aac, but it was said"),
    });
    const answer = await again.json();
    assert.equal(answer.success, true);
    assert.equal(answer.take, take, "the page is answered with the take gaia already stored");
    assert.equal(answer.already, "recovered");
  } finally {
    b.close();
  }
});

test("a take sent whole closes its parts, so nothing is recovered from them later", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const rec = "rec-test-0003";
    await part(b, rec, 0, Buffer.from("partial"));
    const stored = await (await fetch(`${b.url}/api/takes?episode=${EPISODE}&rec=${rec}`, {
      method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("partial and the rest"),
    })).json();
    assert.equal(stored.success, true);
    assert.equal((await b.recover({ now: Date.now() + 10 * 60 * 1000 })).length, 0);
  } finally {
    b.close();
  }
});


// William, 2026-10-12: "we should have a thumbs up on the actual message that you send".
test("a thumb on a reply is kept with its text's hash, the latest one counts, and the thread shows it", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const posted = await (await fetch(`${b.url}/api/replies`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "The big test went through.", seat: "test", origin: { user: "mia", host: "gaia" } }),
    })).json();
    assert.equal(posted.success, true, JSON.stringify(posted));
    const id = posted.id;
    const thumb = (value) => fetch(`${b.url}/api/replies/${id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) });
    assert.equal((await (await thumb("down")).json()).value, "down");
    assert.equal((await (await thumb("up")).json()).value, "up");
    assert.equal((await thumb("maybe")).status, 400);
    const thread = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    assert.equal(thread.items.find((item) => item.id === id).feedback, "up");
    const kept = readFileSync(join(b.base, "replies", "feedback", `${EPISODE}.jsonl`), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(kept.length, 2);
    assert.match(kept[1].text_sha256, /^[0-9a-f]{64}$/);
    assert.equal((await thumb("")).status, 200, "a thumb can be taken back");
  } finally {
    b.close();
  }
});

// William, 2026-10-12: "when you relate to something very important they would be joined on
// the actual reply". Only labelled http(s) links are kept, at most six.
test("a reply carries the cards for what it names, cleaned, and the thread shows them", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const related = [
      { label: "Marks spec", href: "https://miadi.example/chronicle/ep?file=spec.md", kind: "file" },
      { label: "No scheme", href: "javascript:alert(1)", kind: "file" },
      { label: "", href: "https://example.com/unlabelled" },
      { label: "Review", href: "https://miadi-review-service.vercel.app/review/x", kind: "Not A Kind" },
    ];
    const { id } = await (await fetch(`${b.url}/api/replies`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "See the spec.", related, origin: { user: "mia", host: "gaia" } }),
    })).json();
    const thread = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    const shown = thread.items.find((item) => item.id === id).related;
    assert.deepEqual(shown, [
      { label: "Marks spec", href: "https://miadi.example/chronicle/ep?file=spec.md", kind: "file" },
      { label: "Review", href: "https://miadi-review-service.vercel.app/review/x", kind: "link" },
    ]);
  } finally {
    b.close();
  }
});

// William, 2026-10-12: "a thumbs up could reinforce the loop". The reply keeps the loop that
// made it, and a thumb becomes a ruling on its Jev run, in lane-check's shape.
test("a thumb on a reply that carries its loop is written as a ruling on that Jev run", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const loop = { jev_record: "51f54c36-a03d-448a-86b1-d8fb8be122a0", run_id: "run-1", decider: "jev-1.13.0",
      flags: ["asks_answered"], revised_after_check: true, facts: ["committed 488fa03"], extra: "dropped" };
    const { id } = await (await fetch(`${b.url}/api/replies`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, take: "261012155615", text: "The loop is kept.", loop, origin: { user: "mia", host: "gaia" } }),
    })).json();
    const stored = readFileSync(join(b.base, "replies", `${EPISODE}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l)).find((r) => r.id === id);
    assert.equal(stored.loop.jev_record, loop.jev_record);
    assert.equal(stored.loop.extra, undefined, "only the loop's known fields are kept");
    const answer = await (await fetch(`${b.url}/api/replies/${id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "up" }) })).json();
    assert.equal(answer.ruling, `rul-${loop.jev_record}`);
    await fetch(`${b.url}/api/replies/${id}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value: "" }) });
    const rulings = readFileSync(join(b.base, "decisions", "mia-return.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(rulings.length, 1, "taking a thumb back writes no ruling");
    assert.deepEqual({ kind: rulings[0].kind, decision_id: rulings[0].decision_id, verdict: rulings[0].verdict, source: rulings[0].source },
      { kind: "ruling", decision_id: loop.jev_record, verdict: "ready", source: "thumb" });
  } finally {
    b.close();
  }
});


// smcraft Spec 84: a reply that walks William through diagrams on his canvas. Each step is
// voiced on its own, so the canvas plays a step's words while that step is lit.
test("a reply with steps is voiced step by step, joined in order, and the thread carries each step's audio", async () => {
  const requests = [];
  const voice = { async render(request) { requests.push(request.text); return Buffer.from(`<${request.text.slice(0, 5)}>`); } };
  const b = await bridge({ transcriber: stubTranscriber, voice });
  try {
    const steps = [
      { say: "🧠: This is where the count starts.", doc: "/srv/ep/diagrams/wave.smdf.json", spotlight: ["state:Reading", "Reading", 7], title: "Start" },
      { say: "And here it waits for the chart.", focus: "message:9", region: { x: 0, y: 0, width: 10, height: -1 } },
      { say: "", focus: "state:Dropped" },
    ];
    const posted = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, take: "260920235421", steps, origin: { ...WRITTEN, pane: "%1" } }) })).json();
    assert.equal(posted.success, true, JSON.stringify(posted));
    assert.equal(posted.steps, 2, "a step that says nothing is dropped");
    assert.deepEqual(requests, ["This is where the count starts.", "And here it waits for the chart."]);

    const thread = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    const reply = thread.items.find((item) => item.kind === "reply");
    assert.equal(reply.text, "🧠: This is where the count starts.\n\nAnd here it waits for the chart.", "a reply of steps reads as their words");
    assert.equal(reply.steps.length, 2);
    assert.deepEqual(reply.steps[0].spotlight, ["state:Reading"], "only element names survive");
    assert.equal(reply.steps[0].doc, "/srv/ep/diagrams/wave.smdf.json");
    assert.equal(reply.steps[1].region, undefined, "a region with no size is dropped");
    assert.equal(reply.steps[1].audio, `api/replies/${posted.id}/steps/1/audio`);

    assert.equal(await (await fetch(`${b.url}/${reply.steps[0].audio}`)).text(), "<This >");
    assert.equal(await (await fetch(`${b.url}/${reply.steps[1].audio}`)).text(), "<And h>");
    assert.equal(await (await fetch(`${b.url}/${reply.audio}`)).text(), "<This ><And h>", "the whole reply is the steps in order");
    const ranged = await fetch(`${b.url}/${reply.steps[1].audio}`, { headers: { range: "bytes=0-1" } });
    assert.equal(ranged.status, 206);
    assert.equal((await fetch(`${b.url}/api/replies/${posted.id}/steps/5/audio`)).status, 404);
  } finally {
    b.close();
  }
});

test("steps and a canvas context are cleaned before they are kept", () => {
  assert.deepEqual(cleanSteps("nope"), []);
  assert.deepEqual(cleanSteps([{ say: " x ", doc: "relative.json", system: "/a/b.smdf.json", focus: "bogus" }]), [{ say: "x" }]);
  assert.equal(cleanSteps(Array.from({ length: 40 }, () => ({ say: "s" }))).length, 24);
  assert.equal(cleanContext(""), null);
  assert.deepEqual(cleanContext('{"doc":"/d/w.smdf.json","focus":"state:A","marks":["m-1",2],"secret":{"x":1}}'), { doc: "/d/w.smdf.json", focus: "state:A", marks: ["m-1"] });
  assert.throws(() => cleanContext("{not json"), /not JSON/);
  assert.throws(() => cleanContext(JSON.stringify({ doc: "x".repeat(5000) })), /limited/);
});

test("a take recorded on a canvas keeps what the canvas showed, whole or recovered from its parts", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const context = encodeURIComponent(JSON.stringify({ stage: "default", doc: "/srv/ep/diagrams/wave.smdf.json", kind: "machine", focus: "state:Reading", marks: ["m-1"] }));
    const posted = await (await fetch(`${b.url}/api/takes?episode=${EPISODE}&context=${context}`, {
      method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("spoken at the canvas"),
    })).json();
    assert.equal(posted.success, true, JSON.stringify(posted));
    assert.equal(posted.canvas, true);
    const kept = JSON.parse(readFileSync(join(b.chronicleRoot, EPISODE, "captures", posted.take, "canvas.json"), "utf8"));
    assert.equal(kept.focus, "state:Reading");
    assert.deepEqual(kept.marks, ["m-1"]);
    const thread = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    assert.deepEqual(thread.items.find((item) => item.take === posted.take).canvas, { doc: "/srv/ep/diagrams/wave.smdf.json", kind: "machine", focus: "state:Reading" });

    // A canvas recording that never finishes still carries its context into the take.
    const rec = "canvas-rec-0001";
    await fetch(`${b.url}/api/takes/part?episode=${EPISODE}&rec=${rec}&offset=0&context=${context}`, { method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("first ten seconds") });
    const recovered = await b.recover({ now: Date.now() + 10 * 60 * 1000 });
    assert.equal(recovered.length, 1);
    assert.ok(existsSync(join(b.chronicleRoot, EPISODE, "captures", recovered[0].take, "canvas.json")));

    const bad = await fetch(`${b.url}/api/takes?episode=${EPISODE}&context=%7Bnope`, { method: "POST", headers: { "content-type": "audio/mp4" }, body: Buffer.from("x") });
    assert.equal(bad.status, 400);
  } finally {
    b.close();
  }
});

test("an allowed origin may read the conversation; a reply is still posted from this host only", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const chart = "https://trading.tail3b11eb.ts.net";
    const read = await fetch(`${b.url}/api/thread?episode=${EPISODE}`, { headers: { origin: chart } });
    assert.equal(read.headers.get("access-control-allow-origin"), chart);
    const pre = await fetch(`${b.url}/api/recorder`, { method: "OPTIONS", headers: { origin: chart, "access-control-request-method": "POST" } });
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get("access-control-allow-methods") || "", /GET/);
    const forwarded = await fetch(`${b.url}/api/replies`, { method: "POST", headers: { origin: chart, "content-type": "application/json", "x-forwarded-for": "100.1.2.3" }, body: JSON.stringify({ episode: EPISODE, text: "x" }) });
    assert.equal(forwarded.status, 403);
  } finally {
    b.close();
  }
});

// Review R3, 2026-10-20: a reply that answers a mark on a drawing says which, so the
// companion thread and the mark's thread are one conversation.
test("a reply answering a mark keeps the mark, cleaned, and says whether it was voiced", async () => {
  const requests = [];
  const voice = { async render(request) { requests.push(request.text); return Buffer.from("ID3"); } };
  const b = await bridge({ transcriber: stubTranscriber, voice });
  try {
    const doc = "/srv/ep/diagrams/screenwalk.smdf.json";
    const post = (body) => fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, origin: { ...WRITTEN, pane: "%1" }, ...body }) }).then((r) => r.json());
    const answered = await post({ text: "Yes, I answer here now.", mark: { id: "m-0mvg4iw5pd4sg", doc, extra: "dropped" },
      steps: [{ say: "Yes, I answer here now.", doc, spotlight: ["state:Witnessing"] }] });
    assert.equal(answered.success, true, JSON.stringify(answered));
    assert.equal(answered.voiced, true, "voiced at post");
    assert.deepEqual(answered.mark, { id: "m-0mvg4iw5pd4sg", doc });
    const thread = await (await fetch(`${b.url}/api/thread?episode=${EPISODE}`)).json();
    const shown = thread.items.find((item) => item.id === answered.id);
    assert.deepEqual(shown.mark, { id: "m-0mvg4iw5pd4sg", doc }, "the thread says which mark it answers");
    assert.equal(shown.steps[0].audio, `api/replies/${answered.id}/steps/0/audio`);

    for (const mark of [{ id: "M-1", doc }, { id: "m-1", doc: "relative.json" }, { id: "m-1", doc: "/srv/x.md" }, { id: `m-${"a".repeat(80)}`, doc }, "m-1"]) {
      const kept = await post({ text: "Plain.", mark });
      assert.equal(kept.mark, undefined, JSON.stringify(mark));
    }
    assert.equal(cleanMark({ id: "m-1", doc: `/${"d".repeat(600)}.json` }), null, "a path past the cap is dropped");
    assert.equal(thread.items.filter((item) => item.mark).length, 1);
  } finally {
    b.close();
  }
});

test("without a voice layer the post says the reply is not voiced, and why", async () => {
  const b = await bridge({ transcriber: stubTranscriber });
  try {
    const posted = await (await fetch(`${b.url}/api/replies`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ episode: EPISODE, text: "Ready.", origin: { ...WRITTEN, pane: "%1" } }) })).json();
    assert.equal(posted.voiced, false);
    assert.match(posted.unvoiced, /voice layer is not configured/);
  } finally {
    b.close();
  }
});
