---
name: deep-research-foundations
description: >
  Stewardship contract for creating and maintaining repository-local
  `foundations/<topic>/` packets: an opening statement of intent, academic
  grounding in parallel field lanes, a source ledger with verification states,
  gap analysis and synthesis, distributed in a package and related to what the
  packet grounds. Responsibilities are held by persona types with named
  capabilities, not by named agents.
version: 0.3.0
---

# Deep Research Foundations

Use this skill when a repo needs a durable `foundations/<topic>/` packet rather than a one-off research summary.

The skill keeps the deep-research orchestration pattern (date context, MECE field decomposition, source quality rules, source ledger, gap analysis, synthesis) and adds what a packet owes the people who use it: the intent it serves, who held each part of the work, and what a person needs to discuss it with an agent.

The grounding for this version is the packet `miadi-foundation:personas-capabilities-and-research-stewardship` (jgwill/Miadi, `@miadi/foundations@0.1.23`).

## Stewardship Contract

### Purpose

Create academically grounded, repo-local foundation packets that help a branch, skill, runtime, issue, episode or artifact stand on recognized fields, explicit provenance, and readable intent.

### Stewardship Responsibilities

Each responsibility is a kind of work on one packet, with named outputs. Any persona of the stated type may hold it. A persona's voice is not what covers the contract: the outputs are.

| code | responsibility | persona type that holds it | capabilities it needs | phases | named outputs |
|---|---|---|---|---|---|
| SR1 | intent | the person asking; a lead seat drafts it only as "proposed, not confirmed" | read the request and its sources; quote exactly | 0, returned to at 5 | the opening statement in `intent-understanding.md` |
| SR2 | decomposition and briefing | lead seat | read local context; write lane briefs with objective, output format, tools, boundaries | 1, 2 | field list in `context-layer.md`; one brief per lane |
| SR3 | field research | research lane, one per field, independent of the others | web search and fetch; read local files; write one lane file | 3 | `lanes/<code>-<field>.md` with its sources |
| SR4 | gap finding | a lane or seat that did not write the lanes | read every lane file; ask from what no lane covered | 4 | gap list; follow-up lanes where risk is high |
| SR5 | sources and verification | a reader that did not write the claim it checks | open sources; check claims against them | 3, 4, 6 | `verified` per source in `source-ledger.yaml`; claims spot-checked |
| SR6 | synthesis | lead seat | read all lanes; write findings with their lane codes | 5 | `synthesis.md` |
| SR7 | placement and distribution | lead seat | commit and push in the consuming repo; release the package; relate the packet where it grounds | 6 | the packet in `foundations/<topic>/`; the package version; the relation |
| SR8 | transmission and discussion | a companion persona, after SR5 | read the packet; state its own capabilities and limits; check back on a term before building on it | after 6 | the discussion, held inside the packet's parts (see "After the packet") |
| SR9 | decisions the packet cannot make | the people who hold them, named by the lead seat | none: the seat names, it does not decide | 0, 6 | the names, in `intent-understanding.md` or the README |

Rules:

- Record who held each responsibility in the packet's README, as assignments: responsibility, holder, persona type, and the delegator when work was handed on. The delegator keeps the responsibility.
- One accountable holder per packet, named in the README.
- SR5 is never held by whoever wrote the claim it checks.
- One persona may hold several responsibilities, and several personas may share one.
- Voice belongs to SR8, after verification.

## Placement and Distribution

Every repo owns its own local packet root:

```text
foundations/<topic>/
```

Default rule:
- place the packet in the repo where the work will actually be consumed
- where the repo ships a foundations package, release it there (jgwill/Miadi: `node packages/foundations/scripts/release.mjs`, publishing `@miadi/foundations`)
- relate the packet to what it grounds: a Chronicle episode through the foundation door (`chronicle_episode_foundation`, with a relation phrase), or, in a repo without the Chronicle, the issue, spec or artifact it grounds

Option, not default: QMD may index and federate packet content across repositories.

### The packet's address

