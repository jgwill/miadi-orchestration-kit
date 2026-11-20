# 04 · Export

Where each section is built, in which order, and the gate that proves it. Nothing here is built
yet.

## Order

The order follows what each step makes easier for the next: the word gate's scope first, because
every seat meets it; then the capture's attribution, because every later count reads it; then the
latency, the other guards, the prompt door, and the cycle that reads all of it.

| step | sections | repository, surface | gate |
|---|---|---|---|
| E1 | S1, S2 (no override while the list's fifth field is empty), S3 for the word gate | jgwill/miadi-orchestration-kit `claude/miadi-deepdiver` (0.9.0 → 0.10.0): `hooks/word-gate.mjs`, `forbidden-words.txt` format, `tests/word-gate.fixtures.json` | P1 to P6 and the H3 draft as fixtures; `node --test` over them; the refusal message read by a seat once |
| E2 | S4 | kit `claude/miadi-session-observability`: `hooks/claude_hooks/corrective_feedback_hook.sh`; jgwill/Miadi `packages/hooks-interpreter/src/classify.ts`, `read.ts` | the seat's two H1/H2 records and one person's rejection as fixtures; a rerun of the 2026-11-20 count shows 0 new guard records and 58 reclassified |
| E3 | S5 | kit `claude/miadi-session-observability`: `hooks/hooks.json` timeouts, one detached job, `_claude_capture_incomplete.jsonl`; jgwill/Miadi hooks-interpreter `digest` | `tests/prompt-hooks-latency.sh` at load 50; the 1 s figure revised by the measurement |
| E4 | S3 for the other guards | kit `claude/miadi-chronicle-episode-kit/hooks/guard-mkdir-in-chronicle.sh` (heredoc parse), `miadi-session-observability` guards, `miadi-witness/hooks/raw-capture-guard.sh` | one fixture file per guard; H1 and H2 pass |
| E5 | S6 | jgwill/Miadi `packages/llmops` (`prompt check`, `prompt create`, `prompt get`), its tests over `screenwalk-questions.ts`; the `miadi-run` skill calls `prompt check` as verbatim | exit codes 0/2/3 on P3, P6 and a clean prompt; a v1 created in the `eng` project and read back pinned |
| E6 | S7 | jgwill/Miadi `packages/hooks-interpreter` (`guards` view); the lookup guard names it | the view over the E1 to E4 ledgers |
| E7 | S8 | kit `rispecs/self-improvement-cycle` scorer list and its pass | one `guard-fit` report over fourteen days of E1 to E4 ledgers |

E1 to E4 are independent of each other once E1's ledger format is fixed. E5 needs E1's check as a
module both the hook and the CLI import, or a copy pinned to the same fixtures. E6 needs E1. E7
needs E6.

## What the steps do not touch

- The words on the list and their senses. E1 changes the file's format; the entry stays as William
  wrote it, with the fourth and fifth fields empty.
- The `rules` a guard enforces. Only its scope parsing, its message and its record change.
- Any session, seat or pane. Fixtures are copies.

## Held for a named owner

| id | what | owner |
|---|---|---|
| H-1 | Allowed senses for the listed word, and whether override markers are enabled at all | the list's owner: the entry is William's word of 2026-10-26 in `forbidden-words.txt` |
| H-2 | The latency budget after E3's first measurement | Guillaume, with the T1 seat that keeps session continuity |
| H-3 | Whether `miadi-run create` records advice on a person's text, or skips the check for verbatim text | Guillaume |

## Taken in this packet, reversible

- **D1.** A person's verbatim words are checked for advice only (S1). The rule governs what agents
  write, and the factory keeps a person's words as said.
- **D2.** Code files are out of the gate's scope unless declared `prompt` (S1). The CSS property and
  identifiers are not the sense the rule names.
- **D3.** Synonyms are not added to the list (S2). Meaning is carried by S8 and by reviews.
- **D4.** One packet for the five domains, because they share one ledger and one evidence base.
  Each domain can split into its own packet when it is built.
