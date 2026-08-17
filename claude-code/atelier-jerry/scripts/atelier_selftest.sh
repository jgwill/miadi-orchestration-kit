#!/usr/bin/env bash
# atelier_selftest.sh — prove the plugin is whole before anyone depends on it.
#
# Runs from anywhere. Exits 0 only when every declared part exists, parses, and
# answers. Prints a claimed-versus-found table, because a count that comes out
# right is not proof — the same rule the plugin applies to music.
#
#   ./atelier_selftest.sh            everything
#   ./atelier_selftest.sh --quick    structure and syntax only, no rendering
#
# It never touches a network, a studio, or a person's device.

set -u

ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
QUICK=0
[ "${1:-}" = "--quick" ] && QUICK=1

PASS=0
FAIL=0
SKIP=0

ok()   { printf '  \033[32mok\033[0m    %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; [ -n "${2:-}" ] && printf '        %s\n' "$2"; FAIL=$((FAIL+1)); }
skip() { printf '  --    %s (%s)\n' "$1" "$2"; SKIP=$((SKIP+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

PY="$(command -v python3 || true)"
[ -n "$PY" ] || { echo "python3 is required to run this self-test"; exit 2; }

# ── 1. structure ────────────────────────────────────────────────────────────
head_ "structure — every declared part exists"

for f in \
  ".claude-plugin/plugin.json" \
  "README.md" \
  "hooks/hooks.json" \
  "hooks/consent-guard.py" \
  "hooks/atelier-status.py"
do
  [ -f "$ROOT/$f" ] && ok "$f" || bad "$f" "missing"
done

for d in skills agents commands scripts hooks; do
  n=$(find "$ROOT/$d" -type f 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" -gt 0 ] && ok "$d/ — $n file(s)" || bad "$d/" "empty"
done

# ── 2. json ─────────────────────────────────────────────────────────────────
head_ "json — manifests parse"
for j in "$ROOT/.claude-plugin/plugin.json" "$ROOT/hooks/hooks.json"; do
  if [ -f "$j" ]; then
    if "$PY" -m json.tool "$j" >/dev/null 2>&1; then ok "$(basename "$j")"
    else bad "$(basename "$j")" "does not parse"; fi
  fi
done

if [ -f "$ROOT/.claude-plugin/plugin.json" ]; then
  name=$("$PY" -c "import json,sys;print(json.load(open(sys.argv[1])).get('name',''))" "$ROOT/.claude-plugin/plugin.json" 2>/dev/null)
  [ "$name" = "atelier-jerry" ] && ok "plugin name is atelier-jerry" || bad "plugin name" "got '$name'"
fi

# ── 3. frontmatter ──────────────────────────────────────────────────────────
head_ "frontmatter — skills, agents and commands declare themselves"

"$PY" - "$ROOT" <<'PYEOF'
import glob, os, sys
root = sys.argv[1]
bad = 0

def block(path):
    t = open(path, encoding="utf-8").read()
    if not t.startswith("---\n"):
        return None
    try:
        return t[4:t.index("\n---", 4)]
    except ValueError:
        return None

for p in sorted(glob.glob(os.path.join(root, "skills", "*", "SKILL.md"))):
    fm = block(p)
    d = os.path.basename(os.path.dirname(p))
    if fm is None:
        print("  \033[31mFAIL\033[0m  skills/%s — no frontmatter" % d); bad += 1; continue
    named = [l for l in fm.splitlines() if l.startswith("name:")]
    n = named[0].split(":", 1)[1].strip() if named else ""
    if "description:" not in fm:
        print("  \033[31mFAIL\033[0m  skills/%s — no description" % d); bad += 1
    elif n != d:
        print("  \033[31mFAIL\033[0m  skills/%s — name '%s' does not match directory" % (d, n)); bad += 1
    else:
        print("  \033[32mok\033[0m    skills/%s" % d)

for kind in ("agents", "commands"):
    for p in sorted(glob.glob(os.path.join(root, kind, "*.md"))):
        fm = block(p)
        f = os.path.basename(p)
        if fm is None or "description:" not in fm:
            print("  \033[31mFAIL\033[0m  %s/%s — frontmatter or description missing" % (kind, f)); bad += 1
        else:
            print("  \033[32mok\033[0m    %s/%s" % (kind, f))

sys.exit(1 if bad else 0)
PYEOF
if [ $? -eq 0 ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

# ── 4. syntax ───────────────────────────────────────────────────────────────
head_ "syntax — every script parses"
for f in "$ROOT"/scripts/*.py "$ROOT"/hooks/*.py; do
  [ -e "$f" ] || continue
  if "$PY" -c "import ast,sys;ast.parse(open(sys.argv[1],encoding='utf-8').read())" "$f" 2>/dev/null
  then ok "$(basename "$f")"; else bad "$(basename "$f")" "syntax error"; fi
done
for f in "$ROOT"/scripts/*.sh; do
  [ -e "$f" ] || continue
  if bash -n "$f" 2>/dev/null; then ok "$(basename "$f")"; else bad "$(basename "$f")" "syntax error"; fi
done

# ── 5. portability ──────────────────────────────────────────────────────────
head_ "portability — no machine-local path escaped into code"
hits=$(grep -rnE "['\"](/home/|/tmp/|/workspace/)" \
        "$ROOT/scripts" "$ROOT/hooks" 2>/dev/null | grep -v '^\s*#' | head -20)
if [ -z "$hits" ]; then ok "no quoted absolute host paths in scripts or hooks"
else bad "host paths found in code" "$(echo "$hits" | head -5)"; fi

# ── 6. the promises the docs make ───────────────────────────────────────────
head_ "promises — every script named in the docs exists"
named=$(grep -rho 'scripts/[a-z_]*\.\(py\|sh\)' \
        "$ROOT/skills" "$ROOT/commands" "$ROOT/agents" "$ROOT/README.md" 2>/dev/null | sort -u)
miss=""
for s in $named; do [ -f "$ROOT/$s" ] || miss="$miss $s"; done
if [ -z "$miss" ]; then ok "all referenced scripts present ($(echo "$named" | wc -w | tr -d ' '))"
else bad "referenced but absent" "$miss"; fi

# ── 7. the hooks actually behave ────────────────────────────────────────────
head_ "hooks — the guard refuses what it must and passes what it must not block"
if [ -f "$ROOT/hooks/consent-guard.py" ]; then
  deny=$(printf '%s' '{"tool_name":"Bash","tool_input":{"command":"curl -X POST https://h/api/compositions/r/clips/a.m4a/transcribe"}}' \
         | "$PY" "$ROOT/hooks/consent-guard.py" 2>/dev/null)
  echo "$deny" | grep -q '"permissionDecision": *"deny"' \
    && ok "denies the transcribe endpoint" || bad "transcribe endpoint" "was not denied"

  allow=$(printf '%s' '{"tool_name":"Bash","tool_input":{"command":"abc2midi piece.abc -o piece.mid"}}' \
          | "$PY" "$ROOT/hooks/consent-guard.py" 2>/dev/null)
  [ -z "$allow" ] && ok "passes ordinary work" || bad "ordinary work" "was blocked: $allow"
fi
if [ -f "$ROOT/hooks/atelier-status.py" ]; then
  "$PY" "$ROOT/hooks/atelier-status.py" >/dev/null 2>&1 \
    && ok "status hook runs" || bad "status hook" "non-zero exit"
fi

# ── 8. the tools this plugin declares it needs ──────────────────────────────
head_ "runtime floors — declared, and checked here rather than mid-session"
for b in abc2midi fluidsynth ffmpeg abcm2ps rubberband rsvg-convert; do
  command -v "$b" >/dev/null 2>&1 && ok "$b" || skip "$b" "absent — the plugin must refuse loudly, not silently"
done
"$PY" -c "import numpy" 2>/dev/null && ok "numpy on python3" \
  || { [ -x /opt/anaconda3/bin/python3 ] && /opt/anaconda3/bin/python3 -c "import numpy" 2>/dev/null \
       && ok "numpy on a fallback interpreter" \
       || skip "numpy" "no interpreter with numpy — spectral measurement unavailable"; }

# ── 9. a real render, end to end ────────────────────────────────────────────
if [ "$QUICK" -eq 0 ] && command -v abc2midi >/dev/null 2>&1; then
  head_ "render — a tune goes in, a verified MIDI comes out"
  tmp=$(mktemp -d)
  cat > "$tmp/t.abc" <<'ABC'
X:1
T:selftest
M:4/4
L:1/8
Q:1/4=120
K:C
V:1 clef=treble
%%MIDI program 74
=C2 =D2 =E2 =F2 | [Q:1/4=136]=G2 =A2 =B2 =c2 |]
ABC
  if abc2midi "$tmp/t.abc" -o "$tmp/t.mid" 2>&1 | grep -qi '^Error'; then
    bad "abc2midi" "reported an error"
  else
    [ -s "$tmp/t.mid" ] && ok "abc2midi produced a MIDI" || bad "abc2midi" "empty output"
  fi
  if [ -f "$ROOT/scripts/atelier_midi.py" ] && [ -s "$tmp/t.mid" ]; then
    if "$PY" "$ROOT/scripts/atelier_midi.py" verify "$tmp/t.mid" >/dev/null 2>&1; then
      ok "atelier_midi.py reads its own render"
    else
      bad "atelier_midi.py verify" "could not read the render"
    fi
  else
    skip "atelier_midi.py" "not present yet"
  fi
  rm -rf "$tmp"
fi

# ── verdict ─────────────────────────────────────────────────────────────────
printf '\n\033[1mverdict\033[0m  %d passed  %d failed  %d skipped\n' "$PASS" "$FAIL" "$SKIP"
if [ "$FAIL" -gt 0 ]; then
  printf 'The plugin is not whole. A skipped runtime floor is a documented absence; a failure is not.\n'
  exit 1
fi
printf 'Whole. Install with:  claude --plugin-dir %s\n' "$ROOT"
exit 0
