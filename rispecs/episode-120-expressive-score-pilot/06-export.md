# 06 — Export

## Implemented surfaces

- `skills/on-set-performance/` — T10 practice and `field-kit.yaml` profiles;
- `teams/teams.json` and `teams/README.md` — pilot T10 inventory;
- `jgwill/Miadi#1043` — `@miadi/expressive-take` package;
- `teachings/episode-120-expressive-score-pilot.md` — Miette teaching;
- editable presentation — the same passage shown visually for a young reader.

## Validation recipes

```sh
ruby -e 'require "yaml"; YAML.load_file("skills/on-set-performance/field-kit.yaml")'
node -e 'JSON.parse(require("fs").readFileSync("teams/teams.json", "utf8"))'
python3 /workspace/repos/jgwill/llms-txt/rispecs_layout_check.py rispecs/episode-120-expressive-score-pilot
python3 /home/mia/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/on-set-performance
git diff --check
```

The Miadi package separately compiles TypeScript and runs its Node tests. The
presentation is rendered and inspected slide by slide before export.

## Delivery rule

The PR exports specifications, practice, adapter, teaching and rehearsal
evidence. It does not export media, participant identity, a performed cue or a
claim that the field pilot is complete.
