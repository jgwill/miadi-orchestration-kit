# PDE Loop Closure Orchestration - Proposed Draft 1

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Issue: jgwill/miadi-orchestration-kit#35
Companion: jgwill/mia-code#62

This rispec defines how Miadi orchestration agents, provider-specific plugins,
and engine launch scripts should consume miaco's proposed PDE provenance
instrument. It does not define the canonical schema; that belongs in
`/src/mia-code/rispecs/miaco/pde-provenance-profile.rispec.md`.

## Reverse-engineer

Recent PDE waves show a recurring gap:

- implementation work can land in runtime commits,
- review and audit notes can remain in `.pde/<id>/`,
- follow-up recommendations can be scattered across issue comments, launch
  scripts, and wave notes,
- a later operator may not know whether the loop is complete, partial, blocked,
  or simply uncommitted.

The motivating example is a PDE wave like
`.pde/2605190203--6f129af3-0c46-473f-a55e-391d35f801e3/`, where outcome audit,
STC, launch, adversarial review, and next-wave files preserved useful evidence
but did not form one canonical completion record.

Existing orchestration-kit material already points toward this need:

- `east-pde-session-orchestration` prepares first-prompt charters.
- `agent-memory-provenance-framework` separates observed, inferred, and
  user-confirmed claims.
- `miadi-wave-forge-kit` creates PDE working folders and retryable prompts.
- `miadi-promotion-context-kit` distinguishes raw findings from promoted
  runtime/spec changes.

## Intent-extract

Desired outcome:

An orchestration wave can invoke miaco provenance commands at clear checkpoints
so a later agent or operator can answer:

1. What was the original intent?
2. What context was used?
3. What artifacts were produced?
4. What implementation or issue evidence exists?
5. What was verified?
6. What remains unresolved?
7. Is the loop closed, partial, blocked, or deferred?

Current reality:

Agents can produce strong work but still leave the loop ambiguous because the
evidence is distributed across provider transcripts, local `.pde/` files,
Git commits, and GitHub issues.

Structural tension:

More provenance can improve trust, but too much process can become ritual
overhead. The orchestration layer must call miaco at high-value checkpoints,
not continuously.

## Specify

### Boundary

miaco owns:

- `pde-provenance.json` source-of-truth schema,
- lifecycle commands,
- validation rules,
- Markdown rendering,
- canonical closure states.

miadi-orchestration-kit owns:

- when agents should invoke miaco,
- which evidence provider-specific plugins must collect,
- how launch scripts preserve replayability,
- how audits decide whether another wave is needed,
- how value is evaluated before larger automation or plugin systems are built.

Provider-specific plugin folders under
`miadi-orchestration-kit/<engine>/<plugin>/` should call miaco commands. They
must not define incompatible provenance schemas.

### Checkpoint Pattern

Recommended checkpoints:

| Checkpoint | Orchestration action |
| --- | --- |
| Session start | Run or expect `miaco pde provenance init --pde <uuid-or-path>`. |
| Context intake | Record source paths, add_dirs, issue refs, and prompt files. |
| Wave launch | Record launch script, engine, plugin dirs, and session id if known. |
| Implementation claim | Record changed paths, intended issue refs, and commit refs when available. |
| Review | Record audit files, adversarial findings, contradictions, and confidence. |
| Verification | Record commands, pass/fail state, and evidence artifacts. |
| Handoff | Render human view and record next PDE or issue refs. |
| Closure | Run audit and close as complete, partial, blocked, deferred, or superseded. |

### Agent Responsibilities

Orchestration agents should collect only evidence they can support:

- exact local paths read or written,
- issue and PR references,
- command lines used for tests or audits,
- commit SHAs when a scoped commit exists,
- files intentionally left untracked,
- unresolved tensions and follow-up owners,
- operator confirmations when explicitly given.

They should mark unsupported claims as inferred and avoid promoting transcript
summaries to verified evidence.

### Engine Plugin Usage

Provider-specific plugins should use simple command composition:

```bash
miaco pde provenance record --pde "$PDE_ID" --stage review
miaco pde provenance audit --pde "$PDE_ID" --format json
miaco pde provenance render --pde "$PDE_ID"
```

