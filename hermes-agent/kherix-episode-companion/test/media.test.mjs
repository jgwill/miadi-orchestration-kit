import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const media = await import('../media.mjs').catch(() => ({}));

test('real near-silent phone audio is preserved and rejected before ASR can invent words', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'kherix-silence-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const raw = join(dir, 'phone.m4a');
  execFileSync('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.6', '-af', 'volume=0.001', '-c:a', 'aac', raw]);
  const before = readFileSync(raw); let requests = 0;
  const tools = media.createSpeechTools({ groqKey: 'unit-groq-not-live', fetchImpl: async () => { requests++; return Response.json({ text: ' Thank you.' }); } });
  await assert.rejects(tools.transcribe({ path: raw }), error => error.code === 'NO_USABLE_AUDIO' && /quiet|silence/i.test(error.message));
  assert.equal(requests, 0, 'silence must not reach ASR');
  assert.deepEqual(readFileSync(raw), before, 'original bytes survive');
});

test('speech adapters use CPU ffmpeg with trailing silence and English Groq, then argv-only Kherix Edge TTS', async t => {
  assert.equal(typeof media.createSpeechTools, 'function');
  const dir = mkdtempSync(join(tmpdir(), 'kherix-media-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const raw = join(dir, 'take.m4a'); writeFileSync(raw, 'original voice');
  const calls = [];
  let padded;
  const tools = media.createSpeechTools({ groqKey: 'unit-groq-not-live', run: async (command, args, options) => {
    calls.push({ command, args, options });
    if (args.includes('volumedetect')) return { stderr: '[Parsed_volumedetect] max_volume: -10.0 dB' };
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
  assert.ok(calls[1].args.includes('apad=pad_dur=3'));
  assert.equal(calls[0].options.env.CUDA_VISIBLE_DEVICES, '');
  const audio = await tools.synthesize({ text: 'Kherix, not Mia; $(never a shell)', voice: 'en-US-GuyNeural', outputPath: join(dir, 'reply.mp3') });
  assert.equal(audio.toString(), 'mp3 test bytes');
  assert.equal(calls[2].command, '/home/mia/.local/bin/edge-tts');
  assert.deepEqual(calls[2].args.slice(0, 2), ['--voice', 'en-US-GuyNeural']);
  const textFile = calls[2].args[calls[2].args.indexOf('--file') + 1];
  assert.equal(readFileSync(textFile, 'utf8'), 'Kherix, not Mia; $(never a shell)');
  assert.equal(statSync(textFile).mode & 0o777, 0o600);
  assert.ok(!calls[2].options.shell);
});
