#!/usr/bin/env bash
# The images a person attaches to a prompt are kept in the session folder (layout 2, 0.1.52):
# one folder per transcript line, from the file Claude Code names in inlined_image_paths while
# it exists (found through the attachments between them), else from the transcript's base64,
# one index line each with the prompt's id and text, never twice. Tool-result and subagent
# images are left out, a slash command's images are kept, a fork's copied prompts do not
# overwrite each other, an unchanged transcript is not read again, a partial line waits, a
# layout 1 folder is moved aside and captured again, and the UserPromptSubmit path waits for
# the prompt's line. Run: bash tests/user-images.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT"
. "$HERE/hooks/claude_hooks/lib.sh"
PY="$HERE/hooks/claude_hooks/user_images.py"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}
count() { if [ -f "$1" ]; then wc -l < "$1" | tr -d ' '; else echo 0; fi; }

sid="11111111-2222-3333-4444-555555555555"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"; mkdir -p "$out"
uploads="$WORK/uploads/$sid"; mkdir -p "$uploads"
t="$WORK/$sid.jsonl"
index="$out/_claude_images.jsonl"

printf 'ORIGINAL-ONE' > "$uploads/aaaa-image.jpg"     # present: kept from the file
missing="$uploads/bbbb-image.png"                       # named but gone: kept from the transcript
printf 'ORIGINAL-SIX' > "$uploads/ffff-image.jpg"
b64() { printf '%s' "$1" | base64 -w0; }

# m1: two images, the attachment behind a total_tokens_reminder (F1).
# m2: a tool result's image. m3: a subagent's. m4/m4c: a slash command, its images on the
# expansion line (F3). m5..m7: three copied prompts of a fork sharing one prompt id, each with
# an image named image.png (F2). m8: an image whose base64 does not decode.
python3 - "$t" "$sid" "$uploads/aaaa-image.jpg" "$missing" "$uploads/ffff-image.jpg" \
    "$(b64 SMALL-ONE)" "$(b64 SMALL-TWO)" "$(b64 TOOL)" "$(b64 SIDE)" "$(b64 SLASH)" "$(b64 FORK-A)" "$(b64 FORK-B)" "$(b64 FORK-C)" <<'EOF'
import json, sys
t, sid, one, two, six, a, b, tool, side, slash, fa, fb, fc = sys.argv[1:]
img = lambda d, m="image/png": {"type": "image", "source": {"type": "base64", "media_type": m, "data": d}}
user = lambda uuid, pid, content, **kw: dict({"type": "user", "uuid": uuid, "promptId": pid, "sessionId": sid,
    "timestamp": "2026-11-19T13:06:38Z", "entrypoint": "cli", "message": {"role": "user", "content": content}}, **kw)
lines = [
    user("m1", "p1", [img(a, "image/jpeg"), img(b), {"type": "text", "text": "two   photos\nof the review"}], promptSource="queued"),
    {"type": "attachment", "uuid": "a1", "parentUuid": "m1", "attachment": {"type": "total_tokens_reminder", "n": 1}},
    {"type": "attachment", "uuid": "a2", "parentUuid": "a1", "attachment": {"type": "inlined_image_paths", "paths": [one, two]}},
    user("m2", "p1", [{"type": "tool_result", "tool_use_id": "x", "content": [img(tool)]}]),
    user("m3", "p1", [img(side)], isSidechain=True),
    user("m4", "p4", "<command-message>miadi-run</command-message>\n<command-name>/miadi-run</command-name>\n<command-args>go now</command-args>"),
    user("m4c", "p4", [img(slash), {"type": "text", "text": "Base directory for this skill"}], isMeta=True),
    user("m5", "pf", [img(fa), {"type": "text", "text": "fork copy A"}]),
    user("m6", "pf", [img(fb), {"type": "text", "text": "fork copy B"}]),
    user("m7", "pf", [img(fc), {"type": "text", "text": "fork copy C"}]),
    user("m8", "p8", [img("not*base64!", "image/png"), {"type": "text", "text": "broken"}]),
    user("m9", "p9", [{"type": "text", "text": "a prompt with no image"}]),
]
with open(t, "w") as f:
    for l in lines:
        f.write(json.dumps(l, separators=(",", ":")) + "\n")
EOF

