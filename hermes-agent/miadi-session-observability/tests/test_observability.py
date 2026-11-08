"""Regression tests: no model, network, credential files, or live tmux changes."""

from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("observability_test_plugin", ROOT / "__init__.py",
                                             submodule_search_locations=[str(ROOT)])
assert SPEC is not None and SPEC.loader is not None
PLUGIN = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = PLUGIN
SPEC.loader.exec_module(PLUGIN)
binding = sys.modules[SPEC.name + ".binding"]
capture = sys.modules[SPEC.name + ".capture"]
redaction = sys.modules[SPEC.name + ".redaction"]

INSTALL_SPEC = importlib.util.spec_from_file_location("observability_install", ROOT / "scripts" / "install.py")
assert INSTALL_SPEC is not None and INSTALL_SPEC.loader is not None
INSTALL = importlib.util.module_from_spec(INSTALL_SPEC)
INSTALL_SPEC.loader.exec_module(INSTALL)


def rows(path):
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


class CaptureTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="observability-test-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.env = patch.dict(os.environ, {"HERMES_SESSION_ID": "fallback"}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        process_patch = patch.object(binding, "agent_process", return_value=(4321, ["hermes"]))
        self.process = process_patch.start()
        self.addCleanup(process_patch.stop)
        self.cap = capture.Capture(self.root)
        self.cap.check_root()

    def event(self, hook, sid="s1", **kwargs):
        return self.cap.callback(hook)(session_id=sid, platform="cli", **kwargs)

    def test_every_declared_event_has_legacy_ledgers_and_latest(self):
        manifest = INSTALL.yaml.safe_load((ROOT / "plugin.yaml").read_text())
        self.assertEqual(set(manifest["provides_hooks"]), set(capture.EVENTS))
        expected = []
        for hook, aliases in capture.EVENTS.items():
            extra = {"old_session_id": "s1"} if hook == "on_session_reset" else {}
            self.assertIsNone(self.event(hook, **extra))
            for event in aliases:
                expected.append(event)
                event_rows = rows(self.root / "s1" / ("_hermes_" + event + ".jsonl"))
                self.assertEqual(len(event_rows), 1)
                latest = json.loads((self.root / "s1" / ("last_hermes_" + event + ".json")).read_text())
                self.assertEqual(latest, event_rows[-1])
        self.assertEqual(len(rows(self.root / "s1" / "_hermes_hooks_all.jsonl")), len(expected))
        self.assertEqual(len(rows(self.root / "data" / "hermes_hooks_all.jsonl")), len(expected))

    def test_payload_aliases_and_correlation(self):
        self.event("post_tool_call", tool_name="write_file", args={"path": "note.md"}, result="ok",
                   turn_id="t1", tool_call_id="c1", status="ok", duration_ms=12)
        value = rows(self.root / "s1" / "_hermes_post_tool_use.jsonl")[0]
        self.assertEqual(value["tool_input"], {"path": "note.md"})
        self.assertEqual(value["extra"]["result"], "ok")
        self.assertEqual(value["extra"]["status"], "ok")
        self.assertEqual(value["tool_call_id"], "c1")
        self.assertEqual(value["turn_id"], "t1")

    def test_payload_id_wins_over_stale_environment(self):
        self.event("pre_tool_call", sid="actual-child", parent_session_id="parent")
        self.assertTrue((self.root / "actual-child").is_dir())
        self.assertFalse((self.root / "fallback").exists())

    def test_empty_id_falls_back_to_parent_then_environment(self):
        self.event("pre_tool_call", sid="", parent_session_id="parent")
        self.event("pre_tool_call", sid="")
        self.assertTrue((self.root / "parent").is_dir())
        value = rows(self.root / "fallback" / "_hermes_pre_tool_use.jsonl")[0]
        self.assertEqual(value["session_id"], "fallback")

    def test_bad_ids_are_rejected_not_normalized(self):
        for sid in ("../escape", "/abs", "..", ".", "x/y", "x\\y", "a\n", "data", "a" * 256):
            with self.subTest(sid=sid), self.assertRaises(ValueError):
                self.cap.record("pre_tool_call", {"session_id": sid})
        self.assertEqual(list(self.root.iterdir()), [self.root / "data"])

    def test_missing_id_has_no_unknown_bucket(self):
        os.environ.pop("HERMES_SESSION_ID")
        with self.assertRaises(ValueError):
            self.cap.record("pre_tool_call", {})
        self.assertFalse((self.root / "unknown-hermes-session").exists())

    def test_capture_failure_cannot_block_tools_or_log_payload(self):
        with patch.object(self.cap, "record", side_effect=OSError("do-not-print-this")):
            with self.assertLogs(capture.LOG, level="ERROR") as logs:
                self.assertIsNone(self.event("pre_tool_call", args={"secret": "do-not-print-this"}))
        self.assertNotIn("do-not-print-this", " ".join(logs.output))
        self.assertIn("OSError", " ".join(logs.output))

    def test_parallel_appends_are_complete_unique_json(self):
        def call(i):
            self.event("post_tool_call", tool_call_id="c" + str(i), status="error" if i % 2 else "ok")
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(call, range(60)))
        lines = rows(self.root / "s1" / "_hermes_post_tool_use.jsonl")
        self.assertEqual(len(lines), 60)
        self.assertEqual(len({x["tool_call_id"] for x in lines}), 60)
        self.assertEqual(len(rows(self.root / "data" / "hermes_hooks_all.jsonl")), 60)

    def test_start_resume_index_once_and_no_false_end_on_turn_end(self):
        self.event("on_session_start")
        self.event("pre_llm_call")
        self.event("on_session_end", completed=False, interrupted=True)
        lines = rows(self.root / "s1" / "_terminal_binding.jsonl")
        self.assertEqual([x["event"] for x in lines], ["session.start"])
        self.process.return_value = (4322, ["hermes", "--resume", "s1"])
        self.event("pre_llm_call")
        self.assertEqual(len(rows(self.root / "data" / "session_index.jsonl")), 1)
        self.assertEqual(rows(self.root / "s1" / "_terminal_binding.jsonl")[-1]["event"], "session.observed")
        self.event("on_session_finalize")
        self.assertEqual(rows(self.root / "s1" / "_terminal_binding.jsonl")[-1]["event"], "session.end")

    def test_resume_without_start_is_indexed_and_bound(self):
        self.event("pre_llm_call", sid="resumed")
        self.assertEqual(rows(self.root / "resumed" / "_terminal_binding.jsonl")[0]["event"], "session.observed")
        self.assertEqual(rows(self.root / "data" / "session_index.jsonl")[0]["session_id"], "resumed")

    def test_reset_closes_old_not_new_session(self):
        self.event("on_session_reset", sid="new", old_session_id="old", new_session_id="new")
        self.assertFalse((self.root / "new").exists())
        self.assertEqual(rows(self.root / "old" / "_terminal_binding.jsonl")[-1]["event"], "session.end")

    def test_names_keep_history_when_supplied(self):
        self.event("on_session_start", name="first")
        self.event("pre_llm_call", name="second")
        self.event("pre_llm_call")
        lines = rows(self.root / "s1" / "_terminal_binding.jsonl")
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[-1]["event"], "session.rename")
        self.assertEqual(lines[-1]["name"]["former"][0]["name"], "first")

    def test_reply_and_history_are_sanitized_not_duplicated_in_events(self):
        history = [{"role": "user", "content": "password=unsafe-pass-phrase"},
                   {"role": "assistant", "content": "answer"}]
        self.event("post_llm_call", conversation_history=history, assistant_response="answer", turn_id="t1")
        self.assertEqual(len(rows(self.root / "s1" / "_hermes_history_latest.jsonl")), 2)
        self.assertNotIn("unsafe-pass-phrase", (self.root / "s1" / "_hermes_history_latest.jsonl").read_text())
        self.assertEqual(rows(self.root / "s1" / "_hermes_responses.jsonl")[0]["response"], "answer")
        event = rows(self.root / "s1" / "_hermes_post_llm_call.jsonl")[0]
        self.assertNotIn("conversation_history", event["extra"])
        self.assertEqual(event["extra"]["conversation_history_count"], 2)
        self.event("post_llm_call", conversation_history=[{"role": "assistant", "content": "latest"}])
        self.assertEqual(len(rows(self.root / "s1" / "_hermes_history_latest.jsonl")), 1)

    def test_usage_without_sdk_objects_or_raw_request_response(self):
        self.event("post_api_request", usage={"input_tokens": 10}, request={"secret": "hidden"},
                   response=object(), assistant_message=object())
        extra = rows(self.root / "s1" / "_hermes_api_usage.jsonl")[0]["extra"]
        self.assertEqual(extra["usage"], {"input_tokens": 10})
        self.assertNotIn("response", extra)
        self.assertNotIn("request", extra)

    def test_session_and_append_symlinks_refused(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / "s1").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.cap.record("pre_tool_call", {"session_id": "s1"})
        (self.root / "s1").unlink()
        (self.root / "s1").mkdir()
        victim = outside / "victim"
        victim.write_text("keep")
        (self.root / "s1" / "_hermes_pre_tool_use.jsonl").symlink_to(victim)
        with self.assertRaises(OSError):
            self.cap.record("pre_tool_call", {"session_id": "s1"})
        self.assertEqual(victim.read_text(), "keep")

    def test_latest_and_state_symlinks_refused(self):
        self.event("on_session_start")
        victim = self.root / "victim"
        victim.write_text("keep")
        for name, hook in (("last_hermes_pre_tool_use.json", "pre_tool_call"),
                           (".observability-binding.json", "pre_llm_call")):
            path = self.root / "s1" / name
            path.unlink(missing_ok=True)
            path.symlink_to(victim)
            with self.assertRaises(ValueError):
                self.cap.record(hook, {"session_id": "s1"})
            path.unlink()
        self.assertEqual(victim.read_text(), "keep")

    def test_new_capture_files_are_private(self):
        self.event("on_session_start")
        for path in (self.root / "s1").iterdir():
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_root_precedence_including_miadi_session_dir(self):
        keys = ("HERMES_SESSIONDATA_ROOT", "MIADI_SESSION_DIR", "MIADI_SESSIONDATA_ROOT", "SESSION_DATA_ROOT")
        env = {k: "/capture/" + str(i) for i, k in enumerate(keys)}
        for i, key in enumerate(keys):
            self.assertEqual(str(capture.resolve_root(env)), "/capture/" + str(i))
            env.pop(key)


