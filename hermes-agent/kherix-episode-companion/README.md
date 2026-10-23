# Kherix phone companion

Continue one existing Kherix SwarmClaw conversation from a private phone page. This is the Mission 1 adapter, not a second Kherix chat or a decision about the Factory's eventual broker. Tracking: jgwill/miadi-orchestration-kit#100; SwarmClaw mission `mi_51a2fc7badbbd707`.

## Continuity contract

The server pins SwarmClaw chat `fe331909` to agent `3d3a349a` and verifies both before reading or sending. It never creates a chat or silently resumes a different provider conversation. SwarmClaw still owns routing to Hermes and its provider; the adapter does not claim ownership of a separate Hermes session ID. Desktop and phone read the same visible message history. System/tool payloads, internal messages and separate thinking fields are not returned.

A send persists its receipt before dispatch, then calls the pinned chat's `/chat` route with `queueMode: followup`. That means a message sent during an active desktop turn waits for that turn to finish. Do not wait for a queued self-test from inside the turn it is waiting behind. SSE end is not proof of completion: a matching completed run ledger and a non-streaming assistant message with the same run ID are required. Stable client IDs deduplicate retries. Uncertain execution is shown, never automatically replayed, including after a restart.

A recording is saved on the device during capture and on the server before transcription. Record owns the microphone from the permission prompt onward: polling and double taps cannot open another recorder, and reply playback (including native controls) is blocked until release. Capture follows Mia's direct `getUserMedia` → `MediaRecorder` path, without an AudioContext meter or second audio consumer. Keep the page visible and screen on while speaking. The status reports received bytes, not speech detection. A slow encoder warns after 3.5 seconds without chunks but remains recording; some browsers deliver chunks only at Stop. Each take owns its recorder, stream and chunks. Stop/error recovery waits up to three seconds for final data, then preserves the bytes delivered so far even if `onstop` never arrives; late callbacks cannot finalize twice or release a newer microphone.

Capture diagnostics (`direct-v1`) retain elapsed wall-clock time, chunk count/last-chunk time, stop reason, mute/end counts and a bounded error name with the private take, including explicit upload retries. Compare them against decoded duration and signal; they are not a claim of intelligible audio. Unexpected termination is labeled separately from a requested Stop. The old silent 0.6-second phone takes predate the meter: removing it simplifies the audio session but does not establish the original failure's cause. A real phone result is still required.

CPU ffmpeg checks the original recording before padding: a peak below −50 dB is reported as silence/extremely quiet audio, not a successful transcript. This is a conservative signal check, not full speech detection. Saved takes can be explicitly rechecked, and failure appears beside the composer without sending anything. English Groq STT (`whisper-large-v3-turbo`) receives a CPU-ffmpeg conversion with three seconds of trailing silence. Domain-name hints aid spelling, not interpretation. The transcript is editable and is never sent automatically: use it in the composer, correct it, then press Send. Failed takes remain downloadable/retryable. If IndexedDB fails, the in-memory take stays visible with a keep-open/download warning; it does not survive closing the page unless uploaded or downloaded.

Hear Kherix renders only a visible, finished assistant reply through Edge TTS (`en-US-GuyNeural`). MP3s are cached privately and served with byte ranges for Safari. A shared player sequences new replies without interrupting the current one. Automatic listening is opt-in and remembered on this device. Existing history does not auto-play on opening; a manual Hear selects one reply and clears the automatic sequence. New replies wait silently while the microphone opens, records, or a take awaits review. Sending releases that review hold; Play waiting replies releases it explicitly without sending. Browser autoplay/voice failure retains the waiting reply and asks for a tap, never hides the text. The in-page listening queue is not durable across closing/reloading; replies remain in the authoritative conversation for manual listening.

The capture/playback dock stays above a separately scrolling conversation, newest first. Write opens the composer; recorded transcripts remain in their recoverable take cards until explicitly used. Refresh, last-successful conversation time, work state, queue count and the latest device delivery receipt are visible. Background-tab return and network restoration trigger read-only checks; independent activity/recording/receipt failures do not hide successfully received history. Polling never sends a draft. New turns arriving while reading older material preserve the reading position and offer Show latest.

