"""Hermes adapters and shared-runtime regression tests; no live seats/providers."""

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

LANE = Path(__file__).resolve().parents[1]


def load(name, directory):
    spec = importlib.util.spec_from_file_location(name, directory / "__init__.py",
                                                 submodule_search_locations=[str(directory)])
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


CHRONICLE = load("test_hermes_chronicle", LANE / "miadi-chronicle-episode-kit")
PLANS = load("test_hermes_plans", LANE / "miette-plan-insight")
OBSERVE = load("test_hermes_observe", LANE / "miadi-session-observability")
INSTALL_SPEC = importlib.util.spec_from_file_location("test_install_hermes_kit", LANE.parent / "scripts/install-hermes-kit.py")
assert INSTALL_SPEC is not None and INSTALL_SPEC.loader is not None
INSTALL = importlib.util.module_from_spec(INSTALL_SPEC)
INSTALL_SPEC.loader.exec_module(INSTALL)


class Context:
    profile_name = "default"

    def __init__(self, cwd, plugins=("miadi",), surface="cli"):
        self.cwd, self.plugins, self.surface = str(cwd), plugins, surface
        self.hooks, self.skills, self.commands = {}, {}, {}
        self.dispatch_tool = Mock(return_value=json.dumps({"status": 200, "body": {"closing": []}}))

    def session_cwd(self):
        return self.cwd

    def session_surface(self):
        return self.surface

    def has_plugin(self, name):
        return name in self.plugins

    def get_config(self, name, default=None):
        return default

    def register_hook(self, name, callback, **kwargs):
        self.hooks[name] = callback

    def register_skill(self, name, path, *args, **kwargs):
        assert path.is_file()
        self.skills[name] = path

    def register_command(self, name, handler, **kwargs):
        self.commands[name] = handler

    def register_system_prompt_section(self, *args, **kwargs):
        pass


class ChronicleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="hermes-chronicle-test-")
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name)
        self.root = self.work / "chronicle"
        (self.root / "existing").mkdir(parents=True)
        self.env = patch.dict(os.environ, {"MIADI_CHRONICLE_ROOT": str(self.root)}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.ctx = Context(self.work)

    def test_mkdir_install_and_redirect_refused(self):
        for command in ("mkdir chronicle/new", "mkdir -p chronicle/new/rooms", "install -d chronicle/new",
                        "printf x >chronicle/new/note.md", "cd chronicle && mkdir new",
                        "mkdir -m 755 chronicle/new", "mkdir chronicle/new;true"):
            with self.subTest(command=command):
                self.assertEqual(CHRONICLE.guard("terminal", {"command": command}, str(self.work))["action"], "block")

    def test_existing_vessel_outside_and_reads_allowed(self):
        for command in ("mkdir -p chronicle/existing/rooms", "mkdir outside", "cat chronicle/new/note.md",
                        "install file chronicle/new", "printf '%s' 'mkdir chronicle/new'"):
            with self.subTest(command=command):
                self.assertIsNone(CHRONICLE.guard("terminal", {"command": command}, str(self.work)))

    def test_native_write_and_patch_paths_guarded(self):
        self.assertEqual(CHRONICLE.guard("write_file", {"path": "chronicle/new/n.md"}, str(self.work))["action"], "block")
        self.assertEqual(CHRONICLE.guard("patch", {"patch": "*** Begin Patch\n*** Add File: chronicle/new/n.md\n+x\n*** End Patch"}, str(self.work))["action"], "block")
        self.assertIsNone(CHRONICLE.guard("patch", {"path": "chronicle/existing/n.md"}, str(self.work)))

    def test_root_unset_allows_and_symlink_alias_is_checked(self):
        self.assertIsNone(CHRONICLE.guard("write_file", {"path": "chronicle/new/n.md"}, str(self.work), root=""))
        (self.work / "alias").symlink_to(self.root, target_is_directory=True)
        self.assertEqual(CHRONICLE.guard("write_file", {"path": "alias/new/n.md"}, str(self.work))["action"], "block")

    def test_addresses_preserve_whole_reply_and_are_idempotent(self):
        original = "Episode 563 holds circle:1790787727155:2slscw."
        updated = CHRONICLE.add_addresses(original)
        self.assertTrue(updated.startswith(original))
        self.assertIn("miadi-chronicle://563", updated)
        self.assertIn("miadi-circle://circle:1790787727155:2slscw", updated)
        self.assertIsNone(CHRONICLE.add_addresses(updated))

    def test_addresses_ignore_code_and_existing_folder_references(self):
        for text in ("`ep563`", "```\nEpisode 563\n```", "Episode 563 miadi-chronicle://2026-11-08-episode-563-demo"):
            self.assertIsNone(CHRONICLE.add_addresses(text))

    def test_registration_uses_canonical_skills_and_real_transform_payload(self):
        CHRONICLE.register(self.ctx)
        self.assertEqual(len(self.ctx.skills), 3)
        self.assertEqual(self.ctx.skills["chronicle-episode"], LANE.parent / "skills/chronicle-episode/SKILL.md")
        self.assertIn("miadi-chronicle://563", self.ctx.hooks["transform_llm_output"](response_text="Episode 563"))

    def test_status_dispatches_exact_ref_via_existing_bridge(self):
        CHRONICLE.episode_status(self.ctx, "ep0563")
        self.ctx.dispatch_tool.assert_called_once_with("miadi_api", {"path": "/api/chronicle/episodes/ep0563", "method": "GET"})
        for bad in ("../563", "miadi-chronicle://563", "563?x=1", "epfoo"):
            self.ctx.dispatch_tool.reset_mock()
            self.assertIn("error", json.loads(CHRONICLE.episode_status(self.ctx, bad)))
            self.ctx.dispatch_tool.assert_not_called()

    def test_mint_defaults_to_dry_run_with_explicit_no_landing(self):
        raw = json.dumps({"title": "Test", "goal": "Test", "references": ["owner/repo#1"], "dryRun": False, "land": True})
        CHRONICLE.mint_episode(self.ctx, raw)
        payload = self.ctx.dispatch_tool.call_args.args[1]["body"]
        self.assertTrue(payload["dryRun"])
        self.assertFalse(payload["land"])
        self.assertTrue(payload["register"])

    def test_apply_requires_number_and_reads_back_exact_target(self):
        raw = {"title": "Test", "goal": "Test", "references": ["owner/repo#1"]}
        self.assertIn("error", json.loads(CHRONICLE.mint_episode(self.ctx, "--apply " + json.dumps(raw))))
        self.ctx.dispatch_tool.assert_not_called()
        result = json.loads(CHRONICLE.mint_episode(self.ctx, "--apply " + json.dumps({**raw, "number": 563})))
        self.assertEqual(self.ctx.dispatch_tool.call_count, 2)
        self.assertEqual(self.ctx.dispatch_tool.call_args.args[1]["path"], "/api/chronicle/episodes/563")
        self.assertIn("verification", result)

    def test_webhook_unknown_or_missing_bridge_cannot_dispatch(self):
        for surface in ("webhook", ""):
            self.ctx.surface = surface
            self.assertIn("error", CHRONICLE.bridge(self.ctx, "/api/chronicle/episodes"))
        self.ctx.surface, self.ctx.plugins = "cli", ()
        self.assertIn("error", CHRONICLE.bridge(self.ctx, "/api/chronicle/episodes"))
        self.ctx.dispatch_tool.assert_not_called()

    def test_capture_defers_index_and_binding_to_installed_bridge(self):
        with patch.dict(os.environ, {"HERMES_SESSIONDATA_ROOT": str(self.work / "capture")}, clear=True):
            OBSERVE.register(self.ctx)
            self.ctx.hooks["on_session_start"](session_id="test-session", platform="cli")
            cap = self.work / "capture"
            self.assertTrue((cap / "test-session/_hermes_session_start.jsonl").is_file())
            self.assertFalse((cap / "data/session_index.jsonl").exists())
            self.assertFalse((cap / "data/terminal_bindings.jsonl").exists())
            event = json.loads((cap / "test-session/last_hermes_session_start.json").read_text())
            self.assertEqual(event["cwd"], str(self.work))

    def test_bridge_mode_fills_resume_only_with_a_verified_pane(self):
        cap = self.work / "capture"
        module = sys.modules["test_hermes_observe.binding"]
        pane = {"session": "fixture", "window": 0, "pane": 0, "pane_id": "%1", "socket": "/fixture"}
        with patch.dict(os.environ, {"HERMES_SESSIONDATA_ROOT": str(cap)}, clear=True), \
             patch.object(module, "tmux_binding", return_value=pane), \
             patch.object(module, "agent_process", return_value=(1234, ["hermes"])):
            OBSERVE.register(self.ctx)
            for _ in range(2):
                self.ctx.hooks["pre_llm_call"](session_id="resumed", platform="cli")
            ledger = cap / "data/terminal_bindings.jsonl"
            self.assertEqual(len(ledger.read_text().splitlines()), 1)
            self.assertEqual(json.loads(ledger.read_text())["event"], "session.observed")
            self.assertFalse((cap / "data/session_index.jsonl").exists())
            self.ctx.hooks["on_session_finalize"](session_id="resumed", platform="cli")
            self.assertEqual(len(ledger.read_text().splitlines()), 1, "bridge still owns the end event")
            self.ctx.hooks["pre_llm_call"](session_id="resumed", platform="cli")
            self.assertEqual(len(ledger.read_text().splitlines()), 2)


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="hermes-plan-test-")
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name)
        self.env = patch.dict(os.environ, {"PATH": os.environ["PATH"], "HERMES_HOME": str(self.work / "home")}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.ctx = Context(self.work)
        self.adapter = PLANS.PlanAdapter(self.ctx)
        self.adapter.run = Mock(return_value=subprocess.CompletedProcess([], 0, '{"systemMessage":"opening"}', ""))
        self.plan = self.work / ".hermes/plans/plan.md"
        self.plan.parent.mkdir(parents=True)
        self.plan.write_text("# Test plan\nDo the work.")

    def fire(self, **kwargs):
        return self.adapter.safe_post_tool(tool_name="write_file", args={"path": str(self.plan)},
                                          status="ok", session_id="local-" + "a" * 64, platform="cli", **kwargs)

    def test_real_plan_only_and_content_dedup(self):
        self.fire()
        self.fire()
        self.assertEqual(self.adapter.run.call_count, 1)
        self.plan.write_text("# Changed plan")
        self.fire()
        self.assertEqual(self.adapter.run.call_count, 2)
        payload = json.loads(self.adapter.run.call_args.kwargs["payload"])
        self.assertEqual(payload["tool_input"]["plan"], "# Changed plan")

    def test_failure_or_nonplan_does_not_open(self):
        self.adapter.post_tool(tool_name="write_file", args={"path": str(self.plan)}, status="error", session_id="s", platform="cli")
        self.adapter.post_tool(tool_name="todo_list", args={"todos": []}, status="ok", session_id="s", platform="cli")
        self.adapter.post_tool(tool_name="write_file", args={"path": str(self.work / "other.md")}, status="ok", session_id="s", platform="cli")
        self.adapter.run.assert_not_called()

    def test_patch_add_file_is_observed(self):
        self.adapter.post_tool(tool_name="patch", args={"patch": "*** Add File: .hermes/plans/plan.md\n+x"},
                               status="ok", session_id="s", platform="cli")
        self.adapter.run.assert_called_once()

    def test_disabled_review_seat_and_untrusted_origin_do_not_open(self):
        for field in ({"MIADI_MIETTE_PLAN_INSIGHT": "0"}, {"MIADI_MIETTE_SEAT": "a-miette-insight"}):
            with patch.dict(os.environ, field):
                self.fire()
        self.ctx.surface = "webhook"
        self.adapter.post_tool(tool_name="write_file", args={"path": str(self.plan)}, status="ok", session_id="s", platform="webhook")
        self.adapter.run.assert_not_called()

    def test_automatic_plans_are_redacted_before_shared_runtime(self):
        self.plan.write_text("# Plan\npassword=fixture-password-value")
        self.fire()
        self.assertNotIn("fixture-password-value", self.adapter.run.call_args.kwargs["payload"])

    def test_trigger_failure_does_not_block_and_remains_retryable(self):
        self.adapter.run.side_effect = OSError("secret-do-not-log")
        with self.assertLogs(PLANS.LOG, level="WARNING") as logs:
            self.assertIsNone(self.fire())
        self.assertNotIn("secret-do-not-log", " ".join(logs.output))
        self.adapter.run.side_effect = None
        self.fire()
        self.assertEqual(self.adapter.run.call_count, 2)

    def test_listener_is_a_real_tracked_background_tool_call(self):
        self.adapter.command("listen", "--session s")
        payload = self.ctx.dispatch_tool.call_args.args[1]
        self.assertTrue(payload["background"])
        self.assertTrue(payload["notify"])
        self.assertIn("MIADI_MIETTE_AGENT=hermes", payload["command"])
        self.assertIn("listen --session s", payload["command"])

    def test_command_rejects_shell_injection_and_unsafe_identity(self):
        self.adapter.command("ask", "--session ../bad --plan x")
        self.adapter.command("ask", "--plan x ; touch sentinel")
        self.adapter.command("ask", "--dry-run --plan x")
        self.ctx.surface = "webhook"
        self.adapter.command("ask", "--plan x")
        self.ctx.dispatch_tool.assert_not_called()

    def test_seat_context_is_translated_to_hermes_ephemeral_context(self):
        self.adapter.run.return_value = subprocess.CompletedProcess([], 0, '{"hookSpecificOutput":{"additionalContext":"arm listener"}}', "")
        with patch.dict(os.environ, {"MIADI_MIETTE_SEAT": "seat"}):
            self.assertEqual(self.adapter.seat_context(), {"context": "arm listener"})


class InstallerTests(unittest.TestCase):
    def test_dry_run_and_staging_preserve_every_config_byte(self):
        with tempfile.TemporaryDirectory(prefix="hermes-kit-install-test-") as temp:
            home = Path(temp)
            original = "# preserve\nplugins:\n  enabled: [miadi]\nhooks: {}\n"
            (home / "config.yaml").write_text(original)
            result = INSTALL.install(home, INSTALL.NAMES)
            self.assertFalse(result["applied"])
            self.assertFalse((home / "plugins").exists())
            result = INSTALL.install(home, INSTALL.NAMES, apply=True)
            self.assertEqual((home / "config.yaml").read_text(), original)
            self.assertEqual(result["enabled_plugins"], [])
            for name in INSTALL.NAMES:
                self.assertEqual((home / "plugins" / name).resolve(), LANE / name)

    def test_enable_miette_refused_while_legacy_hooks_remain(self):
        with tempfile.TemporaryDirectory(prefix="hermes-kit-install-test-") as temp:
            home = Path(temp)
            original = "hooks:\n  post_tool_call:\n  - command: /opt/binscripts/hooks/hermes_hooks/post_tool_use_hook.sh\n"
            (home / "config.yaml").write_text(original)
            with self.assertRaises(ValueError):
                INSTALL.install(home, ["miette-plan-insight"], apply=True, enable=True)
            self.assertEqual((home / "config.yaml").read_text(), original)
            self.assertFalse((home / "plugins").exists())


if __name__ == "__main__":
    unittest.main()
