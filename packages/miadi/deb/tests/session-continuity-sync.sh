#!/usr/bin/env bash
# miadi-terminal's restore layer is the one jgwill/gaia linux_migration/14-tmux-resurrect.sh
# installs on gaia (jgwill/gaia#90). The package carries copies so a new machine gets it from apt.
# This checks the copies against a gaia checkout: the two hook scripts byte for byte, and the
# units and tmux settings line for line, once the paths each side uses are made the same.
#   bash tests/session-continuity-sync.sh [<gaia linux_migration folder>]
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
gaia="${1:-${MIADI_INFRA_GAIA_DIR:-/a/src/gaia}/linux_migration}"
pkg="$here/miadi-terminal"
share="$pkg/usr/share/miadi-terminal/session-continuity"
units="$pkg/usr/lib/systemd/user"
[ -f "$gaia/14-tmux-resurrect.sh" ] || { echo "no gaia installer at $gaia"; exit 2; }
failures=0
check() {  # <label> <command...>
    local label="$1"; shift
    if "$@" >/dev/null 2>&1; then echo "ok   $label"; else echo "DIFF $label"; failures=$((failures + 1)); fi
}
check "repair-save.sh = gaia tmux-resurrect-repair-save.sh" cmp "$share/repair-save.sh" "$gaia/tmux-resurrect-repair-save.sh"
check "restore-agents.sh = gaia tmux-restore-agents.sh" cmp "$share/restore-agents.sh" "$gaia/tmux-restore-agents.sh"
check "server-watch.sh = gaia tmux-server-watch.sh" cmp "$share/server-watch.sh" "$gaia/tmux-server-watch.sh"
# The units: gaia's installer writes them from heredocs with the resolved tmux and the user name.
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
awk '/<<.?EOF_UNIT.?$/{n++; on=1; next} /^EOF_UNIT$/{on=0} on{print > ("'"$work"'/unit" n)}' "$gaia/14-tmux-resurrect.sh"
norm() { sed -E 's#/usr/(local/)?bin/tmux #tmux #g; s#/usr/bin/env tmux #tmux #g; s#^Description=.*##; s#^Documentation=.*##; s#\$\{SAVE_INTERVAL\}#15#g; s#^ExecStart=.*server-watch[.]sh#ExecStart=WATCH#; /^#/d; /^$/d' "$1"; }
for pair in "1 tmux-server.service" "2 tmux-save.service" "3 tmux-save.timer" "4 tmux-server-watch.service" "5 tmux-server-watch.timer"; do
    set -- $pair
    check "$2 = gaia's $2" diff <(norm "$work/unit$1") <(norm "$units/$2")
done
# The tmux settings: gaia's managed block against session-continuity.conf.
awk '/<<EOF_BLOCK$/{on=1; next} /^EOF_BLOCK$/{on=0} on' "$gaia/14-tmux-resurrect.sh" > "$work/block"
settings() { grep -E "^(set -g @|run )" "$1" | sed -E -e "s#'(bash )?[^']*/(tmux-resurrect-)?repair-save[.]sh'#REPAIR#" -e "s#'(bash )?[^']*/(tmux-)?restore-agents[.]sh'#RESTORE#" -e 's#[$][{]CONTINUUM_INTERVAL[}]#0#' -e 's#[$][{]AUTO_RESTORE[}]#on#'; }
check "session-continuity.conf = gaia's managed block" diff <(settings "$work/block") <(settings "$share/session-continuity.conf")
[ "$failures" -eq 0 ] && echo "restore layer in step with $gaia" || echo "$failures copies differ from $gaia"
exit "$failures"
