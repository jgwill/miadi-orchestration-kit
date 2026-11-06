#!/usr/bin/env bash
# Real Claude marketplace commands in a disposable home; no Claude model or Google sign-in.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
claude_bin=${CLAUDE_BIN:-$(readlink -f "$(command -v claude)")}
docker run --rm --cap-add=SYS_ADMIN --security-opt apparmor=unconfined \
  -v "$here/dist:/debs:ro" -v "$here/tests:/tests:ro" -v "$claude_bin:/usr/local/bin/claude:ro" \
  "${IMAGE:-ubuntu:24.04}" bash /tests/deepdiver-claude-container.sh
