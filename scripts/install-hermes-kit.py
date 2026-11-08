#!/usr/bin/env python3
"""Stage checkout-native Hermes plugins in one selected home; dry run by default.

Enabling uses Hermes's public CLI, never direct MCP/config edits. Miette cannot
be enabled while legacy capture hooks still launch their old plan perspective.
"""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import subprocess

import yaml

KIT = Path(__file__).resolve().parents[1]
NAMES = ("miadi-session-observability", "miadi-chronicle-episode-kit", "miette-plan-insight")


def install(home, names, apply=False, enable=False):
    home = Path(home).expanduser().absolute()
    config = home / "config.yaml"
    if config.is_symlink() or not config.is_file():
        raise ValueError("selected home needs a regular config.yaml")
    original = config.read_text()
    cfg = yaml.safe_load(original)
    if not isinstance(cfg, dict):
        raise ValueError("config must be a mapping")
    if enable and "miette-plan-insight" in names:
        for hooks in (cfg.get("hooks") or {}).values():
            if any(isinstance(h, dict) and "hermes_hooks/" in h.get("command", "") for h in hooks):
                raise ValueError("cut over legacy observability before enabling Miette; otherwise two plan-review implementations run")
    plugins = home / "plugins"
    if plugins.is_symlink():
        raise ValueError("plugins directory must not be a symlink")
    targets = []
    for name in names:
        if name not in NAMES:
            raise ValueError("unknown kit plugin")
        source, target = KIT / "hermes-agent" / name, plugins / name
        if not (source / "plugin.yaml").is_file():
            raise ValueError("plugin source is unavailable")
        if (target.exists() or target.is_symlink()) and (not target.is_symlink() or target.resolve() != source):
            raise ValueError("plugin destination belongs to another installation; nothing overwritten")
        targets.append((name, source, target))
    if not apply:
        return {"applied": False, "home": str(home), "plugins": list(names), "enable": enable}
    plugins.mkdir(mode=0o700, exist_ok=True)
    for name, source, target in targets:
        if not target.is_symlink():
            target.symlink_to(source, target_is_directory=True)
        if target.resolve() != source:
            raise ValueError("plugin target failed read-back")
    backup = None
    if enable:
        binary = shutil.which("hermes")
        if not binary:
            raise ValueError("Hermes CLI is unavailable; plugins were staged, not enabled")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        backup = home / ("config.yaml.bak." + stamp + "-before-kit-plugins")
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as stream:
            stream.write(original)
        for name in names:
            result = subprocess.run([binary, "plugins", "enable", name], capture_output=True, text=True,
                                    timeout=60, env={**os.environ, "HERMES_HOME": str(home)})
            if result.returncode:
                raise ValueError("Hermes did not enable every selected plugin; inspect plugin status before retrying")
    after = yaml.safe_load(config.read_text())
    if not enable and config.read_text() != original:
        raise ValueError("config changed during staging; review it before proceeding")
    enabled = (after.get("plugins") or {}).get("enabled") or []
    disabled = (after.get("plugins") or {}).get("disabled") or []
    if enable and any(n not in enabled or n in disabled for n in names):
        raise ValueError("enabled state failed read-back")
    return {"applied": True, "home": str(home), "plugins": list(names), "enable_requested": enable,
            "enabled_plugins": [n for n in names if n in enabled and n not in disabled],
            "config_changed": config.read_text() != original, "backup": str(backup) if backup else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", default=os.environ.get("HERMES_HOME", "~/.hermes"))
    parser.add_argument("--plugin", action="append", choices=NAMES)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--enable", action="store_true", help="Opt in through Hermes CLI; requires a coordinated restart")
    args = parser.parse_args()
    try:
        result = install(args.home, args.plugin or NAMES, args.apply, args.enable)
    except (OSError, ValueError, subprocess.SubprocessError, yaml.YAMLError) as exc:
        print("Installation refused (" + type(exc).__name__ + "). No config/credential contents printed.")
        return 1
    print(json.dumps(result, indent=2))
    print("No gateway restarted. Staging alone does not activate plugins; coordinate cutover/restart before enablement.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
