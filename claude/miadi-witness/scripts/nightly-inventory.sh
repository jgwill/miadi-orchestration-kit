#!/usr/bin/env bash
# nightly-inventory — T1's nightly pass over the session inventory, so no person has to ask for it.
#
# William, 2026-11-03: "I would need to ensure that recent sessions are inventoried and that we have
# continuity but sounds like I still have to steer and babysit that process to happen... it should
# happen automatically every days during the night".
#
# What it does, without a model:
#   1. inventory.mjs write --all --since <26 hours ago>: a record for every session that ran since
#      the last pass (headless `claude -p` children left out), facts refreshed, missions[] filled from
#      the missions the session was handed (~/.miadi/missions, what /missions on :3335 lists).
#   2. Commits exactly the records it wrote, by path, in the inventory's repository, and pushes.
#      A rejected push stops here: someone else's work is on the remote, and it is not merged blind.
#   3. Appends one line to the witness seat's inbox (the seat clock.yml names) listing the sessions
#      that still have no reading, so the inventory-keeper reads them when the seat wakes.
#
# usage: nightly-inventory.sh [--since <date>] [--dry-run]
# Installed as the user timer miadi-inventory-nightly.timer by install-nightly-inventory.sh.
set -u

here=$(dirname "$(readlink -f "$0")")
since=$(date -u -d '26 hours ago' +%FT%TZ)
dry=0
while [ $# -gt 0 ]; do
	case "$1" in
	--since) since=$2; shift 2 ;;
	--dry-run) dry=1; shift ;;
	*) echo "nightly-inventory: unknown argument $1" >&2; exit 2 ;;
	esac
done

inventory=${WITNESS_INVENTORY_DIR:-$HOME/workspace/.mino/session-inventory}
log=${MIADI_INVENTORY_NIGHTLY_LOG:-$HOME/.miadi/navigator/inventory-nightly.jsonl}
clock=${MIADI_CLOCK_CONFIG:-$HOME/.miadi/navigator/clock.yml}
mkdir -p "$(dirname "$log")"
now=$(date -u +%FT%TZ)

record() { printf '%s\n' "$1" >>"$log"; }

if [ "$dry" = 1 ]; then
	node "$here/inventory.mjs" plan --all --since "$since"
	exit $?
fi

json=$(node "$here/inventory.mjs" write --all --since "$since" --json) || {
	record "{\"at\":\"$now\",\"since\":\"$since\",\"outcome\":\"inventory.mjs failed\"}"
	exit 1
}

# The files written, the sessions created, and the sessions no agent has read yet.
summary=$(printf '%s' "$json" | node -e '
	const fs = require("fs");
	const { dir, plans } = JSON.parse(fs.readFileSync(0, "utf8"));
	const written = plans.filter((p) => p.written).map((p) => p.written);
	const created = plans.filter((p) => p.action === "create" && p.written).map((p) => p.session_id);
	const unread = plans.filter((p) => p.file).map((p) => ({ id: p.session_id, file: `${dir}/${p.file}` }))
		.filter(({ file }) => {
			try {
				const r = JSON.parse(fs.readFileSync(file, "utf8"));
				return !(r.observations ?? []).some((o) => o.by && !String(o.by).startsWith("inventory-keeper (miadi-witness scripts"));
			} catch { return false; }
		}).map(({ id }) => id);
	console.log(JSON.stringify({ written, created, updated: written.length - created.length, unread }));
')

repo=$(git -C "$inventory" rev-parse --show-toplevel 2>/dev/null)
committed=null
if [ -n "$repo" ]; then
	mapfile -t files < <(printf '%s' "$summary" | node -e 'for (const f of JSON.parse(require("fs").readFileSync(0,"utf8")).written) console.log(f)')
	if [ "${#files[@]}" -gt 0 ]; then
		count=${#files[@]}
		git -C "$repo" add -- "${files[@]}" &&
			git -C "$repo" commit -q -m "inventory nightly $(date -u +%F): $count records written since $since (T1, nightly-inventory.sh)" -- "${files[@]}" &&
			committed="\"$(git -C "$repo" rev-parse --short HEAD)\""
		if [ "$committed" != null ] && ! git -C "$repo" push -q origin HEAD 2>/dev/null; then
			committed="$committed,\"push\":\"rejected: the remote holds work this host does not have; left for the seat\""
		fi
	fi
fi

line="{\"at\":\"$now\",\"event\":\"inventory.nightly\",\"since\":\"$since\",\"commit\":$committed,\"summary\":$summary}"
record "$line"

seat=$(sed -n 's/^  seat: *//p' "$clock" 2>/dev/null | head -1)
if [ -n "$seat" ]; then
	inbox=$HOME/.miadi/navigator/clock/inbox/$seat.jsonl
	mkdir -p "$(dirname "$inbox")"
	printf '%s\n' "$line" >>"$inbox"
fi
printf '%s\n' "$line"
