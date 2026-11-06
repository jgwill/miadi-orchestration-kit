# 01 Reverse-engineer: the prototype run of 2026-11-04

## Where it ran

| role | who | where |
|---|---|---|
| the maintainer | William (jgwill), who gave each instruction | on eury, through the phone and tmux |
| the relative | Jerry | user `gmusic` on eury; his settings and his Claude sessions |
| the relative's session | T5 `d8e16584-a820-4346-a0b0-0bb6cef4d216`, tmux `t5-plugin-miadi-session-observability-and-llmops-packages-2611040607`, pane `%14` | launched with `--remote-control`, plugins from this kit |
| the witness seat | `6ad00fd4-17be-423a-8a7a-abacd07deffb`, tmux `t8-gmusic-gather-feedback-from-tmux-t5-plugin-miadi-session-observa1-2611040627` | user `mia` on eury |

## What the witness did, in order

1. **Read the peer.** It used the hook capture in `/src/_sessiondata/<session id>/` to see William's inputs, the last reply, the tool calls and the files written. The capture is readable by other users because `miadi-perms` gives the group read on it.
2. **Listened.** It started `witness-listen.mjs await --watch <id> --only-watched`. The listener showed T5 as "not running" while T5 was finishing a turn. Its status comes from `~/.claude/sessions/<pid>.json` of the seat's own user, and gmusic's registry is mode 700. The seat replaced it with a loop over the capture that wakes when T5 records a new Stop line, gets a new user input, or changes a file in its folder.
3. **Kept the inventory.** It wrote one record per session in `~/workspace/.mino/session-inventory/` and William's words in `~/workspace/.mino/asks/mino.json`, then pulled `miadisabelle/workspace` from gaia (348 commits) and pushed on top.
4. **Gave a first impression.** It read T5's handle and told William, without paths or code, where the page was still dense. It asked three feedback questions. William skipped them and asked for a steer.
5. **Related the work.** It read Episodes 250 to 259 and wrote `relations.md` in the staging folder. It added 259 to Episode 250's routes as a reserved first chapter and pushed that.
6. **Steered.** It wrote the steer as a file in the folder (`.mia/witness-steer-261104.md`): William's words verbatim, the task, what was not T5's, and the marks that would prove it done. It checked the pane with `pane-write-guard.sh` (exit 0: prompt empty, not mid-turn). Then it typed one line telling T5 to read the file, pressed Enter and read the pane back. The pane was reached with `sudo -n -u gmusic tmux`, which works because user `mia` holds `NOPASSWD: ALL` on eury.
7. **Followed.** A loop over the capture woke the seat when T5's turn ended. All four marks were present: 259 in the timeline, the feedback route in `AGENTS.md` and the handle, `atelier-for-jerry.md`, and a last message that starts "Jerry,".
8. **Landed.** gmusic cannot commit in the chronicle. The seat ran the folder's staging script, which opened miadisabelle/chronicle-sessions#103 and committed the folder, then pushed the chronicle.
9. **Checked the go steps before Jerry runs them.** It found the four apt upgrades waiting, the kit marketplace configured in gmusic's account and GitHub reachable. Plugin 0.1.31 wires all 14 scripts that Jerry's settings wire, plus three guards. It added the guards to the folder's `AGENTS.md` and pushed.
10. **Waits.** The seat watches T5's turn ends and the folder until Jerry picks up the handle, and lands each change.

## What it could see and what it could not

| it could | it could not |
|---|---|
| the capture of every session on the host (`/src/_sessiondata`) | the relative's session registry (`/home/gmusic/.claude/sessions`) |
| the relative's pane, through sudo | the relative's Claude socket (`/run/user/1000/cc-socks`) |
| the chronicle, as a user who may commit | the relative's transcript under `/home/gmusic/.claude/projects` |
| the relative's settings, through sudo | whether `SendMessage` reaches a session of another user (not tried) |

## Qualities worth keeping

- The relative is addressed once, in his own session, by name, in plain words, with one decision.
- Steers live in files in the folder, where the next agent can read them. The pane only gets one line pointing at the file.
- Each step names its proof before it runs, and the seat checks the proof itself.
- Feedback is written down word for word and never summarised.

## Run log (appended at each wake)

| at (UTC) | what happened | proof |
|---|---|---|
| 2026-11-04 11:15 | T5's first handoff to Jerry, judged too technical by William | T5 capture, `last_claude_AssistantResponse.json` |
| 2026-11-04 11:32 | T5's staging folder written | chronicle `f259d23b` |
| 2026-11-04 11:41 | steer delivered and read back | `.mia/witness-steer-261104.md` |
| 2026-11-04 11:43 | steered turn ended, four marks present | chronicle `f259d23b`, `a78b4f44` |
| 2026-11-06 02:03 | Jerry opened T5 himself: "tell me in a short 55 word explanation what william prepare for me i dont get it". T5 answered in under 55 words and wrote his words in `feedback.md`. The relative's first contact was a request for less. | chronicle `b52d966d` |
| 2026-11-06 02:05 | Jerry: "which session? this one here?". The word "session" was the next thing he did not have. T5 explained it from the conversation he was in and told him he can say go there. | chronicle `d89db8ff` |
| 2026-11-06 02:09 | Jerry: "you see the one i just launch?". He had opened a second session, in a tmux he named `handle-for-jerry`, called it JamAI and asked it for the musical direction in the kit's issues. T5 found it and showed him it was already being recorded, which is the same check the switch asks for. His attention went to the music, the second page of the handle. | capture `0666437f`, workspace inventory |