Authenticated `/api/activity` reads the pinned SwarmClaw queue snapshot and matching run ledger, including desktop work. Only a public, matching `running` ledger permits “Kherix is working”; dispatch alone stays queued. Missing/conflicting evidence is unverified, failed reads are unavailable, and the whole activity read has a four-second deadline. Counts exclude internal turns. This is execution/queue status, not a percentage or a claim that individual tools or model thoughts are visible; upstream tool-progress integration remains separate. Live inspection also found finished assistant messages without their run IDs: when the ledger finishes but no attributed final reply is present, the receipt becomes `reply_unverified` (“Turn finished · reply association unverified”), not a permanent queued/running indicator or a false completed acknowledgment. It remains non-replayable and may reconcile if attribution appears later.

This reuses Mia's capture/transcript/reply/recovery principles and the existing ffmpeg, Groq and Edge adapters, not Mia's listener, persona, voice state or owned ports. Full Chronicle capture-bundle registration and multi-session selection are outside this first slice.

## Run on Gaia

Requires Node 24+, ffmpeg, a configured SwarmClaw access key, Groq STT key and Edge TTS. No npm dependencies, build or frontend CDN are needed.

Use a dedicated Edge TTS environment. The pre-existing global 7.2.8 returned HTTP 403; 7.3.0 was exercised successfully on 2026-10-22. Do not update another agent's renderer as part of this install.

```sh
uv venv "$HOME/.local/share/kherix-episode-companion/tts-venv"
uv pip install --python "$HOME/.local/share/kherix-episode-companion/tts-venv/bin/python" 'edge-tts==7.3.0'
```

