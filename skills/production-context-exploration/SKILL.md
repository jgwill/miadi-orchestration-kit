---
name: production-context-exploration
description: Explore a potential Chronicle before choosing an episode.
version: 1.0.0
author: Kherix / Hermes Agent
license: MIT
---

# Production Context Exploration

## Intent

Make one potential Chronicle intelligible enough for a person to discuss and choose. Research it, give it a narrative spine, preserve the interpretation and corrections that shaped it, and teach the next agent what to do. This is T5's first-version practice, not an implementation of every proposed staging feature.

## When to use

Use for a possible episode, germinating concept, production-context inquiry, discovery-to-script request, or Mia–Ava interpretation before an episode is chosen. Read `teams/README.md` T5 and Guillaume's T5 row in `README.md` first. Do not infer birth approval from an attractive script, a review status, or a folder.

T5 explores before a choice. T6 produces resources from episodes or reviews in its own lane; the proposed “Ready for DeepDiver” trigger is not an instruction to mint automatically. T3 witnesses, T7 answers operating questions, and T1/T2 own continuity/event machinery. A practice does not appoint a new lead or rename a team.

## Sources and authority

- Set and inspect `MIADI_CHRONICLE_ROOT`, `MIADI_ORCHESTRATION_KIT_ROOT`, `MIADI_SRC`, `MIADI_API_URL`, and `MIADI_CHRONICLE_MW_URL`; never substitute the app for the wheel.
- Read inherited `AGENTS.md`/`CLAUDE.md`, Chronicle staging `AGENTS.md`, the target sources, and this kit's `skills/chronicle-episode/SKILL.md` before any write.
- Chronicle owns the exploration folder. This kit owns the reusable skill. The runtime/schema live in jgwill/Miadi. An academic interpretation owns no runtime state.
- Historical episodes document what was known then. Inspect current source, package metadata, and read-only doors before claiming today's capability.

## Workflow

### 1. State the creative orientation

Write the desired result, current reality, and bounded next movement. Name what the human will be able to perceive or decide. If the request is an evolution survey, compare the agent's actual skill body with the current canonical source, not a remembered inventory.

### 2. Stage before expanding

Under `$MIADI_CHRONICLE_ROOT/_staging_for_new_episodes/`, choose one `<slug>-YYMMDD/` and start with an `AGENTS.md` stating intent and no-birth boundaries. Preserve neighbouring concepts rather than absorbing them. Default artifacts:

```text
<slug>-YYMMDD/
  AGENTS.md             intent, scope, human-held choice
  script.md             a potential narrative spine, not final media
  source-ledger.md       citations and evidence states
  .mia/                 supplied interpretations, exact prompts, corrections
```

Add `skill-evolution.md` only when the work actually changes skills. Do not create every possible room artifact. Nothing here gets an episode number, `episode.yaml`, receipt, registered episode node, or episode-lineage edge. Do not test a birth door just to prove that you refrained from birth.

### 3. Read the current holdings, not just the story

For an evolution inquiry, read the anchor episode's script, manifest, inquiry, and selected lineage. Trace the four layers of a holding: **schema contract → read/write door → room surface → agent practice**. Check each independently; a typed list is not proof of rendering or public reach.

Current vocabulary to inspect, not a frozen list of installed features:

- Script, narration, chapters, audio, and media sidecars/custody.
- `reviews:`, `foundations:`, `notebooks:`, `prototypes:`, `tracing:`, `rispecs:`.
- Screenwalk records under `captures/screenwalk-<id>/screenwalk.json`.
- PDEs found in an episode's `.pde/` plus declared `pdes:`; the door is `…/pdes`, **not** a guessed `…/decompositions`.
- Inquiry weaves, attention, episode lineage, sessions, and circle/ceremony bindings.

The episode's manifest and the wheel's reusable resource node/relationship are different records. A file lying in the folder is not automatically a card holding. Some holdings are derived from files, such as screenwalks and local PDEs; do not hand-write a list for those merely for symmetry.

