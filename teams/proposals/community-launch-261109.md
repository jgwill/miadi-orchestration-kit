# Where a person arrives: a proposal for T5 and T7

Proposed 2026-11-09 from a Claude Code session on `mia@hu`, from Guillaume's request to make a new
account's Claude Code simple to set up and to let the operator desk become the plugin the community
launches from. Nothing here is built or staged. The setup it starts from, `miadi-claude`, is in the
same pull request.

## Findings (measured 2026-11-09)

### F1. A new account now takes one command

`miadi-claude setup` installs the capture plugin and retires hooks wired by hand. On `mia@hu`, a test
session wrote each event twice with both wired and once after setup.

### F2. The desk is written for one person who holds a checkout

`claude/miadi-operator-desk/skills/operator-desk/SKILL.md` names William 8 times and stops when
`MIADI_ORCHESTRATION_KIT_ROOT` is not set. Its ledger is committed and pushed to this repository.
A community account has no checkout and no push access.

### F3. An installed plugin holds only its own folder

`~/.claude/plugins/cache/miadi-orchestration-kit/miadi-session-observability/0.1.39/` holds `hooks`,
`scripts`, `skills`, `tests` and two documents. The desk finds a part's owner in `teams/README.md`,
which an installed copy does not have.

### F4. The desk has no command for someone arriving

Its one command, `/desk-record`, writes the ledger and pushes.

### F5. A community question already has a path, and the desk does not use it

`miadi-config report --url question` opens `.github/ISSUE_TEMPLATE/question-feedback.yml` filled in,
and `miadi-feedback` wakes a seat that answers it.

### F6. The game is an intention so far

The section "Miadi Factory as Game" in `/etc/claude-code/CLAUDE.md` and
miadi-review://5ceaaf3e-eeb9-4afd-9079-42a6a31a5b08 hold it. No `package.json` under
`/a/src/Miadi/packages/` names `@miadi/game`.

### F7. A session on an account with no kit checkout has no team

The binding line records `unassigned` without `MIADI_TEAMS_FILE` or a checkout. Capture works.

## P1. The next production context exploration (T5)

Working name: `the-first-hour-on-a-miadi-host-261109`. T5 and the staging circle,
miadi-circle://circle:1791110394383:jj1ql8, hold the name and the choice to stage it.

**Its question.** What can a person with a new account ask, do and verify in their first hour, and
is that entry a game?

**The words it starts from.**

> "configured as simple as it could without having to wire things up manually and understand the whole implication of what a plugin is about"

> "a game that you would play and that would be your entry points into the whole system that I have a hard time to comprehend fully"

**Why this one next.** The staged folders read on 2026-11-09 each hold a part of what comes after
someone has arrived, and none starts from the person arriving.

| staged folder | what it holds, and stays there |
|---|---|
| `production-context-host-261107` | where an exploration is read and answered |
| `exploration-greenlight-261107` | when an exploration is ready to become an episode |
| `consent-and-relational-accountability-in-production-261107` | what a person agrees to. This exploration cites it for capture (Q2) |
| `what-bengio-implied-261006` | the agent that judges another agent's work |

**What the folder would hold**, beyond the practice's `AGENTS.md`, `script.md`, `source-ledger.md`,
`.mia/` and `potential-threads.yaml`:

1. A walk. A new account goes from `sudo apt install miadi` to a first answered question, recorded
   as a screenwalk. The script is written from that walk.
2. The ledger's reading of the four reviews named in that CLAUDE.md section:
   miadi-review://6c3f477f-3606-47bf-871c-29bf66a3988e,
   miadi-review://fcb78dc0-5b8f-4e84-a818-06cab3f70925,
   miadi-review://09de3362-2418-4172-8250-fdcd913c0aa0,
   miadi-review://80f50d5b-d5f3-4c82-a6b5-5302db559f5a.
   They were not read for this proposal.
3. What each team delivers to the person arriving, stated as a service states its contract, as a
   first trial of the team-to-team handoff drawn in `teams/diagrams/team_handoff.*`.

| team | delivers to the person arriving |
|---|---|
| T1 | their sessions recorded and restorable, and what is recorded stated plainly |
| T8 | the packages arriving and working |
| T7 | an answer to each question, and where an unanswered one goes |
| T5 | what could become an episode, readable before they choose |
| T3 | a witness of what the teams made |

It ends with a person's choice. No episode number, manifest or wheel record comes from this
proposal or from the folder.

### Q1. Who is the first walk for?

A person on a shared Miadi host, or a person on their own machine. The answer decides whether the
capture folder is shared.

### Q2. Is running setup enough agreement to record an account's sessions?

One command per account is the current design. A shared host may need what the consent exploration
arrives at.

### Q3. Does the entry stay a command and a conversation, or is it played?

The Twine books under `$MIADI_STORIES_ROOT` are the existing form to try it in.

## P2. The operator desk as the plugin the community launches from (T7)

Read "all questions on my inquiry" as the "Miadi Factory as Game" inquiry. "All" cannot be promised,
so the proposal makes it checkable: a fixed question set (below), and an unanswered question reaches
its owner. Draft jgwill/miadi-orchestration-kit#143 changes this plugin, so these come after it.

### E1. `/miadi-start`, the first command

It reads `miadi-claude status` and `miadi-config check`, says in plain words what this account has,
and offers three things to do next. Answers F4.

### E2. Two seats for one skill

Written for "the person asking". With a kit checkout it behaves as today. Without one, the ledger
is `~/.miadi/desk/ledger.jsonl` and an unanswered question goes to
`miadi-config report --url question`, which a person submits. Answers F2 and F5.

### E3. The map travels with the plugin

A generated `desk/teams.snapshot.json` holds each team's name, what it makes and its practice's
location. A test fails when it differs from `teams/teams.json` and `teams/README.md`, as
`tests/session-continuity-sync.sh` does for gaia's copies. Answers F3.

### E4. `miadi-claude setup` brings the desk

Once E1 to E3 exist, setup installs this plugin too, so a person runs setup, starts `claude`, and
types `/miadi-start`.

### The question set

The desk is ready when a fresh account gets each answer with its source.

| id | question | today |
|---|---|---|
| QS1 | What did setup do to my account? | `miadi-claude` README, not reachable from the desk |
| QS2 | What is recorded about my sessions, and who can read it? | capture plugin README, not stated for a shared host |
| QS3 | How do I undo it? | `miadi-claude` README |
| QS4 | What can I do here in my first hour? | nothing answers it |
| QS5 | Which team is this session on, and what does that change? | desk skill, needs a checkout |
| QS6 | What are an episode, a review and a circle? | scattered across teams' texts |
| QS7 | How does a cycle close, and how do I give feedback? | skill `closing-a-cycle` |
| QS8 | What opened beside my plan? | jgwill/miadi-orchestration-kit#143 |
| QS9 | How do I ask what the desk could not answer? | `miadi-config report --url question`, unknown to the desk |
| QS10 | Where is the game? | no such thing yet (F6) |

## Order of work

### A1. T8: publish `miadi-claude`, then `miadi-config` and `miadi`, once the pull request is merged

### A2. T5: stage P1 in the staging circle and make the walk

### A3. T7: E2 and E3 after jgwill/miadi-orchestration-kit#143, then E1, then E4

### A4. T7: run the question set on the account from the walk and answer what P1's walk showed
