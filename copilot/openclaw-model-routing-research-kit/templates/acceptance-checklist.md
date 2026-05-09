# Acceptance Checklist

Date:
Reviewer:
Scope:

## Kit Load

- [ ] `.github/plugin/plugin.json` exists.
- [ ] Plugin name is `openclaw-model-routing-research-kit`.
- [ ] Agents path is `./agents`.
- [ ] Five skills are listed.
- [ ] Cheap smoke test uses `gpt-5-mini`.

## Manifest

- [ ] `launch-manifest.md` exists in the study root or is created from template.
- [ ] Date and timezone are explicit.
- [ ] Issue links are present.
- [ ] Plugin dirs and add-dir paths are present.
- [ ] Allowed write scopes are explicit.
- [ ] Current authorized track is explicit.
- [ ] Token caps are present.
- [ ] Stop conditions are present.

## Source Ledger

- [ ] Source inventory exists.
- [ ] Claim inventory exists.
- [ ] Evidence quality is graded.
- [ ] Major claims have at least two independent sources.
- [ ] Contradictions are recorded.
- [ ] Provisional claims are marked.

## RISE Rispec Scaffold

- [ ] Required wording appears: `Reverse-engineer -> Intent-extract -> Specify -> Export`.
- [ ] `README.md` exists.
- [ ] `01-reverse-engineer.md` exists.
- [ ] `02-intent-extract.md` exists.
- [ ] `03-specify.md` exists.
- [ ] `04-export.md` exists.
- [ ] Source ledger path is linked.

## Plugin Gaps

- [ ] `discord-integration` is reconciled to `discord-channel-analyzer`.
- [ ] `openclaw-runtime-connector` is reconciled to `openclaw-runtime-inspector`.
- [ ] `agent-routing-dispatch` is reconciled to `model-routing-policy-simulator`.
- [ ] No standalone `mythology-archetype-search` is required.
- [ ] Live connector work is not treated as required for read-only research.

## Final Decision

Status: `pass / pass-with-fixes / blocked`

Blocking fixes:

Next authorized step:
