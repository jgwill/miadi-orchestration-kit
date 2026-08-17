#!/usr/bin/env bash
# atelier_veille.sh -- the watch loop of the atelier.
#
# Watches one or more Pixel Recorder studios and says what the human deposited.
#
# THREE THINGS THIS SCRIPT KNOWS THAT A NAIVE POLLER DOES NOT
#
#   1. A deposit does not always appear in /recordings.
#      A photo, a text, or a change to a note only shows up inside the composition.
#      So every pass polls /recordings AND every composition.
#
#   2. A file that is still being written has no moov atom and cannot be read.
#      So a file is reported only when its size is UNCHANGED since the previous poll.
#      A first sighting is never a report.
#
#   3. An agent that publishes into the studio will see its own deposit and
#      announce it back as if the human had made it. So there is a self-echo
#      ledger: filenames this agent published are never reported as deposits.
#      Register one with:  atelier_veille.sh --mine <filename>
#
# And one thing it refuses to blur:
#   UNREACHABLE is not EMPTY. A portal that does not answer tells you nothing.
#   A portal that answers with a list of length 0 tells you something. The script
#   says which one happened, every time.
#
# NO HOST, PORT OR URL IS HARDCODED. Studios come from arguments or $ATELIER_STUDIOS.

set -u

PROG="$(basename "$0")"

TIMEOUT="${ATELIER_VEILLE_TIMEOUT:-15}"
INTERVAL="${ATELIER_VEILLE_INTERVAL:-90}"
STATE_DIR="${ATELIER_VEILLE_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/atelier-veille}"
PYTHON="${ATELIER_PYTHON:-python3}"
ONCE=0
QUIET=0
STUDIO_ARGS=""

usage() {
    cat <<'HELPTEXT'
atelier_veille.sh -- watch the atelier's studios for what the human deposits.

USAGE
    atelier_veille.sh [options] name=url [name=url ...]
    atelier_veille.sh --mine <filename>
    atelier_veille.sh --once

STUDIOS
    Given as name=url pairs, or in $ATELIER_STUDIOS as a comma-separated list:

        export ATELIER_STUDIOS="aureon=https://<host>:<port>,jamai=https://<host>:<port>"

    Nothing is hardcoded. The brief's studios are two rooms on the human's phone,
    on two DIFFERENT ports of the same host, plus a local studio on this machine
    whose port number COLLIDES with one of theirs while being a different studio.
    That is exactly why this script will not guess a URL for you: a name and a
    port do not identify a service -- the triplet (host, port, code tree) does.

OPTIONS
    --once                 one pass, then exit
    --interval SECONDS     loop interval (default 90, or $ATELIER_VEILLE_INTERVAL)
    --timeout SECONDS      per-request timeout (default 15, or $ATELIER_VEILLE_TIMEOUT)
    --state-dir DIR        default ${XDG_STATE_HOME:-$HOME/.local/state}/atelier-veille
    --mine FILENAME        append FILENAME to the self-echo ledger and exit.
                           Do this for everything this agent publishes.
    --mine-list            print the self-echo ledger and exit
    --quiet                print only findings, no per-studio heading
    -h, --help             this text

WHAT IT PRINTS
    DEPOT   <studio> : <filename> (<bytes>)      a stable new file in /recordings
    SALLE   <studio> — <slug> : <before> → <after>   a room whose contents changed
    ATTENTE <studio> : <filename> still growing  seen, not yet stable, not reported
    VIDE    <studio> : ...                       the portal answered with nothing
    INJOIGNABLE <studio> : ...                   the portal did not answer at all
    AMORCE  <studio> : ...                       first pass: state seeded, nothing
                                                 reported (otherwise the whole
                                                 backlog would look like news)

EXIT
    0 normal. 2 usage or missing dependency.
HELPTEXT
}

die() {
    printf '%s: %s\n' "$PROG" "$*" >&2
    exit 2
}

stamp() { date '+%H:%M:%S'; }

sanitize() { printf '%s' "$1" | tr -c 'A-Za-z0-9._-' '_'; }

