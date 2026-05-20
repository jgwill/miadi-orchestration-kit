---
name: storyweaver-session-to-episode
description: "Convert a meaningful real agent, research, infrastructure, or creative session into a source-led Miadi Chronicle episode packet without fictionalizing facts."
---

# Storyweaver Session To Episode

Use this skill when a meaningful session, transcript, dispatch, issue, resume script, memory note, or command-output trail should become a Chronicle episode.

## Coordinates

- Primary agent: Chronicle Episode Steward
- Supporting agent: StoryForms And Beats Cartographer
- Supporting agent: Narrative Research Weaver, when source context is broad
- Supporting agent: Cultural Protocol Steward, when private or sensitive material appears
- Routing agent: Storyweaver Orchestration Architect

## Required Reading Order

1. Session source: transcript, note, issue, dispatch, command output, or resume file
2. Existing `state.md`, if present
3. Related scripts, repos, source paths, issues, rispecs, or memory files named by the session
4. Existing `research/source-ledger.md`, if present
5. `protocol-notes.md`, if present

## Workflow

1. Create or select `episodes/<session-id>/`.
2. Write `source-ledger.md` with exact paths, URLs, timestamps, session IDs, and evidence types.
3. Extract what happened, who or what participated, what changed, and what remains open.
4. Draft `episode.md` with facts, inferences, and narrative framing separated.
5. Write `related-work.md` with repos, rispecs, issues, packets, or archives touched.
6. Write `followup-commissions.md` with concrete next creative, research, engineering, voice, or visual tasks.
7. Route to `storyweaver-storyforms-and-beats` when beats, setting, and forms are needed.
8. Update `state.md`.

## Artefacts Read

- Session sources
- Related project or research files
- Existing source ledgers and protocol notes

## Artefacts Written

- `episodes/<session-id>/episode.md`
- `episodes/<session-id>/source-ledger.md`
- `episodes/<session-id>/related-work.md`
- `episodes/<session-id>/followup-commissions.md`

## Source Discipline

Label every important claim as:

- `observed`
- `quoted`
- `inferred`
- `operator-framing`
- `open`

## Pause Conditions

- Session facts are insufficient for an auditable episode.
- Private material lacks consent.
- The draft would make unsupported lore from operational facts.
- External follow-up action would occur without human approval.

## Acceptance Checklist

- [ ] Episode packet separates fact, inference, and framing.
- [ ] Source ledger includes exact local paths or URLs where available.
- [ ] Follow-up commissions are delegable.
- [ ] `state.md` names next packet skill or closure route.