class RedactionTests(unittest.TestCase):
    def setUp(self):
        self.cleaner = redaction.Redactor({"SERVICE_TOKEN": "held-unique-value", "NORMAL": "not-a-secret"})

    def test_held_values_and_sensitive_structured_fields(self):
        result = self.cleaner.clean({"text": "before held-unique-value after", "password": "x", "api_key": "short"})
        self.assertEqual(result["password"], redaction.REDACTED)
        self.assertNotIn("held-unique-value", json.dumps(result))
        self.assertEqual(result["api_key"], redaction.REDACTED)

    def test_vendor_shapes_are_removed(self):
        for value in ("ghp_" + "Z" * 32, "sk-ant-" + "A" * 32, "mwt_" + "B" * 36,
                      "mr_" + "C" * 36, "hf_" + "D" * 25, "npm_" + "E" * 35,
                      "AKIA" + "Q" * 16, "eyJ" + "A" * 12 + "." + "B" * 12 + "." + "C" * 12):
            with self.subTest(kind=value[:5]):
                self.assertNotIn(value, self.cleaner.text("prefix " + value + " suffix"))

    def test_urls_assignments_bearer_and_private_keys(self):
        examples = [("postgres://alice:private-pass@db/x", "private-pass"),
                    ('PASSWORD="a \\ quoted value"', "quoted value"),
                    ("Authorization: Bearer private-opaque-value", "private-opaque-value"),
                    ("-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----", "private-material"),
                    ("define('DB_PASSWORD', 'private-php-pass');", "private-php-pass")]
        for text, secret in examples:
            with self.subTest(text=text[:12]):
                self.assertNotIn(secret, self.cleaner.text(text))

    def test_json_remains_valid_with_quotes_newlines_and_unknown_objects(self):
        result = self.cleaner.clean({"text": 'hello "x"\npassword=abc', "sdk": object(), "nested": (1, True, None)})
        self.assertEqual(json.loads(json.dumps(result))["nested"], [1, True, None])
        self.assertEqual(result["sdk"], "[omitted: non-JSON value]")

    def test_usage_fields_not_mistaken_for_credentials(self):
        usage = {"input_tokens": 30, "output_tokens": 5, "token_count": 35}
        self.assertEqual(self.cleaner.clean(usage), usage)

    def test_recursive_payload_is_bounded(self):
        value = {}
        value["nested"] = value
        self.assertIn("nesting limit", json.dumps(self.cleaner.clean(value)))


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="binding-test-")
        self.addCleanup(self.tmp.cleanup)
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def teams(self):
        path = Path(self.tmp.name) / "teams.json"
        path.write_text(json.dumps({"teams": [
            {"id": "T1", "sessions": ["exact"], "folders": ["/work"], "name_patterns": ["^pattern"]},
            {"id": "T2", "sessions": [], "folders": ["/work/deep"], "name_patterns": []},
        ]}))
        os.environ["MIADI_TEAMS_FILE"] = str(path)

    def test_team_precedence(self):
        self.teams()
        os.environ["MIADI_TEAM"] = "T3"
        self.assertEqual(binding.team_binding("/work/deep", None, "exact")["id"], "T3")
        os.environ.pop("MIADI_TEAM")
        self.assertEqual(binding.team_binding("/work/deep", None, "exact"), {"id": "T1", "source": "session"})
        self.assertEqual(binding.team_binding("/work/deep/sub", None, "other"), {"id": "T2", "source": "folder"})
        self.assertEqual(binding.team_binding("/else", None, "pattern-agent"), {"id": "T1", "source": "name"})

    def test_folder_boundary_and_unassigned(self):
        self.teams()
        self.assertEqual(binding.team_binding("/workshop", None, "none")["id"], "unassigned")

    def test_episode_precedence(self):
        os.environ["MIADI_CHRONICLE_ROOT"] = "/episodes"
        os.environ["MIADI_CHRONICLE_PROD_EPISODE"] = "declared"
        episode = "/episodes/2026-11-08-episode-999-test"
        self.assertEqual(binding.episode_binding("/else", ["--add-dir", episode])["source"], "add-dir")
        self.assertEqual(binding.episode_binding(episode + "/work", [])["source"], "cwd")
        self.assertEqual(binding.episode_binding("/else", [])["source"], "declared")

    def test_tmux_socket_and_server_identity_verified(self):
        os.environ.update({"TMUX": "/private/socket,123,0", "TMUX_PANE": "%7"})
        with patch.object(binding, "tmux_query", return_value="123\tseat\t1\t2\t%7"):
            self.assertEqual(binding.tmux_binding()["socket"], "/private/socket")
        with patch.object(binding, "tmux_query", return_value="999\tseat\t1\t2\t%7"):
            self.assertIsNone(binding.tmux_binding())

    def test_no_tmux_is_null(self):
        self.assertIsNone(binding.tmux_binding())


