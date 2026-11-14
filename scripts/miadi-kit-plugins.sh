# shellcheck shell=bash
# Source this file to get `miadi-kit-update`: one command that refreshes the
# miadi-orchestration-kit marketplace and updates every kit plugin this account
# has installed, in every scope it was installed in.
#
#   source /workspace/repos/jgwill/miadi-orchestration-kit/scripts/miadi-kit-plugins.sh
#   miadi-kit-update            # refresh the marketplace, update each installed kit plugin
#   miadi-kit-update --check    # list what would move; changes nothing in Claude Code
#
# Put the `source` line in ~/.bashrc to have it in every shell.
# A running Claude Code session keeps the plugin version it started with: start a
# new session (or /reload-plugins) to use the update.

MIADI_KIT_MARKETPLACE=${MIADI_KIT_MARKETPLACE:-miadi-orchestration-kit}

# installed kit plugins: id <TAB> scope <TAB> version <TAB> project path or "-"
_miadi_kit_installed() {
  claude plugin list --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const mk = "@" + process.argv[1];
      for (const p of JSON.parse(s || "[]"))
        if (p.id.endsWith(mk)) console.log([p.id, p.scope, p.version, p.projectPath || "-"].join("\t"));
    });' "$MIADI_KIT_MARKETPLACE"
}

# name <TAB> version for every plugin in a marketplace.json read from stdin
_miadi_kit_offers() {
  node -e 'let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
    for (const p of JSON.parse(s).plugins) console.log(p.name + "\t" + p.version); });'
}

miadi-kit-update() {
  local check=0
  case "${1:-}" in
    --check) check=1 ;;
    "") ;;
    -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}"; return 0 ;;
    *) echo "miadi-kit-update: unknown argument $1" >&2; return 2 ;;
  esac
  command -v claude >/dev/null || { echo "miadi-kit-update: claude is not on PATH" >&2; return 1; }

  local clone="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/marketplaces/$MIADI_KIT_MARKETPLACE"
  local manifest=.claude-plugin/marketplace.json

  # Read before refreshing: a marketplace with autoUpdate moves its plugins during the refresh.
  local rows; rows=$(_miadi_kit_installed)
  if [ -z "$rows" ]; then echo "No $MIADI_KIT_MARKETPLACE plugin is installed for $USER."; return 0; fi

  local offers
  if [ "$check" = 1 ]; then
    # Fetching moves only the clone's remote refs. Claude Code reads its working tree.
    git -C "$clone" fetch -q origin 2>/dev/null \
      || { echo "miadi-kit-update: cannot fetch $clone" >&2; return 1; }
    offers=$(git -C "$clone" show "$(git -C "$clone" rev-parse --abbrev-ref origin/HEAD):$manifest" | _miadi_kit_offers)
  else
    claude plugin marketplace update "$MIADI_KIT_MARKETPLACE" >/dev/null \
      || { echo "miadi-kit-update: claude plugin marketplace update $MIADI_KIT_MARKETPLACE failed" >&2; return 1; }
    offers=$(_miadi_kit_offers < "$clone/$manifest")
  fi
  local now; [ "$check" = 1 ] || now=$(_miadi_kit_installed)

  local id scope ver proj name offered cur out fail=0 moved=0
  while IFS=$'\t' read -r id scope ver proj; do
    name=${id%@*}
    offered=$(awk -F'\t' -v n="$name" '$1 == n {print $2}' <<< "$offers")
    if [ "$ver" = "$offered" ]; then
      printf '%-36s %-8s %s current\n' "$name" "$scope" "$ver"; continue
    fi
    if [ "$check" = 0 ]; then
      cur=$(awk -F'\t' -v i="$id" -v s="$scope" '$1 == i && $2 == s {print $3}' <<< "$now")
      if [ "$cur" != "$offered" ] && ! out=$( { [ "$proj" = - ] || cd "$proj"; } \
           && claude plugin update "$id" --scope "$scope" </dev/null 2>&1 ); then
        printf '%-36s %-8s %s -> %s FAILED\n%s\n' "$name" "$scope" "$ver" "$offered" "$out"; fail=1; continue
      fi
    fi
    printf '%-36s %-8s %s -> %s\n' "$name" "$scope" "$ver" "$offered"; moved=$((moved + 1))
  done <<< "$rows"

  if [ "$check" = 1 ]; then echo "$moved plugin(s) would move. Nothing changed."
  elif [ "$moved" -gt 0 ]; then echo "$moved plugin(s) updated. Start a new Claude Code session to use them."
  fi
  return "$fail"
}
