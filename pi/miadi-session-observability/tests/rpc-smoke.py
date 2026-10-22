#!/usr/bin/env python3
"""Exercise the installed Pi's real package loader/lifecycle; no model/API requests."""
import json
import os
from pathlib import Path
import select
import subprocess
import tempfile

package = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="miadi-pi-rpc-smoke-") as root:
    env = dict(os.environ, MIADI_SESSION_DIR=root, PI_OFFLINE="1", MIADI_TEAM="T1")
    process = subprocess.Popen(
        ["pi", "--offline", "--mode", "rpc", "--no-extensions", "--no-skills",
         "--no-context-files", "--no-mcp", "-e", str(package),
         "--session-id", "t1-package-smoke", "--session-dir", root + "/native"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env,
    )
    try:
        process.stdin.write(b'{"id":"state","type":"get_state"}\n')
        process.stdin.flush()
        ready, _, _ = select.select([process.stdout], [], [], 25)
        assert ready, "RPC startup deadline"
        state = json.loads(process.stdout.readline())
        assert state.get("success") is True, state
        process.stdin.close()
        process.wait(timeout=20)
        errors = process.stderr.read().decode()
        assert "Failed to load extension" not in errors and "capture failed" not in errors, errors
        assert process.returncode == 0, process.returncode
        directory = Path(root) / "t1-package-smoke"
        events = [json.loads(line) for line in (directory / "_pi_observability.jsonl").read_text().splitlines()]
        assert [event["type"] for event in events] == ["session_start", "session_shutdown"], events
        assert [event["seq"] for event in events] == [0, 1]
        assert events[0]["miadi"]["team"]["id"] == "T1"
        assert not (directory / ".pi-observability.lock").exists()
        print("Pi RPC smoke passed: real package discovery, start/shutdown, team binding, clean stdout, lock release")
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()
