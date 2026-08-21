# BRIEF — `atelier-jerry`, the Claude Code plugin

**Read this whole file before writing a line.** It carries every fact verified in the turn
it was written (2026-08-17), the house contract, your scope boundary, and the marks that
prove your part done.

---

## 0. What is being built, and why one plugin

A single Claude Code plugin that lets any agent reproduce, vary, correct, monitor and
publish the work of the **atelier** — the music studio William and Jerry ran on
2026-08-16, which produced eleven pieces and a playable instrument from a man's body,
voice and whistle.

**One plugin, not several.** Verified: `claude --plugin-dir <path>` loads *one plugin from
one directory* and is repeatable per plugin. `${CLAUDE_PLUGIN_ROOT}` resolves **per
plugin**, so a command in plugin A cannot reference a script in plugin B. The measurement
library is used by every other part. Splitting would break the variable that makes the
plugin host-portable. So: one directory, everything inside.

Success is one command:

```bash
claude --plugin-dir /home/gmusic/salix/repos/miadi-orchestration-kit/claude-code/atelier-jerry
```

…and every command, agent, skill and hook loads and runs.

---

## 1. Where you are working — verified paths

| what | path |
|---|---|
| repo (my fork, my branch) | `/home/gmusic/salix/repos/miadi-orchestration-kit` |
| branch | `feat/atelier-jerry-plugin` (created from `main` @ `ac021f2`) |
| remotes | `origin` = `Gerico1007/miadi-orchestration-kit`, `upstream` = `jgwill/…` |
| plugin root | `<repo>/claude-code/atelier-jerry/` |
| reference plugin (house style) | `/workspace/repos/jgwill/miadi-orchestration-kit/claude-code/miette/` |
| lane contract | `/workspace/repos/jgwill/miadi-orchestration-kit/claude-code/AGENTS.md` |
| **the session's own generators** — read these, they are the source material | `/tmp/claude-1000/-home-gmusic-compositions-jamai/71bbe83b-8963-4635-b8a2-40bcffbb3aff/scratchpad/songbird/gen*.py` |

⚠️ `/workspace/repos/jgwill/miadi-orchestration-kit` is **another occupant's working tree**,
currently on `feat/miette-two-eyed-balance-plugin`. **Read it, never write to it.**
All writing happens in `/home/gmusic/salix/repos/miadi-orchestration-kit`.

---

## 2. The lane contract you must satisfy (from `claude-code/AGENTS.md`)

1. **`${CLAUDE_PLUGIN_ROOT}` for every path** a hook or command references. A hardcoded
   path makes the plugin host-local, which defeats the reason it is a plugin.
2. **Hooks load at session start and do not hot-swap.** Say so in the README.
3. **Declare runtime floors and fail loudly.** A plugin that quietly assumes a binary or a
   service URL misleads rather than refuses.
4. **A skill copied from `/etc/claude-code/skills/` must state which copy is canonical.**
5. **Never hardcode a wheel URL.** `MW_API_URL` derives from `MIADI_CHRONICLE_MW_URL`.

Structure that a plugin in this lane takes (copied from `miette/`, which works):

```
atelier-jerry/
  .claude-plugin/plugin.json     name, description (with <example> blocks), version, author, homepage
  README.md
  skills/<name>/SKILL.md         frontmatter: name, description
  agents/<name>.md               frontmatter: name, description, tools
  commands/<name>.md             frontmatter: description, argument-hint
  hooks/hooks.json               + the scripts it calls
  scripts/*.py *.sh
```

---

## 3. Facts about the environment, verified 2026-08-17

**Present on this host:** `abc2midi`, `abcm2ps`, `fluidsynth` with
`/usr/share/sounds/sf2/FluidR3_GM.sf2`, `ffmpeg`, `ffprobe`, `rubberband`, `sox`,
`rsvg-convert`, `convert` (ImageMagick), `curl`, `ssh`, `python3`.

**Absent, and this shaped the whole session:** `mido`, `pretty_midi`, `soundfile`,
`librosa`. `music21` exists under `/opt/anaconda3/bin/python3` only. `numpy` is present
under `/opt/anaconda3/bin/python3`.

> **Therefore: the MIDI reader is hand-rolled and must stay hand-rolled** — a plugin that
> imports `mido` fails on the machine it was built for. Depend only on the standard
> library plus `numpy`, and *detect* the interpreter rather than hardcoding one.

**The studios** (William's Android phone `ilex`, reached through
`/opt/gaia/tailnet-gateway/`):

| url | workspace |
|---|---|
| `https://ilex:8768` | `aureon` — William's room `ava002` |
| `https://ilex:4768` | `jamai` — `op003-la-bifurcation-ep333` |
| `https://ilex:8790` | Landbase Movement Studio (**HTTP**, not HTTPS; reachable at `http://127.0.101.1:8790/`) |
| `ssh ilex` | a shell on the phone; port 8022, user `u0_a194` |

