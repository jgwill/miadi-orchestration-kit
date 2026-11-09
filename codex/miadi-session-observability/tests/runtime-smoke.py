#!/usr/bin/env python3
"""Run real Codex against a deterministic local Responses stream, with an installed plugin.

No external model request is made. Hook trust is bypassed only inside this
isolated test home, whose sole plugin is the reviewed package under test.

CODEX_BIN picks the runtime under test (default: codex on PATH). Every command a refusal
scenario sends is harmless if the guard fails to stop it; a marker file proves it did not run.
"""
import http.server
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import threading
import time

PLUGIN = Path(__file__).resolve().parents[1]
CODEX = os.environ.get("CODEX_BIN", "codex")


class Fixture(http.server.BaseHTTPRequestHandler):
    calls = 0
    bodies = []
    command = ""

    def log_message(self, *args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        type(self).calls += 1
        type(self).bodies.append(body)
        count = type(self).calls
        if count > 3:
            self.send_error(500, "fixture request limit")
            return
        if count == 1:
            tool_names = []

            def names(value):
                if isinstance(value, dict):
                    if "name" in value:
                        tool_names.append(value["name"])
                    for v in value.values():
                        names(v)
                elif isinstance(value, list):
                    for v in value:
                        names(v)

            names(body.get("tools", []))
            name = next((n for n in ("exec_command", "shell_command", "shell") if n in tool_names), "exec_command")
            command = type(self).command
            arguments = {"cmd": command} if name != "shell" else {"command": ["bash", "-c", command]}
            item = {"type": "function_call", "id": "fc_fixture", "call_id": "call_fixture",
                    "name": name, "arguments": json.dumps(arguments)}
        else:
            item = {"type": "message", "id": "msg_fixture", "role": "assistant", "phase": "final_answer",
                    "content": [{"type": "output_text", "text": "Observability fixture completed.", "annotations": []}]}
        response = {"id": "resp_fixture_" + str(count), "object": "response", "status": "completed",
                    "output": [item], "usage": {"input_tokens": 10, "output_tokens": 10, "total_tokens": 20}}
        events = [{"type": "response.created", "response": {**response, "status": "in_progress", "output": []}},
                  {"type": "response.output_item.added", "output_index": 0, "item": item},
                  {"type": "response.output_item.done", "output_index": 0, "item": item},
                  {"type": "response.completed", "response": response}]
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "close")
        self.end_headers()
        for event in events:
            self.wfile.write(("event: " + event["type"] + "\ndata: " + json.dumps(event) + "\n\n").encode())
            self.wfile.flush()


