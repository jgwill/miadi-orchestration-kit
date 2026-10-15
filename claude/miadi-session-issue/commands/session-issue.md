---
description: Give this session a GitHub issue now, from its first prompt; each /exit then comments on it
argument-hint: "[owner/repo]"
---

The miadi-session-issue hook has already acted on this command before you read it. Its
answer is in this turn's hook context, a line that begins `miadi-session-issue:`.

- Tell the user what that line says, in one line: the issue's link, or why there is none.
- Do nothing else. Do not run `gh`, and do not open or edit an issue yourself: the hook owns
  the issue, and a second one would split the session's record.
- If no `miadi-session-issue:` line is in the context, the hook did not run. Plugins' hooks
  load when a session starts, so a plugin installed or enabled during this session does not
  act until the next one. Say so in one line.

The repository is `$ARGUMENTS` when given, else `MIADI_SESSION_ISSUE` when it names one, else
the host's `MIADI_SESSION_ISSUE_REPO`, else its `MIADI_CHRONICLE_SESSION_REPO`. Only a private repository receives session issues.
