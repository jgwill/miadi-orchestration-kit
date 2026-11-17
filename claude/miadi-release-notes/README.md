# miadi-release-notes

A release note with the road ahead, written by the session that made the release, as a key
moment of that session's story.

```
/plugin install miadi-release-notes --marketplace jgwill/miadi-orchestration-kit
```

Or, from a checkout: `claude --plugin-dir claude/miadi-release-notes`.

| part | what it does |
|---|---|
| skill `release-notes-road-ahead` | gathers what changed with its proof, test-merges every open pull request into `main` to class the next release, writes the road ahead, keeps the note in the repository's `RELEASE-NOTES.md`, lands it in the episode and leaves a beat on the plot thread, and sends it by the factory's mail to the people it concerns |
| command `/release-notes [repo] [episode]` | runs the skill for this session's release |

The first note is Note 001 in this kit's `RELEASE-NOTES.md` (2026-11-17).

## What it relies on

- `git` 2.34 or later (the test merges run in a scratch worktree, never in the session's checkout).
- The chronicle episode kit's `inquiry-weave` server for `chronicle_episode_land`, and
  `MIADI_API_URL` with `MIADI_API_TOKEN_WRITER` for the threads door.
- The factory mail skill in jgwill/Miadi (`skills/miadi-factory-mail/`) to send. Mail goes
  out on a person's word or a standing word that skill records.

## What is not built yet

The readers' list and the feedback permission: jgwill/Miadi#1050. Until then a note goes to
named people in an existing thread, and a reply reaches the sessions only through a person.

Ref: jgwill/Miadi#1050
