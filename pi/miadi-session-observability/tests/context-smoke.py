#!/usr/bin/env python3
"""Real Pi context hooks with a deterministic in-process provider; no external API calls."""
import json
import os
from pathlib import Path
import select
import subprocess
import tempfile
import time

package = Path(__file__).resolve().parents[1]
fixture = r'''
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
export default function (pi) {
  pi.on('context_with_system', event => {
    const history = Array.from({length: 160}, (_, i) => ({role: 'user', timestamp: i,
      content: [{type: 'text', text: `${i}: ${'ordinary context '.repeat(500)} ghp_fakeTestCredentialValue0123456789`}]}));
    return {messages: [event.messages[0], ...history, ...event.messages.slice(1)]};
  });
  pi.registerProvider('miadi-capture-test', {
    name: 'Local capture fixture', baseUrl: 'http://127.0.0.1:1', apiKey: 'local-fixture-only', api: 'miadi-capture-test-api',
    models: [{id: 'fixture', name: 'Fixture', reasoning: false, input: ['text'],
      cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0}, contextWindow: 1000000, maxTokens: 128}],
    streamSimple(model, context) {
      const stream = createAssistantMessageEventStream();
      queueMicrotask(() => {
        const intact = context.messages[0]?.role === 'system' && context.messages.length >= 162;
        const message = {role: 'assistant', api: model.api, provider: model.provider, model: model.id,
          content: [{type: 'text', text: intact ? 'Context reached the local provider intact.' : 'Context was changed.'}],
          usage: {input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2,
            cost: {input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0}},
          stopReason: 'stop', timestamp: Date.now()};
        stream.push({type: 'start', partial: message});
        stream.push({type: 'done', reason: 'stop', message}); stream.end();
      });
      return stream;
    }
  });
}
'''

with tempfile.TemporaryDirectory(prefix="miadi-pi-context-smoke-") as root:
    path = Path(root)
    extension = path / "context-fixture.ts"
    extension.write_text(fixture)
    env = dict(os.environ, MIADI_SESSION_DIR=root, PI_OFFLINE="1", MIADI_TEAM="T1")
    # Isolate package/auth configuration as well as captures and native sessions.
    env["PI_CODING_AGENT_DIR"] = str(path / "agent")
    errors = path / "stderr.log"
    with errors.open("wb") as stderr:
        process = subprocess.Popen(
            ["pi", "--offline", "--mode", "rpc", "--no-extensions", "--no-skills", "--no-context-files", "--no-mcp",
             "-e", str(extension), "-e", str(package), "--provider", "miadi-capture-test", "--model", "fixture",
             "--thinking", "off", "--session-id", "context-smoke", "--session-dir", str(path / "native")],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr, env=env,
        )
        pending = b""

        def wait_for(predicate):
            global pending
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline:
                if b"\n" in pending:
                    line, pending = pending.split(b"\n", 1)
                    if not line.strip():
                        continue
                    record = json.loads(line)
                    if record.get("type") == "response":
                        assert record.get("success"), record
                    if predicate(record):
                        return record
                    continue
                ready, _, _ = select.select([process.stdout], [], [], 1)
                if ready:
                    chunk = os.read(process.stdout.fileno(), 65536)
                    assert chunk, errors.read_text()[-2000:]
                    pending += chunk
            raise AssertionError("Pi context smoke deadline: " + errors.read_text()[-2000:])

        def send(value):
            process.stdin.write((json.dumps(value) + "\n").encode())
            process.stdin.flush()

        try:
            send({"id": "state", "type": "get_state"})
            wait_for(lambda r: r.get("id") == "state")
            send({"id": "prompt", "type": "prompt", "message": "Exercise context capture locally."})
            wait_for(lambda r: r.get("type") == "agent_settled")
            process.stdin.close()
            process.wait(timeout=20)
            assert process.returncode == 0, errors.read_text()
            assert "capture failed" not in errors.read_text() and "Failed to load extension" not in errors.read_text(), errors.read_text()
            directory = path / "context-smoke"
            events = [json.loads(line) for line in (directory / "_pi_observability.jsonl").read_text().splitlines()]
            contexts = [event for event in events if event["payload"].get("custom_type") == "context_snapshot"]
            assert len(contexts) == 1, [(event["type"], event["payload"].get("custom_type")) for event in events]
            assert contexts[0]["payload"]["data"]["message_count"] >= 162
            assert events[-1]["type"] == "session_shutdown"
            assert any("Context reached the local provider intact." in event["payload"].get("text", "") for event in events)
            assert not (directory / ".pi-observability.lock").exists()
            print("Pi context smoke passed: >1 MiB context captured, provider messages intact, clean stderr, normal shutdown")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
