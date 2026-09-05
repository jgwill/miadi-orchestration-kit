# Coordinator expectation, written before the lanes answer

Written 2026-09-04 by the coordinating seat (Claude Fable 5.1, Gaia, session for episode 347) at kit HEAD `85c3656`, before dispatching three lanes into this packet. Dispatch-discipline §7: record what you expect the lane to say differently, before you see it, and commit it.

Anchors: jgwill/miadi-orchestration-kit#41 (distribution half), jgwill/Miadi#621 (runtime half). William's word today: one skill; API-first with the API committing, pulling (rebase, safely) and pushing on the server; every agent harness, not only Claude Code; the wheel is on Ilex, reached from Gaia through a tunnel, so no per-host variants.

## What I expect each lane to conclude

- Lane A (one skill): that the Gaia SKILL.md (395 lines) is the lifecycle text and the Ilex SKILL.md (172 lines) adds only paths, capture custody, and the tool-readiness probe; that a single skill can carry the lifecycle with every path read from `MIADI_CHRONICLE_ROOT`, `MIADI_CHRONICLE_MW_URL`, `MIADI_INQUIRY_DIR`; that the "earned" history paragraphs shrink to one line each with a date; that the skill's verbs become API calls first, CLI second, raw git/curl only as proof.
- Lane B (API): that `POST /api/chronicle/episodes` behind `requireMiadiAuth({write:true})` is the door; that number allocation must happen after a fetch and rebase (jgwill/Miadi#501 and #584); that the manifest shape must be mkepisode's (`status: vessel`, `goal`, `references`), not `scaffoldEpisode`'s (`status: scaffold`); that the five-stage report from `voice-mcp/src/closing.ts` is the response body; that the same verbs land on `inquiry-weave-mcp` as tools.
- Lane C (distribution): that the kit's `skills/` root is the one source, referenced by each harness lane (claude-code plugin manifest, codex, gemini, copilot, pi) rather than copied; that install is a symlink or a manifest reference plus a version-floor preflight; that `/etc/claude-code/skills/chronicle-episode` becomes a pointer.

## What I expect to be wrong about

- The API may not be able to own `git push` from the Next.js process on every host (credentials, the tunnel, a dirty shared tree with other occupants' modified files). Lane B may say the push belongs to a queue or a separate service.
- Lane A may find that the attention contract and the Twine promotion are too large for one skill and propose that "one skill" means one entry point that routes, which is what the Gaia skill already claims to be.
- Lane C may find that Codex or Gemini cannot load a skill by reference and need a generated copy, which reintroduces the divergence the user is trying to end.
