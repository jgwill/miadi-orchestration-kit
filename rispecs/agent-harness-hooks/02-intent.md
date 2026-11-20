# 02 · Intent

## Desired outcome

Every hook the kit installs lets a seat finish the work it was asked for, and the factory's rules
hold at least as well as they do today.

- A guard refuses only the act its rule names. When it refuses, it says how to pass, and the
  refusal is recorded where the factory counts it.
- The vocabulary rule travels with prompts on every channel agents use to make them, and reads a
  file by what it is, not by its name. A person's own words are kept as they said them.
- Agents create, check and use prompts through one door, so a prompt is a declared thing with a
  version, a check result and an owner.
- A capture hook never makes a person wait on a prompt, and when it cannot capture something it
  says what was not captured.
- What the capture calls a person's correction is a person's correction.

## Current reality

`01-reverse-engineer.md` holds the evidence. In short: in one morning, three refusals hit one seat
and none refused the act its rule names. The word gate decides "prompt" from a file name, so it
refuses CSS and a person's verbatim words and never sees the prompts agents push to Langfuse. Guards
keep no record of their refusals. The capture files 58 guard refusals as people's corrections, 32 of
them in November. Three prompt hooks have no timeout and were cancelled at 30 s under load, and the
loss left no trace.

## Structural tension

The factory wants a vocabulary discipline that holds and a harness that lets agents generate. Today
both are carried by one mechanism, a surface match on a file name and a word, so every gain in one
costs the other: widen the gate and it refuses more work, narrow it and prompts escape it. The
tension resolves when the two are carried by different structures. The rule is applied where a
prompt is declared (the door, the folders that hold prompts, the module that embeds them), with
the sense asked when the surface cannot tell it. The harness carries a refusal contract that every
guard follows and a ledger that counts what each guard did. Then tightening the rule and freeing
the agents move in the same direction, because both are measured on the same ledger.

## Domains of application

The input of 2026-11-20 implies five domains. Each has its own S-sections in `03-specify.md` and its
grounding in jgwill/Miadi `foundations/agent-harness-and-controlled-language/`
(miadi-foundation://agent-harness-and-controlled-language).

| domain | what it governs here | S |
|---|---|---|
| controlled vocabulary | which words agents use in prompts and kept text, in which sense | S1, S2 |
| harness guards | how any PreToolUse guard refuses, explains and records | S3 |
| session capture | what the observability hooks keep, how fast, and who they attribute it to | S4, S5 |
| prompt management | how an agent creates, checks, versions and injects a prompt | S6 |
| self-improvement | how refusals and overrides become proposals a person rules on | S7, S8 |

## Creative advancement scenarios

**Creative Advancement Scenario**: an issue about prompt hooks

**User Intent**: a seat drafts an issue about UserPromptSubmit hooks for Guillaume to read.
**Current Reality**: the file is `issue-draft-prompt-hooks.md` and says a cancelled hook leaves a missing record visible.
**Natural Progression Steps**:
  1. The gate reads the file's kind: an issue draft in a scratch folder is not a prompt (S1).
  2. The write passes with no check.
**Achieved Outcome**: the draft is written in one call.
**Supporting Features**: S1.

**Creative Advancement Scenario**: a brief in the forbidden sense

**User Intent**: a seat writes a brief for a lane under `prompts/`.
**Current Reality**: its draft says each step "bridges the" listed word "between current reality and the desired outcome".
**Natural Progression Steps**:
  1. The gate refuses, names the sense, and gives the rewrite for that sense (S2, S3).
  2. The refusal is one line in the session's guard ledger (S3).
  3. The seat rewrites to "each step resolves tension between current reality and the desired outcome".
**Achieved Outcome**: the brief carries the factory's language. The ledger shows one refusal and one rewrite.
**Supporting Features**: S2, S3.

**Creative Advancement Scenario**: a questioning prompt with another sense

**User Intent**: a seat creates nine questions for Gemini about a screenwalk.
**Current Reality**: one question asks for segments "without" the listed word "or overlaps", a timing sense.
**Natural Progression Steps**:
  1. The seat creates them through the prompt door, so they are prompts by declaration (S6).
  2. The check finds the word and asks its sense. The seat answers "segment coverage, no missing time".
  3. The version is saved with the sense recorded in its commit message, as secret redaction is recorded today.
  4. The next self-improvement pass lists the override. A person rules whether that sense joins the list's allowed senses (S8).
**Achieved Outcome**: the prompt exists at v1 in Langfuse, checked, and the decision about the sense belongs to the list's owner.
**Supporting Features**: S2, S6, S8.

**Creative Advancement Scenario**: a prompt on a loaded host

**User Intent**: Guillaume types a prompt into a seat while the host runs at load 50.
**Current Reality**: the capture hooks read the transcript inline, one `jq` per line.
**Natural Progression Steps**:
  1. The synchronous part writes the prompt line and returns within its budget (S5).
  2. Transcript reads run detached in one pass.
  3. A detached job that is killed leaves a `capture_incomplete` line naming what it did not keep.
**Achieved Outcome**: the prompt reaches the model at once, and the session's record is whole or says where it is not.
**Supporting Features**: S5.

**Creative Advancement Scenario**: a cycle reads its corrections

**User Intent**: the self-improvement pass groups what people corrected this week.
**Current Reality**: a third of November's "corrections" are a guard's text.
**Natural Progression Steps**:
  1. Corrections hold only a person's rejection (S4). Guard refusals are read from the guard ledger.
  2. The pass reports each guard's refusals, rewrites and overrides (S7).
  3. A guard whose refusals mostly fall outside its rule becomes a proposal with those sessions as evidence (S8).
**Achieved Outcome**: Guillaume rules on the guard itself, with counts, instead of meeting it in each seat.
**Supporting Features**: S4, S7, S8.

## Boundaries

- **The word list and its senses belong to its owner.** The first entry is William's word of
  2026-10-26. This packet never adds, removes or relaxes an entry. It proposes how an entry can
  carry senses (S2) and who rules on an override (S8).
- **The gate stays deterministic.** No model runs in a PreToolUse hook. Sense is asked of the
  writing agent and recorded, never inferred by a judge in the hot path.
- **The person's words are kept as said.** The rule governs what agents write. A file that holds a
  person's verbatim words is checked for advice only, and never rewritten.
- **No guard is removed.** Each one keeps its rule. This packet changes how they decide scope, what
  they return and what they record.
- **Specified, not built.** Nothing in the hooks changes with this packet. `04-export.md` gives the
  order.
