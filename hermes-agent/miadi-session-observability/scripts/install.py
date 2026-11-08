#!/usr/bin/env python3
"""Opt-in, single-profile cutover; dry run unless --apply is supplied.

Only hooks/plugins YAML blocks are rewritten. Other config (including secrets)
never goes to stdout. A private backup precedes any change. Uses Hermes's PyYAML.
"""

import argparse
from datetime import datetime, timezone
import fcntl
import os
from pathlib import Path
import shlex
import sys
import tempfile

import yaml

NAME = "miadi-session-observability"
LEGACY_SCRIPTS = {
    "session_start_hook.sh", "session_end_hook.sh", "pre_tool_use_hook.sh",
    "post_tool_use_hook.sh", "subagent_start_hook.sh", "subagent_stop_hook.sh",
    "permission_request_hook.sh", "accepted_redirection_hook.sh",
    "user_prompt_submit_hook.sh", "corrective_feedback_hook.sh", "notification_hook.sh",
}
LEGACY_ROOTS = ("/opt/binscripts/hooks/hermes_hooks/", "$MIADI_HOOKS_SCRIPT_DIR/hermes_hooks/",
                "${MIADI_HOOKS_SCRIPT_DIR}/hermes_hooks/")


def legacy_command(entry):
    if not isinstance(entry, dict) or not isinstance(entry.get("command"), str):
        return False
    try:
        words = shlex.split(entry["command"])
    except ValueError:
        return False
    if len(words) == 2 and words[0] in ("bash", "/bin/bash", "/usr/bin/bash"):
        words = words[1:]
    return len(words) == 1 and any(words[0] == root + name
                                  for root in LEGACY_ROOTS for name in LEGACY_SCRIPTS)


def transform(original):
    node = yaml.compose(original)
    cfg = yaml.safe_load(original)
    if not isinstance(cfg, dict) or not isinstance(node, yaml.MappingNode):
        raise ValueError("config must be a YAML mapping")
    keys = [key.value for key, _ in node.value]
    if len(keys) != len(set(keys)):
        raise ValueError("duplicate top-level config keys require manual review")
    # Anchors across a replaced block could change unrelated configuration.
    if any(isinstance(token, (yaml.tokens.AnchorToken, yaml.tokens.AliasToken)) for token in yaml.scan(original)):
        raise ValueError("YAML anchors/aliases require manual cutover")
    hooks = cfg.get("hooks") or {}
    plugins = cfg.get("plugins") or {}
    if not isinstance(hooks, dict) or not isinstance(plugins, dict):
        raise ValueError("hooks and plugins must be mappings")
    kept, removed = {}, 0
    for event, entries in hooks.items():
        if not isinstance(entries, list):
            raise ValueError("hook event entries must be lists")
        remaining = [entry for entry in entries if not legacy_command(entry)]
        removed += len(entries) - len(remaining)
        if remaining:
            kept[event] = remaining
    plugins = dict(plugins)
    enabled, disabled = plugins.get("enabled") or [], plugins.get("disabled") or []
    if not isinstance(enabled, list) or not isinstance(disabled, list):
        raise ValueError("plugin enabled/disabled must be lists")
    plugins["enabled"] = list(enabled) if NAME in enabled else [*enabled, NAME]
    plugins["disabled"] = [name for name in disabled if name != NAME]
    replacement = {"hooks": kept, "plugins": plugins}
    edits = []
    for key, value in node.value:
        if key.value not in replacement:
            continue
        start, end = key.start_mark.index, value.end_mark.index
        block = original[start:end].splitlines(keepends=True)
        # Preserve comments/whitespace preceding the next unrelated block.
        while block and (not block[-1].strip() or block[-1].lstrip().startswith("#")):
            end -= len(block.pop())
        new = yaml.safe_dump({key.value: replacement.pop(key.value)}, sort_keys=False)
        edits.append((start, end, new))
    updated = original
    for start, end, new in sorted(edits, reverse=True):
        updated = updated[:start] + new + updated[end:]
    for key, value in replacement.items():
        updated = updated.rstrip("\n") + "\n" + yaml.safe_dump({key: value}, sort_keys=False)
    # Semantic proof: no unrelated config key changed, and no targeted hook remains.
    after = yaml.safe_load(updated)
    for key in cfg.keys() - {"hooks", "plugins"}:
        if cfg[key] != after[key]:
            raise ValueError("cutover would change unrelated config")
    return updated, removed


