#!/usr/bin/env bash
# The images a person attaches to a prompt are kept in the session folder: from the file
# Claude Code names in inlined_image_paths while it exists, else from the transcript's base64,
# one index line each, never twice. Tool-result, subagent and meta images are left out, a
# partial last line waits, and the UserPromptSubmit path waits for the prompt's line.
# Run: bash tests/user-images.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT"
. "$HERE/hooks/claude_hooks/lib.sh"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

sid="11111111-2222-3333-4444-555555555555"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"; mkdir -p "$out"
uploads="$WORK/uploads/$sid"; mkdir -p "$uploads"
t="$WORK/$sid.jsonl"
index="$out/_claude_images.jsonl"

printf 'ORIGINAL-ONE' > "$uploads/aaaa-image.jpg"     # present: kept from the file
missing="$uploads/bbbb-image.png"                       # named but gone: kept from the transcript
b64() { printf '%s' "$1" | base64 -w0; }

python3 - "$t" "$sid" "$uploads/aaaa-image.jpg" "$missing" "$(b64 SMALL-ONE)" "$(b64 SMALL-TWO)" "$(b64 TOOL)" "$(b64 SIDE)" <<'EOF'
import json, sys
t, sid, one, two, a, b, tool, side = sys.argv[1:]
img = lambda d, m: {"type": "image", "source": {"type": "base64", "media_type": m, "data": d}}
lines = [
    {"type": "user", "uuid": "m1", "promptId": "p1", "sessionId": sid, "timestamp": "2026-11-19T13:06:38Z",
     "entrypoint": "cli", "promptSource": "queued",
     "message": {"role": "user", "content": [img(a, "image/jpeg"), img(b, "image/png"), {"type": "text", "text": "two photos"}]}},
    {"type": "attachment", "parentUuid": "m1", "attachment": {"type": "inlined_image_paths", "paths": [one, two]}},
    {"type": "user", "uuid": "m2", "promptId": "p1", "sessionId": sid,
     "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "x", "content": [img(tool, "image/png")]}]}},
    {"type": "user", "uuid": "m3", "isSidechain": True, "sessionId": sid,
     "message": {"role": "user", "content": [img(side, "image/png")]}},
    {"type": "user", "uuid": "m4", "isMeta": True, "sessionId": sid,
     "message": {"role": "user", "content": [img(side, "image/png")]}},
]
with open(t, "w") as f:
    for l in lines:
        f.write(json.dumps(l, separators=(",", ":")) + "\n")
EOF

claude_user_images_capture "$t" "$out"
expect "one line per attached image" 2 "$(wc -l < "$index" | tr -d ' ')"
expect "the first image is the named file, not the transcript copy" "ORIGINAL-ONE" "$(cat "$out/images/p1/01-aaaa-image.jpg" 2>/dev/null)"
expect "its line says it came from the file" "file" "$(jq -r 'select(.index==1) | .kept_from' "$index")"
expect "a named file that is gone is kept from the transcript" "SMALL-TWO" "$(cat "$out/images/p1/02-image.png" 2>/dev/null)"
expect "its line says it came from the transcript" "transcript" "$(jq -r 'select(.index==2) | .kept_from' "$index")"
expect "the line names the prompt it was attached to" "p1 p1" "$(jq -r .prompt_id "$index" | tr '\n' ' ' | sed 's/ $//')"
expect "the line holds the sha256 of what is kept" "$(printf 'ORIGINAL-ONE' | sha256sum | cut -d' ' -f1)" "$(jq -r 'select(.index==1) | .sha256' "$index")"
expect "tool-result, subagent and meta images are left out" 2 "$(find "$out/images" -type f | wc -l | tr -d ' ')"

before=$(cat "$index")
claude_user_images_capture "$t" "$out"
expect "a second pass writes nothing" "$before" "$(cat "$index")"

# A prompt whose named files do not match its images in number: transcript copies only.
python3 - "$t" "$sid" "$(b64 THREE)" "$uploads/aaaa-image.jpg" <<'EOF'
import json, sys
t, sid, a, one = sys.argv[1:]
with open(t, "a") as f:
    f.write(json.dumps({"type": "user", "uuid": "m5", "promptId": "p2", "sessionId": sid,
        "message": {"role": "user", "content": [{"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": a}}]}},
        separators=(",", ":")) + "\n")
    f.write(json.dumps({"type": "attachment", "parentUuid": "m5", "attachment": {"type": "inlined_image_paths", "paths": [one, one]}},
        separators=(",", ":")) + "\n")
    # A partial last line: an image prompt still being written.
    f.write('{"type":"user","uuid":"m6","promptId":"p3","message":{"content":[{"type":"image"')
