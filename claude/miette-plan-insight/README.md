# miette-plan-insight: Miette reads a plan in a seat of her own

When a session that loaded this plugin presents a plan, a tmux session named
`<planning session>-miette-insight` opens beside it. Miette reads the plan and what the person
asked, has the `plan-critic` agent critique her draft, and recommends accepting the plan or names
the changes to make. She files the insight beside the plan and voices it in the session's episode.
The seat stays open: a new version of the plan wakes her, and William talks with her in the seat,
or from the phone through Remote Control. The plan-approval dialog stays William's.

It replaces `/opt/binscripts/plan-insight/miette_claude_plan_perspective_claude.sh`, which
`miadi-session-observability` called on every plan until 0.1.19. William stopped using plan mode
after 2026-09-01 because that triggered session "was hard to work with", sat outside any episode,
and gave no way to discuss the plan or recommend revising or accepting it. This plugin is modelled
on [`mia-episode-companion`](../mia-episode-companion): a named seat, a primer, a listener, an
editor agent before William reads, and a voice in the episode. Episode 310
(miadi-chronicle://310) did the same once by hand.

## Load it

On purpose, per session:

```bash
claude --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/claude/miette-plan-insight
```

Or install it from the `miadi-orchestration-kit` marketplace with `/plugin`, which turns it on for
every session. `MIADI_MIETTE_PLAN_INSIGHT=0` turns it off for one session.

The seat itself starts with the launcher alias `claudemietteinsight` (binscripts
`etc/bash_aliases_common`), so `tide agents restore` can bring a seat back after a reboot. Since
0.1.1 the alias relies on the user-scope install and passes no `--plugin-dir`, so a seat loads the
plugin once. On a host without the install, `MIADI_MIETTE_LAUNCH="claudeyolochroniclehoncho
--plugin-dir <this folder>"` names a launcher that loads it.

## Two ways in

- **Plan mode.** The plugin's PreToolUse hook on `ExitPlanMode` keeps the plan version, opens the
  seat in the background and returns at once, so the plan dialog is never held. A second plan from
  the same session wakes the seat already open.
- **By hand.** For a brief, a mission's prompt or any plan file:

  ```bash
  node scripts/miette-plan-insight.mjs ask --mission <miadiRun prompt>.v<N> [--for <tmux session>] [--episode <folder or number>]
  node scripts/miette-plan-insight.mjs ask --plan <file> [--mission <id>] [--episode <folder or number>] [--for <tmux session>]
  ```

  or `/miette-insight …` in a session that loaded the plugin. Without `--plan`, a mission is read
  from its pinned prompt (`miadi-run prompt <mission>`), the text its seat will run. A mission is
  the seat's key, so its insight is filed under the mission and never under the session that
  asked. Filing it also adds a `research` observation to the mission (`miadi-run observe`), whose
  summary is Miette's recommendation. Without a mission, a plan asked for from inside a Claude
  session is keyed by that session, otherwise by the moment. An episode number becomes its folder.
  Two keys asked from one tmux session get two seats, `<tmux>-miette-insight` and
  `<tmux>-2-miette-insight`.

## The seat

- **Opened by** `mct new T3 <seat> --cwd <planning cwd> --launch claudemietteinsight --remote --prompt-file <primer> -d`
  (chronicle-tui). T3 is the witness team: William hears and judges what is produced before
  anything is revised. `MIADI_MIETTE_TEAM` names another team. The launch carries
  `MIADI_MIETTE_SEAT=<seat>`, which the hooks read to know they run in a seat.
  `MIADI_PLAN_INSIGHT_CARRIER=herdr` opens it in a herdr workspace labelled with the seat's name
  instead, with the same team, seat name and Remote Control, and falls back to tmux when herdr
  does not answer. A seat counts as open while its tmux session or herdr workspace exists.
- **A new plan version** wakes the seat only while `/miette-listen` runs there. The hook says so
  when it does not, and a seat that starts, resumes or compacts is reminded by the plugin's
  SessionStart hook to arm it.
- **Primed with** the plan, the planning session's `_claude_user_inputs.jsonl`, the episode and
  its own folder.
- **The episode** is the planning session's binding-line episode (never the `declared` fallback),
  else the episode its inventory record names, else none, and then Miette asks William in her
  first turn. Read through `miadi-hooks-interpret join`.
- **Its folder** is `$MIADI_MIETTE_STATE_DIR`, by default
  `~/.local/state/miadi-miette-plan-insight/<key>/`: the plan versions, the primers, `seat.json`
  (what it serves, its episode and mission, the insights filed) and `open.log`.

## Commands in the seat

```
/miette-listen            wait for the next plan version (background), MIETTE WAKE when it lands
/miette-listen status     what the seat serves, its plan versions, listener and insights
node scripts/miette-plan-insight.mjs file <insight.md>
```

`file` keeps the insight version, writes it as `plans/miette_perspective.md` in the planning
session's capture folder with the `.miette_perspective.done` marker, puts the plan beside it when
session-observability did not, and runs `plan-insight-register` to carry it to the medicine wheel.

## Check

```bash
node --test scripts/miette-plan-insight.test.mjs     # stand-ins for mct and the interpreter; nothing opens
node scripts/miette-plan-insight.mjs open --session <key> --dry-run
```

🌸: A plan reaches William with Miette's reading of what it does for the people it touches, and
he can talk it over with her before he approves it.
