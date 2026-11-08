#!/usr/bin/env python3
"""Real installed-runtime coexistence probe; explicit fixtures, no model/reviewer.

Optional --live-ref reads one real episode through the existing bridge. Nothing
mints, publishes, registers a perspective, or addresses the live tmux server.
"""

import argparse
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace

KIT = Path(__file__).resolve().parents[2]
NAMES = ("miadi-session-observability", "miadi-chronicle-episode-kit", "miette-plan-insight")


def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--isolation", choices=("in_process", "host"), default="in_process")
    parser.add_argument("--live-ref", help="Read this real episode through the installed Miadi bridge")
    args = parser.parse_args()
    real_home = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
    miadi = (real_home / "plugins/miadi").resolve()
    if not (miadi / "plugin.yaml").is_file():
        raise RuntimeError("probe requires the existing Miadi bridge installation")
    with tempfile.TemporaryDirectory(prefix="hermes-feature-probe-", dir=os.environ.get("TMPDIR")) as temp:
        root = Path(temp)
        home, capture, work = root / "home", root / "capture", root / "work"
        (home / "plugins").mkdir(parents=True)
        work.mkdir()
        (home / "plugins/miadi").symlink_to(miadi, target_is_directory=True)
        for name in NAMES:
            (home / "plugins" / name).symlink_to(KIT / "hermes-agent" / name, target_is_directory=True)
        (home / "config.yaml").write_text("plugins:\n  enabled: [miadi, " + ", ".join(NAMES) + "]\n  isolation: " + args.isolation + "\n")
        os.environ.update({"HERMES_HOME": str(home), "MIADI_ORCHESTRATION_KIT_ROOT": str(KIT),
                           "MIADI_SESSION_DIR": str(capture), "MIADI_SESSIONDATA_ROOT": str(capture),
                           "HERMES_SESSIONDATA_ROOT": str(capture), "MIADI_CHRONICLE_ROOT": str(root / "chronicle"),
                           "MIADI_MIETTE_STATE_DIR": str(root / "plan-state")})
        for key in ("TMUX", "TMUX_PANE", "HERMES_SESSION_ID", "MIADI_MIETTE_SEAT"):
            os.environ.pop(key, None)
        from hermes_cli.plugins import PluginManager
        manager = PluginManager()
        # Model the real classic-CLI binding context; no agent or provider is constructed.
        setattr(manager, "_cli_ref", SimpleNamespace(agent=None))
        try:
            manager.discover_and_load()
            for key in ("miadi", *NAMES):
                assert manager._plugins[key].error is None, (key, manager._plugins[key].error)
            for name, skill in ((NAMES[0], "session-continuity"), (NAMES[1], "chronicle-episode"),
                                (NAMES[1], "screenwalk-names"), (NAMES[2], "miette-plan-insight"), (NAMES[2], "plan-critic")):
                assert manager.find_plugin_skill(name + ":" + skill)
            manager.invoke_hook("on_session_start", session_id="probe-session", platform="cli")
            assert len(rows(capture / "data/session_index.jsonl")) == 1, "two plugins indexed one session"
            assert (capture / "probe-session/_hermes_session_start.jsonl").is_file()
            assert not (capture / "probe-session/.observability-binding.json").exists(), "capture stole bridge ownership"
            block = manager.invoke_hook("pre_tool_call", session_id="probe-session", tool_name="write_file",
                                        args={"path": str(root / "chronicle/new/file.md")}, platform="cli")
            assert any(isinstance(r, dict) and r.get("action") == "block" for r in block)
            text = "Episode 573 is ready to inspect."
            rewrites = manager.invoke_hook("transform_llm_output", response_text=text, session_id="probe-session")
            assert any(isinstance(r, str) and r.startswith(text) and "miadi-chronicle://573" in r for r in rewrites)
            result = {"result": "passed", "isolation": args.isolation,
                      "loaded_plugins": ["miadi", *NAMES], "single_session_index_record": True,
                      "native_guard": "blocked fixture vessel", "address_transform": "preserved complete reply",
                      "provider_calls": 0, "live_episode_writes": 0}
            if args.live_ref:
                handler = manager._plugin_commands["episode-status"]["handler"]
                status = json.loads(handler(args.live_ref))
                assert status.get("status") == 200, status.get("error", "HTTP failure")
                body = status["body"]
                assert len(body["closing"]) == 5
                result["live_status"] = {"http": status["status"], "episode": body["episode"],
                                         "stages": [{"stage": v["stage"], "state": v["state"]} for v in body["closing"]]}
            print(json.dumps(result, indent=2))
        finally:
            manager.unload()
            host = getattr(manager, "_plugin_host_instance", None)
            if host is not None:
                host.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
