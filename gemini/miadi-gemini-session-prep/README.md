# Miadi Gemini Session Prep Extension

Gemini-native session preparation for Miadi orchestration work.

## Purpose

This extension makes Gemini sessions more reliable by giving the agent a repeatable preparation ritual before it starts changing files:

- identify the work context,
- inspect available Miadi orchestration kits,
- choose the smallest Gemini-native extension surface,
- create a session charter,
- create a source ledger,
- write a replayable launch script under `.pde/`,
- keep reports short and attention-focused.

It is the Gemini-extension counterpart to the recommender class implied by `/a/src/scripts/fn_llm.sh` functions:

- `pto_orchestration_plugins_recommender()`
- `pto_orchestration_plugins_recommender_codex()`

For Gemini, the output is not `--plugin-dir`; it is `gemini extensions validate/link` recipes and extension/skill activation guidance.

## Install for local development

```bash
cd /workspace/repos/jgwill/miadi-orchestration-kit
gemini extensions validate gemini/miadi-gemini-session-prep
gemini extensions link gemini/miadi-gemini-session-prep
gemini extensions list
```

Restart Gemini CLI after linking.

## Use

Inside a Gemini session, ask for the skill by name:

```text
Use miadi-gemini-session-prep for this mission: <mission text>
```

Or use the bundled command if available after restart:

```text
/miadi:session-prep <mission text>
```

## Output contract

The session prep should create or update:

```text
.pde/<tlid>--<uuid>/
  session-charter.md
  source-ledger.md
  extension-recommendation.md
  LAUNCH.gemini-orchestration.sh
```

Reports should stay compact: 55 words or less per aspect, and only surface what needs human attention.

## Boundary

This extension prepares reliable sessions. It does not itself perform live external dispatch, push code, or mutate GitHub state unless the operator explicitly asks for that as the next step.
