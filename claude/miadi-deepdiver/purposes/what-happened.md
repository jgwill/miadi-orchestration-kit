# Purpose: what happened

Guillaume, 2026-11-10: "if we would have to create a video for someone who wants in the community to know what had happened in this session, how could they know? How could we review the work of the session, basically, pretty quick?" and "it needs to distill what was created to put it into short form video".

**Who it serves**: a community member who was not in the session, and anyone reviewing its work quickly. Not the person who led it: "I remember what I did". Write the audience in `perspectives.md`, never in the instruction.

**Form**: a Video Overview, `--format short`, stopped at its plan (`--review`). One session per video.

**Sources** (add every one; the recording alone is not the session):
- the session's inventory record (`~/workspace/.mino/session-inventory/<session id>.json`): its missions, links and episode
- `miadi-hooks-interpret digest <session id>`: its prompts, last reply and commits, including what happened after the recording stopped
- the recording's transcript, and its closing or description
- the review, read last: it is a reading of the recording, and it can go further than the session did

**Instruction** (fill each `<…>`, keep the rest as written):

```text
What session <tmux name> created on <date>, for someone who was not there. Name each thing made, with what proves it: <the commits, files or records, from the digest>. Then each decision the person made, in the words they used: <quotes, from the digest's prompts or the transcript, with timestamps>. Then what the session left open, as the session's own last reply or closing says it. Nothing else: no architecture, no claim the evidence does not show. A thing proposed is said to be proposed; a thing not seen working is said to be not seen. Speak only in the language of creating: what was created, current reality, the next step.
```

**Before sending the plan on**: each item names a thing made or a decision, not a theme; every claim has its source in the digest, the record or the transcript.
