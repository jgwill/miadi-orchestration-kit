# Reverse-engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Observed Workflow

On May 11, 2026, Codex contacted MiaClaw through the Gaia endpoint prototype:

```text
/home/mia/.openclaw/workspace/pto/gaia-endpoint-pebble/gaia-endpoint.mjs
```

The user supplied:

- target Claw: MiaClaw
- exact session ID: `pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa`
- resume script: `/workspace/repos/scripts/RESUME--gemini--session--8a3c1d91-4cb4-49ba-8a96-8e349ea4e3fe.creator-of--pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa.sh`
- planned pickup time: May 11, 2026 at 11:00 PM America/Toronto
- expected work: document the resumed session, create an episode, choose the right ceremonial folder, create a GitHub issue, and map related/impacted work.

Codex inspected the endpoint script and README before calling Gaia. The endpoint supports:

- `responses --input <text>`
- `--session <key>` for exact OpenClaw session routing
- `--channel <name>` for message channel metadata
- token loading through environment variables
- output extraction from Gateway response JSON

## Manual Command Shape

The successful manual dispatch used this pattern:

```bash
node pto/gaia-endpoint-pebble/gaia-endpoint.mjs responses \
  --session pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa \
  --channel openclaw-planning \
  --input "<mission packet>"
```

The dispatch was not considered complete until the HTTP call returned an acknowledgement from MiaClaw.

## Acknowledgement Observed

MiaClaw acknowledged:

- planned pickup: May 11, 2026 at 11:00 PM America/Toronto
- session ID: `pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa`
- first artifact: an episode artifact for that session, after inspecting existing workspace structure.

Codex then wrote the coordination note to:

```text
/home/mia/.openclaw/workspace/memory/2026-05-11.md
```

## Lessons From The Manual Path

- Exact session keys matter more than derived user IDs when the operator wants a durable agent thread.
- Relative time must be converted into an absolute date and timezone before dispatch.
- A Claw dispatch is not a scheduler. It can record a planned pickup, but it cannot prove the pickup will happen at that time.
- The gateway token is operator-grade access and must remain outside artifacts.
- The acknowledgement is a first-class artifact, not terminal noise.
- Follow-up work may cross operational and narrative surfaces: issue creation, ceremony folder choice, episode writing, and related-work mapping.

## Existing Rispec Fit

The closest existing specs cover adjacent concerns but not this exact protocol:

- EAST PDE session orchestration covers session initiation, not Claw-to-Claw dispatch through Gaia.
- Plugin recommender covers choosing plugin directories, not contacting another Claw.
- Permission scoping covers stop conditions, not the dispatch artifact contract.
- Storyweaver covers story creation, not operational session episodes as world-building memory.

This justifies a separate Codex-facing rispec.
