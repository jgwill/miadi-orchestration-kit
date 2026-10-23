"""Rendered UI verification with explicit local fixtures, never live chat.
Run: uv run --with playwright python scripts/verify-phone-ui.py --output DIR
Requires Playwright Chromium. This is not human phone acceptance or real STT.
"""
import argparse
import io
import json
import math
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
state = {'messages': [{'id': 'old-reply', 'role': 'assistant', 'text': 'Browser fixture: our conversation stays here. This is not a live Kherix reply.', 'streaming': False}], 'activity': {'state': 'running', 'queuedCount': 1, 'detail': 'Explicit browser fixture, not live work.'}, 'takes': [], 'sends': [], 'audio': []}
for i in range(12):
    state['messages'].insert(0, {'id': f'old-{i}', 'role': 'user', 'text': 'Earlier browser fixture for scrolling. ' * 12})
audio = io.BytesIO()
with wave.open(audio, 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(8000)
    wav.writeframes(b''.join(int(3000 * math.sin(2 * math.pi * 440 * i / 8000)).to_bytes(2, 'little', signed=True) for i in range(6000)))
AUDIO = audio.getvalue()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def answer(self, data, mime='application/json'):
        data = data if isinstance(data, bytes) else json.dumps(data).encode()
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/context':
            return self.answer({'session': {'id': 'fe331909', 'agentId': '3d3a349a'}, 'context': {'intention': 'Explicit isolated browser test fixture'}})
        if path == '/api/thread':
            return self.answer({'messages': state['messages'], 'total': len(state['messages']), 'hasMore': False})
        if path == '/api/activity':
            return self.answer(state['activity'])
        if path == '/api/takes':
            return self.answer({'takes': state['takes']})
        if path.startswith('/api/takes/'):
            return self.answer({'take': next(t for t in state['takes'] if t['id'] == path.split('/')[3])})
        if path.startswith('/api/receipts/'):
            return self.answer({'receipt': {**state['sends'][-1], 'state': 'queued'}})
        if path.startswith('/api/replies/'):
            state['audio'].append(path)
            return self.answer(AUDIO, 'audio/wav')
        files = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/state.js': ('state.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
        if path in files:
            file, mime = files[path]
            return self.answer((ROOT / 'public' / file).read_bytes(), mime)
        self.send_error(404)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path == '/api/messages':
            payload = json.loads(body)
            state['sends'].append(payload)
            return self.answer({'receipt': {**payload, 'state': 'queued'}})
        if self.path == '/api/takes':
            take = {'id': self.headers['x-client-id'], 'mime': self.headers['Content-Type'], 'bytes': len(body), 'state': 'ready', 'transcript': 'Generated browser fixture, not an instruction from William.', 'audio': '/fixture.wav'}
            state['takes'].append(take)
            return self.answer({'take': take})
        self.send_error(404)

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
report = {'kind': 'isolated-browser-fixtures-not-physical-phone-or-live-STT', 'browser': args.browser, 'liveChatMessagesSent': 0}
try:
    with sync_playwright() as p:
        browser_type = getattr(p, args.browser)
        launch = {'headless': True}
        if args.browser == 'chromium':
            launch['args'] = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
        browser = browser_type.launch(**launch)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/')
        page.wait_for_function("document.getElementById('sync-status').textContent.startsWith('Updated')")
        assert 'Kherix is working' in page.locator('#work-status').inner_text()
        assert '1 queued' in page.locator('#work-status').inner_text()
        assert 'Browser fixture: our conversation' in page.locator('#thread article').first.inner_text()
        before = page.locator('#record').bounding_box()
        page.locator('#feed').evaluate('(el) => el.scrollTop = 700')
        assert page.locator('#record').bounding_box() == before, 'Record moved while reading'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal phone overflow'
        report['stickyRecord'] = True
        page.locator('#write').click()
        page.locator('#composer').fill('Unsent browser fixture correction')
        state['activity'] = {'state': 'idle', 'queuedCount': 0}
        page.locator('#refresh').click()
        page.wait_for_function("document.getElementById('work-status').textContent.includes('Ready')")
        assert page.locator('#composer').input_value() == 'Unsent browser fixture correction'
        assert not state['sends']
        report['refreshPreservesDraft'] = True
        page.locator('#writing').evaluate('(el) => el.open = false')
        page.locator('#hear-latest').click()
        page.wait_for_function("document.getElementById('reply-audio').currentTime > 0")
        page.wait_for_function("document.getElementById('reply-audio').ended")
        page.locator('#autoplay').check()
        for ident in ['new-one', 'new-two']:
            state['messages'].append({'id': ident, 'role': 'assistant', 'text': f'New browser fixture {ident}', 'streaming': False})
        page.locator('#refresh').click()
        page.wait_for_function("document.getElementById('reply-audio').src.includes('new-two') && document.getElementById('reply-audio').ended", timeout=15000)
        assert state['audio'][-2:] == ['/api/replies/new-one/audio', '/api/replies/new-two/audio'], state['audio']
        report['actualDecodedSequentialAudio'] = True
        # Actual MediaRecorder with an explicitly fake browser device. No live STT/provider.
        if args.browser == 'chromium':
            page.locator('#record').click()
            page.wait_for_function("!document.getElementById('stop').hidden")
            state['messages'].append({'id': 'during-capture', 'role': 'assistant', 'text': 'Browser fixture: waits for your microphone', 'streaming': False})
            page.locator('#refresh').click()
            page.wait_for_function("document.getElementById('listen-status').textContent.includes('1 waiting')")
            assert page.locator('#reply-audio').evaluate('(el) => el.paused')
            page.wait_for_timeout(1300)
            page.locator('#stop').click()
            page.wait_for_selector('#takes textarea')
            assert page.locator('#reply-audio').evaluate('(el) => el.paused'), 'Audio restarted during transcript review'
            assert state['takes'][0]['bytes'] > 0
            page.once('dialog', lambda dialog: dialog.accept())  # Explicit fixture confirmation to replace the unsent draft.
            page.get_by_role('button', name='Use in composer', exact=True).click()
            assert page.locator('#composer').input_value().startswith('Generated browser fixture')
            assert not state['sends'], 'Capture or review sent a chat without Send'
            page.locator('#send').click()
            page.wait_for_function("document.getElementById('delivery-status').textContent.includes('Received')")
            assert len(state['sends']) == 1
            report['fakeDeviceCaptureReviewExplicitSend'] = True
        page.locator('#feed').evaluate('(el) => el.scrollTop = 0')
        page.screenshot(path=str(args.output / f'phone-ui-{args.browser}.png'))
        report['pageErrors'] = errors
        assert not errors, errors
        for width, height in [(320, 568), (430, 932), (844, 390)]:
            page.set_viewport_size({'width': width, 'height': height})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert page.locator('#record').bounding_box()['y'] >= 0
            assert page.locator('#feed').bounding_box()['height'] > 80
        report['responsiveSizes'] = ['390x844', '320x568', '430x932', '844x390']
        report['passed'] = True
        browser.close()
finally:
    server.shutdown()
    (args.output / f'phone-ui-{args.browser}.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
