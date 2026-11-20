# 05 · Source ledger

## Measurements (session `dfb7bd97-73ec-4d11-b1ba-77f22a6680dc`, 2026-11-20, gaia, mia)

| Claim | Source | Confidence |
|---|---|---|
| H1, H2: the mkdir guard's text is in the seat's `_claude_CorrectiveFeedback.jsonl` as `user_feedback_message`, refusing `cat >> lib/screenwalk-registry.ts <<'EOF'` | `jq` over `/a/src/_sessiondata/323203a1-4c7b-4b14-be15-73c178bc1b4a/_claude_CorrectiveFeedback.jsonl` | measured |
| H3: the word gate refused `issue-draft-prompt-hooks.md` at line 17 | Guillaume's paste of the refusal; the draft on disk carries the rewrite | observed |
| H4: three cancellations at 30 s, durationMs 30946 to 31165 | the seat's notes (`notes.md` F9, Episode 257 scratch) | reported by the seat |
| `corrective_feedback_hook.sh` 9.3 s, `accepted_redirection_hook.sh` 4.1 s at load 21 | same notes | reported by the seat |
| P1 to P6 exits | this seat piped six payloads into `word-gate.mjs` (miadi-deepdiver 0.9.0) | measured |
| 76 tracked jgwill/Miadi paths hold "prompt"; 7 of them hold the listed word | `git ls-files \| grep -i prompt`, then a whole-word count per file, `/a/src/Miadi-18` at `f36cdc88` | measured |
| 58 of 1196 correction records hold a hook's text, 37 sessions, 32 of 116 in November | a Python pass over every `_claude_CorrectiveFeedback.jsonl` under `/a/src/_sessiondata` (434 ledgers), matching hook signatures | measured, lower bound |
| Hook timeouts per plugin | `hooks/hooks.json` of each plugin under `claude/`, kit `b93186d` | measured |
| "command hook 2" and "3" are the corrective and redirection hooks | position and measured duration | inference |
| `screenwalk-questions.ts` holds a question with the listed word in another sense | `grep -w` in the seat's worktree at `8a797e64` | measured |
| `miadi-run create` records secret redaction in the version's commit message | `~/.claude/skills/miadi-run/SKILL.md` | read |
| UserPromptSubmit hooks default to 30 s, run in parallel, and `async: true` exists | Claude Code hooks reference, read by lane C on 2026-11-20 (Claude Code 2.1.329) | documented |

## Grounding

jgwill/Miadi `foundations/agent-harness-and-controlled-language/` (miadi-foundation://agent-harness-and-controlled-language):
57 sources in three lanes, 49 verified. `synthesis.md` there maps each finding to the section it
changes here.

| code | lane findings | lane file |
|---|---|---|
| G-terminology, G-polysemy, G-linters | A-F1 to A-F8 | `lanes/A-controlled-language.md` |
| G-messages, G-gaming | A-F9 to A-F12 | `lanes/A-controlled-language.md` |
| G-aci, G-hooks, G-guardrails, G-overrefusal, G-policy | B-F1 to B-F12 | `lanes/B-agent-harness-guards.md` |
| G-tracing, G-tail, G-dropped, G-hooks | C-F1 to C-F9 | `lanes/C-capture-and-prompts.md` |
| G-promptops, G-agents-write-prompts | C-F10 to C-F12 | `lanes/C-capture-and-prompts.md` |
| G-provenance | `status` and `source` axes | jgwill/Miadi `foundations/tracing-provider-vocabulary/vocabulary.md` |

## Related issues

| Issue | Relation |
|---|---|
| jgwill/miadi-orchestration-kit#165 | this packet's issue |
| jgwill/miadi-orchestration-kit#160 | the self-improvement cycle that S8 adds a scorer to |
| jgwill/Miadi#1016 | the screenwalk questions, a prompt held in code (P3) |
| jgwill/Miadi#815 | the status and source of what is claimed (S4) |
