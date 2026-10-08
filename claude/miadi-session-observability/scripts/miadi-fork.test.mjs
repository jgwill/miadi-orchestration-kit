import { test } from "node:test";
import assert from "node:assert/strict";
import { flagSource, forkName, latestBindings, parentFlags, planAsk, planOpen, resolveSession, withPlugins } from "./miadi-fork.mjs";

const lines = [
  { at: "2026-10-08T09:00:00Z", event: "session.start", source: "startup", session_id: "76e7c574-8218-4da9-948d-1adb24e2f7ce", cwd: "/srv/ep140", name: { name: "mia-trading" }, tmux: { session: "mia-trading-disc" }, team: { id: "unassigned" }, episode: { id: "2026-07-16-episode-140-laskmi-placefolder" },
    argv: ["claude", "--mcp-config", "/a.json", "/b.json", "--plugin-dir", "/kit/claude/mia-episode-companion", "--dangerously-skip-permissions", "--resume", "76e7c574-8218-4da9-948d-1adb24e2f7ce"] },
  { at: "2026-10-08T10:00:00Z", event: "session.rename", session_id: "76e7c574-8218-4da9-948d-1adb24e2f7ce", cwd: "/srv/ep140", name: { name: "mia-trading-renamed" }, tmux: { session: "mia-trading-disc" } },
  { at: "2026-10-08T11:00:00Z", event: "session.start", source: "fork", session_id: "aaaaaaaa-0000-4000-8000-000000000001", cwd: "/srv/ep140",
    argv: ["claude", "-p", "--resume", "76e7c574-8218-4da9-948d-1adb24e2f7ce", "--fork-session", "--session-id", "aaaaaaaa-0000-4000-8000-000000000001", "--tools", "", "--strict-mcp-config", "how did your closing come to be?"] },
].map((l) => JSON.stringify(l)).join("\n");

const byId = latestBindings(lines);
const parent = byId.get("76e7c574-8218-4da9-948d-1adb24e2f7ce");

test("a session resolves by id, prefix, tmux session and every name it carried", () => {
  for (const ref of ["76e7c574-8218-4da9-948d-1adb24e2f7ce", "76e7c574", "mia-trading-disc", "mia-trading", "mia-trading-renamed"]) {
    assert.equal(resolveSession(byId, ref).session_id, parent.session_id, ref);
  }
  assert.throws(() => resolveSession(byId, "nobody"), /no session/);
});

test("the latest line wins but the folder and command line of the start line stay", () => {
  assert.equal(parent.cwd, "/srv/ep140");
  assert.ok(parent.argv.includes("--dangerously-skip-permissions"));
});

test("a branch keeps the parent's flags and drops what made the parent a resume or a headless ask", () => {
  assert.deepEqual(parentFlags(parent.argv), ["--mcp-config", "/a.json", "/b.json", "--plugin-dir", "/kit/claude/mia-episode-companion", "--dangerously-skip-permissions"]);
  assert.deepEqual(parentFlags(byId.get("aaaaaaaa-0000-4000-8000-000000000001").argv), []);
});

test("an added plugin is a kit name or a path, and never doubled", () => {
  const flags = withPlugins(["--plugin-dir", "/kit/claude/mia-episode-companion/"], ["mia-episode-companion", "miadi-witness", "/x/y"], "/kit");
  assert.deepEqual(flags, ["--plugin-dir", "/kit/claude/mia-episode-companion/", "--plugin-dir", "/kit/claude/miadi-witness", "--plugin-dir", "/x/y"]);
});

test("a fork name starts with its episode, has no colon, and numbers forks per day", () => {
  const date = new Date(2026, 9, 8);
  assert.equal(forkName({ episode: "140", topic: "Screenwalk closing!", existing: [], date }), "ep140-261008-fork-01-screenwalk-closing");
  assert.equal(forkName({ episode: null, topic: "x", existing: ["ep551-261008-fork-04-a"], date }), "261008-fork-05-x");
});

test("ask runs headless in the parent's folder with no tools and no MCP servers", () => {
  const plan = planAsk(parent, "why?", { id: "bbbbbbbb-0000-4000-8000-000000000002" });
  assert.equal(plan.cwd, "/srv/ep140");
  assert.deepEqual(plan.args, ["-p", "--resume", parent.session_id, "--fork-session", "--session-id", "bbbbbbbb-0000-4000-8000-000000000002", "--tools", "", "--strict-mcp-config", "why?"]);
});

test("open forks into a named tmux session in the parent's folder with its plugins", () => {
  const plan = planOpen(parent, { topic: "closing", id: "cccccccc-0000-4000-8000-000000000003", date: new Date(2026, 9, 8), addPlugins: ["miadi-witness"], kitRoot: "/kit" });
  assert.equal(plan.name, "ep140-261008-fork-01-closing");
  assert.match(plan.launch, /^claude --mcp-config \/a\.json \/b\.json --plugin-dir \/kit\/claude\/mia-episode-companion --dangerously-skip-permissions --plugin-dir \/kit\/claude\/miadi-witness --resume 76e7c574-\S+ --fork-session --session-id cccccccc-\S+ -n ep140-261008-fork-01-closing$/);
  assert.deepEqual(plan.commands[0], ["tmux", "new-session", "-d", "-s", "ep140-261008-fork-01-closing", "-c", "/srv/ep140"]);
  assert.equal(plan.team, null);
});

test("opening an ask branch again takes the flags of the session it was asked from", () => {
  const asked = byId.get("aaaaaaaa-0000-4000-8000-000000000001");
  const source = flagSource(byId, [{ mode: "ask", parent: parent.session_id, fork: asked.session_id }], asked);
  const plan = planOpen(asked, { same: true, flagsFrom: source, date: new Date(2026, 9, 8) });
  assert.match(plan.launch, /--plugin-dir \/kit\/claude\/mia-episode-companion .*--resume aaaaaaaa-\S+ -n /);
  assert.doesNotMatch(plan.launch, /--tools|--strict-mcp-config| -p /);
});

test("the production episode every shell exports does not name a branch; a folder or --episode does", () => {
  const here = { ...parent, episode: { id: "2026-06-28-episode-103-film-preprod-report-phase-2", source: "declared" } };
  const date = new Date(2026, 9, 8);
  assert.equal(planOpen(here, { topic: "x", date }).name, "261008-fork-01-x");
  assert.equal(planOpen(here, { topic: "x", date, episode: "551" }).name, "ep551-261008-fork-01-x");
  assert.ok(!planOpen(here, { topic: "x", date }).commands.some((c) => c.includes("@miadi-episode")));
});
