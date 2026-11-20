# 01 · Reverse-engineer: what the harness did to one working seat

Observed 2026-11-20 on gaia, from the seat that met it and from this seat
(miadi-tmux://mia@gaia:t8-bug-hooks-cant-run-deepdiver-prompts-2611200939, session
`dfb7bd97-73ec-4d11-b1ba-77f22a6680dc`, Claude Opus 5.5). Kit at `b93186d`.

## The seat that met it

miadi-tmux://mia@gaia:t8-screenwalk-registration-2611200830, session
`323203a1-4c7b-4b14-be15-73c178bc1b4a`, team T8, Episode 257 (miadi-chronicle://257). Its brief was
a screenwalk registration and approval dashboard. In the morning it built two commits on
`feat/screenwalk-registration-261120` in jgwill/Miadi (8a797e64, 89a1de24), wrote nine questioning
prompts for Gemini (`packages/llmops/src/screenwalk-questions.ts`, saved at v1 in Langfuse), and
measured its own hook cancellations. Its notes are
`scratch/t8-screenwalk-registration-2611200830/notes.md` in Episode 257.

The harness touched it four times.

| # | when (UTC) | hook | the act | what the hook did |
|---|---|---|---|---|
| H1 | 13:46:37 | `guard-mkdir-in-chronicle.sh` (miadi-chronicle-episode-kit 0.3.63, PreToolUse Bash) | `cat >> lib/screenwalk-registry.ts <<'EOF'` in a jgwill/Miadi worktree | refused: "would create a new episode directory … mkdir -> …/grep, …/app" |
| H2 | 13:46:44 | same | the same append through `$W` | refused the same way |
| H3 | about 14:31 (the notes' 09:31 local) | `word-gate.mjs` (miadi-deepdiver 0.9.0, PreToolUse Write) | `issue-draft-prompt-hooks.md`, an issue draft about UserPromptSubmit hooks | refused: the listed word at line 17, "so the gap is visible where session continuity is read" |
| H4 | three times in the morning | UserPromptSubmit "command hook 2" and "command hook 3" | every prompt | cancelled at 30 s (durationMs 30946 to 31165, timeoutMs 30000) |

None of H1 to H3 refused the act its rule names. H1 and H2 read heredoc text as `mkdir` targets: the
command created no directory in the chronicle. H3 refused a file that is not a prompt (its name
holds "prompt" because it is about prompt hooks) and a sense the rule does not name (a missing
record, not the space between current reality and the desired outcome). The seat rewrote the
sentence ("so whoever reads the session's continuity sees what is missing") and continued, so the
work was finished. What was lost is described below under capture.

This seat met the session lookup guard twice while preparing this packet: once for a `find` over
the capture (a fleet scan, which the guard names correctly) and once for `find / -name miadi-run`
looking for a skill folder, which is not a session lookup. The chronicle mkdir guard refused it once:
a heredoc redirect into `$S/mission2.md`, with `$S` a scratch folder, run from the chronicle root.
The guard cannot expand the variable and read it as a new directory under the chronicle.

## The word gate

`claude/miadi-deepdiver/hooks/word-gate.mjs`, committed `2512615` on 2026-10-27 (K6a), from
William's word of 2026-10-26 in `forbidden-words.txt`: "ensure that is not into the specification,
code or whatever and we shall continue to have validation and even some insurance in DeepDiver's
plugin, hooks". It runs on PreToolUse `Write|Edit` with a 10 s timeout.

- **What a file is.** `inScope()` decides from the path: a basename matching `/prompt/i`, or a folder
  named `prompt`/`prompts`, `keep`, `notebook-<hex8>` or `*.notebook-*`. Every other file passes.
- **What is checked.** The text the call adds (`content`, `new_string`, MultiEdit's `new_string`s).
  Removing a word is never refused.
- **The match.** Whole word, any case, plural `s`. A token with a slash or a quoted joined name
  (`` `gap-analysis` ``) passes.
- **The refusal.** Exit 2 with the word, its line, the line's text, the rule ("write resolve
  tension, never …"), and the list's path. It keeps no record of the refusal.
- **The list.** One entry, with its replacement and the sense it was used for. The sense is printed
  and never used to decide.

### Six writes against the gate (this seat, 2026-11-20)

| probe | file | added text | exit | the rule's intent |
|---|---|---|---|---|
| P1 | `app/teachings/prompt-editor.tsx` (Miadi, 10 lines already use it) | `style={{ display: "grid", gap: 8 }}` | 2 | a CSS property, not the sense |
| P2 | `.pde/<id>/input-prompt.md` | "Guillaume wants the gaps it showed implemented right away" | 2 | the person's own words, kept verbatim |
| P3 | `packages/llmops/src/screenwalk-questions.ts` | "The segments cover the whole video without gaps or overlaps." | 0 | a real prompt for Gemini, another sense |
| P4 | Bash heredoc into `prompts/brief.md` | "resolve the gap" | 0 | a real prompt, the forbidden sense, never seen |
| P5 | `prompts/brief.md` | "Close the distance between current reality and the desired outcome." | 0 | the forbidden sense under another word |
| P6 | `prompts/brief.md` | "Each step bridges the gap between current reality and the desired outcome." | 2 | the case the rule exists for |

This packet's own PDE room shows P2 again: its `input-prompt.md` holds Guillaume's input, which
pastes the refusal and so carries the listed word. It was written through Bash. Written with the
Write tool, it would have been refused.

76 tracked files in jgwill/Miadi have "prompt" in their path. They include code
(`lib/memory-prompt-store.ts`, `app/api/circles/memory/prompt/route.ts`,
`packages/media-generation/src/prompt.ts`) and 25 `.pde/*/input-prompt.md` files that hold a
person's words. Two of those already hold the word in Guillaume's own sentences.

## Capture records a guard as a person

`claude/miadi-session-observability/hooks/claude_hooks/corrective_feedback_hook.sh` runs on every
prompt. It reads the last 50 transcript lines and records every `tool_result` with `is_error: true`
as a rejection, with the lines after the first as `user_feedback_message`. A PreToolUse refusal
reaches the transcript in that same shape. So H1 and H2 are in the seat's
`_claude_CorrectiveFeedback.jsonl` with the mkdir guard's text as what "the user" said.

Measured over the whole capture root (434 ledgers, 1196 records; records whose
`user_feedback_message` holds a hook's text, matched by "This hook comes from the … plugin",
"refused", "hook error" and the mkdir guard's sentence, so a lower bound):

| month | records | hook text |
|---|---|---|
| 2026-01 to 2026-07 | 563 | 0 |
| 2026-08 | 162 | 2 |
| 2026-09 | 164 | 2 |
| 2026-10 | 191 | 22 |
| 2026-11 (to the 20th) | 116 | 32 |

58 records in 37 sessions. The two most frequent sources: miadi-session-observability's own guards
(25) and the chronicle mkdir guard (21). `@miadi/hooks-interpreter` 0.13.1 (`src/classify.ts`)
still states, from its 2026-08-15 measurement, that "every record is a tool call a human actually
rejected, with the words he typed", and grades such a record as a measurement.

## Prompt hooks under load

UserPromptSubmit hooks installed on this host for a kit seat (`hooks/hooks.json` of each plugin):

| plugin | hook | timeout |
|---|---|---|
| miadi-session-observability 0.1.55 | `user_prompt_submit_hook.sh` | none |
| miadi-session-observability 0.1.55 | `corrective_feedback_hook.sh` | none |
| miadi-session-observability 0.1.55 | `accepted_redirection_hook.sh` | none |
| miadi-session-observability 0.1.55 | `steering_inbox.sh` | 10 s |
| miadi-session-issue 0.1.2 | `first_prompt_issue.sh` | 30 s (exits early once the issue exists) |

Which hooks "command hook 2" and "command hook 3" are was not read from a debug log. By position
(the observability plugin's four hooks first) and by measured duration they are
`corrective_feedback_hook.sh` and `accepted_redirection_hook.sh`. This is an inference.

The seat measured on a copy of its transcript at load 21: `corrective_feedback_hook.sh` 9.3 s,
`accepted_redirection_hook.sh` 4.1 s. Both start one `jq` process per transcript line, several per
rejection. The host's load was 48 (5 min) when the hooks were cancelled. This seat read the load at
17.6 at 10:07 local. The prompts themselves were captured (`user_prompt_submit_hook.sh` writes first),
and what the cancelled hooks add afterwards (corrective feedback, accepted redirections, the
neighbours notice) was lost for those prompts with no line saying so.

## Where prompts are actually made

| channel | example | does the gate see it |
|---|---|---|
| Write or Edit of a file named or foldered as a prompt | `packages/review-service/prompts/261104-transcript-first-reading-v6.md` | yes |
| a prompt held in a code module, pushed by a CLI | `screenwalk-questions.ts`, `llmops screenwalk-questions` | no |
| a person's text made a prompt version | `miadi-run create <name> --text-file F` (Langfuse, one version per call, secrets redacted before create and named in the version's commit message) | no |
| Bash heredoc or a script | P4 | no |
| a subagent brief in a tool call | `Agent(prompt: …)` | no |

## Qualities worth keeping

- **Deterministic and cheap.** The gate is a list and a match with no model, as the Episode 564 Jev
  study asked ("Not Jev, on purpose"). It answers in milliseconds.
- **The refusal teaches.** It names the word, the line, the rule and where the list lives, so the
  seat rewrote and continued in one turn.
- **Removal is never refused**, so an agent can always clean a file.
- **The session lookup guard names the doors** (`tide agents list`, `miadi-hooks-interpret digest`)
  and the switch for work on the capture itself. A refusal that says where to go next is the
  pattern the other guards lack.
- **The prompt is written first.** `user_prompt_submit_hook.sh` captured every prompt even when the
  later hooks were cancelled.
- **Detaching already exists.** `claude_detach` (`hooks/claude_hooks/lib.sh`) runs the images
  capture, files-written and publications off the request path.
