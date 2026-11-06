#!/bin/bash
# chart-pulse.sh record|stop: a seat's chart moves with its commits. The check is the command
# miadi-chronicle-server installs (/usr/bin/miadi-chart-pulse, packages/miadi/deb/README.md). A
# session opts in with MIADI_CHART_PULSE_STORE, its chart store file, and any other session
# leaves here without starting node. Ref: jgwill/miadi-orchestration-kit#103
[ -n "${MIADI_CHART_PULSE_STORE:-}" ] || exit 0
if command -v miadi-chart-pulse >/dev/null; then exec miadi-chart-pulse "$1"; fi
if [ "$1" = stop ]; then
    printf '%s\n' '{"systemMessage":"MIADI_CHART_PULSE_STORE is set and miadi-chart-pulse is not installed: sudo apt install miadi-chronicle-server"}'
fi
exit 0
