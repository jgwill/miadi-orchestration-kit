# Miadi Design Bundle Integration Kit

A reusable Miadi-native Copilot orchestration kit for integrating **any** Claude Design bundle (claude.ai/design) into **any** target codebase. Token codification, design-asset conversion, screen reimplementation, two-stage fidelity audit, subagent-driven review/revise loops.

This kit is the operator surface for Design→Codebase work as part of the [Miadi Orchestration Suite](../../../../../../../workspace/wikis/Miadi/Miadi-Orchestration-Suite.md). It is **not** the whole bundle integration story — only the Copilot-facing toolkit. The instance-specific session charters, prompts, and wave reports live alongside the PDE that drives the integration.

## What this kit does

Each invocation of this kit, against a specific bundle and a specific target codebase, advances through these stages:

| Stage | Lane | Typical scope | Subagent strategy |
|---|---|---|---|
| Tokens | Single-lane | Copy `tokens.css` (or equivalent) verbatim, codify rispec, convert design assets (mark.jsx → mark.svg) | none |
| Hub + Artifacts | Single-lane | Stage `index.html` + spec/deck/walkthrough/voiceover under the codebase's static area, wire route, link from existing entry page | none |
| Screens | Multi-lane | Reimplement each screen as production code in the target stack | one task agent per screen, two-stage review per screen |
| Audit + Close | Main lane | Final fidelity sweep, rispec linkages, milestone close | not delegated — synthesis stays here |

The exact bundle path, target codebase, milestone reference, screen list, and stack are all named in the **session charter** the orchestration folder writes per wave. This kit holds the generic toolkit; the orchestration folder steers one execution against one Design→Codebase pair.

## Agents

| Agent | Description |
|---|---|
| `Design Bundle Implementer` | Implements bundle integration with semantic + token + voice fidelity. Stays in lane. Dispatches subagents when the wave covers multiple independent items. |
| `Design Bundle Fidelity Reviewer` | Two-stage audit — Stage 1 spec compliance (gate), Stage 2 code quality. Independent of implementer self-claim. |

## Skills

| Skill | Description |
|---|---|
| `bundle-integration` | Token codification, design-asset conversion, hub + artifacts staging. Single-lane waves (tokens, hub). |
| `screen-implementer` | One-screen-at-a-time reimplementation in the target codebase's stack. For delegated waves. |
| `fidelity-audit` | Two-stage gate + cheap post-wave audit pattern using a free model. Required after every implementer task. |

## Required inputs from the orchestration folder

Each wave's session charter must name:

1. **Bundle path** — where the design bundle is extracted (typically `<pde-folder>/bundle/<project>/`)
2. **Target codebase** — absolute path of the codebase receiving the integration
3. **Milestone or issue reference** — for provenance comments and rispec cross-links
4. **Lane scope** — what this wave's lane covers; what is out of scope
5. **Production stack** — vanilla HTML/CSS/JS, React, Vue, native, etc.
6. **Viewport floor** — mobile fidelity threshold (e.g., 768px)
7. **Token rispec path** — where to author the visual-design-system rispec
8. **Staging path** — where to mount the prototype hub (typically `<target>/static/<staging>/`)
9. **Per-screen mapping** (Screens wave only) — bundle source path → target implementation path
10. **Audit invocation** — the cheap-audit command and which model to use
11. **Output report path** — where the wave report lives (typically `<pde-folder>/orchestration/wave-N-report.md`)

## Smoke test

Verify the kit loads in a temp directory using the free model:

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-design-bundle-integration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  -p "Name the agents and skills in this kit, then say if it is loaded."
```

## Wave launch (typical orchestration folder pattern)

```bash
cd <pde-folder>/orchestration
./launch.sh 1   # Tokens wave
./audit.sh 1
./launch.sh 2   # Hub + artifacts wave
./audit.sh 2
./launch.sh 3   # Screens wave (multi-lane)
./audit.sh 3
# Final wave (audit + close) typically stays in main Claude Code session
```

The orchestration folder owns `launch.sh`, `audit.sh`, the per-wave prompt files, and the wave reports. This kit is plugged in via `--plugin-dir`.

## Session export

Both `--share <markdown-path>` and `--share-gist` are supported on the launch command. Use `--share-gist` for the Screens wave so the orchestrator can review the full subagent-dispatch ledger as a secret gist after the wave completes.

## Hard rules (kit-wide)

- Bundle source at `bundle/` is **READ-ONLY** design reference. Never edit it.
- No new runtime dependencies in production output unless the charter explicitly approves them.
- Surgical edits only in the target codebase. No unrelated refactoring.
- Never `git add -A` — stage only files authored or copied this wave.
- Never commit unless the charter authorizes it. Leave staging visible for the main Claude Code session.
- Never run destructive operations (Docker volume removal, database drops, force-pushes, etc.) without explicit human confirmation.

## Scope discipline

This kit is **deliberately small**:

1. one reusable plugin folder under the canonical `miadi-orchestration-kit/copilot/` location,
2. two abstract agents (implementer + reviewer),
3. three skills covering the three implementation phases (bundle-integration, screen-implementer, fidelity-audit),
4. instance-specific charters and launch scripts kept in the PDE folder, **not** duplicated in the kit.

When a new bundle needs integration into a new codebase, write new prompts in that PDE's orchestration folder and point them at this same `--plugin-dir`. Don't fork the kit.

## Relationship to Miadi

This kit complements the existing kits in the suite:

- `stckin-orchestration-kit` — STCKin and structural-tension-aware deep-search waves
- `miadi-promotion-context-kit` — promotion lifecycle (provenance → spec → wiki → retrieval)
- `miadi-adversarial-review-kit` — adversarial review of in-flight work
- **`miadi-design-bundle-integration-kit`** — Design→Codebase integration, this kit

Each kit is a small, replayable plugin folder. They compose by being added together (`--plugin-dir <kit>` per kit) when a wave needs more than one capability.

## See also

- `/workspace/repos/jgwill/miadi-orchestration-kit/skills/use-design-bundle-integration-kit/SKILL.md` — top-level Claude Code-facing skill that explains how to invoke this kit from a main session
- `/workspace/wikis/Miadi/Miadi-Native-Copilot-Orchestration-Kit.md` — wiki page for the broader Copilot-facing surface