Private service configuration lives at `~/.config/kherix-episode-companion/service.env` (0600, containing the companion's independently generated random authentication token). Never put that token or an upstream credential in chat, source control, a URL or the browser's localStorage. Provision the token internally, without printing it:

```sh
node --input-type=module -e 'import{mkdirSync,writeFileSync}from"node:fs";import{randomBytes}from"node:crypto";const dir=process.env.HOME+"/.config/kherix-episode-companion";mkdirSync(dir,{recursive:true,mode:0o700});writeFileSync(dir+"/service.env","KHERIX_COMPANION_AUTH_TOKEN="+randomBytes(32).toString("base64url")+"\n",{mode:0o600,flag:"wx"});'
```

Add non-secret settings to that private file, retaining its token:

```ini
KHERIX_COMPANION_PUBLIC_URL=https://gaia.tail3b11eb.ts.net:8445
KHERIX_EDGE_TTS_BIN=/home/mia/.local/share/kherix-episode-companion/tts-venv/bin/edge-tts
KHERIX_DESKTOP_URL=https://swarm.sanctuaireagentique.com/agents/3d3a349a
```

Only `ACCESS_KEY` is read from `/srv/miadi/swarmclaw/.env.local`, and only `GROQ_API_KEY` from `/a/src/Miadi/.env`. The files are parsed, never sourced. Override their paths with `SWARMCLAW_ENV_FILE` and `KHERIX_STT_ENV_FILE`. Keys stay server-side.

```sh
cd /workspace/repos/jgwill/miadi-orchestration-kit/hermes-agent/kherix-episode-companion
node --env-file="$HOME/.config/kherix-episode-companion/service.env" server.mjs
```

The default bind is loopback `127.0.0.1:8774`; non-loopback binding and replacement chat/agent IDs are refused. Place a private HTTPS proxy in front. Check `tailscale serve status --json` before adding a mapping: never replace another service. Gaia's dedicated mapping is `tailscale serve --bg --https=8445 http://127.0.0.1:8774`. It is tailnet-only, not Funnel/public exposure.

For durable operation, use `deploy/kherix-episode-companion.service.example`, replacing the Node binary/PATH and repository path for the host before installing it under `~/.config/systemd/user/kherix-episode-companion.service`. Then `systemctl --user daemon-reload` and `systemctl --user enable --now kherix-episode-companion.service`. The installed Gaia unit has been checked with `systemd-analyze --user verify`.

## Pair a phone without sharing credentials

Both devices need access to the tailnet. The locked phone page is pairing-first: scan a fresh QR from the trusted desktop in the browser that will hold the conversation. Each browser/device needs its own grant; a QR consumed on the desktop cannot subsequently unlock the phone. Miadi tokens, SwarmClaw keys and Kherix API tokens are intentionally not accepted. The manual companion credential is hidden under operator recovery, not the normal sign-in path. Drafts remain editable while locked; Send and Record wait for verified access. Generate a single-use pairing grant locally:

```sh
node --env-file="$HOME/.config/kherix-episode-companion/service.env" pair.mjs
```

The command prints only the private file path, not its contents. `~/.local/state/kherix-episode-companion/pairing-url.txt` holds a ten-minute, single-use link. The server stores only its hash. A new grant invalidates the previous unused one. For a QR shown locally:

```sh
qrencode -o "$HOME/.local/state/kherix-episode-companion/pairing.png" < "$HOME/.local/state/kherix-episode-companion/pairing-url.txt"
```

Open that QR on the desktop, scan it on the phone, and keep it private. The fragment is removed from browser history before the pairing POST; a 12-hour Secure/HttpOnly/SameSite=Strict cookie unlocks that device. Raw pairing codes are not saved in localStorage. A used/expired link cannot be replayed. Never paste the pairing link into chat or a remote QR service. The ordinary URL is `https://gaia.tail3b11eb.ts.net:8445/`; renew pairing locally when the device cookie expires. Existing manual-token authentication is retained as an operator recovery path.

All private APIs require authentication, including `/api/health`. Host/Origin checks reject cross-site requests. Tailscale identity headers alone never authenticate a request. The public shell contains no conversation or credentials.

## Episode or staging context

`~/.local/state/kherix-episode-companion/context.json` carries `intention`, `envisionedResult`, `corrections`, `pendingWork`, `source`, `staging`, `episode` and `stableAddress`. Optional nested metadata uses a bounded allowlist; arbitrary fields are not exposed. No episode needs to exist to use the companion. Opening it never mints an episode or launches another mission. The pinned conversation is the authority for actual turns and acknowledgments; metadata is not a substitute transcript. Maintain this small context file deliberately as work changes.

Receipts, raw takes, transcripts and speech stay under that private state directory (directories 0700, files 0600), not the repository. The browser stores drafts, its outbox and unsent audio on the device. Use trusted devices. Groq receives recording content for STT and Microsoft receives reply text for voice synthesis; provider/service costs and retention policies remain theirs. Do not represent this as offline/local-only speech processing. There is no automatic pruning of retained takes in this slice; remove private state deliberately only after preserving anything wanted.

## Verification and acceptance

```sh
npm test
npm run check
uv run --with playwright python -m playwright install chromium webkit
uv run --with playwright python scripts/verify-phone-ui.py --output "$HOME/.kherix/miadi-factory-participation/m1-phone-presence"
uv run --with playwright python scripts/verify-phone-ui.py --browser webkit --output "$HOME/.kherix/miadi-factory-participation/m1-phone-presence"
```

The optional rendered checks above use an isolated loopback fixture server, not the live companion: sticky controls, responsive widths, refresh/draft preservation and actual sequential audio decoding run in Chromium and WebKit; Chromium additionally exercises an explicitly fake microphone, take review and one explicit Send to the fixture only. They never send a live chat or use live STT. Browser reports/screenshots remain outside the repository. WebKit-on-Linux is not physical iPhone validation.

Hermetic tests cover identity refusal, durable/idempotent receipts, queue and ledger reconciliation, restart uncertainty without replay, authenticated pairing, cross-origin boundaries, secret redaction, staged context, durable/failed recordings, IndexedDB fallback, explicit recovery, direct capture without Web Audio, error recovery without `onstop`, interrupted-take diagnostics, slow encoders, CPU speech adapters and Safari ranges. These tests mock upstream model/speech services; passing them is not a live provider or phone result.

Live checks additionally need the private HTTPS page, real Groq transcription, real reply-audio decoding, and a message traceable to the same SwarmClaw run/history. Generated speech fixtures must be labeled synthetic, not a physical phone microphone test. While a desktop turn runs, the phone's follow-up is queued behind it; verify the final reply after that turn finishes.

Mission 1 is accepted only after Guillaume opens it on his actual phone, records, corrects/sends once, receives the reply, and confirms he can hear it. A queued receipt, audio API 200, or a browser-emulated phone viewport does not supply that human acceptance.

Stop the service with `systemctl --user stop kherix-episode-companion.service`. Remove only its mapping with `tailscale serve --https=8445 off`; never reset the tailnet's other services. Restarting does not discard takes or automatically resend uncertain chat requests.
