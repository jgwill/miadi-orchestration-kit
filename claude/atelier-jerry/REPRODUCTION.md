# Reproducing Jerry's origin session

The plugin cannot yet recreate the session it is named after. It was built from William's
songbird session (fork `71bbe83b`, 2026-08-16): `BRIEF.md` names that session's generators as
its source, and its consent section quotes William. Jerry's own session (`1937aa47`,
2026-08-14 to 08-17) ran a different loop, and most of that loop stayed in `~/.agents`
(skill `jamai-morning`) and in `jamai-core`.

Measured on gaia, 2026-10-07, from the export `atelier-jerry-origin-1937aa47` (its capture:
54 prompts, 511 Bash calls) after `.agents/gmusic-sync-to-gaia.sh`.

## The loop Jerry had, step by step

| step | what the origin session used (calls) | in the plugin |
|---|---|---|
| a recording lands | `jamai-watch` as a systemd user unit, a `Monitor` on `jamai-watch.log`, one notification per `DÉPÔT` in `~/Recordings-jamai` | partial: `/atelier-veille` watches the portals; no local-drop watch, no unit, no Monitor practice |
| hear what he says | Groq transcription of his `.mov` (6); he speaks his instructions into the take ("C major, A minor, G, E minor, palm mute, around 90") | refused: the consent guard applies William's rule to every person |
| answer him | `episode` from `episode-voice-channel` (137): text, image and video into his episode | missing |
| read his MIDI | `jamai-midi.py` (27) | covered by `atelier_midi.py`; outputs not compared |
| tempo and grid | `jamai-measure.py` (9) | missing: `atelier_audio.py` has no tempo |
| chords from audio | `jamai-chords-audio.py` (5) | missing |
| melody from his voice | `melodie.py` (gen013): pitch track, notes held ≥ 0.18 s, folded into a named mode (`sol#-mixo`) | partial: `f0` and `motifs` measure; nothing writes his notes in a mode |
| what he has not heard yet | `jamai-unread.py` (14) | partial: the self-echo ledger |
| write the score | generators `gen013` to `gen15d`, Jerry's rules in `jamai-morning` | method covered by `/atelier-variation`; Jerry's craft rules absent |
| render | `abc2midi` (41), `abcm2ps` (49), `rsvg-convert` (36), `fluidsynth` (12), `ffmpeg` (114) | covered by `atelier_render.sh` |
| score video | `defile.py` (21), `clip.py` (13): the score scrolls left to right under a red playhead, several bars per page (his request, prompt 11) | missing |
| tablature with the score | `jamai-tab.py` (his notation preference) | missing |
| publish | `jamai-publish-melody` (25) to gmusicassembly.com/jamai/melody | missing: `/atelier-publier` publishes to a studio room only |
| see and hear it at home | `catt` to the TV (25), `jamai-say-kitchen` (7) | missing |
| the studio's compositions | `curl` to the portal on 8828 (190) | covered by `atelier_portal.py` and `studio-portal` |

## What reproduces today

The generators are deterministic. Run from the export with their arguments:

| piece | score vs stored | MIDI vs stored render |
|---|---|---|
| montee, d90, chanson3, annie, canon, canon2, canon3 | identical | identical bytes |
| quatreA, quatreB | identical | same notes, bytes differ |
| refrainA, refrainB | identical | 4 notes differ (A2 where the render has C#3): the render came from another state of the score |
| gen013 (paranoïa) | its default output matches no stored score | not compared |

`gen013` reads `op-new.wav`, which sits in `03-rendered/` and is not synced. It rebuilds from
`~/Recordings-jamai/260814112944.mov` (`ffmpeg -ac 1 -ar 44100`): same 7,356,352 samples,
within one step of rounding.

## Acceptance

1. Every origin generator, with its arguments, writes its stored score byte for byte.
2. Each regenerated score renders to the same notes as the stored render, or the difference is
   named as a score revision.
3. From a recording dropped in `~/Recordings-jamai`, an agent with this plugin and
   `apt install miadi-music` reaches each artefact of the loop above: notified, heard,
   measured, scored, rendered, score video, published, played at home, answered.
4. Each person's consent rules apply to that person's material, and only theirs.

## Held for the people it belongs to

- **Jerry's consent.** The origin session transcribed his takes. The plugin refuses it because
  of William's words. A per-person ledger can hold both, but Jerry's entry needs his own word.
- **Where Jerry's tools live.** Vendored into this plugin, packaged beside `miadi-music`, or
  kept in `jamai-core` and found on the host (`MISSING-AND-DEPENDENCIES-260819.md`, tension 1).
- **Two crafts.** Jerry's morning method and William's park-voice method share opus numbers.
  The plugin has to know whose session it is before it writes a bar (tension 4).
