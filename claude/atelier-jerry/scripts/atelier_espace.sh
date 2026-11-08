#!/usr/bin/env bash
# atelier_espace.sh -- how much room is left on the human's device.
#
# The atelier lives on a phone. Recordings, compositions and movement captures all
# accumulate there, and the studio stops accepting deposits when the card fills.
# This reports what is taking the room. It NEVER deletes anything: it prints the
# cleanup commands it would suggest and leaves them for the human to run.
#
# NO HOST, PORT OR USER IS HARDCODED. The device comes from $1 or $ATELIER_DEVICE;
# the ssh port and user come from flags or the environment, and when they are not
# given the command is built without them so ~/.ssh/config decides -- which is the
# honest default, because a port typed from memory identifies nothing.
#
# TWO DISTINCT FAILURES, NEVER BLURRED
#   connection refused -> the host is reachable, sshd is NOT RUNNING inside Termux.
#                         Someone has to start it on the device.
#   timeout            -> the TAILNET PATH is down. sshd may be perfectly fine.
# They call for opposite actions, so this script names which one happened.

set -u

PROG="$(basename "$0")"

DEVICE="${ATELIER_DEVICE:-}"
SSH_USER="${ATELIER_SSH_USER:-}"
SSH_PORT="${ATELIER_SSH_PORT:-}"
SDCARD="${ATELIER_SDCARD:-/sdcard}"
MOVEDIR="${ATELIER_MOVEMENT_DIR:-}"          # empty = $HOME/movement-scores, resolved remotely
REC_GLOB="${ATELIER_REC_GLOB:-Recordings*}"
COMP_GLOB="${ATELIER_COMP_GLOB:-compositions-*}"
WARN_PERCENT="${ATELIER_WARN_PERCENT:-85}"
CONNECT_TIMEOUT="${ATELIER_SSH_CONNECT_TIMEOUT:-10}"
TOP_N="${ATELIER_TOP_N:-10}"
PRINT_REMOTE=0

usage() {
    cat <<'HELPTEXT'
atelier_espace.sh -- report space on the atelier's Android device, over ssh.

USAGE
    atelier_espace.sh [options] [host]

HOST
    From the positional argument, or $ATELIER_DEVICE. Nothing is hardcoded.
    The brief names the device as an Android phone reached over Termux ssh on
    port 8022 with user u0_a194 -- those are DOCUMENTED VALUES, not defaults in
    this script. Supply them with --ssh-port / --ssh-user, or (better) put them
    in ~/.ssh/config once and pass neither.

OPTIONS
    --ssh-user USER        default: $ATELIER_SSH_USER, else omitted (ssh config decides)
    --ssh-port PORT        default: $ATELIER_SSH_PORT, else omitted (ssh config decides)
                           Termux sshd does not listen on 22; the brief says 8022.
    --sdcard PATH          shared-storage root (default /sdcard, or $ATELIER_SDCARD)
    --movement-dir PATH    default: $HOME/movement-scores resolved ON THE DEVICE
    --rec-glob GLOB        recordings directories (default 'Recordings*', which
                           covers both Recordings-<workspace> and a bare Recordings)
    --comp-glob GLOB       composition workspaces (default 'compositions-*')
    --warn-percent N       flag a filesystem above N% used (default 85)
    --top N                how many largest files to list (default 10)
    --connect-timeout SEC  ssh connect timeout (default 10)
    --print-remote         print the script that WOULD run on the device, connect
                           to nothing, and exit. Use this to read it before you
                           ever point it at someone's phone.
    -h, --help             this text

WHAT IT REPORTS
    filesystem usage for the sdcard root and for the Termux home
    the size of every recordings directory
    the size of every composition workspace
    the N largest files under all of them
    the file count and total size of the movement-capture directory

WHAT IT DOES NOT DO
    It deletes nothing, moves nothing, and compresses nothing. It prints the
    commands it would suggest, under CLEANUP, for the human to run or not.

NOTE (unverified)
    The exact location of the composition workspaces on the device is not stated
    in the brief. This searches the sdcard root and the Termux home, one level
    deep. If they live elsewhere, pass --comp-glob with a fuller path pattern.
HELPTEXT
}

die() {
    printf '%s: %s\n' "$PROG" "$*" >&2
    exit 2
}