def scenario(command):
    """Run one fresh Codex session whose only tool call is `command`; hand back what it left."""
    Fixture.calls, Fixture.bodies, Fixture.command = 0, [], command
    tmp = tempfile.TemporaryDirectory(prefix="miadi-codex-runtime-")
    base = Path(tmp.name)
    home, project, root, marketplace = [base / n for n in ("home", "project", "capture", "marketplace")]
    for path in (home, project, root, marketplace / ".agents/plugins"):
        path.mkdir(parents=True)
    shutil.copytree(PLUGIN, marketplace / "plugins/miadi-session-observability",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (marketplace / ".agents/plugins/marketplace.json").write_text(json.dumps({
        "name": "miadi-observability-smoke", "plugins": [{"name": "miadi-session-observability",
            "source": {"source": "local", "path": "./plugins/miadi-session-observability"},
            "policy": {"installation": "AVAILABLE", "authentication": "ON_INSTALL"}}]}))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    (home / "config.toml").write_text(f'''model = "gpt-5.1-codex"
model_provider = "fixture"
approval_policy = "never"
[features]
hooks = true
[model_providers.fixture]
name = "Local deterministic fixture"
base_url = "http://127.0.0.1:{server.server_port}/v1"
wire_api = "responses"
requires_openai_auth = false
''')
    env = {**os.environ, "CODEX_HOME": str(home), "CODEX_SESSIONDATA_ROOT": str(root),
           "XDG_STATE_HOME": str(base / "state"), "MIADI_TEAM": "T1", "MIADI_SESSION_NAME": "runtime-fixture"}
    # Authentication and provider routing must remain inside the fixture.
    for key in ("OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_RESPONSES_WEBSOCKET_BASE_URL"):
        env.pop(key, None)
    try:
        for args in (["plugin", "marketplace", "add", str(marketplace), "--json"],
                     ["plugin", "add", "miadi-session-observability@miadi-observability-smoke", "--json"]):
            subprocess.run([CODEX, *args], env=env, capture_output=True, text=True, check=True, timeout=30)
        result = subprocess.run([CODEX, "exec", "--json", "--skip-git-repo-check", "--sandbox", "danger-full-access",
                                 "--dangerously-bypass-hook-trust", "-C", str(project),
                                 "Run the local observability fixture."], env=env, capture_output=True, text=True, timeout=60,
                                stdin=subprocess.DEVNULL)  # Otherwise exec waits for more prompt on an open stdin.
        if result.returncode:
            raise AssertionError(result.stderr[-3000:] + result.stdout[-3000:])
        starts = list(root.glob("*/_codex_SessionStart.jsonl"))
        assert len(starts) == 1, starts
        out = starts[0].parent
        end = time.monotonic() + 20
        while time.monotonic() < end:
            if ((out / "_codex_SessionEnd.jsonl").is_file()
                    and (out / "_transcript_final.jsonl").is_file()
                    and '"event":"session.end"' in (out / "_terminal_binding.jsonl").read_text()
                    and not list(out.glob(".end-event.*"))):
                break
            time.sleep(.1)
        time.sleep(.5)  # Detached archive and file-copy jobs finish before the folder goes.
        return tmp, out, project, base, result
    finally:
        server.shutdown()
        server.server_close()


def capture():
    tmp, out, project, base, _ = scenario("printf 'observability fixture\\n' > runtime-proof.txt")
    with tmp:
        assert (project / "runtime-proof.txt").read_text() == "observability fixture\n"
        end = time.monotonic() + 20
        while time.monotonic() < end and not (out / "_codex_files_written.jsonl").is_file():
            time.sleep(.1)
        counts = {}
        for event in ("SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"):
            lines = (out / ("_codex_" + event + ".jsonl")).read_text().splitlines()
            counts[event] = len(lines)
            assert len(lines) == 1, (event, len(lines))
        assert (out / "_transcript_final.jsonl").stat().st_size > 0
        assert (out / "_responses_progressive.jsonl").stat().st_size > 0
        files = [json.loads(line) for line in (out / "_codex_files_written.jsonl").read_text().splitlines()]
        assert any(r["path"] == str(project / "runtime-proof.txt") and r.get("copy") for r in files), files
        bindings = [json.loads(line) for line in (out / "_terminal_binding.jsonl").read_text().splitlines()]
        assert bindings[0]["event"] == "session.start" and bindings[-1]["event"] == "session.end", bindings
        assert bindings[0]["agent"] == "codex" and bindings[0]["pid"], bindings[0]
        working = list((base / "state/miadi/working").glob("*.json"))
        assert working == [], working  # The reply ended, so no session is left marked as working.
        return counts, Fixture.calls


def refused(name, command, said):
    tmp, _, project, _, _ = scenario("touch guard-ran; " + command)
    with tmp:
        assert not (project / "guard-ran").exists(), name + ": the command ran"
        sent = json.dumps(Fixture.bodies[1])
        assert said in sent, (name, "refusal not returned to the model", sent[-1500:])
    return name


def exposure():
    token = "ghp_" + secrets.token_hex(18)  # Random, so this file holds nothing shaped like a credential.
    tmp, out, _, _, _ = scenario("printf '%s\\n' " + token)
    with tmp:
        ledger = [json.loads(line) for line in (out / "_codex_secret_exposures.jsonl").read_text().splitlines()]
        assert len(ledger) == 1 and ledger[0]["action"] == "check", ledger
        assert token not in (out / "_codex_secret_exposures.jsonl").read_text()
        assert "Do not repeat" in json.dumps(Fixture.bodies[1]), "the alert did not reach the model"


def main():
    counts, requests = capture()
    guards = [refused("tmux_server_guard", "pkill -0 -x tmux", "tmux-server-guard: refused"),
              refused("session_lookup_guard", "find / -maxdepth 0 -name none", "session-lookup-guard: refused"),
              refused("secret_print_guard", "printenv EXAMPLE_API_TOKEN", "secret-print-guard: refused")]
    exposure()
    print(json.dumps({"codex": subprocess.check_output([CODEX, "--version"], text=True).strip(),
                      "events": counts, "binding": "start/end with agent pid", "archive": "nonempty",
                      "written_file": "captured", "work_marker": "cleared", "refused_in_real_codex": guards,
                      "exposure_alert": "ledger and model context", "provider": "local fixture", "requests": requests}))


if __name__ == "__main__":
    main()