EOF
claude_user_images_capture "$t" "$out"
expect "counts that differ keep the transcript copy" "THREE" "$(cat "$out/images/p2/01-image.jpg" 2>/dev/null)"
expect "a partial last line waits" "" "$(ls "$out/images/p3" 2>/dev/null)"

# Once Claude Code deleted its transcript, the archived copy is read.
out2="$CLAUDE_SESSIONDATA_ROOT/other"; mkdir -p "$out2"
head -n 2 "$t" > "$out2/_transcript_final.jsonl"
claude_user_images_capture "$WORK/gone.jsonl" "$out2"
expect "a deleted transcript is read from the archived copy" 2 "$(wc -l < "$out2/_claude_images.jsonl" | tr -d ' ')"

# The archive pass of Stop, SubagentStop, SessionEnd and the sweep keeps them too.
out3="$CLAUDE_SESSIONDATA_ROOT/third"; mkdir -p "$out3"
claude_archive_session "$t" "$out3"
expect "claude_archive_session keeps the images" 3 "$(wc -l < "$out3/_claude_images.jsonl" | tr -d ' ')"

# UserPromptSubmit: the hook returns before Claude Code writes the prompt's line.
late="$WORK/late.jsonl"; : > "$late"
( sleep 2; head -n 1 "$t" > "$late" ) &
start=$(date +%s)
python3 "$HERE/hooks/claude_hooks/user_images.py" wait "$late" p1 10
expect "wait returns once the prompt's line is written" 0 "$?"
elapsed=$(( $(date +%s) - start ))
expect "wait does not run to its limit" 1 "$([ "$elapsed" -lt 8 ] && echo 1 || echo 0)"
python3 "$HERE/hooks/claude_hooks/user_images.py" wait "$late" nope 1
expect "wait gives up on a prompt that never lands" 1 "$?"

out4="$CLAUDE_SESSIONDATA_ROOT/fourth"
CLAUDE_USER_IMAGES_WAIT=5 bash "$HERE/hooks/claude_hooks/transcript_archive.sh" images "$t" "$out4" p1
expect "transcript_archive.sh images keeps the prompt's images and any it missed" 3 "$(wc -l < "$out4/_claude_images.jsonl" 2>/dev/null | tr -d ' ')"

# The hook itself detaches the capture and returns.
out5_sid="66666666-7777-8888-9999-000000000000"
hook_in=$(jq -cn --arg s "$out5_sid" --arg t "$t" '{session_id:$s, transcript_path:$t, prompt_id:"p1", prompt:"two photos", hook_event_name:"UserPromptSubmit", cwd:"/"}')
echo "$hook_in" | bash "$HERE/hooks/claude_hooks/user_prompt_submit_hook.sh" >/dev/null 2>&1
for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -s "$CLAUDE_SESSIONDATA_ROOT/$out5_sid/_claude_images.jsonl" ] && break
    sleep 1
done
expect "UserPromptSubmit keeps the prompt's images and any it missed" 3 "$(wc -l < "$CLAUDE_SESSIONDATA_ROOT/$out5_sid/_claude_images.jsonl" 2>/dev/null | tr -d ' ')"

if [ "$failures" -eq 0 ]; then echo "all passed"; else echo "$failures failed"; exit 1; fi
