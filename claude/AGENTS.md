# `claude/` — the Claude Code plugin lane

The root `AGENTS.md` has named this file as the lane's contract since the repo began.
It did not exist until 2026-08-16. This is it.

## What belongs here

A **Claude Code plugin**: a directory carrying `.claude-plugin/plugin.json`, and any of
`skills/`, `agents/`, `commands/`, `hooks/`. Installable with
`claude --plugin-dir <path>` or through a marketplace entry, on any host, without
editing that host's system policy.

| directory | state |
|---|---|
| `miette/` | a full plugin — manifest, skill, agent, command, and the repo's **first hook** |
| `miadi-storyweaver-orchestration-kit/` | `CLAUDE.md` + `README.md` + `prompts/` — a prompt wrapper, not a plugin; declared as *"not a fork of the kit"* |

## The lane split was resolved on 2026-09-05

Until that day two directories held Claude Code plugins: `claude/` (`miadi-session-orchestrator`,
`miadi-pi-network`) and `claude-code/` (`miette`, `miadi-chronicle-episode-kit`, the storyweaver
prompt wrapper). William's word: "I don't like the fact that we have two folders there" — so
`claude-code/*` was moved into `claude/` with `git mv`, this contract moved with it, and every
path in the kit that named `claude-code/` was rewritten. One lane, this one. Carried in
jgwill/miadi-orchestration-kit#41 and jgwill/miadi-orchestration-kit#33.

## Rules for a plugin in this lane

1. **`${CLAUDE_PLUGIN_ROOT}` for every path a hook or command references.** A hardcoded
   path makes the plugin host-local, which defeats the reason it is a plugin.
2. **Hooks load at session start and do not hot-swap.** Say so in the plugin's README,
   or the first bug report will be "it doesn't fire".
3. **Declare runtime floors and fail loudly.** A plugin that quietly assumes a version
   of `passages`, `inquiry-weave`, or a service URL will mislead rather than refuse.
4. **A skill copied from `/etc/claude-code/skills/` must state which copy is canonical.**
   Two copies with no stated authority diverge silently, and the one on disk always wins
   an argument with the one in git.
5. **Never hardcode a wheel URL.** `MW_API_URL` derives from `MIADI_CHRONICLE_MW_URL`;
   `https://mw.tail3b11eb.ts.net` is retired and offline since 2026-07-29.

## Why the hook lane matters more than the documentation lane

Measured on the Chronicle side: **63 of 172 episode directories carry no manifest**,
born by hand, invisible to lineage and to the chronicle room while the wheel returns 200
and reports them healthy. Guidance forbidding that has been in place for months, and the
count rose.

Guidance can be read and ignored. A hook does not need to be read. That is the whole
argument for this lane existing as plugins rather than prose.

🌸: The contract pointed at this file for a year and nobody opened the door it named —
which is the same shape as the rest of the work here, and the reason the first plugin in
this lane is one that refuses.
