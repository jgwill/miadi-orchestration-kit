# 02 · Intent

## Desired outcome

The Factory knows why its sessions end before their work is done, in the words of the person
who ended them, and each reason that recurs has a named condition, a proposed change and a count
of whether it came back after the change.

Guillaume will know it exists when he can ask "why did seats end short this week" and read one
table: the reasons, the sessions behind each, the change proposed for each, and which changes
held.

## Current reality

- Claude Code records how a process ended (`prompt_input_exit`, `other`, `quit`). 482 of 1002
  interactive sessions on gaia recorded no end at all.
- The reason a person exits lives in their memory and, for two cases, in issue bodies
  (jgwill/Miadi#1060, jgwill/Miadi#1028). No record holds it.
- Since 0.1.49 a session can record its own reason at exit. No record carries one yet.
- The model each session ran is in the capture, and no door an agent may use exposes it.
- Changes that come from an exit (pinning `--model` on `mct new`, a model floor for requests) are
  proposed one at a time, from one remembered case, with no count before or after.

## Structural tension

Exits happen every day and each one says something about how the seat was launched or briefed.
That evidence is lost at the moment it is produced, so changes are made from memory and never
checked against what follows. Recording the reason at the exit and counting it across sessions
is what lets the next change be chosen from evidence and judged by the exits after it.

## The loop

1. **Exit with a reason.** At `/inventory-exit-reason`, or after the session ended, from the
   person's words relayed by any seat.
2. **One view of exits.** `miadi-hooks-interpret exits`: every end, its Claude Code reason, the
   person's reason when given, the model launched, started and answered, whether it was resumed.
3. **Investigation pass.** A seat groups the reasons into patterns. Each pattern names its
   sessions and the condition that produced it (a launch path, a brief, a folder, an account).
4. **Proposed change.** Each new pattern gets a drafted issue or a held decision. The person
   decides. The pass applies nothing.
5. **Recurrence.** The next pass counts the pattern's exits since its change landed, and reports
   it as held, recurring, or displaced (another pattern rose as this one fell).

The loop advances when a change lowers its pattern's recurrence and the change stays. It
oscillates when a change for one pattern raises another, for example pinning Opus on every
launch so that `wrong_model` exits move from "too weak" to "too costly". Step 5 names that
movement by comparing patterns across passes.

## Beloved qualities to keep

- The person's words are kept verbatim, as `/inventory-exit-reason` already does.
- The session that stops writes its own record, so no one has to ask a witness seat.
- A record is only ever added to. Facts belong to the script, meaning to agents, the reason to
  the person.
- Uncommitted work from a stopped session is listed and held, never committed or reverted.

## Boundaries

- **Specification only.** Nothing in 03 is built until Guillaume says so for that part.
- **A reason is the person's.** `exit.reason` is never written from inference. A pass may
  attach an `inferred_kind` to an exit with no reason, marked as a hypothesis with its evidence,
  and kept apart from given reasons in every count.
- **The pass changes nothing it reads.** No record field, no session, no pane, no `/exit`, no
  resume. Its outputs are its own pass file and drafted issue bodies.
- **Headless children are counted apart.** 415 of the 587 `other` ends are `claude -p` children.
  They are not seats a person exits.
- **The raw capture stays behind the interpreter.** The lookup guard stays on. The interpreter
  gains the verb.
