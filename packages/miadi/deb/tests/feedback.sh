#!/usr/bin/env bash
# tests/feedback.sh: miadi-feedback's choices (which issue wakes a seat, its trust, its model,
# its brief, a decision's labels) with gh and tmux stubbed. No network, no seat started.
#   bash tests/feedback.sh
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export MIADI_FEEDBACK_STATE=$tmp/state XDG_CONFIG_HOME=$tmp/config
# The functions alone: everything above the command dispatch.
. <(sed '/^cmd=\${1:-}/,$d' "$here/miadi-feedback/usr/bin/miadi-feedback")
set +e +u
ETC=$here/miadi-feedback/etc/miadi/feedback.d
fail=0
expect() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected [$2], got [$3]"; fail=1; fi; }

COMMENTS='[]'
gh() {
	case "$*" in
		*"/comments --jq"*) jq -r "$(sed -n 's/.*--jq //p' <<<"$*")" <<<"$COMMENTS" ;;
		"issue view"*labels*) echo "$LABELS" ;;
		"issue edit"*) echo "$*" >> "$tmp/edits" ;;
		*) echo "unstubbed gh $*" >&2; return 1 ;;
	esac
}
issue() { jq -nc --arg a "$1" --arg s "$2" --argjson l "$3" '{number: 7, title: "t", url: "u", author: $a, assoc: $s, labels: $l}'; }

load install
expect "a labelled issue wakes its channel" "jgwill/miadi-orchestration-kit#7" "$(wake_key "$(issue tester NONE '["feedback:install"]')")"
expect "an outside author's unlabelled issue comes to install" "jgwill/miadi-orchestration-kit#7" "$(wake_key "$(issue tester NONE '[]')")"
expect "a collaborator's unlabelled issue does not" "" "$(wake_key "$(issue miadisabelle COLLABORATOR '[]')")"
expect "another channel's issue is not taken" "" "$(wake_key "$(issue tester NONE '["feedback:question"]')")"
expect "an issue already in a seat is not taken again" "" "$(wake_key "$(issue tester NONE '["feedback:install","feedback:in-seat"]')")"
expect "a decided issue is not taken" "" "$(wake_key "$(issue tester NONE '["feedback:install","feedback:shipped"]')")"
mark_seen "jgwill/miadi-orchestration-kit#7"
expect "a seen issue is not taken" "" "$(wake_key "$(issue tester NONE '["feedback:install"]')")"
COMMENTS='[{"id": 11, "user": {"login": "miadisabelle"}}, {"id": 12, "user": {"login": "tester"}}]'
expect "the author's answer on a waiting issue wakes a seat" "jgwill/miadi-orchestration-kit#7-c12" "$(wake_key "$(issue tester NONE '["feedback:install","feedback:waiting"]')")"
mark_seen "jgwill/miadi-orchestration-kit#7-c12"
expect "the same answer does not wake it twice" "" "$(wake_key "$(issue tester NONE '["feedback:install","feedback:waiting"]')")"
load question
expect "a waiting issue of another channel is left to it" "" "$(wake_key "$(issue tester NONE '["feedback:install","feedback:waiting"]')")"

load install
expect "an outside author is outside" outside "$(trust_of "$(issue tester NONE '[]')")"
expect "a collaborator is trusted" trusted "$(trust_of "$(issue someone COLLABORATOR '[]')")"
miadi_trust_out=$(trust tester); load install
expect "trust adds a login" trusted "$(trust_of "$(issue tester NONE '[]')")"

expect "Jev's haiku on install takes the cheapest allowed model" sonnet "$(fit haiku)"
expect "Jev's opus is taken" opus "$(fit opus)"
expect "no answer takes the first model" sonnet "$(fit "")"
load question
expect "Jev's fable on questions takes the highest allowed" opus "$(fit fable)"
expect "Jev's haiku on questions is taken" haiku "$(fit haiku)"

printf 'a {{ISSUE}} b {{TITLE}} & {{ISSUE}}\n' > "$tmp/brief"
expect "render fills every placeholder literally" 'a o/r#1 b x & y & o/r#1' "$(render "$tmp/brief" ISSUE=o/r#1 TITLE='x & y')"

LABELS="feedback:install feedback:in-seat feedback:waiting"; : > "$tmp/edits"
decide o/r#7 shipped "miadi-tide 0.1.13: x" >/dev/null
expect "decide sets its label and removes the others" "issue edit 7 -R o/r --add-label feedback:shipped --remove-label feedback:in-seat,feedback:waiting" "$(cat "$tmp/edits")"
expect "decide writes a ledger line" "shipped" "$(tail -1 "$LEDGER" | jq -r .decision)"
(decide o/r#7 maybe x) 2>/dev/null; expect "an unknown decision is refused" 1 "$?"

exit $fail
