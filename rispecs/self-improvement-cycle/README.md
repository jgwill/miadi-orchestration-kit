# rispecs/self-improvement-cycle — what Warp's self-improving factory shows, and how the Miadi Factory uses it

Source: miadi-review:d47ef197-8fc2-4f81-be25-67d4e335d104 v8, "How to Build a Software Factory That
Improves Itself - Zach Lloyd, Warp" (AI Engineer, https://youtu.be/nKjPBAw_N_0). His other talk is
miadi-review:abb8fe26-70f5-4dc0-bc8b-63211a606233, held by Episode 547 (miadi-chronicle://547).

Asked for by Guillaume on 2026-11-19 in miadi-tmux://mia@gaia:t1-exit-not-on-completion-2611190727
(T1, session continuity), with the fourteen screenshots in [`screenshots/`](./screenshots/). His
message is kept verbatim with its decomposition in `miadisabelle/workspace` `.pde/` (see
[`STATUS.md`](./STATUS.md)).

Warp closes a loop: every agent run is scored, failing runs are grouped, an agent investigates
them, and the result is a pull request against the factory's own definitions that a person
approves or rejects. In the Miadi Factory the same motion closes a cycle on the Medicine Wheel, and
Guillaume's note on screenshot 01 sets what the proposal must do: "not just to solve the problem
but innovates so that we have the experience that we want".

| file | holds |
|---|---|
| [`01-reverse-engineer.md`](./01-reverse-engineer.md) | what each screenshot shows, and what the Miadi Factory has today for the same thing |
| [`02-intent.md`](./02-intent.md) | how we intend to use it, at each level: plugins, packages, the wheel, the episode |
| [`03-specify.md`](./03-specify.md) | the specifications S1 to S10 |
| [`04-export.md`](./04-export.md) | where it goes: the parent issue, the child issues by domain, the episode request, the briefs |
| [`STATUS.md`](./STATUS.md) | what exists, what is specified, what is held |

Sibling packet: [`../session-exit-reasons/`](../session-exit-reasons/), the reasons a session ends
short. Its investigation pass (S4) and recurrence count (S5) are this cycle's first instance.

## The screenshots

Times are the video's, from the review. A screenshot whose moment the review does not place says so.

| # | file | shows | his note |
|---|---|---|---|
| 01 | [pr-1061](./screenshots/01-pr-1061-read-matching-repository-skills.jpg) | warpdotdev/factory-dev#1061, a draft PR opened by `warp-agent-staging[bot]`: Problem, Solution, Evidence (the judged run ids), Expected effect | "Closing the loop or in our case, it would be the cycle where the agent is actually supplying a PR not just to solve the problem but innovates so that we have the experience that we want" |
| 02 | [excerpt](./screenshots/02-excerpt-llm-judge-feeds-self-improvement.jpg) | a summary line: LLM-as-a-judge scoring of runs (12:01) feeds a self-improvement loop where agents suggest and implement fixes to the factory's own configuration (13:21 to 14:21) | |
| 03 | [inbox item](./screenshots/03-self-improvement-inbox-item-open-a-pr.jpg) | factory `wilson`, Self-improvement inbox: each item a Problem and a Solution, its repository, its agent, its count of failed runs, a link to the run that wrote it, and Open | "Open a PR to enhance the factory definitions", the item and Open circled |
| 04 | [run link](./screenshots/04-inbox-item-failed-runs-and-run.jpg) | the same item: "37 failed runs" and "Self-improvement run" | "Self-improvement run" circled |
| 05 | [investigation](./screenshots/05-self-improvement-run-foreman-verdicts.jpg) | the run "Investigate And Verify Warp Agent Failures" by the Foreman: per failure, either an instruction was missing (a definition changes) or the instruction exists and the model ignored it (no change). Tabs Scores, Artifacts, Metadata. Source: Self-improvement. A Follow up box | the run's title circled |
| 06 | [approval](./screenshots/06-self-improvement-approval-rate.jpg) | Self-improvement: Approval 13/51, 25%, approved, rejected and pending review; Inbox, Needs review and Approved | "Self-improvement 31" circled |
| 07 | [scorer](./screenshots/07-scorer-redundant-tests-per-run.jpg) | the scorer "Redundant Tests": one row per run with Pass or Fail, a score, the verdict in words, duration and cost | |
| 08 | [scorers](./screenshots/08-dashboard-scorers.jpg) | Dashboard, Scorers: Change Requested 97%, Slack MCP Reply 96%, Computer-Use Ask 98%, Redundant Tests 100%, per day, each tagged with the agent it scores | |
| 09 | [agents](./screenshots/09-agents-foreman-and-subagents.jpg) | Agents: the Foreman ("Orchestrates the factory workflow and dispatches each gated step") over code-review, implementation, spec and triage. "Configuration is read-only here. Make changes in warpdotdev/factory-dev at main:v1." | |
| 10 | [agent.md](./screenshots/10-foreman-agent-md.jpg) | `v1/agents/foreman/agent.md`: description, agentType, model, runner, MCP servers, then its instructions. Last commit by the bot: "Restore Wilson's one-pass adversarial review limit" (#1068) | |
| 11 | [factory.yaml](./screenshots/11-factory-yaml.jpg) | `v1/factory.yaml`: the repositories the factory works on, the benchmark substitutions; folders `agents`, `automations`, `benchmarks`, `runners`, `scorers`, `skills`, `webhooks` (04:02 to 05:13) | |
| 12 | [spending](./screenshots/12-dashboard-spending.jpg) | Dashboard, Spending: cost per PR $17.63 over 310 PRs, split into compute, platform and inference; spend by source (Slack, Scorer, Warp Web, Factory MCP, Scheduled, Linear, GitHub, Self-improvement, Other) | |
| 13 | [runs](./screenshots/13-runs-list.jpg) | Runs: each run's state, where it came from (Slack, GitHub, Linear, Warp Web), what it made (videos, images, PRs), who asked and when (08:12 to 09:45) | |
| 14 | [diff](./screenshots/14-pr-1061-diff.jpg) | the PR's change: one line of `v1/agents/implementation/agent.md`, step 3 extended (about 14:37) | |

The capabilities, the interface and the person's experience they imply are in `02-intent.md`.
