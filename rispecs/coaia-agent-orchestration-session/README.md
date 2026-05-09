# coaia-agent Orchestration Session Pack

> This folder is the replayable session pack for the coaia-agent COAIA integration implementation. Any agent starting a fresh Copilot session can read this README → `launch-context.md` → `session-charter.md` and know exactly what to do.

**Session UUID**: 2604291305-coaia-agent-rispecs
**PDE UUID**: 4da3f9f5-4fe4-4b92-9e9f-f4fead872780
**Model preference**: claude-opus-4.6 (approved fallback: claude-sonnet-4.6)
**Authored**: 2026-04-29 by NORTH N3 (claude-sonnet-4.6)
**Pattern reference**: [`rispecs/security-remediation-orchestration/README.md`](../security-remediation-orchestration/README.md)

---

## Mission Scope

**This session implements** the COAIA integration rispecs for `coaia-agent` — wiring PDE decomposition, STC creation, MMOT evaluation, Veritas companion support, and Medicine Wheel governance annotation into the Hermes Agent fork.

**This session does NOT**:

- Rebrand `hermes-agent` identity to `coaia-agent` at the `pyproject.toml` / `package.json` level (identity normalization is a future decision gated by `contradictions.md` C1–C7 resolution)
- Implement Medicine Wheel ceremony authority assignment (coaia-agent remains an unentitled actor)
- Implement Veritas integration by default — Veritas toolset is wired but disabled in default config
- Merge or resolve the direction casing contradiction (C1) — the normalization adapter is specified but the human decision is pending
- Create a new `--plugin-dir` for coaia-agent — this session uses `--add-dir` to expose context; plugin graduation is a future decision gate

---

## Reading Order

Before opening any implementation wave, read in this order:

1. **This file** — mission scope, reading order, what NOT to do
2. [`launch-context.md`](./launch-context.md) — complete launch command, plugin composition, wave sequence
3. [`session-charter.md`](./session-charter.md) — lane contract, artefact folder, required outputs, boundaries
4. [`/a/src/.pde/2604291317--4da3f9f5-4fe4-4b92-9e9f-f4fead872780/pde-4da3f9f5-4fe4-4b92-9e9f-f4fead872780.md`](../../../../src/.pde/2604291317--4da3f9f5-4fe4-4b92-9e9f-f4fead872780/pde-4da3f9f5-4fe4-4b92-9e9f-f4fead872780.md) — PDE Four Directions decomposition, intent, expected outputs
5. [`/a/src/.coaia/pde/48b47ec4-6244-46ae-955b-3724a1b4e071.jsonl`](../../../../src/.coaia/pde/48b47ec4-6244-46ae-955b-3724a1b4e071.jsonl) — STC session JSONL (current reality and action steps)
6. [`/a/src/coaia-agent/rispecs/`](../../../../src/coaia-agent/rispecs/) — the full rispec pack authored by this spec-authoring session
7. [`/workspace/repos/jgwill/miadi-orchestration-kit/copilot/session-charter-template.md`](../../copilot/session-charter-template.md) — charter template

**If any of items 4–7 do not exist when the executor opens the session, the executor must stop and surface the missing paths before proceeding to implementation waves.**

---

## Files in This Pack

| File | Purpose |
|---|---|
| `README.md` (this file) | Reading order, mission scope, what NOT to do |
| `session-charter.md` | Lane contract, workdir, artefact folder, required outputs, wave boundaries |
| `launch-context.md` | Complete `copilot` launch command, plugin dirs, add-dirs, model, wave sequence |

**Deferred to implementation session** (do not pre-create):

| File | Created when |
|---|---|
| `EXECUTION_LOG.md` | Session start — live state tracker |
| `wave-<N>-report.md` | End of each wave |
| `session-summary.md` | Final session close |

---

## Boundary with Issue Workspace

Reusable orchestration patterns belong here.

Issue-specific evidence, intermediate notes, and execution logs belong in the implementation session artefact folder:

```
/a/src/.mia/coaia-agent/implementation-session-<YYYYMMDDHHMM>/
```

Do not move issue-specific state here. Do not fork a new plugin until repeated use proves a new reusable kit boundary is needed (same rule as security-remediation-orchestration).
