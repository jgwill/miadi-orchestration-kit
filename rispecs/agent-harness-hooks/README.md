# agent-harness-hooks

> Every hook the kit installs lets a seat finish the work it was asked for, and the factory's rules
> hold at least as well as before: a guard refuses only the act its rule names, says how to pass and
> leaves a line in a ledger; the vocabulary rule follows prompts on every channel agents use to make
> them; a capture hook never makes a person wait and writes down what it could not keep; and a
> correction in the capture is a person's.

Born from one morning's evidence. On 2026-11-20 the word gate refused an issue draft about prompt
hooks in miadi-tmux://mia@gaia:t8-screenwalk-registration-2611200830, the chronicle mkdir guard
refused two appends to a TypeScript file in the same seat, and three of its prompt hooks were
cancelled at 30 s. Guillaume asked for specifications by domain of application and for the academic
grounding beside them.

**Issue**: jgwill/miadi-orchestration-kit#165 (body in [`issues/`](./issues/))
**Status**: specified 2026-11-20, not built ([`STATUS.md`](./STATUS.md)).
**Grounding**: jgwill/Miadi [`foundations/agent-harness-and-controlled-language/`](https://github.com/jgwill/Miadi/tree/main/foundations/agent-harness-and-controlled-language) (miadi-foundation://agent-harness-and-controlled-language, 57 sources, 49 verified)
**Born in**: session `dfb7bd97-73ec-4d11-b1ba-77f22a6680dc`,
miadi-tmux://mia@gaia:t8-bug-hooks-cant-run-deepdiver-prompts-2611200939. PDE in
[`.pde/2611201015--d8adf1f3-232b-45b2-9e42-7fa62b29028a/`](../../.pde/2611201015--d8adf1f3-232b-45b2-9e42-7fa62b29028a/) (PDE `d8adf1f3`, claude opus: 13 secondary intents, 17 actions, 10 ambiguities).

## Files, in reading order

| File | Phase | Holds |
|---|---|---|
| [`01-reverse-engineer.md`](./01-reverse-engineer.md) | R | The four hook events in the seat, the word gate's six probes, guard refusals filed as corrections (58 of 1196), the prompt hooks' timeouts, where prompts are actually made, the qualities worth keeping |
| [`02-intent.md`](./02-intent.md) | I | Desired outcome, current reality, structural tension, the five domains, five creative advancement scenarios, boundaries |
| [`03-specify.md`](./03-specify.md) | S | S1 file kind, S2 senses and mentions, S3 the refusal contract and guard ledger, S4 corrections are people's, S5 latency budget and recorded loss, S6 the prompt door, S7 the ledger view, S8 guard fit in the cycle |
| [`04-export.md`](./04-export.md) | E | Build order E1 to E7 by repository, gates, what is held for a named owner, decisions taken here |
| [`05-source-ledger.md`](./05-source-ledger.md) | | Measurements with their commands, grounding by `G-` code, related issues |
| [`STATUS.md`](./STATUS.md) | | What exists, what is held |

## Domains

| domain | sections | grounding fields |
|---|---|---|
| controlled vocabulary | S1, S2 | G-terminology, G-linters, G-polysemy, G-messages, G-gaming |
| harness guards | S3 | G-aci, G-hooks, G-guardrails, G-overrefusal, G-policy |
| session capture | S4, S5 | G-provenance, G-tracing, G-tail, G-dropped, G-hooks |
| prompt management | S6 | G-promptops, G-agents-write-prompts |
| self-improvement | S7, S8 | `rispecs/self-improvement-cycle/`, G-gaming |

## Acceptance

- The six probes and H1 to H3 of `01-reverse-engineer.md` behave as the table at the end of
  `03-specify.md` says, as fixtures in each guard's tests.
- Every refusal, override, mention and advice of every kit guard is one line in the session's
  `_claude_GuardDecisions.jsonl`, readable through `miadi-hooks-interpret guards`.
- No new guard text lands in `_claude_CorrectiveFeedback.jsonl`, and the 58 already there read as
  `guard-refusal`.
- Each UserPromptSubmit hook of the kit has a declared timeout and stays under its budget at load
  50, or leaves a `capture_incomplete` line.
- A seat can create, check and read a pinned prompt with `llmops prompt create|check|get`, and the
  check result is in the version's commit message.
- The word list's entry is unchanged until its owner names a sense.
