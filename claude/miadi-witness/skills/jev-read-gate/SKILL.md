---
name: jev-read-gate
description: >
  Before reading a file for a mission, send the mission and the file to Jev and read only what
  it admits. One call per candidate file, in parallel, a third of a second each; the file is
  Jev's state and never the seat's context until the verdict says read. Verdicts: read whole,
  skim the heading Jev picked, skip unread. Every decision lands in a ledger with its bar written
  beside the number, and a read made against a verdict is recorded as a ruling. Use when a
  mission names more files than the seat should open (a survey of a week's episodes, a staging
  folder, an inquiry shelf, the PDE's files_needed list), when "which of these should I read"
  is the question, or when a person says the context is being cluttered. Triggers on
  "read gate", "should I read", "which files matter", "don't read a hundred files",
  "send it to Jev first".
---

# The read gate

William, 2026-10-30: "you don't look at the file, but you send into that decision engine with
somehow the mission or what we're trying to do, and it gives you a score like, should you read it
or should you not read it ... If it's not, you don't read it." The seat interprets and composes
the questions; Jev decides. The form is Episode 564's levels 8 and 9 (miadi-chronicle://564,
`jev-study-261026.md`): a file is the state and the agent never reads it, one call per file.

## The protocol

1. **Write the mission in two or three sentences**, as what is being done next and for whom,
   not as a rule. A broad mission admits almost everything (the first trial's "what the newest
   episodes changed" admitted ten of fourteen files); a narrow one cuts. The mission goes in the
   state as data. Never put a rule in the state (study 2.3 measured what a rule in the state does).
2. **Gather the candidates by listing, never by reading**: `ls`, `find`, an episode's file list,
   `git log --name-only`, the tmux list, the PDE room's `files_needed`. Photos and audio are
   pruned by name; the gate judges text.
3. **Run the gate**, dry first when the set is new, then for real:

   ```bash
   G=${CLAUDE_PLUGIN_ROOT:-/workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-witness}/scripts/read-gate.mjs
   node "$G" --mission-file mission.md [--known-file known.md] [--recursive] --dry <file|dir|glob>...
   node "$G" --mission-file mission.md [--known-file known.md] [--recursive] <file|dir|glob>...
   ```

4. **Read by verdict, and only so.**

   | verdict | what the seat does |
   |---|---|
   | `read` | reads the file whole when `action` is `read_whole` above the bar; otherwise reads the picked `section` (the line Jev named) and the beginning |
   | `skim` | reads the picked section or the first forty lines, nothing more |
   | `skip` | does not open it; names it in the report as skipped by the gate |
   | `ask` | Jev did not answer; the seat decides with its own eyes and records a ruling |

   `sed -n 'A,Bp'` on the section is the read. A file over the state budget (about 25k tokens)
   is judged on its first forty lines and heading outline, and the record says `basis: outline`:
   a verdict on an outline is a verdict on the outline.
5. **Record departures as rulings.** A read against a `skip`, or a skip against a `read`, is
   written beside the decision: `node "$G" --ruling read|skip --by <who> --path <file> [--words
   "<verbatim>"]`. William's word on a file is a ruling too. Nothing is calibrated until twenty
   rulings exist in a class (study F1 and S5); until then the bars are starting lines.
6. **Report** the verdict table, the lines read against the lines offered, the tokens paid and
   the ledger path. Name what was skipped so the person can rule.

## The numbers, and what they measure

- `relevant` is a noul: the probability that reading the file would change or ground what is
  done next for the mission. Read at ≥ 0.7, skip at ≤ 0.3 (TypeSafe's suggested yes and no
  lines), skim between.
- `action` is a choice of four (`read_whole`, `read_part`, `skip`, `later`); its confidence is a
  shape statistic, and the bar 0.6 is a top probability of 0.7. Both are in the record.
- `section` is a choice whose options are the file's own headings (level 1 to 3, keyed by line)
  plus `none`, so the pick is a real place in the file.
- `new_to_us` (only with `--known`) asks whether the file adds to what the seat already holds.
  In the first trial it read 0.73 to 0.93 on every file and separated nothing. Treat it as a
  column to watch, not a cut, until its criteria are rewritten (kit issue, action step 4).

## What leaves the host, and what it costs

The mission, the known text, and each file's text (or its outline) go to the Jev service the
key belongs to (`JEV_AI_API_KEY`, jev-ai.pro), pinned to `jev-1.14.0`. Nothing else. Do not
gate a file that holds a credential, a person's private page, or words not cleared for a third
party: the gate sends the file.

Measured 2026-10-30: 14 files, 2 seconds, 53,831 paid input tokens, about $0.0023 at TypeSafe's
$0.042 per million, about $0.03 at jev-ai.pro's dearest pack. A 15k-token file costs about the
same as a 2k one to judge, so the saving is in the seat's context, not in Jev's bill: ten files
read by their sections came to about 500 lines where the candidates held 1,100 and the study
behind them 702 more.

## What the gate does not do

- It does not read for the seat. A `read` verdict is a permission to read, and the seat still
  reads.
- It does not know what the seat has read; `--known` is the seat's own statement of it.
- It does not open sessions. A session capture as a candidate is judged on its outline only;
  the state for a session is its digest (`miadi-hooks-interpret digest`), to be wired (kit
  issue, action step 7).
- It does not decide the mission. When two missions compete, run the gate twice and compare.

## Kin

- `choose-worker.mjs` beside it: which worker takes a task, the same decider and ledger shape.
- `score-lanes.mjs`: the band a plan's lanes get before dispatch.
- The proposal scorer (jgwill/miadi-orchestration-kit#80): one call per card, the same form.
- `pde-vessel-ceremony`: the PDE room whose `files_needed` list is the gate's natural input.
- Ledger: `~/.miadi/decisions/read-gate.jsonl` (`READ_GATE_LEDGER` for another file).
