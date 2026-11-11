# CPU transcription fallback

Use only when the task authorizes audio retrieval/transcription (for example, the person's own supplied video). Missing YouTube captions do not authorize bypassing access controls. Do not upload audio to another provider, publish or alter review-service records by following this recipe.

## Fetch audio, keeping the original timeline

With `URL`, `OUT`, `KIT`, and the verified absolute `YTDLP` from the main skill:

```bash
"$YTDLP" --ignore-config --js-runtimes node --no-playlist \
  --write-info-json -f 'bestaudio/best' --socket-timeout 20 --retries 1 \
  -o "$OUT/%(id)s.%(ext)s" "$URL" > "$OUT/audio.log" 2>&1
```

Read the actual filename and exit status. Do not cut out silence or concatenate excerpts before transcription: source timestamps must remain on the video's timeline. Prefer audio-only; `best` is a compatibility fallback that can download a full video. Read metadata/container duration and check signal first. `ffprobe` and `ffmpeg` are needed only for these diagnostics, not the JSON3 renderer.

## Generate local ASR on CPU/int8

An existing verified Python containing `faster-whisper` is sufficient. Otherwise an isolated environment avoids changing system Python:

```bash
# Replace the input filename with the actual downloaded audio.
uv run --python 3.12 --with 'faster-whisper==1.2.1' python - \
  "$OUT/VIDEO_ID.webm" "$OUT/local-asr.json" <<'PY'
import importlib.metadata
import json
from pathlib import Path
import sys
from faster_whisper import WhisperModel

model = WhisperModel('base', device='cpu', compute_type='int8', cpu_threads=4)
segments, info = model.transcribe(sys.argv[1], beam_size=1, vad_filter=True)
rows = [{'start': s.start, 'end': s.end, 'text': s.text} for s in segments]
if not rows:
    raise SystemExit('No speech text detected; no transcript written')
Path(sys.argv[2]).write_text(json.dumps({
    'kind': 'local-asr', 'engine': 'faster-whisper',
    'engine_version': importlib.metadata.version('faster-whisper'),
    'model': 'base', 'device': 'cpu', 'compute_type': 'int8',
    'language': info.language, 'language_probability': info.language_probability,
    'duration': info.duration, 'duration_after_vad': info.duration_after_vad,
    'segments': rows,
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY
```

The first run can download model weights. `local_files_only=True` can be added to `WhisperModel` when the model is already cached and network access is not wanted. Never use CUDA or `device='auto'` for this lane. Four CPU threads bound the load on a shared host. Use an absolute interpreter for background jobs; shell aliases and foreground activation may not carry over.

```bash
python3 "$KIT/scripts/transcript.py" "$OUT/local-asr.json" \
  --source "$URL" --kind local-asr --out "$OUT/transcript-local-asr"
```

Keep the downloaded audio, raw ASR JSON, engine/model settings, metadata and rendered receipt together. Record the audio file's SHA-256 separately in the task's evidence ledger. A locally generated transcript remains provisional: verify names, academic terms, quotations and disputed timestamps by listening. VAD suppresses many silence hallucinations but is not proof that every segment is speech. The fallback supplies speech evidence, never visual evidence of app interactions.
