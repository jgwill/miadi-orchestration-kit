# Session fork for reproduction — RISE draft

Status: **draft**, 2026-11-16. Written by Mia (witness seat, Claude Opus 5.5) at Guillaume's word,
from the first manual run of this practice in Episode 44 (miadi-chronicle://044). Not reviewed.
Extends `claude/miadi-session-observability` skill `session-fork` (jgwill/miadi-orchestration-kit#61).

## Desired Outcome Definition

When a session produces a result people want again, a person opens a **reproduction branch** of
that session with one command. The branch starts from the session's present point, with its whole
memory. It belongs to another team. It is reachable from the person's phone and it holds a brief.
A record links parent, branch, teams, episode and findings folder.

The branch writes down how the result was produced: an inventory, then RISE specifications. A new
session started from those specifications alone, with no access to the parent's memory, produces
an equivalent result. Each part of that result is either byte-identical or marked as judgment, and
a check says which.

The person knows it is achieved when the reproduction check (Scenario 3) passes on a fresh session.

## Current Reality

Observed 2026-11-16 on eury, forking JamAI session `c2901857-faf6-4168-9849-a96b82acb660` (user
`gmusic`), which composed op-021 Sens partagé for the film of Episode 44:

1. `miadi-fork.mjs open` (session-observability 0.1.48) forks at the present point only, in the
   parent's folder, with the parent's flags.
2. **It carries the parent's positional prompt into the branch.** The parent was started as
   `claude "<payload>"`. The `--dry-run` launch line re-sends that payload, so the branch's first
   turn would redo the composition and could overwrite the parent's output. The branch was
   therefore launched by hand from the tool's plan, without the prompt.
3. **It targets `<name>:0.0`.** On a tmux server with `base-index 1` (gmusic on eury) the
   `respawn-pane` call fails with `can't find window: 0`.
4. It has no `--remote-control`, no team of its own for the branch (the team is copied from the
   parent), no brief, no findings folder, and no way to open the branch in another account's tmux
   server (done by hand with `sudo -u gmusic`).
5. The parent's transcript holds its decisions. It does not hold the machine state those decisions
   ran on: house scripts in `~/.local/bin`, the soundfont, `fluidsynth` and `abc2midi` versions,
   the sugi-cast bridge, convention folders, and the standing rules of the person it works for.
6. An LLM session is not deterministic. The same prompt yields different turns. What can be made
   deterministic is the **context** (inputs, conventions, tools at known versions and hashes) and
   the **rendering chain** (ABC → MIDI → audio → video, given the same parameters).

## Structural Tension

Today a successful session can be forked only by hand, and the fork inherits the parent's first
prompt as a hazard. Nothing yet turns its memory into a reproducible context. The desired state is
a branch that opens in one command and writes its own reproduction specification. A fresh session
proves that specification. Each action step below moves the current reality toward that state.

## Roles

| team | role in this practice |
|---|---|
| T5 Production context exploration | made the result. Its session is the parent and is never written to |
| T8 Software development | owns the branch: inventory, RISE specification, reproduction check |
| T1 Session continuity | opens and records the branch, follows its completion marks, keeps it resumable |
| the person (for op-021: Jerry) | drives the branch after its first step, decides plugin or skills |

## Creative Advancement Scenarios

**Creative Advancement Scenario**: Open a reproduction branch

**User Intent**: Keep a successful session's way of working by handing it to T8 without touching it.
**Current Reality**: The parent is idle at its prompt after a result the person values.
**Natural Progression Steps**:
  1. The person (or the T1 seat) runs `fork open <parent> --purpose reproduction --team T8 --as <user> --remote-control --brief <file> --findings <dir>`.
  2. The tool resolves the parent from its binding line and drops its positional prompt. It finds the pane by id, not by index. It starts the branch in the parent's account and folder with Remote Control on.
  3. It submits the brief only after the branch's prompt is clear (`pane-write-guard.sh`).
  4. It records the branch and reads back the Remote Control URL from the pane.
**Achieved Outcome**: A branch the person can open from a phone, already working on its inventory.
**Supporting Features**: binding lines, `session_forks.jsonl`, tmux options `@miadi-parent`, `@miadi-episode`, `@miadi-team`, `claude --resume <id> --fork-session --remote-control <name>`.

**Creative Advancement Scenario**: The branch writes its own reproduction

**User Intent**: Know every mechanic that produced the result.
**Current Reality**: The branch holds the parent's memory and the machine as it is now.
**Natural Progression Steps**:
  1. The branch writes `01-inventaire.md` (or `01-inventory.md`) in five sections: inputs, tools, decisions, corrections, what is not reproducible as is. It separates what it re-measured now from what it only remembers.
  2. With the person, it writes RISE specifications of the workshop: conventions, tool contracts, render parameters, verification gates, the person's standing rules.
  3. Each tool named in the specifications is pinned: path, version or `sha256sum`, and the repository and commit that hold it, or `not in git`.
**Achieved Outcome**: A specification another session can build the same context from.
**Supporting Features**: the RISE framework (`/etc/claude-code/llms-rise-framework.txt`), the kit's `rispecs/` layout.

**Creative Advancement Scenario**: Prove the reproduction

**User Intent**: Be certain that a new session starts able to produce such results.
**Current Reality**: Specifications exist and the parent's output is on disk.
**Natural Progression Steps**:
  1. A fresh session (no fork, no parent memory) receives only the specifications and the original request.
  2. It rebuilds the rendering chain from the written score sources and compares with the parent's output: MIDI byte for byte (`cmp`), audio by duration, format, loudness and peak (`ffprobe`, ebur128), video by duration and format.
  3. Steps that are judgment (the choice of motif, instrument, voicing) are compared against the specification's written decisions, not against bytes.
**Achieved Outcome**: A report naming each part as identical, within tolerance, or judgment.
**Supporting Features**: the parent's own verification records (for op-021: `ETAT.md`).

## Contract for `fork open --purpose reproduction`

- Never carries the parent's positional prompt, `-p`, `--continue` or `--fork-session` values.
- Targets the new pane by `#{pane_id}`, not `:0.0`.
- `--as <user>` runs tmux and claude in that account (the parent's owner). The ledger records who opened it.
- `--remote-control [name]` adds the flag. The tool reads the URL back from the pane and records it.
- `--team <Tn>` sets `@miadi-team` on the branch. The parent's team is recorded beside it and is not changed.
- `--brief <file>` is copied into `--findings <dir>` as `00-brief.md` and submitted as a one-line pointer once the prompt is clear. Its `sha256sum` is recorded.
- The ledger line is written only after the branch's pane runs `claude`. It holds `parent`, `fork`,
  `purpose`, `team`, `parent_team`, `as`, `episode`, `findings`, `brief_sha256` and `remote_control_url`.

## Open questions

- **Q1** Where do a workshop's reproduction specifications land: the workshop's own repository
  (for JamAI, `Gerico1007/assembly-jamai`), or the kit, as a plugin? The person decides after the inventory.
- **Q2** Forking at an earlier message is not possible with the CLI today. Is the present point
  always adequate, or does a reproduction need the context as it stood before a correction?
- **Q3** Which tolerance makes two audio renders "the same" when the soundfont or `fluidsynth`
  version differs between hosts?

## Kin

- First run: parent `c2901857-faf6-4168-9849-a96b82acb660` → branch
  `3545c4b9-0ef4-4cf8-86de-8e38cf50701a`, tmux `ep44-261116-fork-01-op021-retro` (gmusic@eury),
  findings `/home/gmusic/jamai-retro/op-021-sens-partage/`, recorded in
  `/src/_sessiondata/data/session_forks.jsonl`.
- `claude/miadi-session-observability/skills/session-fork/SKILL.md`, `scripts/miadi-fork.mjs`.
- `teams/teams.json` (T1, T5, T8).
- Episode 44 (miadi-chronicle://044), the film the result was made for.
