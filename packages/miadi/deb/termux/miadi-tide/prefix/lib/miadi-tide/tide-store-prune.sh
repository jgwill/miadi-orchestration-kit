#!/usr/bin/env bash
# Copied for the Termux build from jgwill/Miadi scripts/ops/tide-store-prune.sh at ea3a2971.
# The Ubuntu build's prep/miadi-tide.sh copies it from MIADI_SRC. Keep the two alike.
# Keep the tide runtime's snapshot store bounded.
#
# WHY THIS EXISTS. The daemon appends one context snapshot per tick and nothing
# in the package ever removes one — `grep -rn 'retention|prune|vacuum|DELETE FROM'`
# over tide_runtime returns nothing. Measured on this host 2026-07-30: 16 KB per
# snapshot at a 60s interval = 23 MB/day, 8.4 GB/year. The store this replaced had
# reached 4.2 GiB at the old 15s interval, and nobody noticed until someone went
# looking for something else.
#
# This is the OUTSIDE fix — it works against the published wheel and needs no
# release. The inside fix belongs in the package and is William's to publish.
#
# What it keeps: the most recent MIADI_TIDE_KEEP_DAYS of history (default 7), and
# never fewer than MIADI_TIDE_KEEP_MIN rows (default 200) whatever the dates say —
# because a daemon that was stopped for a fortnight must not wake to an empty
# store and a prune that deletes everything it just wrote.
#
# Safe to re-run. Reads nothing it does not own. Touches no service.

set -euo pipefail

STORE="${MIADI_TIDE_STORE:-$HOME/.miadi/navigator/context/snapshots.sqlite3}"
KEEP_DAYS="${MIADI_TIDE_KEEP_DAYS:-7}"
KEEP_MIN="${MIADI_TIDE_KEEP_MIN:-200}"
PYTHON="${MIADI_TIDE_PYTHON:-$HOME/.local/share/tide-runtime/venv/bin/python}"
VACUUM_ABOVE_MB="${MIADI_TIDE_VACUUM_ABOVE_MB:-64}"

[ -r "$STORE" ] || { echo "no store at $STORE — nothing to prune"; exit 0; }
[ -x "$PYTHON" ] || PYTHON=python3

before=$(stat -c %s "$STORE")

"$PYTHON" - "$STORE" "$KEEP_DAYS" "$KEEP_MIN" "$VACUUM_ABOVE_MB" <<'PY'
import sqlite3, sys, time

store, keep_days, keep_min, vacuum_above_mb = sys.argv[1], float(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
cutoff = time.time() - keep_days * 86400

# `timeout` matters: the daemon holds this file every 60 seconds. Losing the race
# is normal and must exit 0 — a prune that fails loudly on contention gets muted,
# and a muted guard is the thing this file exists to replace.
con = sqlite3.connect(store, timeout=20)
try:
    total = con.execute("select count(*) from context_snapshots").fetchone()[0]
    if total <= keep_min:
        print(f"{total} rows ≤ floor {keep_min} — nothing removed")
        sys.exit(0)

    # Delete by AGE, but never below the floor: order by time, keep the newest
    # keep_min unconditionally, and among the rest drop only what is past cutoff.
    doomed = con.execute(
        """select snapshot_id from context_snapshots
           where timestamp_epoch < ?
             and snapshot_id not in (
               select snapshot_id from context_snapshots
               order by timestamp_epoch desc limit ?)""",
        (cutoff, keep_min),
    ).fetchall()
    if not doomed:
        print(f"{total} rows, none older than {keep_days:g} days — nothing removed")
        sys.exit(0)

    con.executemany("delete from context_snapshots where snapshot_id = ?", doomed)
    con.commit()
    left = con.execute("select count(*) from context_snapshots").fetchone()[0]
    print(f"removed {len(doomed)} of {total} rows, {left} remain (keeping {keep_days:g} days, floor {keep_min})")

    # VACUUM rewrites the file, so it is worth doing only when there is real slack
    # to reclaim — and it takes an exclusive lock, which is why it is bounded.
    page, freelist = (con.execute(f"pragma {p}").fetchone()[0] for p in ("page_size", "freelist_count"))
    slack_mb = page * freelist / 1e6
    if slack_mb >= vacuum_above_mb:
        con.execute("vacuum")
        print(f"vacuumed ({slack_mb:.0f} MB of free pages reclaimed)")
    else:
        print(f"no vacuum ({slack_mb:.0f} MB free pages, threshold {vacuum_above_mb} MB)")
except sqlite3.OperationalError as e:
    # Almost always "database is locked" — the daemon is mid-tick. Next run gets it.
    print(f"skipped: {e}")
    sys.exit(0)
finally:
    con.close()
PY

after=$(stat -c %s "$STORE")
printf 'store %s → %s\n' "$(numfmt --to=iec "$before")" "$(numfmt --to=iec "$after")"