In a Miadi repo a packet is addressed `miadi-foundation:<slug>`, where `<slug>` is
its directory name, and one of its files `miadi-foundation:<slug>/<file>`. Write
the address on the README's metadata line, so a reader can cite the packet from an
article, an episode, a review or a terminal note and every surface opens the same
page. A small packet an episode writes for itself lives under
`<episode>/foundations/<topic>/` and is addressed
`miadi-chronicle:<episode>/foundations/<topic>`. Grammar: jgwill/Miadi
`rispecs/miadi-chronicle-dsl/SPEC.md` §10 (jgwill/Miadi#713).

## Packet Shape

Recommended minimum structure:

```text
foundations/<topic>/
  README.md              address, date, method version, verification, what it grounds, stewards, accountable holder
  source-ledger.yaml
  context-layer.md
  intent-understanding.md
  synthesis.md
  lanes/<code>-<field>.md   one per field lane
```

## Explicit Layer Separation

### 1) Context-Layer

The context-layer captures the shared framing and durable metadata around the packet.

Include:
- shared language and canonical terms, with the sense used here where sources disagree
- field list and MECE decomposition
- provenance notes, including which model class ran which lane
- source quality rules
- source ledger conventions
- placement and distribution
- related issues, packets, specs, episodes or PDE artifacts

### 2) Intent-Understanding

The intent-understanding layer opens with the statement of intent (Phase 0) and then says what tension the packet resolves.

Include:
- the opening statement, in the asking person's words, with its confirmation status
- intended audience(s)
- current reality
- desired outcome, stated as something that will exist
- decisions this packet is expected to support, and who holds them (SR9)

## Research Diamond

```text
         [Open: state the intent]
                   |
         [Broad: decompose question]
              /        \
    [Narrow: 3-6 parallel field lanes]     ← Wave 1
              \        /
         [Evaluate: gaps, cautions]
              /        \
    [Deep: 1-2 targeted lanes]             ← Wave 2 if needed
              \        /
         [Synthesize: foundations packet]
```

## Workflow

### Phase 0 — Open with intent and date

Before any search, write the opening statement (SR1). The person writes it, or confirms a draft the lead seat marks "proposed, not confirmed". It answers:

- who asks, and through whom
- why, in their words
- what the result serves
- who it answers to
- what would change the question

Record today's date and include it in prompts, packet metadata and the source ledger.

The grounding is Wilson (2008), who opens with "my motivations as a researcher" (p. 33) and situates "the research and researcher" first (p. 35), and Kovach (2010), who found "purposefulness and motivation" and "space for self-location" (pp. 43-44). Mainstream research design also starts from a stated question, so do not present this phase as a contrast between intent and no intent. Call the statement "ceremonial" only where the person does.

### Phase 1 — Gather Local Context

Before external research:
- read local repo guidance (`AGENTS.md`, `README.md`, specs, skill docs, issue notes)
- inspect existing `foundations/` content if present, and reuse verified citations from neighbouring packets
- note adjacent artifacts that the packet must support

### Phase 2 — MECE Field Decomposition

Break the topic into mutually exclusive, collectively exhaustive fields.

Common field families:
- human-computer interaction
- software architecture / traceability
- knowledge organization
- governance / provenance
- narrative studies / meaning-making
- domain-specific academic fields implied by the topic

Scale effort to complexity:
- narrow factual check: 1-2 fields
- normal foundations packet: 3-4 fields
- complex cross-repo lineage: 4-6 fields plus a critique pass

### Phase 3 — Parallel Research

Each lane is independent and writes one file. Its brief carries:

```text
You are research lane [CODE] of a repository-local foundations packet.
TODAY'S DATE: [date]
INTENT: [the opening statement, or its pointer]
PURPOSE: [why this packet matters]
AUDIENCE: [who will use it]
ANGLE: [field scope]
BOUNDARIES: [what this lane does not cover; what it must not change]
SOURCE QUALITY: Prefer standards, peer-reviewed papers with DOIs, official docs, primary sources. Mark anything not opened as unverified. Never invent a DOI, URL, page or quotation.
OUTPUT: write foundations/<topic>/lanes/[CODE]-[field].md with concepts, findings, cautions, implications, and sources (URL/DOI, date opened, verified true/false). Do not commit.
```

`agent-templates.md` holds fuller lane briefs.

### Phase 4 — Gap Analysis

After all lanes return, a seat that did not write them (SR4):
- checks whether each field is adequately sourced
- identifies contradictions and unsupported claims
- asks what no lane covered
- runs targeted follow-up lanes where risk is high

### Phase 5 — Synthesis

Synthesize, do not concatenate. Each finding names the lane findings behind it.

For each claim that carries a decision, give its data, warrant, qualifier and rebuttal. List open questions and what must not be claimed. Return to the opening statement and say what changed, without a score.

`source-ledger.yaml` includes at minimum:

```yaml
meta:
  packet: <topic-slug>
  generated: <date>
  method: deep-research-foundations@<version>
  verification_status: live-web-verified | training-knowledge-only | mixed
sources:
  - id: <lane>-<short-id>
    field: <field>
    title: <title>
    ref: <url or doi>
    supports: <claim-or-decision>
    verified: true|false
```

### Phase 6 — Placement, Distribution and Verification

Before calling the packet done:
- confirm it lives under the correct repo-local `foundations/<topic>/`
- release the package where one exists, and relate the packet to what it grounds
- a reader that did not write them spot-checks representative claims against their sources (SR5)
- verify that the source ledger parses and its counts match the lanes
- preserve unrelated worktree state

## After the packet: discussion

A person discusses a packet with a companion persona (SR8). The packet supplies what that persona needs, and the persona's role is to keep the discussion inside it:

- the purpose in the person's words, with its confirmation status
- a glossary of terms in the sense used
- the evidence state of each claim, and the ledger row behind it
- claim records (data, warrant, qualifier, rebuttal) for the claims that carry a decision
- open questions, and what must not be claimed
- the persona's own capabilities and limits

A citation raises trust even when it is wrong, so a cited claim is not evidence until checked.

## Quality Gate

Do not call the packet complete unless:
- the opening statement exists, with its confirmation status
- the stewards and the accountable holder are recorded in the README
- recognized fields are named
- context-layer and intent-understanding are clearly separated
- sources are cited with URLs and/or DOIs where available, each with a verification state
- representative claims were checked by a reader that did not write them
- engineering implications are actionable
- synthesis is readable and bounded
- the packet records the method version it followed
- placement and distribution are done
- unrelated dirty state is untouched

## Revising this method

- The version is in the frontmatter. Every change adds an entry below with its reason.
- A packet records the version it followed. Packets made under an earlier version are not rewritten.
- Revise when a packet departs from the method, when two copies of this skill disagree, or when residue from another project is found.

| version | date | change | reason |
|---|---|---|---|
| 0.3.0 | 2026-11-22 | Stewardship by persona type, capability and phase (SR1 to SR9) replaces three named agents. Phase 0 opens with a statement of intent. Placement becomes distribution; QMD is an option. Lane files, discussion section, quality gate items, packet address section carried from the `@miadi/foundations` copy. | Guillaume, 2026-11-22: the named agents "should be a generalized shared responsability between persona"; grounded in `miadi-foundation:personas-capabilities-and-research-stewardship`. jgwill/miadi-orchestration-kit#167 |
| 0.2.0 | imported 2026-11-22 | Canonical stewardship contract with three named stewards. | Imported from jgwill/dotagents into this kit (commit `790495f`) as staging for jgwill/miadi-orchestration-kit#167. |

## Common Pitfalls

- creating a generic report instead of a repo-local foundations packet
- starting the search before the intent is stated
- mixing provenance metadata with intent analysis until neither is clear
- treating a persona's voice as coverage of a responsibility
- treating a citation list as evidence
- naming a specific agent as a steward in the method instead of a persona type
- staging unrelated repo changes while committing skill work
