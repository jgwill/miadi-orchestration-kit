#!/usr/bin/env node
import { readFile, copyFile, chmod, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { atomicJson } from '../lib/storage.mjs';

export const packageRoot = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
export function migratedSettings(settings, source = packageRoot) {
  const result = structuredClone(settings);
  if (result.extensions !== undefined && !Array.isArray(result.extensions)) throw Error('extensions must be an array');
  if (result.packages !== undefined && !Array.isArray(result.packages)) throw Error('packages must be an array');
  result.extensions = (result.extensions || []).filter(entry =>
    typeof entry !== 'string' || !/\/(?:pi_hooks\/event_capture\.ts|miadi-session-observability\/extensions\/event-capture\.ts)$/.test(entry));
  const sources = new Set((result.packages || []).map(p => typeof p === 'string' ? p : p.source));
  if (!sources.has(source)) result.packages = [...(result.packages || []), source];
  return result;
}
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const index = args.indexOf('--agent-dir');
  const dir = index < 0 ? (process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent')) : args[index + 1];
  if (!dir || args.some((a, i) => !['--apply', '--agent-dir'].includes(a) && i !== index + 1)) throw Error('Usage: migrate-settings.mjs [--agent-dir <dir>] [--apply]');
  const file = join(resolve(dir), 'settings.json');
  const original = await readFile(file, 'utf8');
  const next = migratedSettings(JSON.parse(original));
  if (JSON.stringify(JSON.parse(original)) === JSON.stringify(next)) { console.log('Already migrated; no settings changed.'); return; }
  console.log(`${apply ? 'Applying' : 'Dry run:'} legacy capture → ${packageRoot}`);
  if (!apply) { console.log('No files changed. Add --apply for this account only.'); return; }
  const backup = `${file}.before-miadi-pi-observability-${Date.now()}`;
  const info = await stat(file);
  await copyFile(file, backup); await chmod(backup, 0o600);
  // Do not overwrite a concurrently changed user configuration.
  if (await readFile(file, 'utf8') !== original) throw Error('Settings changed concurrently; not overwritten');
  await atomicJson(file, next); await chmod(file, info.mode & 0o777 & 0o600);
  console.log(`Backup: ${backup}\nNew Pi processes use the package. Existing processes need /reload at an idle boundary.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