# single-quote a value for safe embedding in the remote /bin/sh script
sq() {
    printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

# kilobytes -> a size a human reads. Never rounds a real file down to zero.
human_k() {
    awk -v k="${1:-0}" 'BEGIN {
        if (k < 1024)          printf "%d Ko", k;
        else if (k < 1048576)  printf "%.1f Mo", k / 1024;
        else                   printf "%.2f Go", k / 1048576;
    }'
}

# --------------------------------------------------------------------------- #
# arguments
# --------------------------------------------------------------------------- #

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --ssh-user) [ $# -ge 2 ] || die "--ssh-user needs a value"; SSH_USER="$2"; shift 2 ;;
        --ssh-port) [ $# -ge 2 ] || die "--ssh-port needs a value"; SSH_PORT="$2"; shift 2 ;;
        --sdcard) [ $# -ge 2 ] || die "--sdcard needs a value"; SDCARD="$2"; shift 2 ;;
        --movement-dir) [ $# -ge 2 ] || die "--movement-dir needs a value"; MOVEDIR="$2"; shift 2 ;;
        --rec-glob) [ $# -ge 2 ] || die "--rec-glob needs a value"; REC_GLOB="$2"; shift 2 ;;
        --comp-glob) [ $# -ge 2 ] || die "--comp-glob needs a value"; COMP_GLOB="$2"; shift 2 ;;
        --warn-percent) [ $# -ge 2 ] || die "--warn-percent needs a value"; WARN_PERCENT="$2"; shift 2 ;;
        --top) [ $# -ge 2 ] || die "--top needs a value"; TOP_N="$2"; shift 2 ;;
        --connect-timeout) [ $# -ge 2 ] || die "--connect-timeout needs a value"; CONNECT_TIMEOUT="$2"; shift 2 ;;
        --print-remote) PRINT_REMOTE=1; shift ;;
        --) shift; break ;;
        -*) die "unknown option: $1  (try --help)" ;;
        *) DEVICE="$1"; shift ;;
    esac
