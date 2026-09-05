#!/usr/bin/env bash
# guard-mkdir-in-chronicle.sh — PreToolUse(Bash) guard: episode vessels are born by
# mkepisode, never by mkdir.
#
# WHY THIS IS A HOOK AND NOT A SENTENCE
#   Measured on the Chronicle side (jgwill/miadi-orchestration-kit#41): 63 of 172 episode
#   directories carry no episode.yaml. They were born by hand. Lineage cannot be authored
#   on them and /chronicle cannot render them — both read the manifest — while the medicine
#   wheel derives a card from the directory NAME alone and reports them healthy. Guidance
#   forbidding this has been in place for months and the count rose. A hook does not need
#   to be read.
#
# WHAT IT BLOCKS, precisely
#   A command that would bring a NEW DIRECT CHILD of $MIADI_CHRONICLE_ROOT into existence:
#     mkdir / mkdir -p / install -d   with a target under the root
#     >  or  >>                       redirecting into a path whose missing ancestor is a
#                                     direct child of the root
#   The test is the TOPMOST MISSING ANCESTOR of the target. If that ancestor's parent is
#   the chronicle root, the command is minting an episode vessel by hand: blocked.
#
# WHAT IT DELIBERATELY ALLOWS
#   mkdir inside an episode that ALREADY EXISTS (rooms/, assets/, passages/ … ) — that is
#   ordinary work inside a vessel that already has a manifest, and blocking it would make
#   the guard something people switch off.
#   Everything outside $MIADI_CHRONICLE_ROOT. Every non-Bash tool. Every read.
#   Creating the chronicle root itself (bootstrapping a host is not minting an episode).
#
# ENVIRONMENT
#   MIADI_CHRONICLE_ROOT   the chronicle. Read from the environment, never a literal —
#                          it is /srv/miadi/episodes/miadi-chronicle on Gaia and
#                          /data/data/com.termux/files/srv/miadi/episodes/miadi-chronicle
#                          on Ilex. UNSET means this host has no chronicle: the guard says
#                          so on stderr and gets out of the way. A guard that blocks when
#                          it cannot see is a guard people disable.
#   MIADI_CHRONICLE_MW_URL the wheel, quoted back in the refusal so the repair is complete.
#
# INPUT   PreToolUse hook JSON on stdin: {"tool_name":"Bash","tool_input":{"command":...},
#         "cwd":...}. Contract source: Claude Code hook documentation (plugin-dev
#         hook-development skill, read 2026-09-04) and claude-code/miette/hooks/hooks.json,
#         the working hook already in this repo.
#
# EXIT CODES — branch on these, never on "it printed something":
#   0  allow    — no opinion. Not Bash, no chronicle root, nothing under it, or the
#                 directory being created lives inside an episode that already exists.
#   2  BLOCK    — refusal text on stderr, fed back to the model by Claude Code.
#   0  (also)   — every internal failure: unparseable JSON, no python3. A guard that
#                 cannot parse must not become a guard that cannot be worked around.
#
# SELFTEST   ./hooks/selftest.sh — four fixtures, one per branch above.

set -uo pipefail

PAYLOAD="$(cat)"

ROOT="${MIADI_CHRONICLE_ROOT:-}"
if [ -z "$ROOT" ]; then
  echo "guard-mkdir-in-chronicle: MIADI_CHRONICLE_ROOT is unset — this host declares no" >&2
  echo "  chronicle, so there is nothing to guard. Not blocking. Export it if this host" >&2
  echo "  does hold one; the guard reads the variable and never a literal path." >&2
  exit 0
fi
ROOT="${ROOT%/}"

command -v python3 >/dev/null 2>&1 || {
  echo "guard-mkdir-in-chronicle: python3 not found; cannot parse the hook payload. Not blocking." >&2
  exit 0
}

# Emit one "KIND<TAB>ABSOLUTE-PATH" line per directory-creating target in the command.
# shlex handles the quoting; expandvars/expanduser resolve $MIADI_CHRONICLE_ROOT and ~
# without ever handing the string to a shell.
CANDIDATES="$(printf '%s' "$PAYLOAD" | python3 -c '
import json, os, shlex, sys

try:
    p = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if p.get("tool_name") != "Bash":
    sys.exit(0)
cmd = (p.get("tool_input") or {}).get("command") or ""
cwd = p.get("cwd") or os.getcwd()

