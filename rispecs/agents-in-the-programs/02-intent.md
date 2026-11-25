# 02 · Intent

## Desired outcome

A person and agents work in the same production programs (Kdenlive first, then Ardour and MuseScore)
on the person's own computer. An agent opens what the person asks for, shows it, moves through it and
plays it while the person watches, and proposes changes as new versions the person opens and keeps or
leaves. Every act an agent takes in a program is named, written down where the episode can read it, and
available to the next agent as a capability, through a plugin, without being composed again from shell
commands.

The factory knows what it can do. The kit's capabilities (skills, plugins, commands, agents, hooks, MCP
servers, deb packages) are listed in the kit's `.miadi/capabilities.jsonl`, each with what it achieves,
where it is specified and the episodes it serves. Episode 120 lists the capabilities its film production
uses.

## Current reality

One seat showed one timeline to one person on 2026-11-25 with ten improvised commands (`01`). The kit
has nothing that works on a person's own display, the actions were recorded by hand after the fact, and
the kit's capability inventory does not exist; the scanner that would write it sees only skills.

## What the person values in what happened

- **He saw it happen.** The program on his screen moved when the seat acted. The seat's report was
  checked against a screenshot, not asserted.
- **Nothing was decided for him.** The seat opened, moved and played. It did not save, drag a card to the
  kept track or edit the project.
- **The seat said what it could not do.** D-Bus offers no seek or play. Clicks depend on the layout. The
  seat said so before he relied on it.

## Secondary intents

- **I1 · The person is never surprised by his own screen.** An agent says what it is about to do in the
  program before it moves his cursor, and stops when the person is working in the same window.
- **I2 · Three kinds of act, three rules.** Look (changes nothing), drive (changes what the person sees,
  not the file), write (changes a project). Look is free, drive is announced, write happens on a new
  version or on the person's word.
- **I3 · Name before coordinate.** An agent finds a button or a field by its accessible name or a
  program's own interface, and uses a screen coordinate only when nothing else reaches it, after a fresh
  look.
- **I4 · Acts become capabilities by being recorded.** Every act an agent takes on a person's display is
  logged as it happens, so the next set of improvised acts can be grouped into a capability from the log
  instead of from memory.
- **I5 · One inventory, read by agents and people.** A capability has one address
  (`miadi-capability://<owner>/<repo>/<kind>/<name>`) wherever it is listed: in the kit, in an episode, in
  an issue.
- **I6 · Same shape for every program.** Kdenlive, Ardour and MuseScore get the same verbs where they
  make sense (open, look, seek, play, pause, reload). What a program cannot do is named, not hidden.

## What it is not

- Not an agent editing the film. The editor cuts, the sound designer mixes (film-toolchain principle 1).
- Not remote control of a computer the person is not in front of. The person watches the display the
  agent works on.
- Not a replacement for `open-on-this-computer.spec.md`. That spec opens a project from the episode's
  page. This one says what an agent does in the program once it is open, and how the person sees it.
