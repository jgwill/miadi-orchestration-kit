# 05 — Distribution: one skill, every harness

Lane C. Anchor: jgwill/miadi-orchestration-kit#41. Related: #36 (`rispecs/medicine-wheel/04-export.md`
per-harness recipes), #33 (`claude/miadi-session-orchestrator` — the proven plugin shape).
Measured on Gaia, 2026-09-04, Claude Code 2.1.261. Every claim below names the command or
file it came from; re-measure before extending.

William's question is the whole design constraint: *is `/etc/claude-code/skills` the right
place for skills that manage the Chronicle*, and *can something other than Claude Code reach
them*. The answer this file builds: no, and yes.

---

## 1. Current reality: the copies have already come apart

Three copies of `chronicle-episode` exist on this one host, and no two are the same file:

```
$ md5sum … ; wc -c …
  41398 bytes  2383fba7…  /etc/claude-code/skills/chronicle-episode/SKILL.md
   8973 bytes  21032b87…  /home/mia/.agents/skills/chronicle-episode/SKILL.md
  21212 bytes  36a03ed4…  $MIADI_ORCHESTRATION_KIT_ROOT/skills/chronicle-episode/SKILL.md   (Lane A, landed 22:07)
```

`~/.claude/skills/chronicle-episode` is a symlink to the first. `~/.agents/skills/chronicle-episode`
is a **real directory** holding the second — 8973 bytes, one fifth the size, and it is what a
Codex or Gemini agent on this host reads. Nothing declares which is canonical, nothing
reconciles them, and the divergence happened without anyone deciding it.

That is the argument for a single home, stated as a measurement rather than a preference.
**Copies do not stay equal. Links cannot come apart.**

The second half of the argument is ep333, recorded in #41: `Skill(chronicle-episode)` returned
`Unknown skill` because `/etc/claude-code` sat on a feature branch, 0 ahead / 7 behind. A skill
layer that needs a `git fast-forward` on root-owned system policy before it exists in a session
is copied, not distributed.

---

## 2. Per-harness distribution table

**F1 — the mechanisms are not the same shape, and that decides what the kit can ship.** Three
distinct loader contracts appear in this repo: *directory reference* (Codex), *enumerated list*
(Copilot), and *auto-discovery of a conventional subdirectory* (Claude Code, Gemini).

| harness | how it loads a skill | proof (measured / read this turn) | what the kit ships | what stays a copy → mitigation |
|---|---|---|---|---|
| **Claude Code** (plugin) | auto-discovers `skills/*/SKILL.md` beside `.claude-plugin/plugin.json`; **no `skills` key in the manifest at all** | `claude-code/miette/.claude-plugin/plugin.json` has keys `name, description, version, author, homepage` — no `skills`, yet `skills/two-eyed-output/SKILL.md` loads | `claude-code/miadi-chronicle-episode-kit/skills/chronicle-episode` → **relative symlink** `../../../skills/chronicle-episode` | nothing. Reference, not copy. |
| **Claude Code** (host layer) | `~/.claude/skills/<name>/SKILL.md`, symlinks followed | `ls -la ~/.claude/skills` — 20 entries, 14 of them symlinks into 5 different roots | `scripts/install-chronicle-skill.sh` links `~/.claude/skills/chronicle-episode` → kit | nothing. |
| **Codex** | `.codex-plugin/plugin.json` key `"skills": "./skills/"` — a **directory** reference | `codex/miette/.codex-plugin/plugin.json` | a `codex/miadi-chronicle-episode-kit/` whose `skills/chronicle-episode` is a relative symlink to the kit root (**not built this lane** — see §7) | `codex plugin remove` says "remove its local cache": Codex **copies at install**. A marketplace install diverges the moment the kit moves. Mitigation: install from the local path so the cache is refreshed by `codex plugin` update, and treat the kit as canonical in the SKILL.md header. |
| **Copilot** | `.github/plugin/plugin.json` key `"skills": [ "./skills/<name>", … ]` — an **enumerated list**, one line per skill | `copilot/miadi-storyweaver-orchestration-kit/.github/plugin/plugin.json` lists all 14 explicitly | same symlink shape plus **one new line in the array** | the enumeration is the divergence risk, not the file: adding a skill and forgetting the array line loads nothing and reports nothing. Mitigation: the array is the checklist; `--check` in the install script should grow to assert it. |
| **Gemini CLI** | extension dir with `gemini-extension.json`; `skills/<name>/SKILL.md` by convention, **no `skills` key**; `gemini extensions link <path>` keeps the local path live | `gemini/miadi-gemini-session-prep/gemini-extension.json` keys are `name, version, description, contextFileName`; `gemini/AGENTS.md` documents the shape and the `validate`/`link`/`list` commands | same symlink shape | **none — measured.** `gemini extensions validate` on a probe extension whose `skills/chronicle-episode` is a symlink into the kit: **exit 0, no warning**. `link` (not `install`) keeps it live. |
| **Pi** | no skill loader. `grep -c -i skill pi/miadi-pi-network/extensions/miadi-pi-network.ts` → **0** (exit 1) | that grep | nothing skill-shaped. Pi reaches the Chronicle through MCP tools and the hub, not through a SKILL.md | n/a — do not invent a Pi skill lane to make the table symmetrical. |
| **Any MCP-aware agent** | `~/.agents/skills/<name>/SKILL.md` is the de-facto convention on this host; `rispecs/medicine-wheel/04-export.md` §"Generic MCP-aware export" names `generic/<kit>/skills/*.md` for harnesses without stable packaging | that file; `ls -la ~/.agents/skills` (54 entries) | `scripts/install-chronicle-skill.sh` links `~/.agents/skills/chronicle-episode` → kit | nothing. This is the link that repairs the 8973-byte divergence above. |

