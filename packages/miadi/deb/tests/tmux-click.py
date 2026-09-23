#!/usr/bin/env python3
"""Click a miadi-chronicle: reference in a real tmux, through a real client.

    python3 tests/tmux-click.py <tmux conf> <miadi-chronicle-open>

Starts a private tmux server, prints a line holding a reference in a pane,
attaches a client on a pseudo-terminal and writes SGR mouse press/release
sequences into it — the bytes a terminal emulator (or Termux, for a tap) sends.
A stub xdg-open records what the click opened. No real browser, no real
server: it proves the binding, the column arithmetic and the URL.
"""

import os
import pty
import select
import shutil
import subprocess
import sys
import tempfile
import time

conf, opener = sys.argv[1], os.path.abspath(sys.argv[2])
work = tempfile.mkdtemp(prefix="miadi-tmux-click-")
socket = f"miadi-click-{os.getpid()}"
opened = os.path.join(work, "opened")
stubs = os.path.join(work, "bin")
os.makedirs(stubs)
with open(os.path.join(stubs, "xdg-open"), "w") as fh:
    fh.write(f"#!/bin/sh\nprintf '%s\\n' \"$1\" >> {opened}\n")
os.chmod(os.path.join(stubs, "xdg-open"), 0o755)
local_conf = os.path.join(work, "miadi-chronicle.conf")
with open(conf) as src, open(local_conf, "w") as dst:
    dst.write(src.read().replace("/usr/bin/miadi-chronicle-open", f"python3 {opener}"))

env = dict(os.environ, PATH=f"{stubs}:{os.environ['PATH']}",
           MIADI_CHRONICLE_OPEN_URL="https://front.test", TERM="xterm-256color",
           LC_ALL="C.UTF-8")  # wide characters are two cells only in a UTF-8 tmux
env.pop("TMUX", None)
tmux = ["tmux", "-L", socket, "-f", "/dev/null"]


def run(*args):
    subprocess.run(tmux + list(args), env=env, check=True)


line = "see miadi-chronicle:092/126#scene=river, then 世界 miadi-chronicle:311."
run("new-session", "-d", "-s", "click", "-x", "100", "-y", "20",
    f"printf '%s\\n' '{line}'; sleep 60")
run("set", "-g", "mouse", "on")
run("set", "-g", "status", "off")
run("source-file", local_conf)

pid, fd = pty.fork()
if pid == 0:
    os.execvpe("tmux", tmux + ["attach", "-t", "click"], env)


def drain(seconds):
    end = time.time() + seconds
    while time.time() < end:
        ready, _, _ = select.select([fd], [], [], 0.05)
        if ready:
            try:
                os.read(fd, 65536)
            except OSError:
                return


def click(column):  # column is 0-based, SGR mouse is 1-based
    os.write(fd, f"\x1b[<0;{column + 1};1M".encode())
    drain(0.1)
    os.write(fd, f"\x1b[<0;{column + 1};1m".encode())
    drain(0.8)


def opened_lines():
    try:
        return open(opened).read().split()
    except FileNotFoundError:
        return []


import fcntl, struct, termios
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 20, 100, 0, 0))
drain(1.5)
results = []
try:
    click(1)                       # on "see": nothing
    results.append(("click beside a reference opens nothing", opened_lines() == []))
    click(12)                      # inside miadi-chronicle:092/126#scene=river
    want = "https://front.test/api/chronicle/open?uri=miadi-chronicle%3A092%2F126%23scene%3Driver"
    results.append(("click on a reference opens its open door", opened_lines() == [want]))
    wide = line.index("世界")
    click(wide + 2 + 3 + 2)        # after two wide cells, inside miadi-chronicle:311
    want311 = "https://front.test/api/chronicle/open?uri=miadi-chronicle%3A311"
    got = opened_lines()[-1:]
    version = subprocess.run(["tmux", "-V"], capture_output=True, text=True).stdout.split()[-1]
    if tuple(int(n) for n in "".join(c if c.isdigit() or c == "." else " " for c in version).split()[0].split(".")) < (3, 6):
        # Measured on 3.2a and 3.4 (Ubuntu 22.04, 24.04): mouse_line ends at the first wide
        # character, so a reference after one is not on the line tmux reports.
        print(f"  - wide characters skipped: tmux {version} cuts mouse_line at the first one")
    else:
        results.append((f"columns count wide characters as two cells (opened {got})", got == [want311]))
finally:
    subprocess.run(tmux + ["kill-server"], env=env)
    shutil.rmtree(work, ignore_errors=True)

for name, ok in results:
    print(f"  {'✓' if ok else '✗'} {name}")
sys.exit(0 if all(ok for _, ok in results) else 1)
