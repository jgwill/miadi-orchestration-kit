"""Exercise the rendered, real Apache proxy against an isolated HTTP backend.

No Hermes process, user configuration, secret, Tailscale state or live port is
changed. Requires apache2-bin; uses only Python's standard library.
"""
import http.server
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

INSTALLER = Path(os.environ.get('HERMES_TAILNET_INSTALLER',
    str(Path(__file__).resolve().parents[1] / '26-hermes-tailscale-autostart.sh')))
KEY = 'laskmi-isolated-test-key'
FINISH = threading.Event()


class Backend(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.headers.get('Authorization') != 'Bearer ' + KEY:
            self.send_error(401)
        elif self.path == '/p/laskmi/v1/models':
            body = json.dumps({'profile': 'laskmi', 'path': self.path}).encode()
            self.send_response(200)
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        if self.path != '/p/laskmi/v1/chat/completions' or json.loads(data) != {'stream': True}:
            self.send_error(400)
            return
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream')
        self.end_headers()
        self.wfile.write(b'data: {"delta":"first"}\n\n')
        self.wfile.flush()
        FINISH.wait(5)
        self.wfile.write(b'data: [DONE]\n\n')
        self.wfile.flush()


class ProxyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='hermes-tailnet-proxy-test-')
        tmp = Path(cls.temp.name)
        cls.backend = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Backend)
        threading.Thread(target=cls.backend.serve_forever, daemon=True).start()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{port}'
        env = dict(os.environ, MIADI_KHERIX_API_SERVER_PORT=str(cls.backend.server_port),
                   MIADI_LASKMI_API_SERVER_PORT=str(port))
        config = subprocess.check_output(['bash', str(INSTALLER), '--render-proxy'], env=env, text=True)
        # Redirect only the renderer's runtime artifacts into the isolated test dir.
        state_line = next(line for line in config.splitlines() if line.startswith('DefaultRuntimeDir '))
        state = state_line.split('"')[1]
        config = config.replace(state, str(tmp))
        conf = tmp / 'apache.conf'
        conf.write_text(config)
        cls.log = (tmp / 'launcher.log').open('w')
        cls.proc = subprocess.Popen(['/usr/sbin/apache2', '-f', str(conf), '-DFOREGROUND'], stdout=cls.log, stderr=cls.log)
        for _ in range(100):
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.1):
                    break
            except OSError:
                if cls.proc.poll() is not None:
                    logs = ''.join(p.read_text() for p in [tmp / 'launcher.log', tmp / 'error.log'] if p.exists())
                    raise RuntimeError(logs)
                time.sleep(.05)
        else:
            raise RuntimeError('proxy did not listen')

    @classmethod
    def tearDownClass(cls):
        FINISH.set()
        cls.proc.terminate()
        cls.proc.wait(timeout=10)
        cls.log.close()
        cls.backend.shutdown()
        cls.backend.server_close()
        cls.temp.cleanup()

    def test_prefix_and_authorization_forwarded(self):
        req = urllib.request.Request(self.base + '/v1/models', headers={'Authorization': 'Bearer ' + KEY})
        with urllib.request.urlopen(req, timeout=3) as res:
            self.assertEqual(json.load(res), {'profile': 'laskmi', 'path': '/p/laskmi/v1/models'})

    def test_no_auth_and_cross_profile_key_rejected(self):
        for token in ['', 'default-profile-test-key']:
            with self.subTest(token=bool(token)):
                req = urllib.request.Request(self.base + '/v1/models', headers={'Authorization': 'Bearer ' + token})
                with self.assertRaises(urllib.error.HTTPError) as err:
                    urllib.request.urlopen(req, timeout=3)
                self.assertEqual(err.exception.code, 401)
                err.exception.close()

    def test_caller_cannot_select_default_namespace(self):
        req = urllib.request.Request(self.base + '/p/default/v1/models', headers={'Authorization': 'Bearer ' + KEY})
        with self.assertRaises(urllib.error.HTTPError) as err:
            urllib.request.urlopen(req, timeout=3)
        self.assertEqual(err.exception.code, 404)
        err.exception.close()

    def test_sse_first_chunk_arrives_before_backend_finishes(self):
        FINISH.clear()
        req = urllib.request.Request(self.base + '/v1/chat/completions', data=b'{"stream":true}',
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=3) as res:
                self.assertEqual(res.headers['Content-Type'], 'text/event-stream')
                self.assertEqual(res.readline(), b'data: {"delta":"first"}\n')
                self.assertFalse(FINISH.is_set())
                FINISH.set()
                self.assertIn(b'data: [DONE]', res.read())
        finally:
            FINISH.set()

    def test_equal_ports_refused(self):
        env = dict(os.environ, MIADI_KHERIX_API_SERVER_PORT='18001', MIADI_LASKMI_API_SERVER_PORT='18001')
        done = subprocess.run(['bash', str(INSTALLER), '--render-proxy'], env=env, capture_output=True, text=True)
        self.assertNotEqual(done.returncode, 0)
        self.assertIn('distinct port', done.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
