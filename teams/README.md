# Teams

Named 2026-09-28, the morning gaia rebooted, in the witness session `mino-260928-fork-01` with William. The story and the drawings: https://claude.ai/artifact/MArxUrUa8x9YjfCiRL1Dfs (After the Reboot).

## How teams work

- Every terminal session belongs to one team.
- Each team has a **human lead** and an **agent lead**. Leads coordinate with the other teams' leads.
- A building team makes packages and practices that the other teams use. The witness team builds only its own tools: it hears their work for William first, keeps the records, and builds the witness plugin (claude/miadi-witness). Each team names what it makes and what it uses.
- Each team's practice becomes a skill in this kit, written by the team from its own work.
- A team's section below is kept current by its agent lead.
- `teams/teams.json` is the same list for machines: each team's sessions, folders and name patterns. The session-observability plugin reads it to put each session's team in its binding line (jgwill/miadi-orchestration-kit#56). Change both together.

## T1 · Session continuity

- **Level:** the machine.
- **Desired outcome, in William's words (2026-09-28):** "Picture that I'm rebooting my computer and when it comes back up, all of the sessions are the same way that they were. I should not even know that the computer rebooted."
- **Leads:** William (human). The gaia session `gaia-tmux-rebooted-restore-finetuning-260928` (agent).
- **Makes:** the capture hooks (`/opt/binscripts/hooks/*`) and their binding line (`hooks/claude_hooks/terminal_binding.sh` for Claude, `hooks/terminal_binding.sh` for the other agents: every agent session start, end and rename with its tmux `session:window.pane`, argv, name, team and chronicle episode), tmux save and restore (`jgwill/gaia` `14-tmux-resurrect.sh` and its two hooks), tide runtime (`ironsilk`, `tide agents list` and `tide agents restore`) and its snapshots, the session-observability plugin (jgwill/miadi-orchestration-kit#56), the session inventory format.
- **Makes (boot safety):** what keeps gaia from hard-resetting under load, so the restore runs less often: the CPU frequency cap applied before `sysinit.target` on every boot (`linux_migration/00-cpufreq-cap.sh` in jgwill/gaia, jgwill/gaia#92).
- **Uses:** Claude Code's session records (`~/.claude/sessions/<pid>.json`, transcripts), the launch aliases in `/opt/binscripts/etc/bash_aliases_common` that load each agent's tools and plugins, the chronicle root (`MIADI_CHRONICLE_ROOT`) and `MIADI_CHRONICLE_PROD_EPISODE`.
- **Proposal:** https://claude.ai/artifact/Hu5WwqkWTsGQuwESxwmD5q (Tmux Agent Restore, revision 4).
- **Done 2026-09-28:**
  - A1, which agent each tmux session held at the crash of Sunday 2026-09-27 19:31:47: `miadi-chronicle/_staging_for_new_episodes/gaia-miadi-tide-runtime-session-inventory-enhancements-260928/A1-recovery-candidates.md` in the episodes repository, with the launcher inventory `RP1-launch-aliases.md` beside it.
  - A2, the binding line, jgwill/binscripts@817eb85, checked in one tmux pane through start, rename, /clear, exit, resume and exit.
  - A3, tmux saves every 15 minutes with visible screens, keeps the folder of panes with an empty title, and hands the agents to tide after a restore: jgwill/gaia@8c82a36, live on gaia, jgwill/gaia#89 closed.
  - A4, tide 0.9.35 (jgwill/Miadi@ffdcfa90): starts after every reboot, names the agent in each pane, and brings agents back after a restore with their launch alias and tools. Checked end to end on a private tmux server, published to PyPI, running as gaia's tide service.
  - tide's last snapshot before the crash kept at `~/.miadi/navigator/context/snapshot-20260927T233141Z-precrash-preserved.json` on gaia.
  - A9, the session-observability plugin 0.1.0 (jgwill/miadi-orchestration-kit@92a2931): the capture hooks with the binding line and each session's team, and the session-continuity skill. mia on gaia runs it since 18:50, and mia's settings.json no longer wires hooks by hand.
  - A7, each Claude launcher records its own name as `launch_alias`: jgwill/binscripts@fc76ce9.
  - A6, hermes and pi write the binding line through one writer, `/opt/binscripts/hooks/terminal_binding.sh`: jgwill/binscripts@c99dd89. codex, gemini and agy are wired to the old copies under `/src/scripts`, copilot has no user-level wiring, openclaw runs its own hook copy, and hermes' end event (`on_session_finalize`) is not wired. Each of those is a change in the agent's own config (D13, Q4).
  - A10, tide 0.9.36 (jgwill/Miadi@c0f5a943): resumes hermes and pi by a rule of their kind, sees them running by the pid on their line, and skips a kind with no rule. Installed on gaia from a local wheel, not on PyPI (jgwill/Miadi#691).
- **Done 2026-09-29:** the binding line names the chronicle episode a session works in, so an episode can list its terminals (Q1): a directory given with `--add-dir`, then the agent's folder, then `MIADI_CHRONICLE_PROD_EPISODE`, which every shell exports and so comes last. Plugin 0.1.2 (jgwill/miadi-orchestration-kit@77865ec), jgwill/binscripts@85941c4. mia on gaia runs 0.1.2.
- **Done 2026-10-03:** after the crash of 09:48, all 62 sessions and 73 panes came back as tide's snapshot recorded them at 09:47:48, and 34 agents resumed their own sessions. tmux now starts at boot (`tmux-server.service`), saves every 15 minutes whether or not a terminal is attached (`tmux-save.timer`), loads its plugins once, and runs one tmux, 3.7c (jgwill/gaia#90, gaia cdd418a and 5171c9f). For a new machine: `miadi` 0.3.1 installs `miadi-tmux` 3.7c in place of the distribution tmux, and `miadi-terminal` 0.2.1 carries the same restore layer (`miadi-terminal enable restore`). `packages/miadi/deb/test-install.sh` runs the whole cycle in a clean Ubuntu 22.04. gaia runs these packages.
- **Next:** A5 (the inventory reads the binding), the plan below, and herdr in jgwill/Miadi#691.
- **Needs William now:** D13, the agent config edits that let codex, gemini, agy and copilot reach the binscripts suites and wire hermes' `on_session_finalize`. Q4, whether openclaw writes the binding line. Installing the plugin for jgi and ava, whose settings are their own.
- **Sessions:** `gaia-tmux-rebooted-restore-finetuning-260928` (outside tmux). Before the crash, for example `gaia-var-disk-space`, `miadi-tide-reusable-components-260923`, `episode-019-tide-runtime-orchard`, `miadi-orchestration-kit-apt`, `mia-claude-plugin-mia-episode-companion`.
- **Skill:** the T1 practice ships inside the session-observability plugin (D8, William, 2026-09-28: "a plugin contains more than just skills. So it's going to be extendable."). Version 1 is A9, scoped on jgwill/miadi-orchestration-kit#56.

### Plan: one session-observability package per agent kind (not built)

From William's @stckin note in `bash_aliases_common` (2026-09-29): this work "should influence pi-coding-agent extension development as well as hermes-agent plugin development", with plugins "depending on which miadi-teams the agent is part of". P marks a plan step.

- **Today.** Claude's capture is `claude/miadi-session-observability`. Pi's is `/opt/binscripts/hooks/pi_hooks/event_capture.ts`, registered by path in `~/.pi/agent/settings.json` (`extensions`), and it needs two binscripts files beside it: `secret_capture_sanitizer.sh` and `terminal_binding.sh`. Hermes' is shell hooks wired in `~/.hermes/config.yaml` (`hooks:`). The Miadi platform plugin for hermes (tools, 0.2.3) is `$MIADI_SRC/runtime/hermes-plugins/miadi`.
- **What each agent can install (read on gaia 2026-09-29).** Pi 0.87.1 installs from npm, a local path, or a git repository as a whole. It has no form for a folder inside a repository, so `pi install jgwill/miadi-orchestration-kit/pi/miadi-session-observability` does not exist. The forms that work are `pi install $MIADI_ORCHESTRATION_KIT_ROOT/pi/miadi-session-observability` (a local path, nothing published) and `pi install npm:@miadi/pi-session-observability` (after an npm release). Hermes installs a folder inside a repository: `hermes plugins install jgwill/miadi-orchestration-kit/hermes/<name>` clones the kit and copies that folder to `~/.hermes/plugins/<name>`. A hermes plugin is `plugin.yaml` plus `__init__.py` with `register(ctx)`, and it can register `on_session_start`, `on_session_end` and `on_session_finalize` in Python.
- **P1, pi package.** Create `pi/miadi-session-observability/`: `package.json` with `pi.extensions`, the extension, and bundled copies of the sanitizer and the binding writer. The kit becomes canonical for the shared writer, and binscripts keeps a live copy, as it does for Claude. Check: the one-pane test with `pi -e <folder>`.
- **P2, pi install.** On one account, `pi install <kit folder>`, and in the same step remove the binscripts path from `extensions`: with both loaded, every event is captured twice. Each account's settings are its own, so each install needs William's decision. An npm release needs one as well.
- **P3, hermes tools.** Move `$MIADI_SRC/runtime/hermes-plugins/miadi` to `hermes/miadi`, and leave a pointer in jgwill/Miadi. It installs with `hermes plugins install jgwill/miadi-orchestration-kit/hermes/miadi`.
- **P4, hermes capture.** Create `hermes/miadi-session-observability`: a plugin that registers the three session hooks and runs the same capture and binding writer. It replaces the `hooks:` block in `config.yaml` and adds the end line that D13 asks for. It is cut over one account at a time, with William's decision.
- **P5, teams.** The capture packages go to every agent, whatever its team. A team's own packages are separate folders beside them, and each team's section here says which ones it makes. Which account installs which team's packages is William's decision. The binding line's `team` already says which team a session belongs to.
- **Naming.** William's note proposes `MIADI_PLUGIN_SESSION_OBSERVABILITY_CLAUDE` and `MIADI_PLUGIN_SESSION_OBSERVABILITY_PI` in his aliases file. The rename is his.

## T2 · Event path

- **Level:** the application.
- **Desired outcome:** Miadi knows which events travel, what stays attached to them, and how anyone can see that an event arrived or visibly failed.
- **Leads:** William (human). The episode 548 session (agent, proposed).
- **Makes:** the broker choice and its first proof, episode 548 and its community invitation.
- **Uses:** T1's session events (a session starting in a terminal is one event it may carry), the Facebook page skills.
- **Sessions before the reboot, examples:** `kafka`, `miadi-eda-broker-episode-community-prepare`, `miadi-kafka-pto-potentially-as-factory-eda`, `miadi-provider-repo-file-replacement-by-r2-cloudflare`, `miadi-org-webhook-schema-ep074`.
- **Skill:** not written yet.

## T3 · Witness

- **Level:** between William and the teams that build.
- **Desired outcome:** William hears and judges what the building teams produce before anything is revised, and his answers reach them as clear messages.
- **Leads:** William (human). Mino, the `stcbot` seat (agent).
- **Makes:** spoken first impressions and walkthroughs, revision messages, the session inventory (`miadisabelle/workspace` `.mino/session-inventory/`), charts.
- **Uses:** T1's hook capture and Claude Code's transcripts and session list, to see what other sessions received and did.
- **Sessions:** `stcbot`, `mino-260928-fork-01`, `miadi-review-in-episode`.
- **Plugin:** `claude/miadi-witness` (0.1.0), with the skills `miadi-witness-first-impression` and `miadi-mino-tmux-inventory` (jgwill/miadi-orchestration-kit#59).
- **Proposed, William 2026-09-28: an inventory agent.** Until now the inventory was made by hand. William gives a session name, Mino looks at the session, works out what it is doing and where it stands, and records it, either after `/exit` gives the session id or while it keeps running. An inventory agent would do this for every session. It would read T1's binding line (every start, rename and end, with the terminal and the launch) and the session's transcript, then write and update the inventory entry with its meaning: mission, relations, state, and what needs William. It builds on T1's line (A5 in the Tmux Agent Restore proposal). Where it runs is not decided.

## T4 · Chart path

- **Level:** the application.
- **Desired outcome:** every chart an agent writes reaches one place where the people it concerns can read and steer it, and whether that place is public is decided per source.
- **Named:** 2026-10-03, after the second part of that day's screenwalk with Mino. William: "it feels like right now I'm with this new team that we'll work on chart path", and "there really needs to be a whole traceability".
- **Leads:** William (human). The session `t4-chart-path-asterion-into-miadi-261003a` (agent).
- **Makes:** coaia-narrative's Asterion writer (`src/asterion-bridge.ts`), Asterion's mapper and registry sync (`lib/asterion/coaia-projection.mjs`, `scripts/coaia-sync.mjs`), and Asterion itself (miadisabelle/asterion) until it moves into Miadi: its pages into `jgwill/Miadi` `app/`, its types, mapper and sync into a `@miadi/asterion` package, and later its chart storage, beats and timeline into `jgwill/medicine-wheel` `src/`.
- **Uses:** the coaia-narrative chart format, `@miadi/github-actions` (a step added on a chart opens a GitHub sub-issue), Miadi's identity (who may change a chart), T2's events (a chart arriving is one), T3's charts (Mino's triage chart is its first private source).
- **Sessions:** `t4-chart-path-asterion-into-miadi-261003a`, `coaia-asterion-fork-01-episodes` (Phase 1 shipped 2026-10-01; its Phase 2 plan, P2 to P11, waits on two of William's answers), `coaia-narrative-asterion`, `episode-060-coaia-agent-asterion-system`.
- **Done 2026-10-03:**
  - Asterion's Settings link opens a page that says who is signed in, which memories feed it, and which instance it is (miadisabelle/asterion@653fbbb).
  - A private project is shown only to signed-in writers, and a read route that never asks who is reading fails the build (miadisabelle/asterion@2c3fa5d, @f52d90d). Checked on all six Asterion addresses, signed out and as a writer.
  - Mino's chart is on Asterion as the private project `mino-triage`: 165 charts and 12 threads for signed-in writers, nothing for anyone else (William's word, D1).
  - 2026-10-06: a project names its seat, the tmux session that keeps its charts, shown on the project page and named there by a writer (miadisabelle/asterion@015a767). Tested live on `ep060`. Mino read back William's part-two feedback ("RECEIVED 093064b6").
- **Next:** a steer made on Asterion reaches the project's seat through Miadi's steering, and a project names its checkouts (the design is in the skill). The vocabulary in the skill waits for William's corrections.
- **Skill:** `skills/chart-path/SKILL.md` in this kit: the path, private sources, the words (repository, checkout, chart memory, project, seat, workspace), what `/stc-config` holds that Asterion must keep, and steering through a seat. Any agent that learns something about the chart path writes it there.

## T5 · Production context exploration (stub, 2026-10-06)

- **Status:** a stub, asked for by William on review 6c3f477f v10: "stub and first version could be created automatically then talk about what next". "Production context exploration" is his term. The team's name of record is his to give; the staging circle proposes "the germination circle" (`_staging_for_new_episodes/naming-what-comes-before-an-episode-261005/naming.md`, O7).
- **Level:** before an episode.
- **Desired outcome, in William's words (2026-10-05, to the staging session):** "these potential sparks of an episode … are rich enough when we create them, which imply we have put something in the staging area right away before, and we fed them a little bit, and we explore a little bit, to become an interactive TV series".
- **Leads:** William (human). The staging session `miadi-staging-episodes-circle:1791110394383:jj1ql8` (agent).
- **Makes:** concepts in the staging folder before any episode exists, the Chronicle staging circle (`circle:1791110394383:jj1ql8`) and its ceremonies, `naming.md` and `production-context-exploration.md` in `jgwill/episodes`.
- **Uses:** the chronicle-episode kit, to mint an episode once a concept is chosen.
- **Next:** William names the team and the place.

## T6 · Production (stub, 2026-10-06; name held as D11)

- **Status:** a stub, asked for by William on review 6c3f477f v10. Its name is held as William's decision D11 (Mino recommends "Documentary team").
- **Level:** after an episode.
- **Desired outcome, in William's words:** 2026-10-03, "it's like your production team that did a lot of work inside of, with, within the enterprise … because this is a factory. And this feels like it's a new team responsibility here". On review fcb78dc0: "Producer/supplier of video for the miadi-chronicle" and "Agent's team at a certain point produce a video of what they created (the transition from where we were when we started the work to now as well as what the next team will be capable todo with the work that our team completed".
- **Leads:** William (human). The session `t6-production-deepdiver-into-episodes-261007` (agent), started 2026-10-07 by the Mino inventory seat at William's request, to carry Deep Diver's media into episodes (pipeline steps 7 and 8 in `miadisabelle/deepdiver` `docs/MIADI_FACTORY.md`).
- **Sessions:** `miadi-deepdiver`, which built the plugin and made Deep Diver work with the current Gemini Notebook, and the agent lead above. A tmux session named `t6-…` is on T6 by its name.
- **Makes:** the `miadi-deepdiver` plugin (`claude/miadi-deepdiver`, 2026-10-07): Deep Diver notebooks built from Miadi reviews and screenwalk videos, with questions answered and cited, and infographics, video overviews, mind maps and reports kept under a manifest. Proposed, not built: documentaries of the factory's own work, and a video pipeline such as the one in review fcb78dc0 (Remotion).
- **Uses:** chronicle episodes, Miadi reviews, screenwalk captures.
- **Next:** William names it (D11).

## T7 · Operator desk

- **Level:** between William and the whole factory.
- **Named:** 2026-10-07, by William, in the session `miadi-how-to-set-with-tide-a-team`. He asked how to set a session's team with `tide`, and that session fit none of T1 to T6.
- **Desired outcome:** every question William asks about how the factory works gets a short answer from the owning team's text, checked against the tool itself. The question is kept, and when the docs or tools fail to answer it, that failure reaches the team that owns them.
- **Leads:** William (human). The session `miadi-how-to-set-with-tide-a-team` (agent).
- **Makes:** the `miadi-operator-desk` plugin (`claude/miadi-operator-desk`): the skill `operator-desk`, the command `/desk-record`, and the desk ledger `desk/ledger.jsonl`, one line per question with its answer, sources, owning team and any handoff (jgwill/miadi-orchestration-kit#71).
- **Uses:** every team's section here and its skill, to find the answer. T1's binding line, to know which team a session is on.
- **Sessions:** `miadi-how-to-set-with-tide-a-team`. A tmux session named `desk-…` is on T7 by its name.

## Not named yet

Other sessions point to teams William has not named: trading (`trading-draw-on-ao-issue-154`, `mia-trading-wave-labeler-blueprint-service`), story (`miadi-ncp-story-studio`, `miadi-orchestration-kit-storytelling`), research (`ep316-concordia-pitch-revising`). Film production (`mw-film-prod-devops-credibility`) moved to the T6 stub on 2026-10-06. Naming them is William's.