# --------------------------------------------------------------------------- #
# JSON readers (python3 -- verified present on the atelier host; no jq assumed)
# --------------------------------------------------------------------------- #

PY_RECORDINGS='
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(3)
if not isinstance(data, list):
    sys.exit(4)
for item in data:
    if isinstance(item, dict) and item.get("filename"):
        print("%s\t%s" % (item["filename"], item.get("size", "")))
'

PY_SLUGS='
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(3)
if not isinstance(data, list):
    sys.exit(4)
for item in data:
    if isinstance(item, dict) and item.get("slug"):
        print(item["slug"])
    elif isinstance(item, str):
        print(item)
'

PY_ROOM='
import hashlib, json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(3)
if not isinstance(data, dict):
    sys.exit(4)
clips = data.get("clips") or []
texts = data.get("texts") or []
images = data.get("images") or []
notes = data.get("notes") or ""
digest = hashlib.sha256(notes.encode("utf-8")).hexdigest()[:8]
print("SIG clips=%d textes=%d images=%d notes=%s" % (len(clips), len(texts), len(images), digest))
for clip in clips:
    if isinstance(clip, dict):
        name = clip.get("filename") or clip.get("name") or ""
    else:
        name = str(clip)
    if name:
        print("CLIP %s" % name)
'

# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #

BODY_TMP=""
ERR_TMP=""
HTTP_CODE=""
HTTP_RC=0

http_get() {
    # $1 = url. Body lands in $BODY_TMP, curl stderr in $ERR_TMP.
    # Sets HTTP_CODE and HTTP_RC. -k because these portals are self-signed,
    # -L because a portal may redirect and a 301 is not an answer about deposits,
    # -S so the failure reason survives -s and can be classified.
    HTTP_CODE=$(curl -sSkL --max-time "$TIMEOUT" -o "$BODY_TMP" -w '%{http_code}' "$1" 2>"$ERR_TMP")
    HTTP_RC=$?
    return $HTTP_RC
}

unreachable_reason() {
    if grep -qi 'timed out\|timeout' "$ERR_TMP" 2>/dev/null; then
        printf 'timeout after %ss -- the path to the host is down, not the service' "$TIMEOUT"
    elif grep -qi 'refused\|could not connect\|failed to connect' "$ERR_TMP" 2>/dev/null; then
        printf 'connection refused -- the host answered, the port has nothing listening'
    elif grep -qi 'could not resolve\|name or service not known' "$ERR_TMP" 2>/dev/null; then
        printf 'name does not resolve -- check the tailnet gateway, not the studio'
    else
        printf 'curl exit %s: %s' "$HTTP_RC" "$(tr -d '\n' <"$ERR_TMP" 2>/dev/null | cut -c1-160)"
    fi
}

# --------------------------------------------------------------------------- #
# state
# --------------------------------------------------------------------------- #

MINE_FILE=""

ensure_state() {
    mkdir -p "$STATE_DIR" || die "cannot create state dir $STATE_DIR"
    MINE_FILE="$STATE_DIR/mine.txt"
    [ -f "$MINE_FILE" ] || : >"$MINE_FILE"
}

is_mine() {
    grep -Fxq -- "$1" "$MINE_FILE" 2>/dev/null
}

add_mine() {
    ensure_state
    if is_mine "$1"; then
        printf 'already in the self-echo ledger: %s\n' "$1"
    else
        printf '%s\n' "$1" >>"$MINE_FILE"
        printf 'self-echo ledger += %s\n  (%s)\n' "$1" "$MINE_FILE"
    fi
}

# --------------------------------------------------------------------------- #
# one pass over one studio
# --------------------------------------------------------------------------- #

