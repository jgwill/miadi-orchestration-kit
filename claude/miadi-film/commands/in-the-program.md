---
description: Open an episode's film project on the person's display and show it to them (the newest, or the one named), then play it or walk its guides on their word
argument-hint: "[episode number | project path] [--play]"
allowed-tools: Bash, Read
---

Follow the `in-the-program` skill of this plugin.

Arguments: `$ARGUMENTS`

1. Run `python3 "${CLAUDE_PLUGIN_ROOT}/scripts/film_desk.py" list`. With a project path, use it. With an
   episode number, take that episode's newest project. With nothing, take the newest of all, and name the
   others in your reply.
2. Read the README beside the project, then `open` it and `look`. Say what is on screen, from the screenshot.
3. With `--play`, say you are starting playback, then `play --from-start`, and `look` and `sound` a few
   seconds later.
4. Write nothing. `save` and `reload` wait for the person to ask.
