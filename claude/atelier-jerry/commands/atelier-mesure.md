---
description: Measure a take — voice, MIDI, movement capture or a rendered piece — and report figures with their method, before any arrangement decision is made.
argument-hint: "<file|url|tlid> [--voice] [--movement] [--midi] [--band lo-hi]"
allowed-tools: Bash, Read, Glob, Task
---

Measure `$ARGUMENTS` and return figures only. No arrangement decisions in this command.

## Decide what it is

- `.mid` → `${CLAUDE_PLUGIN_ROOT}/scripts/atelier_midi.py`
- `.wav` `.m4a` `.mp3` → `${CLAUDE_PLUGIN_ROOT}/scripts/atelier_audio.py`
- `.jsonl` or a bare timestamp → `${CLAUDE_PLUGIN_ROOT}/scripts/atelier_movement.py`
- a URL or a bare filename on a studio → fetch it first with
  `${CLAUDE_PLUGIN_ROOT}/scripts/atelier_portal.py fetch`

If it is audio of a person's voice, read `${CLAUDE_PLUGIN_ROOT}/skills/studio-portal/SKILL.md`
before fetching, and plan the deletion in the same breath as the fetch.

## Run it in this order — the order is the point

1. **Movement capture: dedupe before anything else.** Report the held-value ratio and the
   real new-value rate first. Every later figure is computed on the deduped stream.
2. **Voice: held tones before range.** ≥200 ms within ±1 semitone, then fold octaves, then
   check the f/4 energy ratio for octave error, then report the distribution.
3. **MIDI: read the file, not the intent.** Registers per track, pitch classes weighted by
   duration, mode purity against a declared set.
4. **Rendered piece: stridence and the vocal band**, both, on the file that would ship.

## Sweep the thresholds

Any figure that depends on a cutoff gets run at three or more settings, and you report
whether the answer moves. Name the sweep. A number that survives only one setting is a
property of the setting.

## Report

A table of figure, method, and sweep. Then one line naming anything **unverified**.

Delegate to the `mesureur` agent when the take is large or when several artefacts must be
measured together — it returns numbers and nothing else, which is what this command is for.

Do not end with a recommendation. The decision belongs to whoever asked.
