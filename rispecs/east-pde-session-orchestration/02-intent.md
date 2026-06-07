# Intent

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Direction

EAST.

EAST means first light: orientation, entrance, initial decomposition, topic naming, and the first source map before a heavier orchestration wave begins.

## Desired outcome

A native Copilot plugin in `miadi-orchestration-kit/copilot` can receive a first prompt or hook-event bundle and create the initial orchestration context: direction classification, Intent Analyst read, strategy-aware PDE summary, source ledger, session charter, recommended native plugin paths, lineage plan, and stop conditions.

## Current reality

The kit already has useful Copilot plugin structures and a session-charter template. The observed Gemini hook session shows the beginning ceremony, but the work still leans on external `mia-awesome-copilot/plugins` for planning and context-map instincts.

The portable Intent Analyst guidance already exists in `/workspace/repos/jgwill/llms-txt/skills/intent-analyst/`, and `miaco decompose run` already supports explicit decomposition strategies and parent/child PDE lineage. Those surfaces are adjacent to this kit, not yet integrated into the EAST RISpec contract.

## Structural tension

- Desired: the orchestration kit can prepare its own session entry without external plugin dependence.
- Current: source inspiration and Intent Analyst strategy guidance are outside the kit, and the hook-event pattern is only captured as evidence.
- Natural progression: specify EAST as the entry plugin with an explicit Intent Analyst and `miaco decompose run` strategy contract, then implement a native kit when repeated use proves the contract.

## Direction boundaries

EAST includes:

- initial prompt decomposition,
- Intent Analyst preflight,
- decomposition strategy selection,
- topic and strategic-intent naming,
- parent/child PDE lineage mapping,
- source-root discovery,
- recommended plugin set,
- session-charter drafting,
- provenance trace creation.

EAST does not include:

- executing the full implementation wave,
- adversarial review after synthesis,
- changing `miaco` strategy internals,
- assuming `mcp-pde` supports non-standard strategies before verification,
- final integration,
- release/commit work,
- voice-episode production.

## Narrative placement

Tushell is the Portal of Knowledge/Knowing: the entry that lets an agent meet the work without scattering. Miadi is the House of Orchestration: the structure that arranges lanes, evidence, delegation, and return paths after the portal opens.