### F2 — Claude Code's plugin loader **does** follow the symlink; its validator does not

This was the one thing the design could not be assumed. Measured, verbatim, from
`claude plugin validate`:

> `directory: 1 entry here is a symlink and was not read — components are read without
> following symlinks. **A session loading this plugin does follow them**, so validate the real
> paths separately.`

```
claude plugin validate  claude-code/miadi-chronicle-episode-kit   → exit 0  (passed with 1 warning)
claude plugin validate --strict  <same>                            → exit 1  (warnings are errors)
claude plugin validate  skills/                                    → exit 0  (the real-path recipe)
```

So the symlink stands, and two things follow:

- **R1** — `--strict` turns the warning into a failure. Do not put `--strict` on this plugin in
  CI without accepting that one warning explicitly. Mitigation: CI validates the plugin without
  `--strict`, and validates `$KIT/skills` separately, which is exit 0.
- **R2** — `claude plugin validate <plugin>` cannot see inside the skill, so it cannot catch a
  broken SKILL.md there. Measured: it returned exit 0 while `skills/chronicle-episode/` held
  only a `.gitkeep`. Mitigation: `install-chronicle-skill.sh` refuses to link an empty skill
  directory (exit 2), which is the check the validator does not perform.

---

## 3. Install design — one script, three modes

`scripts/install-chronicle-skill.sh`. Idempotent, and every mode says what it did per line.

```
--check     look only, report divergence, write nothing      exit 1 when drift is found
--dry-run   name every action in order, write nothing        exit 0
(none)      apply                                            exit 0
--help
```

Exit codes are the contract: `0` done/clean · `1` `--check` found drift · `2` cannot proceed
(kit missing, skill body empty, HOME unwritable) · `3` runtime floor miss.

**What it links.** `~/.claude/skills/chronicle-episode` and `~/.agents/skills/chronicle-episode`,
both → `$MIADI_ORCHESTRATION_KIT_ROOT/skills/chronicle-episode`. That single pair covers Claude
Code, Codex, Gemini and the generic agent layer on this host, because all four read one of those
two directories.

**What it does with what is already there.** A real directory is moved to
`<name>.bak-<YYYYMMDD-HHMMSS>` and **never deleted** — deletion is a human's word. A symlink
pointing elsewhere is replaced. A symlink already pointing at the kit prints
`already points at the kit — nothing to do` and is left alone, which is what makes re-running it
free.

**The preflight, and why it refuses rather than warns.** `claude-code/AGENTS.md` rule 3: a plugin
that quietly assumes a version misleads rather than refuses. The script checks
`passages >= 0.3.0`, `@miadi/inquiry-weave >= 0.8.0` and `mkepisode --adopt`, and exits `3`
before touching anything. Measured on Gaia: `passages 0.3.1`, `@miadi/inquiry-weave 0.8.3`,
`mkepisode --help | grep -c adopt` → 3. Proven by running it against a stripped `PATH`: exit 3,
scratch `HOME` untouched.

**Plugin registration — measured, and the answer is no.** The kit's only marketplace file is
`.agents/plugins/marketplace.json`, and it is a **Codex** marketplace:

```
claude plugin validate .agents/plugins/marketplace.json   → exit 1
  ✘ owner: Invalid input
  ✘ plugins.0.source: Invalid input
  ⚠ interface / plugins[0].policy: unknown fields, ignored at load time
```

Registering the Claude Code plugin there would produce an entry no Claude Code host can read.
So the script writes into `$KIT/.claude-plugin/marketplace.json` **if that file exists**, and
otherwise prints the direct-load invocation. It does not exist today.

