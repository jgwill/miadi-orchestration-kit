---
name: studio-portal
description: >
  The Pixel Recorder HTTP API as this atelier actually uses it — the endpoints, the
  recordings-directory trap that makes clip attachment fail for a file that plainly exists,
  the broken crop endpoint that writes a zero-byte file because opus cannot go in an ipod
  container, and the triplet rule that a service is identified by host, port and code tree
  and never by a name and a port. Carries the consent rules in the human's own words,
  including that transcription is his action and never the agent's. Load before calling any
  portal endpoint, before attaching or cropping a clip, before naming which studio a URL
  points at, and before anything that would move his audio. Triggers on "Pixel Recorder",
  "the portal", "/recordings", "/api/compositions", "attach a clip", "Recording not found",
  "crop the clip", "zero-byte file", "which studio is that", "ilex", "8768", "transcribe",
  "publish it to his studio", "consent".
version: 0.1.0
---

# The studio portal

## The triplet rule

**A service is identified by the triplet (host, port, code tree). Never by a name and a
port.** Two studios can run the same software on the same port number and be different
rooms belonging to different people.

This cost twice in one session.

### One: the same port on two hosts is two studios

```
localhost:8768   workspace jamai,   tree ~/dryades              — this host
ilex:8768        workspace aureon,  room ava002                 — his phone
```

Same port, same software, different workspace, different owner. A composition written to
one is invisible in the other, and a file listed by one is not present for the other.
Verified on 2026-08-17; the table below is a **record of what was true then**, not a
configuration. Read the real endpoint from the environment or from the gateway
configuration, never from this table.

| url | workspace |
|---|---|
| `https://ilex:8768` | `aureon` — his room `ava002` |
| `https://ilex:4768` | `jamai` — `op003-la-bifurcation-ep333` |
| `https://ilex:8790` | Landbase Movement Studio — **HTTP**, not HTTPS |
| `https://localhost:8828` | `jamai`, tree `~/salix/run/jamai-portal` |
| `https://localhost:8768` | `jamai`, tree `~/dryades` |
| `ssh ilex` | a shell on the phone; port 8022, user `u0_a194` |

### Two: an undeclared port answers with the wrong machine's service

`ilex:8790` answered — and it answered with **this host's** service. Port 8790 is not
declared in the tailnet gateway's peer configuration, and **a port that is not declared does
not travel**. The name resolved, the connection succeeded, the response was well-formed, and
it came from the wrong machine.

**For any port that is not declared in the gateway, the only honest check is to ask the host
itself:**

```bash
ssh <host> 'curl -s -o /dev/null -w "%{http_code}" 127.0.0.1:<port>'
```

A response from a loopback lane on this host proves nothing about the remote host. If the
check cannot be run, the correct report is "port 8790 on ilex is **unverified** from here",
not "the studio is up".

Two further specifics that follow from the same rule: the movement studio is **HTTP, not
HTTPS** — an `https://` prefix to it fails in a way that reads like the service being down —
and it is reachable through the gateway's loopback lane rather than by the peer name
directly. Read the lane from the gateway configuration; do not hardcode it.

---

## The HTTP API

Verified by use. The same shape on every Pixel Recorder instance.

```
GET  /recordings                                   → [{filename,size,sizeFormatted,created,
                                                       hasTranscription,isVideo,isMidi,…}]
GET  /audio/<filename>                             → the bytes
GET  /api/compositions                             → [{slug,…}]
GET  /api/compositions/<slug>                      → {title,bpm,notes,clips[],texts[],images[]}
PUT  /api/compositions/<slug>              JSON {title,bpm,notes}     → REPLACES the note
POST /import                        multipart field `audioFile`       → {success,filename,…}
POST /api/compositions/<slug>/clips        JSON {filename,label}
POST /api/compositions/<slug>/images       multipart `imageFile` + `label`
POST /api/compositions/<slug>/clips/<f>/crop   JSON {start,end}       → BROKEN, see below
POST /api/compositions/<slug>/clips/<f>/transcribe                    → sends audio to a third party
```

`GET /recordings` is the whole of **veille**: it gives filenames and creation times, which
is what decides which take is newest, and it does so without fetching a byte of his audio.

`PUT /api/compositions/<slug>` **replaces** the note. Read it first, edit the string, write
it back. A blind PUT deletes whatever he had written there.

---

## The recordings-directory trap

**Symptom.** `POST /api/compositions/<slug>/clips` answers
`{"success":false,"error":"Recording not found"}` for a file that is plainly present in the
composition folder.

