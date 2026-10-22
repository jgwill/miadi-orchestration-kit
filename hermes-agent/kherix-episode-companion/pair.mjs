#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';

// Run locally, not through an unauthenticated HTTP endpoint. One pending grant.
export function createPairing({ stateDir, publicUrl, now = Date.now() }) {
  const origin = new URL(publicUrl);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Pairing needs a credential-free HTTPS origin');
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const code = randomBytes(32).toString('base64url');
  const temporary = join(stateDir, 'pairing.json.new');
  writeFileSync(temporary, JSON.stringify({ digest: createHash('sha256').update(code).digest('hex'), expiresAt: now + 10 * 60 * 1000 }), { mode: 0o600 });
  renameSync(temporary, join(stateDir, 'pairing.json'));
  return `${origin.origin}/#pair=${code}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const config = loadConfig();
  const link = createPairing(config);
  const file = join(config.stateDir, 'pairing-url.txt');
  writeFileSync(file, link + '\n', { mode: 0o600 });
  console.log(`Single-use pairing link saved privately to ${file}; expires in ten minutes. Do not paste it into chat or commit it.`);
}
