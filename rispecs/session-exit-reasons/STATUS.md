# STATUS

## 2026-11-19 · specified

- **Exists:** S1, `/inventory-exit-reason`, miadi-session-observability 0.1.49
  (jgwill/miadi-orchestration-kit@4a4f169), with SCHEMA.md "Exit reasons" in the inventory folder.
  Since 2026-11-19T12:45Z one record does: session 675a74db-cbb8-4c91-a1f6-fe06c30851aa, `wrong_model`.
- **Specified, not built:** S2 `inventory.mjs exit`, S3 `miadi-hooks-interpret exits` and the
  `digest` fields, the guard text, S4 the investigation pass, S5 recurrence.
- **Issues:** jgwill/miadi-orchestration-kit#162 and jgwill/Miadi#1062, under jgwill/miadi-orchestration-kit#160.

## Decided 2026-11-19 by the T1 seat

Guillaume, 2026-11-19: what is built first is the agents' coordination, not his.

- **D1, the order:** S3 first (jgwill/Miadi#1062), then S2. S4 and S5 are built as
  `rispecs/self-improvement-cycle/` S3, S4 and S7 for the scorer `exit-reason`.
- **D2, the cadence:** the nightly pass checks the counts, and a pattern of three sessions in
  fourteen days starts the investigation, as Warp's "37 failed runs" item comes from a count
  (`../self-improvement-cycle/03-specify.md` S3). The figures are starting values, and recurrence
  shows whether they are adequate.
- **D3, the drafts:** sent as children of jgwill/miadi-orchestration-kit#160:
  jgwill/miadi-orchestration-kit#162 and jgwill/Miadi#1062.
