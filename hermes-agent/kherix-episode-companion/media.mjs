import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync, rmSync, statSync } from 'node:fs';

/** No shell, no CUDA, no access to Mia's state or voice layer. */
export function createSpeechTools({ groqKey = '', fetchImpl = fetch, run = promisify(execFile), ffmpeg = 'ffmpeg', edgeTts = '/home/mia/.local/bin/edge-tts' } = {}) {
  const processOptions = { timeout: 180_000, maxBuffer: 1024 * 1024, env: { ...process.env, CUDA_VISIBLE_DEVICES: '' }, shell: false };
  return {
    async transcribe({ path }) {
      if (!groqKey) throw new Error('English STT is not configured');
      // Inspect the original signal, before padding: Whisper can hallucinate words on silence.
      const analysis = await run(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'info', '-i', path, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], processOptions);
      const level = String(analysis?.stderr ?? '').match(/max_volume:\s*(-?inf|[-+\d.]+)\s*dB/);
      if (!level) throw new Error('Recording signal could not be checked');
      const peak = level[1] === '-inf' ? -Infinity : Number(level[1]);
      if (peak < -50) throw Object.assign(new Error('The recording contains silence or an extremely quiet microphone signal. The original audio is preserved. Check the microphone signal and record again.'), { code: 'NO_USABLE_AUDIO' });
      const padded = `${path}.${randomUUID()}.padded.wav`;
      try {
        await run(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-vn', '-af', 'apad=pad_dur=3', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', padded], processOptions);
        chmodSync(padded, 0o600);
        if (statSync(padded).size > 25 * 1024 * 1024) throw new Error('Converted recording exceeds the STT provider limit');
        const body = new FormData();
        body.set('file', new Blob([readFileSync(padded)], { type: 'audio/wav' }), 'recording.wav');
        body.set('model', 'whisper-large-v3-turbo');
        body.set('language', 'en');
        body.set('prompt', 'Kherix, Miadi, SwarmClaw, Guillaume, Mia.');
        body.set('response_format', 'json');
        const response = await fetchImpl('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${groqKey}` }, body, redirect: 'error', signal: AbortSignal.timeout(120_000) });
        if (!response.ok) throw new Error('English STT provider refused the recording');
        const result = await response.json();
        if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('English STT returned no words');
        return result.text;
      } finally { rmSync(padded, { force: true }); }
    },
    async synthesize({ text, voice, outputPath }) {
      const textPath = `${outputPath}.txt`;
      const partial = `${outputPath}.${randomUUID()}.partial.mp3`;
      writeFileSync(textPath, text, { mode: 0o600 }); chmodSync(textPath, 0o600);
      try {
        await run(edgeTts, ['--voice', voice, '--file', textPath, '--write-media', partial], processOptions);
        chmodSync(partial, 0o600);
        const audio = readFileSync(partial);
        if (!audio.length) throw new Error('Kherix speech renderer returned no audio');
        return audio;
      } finally { rmSync(partial, { force: true }); }
    },
  };
}
