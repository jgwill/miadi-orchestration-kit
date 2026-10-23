#!/usr/bin/env python3
"""Find the TUI that publishes this thread ID, rather than its shared app-server."""
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys

UUID = re.compile(r"(?<![\w-])[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}(?![\w-])", re.I)
SHORT_ID = re.compile(r"(?<![\w-])([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{5,11})\.{3}(?!\w)", re.I)


def identifies(title, sid):
    ids = set(UUID.findall(title))
    for prefix in SHORT_ID.findall(title):
        # Native terminal titles shorten the UUID. Resolve only a unique native
        # database identity; never infer a thread from process age or its cwd.
        candidates = set()
        home = Path(os.environ.get('CODEX_HOME', Path.home() / '.codex'))
        for database in home.glob('state_*.sqlite'):
            try:
                connection = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True, timeout=.2)
                try:
                    candidates.update(row[0] for row in connection.execute('select id from threads where id like ?', (prefix + '%',)))
                finally:
                    connection.close()
            except sqlite3.Error:
                continue
        if len(candidates) != 1:
            return False
        ids.update(candidates)
    return ids == {sid}


def run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=2, check=True).stdout.strip()


def client(pid, sid, proc=Path('/proc'), command=run):
    folder = proc / str(pid)
    argv = [s.decode(errors='replace') for s in (folder / 'cmdline').read_bytes().split(b'\0') if s]
    if not argv or 'app-server' in argv:
        return None
    # Read only the terminal keys. Never serialize a process's credential environment.
    env = dict(item.split(b'=', 1) for item in (folder / 'environ').read_bytes().split(b'\0') if b'=' in item)
    address = env.get(b'TMUX', b'').decode()
    pane = env.get(b'TMUX_PANE', b'').decode()
    if not address or not pane:
        return None
    sock, server, _ = address.split(',', 2)
    fields = command(['tmux', '-S', sock, 'display-message', '-p', '-t', pane,
                      '#{pid}\t#{pane_pid}\t#{session_name}\t#{window_index}\t#{pane_index}\t#{pane_id}\t#{pane_title}']).split('\t', 6)
    if len(fields) != 7 or fields[0] != server or not identifies(fields[6], sid):
        return None
    parent = pid
    for _ in range(32):
        if str(parent) == fields[1]:
            return {'pid': pid, 'argv': argv, 'tmux': {'session': fields[2], 'window': int(fields[3]),
                    'pane': int(fields[4]), 'pane_id': fields[5], 'socket': sock}}
        if parent <= 1:
            break
        status = (proc / str(parent) / 'status').read_text()
        parent = int(next(line.split()[1] for line in status.splitlines() if line.startswith('PPid:')))
    return None


def locate(sid):
    if not UUID.fullmatch(sid):
        return {}
    matches = []
    for value in run(['ps', '-C', 'codex', '-o', 'pid=']).split():
        try:
            pid = int(value)
            if Path(f'/proc/{pid}').stat().st_uid != os.getuid():
                continue
            match = client(pid, sid)
            if match:
                matches.append(match)
        except (OSError, ValueError, StopIteration, subprocess.SubprocessError):
            continue
    return matches[0] if len(matches) == 1 else {}


if __name__ == '__main__':
    try:
        print(json.dumps(locate(sys.argv[1])))
    except (OSError, ValueError, subprocess.SubprocessError):
        print('{}')
