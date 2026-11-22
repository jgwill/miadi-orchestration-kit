---
name: deep-research-foundations
description: >
  Canonical Miadi / Mighty Eagle stewardship contract for creating and
  maintaining repository-local `foundations/<topic>/` packets with academic
  grounding, provenance discipline, source ledgers, gap analysis, and
  synthesis that can travel across Mighty Eagle, Gaia, IronSilk, and related
  repos.
version: 0.2.0
---

# Deep Research Foundations

Use this skill when a repo needs a durable `foundations/<topic>/` packet rather than a one-off research summary.

The skill preserves the useful deep-research orchestration pattern:
- date context
- MECE field decomposition
- source quality rules
- source ledger
- gap analysis
- synthesis

It removes person-specific residue and treats foundations work as a canonical Miadi / Mighty Eagle stewardship contract.

## Stewardship Contract

### Purpose

Create academically grounded, repo-local foundation packets that help a branch, skill, runtime, issue, or artifact stand on recognized fields, explicit provenance, and readable intent.

### Stewardship Responsibilities

- **Kherix** owns academic rigor, source quality, citation discipline, and whether the packet is intellectually sound.
- **MiaClaw** owns structure, routing, packet shape, repo placement, crosswalks, and keeping the packet usable by engineering and stewardship workflows.
- **AvaClaw** is consulted when the packet needs relational framing, onboarding voice, narrative resonance, or human-facing transmission shaped with care.

## Default Placement

Every repo owns its own local packet root:

```text
foundations/<topic>/
```

Default rule:
- place the packet in the repo where the work will actually be consumed
- Mighty Eagle may maintain a higher-level registry or crosswalk across related repos
- QMD may index and federate packet content across repositories

## Packet Shape

Recommended minimum structure:

```text
foundations/<topic>/
  README.md
  source-ledger.yaml
  context-layer.md
  intent-understanding.md
  synthesis.md
```

For fielded packets, add one file or folder per field:

```text
foundations/<topic>/
  README.md
  source-ledger.yaml
  context-layer.md
  intent-understanding.md
  synthesis.md
  <field-slug>.md
```

## Explicit Layer Separation

### 1) Context-Layer

The context-layer captures the shared framing and durable metadata around the packet.

Include:
- shared language and canonical terms
- field list and MECE decomposition
- provenance notes
- source quality rules
- source ledger conventions
- repo placement
- QMD indexing / federation / crosswalk notes
- related issues, packets, specs, or PDE artifacts

Questions this layer answers:
- what language are we using?
- what fields are in scope?
- where does this packet live?
- how will provenance and indexing be maintained?

### 2) Intent-Understanding

The intent-understanding layer captures why the packet exists and what structural tension it resolves.

Include:
- why this branch, skill, issue, or artifact exists
- intended audience(s)
- desired outcome
- current reality
- structural tension being resolved
- decisions this packet is expected to support
- what success would make easier downstream

Questions this layer answers:
- why are we doing this now?
- who is this for?
- what decision or artifact must this packet strengthen?
- what tension does this packet help resolve?

## Research Diamond

```text
         [Broad: decompose question]
              /        \
    [Narrow: 3-6 parallel field agents]    ← Wave 1
              \        /
         [Evaluate: gaps, cautions]
              /        \
    [Deep: 1-2 targeted agents]            ← Wave 2 if needed
              \        /
         [Synthesize: foundations packet]
```

Start broad, go narrow in parallel, identify gaps, go deep on gaps, synthesize.

## Workflow

### Phase 0 — Establish Date Context

Record today’s date and include it in prompts, packet metadata, and the source ledger.

### Phase 1 — Gather Local Context

Before external research:
- read local repo guidance (`AGENTS.md`, `README.md`, specs, skill docs, issue notes)
- inspect existing `foundations/` content if present
- identify whether this packet is local-only, cross-repo, or registry-worthy
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
- complex cross-repo lineage: 4-6 fields plus critique pass

### Phase 3 — Parallel Research

Each research lane should include:
1. **Date context**
2. **Why the packet matters**
3. **Specific field angle and boundaries**
4. **Source strategy**
5. **Source quality bar**
6. **Expected output shape**

Prompt skeleton:

```text
You are researching [FIELD / ANGLE] for a repository-local foundations packet.
TODAY'S DATE: [date]
PURPOSE: [why this packet matters]
AUDIENCE: [who will use it]
ANGLE: [field scope]
BOUNDARIES: [what this lane does not cover]
SOURCE QUALITY: Prefer academic papers, standards, official docs, primary sources, and strong practitioner engineering writing.
OUTPUT: canonical concepts, key findings, cautions, engineering implications, provenance notes, and sources with URLs/DOIs.
```

### Phase 4 — Gap Analysis

After all lanes return:
- check whether each field is adequately sourced
- identify contradictions
- identify unsupported claims
- identify missing fields or weak evidence
- run targeted follow-up research where risk is high

### Phase 5 — Synthesis

The final packet should synthesize, not concatenate.

Recommended outputs:
- `context-layer.md`
- `intent-understanding.md`
- `synthesis.md`
- field files as needed
- `source-ledger.yaml`

`source-ledger.yaml` should include at minimum:

```yaml
meta:
  packet: <topic-slug>
  generated: <date>
  method: deep-research-foundations
  verification_status: live-web-verified | training-knowledge-only | mixed
sources:
  - id: <short-id>
    field: <field>
    title: <title>
    url: <url>
    doi: <doi-if-any>
    supports: <claim-or-decision>
    verified: true|false
```

### Phase 6 — Placement, Crosswalk, and Verification

Before calling the packet done:
- confirm it lives under the correct repo-local `foundations/<topic>/`
- add crosswalk notes if Mighty Eagle should reference it from a registry
- note whether QMD indexing/federation should be updated
- verify source-ledger integrity and representative claims
- preserve unrelated worktree state

## Quality Gate

Do not call the packet complete unless:
- recognized fields are named
- context-layer and intent-understanding are clearly separated
- sources are cited with URLs and/or DOIs where available
- source quality is legible
- provenance is explicit
- engineering implications are actionable
- synthesis is readable and bounded
- repo placement is correct
- unrelated dirty state is untouched

## Common Pitfalls

- creating a generic report instead of a repo-local foundations packet
- mixing provenance metadata with intent analysis until neither is clear
- failing to state audience or desired outcome
- flattening cross-repo stewardship into one repo without a crosswalk note
- keeping branch-specific or person-specific residue in a supposedly canonical skill
- staging unrelated repo changes while committing skill work
