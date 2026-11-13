#!/usr/bin/env python3
"""Mask the credentials this host holds wherever a session recorded them.

    miadi-scrub-secrets.py            count what is there, change nothing
    miadi-scrub-secrets.py --apply    mask it

Prints names and counts, never a value. There is no undo and no backup, because a backup would
be one more copy of the values.

WHAT IT MASKS  The values of credentials in this environment and in the host's .env files
(variables named like one, passwords in URLs), also when only the first 16 characters or more
were printed. A value that looks like words, a number or a placeholder is left alone, so
`MIADI_AUTH_ISSUER=miadi-chronicle` does not blank every mention of the chronicle.

WHERE  $CODEX_HOME's sessions, archived_sessions and history.jsonl (~/.codex by default), and the
capture root's session folders and data/. --root adds a folder. A config or credential file met there (.env, .mcp.json,
settings.json) is listed and left alone, because a program may still load it.

HOW  Each value is overwritten in place by as many * as it has bytes. The file keeps its inode,
size and line offsets, and its JSON stays valid, so a session appending to it carries on, and
the transcript archive's offsets still hold. The mtime is put back, so `codex resume` keeps
its order. A running session holds its own values in memory
and may write them again: run this again after it ends.

NOT REACHED  What the model API already received.
"""
import argparse
import glob
import json
import math
import mmap
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hooks"))
sys.dont_write_bytecode = True
from secret_print_guard import LINE, is_credential_file, is_credential_name  # noqa: E402

PASSWORD_IN_URL = re.compile(r"://[^/\s:@]*:([^/\s@]+)@")
PLACEHOLDER = re.compile(r"test|fake|example|dummy|sample|fixture|placeholder|redacted|changeme|your[-_]", re.I)
SESSION_FOLDER = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
CONFIG_NAME = re.compile(r"\.mcp\.json|mcp_config\.json|settings(\.local)?\.json|config\.toml")
PREFIX = 16


def looks_secret(value, shortest=12):
    if len(value) < shortest or re.search(r"\s", value) or value[0] in "/~.$<{" or "://" in value:
        return False
    if re.fullmatch(r"[a-z]+(?:[-_.][a-z]+)*", value) or re.fullmatch(r"[\d.:]+", value) or PLACEHOLDER.search(value):
        return False
    counts = {c: value.count(c) for c in set(value)}
    return -sum(n / len(value) * math.log2(n / len(value)) for n in counts.values()) >= 3.0


def collect(name, value, held):
    value = value.strip().strip("\"'")
    for m in PASSWORD_IN_URL.finditer(value):
        if looks_secret(m[1], shortest=8):  # postgres://postgres:postgres@ must not blank the word.
            held.setdefault(m[1], name)
    if is_credential_name(name) and looks_secret(value):
        held.setdefault(value, name)


def held_values(env_files):
    held = {}
    for name, value in os.environ.items():
        collect(name, value, held)
    for path in env_files:
        try:
            with open(path, errors="replace") as fh:
                for line in fh:
                    m = LINE.match(line.rstrip("\n"))
                    if m:
                        collect(m[2], m[4], held)
        except OSError:
            pass
    return held


def default_env_files():
    home = os.path.expanduser("~")
    src = os.environ.get("MIADI_SRC", "")
    patterns = [f"{home}/.env", f"{home}/.env.*", f"{home}/.miadi/*.env", f"{home}/.miadi/.env", f"{home}/.config/miadi/*.env",
                "/src/.env*", "/src/Miadi/.env*", "/a/src/Miadi-18/.env*", "/a/src/Miadi/.env*", "/etc/miadi/*.env"]
    if src:
        patterns.append(f"{src}/.env*")
    return sorted({p for pattern in patterns for p in glob.glob(pattern)
                   if not p.endswith((".example", ".sample", ".template", ".dist"))})


def default_roots():
    home = os.path.expanduser("~")
    codex = os.environ.get("CODEX_HOME") or f"{home}/.codex"
    roots = [f"{codex}/sessions", f"{codex}/archived_sessions", f"{codex}/history.jsonl"]
    capture = {os.path.realpath(p) for p in (os.environ.get("CODEX_SESSIONDATA_ROOT"), os.environ.get("MIADI_SESSION_DIR"), os.environ.get("MIADI_SESSIONDATA_ROOT"),
                                             os.environ.get("SESSION_DATA_ROOT"), "/src/_sessiondata") if p}
    for root in sorted(capture):
        try:
            names = os.listdir(root)
        except OSError:
            continue
        roots += [os.path.join(root, n) for n in names if n == "data" or SESSION_FOLDER.fullmatch(n)]
    return roots


def files_under(roots):
    for root in roots:
        if os.path.isfile(root) and not os.path.islink(root):
            yield root
        for folder, _, names in os.walk(root):
            for name in names:
                path = os.path.join(folder, name)
                if not os.path.islink(path) and os.path.isfile(path):
                    yield path


