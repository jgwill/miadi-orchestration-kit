#!/usr/bin/env python3
"""Exercise the installed Hermes loader/dispatcher in an isolated scratch home.

Inputs here are explicit test events, not claimed output from a model/provider.
"""

import argparse
import json
import os
from pathlib import Path
import tempfile

NAME = "miadi-session-observability"
SOURCE = Path(__file__).resolve().parents[1]


def rows(path):
    return [json.loads(x) for x in path.read_text().splitlines() if x.strip()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--isolation", choices=("in_process", "host"), default="in_process")
    args = parser.parse_args()
    scratch = Path(os.environ.get("TMPDIR", Path.home() / ".hermes" / "cache" / "scratch"))
    scratch.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hermes-observability-smoke-", dir=scratch) as temp:
        home = Path(temp) / "home"
        capture = Path(temp) / "capture"
        (home / "plugins").mkdir(parents=True)
        (home / "plugins" / NAME).symlink_to(SOURCE, target_is_directory=True)
        (home / "config.yaml").write_text("plugins:\n  enabled: [miadi-session-observability]\n"
                                          "  isolation: " + args.isolation + "\n")
        os.environ.update({"HERMES_HOME": str(home), "HERMES_SESSIONDATA_ROOT": str(capture)})
        # No inherited live pane: this test must not address the shared tmux server.
        for key in ("TMUX", "TMUX_PANE", "HERMES_SESSION_ID"):
            os.environ.pop(key, None)
        from hermes_cli.plugins import PluginManager, VALID_HOOKS
        import yaml
        expected = set(yaml.safe_load((SOURCE / "plugin.yaml").read_text())["provides_hooks"])
        assert expected <= VALID_HOOKS, "installed runtime lacks required hook contracts"
        manager = PluginManager()
        try:
            manager.discover_and_load()
            skill = manager.find_plugin_skill(NAME + ":session-continuity")
            assert skill and skill.is_file(), "continuity skill did not load"
            assert all(manager.has_hook(hook) for hook in expected), "lifecycle callbacks did not load"
            count = 0

            def fire(hook, sid="smoke-session", **kwargs):
                nonlocal count
                manager.invoke_hook(hook, session_id=sid, platform="cli", **kwargs)
                count += 1

            fire("on_session_start", model="smoke-fixture")
            fire("pre_llm_call", turn_id="t1", user_message="smoke fixture prompt")
            fire("pre_tool_call", tool_name="read_file", args={"path": "fixture.md"}, tool_call_id="c1", turn_id="t1")
            fire("post_tool_call", tool_name="read_file", args={"path": "fixture.md"}, result="fixture content",
                 tool_call_id="c1", turn_id="t1", status="ok")
            fire("post_tool_call", tool_name="terminal", args={"command": "false"}, result="fixture error",
                 tool_call_id="c2", turn_id="t1", status="error", error_type="FixtureError")
            fire("pre_approval_request", command="fixture command")
            fire("post_approval_response", command="fixture command", choice="deny")
            fire("subagent_start", child_session_id="child", task_id="task1")
            fire("subagent_stop", child_session_id="child", task_id="task1")
            fire("post_api_request", turn_id="t1", usage={"input_tokens": 11, "output_tokens": 7})
            fire("api_request_error", turn_id="t1", error={"type": "FixtureError"})
            fire("post_compaction", turn_id="t1")
            fire("post_llm_call", turn_id="t1", assistant_response="fixture reply",
                 conversation_history=[{"role": "user", "content": "fixture prompt"},
                                       {"role": "assistant", "content": "fixture reply"}])
            fire("on_session_end", turn_id="t1", completed=True)
            bindings = rows(capture / "smoke-session" / "_terminal_binding.jsonl")
            assert not any(x["event"] == "session.end" for x in bindings), "turn end falsely ended session"
            fire("pre_llm_call", sid="resume-without-start", turn_id="t2", user_message="resumed fixture")
            fire("on_session_end", sid="resume-without-start", turn_id="t2", interrupted=True, completed=False)
            fire("on_session_reset", sid="replacement", old_session_id="smoke-session", new_session_id="replacement")
            fire("on_session_finalize", sid="resume-without-start", reason="fixture exit")
            assert not (capture / "replacement").exists(), "reset closed the new identity"
            records = rows(capture / "data" / "hermes_hooks_all.jsonl")
            # Each pre_llm_call retains two legacy aliases.
            assert len(records) == count + 2, (len(records), count)
            assert len(rows(capture / "smoke-session" / "_hermes_post_tool_use.jsonl")) == 2
            assert len(rows(capture / "smoke-session" / "_hermes_history_latest.jsonl")) == 2
            assert rows(capture / "smoke-session" / "_terminal_binding.jsonl")[-1]["event"] == "session.end"
            assert rows(capture / "resume-without-start" / "_terminal_binding.jsonl")[-1]["event"] == "session.end"
            print(json.dumps({"result": "passed", "native_hook_firings": count,
                              "capture_records": len(records), "required_hooks": len(expected),
                              "skill": NAME + ":session-continuity", "provider_calls": 0,
                              "isolation": args.isolation,
                              "scope": "isolated installed-runtime lifecycle probe"}, indent=2))
        finally:
            manager.unload()
            host = getattr(manager, "_plugin_host_instance", None)
            if host is not None:
                host.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
