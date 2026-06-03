# 05 - Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Claim ledger

| Claim | Evidence | Status | Confidence |
| --- | --- | --- | --- |
| Medicine Wheel PR #62 contains the plugin integration proposal. | `jgwill/medicine-wheel#62`, commit `8f1832a68a7d685a81a8148d2ff549095414f45e`, file `rispecs/plugins/plugin-integration-framework.proposal.md`. | Observed via `gh pr view` and `git show`. | High |
| Commit `cd7cc88d5032c1fcb58762d1a7d1b8587c13f732` refined plugin proposal consistency. | `git show --stat cd7cc88d5032c1fcb58762d1a7d1b8587c13f732`. | Observed locally. | High |
| Commit `d94c1cd84f3d143778a871a4760f9607b618accb` removed `rise-spec-advisor` from `cli/skills.ts`. | `git show --unified=80 d94c1cd84f3d143778a871a4760f9607b618accb -- cli/skills.ts`. | Observed locally. | High |
| The reverted `rise-spec-advisor` workflow is better suited to Miadi cross-harness orchestration than Medicine Wheel runtime skill views. | Comparison of reverted skill body, Medicine Wheel skill registry, and Miadi plugin promotion discipline. | Source-backed inference. | Medium |
| Local Medicine Wheel API was reachable on port 3339 during review. | `curl http://127.0.0.1:3339/api/health`; `MW_API_URL=http://127.0.0.1:3339 mw status`. | Observed locally on 2026-06-03. | High for this environment |
| Local MCP server exposed 54 tools during review. | Direct JSON-RPC `tools/list` through `node mcp/dist/index.js`. | Observed locally on 2026-06-03. | High for this checkout |
| Medicine Wheel issues #64-#67 define known validator and ceremony lifecycle caveats. | `gh issue view 64`, `65`, `66`, `67`; implementation comments posted to each issue. | Observed and commented. | High |
| Miadi has existing Copilot, Codex, Claude, and Gemini harness shapes. | `miadi-orchestration-kit/README.md`, `codex/AGENTS.md`, `gemini/AGENTS.md`, existing plugin folders. | Observed locally. | High |
| No existing Miadi RISE packet specifically defines a Medicine Wheel cross-harness adapter. | `find miadi-orchestration-kit/rispecs`, `rg` over Miadi rispecs and plugin folders. | Observed search result with partial related specs only. | Medium |
| RISE framework requires desired outcome, current reality, structural tension, natural progression, and implementation-agnostic specifications. | `llms-txt/llms-rise-framework.txt`. | Observed locally. | High |
| Kinship framing supports separating Medicine Wheel core as relation source from Miadi plugins as descendants/adapters. | `llms-txt/llms-kinship-hub-system.md`. | Source-backed inference. | Medium |

## Related issues and comments

- Miadi tracking issue: `https://github.com/jgwill/miadi-orchestration-kit/issues/36`
- Medicine Wheel PR feedback issue: `https://github.com/jgwill/medicine-wheel/issues/68`
- Medicine Wheel PR: `https://github.com/jgwill/medicine-wheel/pull/62`
- Issue #64 comment: `https://github.com/jgwill/medicine-wheel/issues/64#issuecomment-4615557131`
- Issue #65 comment: `https://github.com/jgwill/medicine-wheel/issues/65#issuecomment-4615557116`
- Issue #66 comment: `https://github.com/jgwill/medicine-wheel/issues/66#issuecomment-4615557122`
- Issue #67 comment: `https://github.com/jgwill/medicine-wheel/issues/67#issuecomment-4615557121`

## Open questions

- Should the first concrete implementation be Codex-native, because Codex is
  active in this session, or Copilot-native, because PR #62 used Copilot plugin
  precedent?
- Should future Medicine Wheel core docs add a small `KINSHIP.md` pointer from
  plugin proposals to Miadi adapter specs?
- Should Medicine Wheel expose an external/advisory skill catalog separate from
  `mw skill view` and `mwsrv skill view`, or should advisory behavior remain in
  Miadi?

## Promotion state

This packet is specification-ready for a future implementation wave. It is not
itself a plugin.
