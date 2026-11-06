#!/usr/bin/env python3
"""Attach an HTML page to a GitHub issue as an artifact, or update the one already there.

    issue-artifact.py <owner/repo> <issue number> <page.html> [--name "Name"]

The name defaults to the page's <title>. An artifact of that name is updated, which keeps its
version history and its link, so a revision never adds a second copy. The body read back from
GitHub is compared with the file, and the artifact's link is printed last.

It uses the REST API through `gh api`, so it works with any gh that is signed in. The
`gh issue artifact` commands need gh 2.103 or later. Exit 0 attached, 1 refused, 2 bad arguments.
"""

import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys

API_VERSION = "2026-03-10"


def gh(method, path, payload=None):
    cmd = ["gh", "api", "--method", method, path,
           "-H", f"X-GitHub-Api-Version: {API_VERSION}", "-H", "Accept: application/vnd.github+json"]
    data = None
    if payload is not None:
        cmd += ["--input", "-"]
        data = json.dumps(payload)
    proc = subprocess.run(cmd, input=data, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stdout + proc.stderr).strip()[:600])
    return json.loads(proc.stdout) if proc.stdout.strip() else None


def artifact_of(answer):
    """GET answers with an artifact, or with {artifact, versions}."""
    return answer.get("artifact", answer)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("repo")
    ap.add_argument("issue", type=int)
    ap.add_argument("page")
    ap.add_argument("--name")
    args = ap.parse_args()

    page = pathlib.Path(args.page)
    if not page.is_file():
        print(f"issue-artifact: no such file: {page}", file=sys.stderr)
        return 2
    body = page.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", body, re.S | re.I)
    name = args.name or (title.group(1).strip() if title else page.stem)

    base = f"repos/{args.repo}/issues/{args.issue}/artifacts"
    try:
        current = [a for a in gh("GET", f"{base}?type=embedded_html&per_page=100") if a.get("name") == name]
        if current:
            done = gh("PATCH", f"{base}/{current[0]['number']}", {"name": name, "body": body})
            verb = "updated"
        else:
            done = gh("POST", base, {"type": "embedded_html", "name": name, "body": body})
            verb = "created"
        check = artifact_of(gh("GET", f"{base}/{done['number']}"))
    except RuntimeError as error:
        print(f"issue-artifact: GitHub refused: {error}", file=sys.stderr)
        return 1

    sent = hashlib.sha256(body.encode()).hexdigest()
    got = hashlib.sha256(check.get("body", "").encode()).hexdigest()
    if sent != got:
        print(f"issue-artifact: the body read back differs from {page}", file=sys.stderr)
        return 1
    print(f"{verb} artifact {done['number']} '{name}' ({len(body)} bytes, body verified)")
    print(check.get("html_url") or done.get("html_url"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