**Cause.** The endpoint resolves the filename against the **recordings directory**, not
against the composition folder. On the phone that directory is
`/sdcard/Recordings-<workspace>`, taken from `PIXEL_RECORDER_RECORDINGS_DIR` when set and
otherwise from `/sdcard/Recordings${WORKSPACE_SUFFIX}`.

**Fix.** Two steps, in order:

1. `POST /import` with the file in the multipart field `audioFile`. **The portal
   re-timestamps the name** — use the `filename` it returns, not the one that was sent.
2. `POST …/clips` with that returned filename.

Skipping step 1 and guessing the name is how the error above is produced.

---

## The crop endpoint is broken for these recordings

**Symptom.** `POST …/crop` reports success or reports nothing, and leaves a **zero-byte**
`<f>_cropped.m4a`.

**Cause.** The endpoint runs

```bash
ffmpeg -y -i <f>.m4a -ss X -to Y -c copy <f>_cropped.m4a
```

The audio in these recordings is **opus**. The ipod (`.m4a`) container refuses it, and
`ffmpeg` fails with *"Could not find tag for codec opus in stream #0"*. `-c copy` cannot
work here at all.

**Fix.** Re-encode instead of copying:

```bash
ffmpeg -y -i <f>.m4a -ss X -to Y -c:a aac -b:a 160k <f>_cropped.m4a
```

**And cut it on his device.** Do the crop over `ssh`, write the result into the recordings
directory there, and attach it with `POST …/clips`. Never copy his source audio out to
another machine, crop it, and copy it back. That is the consent boundary below, not a
performance preference.

---

## Consent

His words, recorded 2026-08-16, and they bind everything above:

> *"I don't consent that my voice and my original recording goes outside of the boundary
> here."*  — 8 August. The MIDI is the part he named as offered. The voice is not.

> *"it's really a great privilege to use this sound, **nobody is authorized to use it
> without my consent**."*  — of his eagle calls.

What that means in practice, as the session actually performed it:

- **Voice and cries are fetched, analysed, then destroyed locally** with `shred -u`. Only
  numbers leave his device. Every generator that used his voice says so in its own header:
  *"Sa prise audio a été analysée puis effacée. Seuls les chiffres sortent."*
- **Crops are cut on his device** by `ssh`, never by copying the source out and back.
- **No audio of his voice is ever published to the web.**
- **No `.sf2` was built.** The instrument made from his eagle cries stayed a directory of
  `.wav` files. A SoundFont is a format designed to travel, and travelling is precisely the
  permission he did not give.
- **Consent is not transitive.** A yes for one piece is not a yes for the next. It is not a
  setting that gets stored; it is asked for again.
- **Transcription is his action, never the agent's.** `POST …/transcribe` sends his audio to
  a third-party service. The agent may tell him the endpoint exists and what it would do. The
  agent does not call it.

A useful test before any portal call that moves bytes: **does this send his voice somewhere
it was not already?** If yes, it is his to trigger, and the correct move is to say so and
stop.

---

## Failing honestly

Three reports that are wrong even when they feel true, and what to say instead:

| wrong | right |
|---|---|
| "the studio is down" | "`ilex:8790` did not answer from this host; the port is not declared in the gateway, so this result is **unverified** — the check is `ssh ilex 'curl 127.0.0.1:8790'`" |
| "the recording is not there" | "`/clips` resolves against the recordings directory; the file is in the composition folder and has not been imported" |
| "the crop succeeded" | "the crop wrote 0 bytes; the source is opus and the endpoint uses `-c copy` into an ipod container" |

Each of these is a case where the system returned something that looked like an answer. The
triplet rule is the general form: **a well-formed response is not evidence that it came from
the service you meant.**

---

## Runtime floors, loading, canonical copy

**Required**: `curl`, `ssh`, `ffmpeg`, `ffprobe`, `python3`. Remote shells on the phone
nodes are on **port 8022**, not 22.

**Declare the endpoint, do not assume it.** Base URLs come from the environment or from the
gateway configuration. A hardcoded URL makes the plugin host-local and, worse here, makes it
silently address the wrong person's room.

**Fail loudly and with the triplet.** When a portal call fails, the report names host, port
and — when it can be established — the code tree or workspace that answered. "The portal
returned 404" is not a finding; "`localhost:8768`, workspace `jamai`, tree `~/dryades`,
returned 404 for slug `ava002`" is, and it immediately shows that the slug belongs to the
other studio.

Paths resolve under `${CLAUDE_PLUGIN_ROOT}`, from an environment variable, or from an
argument. **Hooks load at session start and do not hot-swap.**

**Canonical copy**: nothing here is copied from `/etc/claude-code/skills/`. This file, at
`${CLAUDE_PLUGIN_ROOT}/skills/studio-portal/SKILL.md`, is the canonical text.