poll_recordings() {
    # $1 = studio name, $2 = base url, $3 = sanitized key
    name="$1"; base="$2"; key="$3"
    sizes_file="$STATE_DIR/$key.sizes"
    seen_file="$STATE_DIR/$key.seen"
    [ -f "$seen_file" ] || : >"$seen_file"

    if ! http_get "$base/recordings"; then
        printf '[%s] INJOIGNABLE %s : /recordings -- %s\n' "$(stamp)" "$name" "$(unreachable_reason)"
        printf '            this is NOT an empty studio. Nothing was learned about deposits.\n'
        return 1
    fi
    if [ "$HTTP_CODE" != "200" ]; then
        printf '[%s] INJOIGNABLE %s : /recordings answered HTTP %s -- not a list, not a clearance\n' \
            "$(stamp)" "$name" "$HTTP_CODE"
        return 1
    fi

    cur_file="$STATE_DIR/$key.sizes.new"
    if ! "$PYTHON" -c "$PY_RECORDINGS" <"$BODY_TMP" >"$cur_file" 2>/dev/null; then
        printf '[%s] INJOIGNABLE %s : /recordings answered HTTP 200 but not a JSON list\n' \
            "$(stamp)" "$name"
        rm -f "$cur_file"
        return 1
    fi

    count=$(wc -l <"$cur_file" | tr -d ' ')

    if [ ! -f "$sizes_file" ]; then
        cut -f1 <"$cur_file" >"$seen_file"
        mv "$cur_file" "$sizes_file"
        printf '[%s] AMORCE %s : %s enregistrement(s) connus, rien signale (premier passage)\n' \
            "$(stamp)" "$name" "$count"
        return 0
    fi

    if [ "$count" = "0" ]; then
        printf '[%s] VIDE %s : /recordings a repondu, liste de longueur 0.\n' "$(stamp)" "$name"
        printf '            Le portail a parle. Il n%sa rien. C%sest un constat, pas un feu vert.\n' "'" "'"
        mv "$cur_file" "$sizes_file"
        return 0
    fi

    while IFS="$(printf '\t')" read -r fname fsize; do
        [ -n "${fname:-}" ] || continue
        prev=$(awk -F'\t' -v f="$fname" '$1==f {print $2; exit}' "$sizes_file")
        if [ -z "${prev:-}" ]; then
            printf '[%s] ATTENTE %s : %s (%s octets) -- premiere vue, taille non confirmee\n' \
                "$(stamp)" "$name" "$fname" "$fsize"
            continue
        fi
        if [ "$prev" != "$fsize" ]; then
            printf '[%s] ATTENTE %s : %s (%s -> %s octets) -- encore en ecriture, pas de moov atom\n' \
                "$(stamp)" "$name" "$fname" "$prev" "$fsize"
            continue
        fi
        if grep -Fxq -- "$fname" "$seen_file" 2>/dev/null; then
            continue
        fi
        if is_mine "$fname"; then
            printf '%s\n' "$fname" >>"$seen_file"
            [ "$QUIET" = "1" ] || printf '[%s] ECHO %s : %s -- publie par nous, pas un depot\n' \
                "$(stamp)" "$name" "$fname"
            continue
        fi
        printf '%s\n' "$fname" >>"$seen_file"
        printf '[%s] DEPOT %s : %s (%s octets)\n' "$(stamp)" "$name" "$fname" "$fsize"
    done <"$cur_file"

    mv "$cur_file" "$sizes_file"
    return 0
}

