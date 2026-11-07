---
name: drafts-witness
description: >
  Go through the mctgo drafts that waited unsent for days, find what was implemented since each was
  written and what was not, let Jev say which of the candidate actions are obvious, write the open
  concerns as plot threads in the episodes they belong to, and share the pass as diary entries in a
  ceremony. Also covers what a mctgo draft is (mctdraft, mctgo, `MIADI_DRAFT_SESSION_ID`, tide) and how to start one a person brings to the seat. Use when he says "witness my draft" and "press enter", when the nightly inventory line carries a `drafts` part with drafts waiting, when
  ~/.miadi/drafts-witness/<yymmdd>.md exists unread, or when Guillaume asks to witness the mctgo-*
  drafts, the unsent prompts, or "what could be implemented now" from them. Triggers on "drafts
  witness", "mctgo drafts", "unsent drafts", "drafts that were never sent", "what was implemented
  since the draft".
---

# Drafts witness

A `mctgo` draft is a prompt Guillaume typed at a shell to start a session and did not send. tide
keeps it (`tide drafts`, Episode 548, miadi-chronicle://548). After a few days some of its work has
landed through other sessions and some has not. This pass says which, and turns what is still open
into plot threads and decisions. It was first done by hand on 2026-11-04. The record of that pass is
in miadi-chronicle://564 (`drafts-witness-261104/`), and its diary entries are in Episode 566's
ceremony (miadi-ceremony://db6120e2-0cb8-42fd-9761-cb664a64fd25).

## What a draft is

A draft is what comes before a session: a `mctgo` line at a shell prompt, kept by the factory until someone sends it, withdraws it or leaves it. Guillaume sometimes never sends one, and sometimes brings it to this seat so that the session and its witness start together. The commands are defined in `$MIADI_SRC/scripts/fn_miadi.sh`.

- **`mctdraft`** opens a tmux session `mctgo-<yyMMddHHmm>` and types `mctgo T` with `-<yyMMddHHmm>` after the cursor, without Enter. The person writes the team, a space and the name: `mctgo T8 t8-topic-<yyMMddHHmm>`.
- **The session id exists before the session.** `mctdraft` sets `MIADI_DRAFT_SESSION_ID` in the draft's tmux environment, and `mct new` passes it to `claude --session-id`. `tide drafts list --json` shows it as `session_id`, so the seat can name the session it will watch before it starts.
- **`mctgo <team> <name> ["primer"]`** is `mct new --remote -d "$@"`: a detached tmux session on the team, with `$MIADI_TEAM_LAUNCH` and Remote Control. A primer can also come from `--prompt-file`. It is pasted once the agent is ready. `mctsh` starts a shell alone on the team.
- **tide keeps the line** across a reboot (Episode 548, miadi-chronicle://548): `tide drafts list [--all] [--json [--text]]`, and `observe`, `ready`, `unready`, `withdraw`, `reopen` and `restore`. A draft's state includes `typing`, `parked`, `launching`, `started`, `sent`, `cleared`, `abandoned`, `restored` and `withdrawn`.

## A draft brought to this seat

His sent message can ask the seat to send a draft (2026-11-06: "witness my draft into 'mctgo-2611060710' and press enter so that it starts"). That message is the go for that one draft, and the first rule below still holds for every other draft.

1. **Read it.** `tide drafts list --json --text`, and the pane. `parked` means he stopped typing. `typing` means hold. The pane must run a shell, with the line complete and its closing quote in place.
2. **Check that the line can start.** Parse the text into its arguments. Set `MIADI_DRAFT_SESSION_ID` from `tmux show-environment -t <draft session>`, then run `mct new --remote -d --dry-run <arguments>`. In double quotes an interactive shell also acts on `!`, `$` and a backtick, so look for those.
3. **Change only what stops it, and say what changed.** The known case is a team and name joined by the hyphen `mctdraft`'s template invites: `mctgo T7-name "…"` answers `No team` with exit 2, and tide records the whole name as the team. Keep his name and primer as typed. With the cursor anywhere on the line: `tmux send-keys -t <pane> C-a`, `tmux send-keys -t <pane> -N 6 Right`, `tmux send-keys -t <pane> -l 'T7 '`. Run `tide drafts observe --pane <pane>` and read the new version back. The arguments must parse as team, name and primer.
4. **Press Enter once**, and read what the pane answers.
5. **Prove the start.** The tmux session exists. `tmux show-options -t =<name>: @miadi-team` names the team, and a `=name` target needs its colon. The draft's state becomes `started`. To see the primer arrive, match its own words, because every shell's banner prints `🧠🌸 always`.
6. **Stay with it.** Arm `witness-listen.mjs await --seat mino --watch <session id> --only-watched`. When its result arrives, check its marks, then bring Guillaume what it leaves and for whom. Handoffs that follow go one at a time per repository, each starting on the previous session's DONE line in a thread file (`.mino/threads/261106-what-teams-leave-the-writers.md` is the first).

## Rules that come before any number

- **A draft is staged, not consented.** Unless his sent message asks for that one draft (see above),
  never send it, never type into its pane, never start the session it names. What a draft asks for is a question to Guillaume. Jev's band does not change
  that (Sunwise Law, and P3 of the first pass).
- **His sent words come first.** When his message to this seat already asks for an act (for
  example "especially for creating plot threads"), that is the go, whatever band Jev gives it
  (D1, and miadi-chronicle://566 `missions-near-the-loop-261031.md`).
- **The words stay on this host.** Read them with `--words` for your own reading. Never put them in
  a committed file, a thread, a diary entry or a Jev request (Episode 548, Q5). Use labels, ids and
  your own description.
- **Never close a tmux session.** Withdrawing a draft only closes its record
  (`tide drafts reopen <id>` undoes it), and only an empty one or one he has ruled on is withdrawn.

## The pass

1. **Facts, no model.** `node scripts/drafts-witness.mjs facts --older-than-days 3 --out <file>`
   (the nightly inventory runs this at 03:30 and puts a `drafts` summary in the seat's inbox line).
   Each draft gets its session state, the commits in the repositories its labels name since it was
   opened (with or without an issue), and the chronicle commits and plot threads of each episode it
   names.
2. **Read the words, then check.** `... facts --words` for your eyes only. For each draft, check the
   commits that look related and record its state: done anyway, half done, open, or empty. Check a
   claim against the code before writing it. A commit subject alone does not show that the work is
   done.
3. **Cards.** Write each candidate action as a coded card (`<div id="A1">`) in a page, with the
   request (Guillaume's sent words, verbatim) and a facts file. Each card names the source of the
   word it rests on: his sent message, a draft, or the seat's own inference.
4. **Jev.** `skills/proposal-visualization/scoring/score-proposal.mjs <page> --request <r> --facts
   <f> --out scores.json --ledger ~/.miadi/decisions/proposal-score.jsonl` gives three bands: would
   do now, after your go, needs you. Apply the rules above to the bands.
5. **Plot threads.** For each open concern, find the episode it belongs to (the draft's addresses,
   the episode that holds the issue, the inventory record) and open a thread through the threads door
   (`POST /api/chronicle/episodes/{ref}/threads`, act `open`, then `beat` with commit refs). Run it
   with `dryRun: true` first, then land it when you have the go. Write no draft words into a thread.
6. **Record.** Put the page, request, facts, scores and a README in the episode that studies the
   decision engine (miadi-chronicle://564, `drafts-witness-<yymmdd>/`). Commit by path and push.
7. **Diary.** Write the pass as diary entries in the ceremony where the near-loop work is held
   (`POST /api/ceremony/{id}/diary`, `entryType` observation, data, learning or hypothesis). Say what
   was asked, what was found, what Jev decided, what was held and why, and what the pass taught.
8. **Settle before returning.** Before anything goes back to Guillaume, settle each open item
   yourself, in this order: his sent words (this session or memory) answer it, so act and record
   them as a ruling (lane-check `rule`, his words verbatim); evidence settles it, so measure and act;
   it is reversible and inside the work, so act and report; a live seat owns it, so brief that seat
   (dispatch-discipline) and watch its completion mark. Ask him only what names him (money, outside
   audiences, deletion, naming, another person's repository), once, with your recommendation and
   what you will do if he does not answer. Guillaume, 2026-11-04: "So you need me for what?"

## Phases

- **Phase one (2026-11-04):** the facts run every night with no model. A seat runs the rest of the
  pass when the morning line shows drafts waiting.
- **Phase two:** Jev decides whether the pass runs. `choose-worker` picks the worker for the morning
  line (self, Haiku, a seat), and `obvious_now` on "run the pass" replaces the seat's judgment.
- **Phase three:** Jev's reading of a card includes "start a seat to do it". A card with his sent
  word and Jev at or above the bar starts a session through `mctgo` with a brief, and the session's
  first beat goes on the card's plot thread. His rulings on earlier passes set the bars
  (`lane-check calibrate`).
