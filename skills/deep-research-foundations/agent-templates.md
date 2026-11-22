# Lane brief templates

Briefs for the lanes of a foundations packet. Each lane is independent, writes one file and
reports back in a few lines. Fill every bracket. A brief that leaves one empty is not ready.

Every brief carries the five parts a lane needs: its own task, the store by path, the scope
boundary, facts verified in the same turn the brief was written, and the completion marks.

## Field lane (SR3)

```text
You are research lane [CODE] of a repository-local foundations packet.
The lead is [model class]; you run on [model class].

TODAY'S DATE: [date]

INTENT: [the opening statement, quoted, or its path]

PURPOSE: [why this packet matters, and what it will be used for]

AUDIENCE: [who will read it, and what they will decide]

YOUR ANGLE: [the field]. Cover, opening each source yourself: [named works, standards,
specifications]. For each, state [the question this lane answers of every source].

BOUNDARIES: Do not cover [the other lanes' fields, by code]. Change nothing in [repo paths]
except your output file. [Any cultural or consent limit that applies, with its source.]

SOURCE QUALITY: Prefer standards, peer-reviewed papers with DOIs, official documentation and
primary sources. Mark any claim you could not open yourself as unverified. Never invent a DOI,
URL, page number, quotation or result.

OUTPUT: Write [packet path]/lanes/[CODE]-[field].md with: (1) a comparison table; (2) canonical
concepts; (3) key findings; (4) cautions; (5) implications for [the artifact], marked as ours
where no source states them; (6) sources, each with URL or DOI, date opened, verified true/false.
Under [N] words. Do not commit, stage or push.

REPLY: the file path, the number of sources and how many you verified, and the three findings
that matter most, in under 150 words.
```

## Local context lane (SR3, no web)

```text
You are lane [CODE] (local context, no web research) of a repository-local foundations packet.

TODAY'S DATE: [date]

PURPOSE: [what will be redesigned from this inventory]

STORES, by path (verified [date]): [repo checkouts]. Never read build output, dependencies or
worktrees. [Paths other sessions are working in, which this lane must not touch.]

QUESTIONS, answer each with path:line evidence or a command and its output:
1. [what each file holds]
2. [which live code reads it, and who calls that code]
3. [which open issues already decide something about it]

READ GATE: before opening more than three files not named above, send them through the read gate
the repo provides and read by its verdict.

BOUNDARIES: Read only. Change nothing except your one output file. Do not commit, open issues or
comment.

OUTPUT: [packet path]/lanes/[CODE]-[name].md, one section per question.

REPLY: the file path and the five findings that matter most, in under 150 words.
```

## Gap-finding pass (SR4)

```text
You did not write the lanes below. Read every file in [packet path]/lanes/ and the opening
statement in [packet path]/intent-understanding.md.

List: (1) questions in the opening statement no lane answers; (2) claims a lane makes without a
source; (3) contradictions between lanes; (4) a field the decomposition missed. For each, say
whether a follow-up lane is worth its cost. Write [packet path]/gaps.md. Do not edit the lanes.
```

## Verification pass (SR5)

```text
You did not write the claims below. For each claim listed, open the source its ledger row names
and say whether the source supports the claim as written: holds, narrower, different, or not
found. Quote the sentence that decides it. Do not search for new sources.

CLAIMS: [claim, ledger id] ...
```
