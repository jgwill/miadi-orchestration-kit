<!-- Draft. Send with:
gh issue create -R jgwill/miadi-orchestration-kit \
  --title "Every session exited short carries its reason, and a periodic pass turns recurring reasons into proposed changes whose recurrence is counted" \
  --body-file rispecs/session-exit-reasons/issues/01-kit-session-exit-reasons.md
(remove this comment block first) -->

## Context

Measured on gaia on 2026-11-19 (rispecs/session-exit-reasons/01-reverse-engineer.md):

- 1002 interactive Claude Code sessions since 2026-09-28. 520 wrote an end line, 482 never did.
  The end line's reason is how the process ended (`prompt_input_exit` 517, `other` 172, `quit`
  26), never why the person ended it.
- 2295 of 3760 starts are resumes, so an exit is often not the end of the work.
- 3189 of 3312 interactive starts name no `--model`. The model each session ran is in its
  capture and transcript, and no door an agent may use exposes it.
- The inventory holds 465 records and none carries a reason for exiting. Known reasons live in
  issue bodies (jgwill/Miadi#1060, jgwill/Miadi#1028).
- `/inventory-exit-reason` (miadi-session-observability 0.1.49,
  jgwill/miadi-orchestration-kit@4a4f169) now lets a session record the person's reason at exit.

## Desired State

Every session a person exits before its work is done carries the reason in their words, given
at the exit or later. A pass reads all exits through `miadi-hooks-interpret exits`, groups the
reasons into patterns with their sessions, and holds a proposed change for each new pattern.
The pass after a change landed reports whether that pattern recurred.

## Action Steps

- [ ] S3: `miadi-hooks-interpret exits` and the `digest` model and end fields (jgwill/Miadi, issue drafted beside this one)
- [ ] S3: the lookup guard's refusal names `exits`
- [ ] S2: `inventory.mjs exit` adds a reason after the session ended, never rewriting one given at exit
- [ ] S4: the investigation pass, a miadi-witness skill that writes `~/workspace/.mino/exit-investigations/<stamp>.json` and drafts, and changes no record
- [ ] S5: recurrence counted for each pattern whose change landed
- [ ] Gates G1 to G8 of rispecs/session-exit-reasons/04-export.md pass on gaia

## Structural Tension

Each exit says something about how a seat was launched, briefed or set up, and that evidence is
lost when the pane closes. Recording the reason and counting it across sessions lets each change
be chosen from evidence and judged by the exits that follow it.

## Related

- Specification: rispecs/session-exit-reasons/ (jgwill/miadi-orchestration-kit)
- jgwill/miadi-orchestration-kit#56, jgwill/miadi-orchestration-kit#76, jgwill/miadi-orchestration-kit#89
- jgwill/Miadi#1060, jgwill/Miadi#1028, jgwill/Miadi#1008, jgwill/Miadi#913
- jgwill/Miadi#746, jgwill/Miadi#806, jgwill/Miadi#805, jgwill/Miadi#857, jgwill/Miadi#869
- jgwill/gaia#90, jgwill/gaia#97
- Born in session `5ffaf964-f4cb-470d-a1da-35fdd040073a`, miadi-tmux://mia@gaia:t1-exit-not-on-completion-2611190727
