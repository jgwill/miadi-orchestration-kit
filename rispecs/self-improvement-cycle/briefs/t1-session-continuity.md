# Brief: T1, continuing the self-improvement cycle

Written 2026-11-19T13:21Z by the T1 seat (Claude Opus 5.5,
miadi-tmux://mia@gaia:t1-exit-not-on-completion-2611190727, session
5ffaf964-f4cb-470d-a1da-35fdd040073a). For whichever T1 seat takes this up, this one resumed or a
new one.

## Your task

Build jgwill/miadi-orchestration-kit#161 in the order of `rispecs/self-improvement-cycle/03-specify.md`:
S8 `factory/definitions.yaml`, then S2 the scorer format and the scorers that read only the
record and the capture (`exit-reason`, `left-uncommitted`, `handed-back-finish`), written to
`scores[]` by the nightly pass. These do not wait on jgwill/Miadi#1062. `wrong-model` follows it. jgwill/miadi-orchestration-kit#162 (exit reasons) builds its pass as
#161's steps for the scorer `exit-reason`.

## Where things are

- The kit: `/workspace/repos/jgwill/miadi-orchestration-kit`, `claude/miadi-witness/scripts/`
  (`inventory.mjs`, `inventory-at-exit.mjs`, `nightly-inventory.sh`), `claude/miadi-session-observability/`.
- The inventory: `~/workspace/.mino/session-inventory/` (miadisabelle/workspace), its `SCHEMA.md`.
- The decomposition of Guillaume's request: `~/workspace/.pde/2611190812--ef9db617-3bd8-4389-934c-eacc3347f02b/`.

## Held, and by whom

- Version 9 of miadi-review:d47ef197-8fc2-4f81-be25-67d4e335d104, its section on how the factory uses
  the talk: staged in `rispecs/self-improvement-cycle/review/`, published only on Guillaume's
  approval of the exact text.
- The inventory commits stranded on gaia since 2026-11-16 were merged and pushed on 2026-11-19
  (miadisabelle/workspace@8280093), and eury was brought to the same commit. The writers still push
  once and stop: jgwill/miadi-orchestration-kit#163 holds the fix.

## Outside this brief

- jgwill/Miadi#1062 and #1063 (T8), jgwill/medicine-wheel#178, the episode (the production team).

## Done when

- `factory/definitions.yaml` and `scorers/` exist in the kit, the nightly pass writes `scores[]` on
  gaia, SCHEMA.md has a "Scores" section, each committed and pushed, and #161's steps are ticked.
