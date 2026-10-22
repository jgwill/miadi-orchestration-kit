#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$HERE/tests/native.test.py"
bash "$HERE/hooks/secret_capture_sanitizer.sh" --self-test
for suite in team-resolution episode-resolution binding-mission files-written publications artifact-comments workspace-clone-guard; do
    bash "$HERE/tests/$suite.sh"
done
