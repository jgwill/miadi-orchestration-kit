---
description: Ask Miette for an insight on a plan, a brief or a mission's prompt, in a seat beside this session
argument-hint: "<plan file> | --mission <miadiRun prompt>.v<N> [--episode <folder or number>] [--for <tmux session>]"
---

Ask Miette to read a plan by hand. Arguments: `$ARGUMENTS`

1. When no file is given and this session presented a plan in plan mode, the hook already opened
   the seat: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/miette-plan-insight.mjs" status`, which lists
   every seat on this host, and say which one is named after this tmux session. Otherwise write the plan you want read into a file in this session's working folder
   first, and use that file. For a prepared mission, give `--mission` alone: the script reads its pinned prompt.
2. Run, with the file and any of the flags given:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/miette-plan-insight.mjs" ask --plan <file> [--mission <id>] [--episode <folder or number>] [--for <tmux session>]
   node "${CLAUDE_PLUGIN_ROOT}/scripts/miette-plan-insight.mjs" ask --mission <id> [--episode <folder or number>] [--for <tmux session>]
   ```

3. Report its one line: the seat's tmux name, and whether it opens or wakes. Do not type into the
   seat. It opens in the background and reads the plan on its own.