class InstallerTests(unittest.TestCase):
    CONFIG = """# keep header
model:
  provider: example
  api_key: do-not-print-fixture
hooks:
  pre_tool_call:
    - command: /opt/binscripts/hooks/hermes_hooks/pre_tool_use_hook.sh
    - command: /custom/guard.sh
  pre_llm_call:
    - command: '$MIADI_HOOKS_SCRIPT_DIR/hermes_hooks/user_prompt_submit_hook.sh'
# keep next block comment
plugins:
  enabled: [miadi, herdr-agent-state]
  disabled: [miadi-session-observability, other]
other: unchanged # keep inline
"""

    def test_only_targeted_hooks_removed_and_other_plugins_preserved(self):
        updated, count = INSTALL.transform(self.CONFIG)
        after = INSTALL.yaml.safe_load(updated)
        self.assertEqual(count, 2)
        self.assertEqual(after["hooks"]["pre_tool_call"], [{"command": "/custom/guard.sh"}])
        self.assertEqual(after["plugins"]["enabled"], ["miadi", "herdr-agent-state", INSTALL.NAME])
        self.assertEqual(after["plugins"]["disabled"], ["other"])
        self.assertIn("# keep next block comment", updated)
        self.assertIn("other: unchanged # keep inline", updated)
        self.assertTrue(updated.startswith(self.CONFIG[:self.CONFIG.index("hooks:")]))

    def test_unknown_legacy_directory_commands_never_removed(self):
        self.assertFalse(INSTALL.legacy_command({"command": "/opt/binscripts/hooks/hermes_hooks/unknown.sh"}))
        self.assertFalse(INSTALL.legacy_command({"command": "/opt/binscripts/hooks/hermes_hooks/pre_tool_use_hook.sh && /custom/a"}))
        self.assertTrue(INSTALL.legacy_command({"command": 'bash "${MIADI_HOOKS_SCRIPT_DIR}/hermes_hooks/session_end_hook.sh"'}))

    def test_cutover_is_semantically_and_textually_idempotent(self):
        updated, _ = INSTALL.transform(self.CONFIG)
        again, count = INSTALL.transform(updated)
        self.assertEqual(count, 0)
        self.assertEqual(again, updated)

    def test_invalid_or_ambiguous_yaml_refused(self):
        for text in ("plugins: []\nhooks: invalid\n", "hooks: {}\nhooks: {}\n", "x: &a {}\nhooks: *a\n"):
            with self.subTest(text=text), self.assertRaises(ValueError):
                INSTALL.transform(text)

    def test_apply_private_backup_exact_readback_and_dry_run_no_writes(self):
        with tempfile.TemporaryDirectory(prefix="cutover-test-") as temp:
            home = Path(temp)
            (home / "config.yaml").write_text(self.CONFIG)
            result = INSTALL.install(home, ROOT)
            self.assertFalse(result["applied"])
            self.assertEqual([x.name for x in home.iterdir()], ["config.yaml"])
            result = INSTALL.install(home, ROOT, apply=True)
            backup = Path(result["backup"])
            self.assertEqual(backup.read_text(), self.CONFIG)
            self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
            self.assertEqual((home / "config.yaml").stat().st_mode & 0o777, 0o600)
            self.assertEqual((home / "plugins" / INSTALL.NAME).resolve(), ROOT)
            again = INSTALL.install(home, ROOT, apply=True)
            self.assertNotIn("backup", again)
            self.assertFalse(again["config_changed"])

    def test_existing_unrelated_plugin_not_overwritten(self):
        with tempfile.TemporaryDirectory(prefix="cutover-test-") as temp:
            home = Path(temp)
            (home / "config.yaml").write_text(self.CONFIG)
            (home / "plugins" / INSTALL.NAME).mkdir(parents=True)
            with self.assertRaises(ValueError):
                INSTALL.install(home, ROOT, apply=True)
            self.assertEqual((home / "config.yaml").read_text(), self.CONFIG)

    def test_staging_installs_without_changing_config_or_legacy_hooks(self):
        with tempfile.TemporaryDirectory(prefix="cutover-stage-test-") as temp:
            home = Path(temp)
            (home / "config.yaml").write_text(self.CONFIG)
            result = INSTALL.install(home, ROOT, apply=True, stage=True)
            self.assertTrue(result["staged_only"])
            self.assertFalse(result["config_changed"])
            self.assertEqual(result["legacy_hooks_removed"], 0)
            self.assertEqual((home / "config.yaml").read_text(), self.CONFIG)
            self.assertEqual((home / "plugins" / INSTALL.NAME).resolve(), ROOT)
            self.assertNotIn("backup", result)

    def test_staging_does_not_disable_an_enabled_plugin(self):
        with tempfile.TemporaryDirectory(prefix="cutover-stage-test-") as temp:
            home = Path(temp)
            updated, _ = INSTALL.transform(self.CONFIG)
            (home / "config.yaml").write_text(updated)
            with self.assertRaises(ValueError):
                INSTALL.install(home, ROOT, apply=True, stage=True)
            self.assertEqual((home / "config.yaml").read_text(), updated)


if __name__ == "__main__":
    unittest.main()
