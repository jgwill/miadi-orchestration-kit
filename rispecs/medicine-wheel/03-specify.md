# 03 - Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Portable adapter contract

The future plugin implements a Medicine Wheel orchestration adapter. The adapter
is a harness-local package that knows how to use Medicine Wheel concepts without
requiring Medicine Wheel core to know that harness.

## Inputs

The adapter accepts one or more of:

- raw user mission,
- active workspace path,
- existing `.pde/` or RISE packet path,
- optional Medicine Wheel API URL,
- optional MCP server path or MCP tool access,
- optional inquiry reference, cycle ID, or ceremony ID,
- optional target harness name,
- optional permission tier request.

## Required outputs

| Output | Requirement |
| --- | --- |
| Direction assessment | Names the active East/South/West/North framing and neglected directions. |
| Runtime health | Reports Medicine Wheel API/MCP availability and tool-discovery status. |
| Gate assessment | Names permission tier, Fire Keeper check-back status, and human-needed conditions. |
| Ceremony context | Names whether a ceremony is active, linked, missing, or blocked by issue #66 caveat. |
| RISE wave plan | Produces or updates a RISE-aligned wave/session plan when requested. |
| Source ledger | Lists exact paths, commits, issues, tool outputs, and claim status. |
| Harness export | Provides concrete plugin scaffold or launch recipe for the selected harness. |

## Core skills

### medicine-wheel-session-orient

Use when a mission needs Medicine Wheel orientation before execution.

Behavior:

1. Read the mission and active workspace instructions.
2. Check Medicine Wheel API/MCP reachability when tools are available.
3. Map the mission through Four Directions.
4. Name likely permission tier: `observe`, `analyze`, `propose`, or `act`.
5. Record known runtime caveats.
6. Write or return a compact session charter.

### medicine-wheel-fire-keeper-gate

Use before an agent proposes or performs action.

Behavior:

1. Identify proposed action, inquiry reference, and requested tier.
2. Use available Medicine Wheel tools or source-backed gate rules.
3. Run relational check-back where possible.
4. If issue #66 blocks active ceremony detection, report the explicit binding
   needed: `inquiryRef`, `cycleId`, or `ceremony_id`.
5. Return `accept`, `hold`, or `human-needed`.

### medicine-wheel-rise-spec-advisor

Use when a RISE packet or `rispecs/` tree needs review or plugin promotion
guidance.

Behavior:

1. Scan target specs and proposals.
2. Read RISE framework guidance.
3. Evaluate creative orientation, structural tension, advancing pattern, and
   specification autonomy.
4. Recommend: upgrade existing spec, create new spec, create proposal, or hold.
5. Keep recommendations source-ledger-backed.

This is the Miadi home for the useful `rise-spec-advisor` drift from PR #62.
It should not be added back to Medicine Wheel `mw skill view` unless Medicine
Wheel later supports external/advisory skill catalogs.

### medicine-wheel-mcp-health

Use when the plugin needs to know whether Medicine Wheel can be called live.

Behavior:

1. Resolve API URL from explicit input, `MW_API_URL`, or known local default.
2. Resolve MCP path from explicit input, `MW_MCP_PATH`, or known local package
   layout.
3. Check `/api/health` when API is available.
4. List MCP tools when stdio JSON-RPC or host MCP tools are available.
5. Return tool count, available relevant tools, and blocking errors.

### medicine-wheel-source-ledger

Use whenever the adapter makes claims or prepares a plugin scaffold.

Behavior:

1. Record claim, evidence path or URL, confidence, and contradiction status.
2. Mark whether the claim is observed, source-backed inference, or future
   design.
3. Include issue/PR links when the claim depends on unresolved behavior.
4. Keep ledger separate from narrative summary.

## Optional agents or playbooks

Harnesses that support agents should include:

| Agent | Responsibility |
| --- | --- |
| medicine-wheel-orchestration-steward | Owns session orientation, gate sequence, and output integration. |
| fire-keeper-boundary-reviewer | Reviews permission tier, write scope, check-back state, and human-needed points. |
| rise-spec-advisor | Reviews RISE packets and plugin promotion readiness. |
| source-ledger-keeper | Audits claims, sources, contradictions, and unresolved caveats. |

Harnesses without agent primitives can implement these as skills, commands, or
playbook sections.

## Data contract

Future implementations should use this conceptual payload internally:

```yaml
medicine_wheel_session:
  mission: string
  workspace: string
  harness: claude-code | gemini | copilot | codex | generic
  medicine_wheel:
    api_url: string | null
    mcp_path: string | null
    mcp_tools_available: boolean
    relevant_tools:
      - string
  direction:
    primary: east | south | west | north | mixed | unknown
    neglected:
      - east | south | west | north
  ceremony:
    inquiry_ref: string | null
    cycle_id: string | null
    ceremony_id: string | null
    active_status: active | missing | unknown | blocked-by-runtime-caveat
  gate:
    requested_tier: observe | analyze | propose | act
    decision: accept | hold | human-needed | unknown
    reasons:
      - string
  outputs:
    session_charter: string | null
    source_ledger: string | null
    wave_plan: string | null
    launch_recipe: string | null
```

## Runtime caveats that must remain visible

- Active ceremony detection may be unreliable until `jgwill/medicine-wheel#66`
  is resolved.
- Wilson alignment is text-heavy until `jgwill/medicine-wheel#65` is resolved.
- OCAP encrypted-cloud guidance is incomplete until
  `jgwill/medicine-wheel#64` is resolved.
- Two-Eyed Seeing concept coverage is incomplete until
  `jgwill/medicine-wheel#67` is resolved.

## Validation expectations

A conforming adapter demonstrates:

- API/MCP health check can succeed or fail with actionable explanation.
- Direction assessment uses the Medicine Wheel vocabulary consistently.
- Gate assessment never silently upgrades to `act`.
- Source ledger records exact evidence and known uncertainties.
- Harness export uses the chosen harness' native plugin/extension shape.
- RISE spec advisor output distinguishes observed facts from proposals.