claude_user_images_capture "$t" "$out"
expect "one line per image of a person's prompt" 7 "$(count "$index")"
expect "every line declares layout 2" "2" "$(jq -r .layout "$index" | sort -u | tr '\n' ' ' | sed 's/ $//')"
expect "an original behind another attachment is kept from the file (F1)" "ORIGINAL-ONE" "$(cat "$out/images/m1/01-aaaa-image.jpg" 2>/dev/null)"
expect "its line says file" "file" "$(jq -r 'select(.message_uuid=="m1" and .index==1) | .kept_from' "$index")"
expect "a named file that is gone is kept from the transcript" "SMALL-TWO" "$(cat "$out/images/m1/02-image.png" 2>/dev/null)"
expect "the line holds the start of the prompt's text, spaces folded" "two photos of the review" "$(jq -r 'select(.message_uuid=="m1" and .index==1) | .prompt_text' "$index")"
expect "the line says how many of the person's lines carry its prompt id" "1" "$(jq -r 'select(.message_uuid=="m1" and .index==1) | .prompt_lines' "$index")"
expect "the line holds the sha256 of what is kept" "$(printf 'ORIGINAL-ONE' | sha256sum | cut -d' ' -f1)" "$(jq -r 'select(.message_uuid=="m1" and .index==1) | .sha256' "$index")"
expect "a slash command's image is kept (F3)" "SLASH" "$(cat "$out/images/m4c/01-image.png" 2>/dev/null)"
expect "its prompt text is the command the person typed" "/miadi-run go now" "$(jq -r 'select(.message_uuid=="m4c") | .prompt_text' "$index")"
expect "a fork's copied prompts keep one image each, none overwritten (F2)" "FORK-A FORK-B FORK-C" "$(cat "$out/images/m5/01-image.png" "$out/images/m6/01-image.png" "$out/images/m7/01-image.png" 2>/dev/null | tr '\n' ' ' | sed 's/ $//' | sed 's/FORK-AFORK-BFORK-C/FORK-A FORK-B FORK-C/')"
expect "each says three lines carry its prompt id" "3 3 3" "$(jq -r 'select(.prompt_id=="pf") | .prompt_lines' "$index" | tr '\n' ' ' | sed 's/ $//')"
expect "base64 that does not decode is listed, not written" "null not copied: the transcript's base64 does not decode" "$(jq -r 'select(.message_uuid=="m8") | "\(.path) \(.note)"' "$index")"
expect "tool-result and subagent images are left out" 6 "$(find "$out/images" -type f | wc -l | tr -d ' ')"

before=$(cat "$index")
claude_user_images_capture "$t" "$out"
expect "a second pass writes nothing" "$before" "$(cat "$index")"
expect "the pass records the transcript it read" "2 $(stat -c '%s %.9Y' "$t" | tr -d .) $t" "$(cat "$out/.images.state")"
expect "the state file takes the transcript's mtime" "$(stat -c %.9Y "$t")" "$(stat -c %.9Y "$out/.images.state")"
# A line written after a pass makes the transcript newer than the state: the next pass reads it.
touch -d '@1' "$out/.images.state"
claude_user_images_capture "$t" "$out"
expect "a transcript newer than the state is read again" "$(stat -c %.9Y "$t")" "$(stat -c %.9Y "$out/.images.state")"
# F4: an unchanged transcript is not read. A pass that read it would list the new image.
printf 'NEW' > "$WORK/marker"
size_mtime=$(stat -c '%s %Y' "$t")
python3 - "$t" <<'EOF'
import sys, json, os
t = sys.argv[1]; st = os.stat(t)
data = open(t).read().replace('"text":"broken"', '"text":"BROKEN"')
open(t, "w").write(data); os.utime(t, ns=(st.st_atime_ns, st.st_mtime_ns))
EOF
claude_user_images_capture "$t" "$out"
expect "an unchanged size and mtime skip the read (F4)" "$before" "$(cat "$index")"

# A pass killed mid-line leaves a partial index line; the next line starts on its own.
printf '{"layout":2,"message_uuid":"cut' >> "$index"
printf '%s\n' "$(jq -cn --arg s "$sid" '{type:"user", uuid:"m10", promptId:"p10", sessionId:$s, message:{content:[{type:"image", source:{type:"base64", media_type:"image/png", data:"VEVO"}}]}}')" >> "$t"
claude_user_images_capture "$t" "$out"
expect "an index line after a partial one is whole" "m10" "$(tail -n 1 "$index" | jq -r .message_uuid)"

