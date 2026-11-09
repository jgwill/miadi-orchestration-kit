#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python3 "$HERE/tests/native.test.py"
python3 "$HERE/tests/terminal-identity.test.py"
bash "$HERE/hooks/secret_capture_sanitizer.sh" --self-test
for suite in team-resolution episode-resolution binding-mission files-written publications artifact-comments workspace-clone-guard \
    tmux-server-guard secret-print-guard session-lookup-guard secret-exposure-alert scrub-secrets dispatch-guards work-in-progress; do
    bash "$HERE/tests/$suite.sh"
done