Use read-only `GET $MIADI_API_URL/api/chronicle/episodes/<ref>` and specific holding doors. Verify an episode's wheel card with the exact node API, not a client-routed page's HTTP 200. Record zero entries as “none held here”, not “the capability does not exist”. A 401/403 is an access limit, not absence. Retry a network/client blocker through a verified existing endpoint; never change a global front or relax authentication for this survey.

### 4. Keep interpretation with its correction

When Guillaume supplies Mia–Ava dialogue or a lens prompt, save it verbatim in `.mia/`, with its provenance and status. Preserve later corrections beside it; do not quietly edit the original. Voice-transcription tokens are not concepts until confirmed by context. A quoted dialogue's claim that an action happened is not an execution receipt.

For academic interpretation, read `references/mia-ava-academic-interpretation.md`. Keep it short and tied to decisions or artifacts. Do not invent academic citations or turn a cultural metaphor into a software requirement. Situated Medicine Wheel practice and participant authority are not inferred from node types.

### 5. Write the possible story

Give `script.md` an opening question, a concrete encounter with evidence, a change in working practice, and a human-held choice at the end. Use metaphor to invite perception, then return to one observed thing. A software inventory is source material, not the narrative itself. Proposed dialogue is authored narration, not a transcript of a separate agent session.

Distinguish **documented / implemented / live-read / inferred / proposed / human-chosen** in the ledger, not by drowning the script in qualifiers. Never narrate unperformed experiments, an unopened ceremony, or unminted episode as completed. Produce one script rather than parallel drafts unless the person asks.

### 6. Evolve the practice, not the whole skill library

Change only the class-level skills whose trigger/workflow actually lag. Keep episode-specific versions and findings in the exploration ledger; retain portable procedures in skills. State the canonical source versus a host-specific adapter. Prefer updating an existing umbrella or adding one reusable team practice over one skill per topic.

Verify frontmatter, relative references, bounded formatting, scoped diff, and discovery/routing. Shared skills belong in `skills/<name>/`; register them in `README.md`, `llms.txt`, and the owning team section. Keep machine/human team records aligned without inventing members or names. Do not replace another agent's owner tree or edit another Hermes profile without instruction.

### 7. Land the exploration without birthing it

Follow staging `AGENTS.md`: its `scripts/new-future-episode-chronicle-session.sh` opens a chronicle-sessions issue and commits but does not push. Inspect the helper before invoking it. If its folder-wide staging conflicts with named-file law or would sweep other writers' files, reproduce only its issue/title/body and scoped-commit actions using explicitly named files. Do not alter the shared helper as a side quest.

Every kit change needs a suitable GitHub issue. Commit and push the kit and Chronicle files only under the authority of the task and inherited repo law. Preserve unrelated dirty/index state. Check remote containment. A rejected push is a boundary to report, never permission to force, rewind, stash, or merge over another occupant.

Report the useful discoveries, the script's movement, all changed skills and what they enable, where the `.mia/` record lives, and what remains a human choice. Keep the technical receipt in the workspace; don't make the person navigate a verification log.

## Handoff and promotion

An exploration may stop here, continue, or be set aside. Promotion requires a separate human choice. Only then load `chronicle-episode`, pass the staged path and its chronicle-sessions issue as provenance, declare earned lineage, dry-run the verified birth door, and prove all five stages. Do not open a circle solely because the procedure mentions one; participation, identity, and facilitator authority must be verified.

## Verification

- [ ] One staged intent and one readable script exist.
- [ ] No episode number/manifest/registration or unauthorized wheel/ceremony write occurred.
- [ ] Evidence states, access limitations, versions, and current source are separated.
- [ ] Supplied interpretation and later correction remain distinguishable in `.mia/`.
- [ ] Academic framing serves the actual artifacts and obeys any bounded format.
- [ ] Relevant skill changes are executable, routed, and validated.
- [ ] Named-file commits and remote read-back cover only the work authorized here.
- [ ] The final choice to create an episode remains the person's.
