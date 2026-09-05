#!/usr/bin/env python3
"""Chronicle episode closing-gate reconciliation.

Cross-tabulates three records that must agree and routinely do not:

  disk    the episode vessel directory under the chronicle root
  git     whether that directory is tracked / clean / pushed
  wheel   whether `chronicle:<episode-dir>` exists on the medicine wheel
  receipt what `.mw-registration.json` inside the vessel *claims* about the wheel

Read-only. Runs no git write, posts nothing to the wheel. Exit 0 when no
actionable drift, 1 when drift is found, 2 on a setup failure (bad root, wheel
unreachable) so a pipeline can tell "the chronicle is off" from "I could not
look".

Usage:
  reconcile.py [--chronicle-root DIR] [--mw-url URL] [--all] [--json]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_ROOT = "/srv/miadi/episodes/miadi-chronicle"
DEFAULT_MW = "http://127.0.0.1:8040"
RECEIPT = ".mw-registration.json"
MANIFEST = "episode.yaml"
EPISODE_DIR = re.compile(r"^\d{4}-\d{2}-\d{2}-episode-\d+-.+$")
# Gaia's ceremony wheel — retired for Chronicle work. A receipt naming it is poisoned.
POISON_HOSTS = ("mw.tail3b11eb.ts.net",)


def default_mw_url() -> str:
    """The wheel. `MIADI_CHRONICLE_MW_URL` is the variable of record
    (William's word, 2026-09-04). `MW_API_URL` is only the tool-contract name an
    MCP subprocess is handed by the .mcp.json files, so it stays as the
    fallback. The earlier chain led with `MW_API_URL_OVERRIDE` (ep322) and was
    retired on 2026-09-04.
    """
    return (os.environ.get("MIADI_CHRONICLE_MW_URL")
            or os.environ.get("MW_API_URL")
            or DEFAULT_MW)


def git(repo: Path, *args: str) -> str:
    out = subprocess.run(
        ["git", "-C", str(repo), *args],
        capture_output=True, text=True, check=False,
    )
    return out.stdout


def wheel_episode_nodes(mw_url: str) -> set[str]:
    """Every chronicle:* node id on the wheel, minus the chronicle root node."""
    url = mw_url.rstrip("/") + "/api/nodes"
    with urllib.request.urlopen(url, timeout=15) as response:
        payload = json.load(response)
    nodes = payload.get("nodes", payload if isinstance(payload, list) else [])
    return {
        str(n.get("id"))
        for n in nodes
        if str(n.get("id", "")).startswith("chronicle:")
        and str(n.get("id")) != "chronicle:miadi-chronicle"
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--chronicle-root",
                    default=os.environ.get("MIADI_CHRONICLE_ROOT", DEFAULT_ROOT))
    ap.add_argument("--mw-url", default=default_mw_url())
    ap.add_argument("--all", action="store_true",
                    help="name every unregistered vessel instead of counting them")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    # Symmetric with redeem-receipt.sh's refusal. Reconciling against Gaia's
    # retired wheel would call every real vessel a GHOST-NODE; worse, its DNS
    # no longer resolves and urlopen(timeout=) does not bound name resolution,
    # so the run hangs rather than fails.
    if any(host in args.mw_url for host in POISON_HOSTS):
        print(f"reconcile: refusing — {args.mw_url} is Gaia's ceremony wheel "
              f"(retired 2026-07-29), not the Chronicle wheel.", file=sys.stderr)
        return 2

    root = Path(args.chronicle_root).resolve()
    if not root.is_dir():
        print(f"reconcile: chronicle root is not a directory: {root}", file=sys.stderr)
        return 2

    toplevel = git(root, "rev-parse", "--show-toplevel").strip()
    if not toplevel:
        print(f"reconcile: {root} is not inside a git work tree", file=sys.stderr)
        return 2
    repo = Path(toplevel)
    prefix = root.relative_to(repo).as_posix()  # "miadi-chronicle"

    try:
        on_wheel = wheel_episode_nodes(args.mw_url)
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"reconcile: medicine wheel unreachable at {args.mw_url}: {exc}",
              file=sys.stderr)
        return 2

    on_disk = sorted(p.name for p in root.iterdir()
                     if p.is_dir() and EPISODE_DIR.match(p.name))

    # One git call each, sliced per episode — never one call per vessel.
    tracked: set[str] = set()
    for line in git(repo, "ls-files", "--", prefix).splitlines():
        parts = line.split("/")
        if len(parts) > 1:
            tracked.add(parts[1])
    dirty: set[str] = set()
    for line in git(repo, "status", "--porcelain", "--", prefix).splitlines():
        path = line[3:].strip().strip('"')
        parts = path.split("/")
        if len(parts) > 1:
            dirty.add(parts[1])

    branch = git(repo, "rev-parse", "--abbrev-ref", "HEAD").strip()
    ahead = git(repo, "rev-list", "--count", "@{upstream}..HEAD").strip() or "?"
    behind = git(repo, "rev-list", "--count", "HEAD..@{upstream}").strip() or "?"
    unpushed_dirs: set[str] = set()
    if ahead not in ("0", "?"):
        for line in git(repo, "log", "--name-only", "--pretty=format:",
                        "@{upstream}..HEAD", "--", prefix).splitlines():
            parts = line.strip().split("/")
            if len(parts) > 1 and parts[0] == prefix:
                unpushed_dirs.add(parts[1])

    findings: dict[str, list[str]] = {
        "GHOST-NODE": [], "UNCOMMITTED-VESSEL": [], "UNPUSHED-VESSEL": [],
        "DIRTY-VESSEL": [], "LYING-RECEIPT": [], "PENDING-RECEIPT": [],
        "POISONED-RECEIPT": [], "UNREADABLE-RECEIPT": [], "UNREGISTERED-VESSEL": [],
        "MANIFESTLESS-VESSEL": [],
    }

    # 1. Node on the wheel with no vessel on disk — registered a thing that never landed.
    for node_id in sorted(on_wheel):
        name = node_id.split("chronicle:", 1)[1]
        if name not in on_disk:
            ever = git(repo, "log", "--all", "--oneline", "-1",
                       "--", f"{prefix}/{name}").strip()
            findings["GHOST-NODE"].append(
                f"{name} (on wheel; no directory; "
                f"{'has history' if ever else 'zero commits in git log --all'})")

    for name in on_disk:
        node_id = f"chronicle:{name}"
        registered = node_id in on_wheel

        # Resolution and the manifest are two different questions. Episodes are
        # selected above by DIRECTORY NAME, which is also all resolveEpisode
        # looks at — so a folder made by hand holds its number while register,
        # lineage, the wheel and app/chronicle (every one of them a manifest
        # reader) cannot see it. Until this check existed, the shape could not
        # appear in any report: 66 of 166 directories were in it on 2026-08-13.
        if not (root / name / MANIFEST).is_file():
            findings["MANIFESTLESS-VESSEL"].append(
                f"{name}{' (registered on wheel — reads healthy, is not)' if registered else ''}")

        if name not in tracked:
            findings["UNCOMMITTED-VESSEL"].append(
                f"{name}{' (registered on wheel)' if registered else ''}")
        else:
            if name in unpushed_dirs:
                findings["UNPUSHED-VESSEL"].append(name)
            if name in dirty:
                findings["DIRTY-VESSEL"].append(name)

        receipt_path = root / name / RECEIPT
        if not receipt_path.is_file():
            if not registered:
                findings["UNREGISTERED-VESSEL"].append(name)
            continue
        try:
            receipt = json.loads(receipt_path.read_text())
        except (OSError, ValueError) as exc:
            findings["UNREADABLE-RECEIPT"].append(f"{name}: {exc}")
            continue

        state = str(receipt.get("state", ""))
        url = str(receipt.get("url", ""))
        if any(host in url for host in POISON_HOSTS):
            findings["POISONED-RECEIPT"].append(f"{name}: url={url}")
        if state == "pending":
            findings["PENDING-RECEIPT"].append(
                f"{name}: {receipt.get('error', 'no error recorded')}")
        elif state in ("registered", "already-registered") and not registered:
            findings["LYING-RECEIPT"].append(
                f"{name}: claims {state} at {url}, absent from {args.mw_url}")

    drift = sum(len(v) for k, v in findings.items() if k != "UNREGISTERED-VESSEL")

    if args.json:
        print(json.dumps({
            "chronicle_root": str(root), "mw_url": args.mw_url,
            "branch": branch, "ahead": ahead, "behind": behind,
            "on_disk": len(on_disk), "on_wheel": len(on_wheel),
            "receipts": sum(1 for n in on_disk if (root / n / RECEIPT).is_file()),
            "drift": drift, "findings": findings,
        }, indent=2))
        return 1 if drift else 0

    print(f"chronicle {root}")
    print(f"wheel     {args.mw_url}")
    print(f"git       {branch} — {ahead} ahead / {behind} behind upstream")
    print(f"counts    {len(on_disk)} vessels on disk · {len(on_wheel)} episode "
          f"cards on wheel · "
          f"{sum(1 for n in on_disk if (root / n / RECEIPT).is_file())} receipts")
    print()
    for shape, items in findings.items():
        if not items:
            continue
        if shape == "UNREGISTERED-VESSEL" and not args.all:
            print(f"{shape}: {len(items)} (backlog; --all to name them)")
            continue
        print(f"{shape}: {len(items)}")
        for item in items:
            print(f"  - {item}")
    print()
    print(f"actionable drift: {drift}" if drift else "actionable drift: none")
    return 1 if drift else 0


if __name__ == "__main__":
    sys.exit(main())