**Jerry's studio, on this host:** `https://localhost:8828` (workspace `jamai`, tree
`~/salix/run/jamai-portal`) and `https://localhost:8768` (also `jamai`, tree `~/dryades`).

> **The identity of a service is the triplet (host, port, code tree) — never the name
> alone.** Paid for twice in one session: `localhost:8768` and `ilex:8768` are different
> studios, and `ilex:8790` answered with *this* host's service because 8790 is not
> declared in the gateway's `peers.conf`. A port that is not declared does not travel.
> For any undeclared port the only honest check is `ssh ilex 'curl 127.0.0.1:<port>'`.

**Portal HTTP API** (same on every Pixel Recorder instance), verified by use:

```
GET  /recordings                                  → [{filename,size,sizeFormatted,created,hasTranscription,isVideo,isMidi,…}]
GET  /audio/<filename>                            → the bytes
GET  /api/compositions                            → [{slug,…}]
GET  /api/compositions/<slug>                     → {title,bpm,notes,clips[],texts[],images[]}
PUT  /api/compositions/<slug>                     JSON {title,bpm,notes}          → replaces the note
POST /import                                      multipart field `audioFile`     → {success,filename,…}  (the portal re-timestamps the name)
POST /api/compositions/<slug>/clips               JSON {filename,label}           → attaches; filename must already be in the recordings dir
POST /api/compositions/<slug>/images              multipart `imageFile` + `label`
POST /api/compositions/<slug>/clips/<f>/crop      JSON {start,end}                → ⚠️ BROKEN, see below
POST /api/compositions/<slug>/clips/<f>/transcribe → sends audio to Groq
```

Two verified traps:
- **`/clips` looks in the recordings directory, not the composition folder.** It answers
  `{"success":false,"error":"Recording not found"}` for a file that exists in the
  composition. On `ilex` the recordings directory is `/sdcard/Recordings-<workspace>`
  (from `PIXEL_RECORDER_RECORDINGS_DIR` or `` /sdcard/Recordings${WORKSPACE_SUFFIX} ``).
- **`/crop` is broken for these recordings.** It runs
  `ffmpeg -y -i <f>.m4a -ss X -to Y -c copy <f>_cropped.m4a`; the audio is **opus**, and
  the ipod (.m4a) container refuses it — *"Could not find tag for codec opus in stream
  #0"* — leaving a 0-byte file. The working form is `-c:a aac -b:a 160k`. Crop on the
  device by ssh instead, then copy into the recordings dir and attach.

