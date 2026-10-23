import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

PLUGIN = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, PLUGIN / path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


identity = module('identity', 'hooks/codex_hooks/terminal_identity.py')
config = module('config', 'scripts/configure-terminal.py')
SID = '11111111-1111-4111-8111-111111111111'


class TerminalIdentity(unittest.TestCase):
    def test_abbreviated_native_titles_are_unique_not_prefix_guesses(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {'CODEX_HOME': directory}):
            db = sqlite3.connect(Path(directory) / 'state_5.sqlite')
            db.execute('create table threads (id text)')
            db.execute('insert into threads values (?)', (SID,))
            db.commit()
            title = SID[:29] + '... | task'
            self.assertTrue(identity.identifies(title, SID))
            db.execute('insert into threads values (?)', (SID[:-1] + '2',))
            db.commit()
            self.assertFalse(identity.identifies(title, SID))
            db.close()

    def test_shared_daemon_is_not_the_terminal_and_titles_bind_exactly(self):
        with tempfile.TemporaryDirectory() as directory:
            proc = Path(directory)
            tui = proc / '42'
            tui.mkdir()
            (tui / 'cmdline').write_bytes(b'/bin/codex\0--yolo\0')
            (tui / 'environ').write_bytes(b'TMUX=/tmp/tmux-test,99,0\0TMUX_PANE=%3\0SECRET=must-not-be-copied\0')
            (tui / 'status').write_text('PPid:\t41\n')
            command = lambda _: f'99\t41\tmy-session\t0\t0\t%3\tTask | {SID}'
            result = identity.client(42, SID, proc, command)
            self.assertEqual(result['pid'], 42)
            self.assertEqual(result['tmux']['session'], 'my-session')
            self.assertNotIn('SECRET', json.dumps(result))
            self.assertIsNone(identity.client(42, '22222222-2222-4222-8222-222222222222', proc, command))
            self.assertIsNone(identity.client(42, SID, proc, lambda _: command([]).replace('99\t', '100\t', 1)))
            (tui / 'cmdline').write_bytes(b'/bin/codex\0app-server\0')
            self.assertIsNone(identity.client(42, SID, proc, command))

    def test_config_preserves_preferences_and_is_idempotent(self):
        before = '# keep\n[tui]\nterminal_title = ["thread-name"] # keep too\n[notice]\nx = true\n'
        after = config.configure(before)
        self.assertIn('["thread-id", "thread-name"] # keep too', after)
        self.assertTrue(after.endswith('[notice]\nx = true\n'))
        self.assertEqual(after, config.configure(after))
        self.assertIn('[tui]\nterminal_title', config.configure(''))
        self.assertEqual(config.configure('[tui]\nterminal_title = ["session-id"]\n'), '[tui]\nterminal_title = ["session-id"]\n')


if __name__ == '__main__':
    unittest.main()
