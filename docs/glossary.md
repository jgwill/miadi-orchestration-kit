# Glossary

The words used across the kit's skills, plugins and issues. Each entry says where the thing lives.

## The Chronicle

- **Miadi Factory**: the whole system for making agent-made work inspectable and revisitable. It connects the originating question, the session trace, the interface evidence, explicit criteria and a person's judgment.
- **Miadi**: [`jgwill/Miadi`](https://github.com/jgwill/Miadi), the runtime. The `@miadi/*` npm packages, the web app at `MIADI_API_URL`, the Chronicle and review services.
- **Chronicle**: the ledger of episodes, a git repository at `MIADI_CHRONICLE_ROOT`, shown in the app at `/chronicle`.
- **Episode**: one unit of work in the Chronicle, a directory named `YYYY-MM-DD-episode-NNN-slug` holding `episode.yaml`. Referenced as `miadi-chronicle:<N>`. See [Chronicle Episodes](chronicle-episodes.md).
- **Vessel**: an episode's directory and the files in it.
- **Manifest**: `episode.yaml`. Lineage and the room read it, so a directory without one is invisible to them.
- **Receipt**: `.mw-registration.json`, what the wheel answered when the episode was registered. A `pending` receipt is a debt to redeem.
- **Five stages**: created, committed, pushed, registered, receipt verified. Each has its own proof.
- **Chronicle wheel**: the medicine-wheel store that holds episode cards (`chronicle:<directory>`), ceremonies, circles, reviews and the edges between them. Reached at `MIADI_CHRONICLE_MW_URL`.
- **Room**: the app page of one episode, `/chronicle/<episode>`.
- **inquiry-weave**: the library, CLI and MCP server (`@miadi/inquiry-weave`) that mints, relates, resolves and reports on episodes.
- **Inquiry**: an artefact related to an episode and copied into its `inquiry/` folder by `inquiry-weave`.
- **Lineage**: an edge from one episode to another, with a sentence saying why they relate.
- **Attention**: questions an episode asks its person, kept in `attention.json` and answered in the room.
- **Ceremony**: a record on the wheel, bound to an episode by `episode_path` and held in a circle. A `talking_circle` unless stated. Referenced as `miadi-ceremony:<id>`.
- **Circle**: the people and seated agents a ceremony is held with, each a facilitator or a member. Referenced as `miadi-circle:<id>`, or as a bare `circle:<id>`, which `miadi-terminal` also opens.
- **Turn**: one thing said in a talking circle, by a person or a seat in its own name. Another member witnesses it.
- **Miadi review**: a versioned review on the review service, referenced as `miadi-review:<uuid>`. Added to an episode on a person's behalf, it opens a talking circle about the review.
- **Screenwalk**: a recorded session William plays back aloud, in which the seats present the work. Its closing reaches the review, and its videos feed DeepDiver notebooks.

## Sessions and machines

- **Capture**: every Claude Code event of a session, written under `<root>/<session_id>/` by the `miadi-session-observability` hooks.
- **Binding line**: one JSON line per session start, end and rename in `terminal_bindings.jsonl`: the session id, its tmux pane, command line, names, team and episode.
- **tide**: the runtime (from `ironsilk`, installed by `miadi-tide`) that names the agent in each tmux pane, keeps snapshots, and brings agents back after a restore. `tide agents list`, `tide agents restore`.
- **Launch alias**: the shell alias that starts an agent with its tools and plugins. The binding line records it so tide relaunches the agent the same way.
- **Session inventory**: one JSON record per session, kept by the witness team, with what the session did, its team fit and its proposed ending.
- **Kit root**: `MIADI_ORCHESTRATION_KIT_ROOT`, a host's checkout of this repository.

## People and agents

- **Team**: T1 to T7. Every terminal session belongs to one. Each has a human lead and an agent lead. [`teams/README.md`](../teams/README.md).
- **Seat**: an agent session with a standing role, such as Mino, the witness team's `stcbot` seat. A seat with its own Miadi identity speaks in a circle in its own name.
- **Companion**: an agent with a stated voice. Mia (`mia-episode-companion`), Miette (`miette`), Ava (`ava-companion`).

## Methods

- **Structural tension chart**: current reality, the desired outcome, and the action steps between them. Charts reach Asterion along the chart path ([`skills/chart-path`](../skills/chart-path/SKILL.md), T4).
- **RISE**: Reverse Engineering, Intent, Specifications, Exportation. How the folders under `rispecs/` are written.
- **Foundations packet**: `foundations/<topic>/`, research with its sources and synthesis.
- **PDE**: prompt decomposition. A prompt broken into its intents before the work, kept under `.pde/`.
