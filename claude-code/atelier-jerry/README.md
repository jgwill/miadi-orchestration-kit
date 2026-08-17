# `atelier-jerry` — the music atelier as an instrument

A Claude Code plugin that lets an agent do what this studio did on 2026-08-16: take a
person's voice, playing and body-capture, measure them, build music out of what was
measured, prove the result before shipping it, and never publish the part of them that was
not offered.

It exists because the method was expensive to learn and trivial to lose. Eight of the
decisions inside it were arrived at by being wrong first, and each of those failures is
written down here in the form that catches it next time.

```bash
claude --plugin-dir /path/to/miadi-orchestration-kit/claude-code/atelier-jerry
```

One directory, one flag. `${CLAUDE_PLUGIN_ROOT}` resolves per plugin, and the measurement
library is used by every other part — splitting this into several plugins would break the
variable that makes it portable.

---

## The one idea

**A register was left empty on purpose.** The band the person sings in — measured on their
newest recording, not inherited from an older one — carries no instrument in any piece. Every
arrangement is built around a hole shaped like their voice.

Everything else in this plugin exists to make that decision, defend it, and prove it held.

---

## What is inside

| | |
|---|---|
| **skills** | `atelier-loop` · `register-law` · `movement-scores` · `abc-craft` · `studio-portal` |
| **agents** | `mesureur` (figures, never opinions) · `luthier` (timbre by measurement) · `verificateur` (tries to break the claims) |
| **commands** | `/atelier-mesure` `/atelier-variation` `/atelier-verifier` `/atelier-publier` `/atelier-veille` `/atelier-espace` `/atelier-retenue` |
| **hooks** | `PreToolUse/Bash` consent guard · `SessionStart` current reality |
| **scripts** | MIDI, audio, movement, ABC, render, timbre, portal, watch, device space, consent ledger |

---

## The loop

```
veille → mesure → décision instrumentale → génération → rendu → VÉRIFICATION
                                                            ↓ (divergence)
                                                        correction ──┐
                                                            ↑        │
                                                            └────────┘
       → publication → provenance → effacement → veille

                        RETENUE — the one state you do not leave alone
```

Two rules hold the loop together:

**Verification re-reads the rendered artefact, never the source.** A generator's header
states an intention; three tools sit between that intention and the file and each has
silently changed something at least once. A count that comes out right is not proof.

**Provenance is the deliverable, not a courtesy.** Every generator carries a header
separating what was **measured**, what was **given by the person**, and what was **chosen by
the agent and can be undone with a word**. A generator without it is not finished.

---

## Consent

This plugin handles recordings of a human being. The rules are theirs, in their words:

> *"I don't consent that my voice and my original recording goes outside of the boundary
> here."* — the MIDI is the offered part; the voice is not.
>
> *"it's really a great privilege to use this sound, nobody is authorized to use it without
> my consent."*

What that means in code:

- voice is fetched, **analysed, then destroyed locally** — only numbers leave the device
- crops are cut **on their device**, never by copying the source out and back
- derived work built from their voice inherits the same rule, including a sample instrument
- **consent is not transitive** — a yes for one piece is not a yes for the next
- transcription ships audio to a third party and is **the person's action, never the agent's**
  — the `PreToolUse` hook refuses that endpoint outright
- a held gate lives in the ledger with their own words, not in scrollback

Run `/atelier-retenue --list` to see what is currently held.

---

## Runtime floors

Declared, and checked at session start by the status hook. Missing tools are named with what
stops working, rather than discovered mid-session:

| tool | without it |
|---|---|
| `abc2midi` | nothing renders |
| `fluidsynth` + a GM soundfont | no audio, and no timbre can be measured |
| `ffmpeg` / `ffprobe` | no encoding, mixing or crops |
| `abcm2ps`, `rsvg-convert`, ImageMagick | no score images; audio still works |
| `rubberband` | no pitch-shifted sample instrument |
| `numpy` | no spectral measurement — the audio tool finds an interpreter that has it, or refuses |

**No `mido`, no `librosa`, no `soundfile`, no `requests`.** The MIDI reader is hand-rolled
and the HTTP client is `urllib` on purpose: the machine this was built for has none of those
installed, and a plugin that imports one fails on its own home.

Soundfont search order: `$ATELIER_SOUNDFONT`, then the documented list in
`scripts/atelier_render.sh`.

---

## Configuration

Everything comes from arguments or the environment. Nothing is hardcoded.

| variable | what it names |
|---|---|
| `ATELIER_PORTAL_URL` | a studio's base URL |
| `ATELIER_STUDIOS` | `name=url` pairs for the watch, comma-separated |
| `ATELIER_DEVICE` | the ssh host of the Android studio |
| `ATELIER_SOUNDFONT` | the `.sf2` used for rendering |
| `XDG_STATE_HOME` | where the consent and self-echo ledgers live |

**A service is identified by the triplet (host, port, code tree) — never by name and port.**
Two studios answered on the same port number on different machines; a third answered from
the wrong machine entirely because its port was not declared in the network gateway. For any
undeclared port the only honest check is `ssh <host> 'curl 127.0.0.1:<port>'`.

---

## Hooks

**Hooks load at session start and do not hot-swap.** An edit to `hooks/` takes effect the
next time Claude Code starts, not in the session where it was made. If a hook does not seem
to fire, that is the first thing to check.

The `PreToolUse` guard is deliberately narrow. It refuses two shapes — the transcription
endpoint, and uploading a file the ledger marks as carrying the person's voice — and lets
everything else through untouched. A guard that fires on ordinary work gets disabled, and a
disabled guard protects nothing.

---

## Provenance of the method

Built from a working session on 2026-08-16 between William and the atelier, forked from
Jerry's studio. The measurements, thresholds and failures recorded here are that session's,
not invented for the plugin. Jerry's stridence thresholds (13.12 % rejected, 5.98 %
accepted) are his ear on his own material and are cited as his throughout.

The lane contract this plugin answers to is `claude-code/AGENTS.md` in this repository.