poll_room() {
    # $1 = studio name, $2 = base url, $3 = key, $4 = slug
    name="$1"; base="$2"; key="$3"; slug="$4"
    skey="$key.$(sanitize "$slug")"
    sig_file="$STATE_DIR/$skey.sig"
    clips_file="$STATE_DIR/$skey.clips"

    if ! http_get "$base/api/compositions/$slug"; then
        printf '[%s] INJOIGNABLE %s : /api/compositions/%s -- %s\n' \
            "$(stamp)" "$name" "$slug" "$(unreachable_reason)"
        return 1
    fi
    if [ "$HTTP_CODE" != "200" ]; then
        printf '[%s] INJOIGNABLE %s : /api/compositions/%s answered HTTP %s\n' \
            "$(stamp)" "$name" "$slug" "$HTTP_CODE"
        return 1
    fi

    room_tmp="$STATE_DIR/$skey.room.new"
    if ! "$PYTHON" -c "$PY_ROOM" <"$BODY_TMP" >"$room_tmp" 2>/dev/null; then
        printf '[%s] INJOIGNABLE %s : %s answered HTTP 200 but not a composition object\n' \
            "$(stamp)" "$name" "$slug"
        rm -f "$room_tmp"
        return 1
    fi

    cur_sig=$(sed -n 's/^SIG //p' "$room_tmp")
    sed -n 's/^CLIP //p' "$room_tmp" | sort >"$STATE_DIR/$skey.clips.new"
    rm -f "$room_tmp"

    if [ ! -f "$sig_file" ]; then
        printf '%s\n' "$cur_sig" >"$sig_file"
        mv "$STATE_DIR/$skey.clips.new" "$clips_file"
        printf '[%s] AMORCE %s — %s : %s (premier passage)\n' "$(stamp)" "$name" "$slug" "$cur_sig"
        return 0
    fi

    prev_sig=$(cat "$sig_file")
    if [ "$cur_sig" = "$prev_sig" ]; then
        mv "$STATE_DIR/$skey.clips.new" "$clips_file"
        return 0
    fi

    [ -f "$clips_file" ] || : >"$clips_file"
    new_clips=$(comm -13 "$clips_file" "$STATE_DIR/$skey.clips.new" 2>/dev/null)

    # Was the only change a clip we published ourselves?
    prev_rest=$(printf '%s' "$prev_sig" | sed 's/clips=[0-9]*[[:space:]]*//')
    cur_rest=$(printf '%s' "$cur_sig" | sed 's/clips=[0-9]*[[:space:]]*//')
    all_ours=1
    any_new=0
    if [ -n "$new_clips" ]; then
        while IFS= read -r c; do
            [ -n "${c:-}" ] || continue
            any_new=1
            is_mine "$c" || all_ours=0
        done <<EOF
$new_clips
EOF
    fi

    if [ "$prev_rest" = "$cur_rest" ] && [ "$any_new" = "1" ] && [ "$all_ours" = "1" ]; then
        [ "$QUIET" = "1" ] || printf '[%s] ECHO %s — %s : %s → %s (nos propres clips)\n' \
            "$(stamp)" "$name" "$slug" "$prev_sig" "$cur_sig"
    else
        printf '[%s] SALLE %s — %s : %s → %s\n' "$(stamp)" "$name" "$slug" "$prev_sig" "$cur_sig"
        if [ -n "$new_clips" ]; then
            while IFS= read -r c; do
                [ -n "${c:-}" ] || continue
                if is_mine "$c"; then
                    printf '            + %s (nous)\n' "$c"
                else
                    printf '            + %s\n' "$c"
                fi
            done <<EOF2
$new_clips
EOF2
        fi
    fi

    printf '%s\n' "$cur_sig" >"$sig_file"
    mv "$STATE_DIR/$skey.clips.new" "$clips_file"
    return 0
}

poll_rooms() {
    name="$1"; base="$2"; key="$3"
    if ! http_get "$base/api/compositions"; then
        printf '[%s] INJOIGNABLE %s : /api/compositions -- %s\n' \
            "$(stamp)" "$name" "$(unreachable_reason)"
        return 1
    fi
    if [ "$HTTP_CODE" != "200" ]; then
        printf '[%s] INJOIGNABLE %s : /api/compositions answered HTTP %s\n' \
            "$(stamp)" "$name" "$HTTP_CODE"
        return 1
    fi
    slugs_file="$STATE_DIR/$key.slugs.new"
    if ! "$PYTHON" -c "$PY_SLUGS" <"$BODY_TMP" >"$slugs_file" 2>/dev/null; then
        printf '[%s] INJOIGNABLE %s : /api/compositions answered HTTP 200 but not a JSON list\n' \
            "$(stamp)" "$name"
        rm -f "$slugs_file"
        return 1
    fi
    nslugs=$(wc -l <"$slugs_file" | tr -d ' ')
    if [ "$nslugs" = "0" ]; then
        printf '[%s] VIDE %s : /api/compositions a repondu, aucune composition.\n' "$(stamp)" "$name"
        printf '            Constat, pas un feu vert.\n'
        rm -f "$slugs_file"
        return 0
    fi
    while IFS= read -r slug; do
        [ -n "${slug:-}" ] || continue
        poll_room "$name" "$base" "$key" "$slug"
    done <"$slugs_file"
    rm -f "$slugs_file"
    return 0
}

