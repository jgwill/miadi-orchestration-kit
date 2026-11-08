#!/usr/bin/env bash
# atelier_render.sh -- the render chain of the atelier.
#
#   ABC --abc2midi--> MIDI --fluidsynth--> WAV --ffmpeg--> M4A
#                      \--abcm2ps--> SVG --rsvg-convert--> PNG --convert--> columns
#
# THREE RULES THAT WERE PAID FOR
#
#   1. abc2midi EXITS 0 EVEN WHEN IT COMPLAINS. Verified on this host: a file
#      with an out-of-sequence voice and wrong bar lengths prints "Warning",
#      writes the .mid, and returns 0. An exit status is therefore NOT a quality
#      check -- you have to READ what it printed. This script fails loudly on any
#      line containing "error".
#   2. A PIPELINE HIDES THE EXIT. `abc2midi ... | tee` returns tee's status, not
#      abc2midi's, and a filter truncates the evidence you needed. Nothing here
#      is piped: every tool writes a log, and the log is read back afterwards.
#   3. RUNTIME FLOORS ARE DECLARED AND CHECKED UP FRONT. A plugin that silently
#      assumes a binary misleads instead of refusing (lane rule).
#
# USAGE
#   atelier_render.sh <file.abc|-> [--outdir DIR] [--no-audio] [--score]
#
#     -            read the ABC from standard input
#     --outdir DIR where to put the render (default: the source's directory)
#     --no-audio   stop at the MIDI -- no WAV, no M4A
#     --score      also engrave: SVG, PNG, and the column tiling for pieces too
#                  tall to read on a screen
#
# ENVIRONMENT
#   ATELIER_SOUNDFONT    path to a .sf2; otherwise the first hit of the search
#                        list printed by --help
#   ATELIER_GAIN         fluidsynth gain (default 0.8; fluidsynth's own default
#                        of 0.2 renders needlessly quiet files)
#   ATELIER_SAMPLE_RATE  sample rate (default 44100)
#   ATELIER_SCORE_DPI    score PNG resolution (default 144)
#   ATELIER_NO_M4A       set to 1 to skip the AAC encode, when only the WAV is
#                        wanted -- this is what atelier_timbre.py uses
#
# NO PATH IS HARDCODED: source, output and soundfont all come from an argument
# or from the environment. The soundfont list below is a documented FALLBACK
# search, not a silent assumption, and it is printed in full when nothing is
# found.

set -euo pipefail

PROG=$(basename "$0")

# ── soundfont search list, in order ────────────────────────────────────────
SOUNDFONT_SEARCH=(
  /usr/share/sounds/sf2/FluidR3_GM.sf2
  /usr/share/sounds/sf2/default-GM.sf2
  /usr/share/sounds/sf2/TimGM6mb.sf2
  /usr/share/soundfonts/FluidR3_GM.sf2
  /usr/share/soundfonts/default.sf2
  /usr/local/share/sounds/sf2/FluidR3_GM.sf2
  /usr/local/share/soundfonts/FluidR3_GM.sf2
  "${HOME}/.local/share/soundfonts/FluidR3_GM.sf2"
)

die()  { printf '%s: %s\n' "$PROG" "$*" >&2; exit 1; }
note() { printf '  %s\n' "$*" >&2; }
step() { printf '. %s\n' "$*" >&2; }

usage() {
  sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'
  printf '\nSoundfont search list:\n'
  printf '  %s\n' "${SOUNDFONT_SEARCH[@]}"
}

# ── a binary, or a refusal that says what to install ───────────────────────
need_bin() {
  local bin=$1 pkg=$2
  command -v "$bin" >/dev/null 2>&1 || die \
"missing binary: \"$bin\".
  Install it: $pkg
  This script refuses rather than producing a partial artifact -- a plugin that
  assumes a binary misleads instead of refusing."
}

# ═══════════════════════════════════════════════════════════════════════════
#  arguments
# ═══════════════════════════════════════════════════════════════════════════
SRC=""; OUTDIR=""; DO_AUDIO=1; DO_SCORE=0

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)   usage; exit 0 ;;
    --outdir)    [ $# -ge 2 ] || die "--outdir wants a directory"; OUTDIR=$2; shift 2 ;;
    --outdir=*)  OUTDIR=${1#*=}; shift ;;
    --no-audio)  DO_AUDIO=0; shift ;;
    --score)     DO_SCORE=1; shift ;;
    --)          shift ;;
    -)           [ -z "$SRC" ] || die "one source at a time"; SRC="-"; shift ;;
    -*)          die "unknown option \"$1\"; try $PROG --help" ;;
    *)           [ -z "$SRC" ] || die "one source at a time (\"$SRC\" then \"$1\")"
                 SRC=$1; shift ;;
  esac
done

[ -n "$SRC" ] || { usage >&2; die "no ABC source given"; }

# ── the source ────────────────────────────────────────────────────────────
RUNDIR=$(mktemp -d "${TMPDIR:-/var/tmp}/atelier-render.XXXXXX")
cleanup() { rm -rf "$RUNDIR"; }
trap cleanup EXIT

