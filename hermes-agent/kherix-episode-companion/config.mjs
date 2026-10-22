import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

// Deliberately not dotenv/source: no execution, interpolation or unrelated keys.
function namedEnvKey(path, name) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return ''; throw new Error('A configured credential file could not be read'); }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match?.[1] !== name) continue;
    const value = match[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      const end = value.indexOf(value[0], 1);
      if (end < 0) throw new Error('A configured credential value is malformed');
      return value.slice(1, end);
    }
    return value.replace(/\s+#.*$/, '').trim();
  }
  return '';
}

export function loadConfig(env = process.env) {
  const host = env.KHERIX_COMPANION_HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Companion must bind to loopback');
  const port = Number(env.KHERIX_COMPANION_PORT || 8774);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Companion port must be 1–65535');
  if ((env.SWARMCLAW_SESSION_ID && env.SWARMCLAW_SESSION_ID !== 'fe331909') || (env.SWARMCLAW_AGENT_ID && env.SWARMCLAW_AGENT_ID !== '3d3a349a')) throw new Error('M1 session and agent are pinned; refusing a replacement');
  const publicUrl = env.KHERIX_COMPANION_PUBLIC_URL || '';
  if (publicUrl) {
    const url = new URL(publicUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Public URL must be a credential-free HTTPS origin');
  }
  const upstream = new URL(env.SWARMCLAW_URL || 'http://127.0.0.1:3456');
  if (!['http:', 'https:'].includes(upstream.protocol) || upstream.username || upstream.password || upstream.search || upstream.hash || upstream.pathname !== '/') throw new Error('SwarmClaw URL must be a credential-free HTTP(S) origin');
  return {
    host, port, publicUrl: publicUrl ? new URL(publicUrl).origin : '',
    stateDir: resolve(env.KHERIX_COMPANION_STATE_DIR || join(homedir(), '.local/state/kherix-episode-companion')),
    swarmclawUrl: upstream.origin,
    accessKey: env.ACCESS_KEY || namedEnvKey(env.SWARMCLAW_ENV_FILE || '/srv/miadi/swarmclaw/.env.local', 'ACCESS_KEY'),
    groqKey: env.GROQ_API_KEY || namedEnvKey(env.KHERIX_STT_ENV_FILE || '/a/src/Miadi/.env', 'GROQ_API_KEY'),
    authToken: env.KHERIX_COMPANION_AUTH_TOKEN || '',
    allowedLogin: env.KHERIX_ALLOWED_LOGIN || '',
    voice: env.KHERIX_TTS_VOICE || 'en-US-GuyNeural',
    edgeTts: env.KHERIX_EDGE_TTS_BIN || join(homedir(), '.local/bin/edge-tts'),
    desktopUrl: env.KHERIX_DESKTOP_URL || '',
  };
}
