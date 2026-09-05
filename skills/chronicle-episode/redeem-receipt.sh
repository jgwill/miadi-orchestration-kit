#!/usr/bin/env bash
# Redeem a pending or lying .mw-registration.json receipt.
#
# Retries registration against the Chronicle wheel via inquiry-weave's
# registerEpisodeNode (which preflights GET /api/nodes/<id> and therefore never
# overwrites an existing card), then rewrites the receipt to say what is now
# true. Touches exactly one file: <vessel>/.mw-registration.json. Runs no git.
#
# Usage: redeem-receipt.sh <episode-dir-name|path> [--mw-url URL] [--dry-run]
# Exit:  0 registered/already-registered · 1 still pending · 2 setup refusal
set -euo pipefail

# The wheel. MIADI_CHRONICLE_MW_URL is the variable of record (William's word,
# 2026-09-04); MW_API_URL is only the tool-contract name an MCP subprocess is
# handed by the .mcp.json files, so it stays as the fallback. The earlier chain
# led with MW_API_URL_OVERRIDE (ep322) and was retired on 2026-09-04.
MW_URL="${MIADI_CHRONICLE_MW_URL:-${MW_API_URL:-http://127.0.0.1:8040}}"
CHRONICLE_ROOT="${MIADI_CHRONICLE_ROOT:-/srv/miadi/episodes/miadi-chronicle}"
DRY_RUN=0
TARGET=""

while [ $# -gt 0 ]; do
  case "$1" in
    --mw-url) MW_URL="$2"; shift 2 ;;
    --chronicle-root) CHRONICLE_ROOT="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) TARGET="$1"; shift ;;
  esac
done

[ -n "$TARGET" ] || { echo "redeem-receipt: need an episode directory name or path" >&2; exit 2; }

case "$MW_URL" in
  *mw.tail3b11eb.ts.net*)
    echo "redeem-receipt: refusing — $MW_URL is Gaia's ceremony wheel, not the Chronicle wheel." >&2
    echo "                point MIADI_CHRONICLE_MW_URL at the chronicle wheel, or pass --mw-url:" >&2
    echo "                export MIADI_CHRONICLE_MW_URL=http://127.0.0.1:8040" >&2
    exit 2 ;;
esac

case "$TARGET" in
  /*) VESSEL="$TARGET" ;;
   *) VESSEL="$CHRONICLE_ROOT/$TARGET" ;;
esac
[ -d "$VESSEL" ] || { echo "redeem-receipt: no such vessel: $VESSEL" >&2; exit 2; }

# @miadi/inquiry-weave, resolved two ways: the PATH shim first, then the
# checkout every Miadi .mcp.json already names (${MIADI_SRC}/packages/...).
# MIADI_SRC is a symlink — /src/Miadi -> /a/src/Miadi-18 — so resolve it.
IW=""
if IW_BIN="$(command -v inquiry-weave 2>/dev/null)"; then
  CANDIDATE="$(dirname "$(readlink -f "$IW_BIN")")/index.js"
  [ -f "$CANDIDATE" ] && IW="$CANDIDATE"
fi
if [ -z "$IW" ] && [ -n "${MIADI_SRC:-}" ]; then
  # `readlink -f` exits 1 with no output when a mid-path component is missing.
  # Unguarded under `set -e` that killed the script before the error below,
  # exiting 1 — which this script's contract defines as "still pending", so a
  # pipeline would record a registration debt that was never attempted.
  SRC_REAL="$(readlink -f "$MIADI_SRC" 2>/dev/null || printf '%s' "$MIADI_SRC")"
  CANDIDATE="$SRC_REAL/packages/inquiry-weave/dist/index.js"
  [ -f "$CANDIDATE" ] && IW="$CANDIDATE"
fi
[ -n "$IW" ] || { echo "redeem-receipt: cannot locate @miadi/inquiry-weave dist — not on PATH, and \${MIADI_SRC:-<unset>}/packages/inquiry-weave/dist/index.js does not exist" >&2; exit 2; }

exec env MW_URL="$MW_URL" VESSEL="$VESSEL" IW="$IW" DRY_RUN="$DRY_RUN" \
  node "$(dirname "$(readlink -f "$0")")/redeem-receipt.mjs"