- **D1 (open, needs a decision, not built this lane)** — add `.claude-plugin/marketplace.json`
  at the kit root as the Claude Code marketplace, with `owner`, and one `plugins[]` entry per
  Claude Code plugin (`miette`, `miadi-chronicle-episode-kit`, and whatever the `claude/` vs
  `claude-code/` lane decision leaves standing). The script is already written to fill it in
  idempotently. It is not created here because the lane split it depends on is a human's call
  (`claude-code/AGENTS.md`), and because the file is outside this lane's write scope.

Meanwhile, with no marketplace:

```bash
claude --plugin-dir "$MIADI_ORCHESTRATION_KIT_ROOT/claude-code/miadi-chronicle-episode-kit"
```

---

## 4. How `/etc/claude-code/skills/chronicle-episode` becomes a pointer

Design only. **The coordinator applies this; Lane C did not touch `/etc/claude-code`.**

The obvious move — replace the directory with a symlink into the kit — is wrong, and the reason
is in `/etc/claude-code/CLAUDE.md`: that path is a git repo (`jgwill/etc-claude-code`) checked
out on **every** host. A symlink committed there carries its target as text, and the kit is at
`/workspace/repos/jgwill/miadi-orchestration-kit` on Gaia and elsewhere on Ilex. One absolute
path in git breaks every other host.

**The shape that works — a committed pointer file, plus a host-local symlink that is not in git:**

1. Replace `/etc/claude-code/skills/chronicle-episode/SKILL.md` (41398 bytes) with a ~15-line
   pointer whose frontmatter `description` says the skill moved and where, and whose body names
   `$MIADI_ORCHESTRATION_KIT_ROOT/skills/chronicle-episode` and the install script. It stays a
   loadable skill, so a session that triggers it gets a working instruction instead of nothing.
2. `scripts/install-chronicle-skill.sh` points `~/.claude/skills/chronicle-episode` at the kit.
   `~/.claude` is host-local and not in that repo, so the absolute path is correct there and
   nowhere else needs to agree with it.
3. `/etc/claude-code/CLAUDE.md`'s skills index row for `chronicle-episode` changes to name the
   kit as the home, satisfying `claude-code/AGENTS.md` rule 4 — *a skill copied from
   `/etc/claude-code/skills/` must state which copy is canonical*.

**R3** — the pointer must not contain the strings `PENDING UPSTREAM` or `do not rely on this
stub`. `skills-reconcile.py` matches exactly those (`STUB_MARK`) and would file it as
`SELF-DECLARED-STUB`. Write it as *moved*, not as *stub*.

**R4** — `/etc/claude-code` is root-owned. Step 1 needs a privileged write and belongs to whoever
owns that repo. It is also the step that must be committed **and pushed** before any other host
sees it: that repo's own CLAUDE.md records a skill sitting uncommitted there for seven days
while being cited as authoritative.

---

## 5. How `skills-reconcile.py` sees the new home

`skills-reconcile.py` reads `~/.claude/skills`, calls `child.resolve()` on every entry — so it
**follows the symlink** — then `git rev-parse --show-toplevel` on the resolved path to find the
root, and records `origin`, last commit, `ahead`, and dirty count per root (lines 120-141). It
needs nothing new: pointing the symlink at the kit is sufficient for the kit to appear as a root.

Measured, two scratch farms each holding one symlink, everything else identical:

| farm | `chronicle-episode` →  | exit | findings |
|---|---|---|---|
| control (today) | `/etc/claude-code/skills/chronicle-episode` | 1 | **9** — all `NOT-IN-LIVE-PATH` |
| designed | `$KIT/skills/chronicle-episode` | 1 | **5** — 4 `NOT-IN-LIVE-PATH`, 1 `UNPUSHED-ROOT` |

**F3 — the designed home reports fewer findings, and the one new shape is the one worth having.**
`UNPUSHED-ROOT: chronicle-episode` fires because the kit is 1 commit ahead of its upstream. That
is precisely the ep333 failure made visible: a seat reading the skill is now told that what it is
reading has not been pushed, instead of discovering it after `Unknown skill`.

The `NOT-IN-LIVE-PATH` rows change identity, not severity: reconcile globs `<root>/skills/*/SKILL.md`
and names any skill in a known root that is absent from the live path. Under the designed home it
names the kit's four other skills (`deep-search`, `mcp-remote-qmd`, `miadi-mightyeagle-issue-263`,
`use-design-bundle-integration-kit`) instead of `/etc/claude-code`'s nine. The script itself says
that shape is a prompt to check, never a verdict.

