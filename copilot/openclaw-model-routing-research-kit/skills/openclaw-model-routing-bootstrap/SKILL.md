---
name: openclaw-model-routing-bootstrap
description: Bootstrap the OpenClaw model-routing study by reading fixed-order context, validating or creating the launch manifest, enforcing write scopes, token caps, issue links, and stop conditions.
---

Use this skill at the beginning of every OpenClaw model-routing Copilot session.

## Fixed Reading Order

1. Confirm the current date and timezone from the user prompt or environment.
2. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/README.md`.
3. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/01-notions-map.md`.
4. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/02-mastery-path.md`.
5. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/04-build-ideas.md`.
6. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/preparing-deep-research/PROPOSAL.md`.
7. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/preparing-deep-research/KINSHIP.md`.
8. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/codex-delegation-readiness-review-2026-05-08/README.md`.
9. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/codex-delegation-readiness-review-2026-05-08/01-delegation-readiness-review.md`.
10. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/codex-delegation-readiness-review-2026-05-08/02-copilot-proposal-delta.md`.
11. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/codex-delegation-readiness-review-2026-05-08/04-plugin-dir-readiness-plan.md`.
12. Read `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE/codex-delegation-readiness-review-2026-05-08/05-iris-orchestrator-needs.md`.
13. Read `/workspace/repos/jgwill/llms-txt/llms-rise-framework.txt` if present.

If a required file is missing, record the missing path and stop before research unless the manifest already authorizes a fallback.

## Manifest Process

1. Locate `launch-manifest.md` in the study root.
2. If it does not exist and the user authorized preflight, create it from `templates/launch-manifest.md`.
3. Validate these fields:
   - date and timezone, expected `2026-05-08 America/Toronto` for the first launch
   - orchestrator, expected `Iris/Hermes`
   - study root
   - related issues, including `jgwill/miadi-orchestration-kit#14` and `miadisabelle/workspace-openclaw#80`
   - plugin dirs and add-dir paths
   - allowed write scopes
   - track order and currently authorized track
   - token caps
   - one optional gap wave per track maximum
   - stop conditions
4. Do not launch a track when the manifest is absent, ambiguous, or contradicted by the user prompt.

## Write Scopes

1. Write only to paths declared in the manifest.
2. For preflight, prefer the study root and explicitly named rispec folders.
3. Do not edit connector repositories, plugin catalogs, or unrelated project files during read-only research.
4. Treat live Discord and OpenClaw runtime connector work as out of scope unless the manifest explicitly changes.

## Token Caps

- Preflight: <= 25k
- Academic: <= 230k
- Technical: <= 320k
- Narrative: <= 190k

Before launching work, estimate the track budget. Stop if the requested wave would exceed the cap or require a second gap wave.

## Stop Conditions

Stop and report when:

- manifest is missing and creation was not authorized
- current date/time context conflicts with the manifest
- write scope is unclear or outside the manifest
- issue links are missing for tracked work
- selected track is not authorized
- token cap would be exceeded
- a source ledger is missing before synthesis
- a major contradiction has no resolution path
- live connector implementation is requested during a research-only phase

## Output

End bootstrap with:

```markdown
# OpenClaw Bootstrap Result

Date/time:
Manifest path:
Authorized track:
Write scopes:
Token cap:
Issue links:
Ready to launch:
Stop reason, if any:
Exact next command:
```
