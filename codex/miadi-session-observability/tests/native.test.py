#!/usr/bin/env python3
"""Codex-specific integration tests: real dispatcher payloads and archive recovery."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

PLUGIN = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("native", PLUGIN / "hooks/codex_hooks/native.py")
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
cutover_spec = importlib.util.spec_from_file_location("cutover", PLUGIN / "scripts/legacy-cutover.py")
cutover = importlib.util.module_from_spec(cutover_spec)
cutover_spec.loader.exec_module(cutover)


class Capture(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / "root"
        self.home = self.base / "codex"
        self.project = self.base / "project"
        self.project.mkdir()
        self.env = {**os.environ, "CODEX_SESSIONDATA_ROOT": str(self.root), "CODEX_HOME": str(self.home),
                    "MIADI_TEAM": "T1", "MIADI_SESSION_NAME": "fixture",
                    "XDG_STATE_HOME": str(self.base / "state")}
        self.working = self.base / "state/miadi/working"
        native.CODEX_HOME = self.home
        self.out = self.root / "test-session"
        self.out.mkdir(parents=True)

    def event(self, event, **kw):
        data = {"session_id": "test-session", "cwd": str(self.project),
                "hook_event_name": event, "turn_id": "turn-fixture", **kw}
        result = subprocess.run(["bash", str(PLUGIN / "hooks/codex_hooks/dispatch.sh"), event],
                                input=json.dumps(data), text=True, capture_output=True, env=self.env)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")
        return data

    def lines(self, name):
        return [json.loads(line) for line in (self.out / name).read_text().splitlines()]

    def wait_for(self, predicate):
        end = time.monotonic() + 15
        while time.monotonic() < end:
            if predicate():
                return
            time.sleep(.05)
        self.fail("detached capture did not finish")

    def test_all_native_events_are_silent_and_recorded_once(self):
        hooks = json.loads((PLUGIN / "hooks/hooks.json").read_text())["hooks"]
        self.assertEqual(len(hooks), 12)
        self.assertNotIn("Notification", hooks)
        self.assertNotIn("PostToolUseFailure", hooks)
        for event in hooks:
            self.event(event, prompt="a fresh request", tool_name="read_file", tool_use_id="event-call",
                       tool_input={})
            self.wait_for(lambda: (self.out / ("_codex_" + event + ".jsonl")).exists() and bool(self.lines("_codex_" + event + ".jsonl")))
            self.assertEqual(len(self.lines("_codex_" + event + ".jsonl")), 1)
        self.wait_for(lambda: '"event":"session.end"' in (self.out / "_terminal_binding.jsonl").read_text())
        bindings = self.lines("_terminal_binding.jsonl")
        self.assertEqual(bindings[0]["agent"], "codex")
        self.assertEqual(bindings[0]["team"]["id"], "T1")
        self.assertEqual(bindings[-1]["event"], "session.end")

    def test_failed_shell_preserves_output_and_captures_written_file(self):
        fields = {"tool_name": "Bash", "tool_use_id": "failed-shell", "tool_input": {"command": "write then fail"}}
        self.event("PreToolUse", **fields)
        path = self.project / "partial.txt"
        path.write_text("partial work survives a failure\n")
        self.event("PostToolUse", **fields, tool_response="Process exited with code 7\nOutput: failed")
        self.wait_for(lambda: (self.out / "_codex_files_written.jsonl").exists() and bool(self.lines("_codex_files_written.jsonl")))
        failure = self.lines("_codex_PostToolUseFailure.jsonl")[0]
        self.assertEqual(failure["codex_tool_exit_code"], 7)
        self.assertEqual(self.lines("_codex_PostToolUse.jsonl")[0]["tool_response"], "Process exited with code 7\nOutput: failed")
        index = self.lines("_codex_files_written.jsonl")[0]
        self.assertEqual(index["prompt_id"], "turn-fixture")
        self.assertEqual((self.out / index["copy"]).read_text(), path.read_text())

    def test_patch_targets_outside_cwd_are_copied_and_credentials_only_listed(self):
        target = self.base / "outside.txt"
        secret = self.base / "prod.env"
        target.write_text("outside cwd\n")
        secret.write_text("unknown-password-on-its-own\n")
        patch = f"*** Begin Patch\n*** Add File: {target}\n+outside cwd\n*** Add File: {secret}\n+password\n*** End Patch"
        self.event("PreToolUse", tool_name="apply_patch", tool_use_id="patch-call", tool_input={"command": patch})
        self.event("PostToolUse", tool_name="apply_patch", tool_use_id="patch-call", tool_input={"command": patch}, tool_response="Success")
        index = self.out / "_codex_files_written.jsonl"
        self.wait_for(lambda: index.exists() and len(index.read_text().splitlines()) == 2)
        records = {entry["path"]: entry for entry in self.lines(index.name)}
        self.assertEqual((self.out / records[str(target)]["copy"]).read_text(), target.read_text())
        self.assertIsNone(records[str(secret)]["copy"])
        self.assertIsNone(records[str(secret)]["sha256"])

    def test_rollout_archive_incremental_partial_truncate_replace_and_sanitize(self):
        transcript = self.base / "rollout.jsonl"
        token = "ghp_" + "testsecret0123456789" * 2
        first = json.dumps({"type": "response_item", "payload": {"type": "message", "role": "assistant", "content": token}}) + "\n"
        transcript.write_text(first + '{"partial":')
        native.archive(transcript, self.out)
        dest = self.out / "_transcript_final.jsonl"
        self.assertNotIn(token, dest.read_text())
        self.assertEqual(len(dest.read_text().splitlines()), 1)
        with transcript.open("a") as f:
            f.write('true}\n')
        native.archive(transcript, self.out)
        native.archive(transcript, self.out)
        self.assertEqual(len(dest.read_text().splitlines()), 2)
        self.assertEqual(len(self.lines("_responses_progressive.jsonl")), 1)
        transcript.write_text('{"rewritten":true}\n')
        native.archive(transcript, self.out)
        self.assertEqual(dest.read_text(), transcript.read_text())
        replacement = self.base / "new.jsonl"
        replacement.write_text('{"replacement":1}\n')
        replacement.replace(transcript)
        native.archive(transcript, self.out)
        self.assertEqual(dest.read_text(), transcript.read_text())
        dest.write_text("damaged-copy\n")
        native.archive(transcript, self.out)
        self.assertEqual(dest.read_text(), transcript.read_text())

    def test_subagent_transcript_survives_and_has_metadata(self):
        transcript = self.base / "child.jsonl"
        transcript.write_text('{"child":"record"}\n')
        self.event("SubagentStop", agent_id="child-id", agent_type="worker", agent_transcript_path=str(transcript))
        dest = self.out / "agents/child-id.transcript.jsonl"
        self.wait_for(dest.exists)
        self.assertEqual(dest.read_text(), transcript.read_text())
        self.assertEqual(json.loads((self.out / "agents/child-id.meta.json").read_text())["agent_id"], "child-id")

    def test_sweep_recovers_abruptly_ended_sessions_and_children(self):
        directory = self.home / "sessions/2026/10/22"
        directory.mkdir(parents=True)
        main = directory / "rollout-main.jsonl"
        main.write_text(json.dumps({"type": "session_meta", "payload": {"id": "test-session"}}) + "\n")
        child = directory / "rollout-child.jsonl"
        child.write_text(json.dumps({"type": "session_meta", "payload": {"id": "child-sweep", "source": {"subagent": {"thread_spawn": {"parent_thread_id": "test-session"}}}}}) + "\n")
        native.sweep(self.root)
        self.assertEqual((self.out / "_transcript_final.jsonl").read_text(), main.read_text())
        self.assertEqual((self.out / "agents/child-sweep.transcript.jsonl").read_text(), child.read_text())

    def test_github_connector_write_is_indexed_but_read_is_not(self):
        response = {"structuredContent": {"issue": {"url": "https://github.com/acme/project/issues/42"}}}
        for name in ("mcp__codex_apps__github_create_issue", "mcp__codex_apps__github_fetch_issue"):
            self.event("PostToolUse", tool_name=name, tool_use_id="github-call", tool_input={}, tool_response=response)
        records = self.lines("_codex_publications.jsonl")
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["kind"], "issue")
        self.assertEqual(records[0]["prompt_id"], "turn-fixture")

    def test_a_prompt_keeps_the_working_marker_until_the_reply_ends(self):
        self.event("UserPromptSubmit", prompt="keep   the marker\nfor tide")
        marker = json.loads((self.working / "test-session.json").read_text())
        self.assertEqual((marker["harness"], marker["prompt"], marker["turn_id"]),
                         ("codex", "keep the marker for tide", "turn-fixture"))
        self.event("Stop", last_assistant_message="done")
        self.assertFalse((self.working / "test-session.json").exists())
        self.event("UserPromptSubmit", prompt="again")
        self.event("Interrupt")
        self.assertFalse((self.working / "test-session.json").exists())

    def test_live_neighbours_in_the_repository_are_named_to_the_agent(self):
        (self.project / ".git").mkdir()
        self.working.mkdir(parents=True)
        sleeper = subprocess.Popen(["sleep", "30"])
        self.addCleanup(sleeper.wait)
        self.addCleanup(sleeper.kill)  # cleanups run last-in first: kill, then wait
        neighbours = {
            "claude-neighbour": {"cwd": str(self.project), "prompt": "fix the binding", "agent_pid": sleeper.pid},
            "gone-neighbour": {"cwd": str(self.project), "prompt": "ended", "agent_pid": 2 ** 22 + 7},
            "elsewhere": {"cwd": str(self.base), "prompt": "other repo", "agent_pid": sleeper.pid},
        }
        for sid, fields in neighbours.items():
            (self.working / (sid + ".json")).write_text(json.dumps(
                {"session_id": sid, "started_at": "2026-11-14T18:00:00Z", **fields}))
        (self.root / "claude-neighbour").mkdir(parents=True)
        (self.root / "claude-neighbour/_claude_files_written.jsonl").write_text(
            json.dumps({"path": str(self.project.resolve() / "lib/binding.sh")}) + "\n")
        data = {"session_id": "test-session", "cwd": str(self.project / "sub"), "turn_id": "t",
                "hook_event_name": "UserPromptSubmit", "prompt": "work here"}
        (self.project / "sub").mkdir()
        result = subprocess.run(["bash", str(PLUGIN / "hooks/codex_hooks/dispatch.sh"), "UserPromptSubmit"],
                                input=json.dumps(data), text=True, capture_output=True, env=self.env)
        self.assertEqual(result.returncode, 0, result.stderr)
        out = json.loads(result.stdout)["hookSpecificOutput"]
        self.assertEqual(out["hookEventName"], "UserPromptSubmit")
        self.assertIn("claude-neighbour", out["additionalContext"])
        self.assertIn("fix the binding", out["additionalContext"])
        self.assertIn("Recent files: lib/binding.sh", out["additionalContext"])
        self.assertNotIn("gone-neighbour", out["additionalContext"])
        self.assertNotIn("elsewhere", out["additionalContext"])
        self.assertNotIn("test-session", out["additionalContext"])

    def test_plan_mode_plan_is_kept_once_with_the_claude_plan_name(self):
        # The record shape of rollout 01a1db2b (Codex 0.169, 2026-11-14): the plan is its own
        # item and Stop's last_assistant_message carries only "🧠: \n".
        rollout = self.base / "rollout-plan.jsonl"
        plan = "# Factory Next-Cycle Plan\n\n## Summary\n\nOne bounded priority per team. token ghp_" + "a" * 36
        lines = [
            {"timestamp": "2026-11-14T17:46:43.000Z", "type": "session_meta", "payload": {"id": "test-session"}},
            {"timestamp": "2026-11-14T17:49:47.887Z", "ordinal": 124, "type": "event_msg", "payload": {
                "type": "item_completed", "thread_id": "test-session", "turn_id": "turn-a",
                "item": {"type": "Plan", "id": "turn-a-plan", "text": plan}}},
            {"timestamp": "2026-11-14T17:49:47.892Z", "type": "response_item", "payload": {
                "type": "message", "role": "assistant", "content": [{"type": "output_text",
                "text": "🧠: \n<proposed_plan>\n" + plan + "\n</proposed_plan>"}],
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-a"}}},
            # An older rollout with no Plan item: the block in the message stands in.
            {"timestamp": "2026-11-14T18:10:00.000Z", "type": "response_item", "payload": {
                "type": "message", "role": "assistant", "content": [{"type": "output_text",
                "text": "<proposed_plan>\n# Second plan\n</proposed_plan>"}],
                "internal_chat_message_metadata_passthrough": {"turn_id": "turn-b"}}},
        ]
        rollout.write_text("".join(json.dumps(line) + "\n" for line in lines))
        native.archive(rollout, self.out)
        native.archive(rollout, self.out)  # every Stop archives again; a plan is kept once
        index = self.lines("_codex_plans.jsonl")
        self.assertEqual([(r["turn_id"], r["source"]) for r in index],
                         [("turn-a", "codex Plan item"), ("turn-b", "codex <proposed_plan> block")])
        first = (self.out / index[0]["path"]).read_text()
        self.assertRegex(index[0]["path"], r"^plans/session_test-session_\d{10}\.md$")
        self.assertIn("plan_id: turn-a-plan", first)
        self.assertIn("harness: codex", first)
        self.assertIn("# Factory Next-Cycle Plan", first)
        self.assertNotIn("ghp_" + "a" * 36, first)
        self.assertIn("# Second plan", (self.out / index[1]["path"]).read_text())

    def test_stop_restores_the_plan_codex_left_out_of_the_reply(self):
        rollout = self.base / "rollout-stop.jsonl"
        plan = "# Plan\n\nStep one. key sk-ant-" + "b" * 40
        rollout.write_text(json.dumps({"type": "event_msg", "payload": {
            "type": "item_completed", "turn_id": "turn-fixture",
            "item": {"type": "Plan", "id": "turn-fixture-plan", "text": plan}}}) + "\n")
        self.event("Stop", last_assistant_message="🧠: \n", transcript_path=str(rollout))
        reply = self.lines("_codex_AssistantResponse.jsonl")[-1]
        self.assertEqual(reply["stop_last_assistant_message"], "🧠: \n")
        self.assertIn("<proposed_plan>\n# Plan", reply["last_assistant_message"])
        self.assertIn("Step one.", reply["proposed_plan"])
        self.assertNotIn("sk-ant-" + "b" * 40, json.dumps(reply))
        self.assertEqual(self.lines("_codex_Stop.jsonl")[-1]["last_assistant_message"], "🧠: \n")

    def test_bash_guards_refuse_through_the_dispatcher(self):
        def pre(command):
            data = {"session_id": "test-session", "cwd": str(self.project), "turn_id": "t",
                    "hook_event_name": "PreToolUse", "tool_name": "exec_command", "tool_use_id": "g",
                    "tool_input": {"cmd": command}}
            return subprocess.run(["bash", str(PLUGIN / "hooks/codex_hooks/dispatch.sh"), "PreToolUse"],
                                  input=json.dumps(data), text=True, capture_output=True, env=self.env)
        for command in ("printenv", "find / -name terminal_bindings.jsonl", "tmux kill-server"):
            result = pre(command)
            self.assertEqual(result.returncode, 2, (command, result.stderr))
            self.assertTrue(result.stderr.strip(), command)
        allowed = pre("ls -la")
        self.assertEqual((allowed.returncode, allowed.stdout), (0, ""), allowed.stderr)

    def test_path_escape_session_is_ignored(self):
        self.event("UserPromptSubmit", session_id="../escape", prompt="never write outside the root")
        self.assertFalse((self.root / "../escape").exists())

    def test_backup_verifies_content_and_preserves_unrelated_hooks(self):
        self.home.mkdir()
        hooks = {"description": "keep", "hooks": {"Stop": [{"hooks": [
            {"type": "command", "command": "bash /src/scripts/codex_hooks/stop_hook.sh"},
            {"type": "command", "command": "python3 /custom/other.py"}]}]}}
        (self.home / "hooks.json").write_text(json.dumps(hooks))
        target = cutover.backup(self.home)
        self.assertEqual(cutover.clear(self.home, target), 1)
        kept = json.loads((self.home / "hooks.json").read_text())
        self.assertEqual(kept["description"], "keep")
        self.assertEqual(kept["hooks"]["Stop"][0]["hooks"][0]["command"], "python3 /custom/other.py")
        with self.assertRaises(ValueError):
            cutover.clear(self.home, target)


if __name__ == "__main__":
    unittest.main()
