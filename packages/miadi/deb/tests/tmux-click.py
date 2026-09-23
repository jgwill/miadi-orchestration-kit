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
prompt = "~/src/Miadi main > echo miadi-chronicle:126"     # a shell would expand a leading ~
wrapped = "x" * 79 + " miadi-chronicle:092/126 now"         # wraps at the 100-cell pane edge
lines_file = os.path.join(work, "lines")
with open(lines_file, "w") as fh:
    fh.write("\n".join([line, prompt, wrapped]) + "\n")
run("new-session", "-d", "-s", "click", "-x", "100", "-y", "20", f"cat {lines_file}; sleep 60")
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


def click(column, row=0, settle=0.8):  # 0-based cells; SGR mouse is 1-based
    os.write(fd, f"\x1b[<0;{column + 1};{row + 1}M".encode())
    drain(0.05)
    os.write(fd, f"\x1b[<0;{column + 1};{row + 1}m".encode())
    drain(settle)


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
    click(prompt.index("miadi-chronicle") + 3, row=1)
    want126 = "https://front.test/api/chronicle/open?uri=miadi-chronicle%3A126"
    got = opened_lines()[-1:]
    results.append((f"a prompt line starting with ~ keeps its columns (opened {got})", got == [want126]))
    click(85, row=2)
    want_wrapped = "https://front.test/api/chronicle/open?uri=miadi-chronicle%3A092%2F126"
    got = opened_lines()[-1:]
    results.append((f"a reference wrapped at the pane edge opens whole (opened {got})", got == [want_wrapped]))
    before = len(opened_lines())
    drain(1.6)                     # past the repeat window, then a double click
    click(prompt.index("miadi-chronicle") + 3, row=1, settle=0.1)
    click(prompt.index("miadi-chronicle") + 3, row=1)
    got = opened_lines()[before:]
    results.append((f"a double click opens once (opened {got})", got == [want126]))
finally:
    subprocess.run(tmux + ["kill-server"], env=env)
    shutil.rmtree(work, ignore_errors=True)

for name, ok in results:
    print(f"  {'✓' if ok else '✗'} {name}")
sys.exit(0 if all(ok for _, ok in results) else 1)