def install(home, source, apply=False, stage=False):
    home, source = Path(home).expanduser().absolute(), Path(source).resolve()
    config = home / "config.yaml"
    if config.is_symlink() or not config.is_file():
        raise ValueError("expected a regular config.yaml in the selected Hermes home")
    if not (source / "plugin.yaml").is_file() or not (source / "__init__.py").is_file():
        raise ValueError("source is not the native observability plugin")
    original = config.read_text()
    updated, removed = transform(original)
    if stage:
        cfg = yaml.safe_load(original)
        plugins = cfg.get("plugins") or {}
        if NAME in (plugins.get("enabled") or []) and NAME not in (plugins.get("disabled") or []):
            raise ValueError("plugin is already enabled; staging must not change live configuration")
        updated, removed = original, 0
    link = home / "plugins" / NAME
    if (link.exists() or link.is_symlink()) and (not link.is_symlink() or link.resolve() != source):
        raise ValueError("plugin destination already exists and is not this source; refusing to overwrite it")
    result = {"home": str(home), "plugin": str(link), "legacy_hooks_removed": removed,
              "config_changed": updated != original, "staged_only": stage, "applied": False}
    if not apply:
        return result
    lock_fd = os.open(home / ".observability-cutover.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "r+") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if config.read_text() != original:
            raise ValueError("config changed during cutover; retry after reviewing it")
        if link.parent.is_symlink():
            raise ValueError("plugins directory must not be a symlink")
        link.parent.mkdir(mode=0o700, exist_ok=True)
        created_link = False
        temporary = None
        try:
            if updated != original:
                stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
                backup = home / ("config.yaml.bak." + stamp + "-before-observability")
                fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "w") as stream:
                    stream.write(original)
                    stream.flush()
                    os.fsync(stream.fileno())
                result["backup"] = str(backup)
                fd, temporary = tempfile.mkstemp(prefix=".observability-config-", dir=home)
                with os.fdopen(fd, "w") as stream:
                    stream.write(updated)
                    stream.flush()
                    os.fsync(stream.fileno())
            if not link.is_symlink():
                link.symlink_to(source, target_is_directory=True)
                created_link = True
            if config.read_text() != original:
                raise ValueError("config changed before replacement; cutover aborted")
            if temporary:
                os.replace(temporary, config)
            result["applied"] = True
        except Exception:
            if created_link:
                link.unlink()
            raise
        finally:
            if temporary:
                Path(temporary).unlink(missing_ok=True)
    # Read back the exact targets; do not report success on a write's return alone.
    if link.resolve() != source or config.read_text() != updated:
        raise ValueError("cutover read-back verification failed")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--home", type=Path, default=Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser())
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--stage", action="store_true",
                        help="Install the plugin symlink only; keep config and legacy hooks unchanged/active")
    args = parser.parse_args()
    try:
        result = install(args.home, args.source, args.apply, args.stage)
    except (OSError, ValueError, yaml.YAMLError) as exc:
        # Parser exceptions can quote config lines containing credentials.
        print("Cutover refused (" + type(exc).__name__ + "); config/credentials were not printed.", file=sys.stderr)
        return 1
    for key, value in result.items():
        print(str(key) + ": " + str(value))
    if args.stage:
        print("Staged disabled; legacy hooks remain active. Apply without --stage when ready to restart Hermes.")
    else:
        print("Restart Hermes immediately after apply; existing processes do not hot-swap plugins.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
