// The page's recorder, run headlessly against a small DOM stub. The bugs these cover were
// live on William's iPhone: a double tap started two recorders and left a clock running
// after Stop, and a failed upload threw the recording away.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const HTML = readFileSync(fileURLToPath(new URL("../public/index.html", import.meta.url)), "utf8");
const SCRIPT = HTML.split("<script>")[1].split("</script>")[0];
const EPISODE = "2026-09-22-episode-900-page-fixture";

function element(id) {
  const handlers = {};
  return {
    id, value: "",
    set textContent(v) { this._text = v; if (v === "") { this.appended = []; this.value = ""; } },
    get textContent() { return this._text ?? ""; }, checked: false, disabled: false, hidden: false, innerHTML: "",
    options: [{ textContent: "Episode 900" }], selectedIndex: 0, attributes: {},
    classList: { toggle() {}, add() {}, remove() {} },
    style: {},
    appended: [],
    addEventListener(name, fn) { (handlers[name] ||= []).push(fn); },
    fire(name, event) { return Promise.all((handlers[name] || []).map((fn) => fn(event))); },
    // Like a real <select>: the selected option sets the value, else the first one does.
    appendChild(child) {
      this.appended.push(child);
      if (child.selected || this.appended.length === 1) this.value = child.value;
    },
    removeAttribute(name) { delete this.attributes[name]; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    set src(value) { this.attributes.src = value; }, get src() { return this.attributes.src; },
    play() { this.played = (this.played || 0) + 1; return Promise.resolve(); },
    pause() {},
  };
}

function harness({ search = "?episode=" + EPISODE, micDelay = 0, takeAnswer = { success: true, take: "260922090000", english: "Heard." }, takeStatus = 200, neverStop = false } = {}) {
  const ids = ["episode", "filter", "matches", "record", "timer", "status", "result", "resultHead", "transcript",
    "reply", "replyMeta", "replyText", "replyAudio", "hearReply", "copyReply", "replyStatus", "autoplay"];
  const elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const made = [];
  const stoppedTracks = { count: 0 };
  const store = new Map();
  const calls = [];

  class FakeRecorder {
    constructor(stream, options) {
      this.stream = stream; this.mimeType = options.mimeType; this.state = "inactive";
      made.push(this);
    }
    start() {
      this.state = "recording";
      setTimeout(() => this.ondataavailable?.({ data: { size: 1024 } }), 1);
    }
    stop() {
      this.state = "inactive";
      if (!neverStop) setTimeout(() => this.onstop?.(), 1);
    }
  }

  const episodeList = [{ path: EPISODE, number: 900 }, { path: "2026-06-10-episode-044-teaching-academic-foundations-of-miaco", number: 44 }];
  const fetchStub = async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith("api/episodes")) {
      return { json: async () => ({ success: true, defaultEpisode: EPISODE, episodes: episodeList }) };
    }
    if (url.startsWith("api/replies")) return { json: async () => ({ success: true, replies: [] }) };
    if (url.startsWith("api/takes")) {
      if (takeStatus !== 200) throw new Error("network down");
      return { status: takeStatus, json: async () => takeAnswer };
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const context = {
    document: {
      getElementById: (id) => elements[id],
      addEventListener() {},
      visibilityState: "visible",
      body: { appendChild() {}, },
      createElement: () => element("created"),
      createTextNode: (text) => ({ text }),
      execCommand() {},
    },
    window: { addEventListener() {} },
    navigator: {
      mediaDevices: { getUserMedia: () => new Promise((done) => setTimeout(() => done({ getTracks: () => [{ stop() { stoppedTracks.count += 1; } }] }), micDelay)) },
      clipboard: { writeText: async () => {} },
    },
    fetch: fetchStub,
    MediaRecorder: Object.assign(FakeRecorder, { isTypeSupported: () => true }),
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    history: { replaceState() {} },
    // Unreferenced, so the page's own 10s reply poll cannot hold the test process open.
    setInterval: (fn, ms) => { const handle = setInterval(fn, ms); handle.unref?.(); return handle; },
    clearInterval: (handle) => clearInterval(handle),
    setTimeout: (fn, ms) => { const handle = setTimeout(fn, ms); handle.unref?.(); return handle; },
    location: { search },
  };
  const run = new Function(...Object.keys(context), SCRIPT);
  run(...Object.values(context));
  return { elements, made, stoppedTracks, calls, tap: () => elements.record.fire("click") };
}

const settle = (ms = 30) => new Promise((done) => setTimeout(done, ms));

test("two taps during the microphone prompt start one recorder, and Stop ends the clock", async () => {
  const h = harness({ micDelay: 40 });
  await settle(10);
  h.tap();
  h.tap();
  h.tap();
  await settle(120);
  assert.equal(h.made.length, 1, "one recorder, whatever the tapping");
  assert.equal(h.elements.record.textContent, "Stop & send");

  h.tap();
  await settle(120);
  const afterStop = h.elements.timer.textContent;
  await settle(700);
  assert.equal(h.elements.timer.textContent, afterStop, "no clock is left running after Stop");
  assert.equal(h.stoppedTracks.count, 1, "the microphone is released");
  assert.equal(h.elements.record.textContent, "Record");
  assert.equal(h.calls.filter((c) => c.url.startsWith("api/takes")).length, 1, "one take is sent");
});

test("a failed upload keeps the recording and offers to send it again", async () => {
  const h = harness({ takeStatus: 500 });
  await settle(10);
  h.tap();
  await settle(60);
  h.tap();
  await settle(120);
  assert.equal(h.elements.record.textContent, "Send again");
  assert.match(h.elements.status.textContent, /Your recording is kept/);

  h.calls.length = 0;
  h.elements.record.fire("click");
  await settle(120);
  assert.equal(h.calls.filter((c) => c.url.startsWith("api/takes")).length, 1, "the same recording is sent again");
  assert.equal(h.made.length, 1, "retrying does not open the microphone again");
});

test("a recorder that never reports stopped does not hang the page", async () => {
  const h = harness({ neverStop: true });
  await settle(10);
  h.tap();
  await settle(60);
  h.tap();
  await settle(3400);
  assert.equal(h.elements.record.textContent, "Record", "the page came back on its own");
  assert.equal(h.calls.filter((c) => c.url.startsWith("api/takes")).length, 1);
  assert.equal(h.stoppedTracks.count, 1);
});

test("the link decides the reading: ?play=0 turns auto-play off, ?play=1 turns it on", async () => {
  const off = harness({ search: "?episode=" + EPISODE + "&play=0" });
  await settle(30);
  assert.equal(off.elements.autoplay.checked, false);

  const on = harness({ search: "?episode=" + EPISODE + "&play=1" });
  await settle(30);
  assert.equal(on.elements.autoplay.checked, true);

  const plain = harness();
  await settle(30);
  assert.equal(plain.elements.autoplay.checked, true, "on by default when the link says nothing");
});

test("typing 044 lists the episode as a tappable row, and tapping it selects it", async () => {
  const h = harness({ search: "" });
  await settle(30);
  assert.equal(h.elements.episode.value, "");
  h.elements.filter.value = "044";
  await h.elements.filter.fire("input");
  const rows = h.elements.matches.appended;
  assert.equal(rows.length, 1, "the match is shown under the field");
  assert.match(rows[0].textContent, /Episode 44 · teaching/);
  assert.equal(h.elements.matches.hidden, false);

  await rows[0].fire("click");
  await settle(30);
  assert.equal(h.elements.episode.value, "2026-06-10-episode-044-teaching-academic-foundations-of-miaco");
  assert.equal(h.elements.filter.value, "", "the filter clears once an episode is picked");
  assert.equal(h.elements.record.disabled, false, "Record is ready");
});

test("every episode is listed, and the filter finds an old one by number", async () => {
  const h = harness();
  await settle(30);
  assert.equal(h.elements.episode.appended.length, 2, "both episodes are offered, not a capped slice");
  h.elements.filter.value = "44";
  await h.elements.filter.fire("input");
  assert.deepEqual(h.elements.episode.appended.map((o) => o.value), ["2026-06-10-episode-044-teaching-academic-foundations-of-miaco"]);
});

test("a link with no episode chooses none: William picks before anything records", async () => {
  const h = harness({ search: "" });
  await settle(30);
  assert.equal(h.elements.episode.value, "", "nothing is preselected");
  assert.equal(h.elements.record.disabled, true, "Record waits for a choice");
  assert.match(h.elements.status.textContent, /Choose the episode/);
  h.tap();
  await settle(60);
  assert.equal(h.made.length, 0, "a tap without an episode records nothing");
});
