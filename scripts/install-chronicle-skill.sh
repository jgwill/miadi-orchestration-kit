#!/usr/bin/env bash
# install-chronicle-skill.sh — point every skill layer on this host at the ONE chronicle
# skill in this kit, instead of at a copy of it.
#
# THE PROBLEM THIS EXISTS FOR, measured on Gaia 2026-09-04:
#   /etc/claude-code/skills/chronicle-episode/SKILL.md   41398 bytes  md5 2383fba7…
#   ~/.agents/skills/chronicle-episode/SKILL.md           8973 bytes  md5 21032b87…
#   Two copies, one host, already diverged, neither declaring which is canonical. Nothing
#   reconciles them and the smaller one is what a non-Claude agent reads. Copies do not
#   stay equal; links cannot come apart.
#
# WHAT IT DOES
#   Replaces each host skill entry with a symlink to
#   $MIADI_ORCHESTRATION_KIT_ROOT/skills/chronicle-episode:
#     ~/.claude/skills/chronicle-episode     (Claude Code)
#     ~/.agents/skills/chronicle-episode     (Codex, Gemini, and the generic agent layer)
#   An existing REAL directory is moved to <name>.bak-<YYYYMMDD-HHMMSS>, never deleted —
#   deletion is a human's word. An existing symlink is replaced.
#   Registers the Claude Code plugin into $KIT/.claude-plugin/marketplace.json when that
#   file exists. It does not today; see --check output for why, and 05-distribution.md.
#
# WHAT IT REFUSES TO DO
#   Proceed on a host below the runtime floors. `claude/AGENTS.md` rule 3: a plugin
#   that quietly assumes a version misleads rather than refuses.
#
# MODES
#   --check     look only. Report every divergence and every floor. Never writes.
#   --dry-run   say exactly what would change, in the order it would change. Never writes.
#   (none)      do it, printing one line per action.
#   --help
#
# EXIT CODES — branch on these:
#   0  done / clean         all actions applied, or --check found nothing to repair
#   1  --check found drift  something is not pointing at the kit (nothing was written)
#   2  cannot proceed       kit root missing, skill body missing, HOME unwritable
#   3  runtime floor miss   passages / inquiry-weave / mkepisode below the declared floor
#
# TESTING
#   Point HOME at a scratch directory. Never test against a real ~/.claude or ~/.agents:
#       HOME=/tmp/scratch-home ./scripts/install-chronicle-skill.sh --dry-run

set -uo pipefail

# --- declared runtime floors ------------------------------------------------------------
FLOOR_PASSAGES="0.3.0"          # ep<NNN> resolution, `attention`
FLOOR_INQUIRY_WEAVE="0.8.0"

SKILL_NAME="chronicle-episode"
MODE="apply"

usage() { sed -n '2,45p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }

for arg in "$@"; do
  case "$arg" in
    --check)   MODE="check" ;;
    --dry-run) MODE="dry" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $arg (try --help)" >&2; exit 2 ;;
  esac
done

KIT="${MIADI_ORCHESTRATION_KIT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
KIT="${KIT%/}"
SRC="$KIT/skills/$SKILL_NAME"

DRIFT=0
say()  { printf '%s\n' "$*"; }
act()  { printf '  %s\n' "$*"; }
note() { printf '  · %s\n' "$*"; }
bad()  { printf '  ! %s\n' "$*" >&2; DRIFT=1; }

say "install-chronicle-skill · mode=$MODE"
say "  kit  $KIT"
say "  home $HOME"
say ""

# --- 0. the kit and the skill body must be there ----------------------------------------
[ -d "$KIT" ] || { echo "cannot proceed: kit root is not a directory: $KIT" >&2; exit 2; }
if [ ! -d "$SRC" ]; then
  echo "cannot proceed: skill body missing: $SRC" >&2
  echo "  This script links to the ONE skill at the kit root. It does not create it." >&2
  exit 2
fi
if [ ! -f "$SRC/SKILL.md" ]; then
  if [ "$MODE" = "apply" ]; then
    echo "cannot proceed: $SRC exists but holds no SKILL.md." >&2
    echo "  Linking hosts at an empty directory would make every harness load nothing" >&2
    echo "  and report success. Land the skill first." >&2
    exit 2
  fi
  bad "SKILL.md missing at $SRC — the directory is a placeholder, not a skill yet"
fi