The real `~/.claude/skills` run is unchanged by this lane, because this lane did not touch it:
before 59 findings / exit 1, after 58 / exit 1, and the whole diff is other repos moving
(`miadi-voice` was pushed by someone else; `/a/src/Miadi-18` gained a dirty file).

---

## 6. What is built, and where

```
skills/chronicle-episode/SKILL.md                       Lane A — the one canonical body
claude-code/miadi-chronicle-episode-kit/
  .claude-plugin/plugin.json                            name, 4 <example> blocks, v0.1.0
  skills/chronicle-episode -> ../../../skills/…         relative; resolves inside the kit
  hooks/hooks.json                                      PreToolUse(Bash), ${CLAUDE_PLUGIN_ROOT}
  hooks/guard-mkdir-in-chronicle.sh                     exit 0 allow / 2 block
  hooks/selftest.sh                                     14 fixtures, mutation-tested
  commands/mint-episode.md                              thin — delegates to the skill
  commands/episode-status.md                            thin — delegates to the skill
  README.md                                             the symlink warning, the no-hot-swap rule
scripts/install-chronicle-skill.sh                      --check / --dry-run / apply
```

No `agents/`. The skill plus two thin commands already carry the procedure; an agent here would
be a second prose copy of it, which is the divergence this lane exists to end.

### The hook's blocking rule, stated precisely

It blocks a command that would bring a **new direct child of `$MIADI_CHRONICLE_ROOT`** into
existence. The test is the *topmost missing ancestor* of the target: if its parent is the
chronicle root, the command is minting an episode vessel by hand.

That is narrower than "any mkdir under the root", deliberately. `mkdir -p <existing-episode>/rooms/west`
is ordinary work inside a vessel that already has a manifest; blocking it would make the guard
something people switch off, and a disabled guard blocks nothing. The measured failure — 63 of 172
manifest-less directories — is entirely at the direct-child level.

`MIADI_CHRONICLE_ROOT` unset means this host declares no chronicle: the guard says so on stderr
and exits 0. Every internal failure (unparseable payload, no `python3`) is also exit 0. A guard
that cannot parse must not become a guard that cannot be worked around.

---

## 7. Not built this lane, and why

- **O1 — `codex/miadi-chronicle-episode-kit/` and a Gemini extension.** Both are a
  `.codex-plugin/plugin.json` / `gemini-extension.json` plus the same relative symlink, and
  `rispecs/medicine-wheel/04-export.md` already carries the manifest sketches. #41 scopes this
  lane to the Claude Code plugin, and `rispecs/medicine-wheel/04-export.md` says explicitly: *do
  not scaffold every harness at once unless the operator asks*. The install script's two links
  already give Codex and Gemini the skill on this host through `~/.agents/skills`; the plugins
  are what make it travel to a host where the kit is not checked out.
- **O2 — the Copilot `skills[]` line.** One line in
  `copilot/miadi-storyweaver-orchestration-kit/.github/plugin/plugin.json`, but that plugin is the
  storyweaver kit and the Chronicle skill is not its subject. It belongs to a Copilot chronicle
  plugin that does not exist yet.
- **D1** above — the Claude Code marketplace file.
- The `claude/` vs `claude-code/` lane split. `claude-code/AGENTS.md` states it is a human's call
  and that new Claude Code plugins land in `claude-code/`. This one did.

---

## 8. Validations to re-run once Lane A's SKILL.md settles

Lane A landed `skills/chronicle-episode/SKILL.md` (21212 bytes, md5 `36a03ed4…`) at 22:07 on
2026-09-04, mid-lane. Everything below was re-run against it and passed, but it must be re-run
if that file changes again:

```bash
claude plugin validate "$MIADI_ORCHESTRATION_KIT_ROOT/claude-code/miadi-chronicle-episode-kit"   # 0 (1 warning)
claude plugin validate "$MIADI_ORCHESTRATION_KIT_ROOT/skills"                                    # 0
readlink -f "$MIADI_ORCHESTRATION_KIT_ROOT/claude-code/miadi-chronicle-episode-kit/skills/chronicle-episode"
HOME=<scratch> "$MIADI_ORCHESTRATION_KIT_ROOT/scripts/install-chronicle-skill.sh" --check        # 0 when linked
```

Two claims in this file are about Lane A's content and were **not** verified, because content is
Lane A's to own: that the SKILL.md names `MW_API_URL` deriving from `MIADI_CHRONICLE_MW_URL`, and
that it states the kit as canonical (`claude-code/AGENTS.md` rule 4). Both should be checked
against the landed text before this file is cited as complete.

🌸: An agent on any of these harnesses now reads the same instructions, and the one that reaches
for `mkdir` in the chronicle gets the working command back instead of a directory nobody can
open later.
