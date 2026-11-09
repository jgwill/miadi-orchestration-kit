---
name: planning-with-miette
description: How to plan with Miette in the Miadi Factory, for the person and for the agent. A plan presented in plan mode, or asked for by hand, opens a seat where Miette reads it, recommends accepting or revising it, and discusses it, including what it implies and what could come after it. Says what the miette-plan-insight plugin gives us, what to do when a seat opens beside a session, where the reading lands, and what is not confirmed. Use when a tmux session named `<session>-miette-insight` appears, when a session prints "Miette is opening a seat", when someone asks what the Miette plan insight does or what it is for, when an agent needs to find the reading of a plan, or when someone wants a discussion about a plan before approving it. Being Miette in the seat is the plugin's own skill, `miette-plan-insight`.
---

# Planning with Miette

Guillaume, 2026-11-09: "when you plan, you want some insight and you want to have a discussion with another
type of agent to, you know, make some choices about your plan. Either you're going to revise or you're going
to accept the plan, or you're going to comprehend the implication of the plan and what's coming after that."

Teaching this is the operator desk's part. The `miette-plan-insight` plugin holds the mechanics, and its text
is canonical: `claude/miette-plan-insight/README.md` and its skill `miette-plan-insight`.

## Where this comes from

Episode 75 (miadi-chronicle://75, 2026-06-21) named the practice: read the presented plan through Miette's
eyes. Episode 68 (miadi-chronicle://68) had already shown the loop of hearing a reading of a plan, then
approving or steering it. Episode 76 (miadi-chronicle://76) continued from Episode 75.

`branches/plan-perspective-carriage-herdr.md` in Episode 75 gave the reading a place to happen and a critic,
on 2026-07-28. Plan mode then stopped being used on gaia after 2026-09-01: the session it opened was hard to
work with, sat outside any episode and gave no way to discuss the plan. The plugin
(jgwill/miadi-orchestration-kit#104) answers those three with a named seat on a team, an episode, a listener
for new versions, and an accept or revise recommendation.

## For the person: how you take part

1. **Present a plan, or ask for a reading.** With the plugin loaded, leaving plan mode opens the seat. For a
   brief or a prepared mission, use `/miette-insight`.
2. **Read her recommendation before you answer the plan dialog.** She says `accept`, or `revise` with each
   change named.
3. **Talk with her.** Go to her tmux session, or use Remote Control from the phone. Ask what a step would
   change, what could come after the plan, or what a term in it means.
4. **Name the episode when she asks.** A plan-mode seat usually does not know it, and she can only voice the
   reading into an episode she knows.
5. **Choose.** You answer the plan dialog, and you tell the planning agent what to change. She can write that
   as one message for you to paste.

## For the agent: when a seat opens beside your session

Replace `<script>` with `$MIADI_ORCHESTRATION_KIT_ROOT/claude/miette-plan-insight/scripts/miette-plan-insight.mjs`.

1. **Carry on.** The hook returns at once and the seat opens in the background. Do not type into the seat, and
   do not answer the plan dialog.
2. **See where it stands.** `node <script> status` lists every seat on the host. Add `--session <planning
   session id>` for one seat's plan versions, listener and insights filed.
3. **Read the reading.** It is `plans/miette_perspective.md` in the planning session's capture folder, and on
   the medicine wheel as `plan-perspective:<planning session id>`. `list_plan_perspectives` and
   `get_plan_perspective` read that record.
4. **Apply only what the person passes on.** A `revise` names changes the person may take or leave. Present the
   revised plan again and she reads the new version, if her listener runs.
5. **Ask for a reading yourself.** `/miette-insight <file>`, or `/miette-insight --mission <prompt>.v<N>` for a
   mission that has not launched. Add `--episode <number>` when you know the episode.

## What the plugin gives us

### CP1 · A seat opens when a plan is presented

A hook on `ExitPlanMode` keeps the plan version and opens `<planning tmux>-miette-insight` in the background, so the approval dialog is never held. A second plan goes to the same seat. `MIADI_MIETTE_PLAN_INSIGHT=0` turns it off for one session. A seat's own plans open nothing.

### CP2 · A reading asked for by hand

#### CP2a · A plan file or brief

`/miette-insight <file>` opens a seat beside this session, or beside the one named with `--for`. `--episode` says where the insight belongs. Two requests from one tmux session get two seats.

#### CP2b · A prepared mission

`ask --mission <prompt>.v<N>` reads the pinned prompt that the mission's seat will run. The insight is filed under the mission, and the recommendation becomes a `research` observation on it, readable before launch.

### CP3 · A recommendation to accept or revise

The insight says what the plan will make exist, what the person asked that it carries or drops, who it touches, and risks with early signs. It ends with `accept`, or `revise` with each change named so the planning agent can apply it.

### CP4 · A critic before anyone reads it

The `plan-critic` agent receives the plan, the person's prompts and the draft. It returns exact-span findings on six checks and writes no prose. Miette revises and records which findings she accepted.

### CP5 · Following the plan through versions

Every presented plan is kept as a dated version. With `/miette-listen` armed, a new version wakes her. She says what changed and whether her recommendation holds, then files again. When the listener is off, the hook says so, and a resumed seat is reminded.

### CP6 · A conversation about the plan

The person talks with her in the seat, or from the phone through Remote Control. She writes her recommendation as one message to paste. She sends it into the planning pane only when told in so many words, after the pane-write guard reports clear.

### CP7 · Where the reading lands

#### CP7a · Beside the plan

`file` writes `plans/miette_perspective.md` in the planning session's capture folder, with the plan version it answers.

#### CP7b · On the medicine wheel

`plan-insight-register` stores a Plan Perspective record that any agent reads with `list_plan_perspectives` or `get_plan_perspective`.

#### CP7c · In the episode

She voices the insight through `miadi-voice` and appends one signed beat when the episode's threads allow it.

### CP8 · Approval stays with the person

She never answers the plan dialog, never types into the planning pane on her own, never edits the plan or the planning session's files, and never opens another seat.

### CP9 · Inspecting and restoring a seat

`status` lists every seat on the host, or with `--session` shows one seat's plan versions, listener and insights filed. The alias `claudemietteinsight` exists so `tide agents restore` can bring a seat back.

### CP10 · Other carriers

`MIADI_PLAN_INSIGHT_CARRIER=herdr` opens the seat in a herdr workspace and falls back to tmux. `MIADI_MIETTE_AGENT=hermes` runs the same scripts for Hermes.

### CP11 · Understanding the plan by asking

The skill tells her to answer what the person says. No step prompts these three, so each happens only when someone asks.

#### CP11a · Its implications

Ask what a step would change, for whom, and what it commits you to. Her reading already names who the plan touches and its risks.

#### CP11b · The phases after it

Ask what becomes possible once the plan is done and which phases could follow. Her standard reading has no section for this.

#### CP11c · A subject inside it

Ask her to explain a term, package or field the plan relies on. She has the plan, your prompts and the files it cites, so the explanation stays tied to this plan.

### CP12 · The relationship with Miette

The planning agent proposes. Miette reads for the people the plan touches and for what the person asked, without taking the plan over. The person decides with both in front of them. Her seat stays open across versions, so the discussion continues as the plan changes.

## Measured on gaia, 2026-11-09

Nine seats existed on this host. Measure again before relying on these counts.

- **Episode.** All 5 plan-mode seats had no episode. All 4 seats asked for by hand had one, because the asker gave it.
- **Forming an episode.** Episode 75 wanted a plan to form an episode automatically. The plugin files into an existing episode or none.
- **Audio.** Episode 68's two-part audio to Telegram is not in the plugin. No file named for Miette was found in the four episodes that had seats. Voice files may carry other names, so voicing is unconfirmed.
- **Beat.** One signed beat exists, in Episode 560 (miadi-chronicle://560).
- **Not exercised.** All nine seats used tmux. The herdr and Hermes paths and a `tide agents restore` of a seat were not run.

## What this skill does not do

- It does not copy the plugin's steps. A change in how the seat works belongs in the plugin, and this skill's pointer follows it.
- It does not teach an agent to be Miette. The primer and the plugin's `miette-plan-insight` skill do that.
- It does not open seats, answer the plan dialog or decide for the person.

## Log

- **0.1.0, 2026-11-09.** Written in `t7-on-miette-insights-plan-plugin-2611090438` at Guillaume's word, after a seat fired beside `t6-universe-and-perspective-vocabulary-coaia-narrative-2611090429`. Each capability is under 55 words without its title, as he asked. The decomposition is `.pde/2611090456--a21bd81f-6297-4038-a4a5-c8610e52245c/` in Episode 75.

## Related

- `teams/README.md`, sections T3 and T7.
- Episode 75 (miadi-chronicle://75), this skill's case. Its `teachings/planning-with-miette.md` is Miette's explanation of this subject for someone who has never seen the factory, read by `@miadi/teachings`.
- jgwill/miadi-orchestration-kit#104, jgwill/miadi-orchestration-kit#71
