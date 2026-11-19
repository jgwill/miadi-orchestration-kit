# 04 · Export

Where each part is built, and the gates that prove it. Nothing below is built until Guillaume
says so for that part.

| Part | Built in | Repository | State |
|---|---|---|---|
| S1 `/inventory-exit-reason` | `claude/miadi-session-observability/commands/` | jgwill/miadi-orchestration-kit | built, 0.1.49, jgwill/miadi-orchestration-kit@4a4f169 |
| S2 `inventory.mjs exit` | `claude/miadi-witness/scripts/inventory.mjs`, SCHEMA.md "Exit reasons" | jgwill/miadi-orchestration-kit, the workspace repository for SCHEMA.md | specified |
| S3 `exits`, `digest` model and end | `packages/hooks-interpreter` (`@miadi/hooks-interpreter`, 0.12.0 installed on gaia) | jgwill/Miadi | specified, issue drafted in `issues/02-miadi-hooks-interpret-exits.md` |
| S3 guard text | `claude/miadi-session-observability/hooks/session_lookup_guard.sh` | jgwill/miadi-orchestration-kit | after S3 is released |
| S4, S5 the pass | a miadi-witness skill, `exit-investigation` | jgwill/miadi-orchestration-kit | specified |

Order: S3 first, because S2 fills `models` from it and S4 reads only from it. Then S2, then S4
and S5 together.

## Gates

- **G1** `miadi-hooks-interpret exits --since 2026-09-28 --until 2026-11-19T12:35Z --json` on
  gaia reproduces the interactive counts of `01-reverse-engineer.md` (520 sessions with an end
  line, 482 without, end reasons 517, 172, 26, 2, 1).
- **G2** `digest 5ffaf964-f4cb-470d-a1da-35fdd040073a` shows `model.started: claude-opus-5-5`.
- **G3** `digest 675a74db-cbb8-4c91-a1f6-fe06c30851aa` shows `model.started: claude-sonnet-5-5`
  and `answered` holding both Sonnet and Opus, with about 120 Sonnet replies.
- **G4** `inventory.mjs exit` on a record that already has an `exit` block adds to
  `exit.later[]` and leaves `reason`, `kind` and `given_by` byte for byte.
- **G5** `inventory.mjs exit` with no `--reason` exits non-zero and writes nothing.
- **G6** A pass run over a copy of the inventory leaves every record byte for byte and writes
  only its pass file and drafts.
- **G7** Headless rows appear only with `--headless` or `--all`, and never in a pattern's count.
- **G8** The lookup guard's refusal names `exits`, and the read refused in session `5ffaf964`
  now has an allowed command that returns the same counts.

## After it ships

- SCHEMA.md "Exit reasons" gains `source`, `later[]` and the `exit-investigations/` folder.
- The session-continuity skill names `exits` beside `join` and `digest`.
- jgwill/Miadi#1060 and jgwill/Miadi#1028 receive the first pass's count for `wrong_model`.
