import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('the start entrypoint fails closed without authentication instead of silently exiting successfully', () => {
  const result = spawnSync(process.execPath, ['server.mjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 5000, env: { PATH: process.env.PATH, HOME: process.env.HOME, SWARMCLAW_ENV_FILE: '/does-not-exist', KHERIX_STT_ENV_FILE: '/does-not-exist' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /authentication.*configured/i);
});