The plugin may add engine metadata such as provider name, model, session id,
launch command, and plugin directory list. It should not require miaco to load
provider plugins or call engine hooks.

### Loop Closure Verdicts

The orchestration layer consumes miaco's closure state as follows:

| Verdict | Meaning for orchestration |
| --- | --- |
| `complete` | Evidence supports implemented and verified outcome; no required work remains. |
| `partial` | Valuable output exists, but unresolved tensions or missing evidence remain. |
| `blocked` | Progress is impossible without user input or external state change. |
| `deferred` | Tension is intentionally preserved for a future wave or issue. |
| `superseded` | Another PDE, issue, or commit line replaced this wave. |

Partial or deferred closure is valid when the next issue, PDE, or handoff target
is explicit.

### Value Evaluation

Before building larger automation, evaluate whether provenance improves work:

- Can a new agent determine completion status faster than reading raw files?
- Are missed artifacts or untracked PDE files reduced?
- Are follow-up issues more specific and less duplicative?
- Can reviewers distinguish observed evidence from inferred narrative?
- Does the extra recording step stay lightweight enough to use?

Suggested trial:

1. Pick three completed or partial PDE waves.
2. Create `pde-provenance.json` and rendered Markdown for each.
3. Ask a new agent to classify closure using raw artifacts only.
4. Ask another agent to classify closure using provenance output.
5. Compare time, missed evidence, contradictions found, and confidence quality.

## Export

### Consumer Affordances

As a consumer of miaco or a future miadi-orchestration-kit, this offers:

- a predictable checkpoint protocol for multi-agent waves,
- a command surface plugins can call without embedding schema logic,
- a completion artifact that distinguishes evidence from story,
- safer handoffs between Copilot, Codex, Claude, Gemini, and future engines,
- a way to close loops without forcing every unresolved tension to be solved.

Expected consumer API is CLI-first:

```bash
miaco pde provenance init --pde <uuid-or-path>
miaco pde provenance record --pde <uuid-or-path> --stage <stage>
miaco pde provenance audit --pde <uuid-or-path> --format json
miaco pde provenance render --pde <uuid-or-path>
miaco pde provenance close --pde <uuid-or-path>
```

Evidence a consumer can trust:

- path evidence,
- commit SHAs,
- issue and PR refs,
- test and audit command outputs,
- artifact hashes,
- explicit operator confirmation.

Evidence to treat carefully:

- transcript-only claims,
- agent summaries without path refs,
- inferred implementation status,
- unverified launch recommendations.

### Out of Scope

- No big miaco plugin platform in this pass.
- No automatic commits by default.
- No provider-specific schema forks.
- No production memory write-back.
- No final RO-Crate packaging until the simpler miaco provenance profile proves
  useful.
- No replacement for existing `east-pde-session-orchestration`,
  `agent-memory-provenance-framework`, or `miadi-wave-forge-kit`.

### Proposed Orchestration-Kit Follow-up

If this spec advances, add a small skill to one provider plugin first, likely
Copilot or Codex:

```text
skills/pde-loop-closure/SKILL.md
```

The skill should read the active PDE, call miaco provenance commands, render a
closure view, and recommend whether to close, defer, or open a child issue. It
should remain a consumer of miaco, not a competing provenance implementation.

### Acceptance Criteria

- Orchestration agents can name when to invoke miaco provenance commands.
- Provider plugins collect evidence without owning canonical schema.
- A PDE wave can be classified as complete, partial, blocked, deferred, or
  superseded from provenance output.
- The workflow supports unresolved structural tension without treating it as
  failure.
- Larger plugin architecture is explicitly gated on two or three proven extension
  cases.

## Related

- `/src/mia-code/rispecs/miaco/pde-provenance-profile.rispec.md`
- `rispecs/east-pde-session-orchestration/`
- `rispecs/agent-memory-provenance-framework/`
- `copilot/miadi-wave-forge-kit/`
- W3C PROV: https://www.w3.org/TR/prov-overview/
- FAIR principles: https://www.nature.com/articles/sdata201618
- RO-Crate: https://www.researchobject.org/ro-crate/
