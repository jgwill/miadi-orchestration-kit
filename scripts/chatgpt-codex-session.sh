#!/usr/bin/env bash
# shellcheck shell=bash
# chatgpt-codex-session.sh: which thread the ChatGPT desktop app's Codex section is running,
# and where codex/miadi-session-observability saves it.
#
# Run it, or source it to get the `miadi-chatgpt-session` function:
#
#   scripts/chatgpt-codex-session.sh                 # the app's most recent thread
#   source scripts/chatgpt-codex-session.sh
#   miadi-chatgpt-session --plan                     # path of its latest saved plan
#   cd "$(miadi-chatgpt-session --dir)"
#
# `miadi-chatgpt-session --help` says the rest.
#
# WHY  2026-11-27: a planning turn in the app was looked for in /src/_sessiondata/01a21d40-…,
#      an empty codex-tui session. The planning was thread 01a20098-…, captured in full.
#      The app's bundled Codex (/usr/lib/chatgpt/resources/codex) shares ~/.codex, so its
#      threads sit beside TUI and exec threads. Its own state records which ones are its own.

_miadi_chatgpt_session_help() {
	cat <<'EOF'
Usage: miadi-chatgpt-session [OPTION]

Find the thread the ChatGPT desktop app's Codex section ran most recently, and the
folder where codex/miadi-session-observability captures it.

Options:
  --id         print only the session id
  --dir        print only the capture folder (exit 1 when it does not exist)
  --plan       print only the path of the latest plan saved in plans/ (exit 1 when none)
  --list [N]   list the app's N most recent threads (default 10), newest first
  -h, --help   show this help

Without an option it prints the session id, thread name, working directory, last
activity, the thread it was forked from, capture folder and latest plan.

The capture hooks run with a thread's first turn. A new or forked thread nobody has
prompted yet shows "no turn yet" and has no capture folder until it is prompted.

A thread belongs to the app when Codex's state database records its originator as
"Codex Desktop" and its source as "user". Subagent and guardian-review threads, archived
threads, and Codex TUI or exec sessions are left out.

Environment:
  CODEX_HOME   Codex home holding state_<n>.sqlite (default ~/.codex)
  Capture root, first one set: CODEX_SESSIONDATA_ROOT, MIADI_SESSION_DIR,
  MIADI_SESSIONDATA_ROOT, SESSION_DATA_ROOT, then /src/_sessiondata.

The state database schema is not a stable Codex API. When it cannot be read, the
command says so and exits 2.
EOF
}

miadi-chatgpt-session() {
	local mode="summary" limit=10
	case "${1:-}" in
		-h | --help) _miadi_chatgpt_session_help; return 0 ;;
		--id) mode="id" ;;
		--dir) mode="dir" ;;
		--plan) mode="plan" ;;
		--list)
			mode="list"
			if [ -n "${2:-}" ]; then
				case "$2" in
					*[!0-9]* | 0) echo "miadi-chatgpt-session: --list takes a positive number, not '$2'" >&2; return 2 ;;
				esac
				limit="$2"
			fi
			;;
		"") ;;
		*) echo "miadi-chatgpt-session: unknown option '$1' (see --help)" >&2; return 2 ;;
	esac

	local root="${CODEX_SESSIONDATA_ROOT:-${MIADI_SESSION_DIR:-${MIADI_SESSIONDATA_ROOT:-${SESSION_DATA_ROOT:-/src/_sessiondata}}}}"

	python3 - "$mode" "$limit" "${CODEX_HOME:-$HOME/.codex}" "$root" <<'PY'
import datetime, glob, json, os, re, sqlite3, sys

mode, limit, codex_home, root = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]

def fail(msg, code):
    print(f"miadi-chatgpt-session: {msg}", file=sys.stderr)
    sys.exit(code)

dbs = sorted(glob.glob(os.path.join(codex_home, "state_*.sqlite")),
             key=lambda p: int(re.search(r"state_(\d+)\.sqlite$", p).group(1)) if re.search(r"state_(\d+)\.sqlite$", p) else -1)
if not dbs:
    fail(f"no state_<n>.sqlite in {codex_home}", 2)

try:
    con = sqlite3.connect(f"file:{dbs[-1]}?mode=ro", uri=True)
    rows = con.execute(
        "SELECT id, COALESCE(NULLIF(name, ''), title, ''), cwd, recency_at_ms, tokens_used, rollout_path FROM threads "
        "WHERE originator = 'Codex Desktop' AND thread_source = 'user' AND archived = 0 "
        "ORDER BY recency_at_ms DESC LIMIT ?",
        (limit if mode == "list" else 1,),
    ).fetchall()
except sqlite3.Error as e:
    fail(f"cannot read threads from {dbs[-1]}: {e}", 2)

if not rows:
    fail("no ChatGPT app thread recorded in Codex state", 1)

def when(ms):
    if not ms:
        return "unknown"
    return datetime.datetime.fromtimestamp(ms / 1000).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")

def latest_plan(folder):
    plans = glob.glob(os.path.join(folder, "plans", "session_*.md"))
    return max(plans, key=os.path.getmtime) if plans else None

def forked_from(rollout):
    # The rollout's first line is its session_meta; a fork names its parent there.
    try:
        with open(rollout, encoding="utf-8") as f:
            return (json.loads(f.readline()).get("payload") or {}).get("forked_from_id")
    except (OSError, ValueError, AttributeError):
        return None

def state(folder, tokens):
    if os.path.isdir(folder):
        return "captured"
    # Codex runs the capture hooks with the first turn, so a thread nobody prompted has no folder yet.
    return "no turn yet" if not tokens else "not captured"

if mode == "list":
    for sid, name, cwd, ms, tokens, _ in rows:
        print(f"{sid}  {when(ms)}  {state(os.path.join(root, sid), tokens):12}  {name or '(no name)'}  {cwd}")
    sys.exit(0)

sid, name, cwd, ms, tokens, rollout = rows[0]
folder = os.path.join(root, sid)
captured = os.path.isdir(folder)
plan = latest_plan(folder) if captured else None
parent = forked_from(rollout) if rollout else None

if mode == "id":
    print(sid)
elif mode == "dir":
    if not captured:
        fail(f"{folder} does not exist ({state(folder, tokens)})", 1)
    print(folder)
elif mode == "plan":
    if not plan:
        fail(f"no plan saved for session {sid} in {os.path.join(folder, 'plans')}", 1)
    print(plan)
else:
    print(f"session   {sid}")
    print(f"name      {name or '(no name)'}")
    print(f"cwd       {cwd}")
    print(f"active    {when(ms)}")
    if parent:
        print(f"forked    from {parent}")
    print(f"capture   {folder if captured else folder + '  (' + state(folder, tokens) + ')'}")
    print(f"plan      {plan or '(none saved)'}")
PY
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
	miadi-chatgpt-session "$@"
fi
