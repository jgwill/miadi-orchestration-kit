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
                    "MIADI_TEAM": "T1", "MIADI_SESSION_NAME": "fixture"}
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
