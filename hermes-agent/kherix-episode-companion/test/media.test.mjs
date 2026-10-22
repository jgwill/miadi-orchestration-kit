import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const media = await import('../media.mjs').catch(() => ({}));

test('speech adapters use CPU ffmpeg with trailing silence and English Groq, then argv-only Kherix Edge TTS', async t => {
  assert.equal(typeof media.createSpeechTools, 'function');
  const dir = mkdtempSync(join(tmpdir(), 'kherix-media-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const raw = join(dir, 'take.m4a'); writeFileSync(raw, 'original voice');
  const calls = [];
  let padded;
  const tools = media.createSpeechTools({ groqKey: 'unit-groq-not-live', run: async (command, args, options) => {
    calls.push({ command, args, options });
    if (command === 'ffmpeg') { padded = args.at(-1); writeFileSync(padded, 'padded wav'); }
    else writeFileSync(args[args.indexOf('--write-media') + 1], 'mp3 test bytes');
  }, fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(init.headers.authorization, 'Bearer unit-groq-not-live');
    assert.equal(init.body.get('model'), 'whisper-large-v3-turbo');
    assert.equal(init.body.get('language'), 'en');
    assert.equal(init.body.get('prompt'), 'Kherix, Miadi, SwarmClaw, Guillaume, Mia.');
    assert.equal(await init.body.get('file').text(), 'padded wav');
    return new Response(JSON.stringify({ text: 'English words' }));
  } });
  assert.equal(await tools.transcribe({ path: raw }), 'English words');
  assert.equal(readFileSync(raw, 'utf8'), 'original voice');
  assert.equal(existsSync(padded), false);
  assert.ok(calls[0].args.includes('apad=pad_dur=3'));
  assert.equal(calls[0].options.env.CUDA_VISIBLE_DEVICES, '');
  const audio = await tools.synthesize({ text: 'Kherix, not Mia; $(never a shell)', voice: 'en-US-GuyNeural', outputPath: join(dir, 'reply.mp3') });
  assert.equal(audio.toString(), 'mp3 test bytes');
  assert.equal(calls[1].command, '/home/mia/.local/bin/edge-tts');
  assert.deepEqual(calls[1].args.slice(0, 2), ['--voice', 'en-US-GuyNeural']);
  const textFile = calls[1].args[calls[1].args.indexOf('--file') + 1];
  assert.equal(readFileSync(textFile, 'utf8'), 'Kherix, not Mia; $(never a shell)');
  assert.equal(statSync(textFile).mode & 0o777, 0o600);
  assert.ok(!calls[1].options.shell);
});
