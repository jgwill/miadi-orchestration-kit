# miadi-stateloom

A Claude Code plugin that gives a session the **stateloom** design loom — its MCP server and
the skills that use it — in one install, instead of skills installed one by one and an MCP
server registered by hand. Canonical source: jgwill/smcraft. Specs: `rispecs/80-erdf-format.spec.md`,
`81-sqdf-format.spec.md`, `82-sysdf-system.spec.md`, `83-stage-and-marks.spec.md` there.

## What is here

```
.claude-plugin/plugin.json
.mcp.json                 the stateloom MCP server, from npm (@miadi/stateloom-mcp, pinned)
skills/                   copies of jgwill/smcraft skills/ — see skills/README.md
  stateloom-design        state machines (.smdf.json)
  stateloom-erd           the data beside them (.erdf.json)
  stateloom-sequence      usage scenarios (.sqdf.json)
  stateloom-system        the drawings as one system (.sysdf.json): checks, replay, reconcile, show
  stateloom-stage         show the work on the canvas (steps, tours) and read the person's marks
  stateloom-live-loop     the live canvas and hub
  stateloom-render        drawings out as text, vector, raster
  stateloom-rispec        a RISE rispec from a machine or a system
  stateloom-codegen       generated code from a machine
commands/system-open.md   open a system on the canvas and point at an element
commands/system-check.md  check a system; report only what needs attention
commands/stage-present.md prepare a walkthrough of a design and play it on the canvas
commands/stage-listen.md  listen for the person's marks and answer each in its thread
agents/tour-editor.md     one-pass editor for a tour's steps before it is played
```

The host skills — `stateloom-setup`, `stateloom-docker`, `stateloom-service`,
`stateloom-tailnet` — are for whoever keeps a host running the loom, and stay in
`@miadi/stateloom-skills` (`npx @miadi/stateloom-skills skills install <name>`).

## The skills are copies

jgwill/smcraft is canonical. `node scripts/sync-kit-plugin.mjs` in smcraft copies the design
skills here and moves the MCP pin to the version it just released; `--check` reports drift
without writing. An edit made here is overwritten by the next sync.

## The MCP server

Loading the plugin starts one stdio server from npm, so a host needs `npx` and nothing else:

| server | package |
|---|---|
| `stateloom` | `${STATELOOM_MCP:-@miadi/stateloom-mcp@<pin>}` |

Tools arrive under the plugin prefix, e.g. `mcp__plugin_miadi-stateloom_stateloom__check_system`.
Where MCP tools are deferred, load them with ToolSearch first. Servers start with the session;
a new pin needs a new session.

Environment it reads (all optional):

| variable | default | what |
|---|---|---|
| `STATELOOM_PROJECT_FILE` | none | the document the session starts on |
| `STATELOOM_BRIDGE_URL` | `http://127.0.0.1:4599` | the hub, for live canvases |
| `STATELOOM_BRIDGE_TOKEN` | none | the hub's token, when it has one |
| `STATELOOM_CANVAS_URL` | none | the canvas the tools link to |
| `STATELOOM_AGENT_NAME` | none | the name the canvas shows for this agent, on captions and marks |
| `STATELOOM_STAGE` | `default` | the stage this agent presents on; the canvas joins the same one (`?stage=`) |
| `STATELOOM_RECONCILE` | none | `auto` or `propose` for this session, over the system's own mode |
| `MIADI_CHRONICLE_ROOT` | none | resolves `miadi-chronicle://<episode>/<drawing>` addresses |

Without a hub the tools still work on files; only the live canvas is missing. A hub that is
configured and unreachable is said in the tool result, never silently skipped.

## The stage: showing the work, hearing the pointing

The stage tools (`show_step`, `write_tour`, `play_tour`, `stage_control`, `read_marks`,
`await_marks`, `answer_mark`, `add_mark`, `what_is_on_screen`) arrive with
`@miadi/stateloom-mcp` **0.4.0**. Until the pin above moves to it (after it is published), a host
that has jgwill/smcraft checked out gets them now:

```bash
export STATELOOM_MCP=/workspace/repos/jgwill/smcraft/mcp   # built: (cd mcp && npm ci && npm run build)
```

`/stage-present` drafts a tour of a design, sends it once to the `tour-editor` agent, revises,
writes it and plays it on the canvas. `/stage-listen` runs `smcx marks await` in the background
and answers each mark the person makes in its thread — the episode companion's listening loop,
for marks on a diagram instead of a spoken take. The companion's own wake (`mia-listen`) also
says what is on the canvas and which marks wait, when `STATELOOM_BRIDGE_URL` is set in its seat.

## The mode that matters most

A system's `settings.reconcile` is `propose` (default) or `auto`. In `auto`, every sequence
edit an agent makes also updates the machines, the ERD and the actors it implies, and the
tool answers in one line. Guillaume, 2026-09-30: "you need not to bore the user with a bunch
of things he needs to approve and validate."

Anchor issue: jgwill/miadi-orchestration-kit#67. Canonical source: jgwill/smcraft (specs 80–83, jgwill/smcraft#28).
