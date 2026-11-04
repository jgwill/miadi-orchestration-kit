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
#   2. Lists the sessions no agent has read yet (Miette insight seats, smoke and probe runs keep
#      their facts and are not queued).
#   3. Hands the sessions no agent has read to ONE inventory-keeper on Haiku (`claude -p --model haiku
#      --agent miadi-witness:inventory-keeper`), at most --max-read sessions and --budget dollars a night.
#      William, 2026-11-04: Haiku "is ok", and be economic: one worker, a cap, nobody steering.
#   4. Commits the records written and read, by path, in the inventory's repository, and pushes.
#   5. Appends one line to the witness seat's inbox (the seat clock.yml names) with what ran and
#      what is still unread, for the morning.
#
# usage: nightly-inventory.sh [--since <date>] [--dry-run] [--no-read] [--max-read N] [--budget USD]
# Installed as the user timer miadi-inventory-nightly.timer by install-nightly-inventory.sh.
set -u

here=$(dirname "$(readlink -f "$0")")
since=$(date -u -d '26 hours ago' +%FT%TZ)
dry=0
read=1
max_read=${MIADI_INVENTORY_MAX_READ:-30}
budget=${MIADI_INVENTORY_READ_BUDGET_USD:-1}
while [ $# -gt 0 ]; do
	case "$1" in
	--since) since=$2; shift 2 ;;
	--dry-run) dry=1; shift ;;
	--no-read) read=0; shift ;;
	--max-read) max_read=$2; shift 2 ;;
	--budget) budget=$2; shift 2 ;;
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
				// Economy (William, 2026-11-04: "You might be overdoing with all these subagents"):
				// a Miette insight seat, a smoke or probe run keeps its facts and is not queued for reading.
				if (/-miette-insight$|smoke|probe/.test(r.tmux_session_name ?? "")) return false;
				return !(r.observations ?? []).some((o) => o.by && !String(o.by).startsWith("inventory-keeper (miadi-witness scripts"));
			} catch { return false; }
		}).map(({ id }) => id);
	console.log(JSON.stringify({ written, created, updated: written.length - created.length, unread }));
')

# One reader for what no agent has read: Haiku, capped, never a seat of its own.
mapfile -t unread < <(printf '%s' "$summary" | node -e 'for (const id of JSON.parse(require("fs").readFileSync(0,"utf8")).unread) console.log(id)')
reading=null
if [ "$read" = 1 ] && [ "${#unread[@]}" -gt 0 ] && command -v claude >/dev/null 2>&1; then
	batch=("${unread[@]:0:$max_read}")
	prompt="Nightly inventory reading ($(date -u +%F)). For each session id below, its record is $inventory/<id>.json and its facts are already written. Read the session with \`miadi-hooks-interpret digest <id>\` and fill mission, work_completed (commits, issues and episodes with their addresses), held_decisions and next_steps in plain words per SCHEMA.md there, with at most one item that needs William and only if the session says so. Append one observation {at, by: \"inventory-keeper (haiku, nightly)\", what}. Never read raw _claude_* files, never run find /, never type into a pane, never commit, and change no status, repo, repo_remote, missions or binding. If a digest fails, write the observation 'digest unavailable: <reason>' and stop on that session. Sessions: ${batch[*]}"
	readlog=${log%.jsonl}-reader.log
	(cd "$HOME/workspace" && timeout 3600 claude -p --model haiku --plugin-dir "$(dirname "$here")" --agent miadi-witness:inventory-keeper \
		--max-budget-usd "$budget" --permission-mode bypassPermissions "$prompt") >>"$readlog" 2>&1
	rc=$?
	reading="{\"sessions\":${#batch[@]},\"left\":$((${#unread[@]} - ${#batch[@]})),\"exit\":$rc,\"budget_usd\":$budget}"
fi

repo=$(git -C "$inventory" rev-parse --show-toplevel 2>/dev/null)
committed=null
if [ -n "$repo" ]; then
	mapfile -t files < <(printf '%s' "$summary" | node -e 'for (const f of JSON.parse(require("fs").readFileSync(0,"utf8")).written) console.log(f)')
	for id in "${unread[@]}"; do
		f=$inventory/$id.json
		[ -f "$f" ] && ! printf '%s\n' "${files[@]}" | grep -qxF "$f" && ! git -C "$repo" diff --quiet -- "$f" && files+=("$f")
	done
	if [ "${#files[@]}" -gt 0 ]; then
		count=${#files[@]}
		git -C "$repo" add -- "${files[@]}" &&
			git -C "$repo" commit -q -m "inventory nightly $(date -u +%F): $count records written or read since $since (T1, nightly-inventory.sh)" -- "${files[@]}" &&
			committed="\"$(git -C "$repo" rev-parse --short HEAD)\""
		if [ "$committed" != null ] && ! git -C "$repo" push -q origin HEAD 2>/dev/null; then
			committed="$committed,\"push\":\"rejected: the remote holds work this host does not have; left for the seat\""
		fi
	fi
fi

line="{\"at\":\"$now\",\"event\":\"inventory.nightly\",\"since\":\"$since\",\"commit\":$committed,\"reading\":$reading,\"summary\":$summary}"
record "$line"

seat=$(sed -n 's/^  seat: *//p' "$clock" 2>/dev/null | head -1)
if [ -n "$seat" ]; then
	inbox=$HOME/.miadi/navigator/clock/inbox/$seat.jsonl
	mkdir -p "$(dirname "$inbox")"
	printf '%s\n' "$line" >>"$inbox"
fi
printf '%s\n' "$line"
