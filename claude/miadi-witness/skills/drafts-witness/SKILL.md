---
name: drafts-witness
description: >
  Go through the mctgo drafts that waited unsent for days, find what was implemented since each was
  written and what was not, let Jev say which of the candidate actions are obvious, write the open
  concerns as plot threads in the episodes they belong to, and share the pass as diary entries in a
  ceremony. Use when the nightly inventory line carries a `drafts` part with drafts waiting, when
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

## Rules that come before any number

- **A draft is staged, not consented.** Never send it, never type into its pane, never start the
  session it names. What a draft asks for is a question to Guillaume. Jev's band does not change
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
