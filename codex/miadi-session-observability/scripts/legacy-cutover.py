#!/usr/bin/env python3
"""Back up user hooks and their dependencies, then remove only legacy capture wiring.

Usage: legacy-cutover.py backup [--home ~/.codex]
       legacy-cutover.py clear --backup BACKUP [--home ~/.codex]
Installation, hook trust review and runtime verification precede `clear`.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import sys
import tempfile

LEGACY = re.compile(r"(?:^|/)codex_hooks/[a-z_]+_hook\.sh$")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def legacy_command(command):
    try:
        return any(LEGACY.search(part) for part in shlex.split(command))
    except ValueError:
        return False


def backup(home):
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    target = home / "backups" / ("session-observability-" + stamp)
    target.mkdir(parents=True, mode=0o700)
    manifest = {"home": str(home), "files": {}}

    def keep(source, relative):
        if not source.is_file():
            return
        dest = target / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        os.chmod(dest, 0o600)
        manifest["files"][str(relative)] = {"source": str(source), "sha256": sha(dest)}

    for name in ("hooks.json", "config.toml"):
        keep(home / name, Path(name))
    hooks = json.loads((home / "hooks.json").read_text()) if (home / "hooks.json").exists() else {}
    for groups in hooks.get("hooks", {}).values():
        for group in groups:
            for handler in group.get("hooks", []):
                command = handler.get("command", "")
                if not legacy_command(command):
                    continue
                for part in shlex.split(command):
                    if LEGACY.search(part):
                        directory = Path(part).resolve().parent
                        for path in directory.iterdir():
                            if path.is_file():
                                keep(path, Path("scripts") / path.name)
                        for name in ("secret_capture_sanitizer.sh", "git_command_validator.sh"):
                            keep(directory.parent / name, Path("dependencies") / name)
    if (home / "hooks").is_dir():
        for path in (home / "hooks").rglob("*"):
            if path.is_file():
                keep(path, path.relative_to(home))
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return target


def clear(home, target):
    manifest = json.loads((target / "manifest.json").read_text())
    if manifest["home"] != str(home):
        raise ValueError("Backup belongs to another Codex home")
    for relative, record in manifest["files"].items():
        if sha(target / relative) != record["sha256"]:
            raise ValueError("Backup checksum mismatch: " + relative)
    path = home / "hooks.json"
    if not path.exists():
        return 0
    record = manifest["files"].get("hooks.json")
    if not record or sha(path) != record["sha256"]:
        raise ValueError("hooks.json changed since backup; take a fresh backup")
    config = json.loads(path.read_text())
    removed = 0
    for event, groups in list(config.get("hooks", {}).items()):
        remaining = []
        for group in groups:
            kept = []
            for handler in group.get("hooks", []):
                if legacy_command(handler.get("command", "")):
                    removed += 1
                else:
                    kept.append(handler)
            if kept:
                remaining.append({**group, "hooks": kept})
        if remaining:
            config["hooks"][event] = remaining
        else:
            del config["hooks"][event]
    fd, tmp = tempfile.mkstemp(dir=home, prefix=".hooks.json.")
    try:
        with os.fdopen(fd, "w") as out:
            json.dump(config, out, indent=2)
            out.write("\n")
        os.chmod(tmp, path.stat().st_mode & 0o777)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return removed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("backup", "clear"))
    parser.add_argument("--home", type=Path, default=Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))))
    parser.add_argument("--backup", type=Path)
    args = parser.parse_args()
    home = args.home.resolve()
    if args.action == "backup":
        print(backup(home))
    elif not args.backup:
        parser.error("clear requires --backup")
    else:
        print(json.dumps({"removed_legacy_handlers": clear(home, args.backup.resolve())}))


if __name__ == "__main__":
    main()
