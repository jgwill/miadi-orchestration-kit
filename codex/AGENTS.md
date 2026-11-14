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

## A release of a hooked plugin needs the person's trust again

Codex keeps, for each trusted plugin hook, a `trusted_content_hash` in `~/.codex/config.toml`.
A release that changes the plugin's hook files changes that hash, and Codex then skips the
hooks without a word. Measured on eury 2026-11-14: `miadi-session-observability` 0.1.4,
trusted by Guillaume, recorded live turns; after 0.1.5 (one line of the clone guard) the next
turn, `01a1db73-…`, recorded nothing. With the legacy hooks cleared, that is a host whose
Codex sessions go unrecorded until the person opens `/hooks` and trusts the new version.

So: release a hooked Codex plugin knowing it asks the person for one act, say so in the same
turn, and verify with one live `codex exec` turn after they trust it. Never write
`trusted_hash` or `trusted_content_hash` yourself: that review is theirs.
