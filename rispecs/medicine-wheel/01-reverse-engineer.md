# 01 - Reverse-Engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Observed Medicine Wheel source

PR `jgwill/medicine-wheel#62` contains the relevant drift:

- `8f1832a68a7d685a81a8148d2ff549095414f45e` added
  `rispecs/plugins/plugin-integration-framework.proposal.md`.
- `cd7cc88d5032c1fcb58762d1a7d1b8587c13f732` refined consistency in that
  proposal.
- `d94c1cd84f3d143778a871a4760f9607b618accb` reverted the
  `rise-spec-advisor` entry from `cli/skills.ts`.

The final Medicine Wheel plugin integration proposal defines:

- plugin manifests with identity, extension points, permission tier, relational
  declarations, and lifecycle phase,
- extension points for ceremony phase transitions, Fire Keeper gate evaluation,
  direction inquiry enrichment, consent cascade listeners, and community review
  hooks,
- permission tiers of `observe`, `analyze`, `propose`, and `act`,
- lifecycle phases of `gathering`, `kindling`, `tending`, `harvesting`, and
  `resting`,
- validation expectations around manifest completeness, permission consistency,
  relational accountability, lifecycle compliance, non-oscillation, and
  specification autonomy.

## Observed `rise-spec-advisor` drift

Before it was reverted, `rise-spec-advisor` described a useful workflow:

1. Scan `rispecs/` for `.spec.md` and `.proposal.md` files.
2. Fetch/read the RISE framework guidance.
3. Analyze specs for creative orientation, structural tension dynamics,
   advancing patterns, and SpecLang syntax.
4. Recommend upgrades, new specs, or new proposals.

The revert is appropriate for Medicine Wheel runtime CLI scope: `mw skill view`
and `mwsrv skill view` should stay close to Medicine Wheel runtime and server
capabilities. The advisory workflow is still valuable as a Miadi orchestration
skill because Miadi owns cross-harness plugin creation and RISE promotion
discipline.

## Observed local Medicine Wheel runtime

Local review on 2026-06-03 showed:

- `mw skill view` listed four CLI skills: `direction-inquiry`,
  `fire-keeper-check`, `wave-spec-generator`, and `ceremony-guide`.
- `mwsrv skill view` listed four server skills: `docker-setup`,
  `storage-config`, `api-health`, and `session-manager`.
- `MW_API_URL=http://127.0.0.1:3339 mw status` reached the running API and
  resolved the local MCP server at
  `/workspace/repos/jgwill/medicine-wheel/mcp/dist/index.js`.
- Direct MCP JSON-RPC `tools/list` exposed 54 tools, including validators,
  ceremony lifecycle tools, discovery tools, Fire Keeper coordination tools,
  prompt decomposition, and session analysis.

These observations support a plugin that can:

- probe MCP/API health,
- list and call Medicine Wheel tools through the harness' available tool
  mechanism,
- orient work through Four Directions,
- run Fire Keeper checks before action,
- write source-ledger-backed RISE wave artifacts.

## Observed implementation gaps

Four active Medicine Wheel issues shape the implementation boundary:

- `jgwill/medicine-wheel#64`: OCAP checker needs a conditional encrypted-cloud
  state, not only on-premise versus violation.
- `jgwill/medicine-wheel#65`: Wilson checker should validate actual relational
  state, not only text keywords.
- `jgwill/medicine-wheel#66`: `mw_relational_check_back` and
  `mw_fire_keeper_status` do not find a ceremony opened through
  `mw_ceremony_open` because persisted ceremonies are separate from the
  in-memory Fire Keeper.
- `jgwill/medicine-wheel#67`: Two-Eyed Seeing bridge needs a richer dictionary,
  including relational accountability.

The future Miadi plugin should surface these as known runtime caveats instead
of hiding them.

## Observed Miadi harness patterns

Miadi already has harness-specific shapes:

- Copilot plugins live under `copilot/<kit>/` with `.github/plugin/plugin.json`,
  `README.md`, `agents/`, and `skills/`.
- Codex plugins live under `codex/<kit>/` with `.codex-plugin/plugin.json`,
  `README.md`, `skills/`, and optional `templates/`.
- Claude Code plugins live under `claude/<plugin>/` with
  `.claude-plugin/plugin.json`, `agents/`, `commands/`, and `skills/`.
- Gemini extensions live under `gemini/<extension>/` with
  `gemini-extension.json`, `README.md`, optional `GEMINI.md`, `skills/`, and
  optional commands, hooks, policies, or MCP configuration.

Existing Miadi RISE specs already cover session bootstrap, plugin
recommendation, Codex dispatch, Claude review orchestration, and Gemini session
prep. None of the inspected specs is a Medicine-Wheel-specific cross-harness
adapter contract.

## Kinship interpretation

Using `llms-txt/llms-kinship-hub-system.md`, Medicine Wheel is the relation
source for ceremonial and relational orchestration. Miadi orchestration plugins
are descendants/adapters that must declare:

- which Medicine Wheel surfaces they consume,
- which writes they perform,
- which communities, data subjects, and operator boundaries they affect,
- how source claims and ceremony state are preserved in ledgers.