# A partial last transcript line waits.
printf '{"type":"user","uuid":"m11","promptId":"p11","message":{"content":[{"type":"image"' >> "$t"
claude_user_images_capture "$t" "$out"
expect "a partial last line waits" "" "$(ls "$out/images/m11" 2>/dev/null)"

# F6: the archived copy, whose base64 the sanitizer changed, once Claude Code deleted the transcript.
out2="$CLAUDE_SESSIONDATA_ROOT/other"; mkdir -p "$out2"
head -n 3 "$t" | sed 's/"data":"\([A-Za-z0-9+/=]*\)"/"data":"[REDACTED:key]\1"/g' > "$out2/_transcript_final.jsonl"
claude_user_images_capture "$WORK/gone.jsonl" "$out2"
expect "the archived copy is read once the transcript is gone" "archive" "$(jq -r .read_from "$out2/_claude_images.jsonl" | sort -u | head -1)"
expect "an original still on disk is kept from the file" "ORIGINAL-ONE" "$(cat "$out2/images/m1/01-aaaa-image.jpg" 2>/dev/null)"
expect "base64 the sanitizer changed is listed with that reason (F6)" "not copied: the archived copy's base64 was changed by the secret sanitizer" "$(jq -r 'select(.index==2) | .note' "$out2/_claude_images.jsonl")"

# Layout 1 (0.1.50, 0.1.51) is moved aside, kept, and captured again in layout 2.
out3="$CLAUDE_SESSIONDATA_ROOT/third"; mkdir -p "$out3/images/p1"
printf 'OLD' > "$out3/images/p1/01-aaaa-image.jpg"
printf '{"session_id":"%s","prompt_id":"p1","message_uuid":"m1","index":1,"path":"images/p1/01-aaaa-image.jpg"}\n' "$sid" > "$out3/_claude_images.jsonl"
claude_archive_session "$t" "$out3"
expect "layout 1 files are kept under images/v1/" "OLD" "$(cat "$out3/images/v1/p1/01-aaaa-image.jpg" 2>/dev/null)"
expect "layout 1's index is kept beside them" 1 "$(count "$out3/images/v1/index.jsonl")"
expect "claude_archive_session captures again in layout 2" "2" "$(head -n 1 "$out3/_claude_images.jsonl" | jq -r .layout)"
expect "and holds every image" 8 "$(count "$out3/_claude_images.jsonl")"

# UserPromptSubmit: the hook returns before Claude Code writes the prompt's line.
late="$WORK/late.jsonl"; : > "$late"
( sleep 2; head -n 1 "$t" >> "$late" ) &
start=$(date +%s)
python3 "$PY" wait "$late" p1 10
expect "wait returns once the prompt's line is written" 0 "$?"
elapsed=$(( $(date +%s) - start ))
expect "wait does not run to its limit" 1 "$([ "$elapsed" -lt 8 ] && echo 1 || echo 0)"
python3 "$PY" wait "$late" nope 1
expect "wait gives up on a prompt that never lands" 1 "$?"

out4="$CLAUDE_SESSIONDATA_ROOT/fourth"
CLAUDE_USER_IMAGES_WAIT=5 bash "$HERE/hooks/claude_hooks/transcript_archive.sh" images "$t" "$out4" p1
expect "transcript_archive.sh images keeps the prompt's images and any it missed" 8 "$(count "$out4/_claude_images.jsonl")"

out5_sid="66666666-7777-8888-9999-000000000000"
hook_in=$(jq -cn --arg s "$out5_sid" --arg t "$t" '{session_id:$s, transcript_path:$t, prompt_id:"p1", prompt:"two photos", hook_event_name:"UserPromptSubmit", cwd:"/"}')
echo "$hook_in" | bash "$HERE/hooks/claude_hooks/user_prompt_submit_hook.sh" >/dev/null 2>&1
for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -s "$CLAUDE_SESSIONDATA_ROOT/$out5_sid/_claude_images.jsonl" ] && break
    sleep 1
done
expect "UserPromptSubmit keeps the prompt's images and any it missed" 8 "$(count "$CLAUDE_SESSIONDATA_ROOT/$out5_sid/_claude_images.jsonl")"

if [ "$failures" -eq 0 ]; then echo "all passed"; else echo "$failures failed"; exit 1; fi
