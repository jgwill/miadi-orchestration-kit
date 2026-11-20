# Kit hooks let a seat finish its work: guards refuse only what their rule names and record it, capture keeps people's corrections apart and never makes a prompt wait

## Context

- 2026-11-20, miadi-tmux://mia@gaia:t8-screenwalk-registration-2611200830 (session `323203a1-4c7b-4b14-be15-73c178bc1b4a`, Episode 257, miadi-chronicle://257): the harness refused the seat three times and cancelled its prompt hooks three times. None of the three refusals hit the act its rule names.
  - miadi-deepdiver 0.9.0's word gate refused `issue-draft-prompt-hooks.md`, an issue draft about prompt hooks. It treats any file whose name holds "prompt" as a prompt, and it refuses its listed word in every sense.
  - miadi-chronicle-episode-kit 0.3.63's `guard-mkdir-in-chronicle.sh` refused two `cat >> lib/screenwalk-registry.ts <<'EOF'` appends in a jgwill/Miadi worktree. It read the heredoc text as `mkdir grep` and `mkdir app`.
  - Three miadi-session-observability 0.1.55 UserPromptSubmit hooks have no timeout. Two of them were measured at 9.3 s and 4.1 s at load 21 (one `jq` per transcript line). They were cancelled at 30 s at load 48, and nothing recorded what was lost.
- Six probes against the gate: it refuses CSS `gap: 8` in `app/teachings/prompt-editor.tsx` and Guillaume's verbatim words in a `.pde/*/input-prompt.md`. It never sees a real Gemini prompt in `packages/llmops/src/screenwalk-questions.ts` or a prompt written through Bash.
- No guard records its refusals. `corrective_feedback_hook.sh` files them as a person's rejection: 58 of 1196 records in `_claude_CorrectiveFeedback.jsonl` hold a hook's text, 32 of 116 in November. `@miadi/hooks-interpreter` grades those records as measurements of a person.
- Evidence and commands: `rispecs/agent-harness-hooks/01-reverse-engineer.md`.

## Desired State

- The word gate reads a file's kind (declared, prompt folder, verbatim, code) before its words. It refuses its word in the sense the list names, accepts a quoted mention, and records each decision.
- Every kit guard refuses with the rule, the act, the matched token, how to pass and where the rule lives. Each guard writes one line per non-pass decision to the session's `_claude_GuardDecisions.jsonl`.
- `_claude_CorrectiveFeedback.jsonl` holds only a person's rejections. The 58 records already there are read as guard refusals.
- Every UserPromptSubmit hook declares a timeout, returns within its budget at load 50, and runs its transcript reads detached in one pass. A job that does not finish leaves a `capture_incomplete` line.
- Seats create, check and read pinned prompts through `llmops prompt create|check|get`, so a prompt is a prompt by declaration and its check is in the version's commit message.
- The self-improvement cycle reads each guard's fit and proposes changes to a guard's owner, with counts.

## Action Steps

- [ ] E1: word gate S1, S2, S3 with probes P1 to P6 as fixtures (miadi-deepdiver 0.10.0)
- [ ] E2: corrections are people's (S4): `corrective_feedback_hook.sh`, jgwill/Miadi `packages/hooks-interpreter`
- [ ] E3: prompt hooks hold a latency budget (S5): `hooks.json` timeouts, one detached job, `tests/prompt-hooks-latency.sh`
- [ ] E4: the refusal contract for the other guards, starting with the mkdir guard's heredoc parse (S3)
- [ ] E5: `llmops prompt check|create|get` and checks over prompts held in code (S6), jgwill/Miadi
- [ ] E6: `miadi-hooks-interpret guards` (S7)
- [ ] E7: the `guard-fit` scorer in `rispecs/self-improvement-cycle/` (S8)
- [ ] H-1, held for the word list's owner: the listed word's allowed senses and whether override markers are enabled

## Structural Tension

One surface match on a file name and a word carries both the vocabulary rule and the agents' freedom to write, so widening the rule refuses work and narrowing it lets prompts through. Carrying the rule where a prompt is declared, with senses named and every decision counted, lets the rule tighten and the agents work in the same motion.

## Related

- Specification: `rispecs/agent-harness-hooks/` (S1 to S8, E1 to E7)
- Grounding: jgwill/Miadi `foundations/agent-harness-and-controlled-language/` (57 sources, 49 verified)
- jgwill/miadi-orchestration-kit#160 (self-improvement cycle)
- jgwill/Miadi#1016 (episode-video-describe, the screenwalk questions), jgwill/Miadi#815 (status and source of what is claimed)
- Episode 257 (miadi-chronicle://257), scratch `t8-screenwalk-registration-2611200830/` (`notes.md` F9, `issue-draft-prompt-hooks.md`, which is S5)
