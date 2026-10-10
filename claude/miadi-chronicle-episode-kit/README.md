# miadi-chronicle-episode-kit

A Claude Code plugin that carries the Chronicle skill, the chronicle's three MCP servers, and one
hook that refuses the move that breaks episodes. Anchor issues: jgwill/miadi-orchestration-kit#41,
jgwill/miadi-orchestration-kit#64 (MCP).

## What is here

```
.claude-plugin/plugin.json
.mcp.json                                                       (inquiry-weave, miadi-voice, medicine-wheel-miadi-chronicle)
skills/chronicle-episode -> ../../../skills/chronicle-episode   (symlink, not a copy)
hooks/hooks.json
hooks/guard-mkdir-in-chronicle.sh
hooks/selftest.sh
commands/mint-episode.md
commands/episode-status.md
```

## One skill, linked — not three, not copied

The skill body lives once, at the kit root: `$MIADI_ORCHESTRATION_KIT_ROOT/skills/chronicle-episode`.
Every harness reads that one directory. This plugin reaches it through a **relative** symlink,
so the link survives a clone to any path on any host.

`claude plugin validate` reports this as a warning and says why, verbatim (measured on
Claude Code 2.1.261, 2026-09-04):

> 1 entry here is a symlink and was not read — components are read without following
> symlinks. **A session loading this plugin does follow them**, so validate the real paths
> separately.

So the runtime follows it and the validator does not. Two consequences:

- Validate the skill body separately: `claude plugin validate "$MIADI_ORCHESTRATION_KIT_ROOT/skills"`.
- Do **not** put `--strict` on this plugin in CI without accepting that warning — `--strict`
  turns it into a failure (measured: exit 1).

## The MCP servers

Loading the plugin starts three stdio servers from the npm registry, so a host needs no Miadi
checkout, only `npx`:

