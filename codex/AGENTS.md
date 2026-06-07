# Codex Plugin Instructions

This folder is for Codex-native plugins.

## Promotion Discipline

Do not turn a rispec into a Codex plugin just because it exists under
`rispecs/`. First run or apply the equivalent of
`miadi-rispec-readiness-review`.

A rispec is not ready when it still depends on:

- future or provisional behavior,
- unresolved external side effects,
- unspecified write scopes,
- missing source-ledger evidence,
- missing artifact paths,
- unverified plugin-recommendation quality,
- inferred user memory or authority.

## Plugin Shape

Each plugin should keep:

- `.codex-plugin/plugin.json`
- `README.md`
- `skills/<skill-name>/SKILL.md`
- optional `templates/` for reusable artifacts

Prefer markdown skills and templates before adding hooks, MCP servers, scripts,
or live connectors.

## Local Pattern

Use `miadi-codex-orchestration-kit` as the first reference implementation for
session-control plugins in this folder.

Use `miadi-storyweaver-orchestration-kit` as the Storyweaver reference
implementation for Codex-native storytelling, Chronicle episode, voice packet,
visual prompt packet, continuity, review, protocol, and export workflows.
