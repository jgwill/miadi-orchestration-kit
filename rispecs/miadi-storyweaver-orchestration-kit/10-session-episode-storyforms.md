# Session Episode, StoryForms, And StoryBeats Extension

## Structural Tension

- **Desired Outcome**: Meaningful human/agent sessions can become episode artifacts that preserve what happened, what changed, and which reusable StoryForms and StoryBeats were discovered for the Miadi world.
- **Current Reality**: The Storyweaver kit already specifies creative story generation, beat maps, world/character architecture, continuity ledgers, and export packets. It does not yet specify how to extract narrative memory from operational sessions such as a Codex-to-MiaClaw Gaia dispatch.
- **Natural Progression**: Add a session-episode branch that treats real work sessions as source material for episode, StoryForm, StoryBeat, and Story Setting artifacts without fictionalizing the source record.

## Terms

### Episode

An episode is a source-led narrative artifact for a meaningful session. It answers:

- what happened,
- who or what participated,
- what structural tension moved,
- which decisions or artifacts changed the world state,
- what remains open for future sessions.

An episode can be readable and story-shaped, but it must keep facts, inferences, and poetic framing separate.

### StoryForm

A StoryForm is a reusable narrative structure discovered across sessions. It is not a plot template alone; it is a recurring form of relation, action, and transformation.

Example StoryForms from the May 11 Gaia dispatch:

- **Claw Dispatch Form**: one agent sends a bounded commission to another named Claw through a Gateway.
- **Pickup Contract Form**: a session resume path, exact session ID, and absolute time become the continuity anchor.
- **Episode Handoff Form**: operational learning is explicitly routed into a narrative/provenance artifact.
- **Issue Emergence Form**: session learning produces follow-up coordination work rather than staying as chat memory.

### StoryBeat

A StoryBeat is an ordered moment where the episode turns. It should be small enough to audit against sources.

Example StoryBeats:

1. Guillaume names the MiaClaw pickup mission.
2. Codex inspects the Gaia endpoint and resume script.
3. Codex dispatches the commission with the exact session ID.
4. MiaClaw acknowledges pickup time, session ID, and first artifact.
5. Codex preserves the handoff in memory.
6. Guillaume asks for a reusable Codex kit and Storyweaver branch.
7. The work becomes a new rispec pair: Claw dispatch plus session-episode extraction.

### Story Setting

In this universe, Story Setting means more than location. It is the contextual setting that lets the episode make sense:

- workspace and repo constellation,
- agent identities and roles,
- session IDs, scripts, endpoint surfaces, and channels,
- ceremonial direction and current workstream,
- related issues, PDE/STC artifacts, and memory files,
- permission boundaries and external-action status,
- the current reality being transformed.

Story Setting is the world-building substrate learned recursively from actual work. It should be preserved as operational context before it becomes atmosphere.

## Session-Episode Pipeline

Add this optional branch to the Storyweaver pipeline:

```text
session source intake
  -> source ledger
  -> Story Setting extraction
  -> StoryBeat extraction
  -> StoryForm recognition
  -> episode draft
  -> related-work map
  -> export packet
```

This branch can run after an operational session, alongside a Claw dispatch, or during nightly archival.

## Artifact Shape

The future Storyweaver implementation can place session episodes under the active story workspace:

```text
.storyweaver/<story-slug>/
  episodes/
    <session-id>/
      episode.md
      source-ledger.md
      story-setting.md
      storybeats.jsonl
      storyforms.md
      related-work.md
      followup-commissions.md
```

For non-fiction operational memory, the `story-slug` can be the workstream name, such as `claw-dispatches`, `openclaw-episodes`, or a specific ceremony slug.

## New Skill Surfaces

### storyweaver-session-episode-extraction

Use when a meaningful session, transcript, dispatch, resume script, PDE artifact, or memory note should become an episode.

Reads:

- source transcript or session artifact,
- local memory note,
- source scripts and command outputs,
- related issue or rispec folders,
- existing Storyweaver state if present.

Writes:

- `episodes/<session-id>/episode.md`
- `episodes/<session-id>/source-ledger.md`
- `episodes/<session-id>/related-work.md`

### storyweaver-storyform-ledger

Use when a session reveals a reusable pattern that should be named for future orchestration.

Writes:

- `episodes/<session-id>/storyforms.md`
- optional shared `storyforms/index.md`

Each StoryForm entry should include:

- name,
- short definition,
- participants/roles,
- structural tension,
- trigger conditions,
- required artifacts,
- risks,
- examples.

### storyweaver-storybeat-extractor

Use when a session needs a source-auditable beat sequence.

Writes:

- `episodes/<session-id>/storybeats.jsonl`

Each StoryBeat record should include:

```json
{
  "order": 1,
  "beat": "Codex inspected the Gaia endpoint before dispatch.",
  "source": "/home/mia/.openclaw/workspace/pto/gaia-endpoint-pebble/gaia-endpoint.mjs",
  "kind": "observed",
  "impact": "The dispatch used the existing CLI contract instead of an invented API."
}
```

### storyweaver-story-setting-ledger

Use when a session's context should become reusable world-building memory.

Writes:

- `episodes/<session-id>/story-setting.md`

Required sections:

- workspace and repositories,
- agent/persona constellation,
- session IDs and channels,
- ceremonial or methodological frame,
- artifacts already created,
- related and impacted work,
- open loops.

## Optional Agent Additions

The existing `storyweaver-orchestration-architect` can coordinate this branch. If repeated use shows the need, add:

- `session-episode-archaeologist`: extracts the episode from source artifacts without losing chronology.
- `storyform-cartographer`: names reusable patterns across episodes.
- `story-setting-steward`: preserves contextual setting as world-building memory.

## Quality Gates

- Do not treat source facts as fictional material.
- Label inferred relationships as inference.
- Keep poetic/narrative framing out of the source ledger.
- Link exact local paths for scripts, memory notes, rispecs, issues, or PDE artifacts.
- If an episode involves private or sensitive human material, route through `storyweaver-cultural-protocol-check`.
- If the session creates operational follow-up, produce `followup-commissions.md` rather than burying work inside prose.

## Relation To Codex Claw Dispatch

The Codex `miadi-claw-dispatch-kit` should handle the operational side:

- dispatch packet,
- Gaia call,
- acknowledgement ledger,
- follow-up plan.

This Storyweaver extension handles the narrative/world-building side:

- episode,
- StoryForms,
- StoryBeats,
- Story Setting,
- related-work map.

Together they make a two-plugin path: one for reliable inter-Claw communication, one for turning meaningful session learning into durable narrative memory.