if [ "$SRC" = "-" ]; then
  SRC="$RUNDIR/stdin.abc"
  cat > "$SRC"
  [ -s "$SRC" ] || die "standard input was empty"
  BASE="stdin"
  [ -n "$OUTDIR" ] || OUTDIR=$PWD
else
  [ -f "$SRC" ] || die "source not found: $SRC"
  BASE=$(basename "$SRC"); BASE=${BASE%.*}
  [ -n "$OUTDIR" ] || OUTDIR=$(cd "$(dirname "$SRC")" && pwd)
fi

mkdir -p "$OUTDIR"
OUTDIR=$(cd "$OUTDIR" && pwd)

MID="$OUTDIR/$BASE.mid"
WAV="$OUTDIR/$BASE.wav"
M4A="$OUTDIR/$BASE.m4a"
LOG="$RUNDIR/log"

# ── runtime floors, declared up front ─────────────────────────────────────
need_bin abc2midi "apt install abcmidi"
if [ "$DO_AUDIO" -eq 1 ]; then
  need_bin fluidsynth "apt install fluidsynth fluid-soundfont-gm"
  need_bin ffprobe    "apt install ffmpeg   (ffprobe ships with it)"
  if [ "${ATELIER_NO_M4A:-0}" != "1" ]; then
    need_bin ffmpeg "apt install ffmpeg"
  fi
fi
if [ "$DO_SCORE" -eq 1 ]; then
  need_bin abcm2ps      "apt install abcm2ps"
  need_bin rsvg-convert "apt install librsvg2-bin"
  need_bin convert      "apt install imagemagick"
  need_bin identify     "apt install imagemagick"
fi

# ═══════════════════════════════════════════════════════════════════════════
#  1. ABC -> MIDI.  The exit status is not enough: we read what it printed.
# ═══════════════════════════════════════════════════════════════════════════
step "abc2midi -> $(basename "$MID")"
rc=0
abc2midi "$SRC" -o "$MID" > "$LOG" 2>&1 || rc=$?

if [ "$rc" -ne 0 ]; then
  printf '%s: abc2midi failed (exit %d). What it said:\n' "$PROG" "$rc" >&2
  sed 's/^/  | /' "$LOG" >&2
  exit 1
fi

# ── THE CHECK THAT MATTERS: abc2midi returns 0 while printing its errors. ──
if grep -n -i 'error' "$LOG" > "$RUNDIR/errors" 2>/dev/null; then
  printf '%s: abc2midi printed errors and still returned 0 --\n' "$PROG" >&2
  printf '  which is exactly why this check exists:\n' >&2
  sed 's/^/  | /' "$RUNDIR/errors" >&2
  printf '\n  Full log:\n' >&2
  sed 's/^/  | /' "$LOG" >&2
  rm -f "$MID"
  exit 1
fi

[ -s "$MID" ] || die "abc2midi wrote nothing to $MID"

NWARN=$(grep -c -i 'warning' "$LOG" || true)
if [ "${NWARN:-0}" -gt 0 ]; then
  note "abc2midi: ${NWARN} warning(s) -- not fatal, but read them:"
  grep -i 'warning' "$LOG" | sed 's/^/    | /' >&2
fi

# ═══════════════════════════════════════════════════════════════════════════
#  2. MIDI -> WAV -> M4A
# ═══════════════════════════════════════════════════════════════════════════
DURATION=""
if [ "$DO_AUDIO" -eq 1 ]; then
  SF="${ATELIER_SOUNDFONT:-}"
  if [ -z "$SF" ]; then
    for cand in "${SOUNDFONT_SEARCH[@]}"; do
      if [ -r "$cand" ]; then SF=$cand; break; fi
    done
  fi
  if [ -z "$SF" ] || [ ! -r "$SF" ]; then
    printf '%s: no soundfont found.\n' "$PROG" >&2
    printf '  Give one: ATELIER_SOUNDFONT=/path/to/bank.sf2\n' >&2
    printf '  Or install one: apt install fluid-soundfont-gm\n' >&2
    printf '  Search list tried, in order:\n' >&2
    printf '    %s\n' "${SOUNDFONT_SEARCH[@]}" >&2
    exit 1
  fi

  step "fluidsynth ($(basename "$SF")) -> $(basename "$WAV")"
  rc=0
  fluidsynth -ni \
    -F "$WAV" \
    -r "${ATELIER_SAMPLE_RATE:-44100}" \
    -g "${ATELIER_GAIN:-0.8}" \
    "$SF" "$MID" > "$LOG" 2>&1 || rc=$?
  if [ "$rc" -ne 0 ] || [ ! -s "$WAV" ]; then
    printf '%s: fluidsynth failed (exit %d).\n' "$PROG" "$rc" >&2
    sed 's/^/  | /' "$LOG" >&2
    exit 1
  fi

  DURATION=$(ffprobe -v error -show_entries format=duration \
                     -of default=noprint_wrappers=1:nokey=1 "$WAV" 2>/dev/null || true)

  if [ "${ATELIER_NO_M4A:-0}" = "1" ]; then
    M4A=""
  else
    step "ffmpeg (aac 192k) -> $(basename "$M4A")"
    rc=0
    ffmpeg -y -v error -i "$WAV" -c:a aac -b:a 192k "$M4A" > "$LOG" 2>&1 || rc=$?
    if [ "$rc" -ne 0 ] || [ ! -s "$M4A" ]; then
      printf '%s: ffmpeg failed (exit %d).\n' "$PROG" "$rc" >&2
      sed 's/^/  | /' "$LOG" >&2
      exit 1
    fi
  fi
