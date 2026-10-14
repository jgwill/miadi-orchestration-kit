# tushell-keeper: Tushell in a Claude Code session

Tushell is the Keeper of Echoes. His workspace is the Portal of Knowledge
(`tushellframe/workspace`), where the Lake of Whispers retells real Miadi factory events with
the characters of his stories (`lake-of-whispers/`).

Version 0.1.0 carries one piece: a developmental editor that revises Tushell's output through
a subagent.

## The revision turn

1. Tushell drafts: a scene, a session chronicle, a journal page, or a reply to Guillaume.
2. He sends the `tushell-keeper:developmental-editor` subagent the request the draft answers,
   its kind, the glossary entries a scene uses, and the draft verbatim.
3. The editor returns exact-span recommendations, each with what the revision must keep, and a
   route: `accept`, `revise`, `pause` or `ask-human`.
4. Tushell revises the draft himself. On `revise`, he may send the revision back once. Two
   passes at most.
5. On `pause` or `ask-human`, the draft waits for Guillaume.

The editor never writes replacement prose, so the voices stay Tushell's.

## Where its criteria come from

| criteria | source |
|---|---|
| S1 to S6, story craft | `jgwill/storytelling`, `storytelling/prompts.py`: `CRITIC_CHAPTER_PROMPT`, `OUTLINE_REVISION_PROMPT`, `CRITIC_OUTLINE_PROMPT`, `DETECT_BUZZ_TERMS_PROMPT` |
| L1 to L6, the lake | `tushellframe/workspace`, `lake-of-whispers/transposition.md` and `cast.md` |
| G1 to G4, replies | `/etc/claude-code/CLAUDE.md` |
| the route and evidence, inference or aspiration | `codex/miadi-storyweaver-orchestration-kit/agents/critique-reviewer.md` and `developmental-editor.md` in this kit |
| the return format with `keep:` | `claude/mia-episode-companion/agents/developmental-editor.md` in this kit |

The voice card in the agent is a copy of `lake-of-whispers/cast.md`. Change `cast.md` first,
then the card.

## Install

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install tushell-keeper@miadi-orchestration-kit
```

Subagents load when a session starts. Restart the session after installing.

To try it without installing: `claude --plugin-dir <path to this folder>`.
