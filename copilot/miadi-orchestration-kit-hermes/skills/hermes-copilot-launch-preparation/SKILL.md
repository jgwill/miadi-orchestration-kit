---
name: hermes-copilot-launch-preparation
description: Prepare a Miadi Copilot wave as a machine-readable payload with exact plugin roster, lane contracts, validation scripts, transcript audit hooks, recovery prompt, and closure gate.
---

Use this skill before launching Copilot for Miadi implementation or orchestration work.

## Why this exists

Issue `jgwill/Miadi#354` showed that a good prompt and a shell launcher are not enough.

The launch unit must include:

- machine-readable lane contracts,
- exact namespace-qualified agent IDs,
- validation scripts that exist before the wave starts,
- transcript proof requirements,
- recovery prompt templates,
- closure gates for commits and Chronicle events.

## Workflow

1. Read the issue/PDE/MMOT source.
2. Resolve plugin directories and verify they exist.
3. Discover exact agent IDs from plugin manifests/readmes or Copilot's available-agent output.
4. Write `preparation-payload.json` with:
   - issue anchor,
   - roots,
   - allowed/forbidden paths,
   - plugin dirs,
   - primary agent,
   - lane contracts,
   - validation scripts,
   - closure gate.
5. Write one `lanes/<lane>.contract.json` per lane.
6. Write `validate-waveN.sh` before launch.
7. Write `recovery-prompt.template.txt` before launch.
8. Write `closure-gate.template.md` before launch.
9. Generate `prompt-waveN.txt` from the payload rather than inventing it freehand.
10. Generate `LAUNCH.copilot-waveN.sh` from the same payload.

## Required lane contract fields

- lane_id
- agent_id
- must_be_actual_subagent
- purpose
- input_refs
- allowed_paths
- forbidden_paths
- output_artifacts
- validation_commands
- proof_required
- fallback_policy

## Completion rule

Do not call the launch ready unless all of these exist:

- launch script
- prompt
- preparation payload
- lane contracts
- validation script
- recovery prompt
- closure gate

## Pitfall

If a helper such as Gemini only recommends plugins in prose, treat that as raw input. Convert it into the payload above before launching Copilot.