else
  WAV=""; M4A=""
fi

# ═══════════════════════════════════════════════════════════════════════════
#  3. THE SCORE.  -k 8192: abcm2ps overflows on long single-staff pieces and
#     the message is not helpful. The margin is given up front rather than
#     discovered.
# ═══════════════════════════════════════════════════════════════════════════
SCORES=()
if [ "$DO_SCORE" -eq 1 ]; then
  PREFIX="$OUTDIR/${BASE}_p"
  rm -f "${PREFIX}"[0-9]*.svg
  step "abcm2ps -q -g -k 8192 -> ${BASE}_pNNN.svg"
  rc=0
  abcm2ps -q -g -k 8192 -O "$PREFIX" "$SRC" > "$LOG" 2>&1 || rc=$?
  if [ "$rc" -ne 0 ]; then
    printf '%s: abcm2ps failed (exit %d). What it said:\n' "$PROG" "$rc" >&2
    sed 's/^/  | /' "$LOG" >&2
    printf '  Reminder: "Note too much dotted" means an impossible figure\n' >&2
    printf '  (z5, C9, C10, C11...). Go through atelier_abc.rest() / tied_note().\n' >&2
    exit 1
  fi
  # abcm2ps chatter is shown, not swallowed. Two lines are known and harmless
  # when a voice uses clef=perc: "Symbol 'pnthd' not defined" and "svg close:
  # stack not empty" -- SVG percussion note heads. The page still renders.
  if [ -s "$LOG" ]; then sed 's/^/    | /' "$LOG" >&2; fi

  DPI=${ATELIER_SCORE_DPI:-144}
  shopt -s nullglob
  for svg in "${PREFIX}"[0-9]*.svg; do
    png="${svg%.svg}.png"
    rsvg-convert -f png -d "$DPI" -p "$DPI" -o "$png" "$svg" \
      || die "rsvg-convert failed on $svg"
    SCORES+=("$png")

    # ── column tiling: a long piece comes out as a strip too tall to read on a
    #    screen. Cut it into c slices and set them side by side, aiming for a
    #    wide ratio of about 1.4.
    # `identify -format '%w %h'` prints NO trailing newline, so `read` sees EOF
    # and returns 1 -- which under `set -e` kills the script after the PNG has
    # already been written. Capture into one variable instead.
    dims=$(identify -format '%w %h' "$png" 2>/dev/null || echo '0 0')
    w=${dims%% *}; h=${dims##* }
    cols=$(awk -v w="$w" -v h="$h" 'BEGIN{
      if (w<=0 || h<=0) { print 1; exit }
      c = int(sqrt(1.4*h/w) + 0.5);
      if (c < 1) c = 1; if (c > 4) c = 4;
      print c }')
    if [ "${cols:-1}" -gt 1 ]; then
      colpng="${svg%.svg}-columns.png"
      convert "$png" -crop "1x${cols}@" +repage -background white +append "$colpng" \
        || die "convert failed tiling $png"
      SCORES+=("$colpng")
      note "tiled: $(basename "$png") ${w}x${h} -> $cols columns"
    fi
  done
  shopt -u nullglob
  [ ${#SCORES[@]} -gt 0 ] || die "abcm2ps produced no page (prefix $PREFIX)"
fi

# ═══════════════════════════════════════════════════════════════════════════
#  4. What was built
# ═══════════════════════════════════════════════════════════════════════════
printf '%s\n' '' '-- atelier_render ---------------------------------------------'
printf '  source     %s\n' "$SRC"
printf '  midi       %s\n' "$MID"
[ -n "$WAV" ] && printf '  wav        %s\n' "$WAV"
[ -n "$M4A" ] && printf '  m4a        %s\n' "$M4A"
if [ ${#SCORES[@]} -gt 0 ]; then
  for p in "${SCORES[@]}"; do printf '  score      %s\n' "$p"; done
fi
if [ -n "$DURATION" ]; then
  printf '  duration   %s\n' "$(awk -v d="$DURATION" 'BEGIN{
      m=int(d/60); s=d-60*m; printf "%d min %05.2f s  (%.2f s)", m, s, d }')"
else
  printf '  duration   not measured (%s)\n' \
    "$([ "$DO_AUDIO" -eq 1 ] && echo 'ffprobe silent' || echo '--no-audio')"
fi
printf '%s\n' '---------------------------------------------------------------'