| server | package | what it does |
|---|---|---|
| `inquiry-weave` | `${MIADI_INQUIRY_WEAVE_MCP:-@miadi/inquiry-weave@0.16.6}` | the episode verbs: `chronicle_episode_mint`, `_status`, `_land`, `_review`, `_foundation` (hold a foundation packet, jgwill/Miadi#713), `_lineage` (relate two episodes with the sentence saying why), `_inquiry`, `_register`, `chronicle_resolve` (also `miadi-foundation:`), the attention tools |
| `miadi-voice` | `${MIADI_VOICE_MCP:-@miadi/voice-mcp@0.4.5}` | an episode's voice: `voice_resolve_episode`, `voice_publish_to_episode`, `voice_play_episode`, `voice_list_episode_voices`, `voice_create_episode`, `voice_episode_closing_status`. The only sanctioned voice path (the `miadi-voice` skill). 0.4.4 is the first version whose bin starts under npx (jgwill/Miadi#704). |
| `medicine-wheel-miadi-chronicle` | `${MWCV:-@medicine-wheel/mcp@4.17.5}` | the chronicle wheel itself: nodes, edges (`create_relational_edge` takes a `description`), ceremonies, circles |

`inquiry-weave` runs with `MIADI_EPISODE_DOOR=http`: every episode write goes through the app at
`MIADI_API_URL`, the same door the episode page uses, so manifest, wheel and commit move together.
Relate episodes with `chronicle_episode_lineage`, not the wheel server's `create_relational_edge`,
which writes the wheel alone and leaves `episode.yaml` behind.

Tools arrive under the plugin prefix, e.g.
`mcp__plugin_miadi-chronicle-episode-kit_inquiry-weave__chronicle_episode_lineage`. Where MCP tools
are deferred, load them with ToolSearch first. Servers start with the session; a version change
needs a new session.

Proved 2026-09-30 from a scratch directory: `claude --plugin-dir … mcp list` shows all three
`plugin:miadi-chronicle-episode-kit:*` servers connected, and a headless session loading only this
plugin called `chronicle_episode_status` for episode 40 through the app (`capabilities.mint: true`).
A server that failed once (e.g. `npx` answering `ETARGET` before a fresh publish is visible) is
skipped for 15 minutes by Claude Code; editing the plugin config retries it sooner.

Maintenance (moving a pin, adding a server, proving it): the `chronicle-episode-kit-plugin` skill
in jgwill/Miadi (`skills/chronicle-episode-kit-plugin`).

## The hook

`PreToolUse` on `Bash`. It blocks a command that would bring a **new direct child of
`$MIADI_CHRONICLE_ROOT`** into existence — `mkdir`, `mkdir -p`, `install -d`, or a `>` / `>>`
redirect into a path whose missing ancestor is a direct child of the root — and prints the
`mkepisode … --register` invocation plus the `mkepisode --adopt` repair.

It deliberately does **not** block:

- `mkdir` inside an episode directory that already exists (`rooms/`, assets, passages) —
  ordinary work in a vessel that already has a manifest;
- anything outside the chronicle;
- anything at all when `MIADI_CHRONICLE_ROOT` is unset. It says so on stderr and gets out of
  the way. A guard that blocks when it cannot see is a guard people switch off.

Exit codes: `0` allow, `2` block with the reason on stderr. Every internal failure —
unparseable payload, no `python3` — is also `0`, on purpose.

**Hooks load at session start and do not hot-swap.** Editing `hooks/hooks.json` or the guard
does nothing to a running session. Exit Claude Code and start it again.

### Proving the hook

```bash
./hooks/selftest.sh    # 14 fixtures, exit 0
```

The suite is mutation-tested: an always-allow stub fails 7 of 14, an always-block stub fails
13 of 14. A suite that cannot tell a broken guard from a working one is worse than none.

## Install

```bash
"$MIADI_ORCHESTRATION_KIT_ROOT/scripts/install-chronicle-skill.sh" --check     # look
"$MIADI_ORCHESTRATION_KIT_ROOT/scripts/install-chronicle-skill.sh" --dry-run   # say
"$MIADI_ORCHESTRATION_KIT_ROOT/scripts/install-chronicle-skill.sh"             # do
```

Or load the plugin directly for one session, without installing anything:

```bash
claude --plugin-dir "$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-chronicle-episode-kit"
```

## Runtime floors

`passages >= 0.3.0` (ep<NNN> resolution, `attention`) and `@miadi/inquiry-weave >= 0.8.0`.
`mkepisode` must carry `--adopt`. The install script preflights all three and exits `3`
rather than proceeding, per `claude/AGENTS.md` rule 3.

## Environment

| variable | meaning |
|---|---|
| `MIADI_CHRONICLE_ROOT` | the chronicle. Read from the environment, never a literal. `/srv/miadi/episodes/miadi-chronicle` on Gaia; `/data/data/com.termux/files/srv/miadi/episodes/miadi-chronicle` on Ilex. |
| `MIADI_CHRONICLE_MW_URL` | the wheel. `MW_API_URL` derives from it. `https://mw.tail3b11eb.ts.net` is retired and offline since 2026-07-29. |
| `MIADI_ORCHESTRATION_KIT_ROOT` | this repo. |
| `MIADI_API_URL` | the Miadi app whose `/api/chronicle/episodes` door the `inquiry-weave` server uses. Default `https://miadi.tail3b11eb.ts.net`. |
| `MIADI_API_TOKEN_WRITER` | passes that door's write gate. Without it the episode tools read and every write answers 401. |
| `MIADI_PERSON_TOKEN` | optional; names the person who opens a review's talking circle. |
| `MIADI_ASSEMBLY_VOICE_AUDIO_DIR` | where `miadi-voice` finds generated audio; default `/srv/miadi/voice-audio`. |
| `MIADI_SRC` | optional; `miadi-voice` reads the writer token from `$MIADI_SRC/.env` when the environment lacks it. |
| `MIADI_INQUIRY_WEAVE_MCP`, `MIADI_VOICE_MCP`, `MWCV` | optional package pins for the three servers. |

## No `agents/`

Deliberate. The skill plus two thin commands already carry the procedure; an agent here
would be a second prose copy of it, which is the divergence this whole lane exists to end.

🌸: An agent that reaches for `mkdir` in the chronicle now gets the working command back
instead of a directory nobody can read later.