done
[ $# -gt 0 ] && DEVICE="$1"

# --------------------------------------------------------------------------- #
# the remote script -- one round trip, plain /bin/sh, read-only
# --------------------------------------------------------------------------- #

build_remote() {
    printf 'SDCARD=%s\n' "$(sq "$SDCARD")"
    printf 'MOVEDIR=%s\n' "$(sq "$MOVEDIR")"
    printf 'REC_GLOB=%s\n' "$(sq "$REC_GLOB")"
    printf 'COMP_GLOB=%s\n' "$(sq "$COMP_GLOB")"
    printf 'TOP_N=%s\n' "$(sq "$TOP_N")"
    cat <<'REMOTE_BODY'
[ -n "$MOVEDIR" ] || MOVEDIR="$HOME/movement-scores"
LIST=""

echo "### HOME"
echo "HOMEDIR $HOME"

echo "### DF"
for m in "$SDCARD" "$HOME"; do
    [ -d "$m" ] || { echo "FS_ABSENT $m"; continue; }
    df -Pk "$m" 2>/dev/null | awk -v m="$m" 'NR==2 {p=$5; gsub("%","",p); print "FS", p, $2, $3, $4, m, $6}'
done

echo "### RECDIRS"
for d in "$SDCARD"/$REC_GLOB; do
    [ -d "$d" ] || continue
    du -sk "$d" 2>/dev/null | awk '{k=$1; $1=""; sub(/^ /,""); print "DIR", k, $0}'
    LIST="$LIST
$d"
done

echo "### COMPDIRS"
for base in "$SDCARD" "$HOME"; do
    for d in "$base"/$COMP_GLOB "$base"/*/$COMP_GLOB; do
        [ -d "$d" ] || continue
        case "
$LIST" in
            *"
$d") continue ;;
        esac
        du -sk "$d" 2>/dev/null | awk '{k=$1; $1=""; sub(/^ /,""); print "DIR", k, $0}'
        LIST="$LIST
$d"
    done
done

echo "### BIG"
if [ -n "$LIST" ]; then
    printf '%s\n' "$LIST" | while IFS= read -r d; do
        [ -n "$d" ] || continue
        find "$d" -type f -exec du -k {} + 2>/dev/null
    done | sort -rn | head -n "$TOP_N" | awk '{k=$1; $1=""; sub(/^ /,""); print "BIG", k, $0}'
fi

echo "### MOVEMENT"
if [ -d "$MOVEDIR" ]; then
    C=$(find "$MOVEDIR" -type f 2>/dev/null | wc -l | tr -d " ")
    K=$(du -sk "$MOVEDIR" 2>/dev/null | awk '{print $1}')
    echo "MOVE ${C:-0} ${K:-0} $MOVEDIR"
else
    echo "MOVE_ABSENT $MOVEDIR"
fi

echo "### END"
REMOTE_BODY
}

if [ "$PRINT_REMOTE" = "1" ]; then
    printf '# This is the read-only script that would run on the device.\n'
    printf '# It contains no rm, no mv, no truncate. Read it, then decide.\n'
    printf '# ---------------------------------------------------------------\n'
    build_remote
    exit 0
fi

[ -n "$DEVICE" ] || {
    printf '%s: no device given.\n' "$PROG" >&2
    printf '  Pass a host, or set $ATELIER_DEVICE.\n' >&2
    printf '  Use --print-remote to read what would run there without connecting.\n' >&2
    exit 2
}

command -v ssh >/dev/null 2>&1 || die "ssh is required and was not found"

TARGET="$DEVICE"
[ -n "$SSH_USER" ] && TARGET="$SSH_USER@$DEVICE"

SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=$CONNECT_TIMEOUT"
PORT_OPT=""
[ -n "$SSH_PORT" ] && PORT_OPT="-p $SSH_PORT"

ERR_TMP=$(mktemp "${TMPDIR:-/tmp}/atelier-espace-err.XXXXXX") || die "mktemp failed"
OUT_TMP=$(mktemp "${TMPDIR:-/tmp}/atelier-espace-out.XXXXXX") || die "mktemp failed"
trap 'rm -f "$ERR_TMP" "$OUT_TMP"' EXIT INT TERM

# --------------------------------------------------------------------------- #
# probe, and name the failure precisely
# --------------------------------------------------------------------------- #

# shellcheck disable=SC2086
ssh $SSH_OPTS $PORT_OPT "$TARGET" true >/dev/null 2>"$ERR_TMP"
PROBE_RC=$?

if [ "$PROBE_RC" != "0" ]; then
    ERR_TEXT=$(cat "$ERR_TMP" 2>/dev/null)
    printf 'ECHEC ssh %s' "$TARGET" >&2
    [ -n "$PORT_OPT" ] && printf ' (%s)' "$PORT_OPT" >&2
    printf '  -- exit %s\n' "$PROBE_RC" >&2
    printf '  %s\n' "$ERR_TEXT" >&2
    printf '\n' >&2
    case "$ERR_TEXT" in
        *[Rr]efused*)
            printf 'DIAGNOSTIC: CONNECTION REFUSED.\n' >&2
            printf '  The host is reachable. The port has nothing listening.\n' >&2
            printf '  On an Android/Termux node this means SSHD IS NOT RUNNING inside\n' >&2
            printf '  Termux. It has to be started ON THE DEVICE, by the human:\n' >&2
            printf '      sshd            # inside Termux\n' >&2
            printf '  Also check the Termux wakelock -- Android kills it otherwise.\n' >&2
            printf '  Note: Termux sshd does not listen on 22. If you passed no --ssh-port\n' >&2
            printf '  and your ssh config sets none, you probably knocked on 22.\n' >&2
            ;;
        *"timed out"*|*"Timeout"*|*"timeout"*|*"No route to host"*)
            printf 'DIAGNOSTIC: TIMEOUT / NO ROUTE.\n' >&2
            printf '  The TAILNET PATH is down. sshd on the device may be perfectly fine.\n' >&2
            printf '  Check the mesh before touching the phone:\n' >&2
            printf '      tailscale status\n' >&2
            printf '      tailscale ping %s\n' "$DEVICE" >&2
            printf '  If this host reaches the device through a gateway/forwarder, the\n' >&2
            printf '  forwarder for this peer is the first thing to check -- an undeclared\n' >&2
            printf '  peer does not travel.\n' >&2
            ;;
        *"Could not resolve"*|*"Name or service not known"*|*"nodename nor servname"*)
            printf 'DIAGNOSTIC: THE NAME DOES NOT RESOLVE.\n' >&2
            printf '  This is not a device failure. Check ~/.ssh/config first -- a stale\n' >&2
            printf '  HostName there beats /etc/hosts and sends you to the wrong node.\n' >&2
            ;;
        *"Permission denied"*)
            printf 'DIAGNOSTIC: AUTHENTICATION REFUSED.\n' >&2
            printf '  The path and sshd are fine. The key or the user is wrong.\n' >&2
            printf '  On Termux the account name is the Android app uid, not your name.\n' >&2
            printf '  Pass --ssh-user, or fix the identity in ~/.ssh/config.\n' >&2
            ;;
        *)
            printf 'DIAGNOSTIC: unclassified ssh failure. The two failures this script\n' >&2
            printf '  knows how to tell apart are "connection refused" (sshd not running\n' >&2
            printf '  in Termux) and "timed out" (tailnet path down). This was neither.\n' >&2
            ;;
    esac
    exit 2
fi

# --------------------------------------------------------------------------- #
# collect
# --------------------------------------------------------------------------- #

# shellcheck disable=SC2086
build_remote | ssh $SSH_OPTS $PORT_OPT "$TARGET" 'sh -s' >"$OUT_TMP" 2>"$ERR_TMP"
RUN_RC=$?

if [ "$RUN_RC" != "0" ]; then
    printf '%s: the remote report exited %s\n' "$PROG" "$RUN_RC" >&2
    printf '  %s\n' "$(cat "$ERR_TMP")" >&2
fi
if ! grep -q '^### END$' "$OUT_TMP"; then
    printf '%s: the remote report is TRUNCATED (no END marker).\n' "$PROG" >&2
    printf '  What follows is partial. Do not read a short list as an empty device.\n' >&2
fi

# --------------------------------------------------------------------------- #
# report
# --------------------------------------------------------------------------- #

HOMEDIR=$(awk '$1=="HOMEDIR" {print $2; exit}' "$OUT_TMP")

printf '\n== ESPACE  %s ==\n' "$TARGET"
[ -n "$PORT_OPT" ] && printf '   ssh %s\n' "$PORT_OPT"
printf '   sdcard=%s  termux home=%s  seuil=%s%%\n\n' "$SDCARD" "${HOMEDIR:-?}" "$WARN_PERCENT"

printf 'SYSTEMES DE FICHIERS\n'
FLAGGED=0
while read -r tag rest; do
    case "$tag" in
        FS)
            set -- $rest
            pct="$1"; total_k="$2"; used_k="$3"; avail_k="$4"; asked="$5"; mount="${6:-$5}"
            mark="  "
            if [ "$pct" -gt "$WARN_PERCENT" ] 2>/dev/null; then
                mark="!!"
                FLAGGED=$((FLAGGED + 1))
            fi
            printf '%s %-30s %3s%% utilise   %10s libres / %10s   (%s)\n' \
                "$mark" "$asked" "$pct" "$(human_k "$avail_k")" "$(human_k "$total_k")" "$mount"
            ;;
        FS_ABSENT)
            printf '   %-24s ABSENT sur le peripherique\n' "$rest"
            ;;
    esac
done <"$OUT_TMP"

printf '\nDOSSIERS D%sENREGISTREMENT (%s)\n' "'" "$REC_GLOB"
if ! awk '$1=="DIR"' "$OUT_TMP" >/dev/null 2>&1; then :; fi
REC_FOUND=0
IN=""
while IFS= read -r line; do
    case "$line" in
        "### RECDIRS") IN="rec"; continue ;;
        "### COMPDIRS") IN="comp"; continue ;;
        "### BIG") IN="big"; continue ;;
        "### "*) IN=""; continue ;;
    esac
    [ "$IN" = "rec" ] || continue
    case "$line" in
        DIR\ *)
            k=$(printf '%s' "$line" | awk '{print $2}')
            p=$(printf '%s' "$line" | cut -d' ' -f3-)
            printf '   %10s  %s\n' "$(human_k "$k")" "$p"
            REC_FOUND=$((REC_FOUND + 1))
            ;;
    esac
done <"$OUT_TMP"
[ "$REC_FOUND" = "0" ] && printf '   aucun dossier ne correspond a %s sous %s\n' "$REC_GLOB" "$SDCARD"

printf '\nESPACES DE COMPOSITION (%s)\n' "$COMP_GLOB"
COMP_FOUND=0
IN=""
while IFS= read -r line; do
    case "$line" in
        "### COMPDIRS") IN="comp"; continue ;;
        "### "*) IN=""; continue ;;
    esac
    [ "$IN" = "comp" ] || continue
    case "$line" in
        DIR\ *)
            k=$(printf '%s' "$line" | awk '{print $2}')
            p=$(printf '%s' "$line" | cut -d' ' -f3-)
            printf '   %10s  %s\n' "$(human_k "$k")" "$p"
            COMP_FOUND=$((COMP_FOUND + 1))
            ;;
    esac
done <"$OUT_TMP"
[ "$COMP_FOUND" = "0" ] && \
    printf '   aucun espace ne correspond. Leur emplacement exact est NON VERIFIE --\n   voir --comp-glob.\n'

printf '\n%s PLUS GROS FICHIERS\n' "$TOP_N"
BIG_FOUND=0
IN=""
while IFS= read -r line; do
    case "$line" in
        "### BIG") IN="big"; continue ;;
        "### "*) IN=""; continue ;;
    esac
    [ "$IN" = "big" ] || continue
    case "$line" in
        BIG\ *)
            k=$(printf '%s' "$line" | awk '{print $2}')
            p=$(printf '%s' "$line" | cut -d' ' -f3-)
            printf '   %10s  %s\n' "$(human_k "$k")" "$p"
            BIG_FOUND=$((BIG_FOUND + 1))
            ;;
    esac
done <"$OUT_TMP"
[ "$BIG_FOUND" = "0" ] && printf '   rien a lister (aucun dossier trouve, ou find indisponible)\n'

printf '\nCAPTURES DE MOUVEMENT\n'
MOVE_LINE=$(awk '$1=="MOVE" || $1=="MOVE_ABSENT"' "$OUT_TMP" | head -n 1)
case "$MOVE_LINE" in
    MOVE\ *)
        mc=$(printf '%s' "$MOVE_LINE" | awk '{print $2}')
        mk=$(printf '%s' "$MOVE_LINE" | awk '{print $3}')
        mp=$(printf '%s' "$MOVE_LINE" | cut -d' ' -f4-)
        printf '   %s fichiers, %s   %s\n' "$mc" "$(human_k "$mk")" "$mp"
        printf '   (un jeu par horodatage : .jsonl, .summary.json, .jsonl.take.json)\n'
        ;;
    MOVE_ABSENT\ *)
        printf '   absent : %s\n' "$(printf '%s' "$MOVE_LINE" | cut -d' ' -f2-)"
        ;;
    *)
        printf '   pas de reponse pour ce dossier\n'
        ;;
esac

# --------------------------------------------------------------------------- #
# cleanup: offered, never run
# --------------------------------------------------------------------------- #

printf '\nCLEANUP -- PROPOSE, JAMAIS EXECUTE\n'
printf '   Ce script ne supprime rien. Voici ce qu%sil suggererait ; c%sest au\n' "'" "'"
printf '   proprietaire du telephone de decider, et de le taper lui-meme.\n\n'
SSH_SHOW="ssh${PORT_OPT:+ $PORT_OPT} $TARGET"
printf '   # voir ce qui dort depuis plus de 30 jours, avant toute suppression\n'
printf '   %s "find %s/%s -type f -mtime +30 -exec du -k {} + | sort -rn | head -n 40"\n\n' \
    "$SSH_SHOW" "$SDCARD" "$REC_GLOB"
printf '   # sortir une prise du telephone au lieu de l%seffacer (elle reste a lui)\n' "'"
printf '   scp%s %s:%s/<dossier>/<fichier> ./\n\n' \
    "${SSH_PORT:+ -P $SSH_PORT}" "$TARGET" "$SDCARD"
printf '   # les captures de mouvement compressent tres bien (ce sont des jsonl)\n'
printf '   %s "gzip -k <chemin>/<tlid>.jsonl"\n\n' "$SSH_SHOW"
printf '   # rendus intermediaires seulement -- jamais une prise originale\n'
printf '   %s "ls -l <espace-de-composition>/render*"\n\n' "$SSH_SHOW"
printf '   Regle de la maison : une prise originale de sa voix ne se supprime pas a\n'
printf '   sa place, et ne se copie pas hors du telephone sans son mot.\n'

if [ "$FLAGGED" -gt 0 ]; then
    printf '\n!! %s systeme(s) de fichiers au-dessus de %s%%.\n' "$FLAGGED" "$WARN_PERCENT"
    exit 1
fi
printf '\nRien au-dessus de %s%%.\n' "$WARN_PERCENT"
exit 0
