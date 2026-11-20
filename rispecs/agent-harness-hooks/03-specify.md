# 03 · Specify

Eight sections, by domain (`02-intent.md`). Each states what will exist, then its behaviour. The
grounding for each is named as `G-<field>` and lives in
jgwill/Miadi [`foundations/agent-harness-and-controlled-language/`](https://github.com/jgwill/Miadi/tree/main/foundations/agent-harness-and-controlled-language), whose
`synthesis.md` maps each lane finding (A-F, B-F, C-F) to the section it changes.

## Controlled vocabulary

### S1 · A file's kind decides whether the rule applies

The word gate reads what a file is before it reads what it says.

- **Kinds.** `prompt` (an instruction kept to be run by a model or an agent), `kept` (what a
  notebook keeps), `verbatim` (a person's words as they said them), `code`, `other`.
- **Behaviour.** The kind is decided in this order, and the first answer wins:
  1. A declaration in the first ten lines of the added text or the file: `miadi-kind: <kind>` in
     YAML front matter, or the same words in a comment (`<!-- miadi-kind: prompt -->`,
     `// miadi-kind: prompt`).
  2. A folder that holds prompts: a path segment `prompt` or `prompts`, as today.
  3. A folder that a notebook keeps: `keep/`, `notebook-<hex8>/`, `*.notebook-*/`, as today.
  4. A verbatim path: `.pde/**/input-prompt.md`, `captures/**` take transcripts,
     `_claude_user_inputs.jsonl`.
  5. Code by extension: `.ts .tsx .js .mjs .cjs .py .sh .css .scss .json .yaml .yml .toml`.
  6. A text file (`.md`, `.txt`, no extension) whose basename stem is `prompt` or starts with
     `prompt-`/`prompt_` or ends with `-prompt`/`_prompt` (any case). `starter-prompt.txt`,
     `PROMPT.txt` and `prompt-wave1.txt` stay prompts. `issue-draft-prompt-hooks.md` and
     `miadi-prompt-improvements.md` do not.
  7. Everything else is `other` and passes.
- **What each kind gets.** `prompt` and `kept` are checked and may be refused (S2). `verbatim` is
  checked for advice only: the hit is recorded (S3) and the write passes. `code` and `other` pass
  unchecked unless declared `prompt`.
- **A declaration that moves a file out of a prompt folder** (step 1 overriding step 2) is recorded
  as `declared` in the guard ledger, so a seat cannot leave the rule silently.
- **Fixtures.** P1 (CSS in `prompt-editor.tsx`) passes. P2 (a person's words in
  `input-prompt.md`) passes with an advice line. The issue draft of H3 passes.
- **Grounding.** G-terminology (a term is bound to a concept in a domain, so the domain has to be
  known first), G-linters (prose linters scope rules by file type and by syntax node).

### S2 · A word is refused in the sense the list names

- **The list gains senses.** `forbidden-words.txt` keeps one entry per line and adds two fields:
  `<word> | <instead> | <forbidden sense> | <signalling phrases, separated by ;> | <allowed senses, separated by ;>`.
  Signalling phrases are the wordings that carry the forbidden sense ("between current reality",
  "bridge the", "close the"), as style guides list a word's banned use beside its allowed ones
  (A-F8). The fourth field holds them and the fifth the allowed senses. The fifth field is
  empty until the list's owner names a sense, and only the owner edits both.
- **A mention passes.** The bare word in quotes or backticks (`"gap"`, `` `gap` ``) is the word
  being talked about. It passes and is recorded as `mention`. Joined and slashed names pass as today.
- **The refusal speaks to every sense.** It reads: the word, the line, the frame the rule guards
  (A-F12), then "If you mean <forbidden sense>, write <instead>" with a drop-in for a noun slot
  ("the tension between current reality and the desired outcome"), because "resolve tension" is a
  verb phrase and cannot replace a noun (A-F10). Then: "If you mean something else, name that thing
  with its own word", and, when allowed senses exist, the allowed senses with the override marker
  below.
- **Levels.** A signalling phrase is refused in a prompt or kept text. A bare occurrence is refused
  too, as today. Whether a bare occurrence drops to advice (recorded, passes) is the list's owner's
  choice (H-1), as Vale, Sentinel and ESLint grade a rule below "error" (A-F5, B-F11).
- **An override names the sense.** In the same added text, a marker
  `word-gate: <word> = <sense in plain words>` (in any comment syntax) lets the write pass when the
  sense is one of the entry's allowed senses. The gate records `override` with the stated sense. A
  sense that is not on the entry's allowed list is refused with the list of allowed senses. While
  the fifth field is empty, no override passes. This keeps the rule exactly as strict as today until
  the owner widens it, and makes every widening a recorded act.
- **Synonyms stay outside the gate.** P5 ("close the distance between …") passes unless its wording
  is a signalling phrase. A surface match cannot see meaning, and adding synonyms to the list invites
  the next synonym (A-F11). A pass is never reported as compliance. The self-improvement
  pass (S8) and reviews carry meaning.
- **Fixtures.** P6 is refused with the new message. A quoted mention passes and is recorded.
- **Grounding.** G-terminology (one concept per term), G-polysemy (a surface match cannot tell
  senses apart), G-messages (an actionable refusal names the fix), G-gaming (a rule on a proxy
  invites substitution).

## Harness guards

### S3 · Every guard refuses the same way and records what it did

Applies to every PreToolUse guard the kit ships: the word gate, the chronicle mkdir guard, the
session lookup guard, the tmux server guard, the secret print guard, the workspace clone guard,
the raw capture guard.

- **A refusal has five parts.** The rule in one sentence with its owner and date. The act refused
  (the path, or the command's first 200 characters). The token that matched. How to pass: a rewrite,
  a door (as the session lookup guard names `tide agents list` and `miadi-hooks-interpret`), or the
  switch for legitimate work. Where the rule lives.
- **The guard parses the act, not the text around it.** A heredoc body, a quoted string and a
  comment are not commands. The mkdir guard's H1 and H2 (a `cat >> file.ts <<'EOF'` read as
  `mkdir grep`, `mkdir app`) become its fixtures and pass.
- **A refusal carries a stable rule code and a decision id**, so refusals are counted by rule
  (Llama Guard's category codes, OPA's `decision_id`, B-F6, B-F11).
- **Each guard states how it fails.** A guard that crashes or times out lets the call run (Claude
  Code's default, B-F3). Each guard's README says so. A guard never runs with `async`, since an async
  hook cannot block.
- **Every decision that is not a plain pass is one line** in
  `<capture root>/<session_id>/_claude_GuardDecisions.jsonl`, or in
  `~/.miadi/decisions/guard-decisions.jsonl` when the session has no capture folder:
  `{ts, decision_id, session_id, guard: {plugin, name, version}, tool, target, rule, matched, decision, sense?, line?}`,
  with `decision` one of `refuse`, `override`, `mention`, `advice`, `declared`. `line` is cut to 160
  characters. The full text is never written.
- **The decision is given in the form Claude Code shows to the agent.** Exit 2 with the reason on
  stderr stays the default: Claude Code gives stderr to the agent as the denial reason (B-F2). The
  JSON form (`permissionDecision: "ask"`) is used only where a person should decide in the moment.
- **Each guard has paired fixtures**, acts it must refuse and acts it must pass, as XSTest and
  OR-Bench pair safe and unsafe prompts (B-F7, B-F8). Every false refusal reported becomes a pass
  fixture before the guard changes.
- **A refused write that reappears through Bash is counted.** Claude Code's own guide notes that an
  agent refused on Edit can write with a shell command (B-F10). S7 reports a refusal followed by a
  Bash write to the same path in the same session.
- **Grounding.** G-aci (an edit-time check that shows the error lets the agent retry), G-guardrails
  (on-fail actions other than refuse), G-overrefusal (false refusals are measured, not assumed rare),
  G-policy (advisory and soft-mandatory levels with recorded overrides).

## Session capture

### S4 · A correction in the capture is a person's

- **`corrective_feedback_hook.sh`** records a rejection only when the `tool_result` content starts
  with Claude Code's sentence for a person's rejection ("The user doesn't want to proceed with this
  tool use"). A content that starts with `PreToolUse:<Tool> hook error:` or holds "This hook comes
  from the" is a guard's. It goes to `_claude_GuardDecisions.jsonl` with `source: transcript`
  when the guard did not write it (one line per `tool_use_id`), and never to
  `_claude_CorrectiveFeedback.jsonl`.
- **`@miadi/hooks-interpreter`** grades `rejected-tool-recorded` only for a record carrying the
  person's sentence. Records already written whose text is a guard's (58 measured on 2026-11-20)
  are read as `guard-refusal`. The 2026-08-15 comment in `src/classify.ts` gains the 2026-11-20
  measurement beside it.
- **Grounding.** G-provenance (who said it is part of the record), and the factory's own
  `status` and `source` axes (`miadi-foundation:tracing-provider-vocabulary/vocabulary.md`): a
  guard's refusal is `source: captured` from a machine, a correction is `source: given` by a person.

### S5 · A prompt never waits on capture, and a loss is written down

- **Every hook the kit installs declares its `timeout`** in `hooks/hooks.json`. None is left to the
  default. Claude Code runs matching hooks in parallel and a UserPromptSubmit command hook defaults to
  30 s, so a prompt waits for the slowest one and loses its work at 30 s (C-F1, C-F5).
- **The synchronous part writes the prompt line and returns.** The starting budget is 1 s at the
  95th percentile at load 50 on gaia, measured before and after. The figure is revised by what the
  measurement shows.
- **Transcript reads run detached.** Corrective feedback, accepted redirections and the neighbours
  notice run in one `claude_detach` job per prompt, one pass over the transcript tail (one `jq` or
  one script, never one process per line), under a lock per session.
- **A job that does not finish says so.** A detached job that is killed, times out or errors writes
  `{ts, session_id, job, reason, not_captured: [...]}` to `_claude_capture_incomplete.jsonl`.
  `miadi-hooks-interpret digest` shows it.
- **A capture hook that returns nothing to the model runs with `"async": true`.** Claude Code runs it
  in the background and never makes the prompt wait (C-F2). `corrective_feedback_hook.sh` and
  `accepted_redirection_hook.sh` are such hooks. `user_prompt_submit_hook.sh` stays synchronous,
  because it writes the prompt line first and is fast. A hook that injects context (the steering
  inbox) stays synchronous with its own short timeout. Under `claude -p` an async hook still running
  at teardown is killed, so the start and end markers below count it.
- **Start and end markers.** Each capture job writes a start line and an end line. A start with no end
  is a cancelled or killed job, counted by the sweep, because a cancelled hook cannot write its own
  record (C-F8).
- **The window is recorded.** The corrective feedback job reads a transcript tail. The record says
  how many lines it read, so a rejection that fell outside the window is known to be unread (C-F4).
- **Test gate.** `tests/prompt-hooks-latency.sh` runs each UserPromptSubmit hook on a 5000-line
  transcript fixture under CPU load and fails above the budget.
- The screenwalk seat's draft `issue-draft-prompt-hooks.md` (Episode 257 scratch) is this section.
- **Grounding.** G-tracing (low overhead by design, work off the request path), G-tail (tail
  latency grows with fan-out of slow parts), G-dropped (count what was dropped).

## Prompt management

### S6 · Agents create, check and inject prompts through one door

`@miadi/llmops` gains a `prompt` command family. A prompt made through it is a prompt by
declaration, so its kind never depends on a file name.

- **`llmops prompt check --text-file F | --module <path> --export <name>`** runs S1 and S2 on the
  text as kind `prompt` and exits 0 (pass), 2 (refused) or 3 (a word whose sense must be named). It
  prints the same message the gate prints.
- **`llmops prompt create <domain>/<name> --text-file F [--sense <word>=<sense>]...`** runs the check,
  then saves a new version in the domain's project. The check result and each named sense go into
  the version's commit message, as `miadi-run create` records secret redaction today. It refuses on
  exit 2 and never edits the text.
- **A label moves after the checks pass.** `create` saves a version. `llmops prompt label <address>
  production` moves the label only after the check and the prompt's assertions pass, as promptfoo
  fails CI on a prompt change (C-F12). Today `saveEpisodeVideoTemplate` creates and labels
  `production` in one call (C-F11).
- **`llmops prompt get miadi-prompt:<domain>/<name>@<v>`** prints the pinned text, for a seat to put
  into a brief or a subagent's prompt. An unpinned name is refused, as `resolveSessionRef` refuses it.
- **Prompts held in code** (`packages/llmops/src/screenwalk-questions.ts`) are checked by the
  package's own tests, one `check` per exported prompt, so a module prompt is covered at test time.
- **A person's text** (`miadi-run create`) is checked as `verbatim`: hits are recorded in the
  version's commit message and never refuse.
- **One list.** The door reads the same `forbidden-words.txt`, from `MIADI_FORBIDDEN_WORDS` or the
  kit path. When the list cannot be read, the check passes, says "list unavailable", and records it.
- **Grounding.** G-promptops (prompts as versioned artefacts with labels, and how they change in
  repositories), G-agents-write-prompts (agents that generate prompts for other models), the
  factory's `prompt management` capability (`vocabulary.md`).

## Self-improvement

### S7 · The guard ledger can be read without reading the capture

`miadi-hooks-interpret guards [--since <date>] [--guard <name>]` answers, per guard: decisions by
kind, the sessions, the most matched targets, and for each refusal whether the session's next write
to the same target passed (a rewrite) or never came. The lookup guard names this door.

### S8 · A guard's fit is a proposal a person rules on

The self-improvement cycle (`rispecs/self-improvement-cycle/`) gains the scorer `guard-fit`. Per
guard, over fourteen days: refusals, rewrites, overrides, advice lines, and refusals whose target
falls outside the rule's scope (a code file, a verbatim file, a heredoc body). Three such refusals
start the investigation, as the exit-reasons pass starts at three sessions. The proposal goes to the
guard's owner, and a proposal about the word list goes to the list's owner. Overrides are listed
with their stated sense so the owner can add the sense, refuse it, or ask for a rewrite.

## Measures that close this packet

| probe | today | after |
|---|---|---|
| P1 CSS in `prompt-editor.tsx` | refused | passes (S1 code) |
| P2 person's words in `input-prompt.md` | refused | passes, advice recorded (S1 verbatim) |
| P3 question in `screenwalk-questions.ts` | unseen | checked by the package test and the door (S6), exit 3 until a sense is named |
| P4 Bash heredoc into `prompts/` | unseen | unseen by the gate. The door (S6) is the documented way to make a prompt, and S8 counts prompts that appear in prompt folders with no door record |
| P5 synonym | passes | passes (outside a surface rule, by design) |
| P6 forbidden sense in a prompt | refused | refused with the per-sense message and one ledger line |
| H1, H2 heredoc read as `mkdir` | refused | pass (S3 parse fixtures) |
| H4 prompt hooks at load 48 | cancelled at 30 s, loss unrecorded | under budget, or a `capture_incomplete` line |
| guard text in corrections | 58 of 1196 records | 0 new, 58 reclassified (S4) |