**Movement captures** live in `~/movement-scores/` on `ilex`, one set per timestamp:
`<tlid>.jsonl` (the stream), `<tlid>.summary.json`, `<tlid>.jsonl.take.json`
(`schema miadi.take.v1`, `context.practice = ep083-landbase`). The stream is OSC
`/wek/inputs`, 9 float channels: **0–2 linear acceleration, 3–5 gyroscope, 6–8 attitude**.
Units are **not declared** — the studio's own field ledger says the semantic map is absent
and would read *accel g ×3 · rotation rad/s ×3 · attitude rad ×3*. **Write numbers without
units.** The sensor is worn on the belly (prose only, in the studio's ledger).

---

## 4. The measurements the atelier actually runs — reproduce these exactly

Every one of these was used to make a decision in the session. They are the plugin's
reason to exist. Read the generators named beside each.

| measurement | what it decides | where it is proven |
|---|---|---|
| **MIDI read**, hand-rolled: header, tracks, running status, meta, note pairing | everything | every `gen*.py` |
| **register occupancy** of a *rendered* MIDI | whether the singer's band was left empty | `gen018`, `gen024` |
| **pitch-class histogram weighted by duration** | the mode, and whether a take stays in the field | `gen_ava2_var` |
| **stridence** = share of spectral energy in 2–5 kHz over the whole rendered piece | which timbre is chosen — never taste | `gen019` §timbre, `gen023` |
| **vocal-band energy** = share in the singer's own Hz band | whether an arrangement will mask him | `gen_ava2_v2` |
| **f0 by autocorrelation** (40 ms windows), 5-frame median smoothing, **octave folding** | what he actually sings | `gen018` |
| **held-note extraction**: ≥200 ms within ±1 semitone | separating singing from speech | `gen018`, `gen021` |
| **motif vs drone**: ≥3 notes, ≥3 distinct pitches, span ≥3 semitones | the pattern database | `gen021` |
| **interval-cell recurrence** (length 2–4, counted across motifs) | his signature cell | `gen021` |
| **movement: value dedupe** — drop packets identical to the previous | **mandatory before any other movement measure** | `gen022`, `gen023` |
| **movement: onsets** = local maxima above median+1.2σ, min separation | rhythm from the body | `gen022` |
| **movement: heading unwrap** — accumulate deltas folded into (−π, π] | harmony from facing | `gen020` |
| **seam check** on an assembled piece: RMS before/after each crossfade | whether an assembly is listenable | the healing song |

### Thresholds that are Jerry's, not invented
- stridence **> 13.12 %** → rejected · **≤ 5.98 %** → accepted · **≤ 3 %** → soft.
  A multi-voice piece rarely reaches 5.98 %; say the number, do not fake it.

### Six corrections the plugin must make impossible to repeat
1. A band chosen from a week-old recording was 4 semitones wrong; **measure the newest take**.
2. An autocorrelation octave error invented a note the singer never sang; **fold octaves and check f/4 energy**.
3. 100 Hz requested delivered **23.8 Hz of new values** (76 % held); **dedupe first**.
4. Onsets found in undeduped packets were the staircase of held values, not the body.
5. Removing the hi-hats *raised* stridence — the source was the lead's sawtooth; **measure, do not blame the obvious**.
6. A bare `Q:` line in an ABC body is ignored; a mid-tune tempo needs the **inline** `[Q:1/4=136]`.

### ABC traps paid for, that the builder must encode
- **Explicit accidental on every note, naturals included** (`=C`, `^C`). An accidental
  contaminates its bar; a chromatic line written implicitly comes out wrong. Verified: a
  low note rendered as 42 instead of 41.
- `%%MIDI beat` did not reach voice 1; **written dynamics** (`!pp!` … `!fff!`) do, and are
  visible in the score as well as the MIDI.
- `abcm2ps` overflows on long single-staff pieces → `-k 8192`.
- `clef=treble-8` **sounds an octave below** what is written.
- Drums: a voice with `%%MIDI channel 10`, notes `C,,`=36 kick, `D,,`=38 snare,
  `^D,,`=39 clap, `^F,,`=42 closed hat, `^A,,`=46 open hat.
- A rest of 5 eighths in 4/4 cannot be one `z5` — `abcm2ps` errors *"Note too much dotted"*.

---

## 5. The loop the plugin encodes — eleven states

`veille → mesure → décision instrumentale → génération → rendu → **vérification** →
(correction → rendu) → publication → provenance → effacement`, with **retenue** as the
one state you cannot leave alone.

Two non-negotiable rules inside it:

- **Verification re-reads the *rendered* artifact, never the source.** A count that comes
  out right is not proof. The session verified: register windows, mode purity, note-for-note
  pitch preservation, tempo events, and the actual eighth-position of every kick.
- **Provenance is the deliverable, not a courtesy.** Every generator's header states what
  is **MESURÉ**, what is **DONNÉ PAR LUI**, and what is **CHOISI PAR MOI, et qu'il défait
  d'un mot**. A generator without that header is not finished.

---

## 6. Consent — this is the part that must never be convenient

William's words, recorded 2026-08-16, and they bind the plugin:

> *"I don't consent that my voice and my original recording goes outside of the boundary
> here."* (8 August — the MIDI is the offered part; the voice is not.)
>
> *"it's really a great privilege to use this sound, **nobody is authorized to use it
> without my consent**."* (of his eagle calls)

What the session actually did, and what the plugin must keep doing:

- Voice and cries are fetched, **analysed, then destroyed locally** (`shred -u`). Only
  numbers leave his device.
- **Crops are cut on his device** by ssh, never by copying the source out and back.
- No audio of his voice is ever published to the web, and no `.sf2` was built — a
  SoundFont is a format made to travel, and that permission was not given.
- **Consent is not transitive**: a yes for one piece is not a yes for the next.
- Transcription sends audio to a third party — **the human triggers it, not the agent.**

---

## 7. Your scope boundary

- **Write only inside** `/home/gmusic/salix/repos/miadi-orchestration-kit/claude-code/atelier-jerry/`.
- **Do not** `git commit`, `git push`, open a PR or an issue, or touch any other path.
  The coordinator does that once everything assembles.
- **Do not** write to `/workspace/repos/jgwill/…` — another occupant's tree.
- **Do not** call the portals, `ssh ilex`, or any of William's devices while building.
  Write the code that would; do not exercise it against his studio tonight.
- If a fact you need is not in this brief, **measure it or mark it `unverified`** — do not
  invent a path, a port or a flag.

## 8. Your completion marks

Your part is done when, and only when:
1. Every file you were asked for exists at its stated path.
2. `python3 -c "import ast,sys; [ast.parse(open(p).read()) for p in sys.argv[1:]]" <your .py>` exits 0.
3. `bash -n <your .sh>` exits 0 for every shell script.
4. Every JSON file you wrote parses (`python3 -m json.tool`).
5. Every path your code references is either `${CLAUDE_PLUGIN_ROOT}/…`, derived from an
   environment variable, or passed as an argument. **Grep your own output for `/home/`,
   `/tmp/` and `/workspace/` and justify every hit or remove it.**
6. You report back: the files written, the checks run **with their output**, and anything
   you could not verify — named as unverified rather than smoothed over.
