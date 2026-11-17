# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Handoff shape for the plugin scaffolding wave

After `03-specify.md` is stable, a plugin scaffolding wave may use this file
as its launch contract.

### Inputs required

| Input | Path | Status |
| --- | --- | --- |
| Event schema table | `03-specify.md` → Hook event schema | present |
| Observer role contracts | `03-specify.md` → Observer role contracts | present |
| Write-back gates | `03-specify.md` → Write-back gates | present |
| NCP beat field values | NCP track | deferred |
| Bus topology config | Future implementation wave | deferred |

### Files to produce

| File | Purpose |
| --- | --- |
| `codex/hermes-hook-observer-kit/.codex-plugin/plugin.json` | Plugin manifest |
| `codex/hermes-hook-observer-kit/README.md` | Plugin overview and usage |
| `codex/hermes-hook-observer-kit/agents/hermes-event-observer.md` | Observer agent definition |
| `codex/hermes-hook-observer-kit/skills/hermes-hook-prepare/SKILL.md` | Preparation skill |
| `codex/hermes-hook-observer-kit/templates/hook-event.json` | Hook event shape template |

### Promotion decision record

| Gate | Status | Evidence |
| --- | --- | --- |
| Input contract | pass | `03-specify.md` defines event schema and observer contracts |
| Output contract | pass | Files to produce are listed above |
| Stop conditions | pass | Named in `03-specify.md` per role and per gate |
| Source ledger | partial | `05-source-ledger.md` present; NCP rows still provisional |
| Write scope | pass | Markdown-only; no live connectors at this stage |
| Operational precedent | partial | Pattern follows `miadi-adversarial-review-kit`; no Hermes-specific precedent yet |
| External side effects | pass | None at markdown-skill tier |
| Promotion evidence | partial | First plugin scaffolded; requires one successful observer-skill run before `promote` |

**Decision: `split`** — scaffold the plugin now (markdown tier is ready),
hold full operational promotion until one successful observer-skill run is
documented in the source ledger.

## Resume audit prompts

A `--resume --model gpt-5-mini` audit should be able to answer:

1. Which lanes were used in the scaffolding wave?
2. What did each lane inspect?
3. Did the main lane stay clean (no raw file inspection)?
4. Were any NCP rows still provisional at closeout?
5. Was the config-update gate enforced in the Tuner/Coach contract?
6. What is the next proving run required before full promotion?

## Next proving run

Document one successful use of `hermes-hook-prepare` skill where:

- a session surface is instrumented with typed hooks,
- a subscriber manifest is produced,
- at least two enriched events appear in a trace.

Record this in `05-source-ledger.md` under `operational-precedent` before
requesting full `promote` decision.

## Handoff to wiki (deferred)

Do not promote Hermes concepts to the Miadi wiki until:

- NCP beat field is specified by the NCP track.
- At least one Tuner/Coach configuration delta has been accepted and logged.
- The operational-precedent ledger row is `status: observed`.
