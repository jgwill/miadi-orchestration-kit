import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
const configModule = await import('../config.mjs').catch(() => ({}));

test('configuration reads only named secrets, pins identity and refuses non-loopback binding', t => {
  assert.equal(typeof configModule.loadConfig, 'function');
  const dir = mkdtempSync(join(tmpdir(), 'kherix-config-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const swarmEnv = join(dir, 'swarm.env'); const sttEnv = join(dir, 'stt.env');
  writeFileSync(swarmEnv, 'UNRELATED_SECRET=never-load\nACCESS_KEY="unit-access"\n');
  writeFileSync(sttEnv, 'export GROQ_API_KEY=unit-groq\nOTHER_SECRET=never-load\n');
  const defaults = configModule.loadConfig({ SWARMCLAW_ENV_FILE: swarmEnv, KHERIX_STT_ENV_FILE: sttEnv, KHERIX_COMPANION_AUTH_TOKEN: 'unit-auth' });
  assert.equal(defaults.host, '127.0.0.1'); assert.equal(defaults.port, 8774);
  assert.equal(defaults.stateDir, join(homedir(), '.local/state/kherix-episode-companion'));
  assert.equal(defaults.swarmclawUrl, 'http://127.0.0.1:3456');
  assert.equal(defaults.accessKey, 'unit-access'); assert.equal(defaults.groqKey, 'unit-groq');
  assert.equal(defaults.voice, 'en-US-GuyNeural');
  const customRenderer = configModule.loadConfig({ KHERIX_EDGE_TTS_BIN: '/private/tts/bin/edge-tts' });
  assert.equal(customRenderer.edgeTts, '/private/tts/bin/edge-tts');
  assert.ok(!JSON.stringify(defaults).includes('never-load'));
  assert.throws(() => configModule.loadConfig({ KHERIX_COMPANION_HOST: '0.0.0.0' }), /loopback/);
  assert.throws(() => configModule.loadConfig({ SWARMCLAW_SESSION_ID: 'replacement' }), /pinned/);
  assert.throws(() => configModule.loadConfig({ SWARMCLAW_AGENT_ID: 'replacement' }), /pinned/);
  assert.throws(() => configModule.loadConfig({ KHERIX_COMPANION_PUBLIC_URL: 'https://u:p@example.test' }), /origin/);
});