poll_studio() {
    name="$1"; base="$2"
    key=$(sanitize "$name")
    [ "$QUIET" = "1" ] || printf '[%s] --- %s  %s\n' "$(stamp)" "$name" "$base"
    poll_recordings "$name" "$base" "$key"
    poll_rooms "$name" "$base" "$key"
}

# --------------------------------------------------------------------------- #
# argument parsing
# --------------------------------------------------------------------------- #

MINE_ADD=""
MINE_LIST=0

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --once) ONCE=1; shift ;;
        --quiet) QUIET=1; shift ;;
        --interval) [ $# -ge 2 ] || die "--interval needs a value"; INTERVAL="$2"; shift 2 ;;
        --timeout) [ $# -ge 2 ] || die "--timeout needs a value"; TIMEOUT="$2"; shift 2 ;;
        --state-dir) [ $# -ge 2 ] || die "--state-dir needs a value"; STATE_DIR="$2"; shift 2 ;;
        --mine) [ $# -ge 2 ] || die "--mine needs a filename"; MINE_ADD="$2"; shift 2 ;;
        --mine-list) MINE_LIST=1; shift ;;
        --) shift; break ;;
        -*) die "unknown option: $1  (try --help)" ;;
        *) STUDIO_ARGS="$STUDIO_ARGS $1"; shift ;;
    esac
done
while [ $# -gt 0 ]; do
    STUDIO_ARGS="$STUDIO_ARGS $1"; shift
done

ensure_state

if [ -n "$MINE_ADD" ]; then
    add_mine "$MINE_ADD"
    exit 0
fi

if [ "$MINE_LIST" = "1" ]; then
    printf 'self-echo ledger: %s\n' "$MINE_FILE"
    if [ -s "$MINE_FILE" ]; then
        cat "$MINE_FILE"
    else
        printf '  (empty -- nothing published by this agent has been registered)\n'
    fi
    exit 0
fi

command -v curl >/dev/null 2>&1 || die "curl is required and was not found"
command -v "$PYTHON" >/dev/null 2>&1 || \
    die "$PYTHON is required to read the portal's JSON and was not found (set \$ATELIER_PYTHON)"

if [ -z "${STUDIO_ARGS# }" ]; then
    STUDIO_ARGS=$(printf '%s' "${ATELIER_STUDIOS:-}" | tr ',' ' ')
fi
if [ -z "$(printf '%s' "$STUDIO_ARGS" | tr -d ' ')" ]; then
    printf '%s: no studio given.\n' "$PROG" >&2
    printf '  Pass name=url pairs, or set $ATELIER_STUDIOS.\n' >&2
    printf '  This script will not guess a URL: a name and a port do not identify a\n' >&2
    printf '  service -- the triplet (host, port, code tree) does.\n' >&2
    exit 2
fi

for pair in $STUDIO_ARGS; do
    case "$pair" in
        *=*) : ;;
        *) die "studio '$pair' is not in name=url form" ;;
    esac
done

BODY_TMP=$(mktemp "${TMPDIR:-/tmp}/atelier-veille-body.XXXXXX") || die "mktemp failed"
ERR_TMP=$(mktemp "${TMPDIR:-/tmp}/atelier-veille-err.XXXXXX") || die "mktemp failed"
trap 'rm -f "$BODY_TMP" "$ERR_TMP"' EXIT INT TERM

printf '%s: veille sur' "$PROG"
for pair in $STUDIO_ARGS; do
    printf ' %s' "${pair%%=*}"
done
printf '  (etat: %s)\n' "$STATE_DIR"

while : ; do
    for pair in $STUDIO_ARGS; do
        poll_studio "${pair%%=*}" "${pair#*=}"
    done
    [ "$ONCE" = "1" ] && break
    sleep "$INTERVAL"
done

exit 0