try:
    toks = shlex.split(cmd, comments=True)
except ValueError:
    toks = cmd.split()

BREAK = {"&&", "||", ";", "|", "&", "(", ")", "{", "}"}

def absolutise(raw):
    q = os.path.expanduser(os.path.expandvars(raw))
    if not q:
        return None
    return q if os.path.isabs(q) else os.path.normpath(os.path.join(cwd, q))

out = []
i = 0
while i < len(toks):
    t = toks[i]
    base = os.path.basename(t)
    if base in ("mkdir", "install"):
        makes_dir = base == "mkdir"
        j = i + 1
        while j < len(toks):
            a = toks[j]
            if a in BREAK:
                break
            if a.startswith("-"):
                if base == "install" and ("d" in a.lstrip("-") or a == "--directory"):
                    makes_dir = True
                j += 1
                continue
            if a.startswith(">"):
                break
            if makes_dir:
                out.append(("mkdir" if base == "mkdir" else "install -d", a))
            j += 1
        i = j
        continue
    if t.startswith(">"):
        tail = t.lstrip(">")
        if tail:
            out.append(("redirect", tail))
        elif i + 1 < len(toks) and toks[i + 1] not in BREAK:
            out.append(("redirect", toks[i + 1]))
            i += 1
    i += 1

for kind, raw in out:
    a = absolutise(raw)
    if a:
        print(kind + "\t" + a)
' 2>/dev/null)" || CANDIDATES=""

[ -n "$CANDIDATES" ] || exit 0

# The topmost ancestor of PATH that does not yet exist. Empty when the path exists.
topmost_missing() {
  local p="${1%/}" last=""
  while [ -n "$p" ] && [ "$p" != "/" ]; do
    if [ -e "$p" ]; then break; fi
    last="$p"
    p="$(dirname "$p")"
  done
  printf '%s' "$last"
}

HITS=""
while IFS=$'\t' read -r KIND TARGET; do
  [ -n "${TARGET:-}" ] || continue
  # A redirect creates a file; the directory it needs is its parent.
  DIRTARGET="$TARGET"
  [ "$KIND" = "redirect" ] && DIRTARGET="$(dirname "$TARGET")"
  case "$DIRTARGET" in
    "$ROOT"/*) ;;
    *) continue ;;
  esac
  MISSING="$(topmost_missing "$DIRTARGET")"
  [ -n "$MISSING" ] || continue                      # already exists: ordinary work
  [ "$(dirname "$MISSING")" = "$ROOT" ] || continue  # deeper inside an existing vessel
  HITS="${HITS}    ${KIND}  ->  ${MISSING}"$'\n'
done <<< "$CANDIDATES"

[ -n "$HITS" ] || exit 0

MW="${MIADI_CHRONICLE_MW_URL:-${MW_API_URL:-http://127.0.0.1:8040}}"

{
  echo "Refused: episode vessels are born by mkepisode, never mkdir."
  echo
  echo "  This command would create a new episode directory directly under"
  echo "  MIADI_CHRONICLE_ROOT=${ROOT}:"
  echo
  printf '%s' "$HITS"
  echo "  A directory born this way resolves by number but carries no episode.yaml."
  echo "  Lineage cannot be authored on it and /chronicle cannot render it — both read"
  echo "  the manifest. The medicine wheel does NOT: it derives a card from the directory"
  echo "  name alone, so a hand-made vessel registers, returns 200, and looks healthy"
  echo "  while staying unreadable to everything else. 63 of 172 episodes are in that"
  echo "  state already."
  echo
  echo "  Mint it instead:"
  echo
  echo "    mkepisode -n <N> -t \"<title>\" -g \"<goal>\" -r \"owner/repo#N\" \\"
  echo "      --register \"\${MIADI_CHRONICLE_MW_URL:-${MW}}\""
  echo
  echo "  If the directory already holds work and only the manifest is missing, adopt it"
  echo "  rather than starting over — adoption keeps the directory's own date, number and"
  echo "  slug and changes nothing already there:"
  echo
  echo "    mkepisode --adopt -n <N> -t \"<title>\" -g \"<goal>\" -r \"owner/repo#N\" \\"
  echo "      --status \"<what the work actually is>\" --register \"\${MIADI_CHRONICLE_MW_URL:-${MW}}\""
  echo
  echo "  Creating directories INSIDE an episode that already exists is not blocked."
} >&2

exit 2
