# phone-capture — speak from the iPhone into an episode on gaia

One page and one upload route in front of `@miadi/capture-service`. The iPhone records
in Safari. gaia stores the take, transcribes it, and binds it to the episode. The
`mia-episode-companion` listener then wakes the Claude session listening on that episode.

```
iPhone Safari ──audio/mp4──▶ tailscale serve :8443 ──▶ phone-capture 127.0.0.1:8771
                                                        │ @miadi/capture-service (file-import driver)
                                                        │   start → stop → transcribe (Groq) → assign
                                                        ▼ @miadi/episode-capture
                         <episode>/captures/<tlid>/capture.json   miadi.episode-capture.v1
                                                        ▼
                         mia-listen await  ──▶  Mia answers in the Claude session
```

The bundle is the one the Episode Recorder on ilex writes, with parity checked by
`episode-capture`'s own tests. The listener cannot tell a gaia take from an ilex take.

## Run

Nobody has to start it. The plugin's SessionStart hook runs `./ensure.sh --hook`, and
`/mia-listen phone` runs `./ensure.sh`. Both are idempotent. When the service is not
answering on `127.0.0.1:8771`, ensure installs dependencies once (`npm ci --omit=dev`) and
starts `start.sh` detached with `setsid`. The service outlives the session. Ensure also
adds `tailscale serve --https=8443` when that mapping is absent. It leaves an 8443 that
serves something else untouched and says so. A `flock` keeps concurrent sessions to one
service. On a host without `MIADI_CHRONICLE_ROOT`, it does nothing.

On the iPhone, open `https://<host>.<tailnet>.ts.net:8443/` in Safari and allow the
microphone. The hook gives each session the link with `?episode=<its folder>`. The page
also remembers the last episode.

Log: `$XDG_STATE_HOME/miadi-phone-capture/service.log`. To stop it:
`tailscale serve --https=8443 off`, then `pkill -f phone-capture/server.mjs`. The next
session start will bring it back unless the plugin is disabled.

| Env | Default | |
|---|---|---|
| `MIADI_CHRONICLE_ROOT` | required | where episodes live |
| `MIADI_PHONE_CAPTURE_EPISODE` | none | the preselected episode |
| `MIADI_PHONE_CAPTURE_PORT` / `_HOST` | `8771` / `127.0.0.1` | loopback only. `tailscale serve` is the way in |
| `MIADI_PHONE_CAPTURE_HTTPS_PORT` | `8443` | the `tailscale serve` port `ensure.sh` maps |
| `MIADI_PHONE_CAPTURE_PUBLIC_URL` | `http://<host>:<port>` | base of the audio `uri` each registration carries |
| `MIADI_PHONE_CAPTURE_STATE_DIR` | `$XDG_STATE_HOME/miadi-phone-capture` | the take library (`takes/`) and in-flight uploads |
| `MIADI_PHONE_CAPTURE_ENV_FILE` | `/a/src/Miadi/.env` | `start.sh` reads only its `GROQ_API_KEY` and `MIADI_API_TOKEN_WRITER` lines (`MIADI_PHONE_CAPTURE_GROQ_ENV_FILE` still honored) |
| `MIADI_API_URL` | `http://127.0.0.1:3335` | the Miadi voice layer that renders Mia's voice |
| `MIADI_CAPTURE_LANGUAGE` | `en` | the spoken language. `en` files one English transcript. Any other language files the original plus an English translation |
| `MIADI_CHRONICLE_MW_URL` | `http://127.0.0.1:8040` | registration. A failure queues the take and never loses it |

## Mia's reply on the page

After Stop & send, the page waits for up to 15 minutes, polling every 4 seconds. It shows
Mia's reply to that take with **Hear Mia** and **Copy**. Opening the page later shows the
latest reply for the selected episode.

- **Delivery.** The Mia seat runs `mia-listen.mjs reply <take>` with its return on stdin,
  and the wake prints that command. It reads the seat's tmux origin in that same
  invocation. `POST /api/replies` is refused (403) for anything `tailscale serve`
  forwarded, so only a process on this host can post a reply. Replies are kept in
  `<state>/replies/<episode>.jsonl`.
- **Hear Mia.** The first tap asks the Miadi voice layer through `@miadi/voice-client`:
  persona `mia`, `en`, bound to the episode, with the reply's origin, so an answer routes
  back to that seat. The page reads the words without glyph labels or markup. The mp3 is
  cached and served with byte ranges, which iOS Safari needs. A second tap plays the
  cache. With no voice layer configured, the page says so. It never substitutes another
  voice.
- **Updates reach the running service.** `/api/health` reports a build hash of
  `server.mjs`, `public/index.html` and `package-lock.json`. `ensure.sh` restarts an idle
  service whose hash differs from disk, and reinstalls when the lockfile changed.

## What it holds to

- **Only `audio/mp4` and `wav`.** The Chronicle gitignores `.m4a` and `.wav`. It does not
  ignore `.webm`, so a Chrome recording is refused rather than risking raw audio in history.
- **A failed transcription still stores the take**, and the page says why. The listener
  holds such a bundle as waiting until a transcript exists.
- **Who recorded** is the `Tailscale-User-Login` header that `tailscale serve` adds. It is
  kept as `recorded_by` in the take's context.
- **No git.** The bundle lands uncommitted in gaia's checkout. Mia commits its textual
  files by name when she hears it.

## Test

```bash
npm test
```

Six hermetic tests with a temp chronicle, a stub transcriber, a stub wheel, and a stub voice layer:
- an upload becomes a bundle that `mia-listen show` validates;
- a failed transcription still stores the take;
- the refusals: webm, an unknown episode, traversal, and an empty body;
- a reply posted from the host is shown, and one forwarded from the tailnet is refused;
- one voice is rendered per reply, as `mia`, and served with byte ranges;
- without a voice layer the page is told so.