def rg_matches(roots, by_prefix):
    """{file: [(offset, first bytes)]} from ripgrep: 3 s on 1.9 GB, where grep takes 90 and Python far longer."""
    rg = shutil.which("rg")
    if not rg:
        return None
    patterns = b"\n".join(by_prefix) + b"\n"
    found = {}
    for i in range(0, len(roots), 500):
        done = subprocess.run([rg, "--no-config", "-aFs", "--no-ignore", "--hidden", "--no-messages", "--no-heading",
                               "--with-filename", "--null", "-b", "-o", "-f", "-", "--"] + roots[i:i + 500],
                              input=patterns, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        for line in done.stdout.split(b"\n"):
            path, _, rest = line.partition(b"\0")
            offset, _, first = rest.partition(b":")
            if first in by_prefix:
                found.setdefault(os.fsdecode(path), []).append((int(offset), first))
    return found


def grep_files(roots, by_prefix):
    """Without ripgrep: the files that hold the first bytes of a value, for Python to search."""
    grep = shutil.which("grep")
    if not grep:
        yield from files_under(roots)
        return
    patterns = b"\n".join(by_prefix) + b"\n"
    for i in range(0, len(roots), 500):
        batch = roots[i:i + 500]
        done = subprocess.run([grep, "-rlaFs", "-f", "-", "--"] + batch, input=patterns,
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        if done.returncode not in (0, 1):
            yield from files_under(batch)
            continue
        yield from (os.fsdecode(path) for path in done.stdout.splitlines())


def build_search(held):
    """Each value by its first bytes, as written and as JSON writes it."""
    by_prefix = {}
    for value, name in held.items():
        for form in {value, json.dumps(value)[1:-1]}:
            raw = form.encode()
            by_prefix.setdefault(raw[:PREFIX], []).append((raw, name))
    pattern = b"|".join(re.escape(p) for p in sorted(by_prefix, key=len, reverse=True))
    return re.compile(pattern), by_prefix


def span_at(data, start, first, by_prefix):
    """(start, length, name) of a value, whole or cut short by what printed it."""
    best, name = 0, None
    for raw, who in by_prefix[first]:
        n = len(first)
        limit = min(len(raw), len(data) - start)
        while n < limit and data[start + n] == raw[n]:
            n += 1
        if n > best:
            best, name = n, who
    return start, best, name


def scrub(path, hits, search, by_prefix, apply):
    before = os.stat(path)
    if before.st_size == 0:
        return []
    with open(path, "rb") as fh, mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ) as data:
        if hits is None:
            hits = [(m.start(), m.group()) for m in search.finditer(data)]
        spans = [span_at(data, start, first, by_prefix) for start, first in hits]
    if spans and apply:
        with open(path, "r+b") as fh:
            for start, length, _ in spans:
                fh.seek(start)
                fh.write(b"*" * length)
        if os.stat(path).st_size == before.st_size:
            os.utime(path, ns=(before.st_atime_ns, before.st_mtime_ns))
    return spans


def main():
    parser = argparse.ArgumentParser(description="Mask the credentials this host holds wherever a session recorded them.")
    parser.add_argument("--apply", action="store_true", help="mask them; without this it only counts")
    parser.add_argument("--root", action="append", default=[], help="another file or folder to go over")
    parser.add_argument("--env-file", action="append", default=[], help="another file of NAME=value credentials")
    parser.add_argument("--only-roots", action="store_true", help="skip the default folders and .env files")
    args = parser.parse_args()

    held = held_values(args.env_file + ([] if args.only_roots else default_env_files()))
    if not held:
        print("no credentials found to look for")
        return 0
    search, by_prefix = build_search(held)
    names, files = {}, {}
    changed = refused = 0
    config = []
    roots = args.root + ([] if args.only_roots else default_roots())
    found = rg_matches(roots, by_prefix)
    targets = found.items() if found is not None else ((path, None) for path in grep_files(roots, by_prefix))
    for path, hits in targets:
        if os.path.islink(path) or not os.path.isfile(path):
            continue
        copy = "/proposed/" in path or "/written/" in path  # What the capture copied, which nothing loads.
        if not copy and (is_credential_file(path) or CONFIG_NAME.fullmatch(os.path.basename(path))):
            config.append(path)
            continue
        try:
            spans = scrub(path, hits, search, by_prefix, args.apply)
        except (OSError, ValueError):
            refused += 1  # Another account's file, or one that went away.
            continue
        changed += bool(spans)
        for _, _, name in spans:
            names[name] = names.get(name, 0) + 1
            files.setdefault(name, set()).add(path)

    verb = "masked" if args.apply else "found"
    print(f"{len(held)} values looked for, {changed} files hold one"
          + (f", {refused} files could not be opened" if refused else ""))
    for name, count in sorted(names.items(), key=lambda kv: -kv[1]):
        print(f"  {count:6d} {verb} in {len(files[name]):5d} files  {name}")
    for path in sorted(config):
        print(f"  left alone, a program may load it: {path}")
    if not names:
        print("  nothing to mask")
    elif not args.apply:
        print("nothing changed. --apply masks them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
