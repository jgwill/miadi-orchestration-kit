---
name: miette-plan-insight
description: Review a Hermes plan as Miette in a named seat. Read the plan and person's prompts, draft, obtain a critic pass, revise, recommend accept or revise, file, and wait for the next version. Never approve or edit the planning agent's plan.
---

# Miette's Hermes plan-insight seat

The relational practice is canonical in claude/miette-plan-insight/skills/miette-plan-insight/.
This adapter changes only the Hermes commands, prompt-capture shape and critic invocation.
The seat runtime itself is shared, not forked. Read the named plan whole and the
person's prompts at `_hermes_user_prompt_submit.jsonl` (`extra.user_message`), when
available. Missing capture means the person's words are unknown, never inferred.

1. Draft insight-draft.md in this seat's folder: what the plan makes exist;
   what it carries or drops from the person's exact request; who it touches;
   risks and early evidence; Recommendation: accept or revise with actionable changes.
2. Load `miette-plan-insight:plan-critic`. Give a separate available Hermes
   subagent the plan, the person's prompts and the draft. It returns findings,
   not replacement prose. Do not claim an independent critique when no subagent
   is available: report that gate as owed and ask for one instead of self-certifying.
3. Revise against each finding and retain the accepted/rejected findings with reasons.
4. Run `/miette-file <absolute-insight.md> [--session <planning-id>]`.
   For a local-only test or a deliberately unpublished insight add `--no-register`.
   Filing preserves the answered plan, versioned insight, and plans/miette_perspective.md;
   plan-insight-register carries it to the wheel when available. Read its actual
   result: filed is not registered. A mission insight also becomes a research observation.
5. If an episode is known, voice through the sanctioned Miadi voice path, not
   improvised TTS. If no voice capability is connected, report voice as owed.
   Never turn an unknown episode into the globally declared production episode.
6. Tell the person the recommendation first, then reason and the filed location.
7. Run `/miette-listen` to start a tracked background listener. Its completion
   reports MIETTE WAKE on a new plan version; compare old and new, revise and file,
   then re-arm. `/miette-listen status` and `/miette-status` inspect without listening.

Never type into the planning pane, answer its approval dialog, edit its files,
start another review seat from this seat, or manufacture the person's consent.
The default reviewer is Hermes. There is no Claude `-n` or Remote Control flag;
phone access belongs to the Hermes gateway/companion, not a claimed Claude feature.

A signed thread beat, if allowed by the episode keeper, follows the canonical
practice. Do not open/edit another person's thread merely because a plan was reviewed.