# --- 1. runtime floors ------------------------------------------------------------------
# Version compare without sort -V surprises: pad each field and compare as integers.
vercmp_ge() {  # vercmp_ge HAVE WANT  -> 0 when HAVE >= WANT
  local h w; local -a H W
  IFS='.' read -r -a H <<< "${1%%-*}"
  IFS='.' read -r -a W <<< "${2%%-*}"
  for i in 0 1 2; do
    h=$(( 10#${H[i]:-0} )); w=$(( 10#${W[i]:-0} ))
    (( h > w )) && return 0
    (( h < w )) && return 1
  done
  return 0
}

say "preflight"
FLOOR_MISS=0
NPM_LS="$(npm ls -g --depth=0 passages @miadi/inquiry-weave 2>/dev/null)"

check_floor() {  # check_floor PKG FLOOR
  local pkg="$1" floor="$2" have
  have="$(printf '%s\n' "$NPM_LS" | sed -n "s/.*[[:space:]]${pkg//\//\\/}@\([0-9][0-9.]*\).*/\1/p" | head -1)"
  if [ -z "$have" ]; then
    printf '  ! %s not installed globally (floor %s)\n' "$pkg" "$floor" >&2
    FLOOR_MISS=1
    return
  fi
  if vercmp_ge "$have" "$floor"; then
    note "$pkg $have (floor $floor) ok"
  else
    printf '  ! %s %s is below the declared floor %s\n' "$pkg" "$have" "$floor" >&2
    FLOOR_MISS=1
  fi
}

check_floor "passages" "$FLOOR_PASSAGES"
check_floor "@miadi/inquiry-weave" "$FLOOR_INQUIRY_WEAVE"

if command -v mkepisode >/dev/null 2>&1; then
  MKHELP="$(mkepisode --help 2>&1)"
  if printf '%s' "$MKHELP" | grep -q -- '--adopt'; then
    note "mkepisode carries --adopt ok"
  else
    printf '  ! mkepisode has no --adopt: the one repair path for a manifest-less vessel\n' >&2
    FLOOR_MISS=1
  fi
else
  printf '  ! mkepisode not on PATH\n' >&2
  FLOOR_MISS=1
fi

if [ "$FLOOR_MISS" -ne 0 ]; then
  say ""
  echo "refusing: this host is below the declared runtime floors." >&2
  echo "  Fix with:  npm i -g passages@latest @miadi/inquiry-weave@latest" >&2
  echo "  Proceeding would install a skill layer that names commands this host cannot run." >&2
  exit 3
fi
say ""

# --- 2. the two skill layers ------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"

link_layer() {  # link_layer <dir>
  local dir="$1" dest="$1/$SKILL_NAME" cur
  say "$dir"

  if [ -L "$dest" ]; then
    cur="$(readlink -f "$dest" 2>/dev/null || true)"
    if [ "$cur" = "$SRC" ]; then
      note "already points at the kit — nothing to do"
      return 0
    fi
    bad "symlink points elsewhere: $(readlink "$dest")"
    case "$MODE" in
      check) return 0 ;;
      dry)   act "would replace the symlink -> $SRC"; return 0 ;;
    esac
    ln -sfn "$SRC" "$dest" && act "replaced symlink -> $SRC"
    return 0
  fi

  if [ -d "$dest" ]; then
    bad "a real directory sits here, not a link (a copy that can diverge)"
    case "$MODE" in
      check) return 0 ;;
      dry)   act "would move it to $dest.bak-$STAMP, then link -> $SRC"; return 0 ;;
    esac
    mv "$dest" "$dest.bak-$STAMP" && act "backed up to $dest.bak-$STAMP (not deleted)"
    ln -sfn "$SRC" "$dest" && act "linked -> $SRC"
    return 0
  fi

  if [ -e "$dest" ]; then
    bad "a file sits at $dest and is not a skill"
    case "$MODE" in
      check) return 0 ;;
      dry)   act "would move it to $dest.bak-$STAMP, then link -> $SRC"; return 0 ;;
    esac
    mv "$dest" "$dest.bak-$STAMP" && act "backed up to $dest.bak-$STAMP (not deleted)"
    ln -sfn "$SRC" "$dest" && act "linked -> $SRC"
    return 0
  fi

  bad "absent"
  case "$MODE" in
    check) return 0 ;;
    dry)   act "would create $dir if needed, then link -> $SRC"; return 0 ;;
  esac
  mkdir -p "$dir" || { echo "cannot proceed: $dir is not writable" >&2; exit 2; }
  ln -sfn "$SRC" "$dest" && act "linked -> $SRC"
}

link_layer "$HOME/.claude/skills"
say ""
link_layer "$HOME/.agents/skills"
say ""

# --- 3. plugin registration -------------------------------------------------------------
# Measured 2026-09-04: the kit's only marketplace file is .agents/plugins/marketplace.json,
# and `claude plugin validate` REJECTS it — it is a Codex marketplace (missing `owner`,
# `plugins[].source` in the Codex shape). Registering a Claude Code plugin there would
# produce an entry no Claude Code host can read. So this script writes only into a real
# Claude Code marketplace, and reports honestly when there is none.
CC_MARKET="$KIT/.claude-plugin/marketplace.json"
PLUGIN_REL="./claude/miadi-chronicle-episode-kit"
say "plugin registration"
if [ -f "$CC_MARKET" ]; then
  if python3 - "$CC_MARKET" "$PLUGIN_REL" <<'PY'
import json, sys
path, rel = sys.argv[1], sys.argv[2]
with open(path) as fh:
    m = json.load(fh)
plugins = m.setdefault("plugins", [])
name = "miadi-chronicle-episode-kit"
for p in plugins:
    if p.get("name") == name:
        sys.exit(1)   # already registered
plugins.append({"name": name, "source": rel})
with open(path, "w") as fh:
    json.dump(m, fh, indent=2)
    fh.write("\n")
sys.exit(0)
PY
  then act "registered in $CC_MARKET"
  else note "already registered in $CC_MARKET"
  fi
else
  note "no Claude Code marketplace at $CC_MARKET"
  note ".agents/plugins/marketplace.json is a CODEX marketplace — \`claude plugin validate\` rejects it"
  note "load the plugin directly meanwhile:"
  note "  claude --plugin-dir \"$KIT/claude/miadi-chronicle-episode-kit\""
fi
say ""

# --- 4. verdict --------------------------------------------------------------------------
case "$MODE" in
  check)
    if [ "$DRIFT" -ne 0 ]; then
      say "drift found. Nothing was written. Re-run without --check to repair."
      exit 1
    fi
    say "clean. Every skill layer points at $SRC."
    exit 0
    ;;
  dry)
    say "dry run. Nothing was written."
    exit 0
    ;;
  *)
    say "done."
    say "Verify:  readlink -f \"\$HOME/.claude/skills/$SKILL_NAME\""
    say "         python3 /etc/claude-code/skills/skills-reconcile.py"
    exit 0
    ;;
esac
