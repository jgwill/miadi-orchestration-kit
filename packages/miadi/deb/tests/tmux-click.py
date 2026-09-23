#!/usr/bin/env python3
"""Click a miadi-chronicle: reference in a real tmux, through a real client.

    python3 tests/tmux-click.py <tmux conf> <miadi-chronicle-open>

Each scenario starts a private tmux server, shows lines in a pane of a given
width, attaches a client on a pseudo-terminal and writes SGR mouse
press/release sequences into it: the bytes a terminal emulator (or Termux,
for a tap) sends. A stub xdg-open records what each click opened. No real
browser, no real server: it proves the binding, the cell arithmetic, the
wrap join and the URL.
"""

import fcntl
import os
import pty
import select
import shutil
import struct
import subprocess
import sys
import tempfile
import termios
import time

conf, opener = sys.argv[1], os.path.abspath(sys.argv[2])
FRONT = "https://front.test/api/chronicle/open?uri="
results = []


def tmux_version():
    raw = subprocess.run(["tmux", "-V"], capture_output=True, text=True).stdout.split()[-1]
    digits = "".join(c if c.isdigit() or c == "." else " " for c in raw).split()[0]
    return raw, tuple(int(n) for n in digits.split("."))


class Scenario:
    """One private tmux server, one pane of `width` cells, one attached client."""

    def __init__(self, width, program):
        self.work = tempfile.mkdtemp(prefix="miadi-tmux-click-")
        self.opened = os.path.join(self.work, "opened")
        stubs = os.path.join(self.work, "bin")
        os.makedirs(stubs)
        with open(os.path.join(stubs, "xdg-open"), "w") as fh:
            fh.write(f"#!/bin/sh\nprintf '%s\\n' \"$1\" >> {self.opened}\n")
        os.chmod(os.path.join(stubs, "xdg-open"), 0o755)
        local_conf = os.path.join(self.work, "miadi-chronicle.conf")
        with open(conf) as src, open(local_conf, "w") as dst:
            dst.write(src.read().replace("/usr/bin/miadi-chronicle-open", f"python3 {opener}"))
        self.env = dict(os.environ, PATH=f"{stubs}:{os.environ['PATH']}", HOME=self.work,
                        MIADI_CHRONICLE_OPEN_URL="https://front.test", TERM="xterm-256color",
                        LC_ALL="C.UTF-8")  # wide characters are two cells only in a UTF-8 tmux
        self.env.pop("TMUX", None)
        self.env.pop("XDG_CACHE_HOME", None)
        self.tmux = ["tmux", "-L", f"miadi-click-{os.getpid()}-{id(self)}", "-f", "/dev/null"]
        self.run("new-session", "-d", "-s", "click", "-x", str(width), "-y", "20", program)
        self.run("set", "-g", "mouse", "on")
        self.run("set", "-g", "status", "off")
        self.run("source-file", local_conf)
        self.pid, self.fd = pty.fork()
        if self.pid == 0:
            os.execvpe("tmux", self.tmux + ["attach", "-t", "click"], self.env)
        fcntl.ioctl(self.fd, termios.TIOCSWINSZ, struct.pack("HHHH", 20, width, 0, 0))
        self.drain(1.5)

    def run(self, *args):
        subprocess.run(self.tmux + list(args), env=self.env, check=True)

    def drain(self, seconds):
        end = time.time() + seconds
        while time.time() < end:
            ready, _, _ = select.select([self.fd], [], [], 0.05)
            if ready:
                try:
                    os.read(self.fd, 65536)
                except OSError:
                    return

    def click(self, column, row=0, settle=0.8):  # 0-based cells; SGR mouse is 1-based
        os.write(self.fd, f"\x1b[<0;{column + 1};{row + 1}M".encode())
        self.drain(0.05)
        os.write(self.fd, f"\x1b[<0;{column + 1};{row + 1}m".encode())
        self.drain(settle)

    def opened_lines(self):
        try:
            return open(self.opened).read().split()
        except FileNotFoundError:
            return []

    def snapshot(self):
        """The pane as tmux captured it when the click landed: what the reader saw."""
        return subprocess.run(self.tmux + ["show-buffer", "-b", "miadi-chronicle-shown"],
                              env=self.env, capture_output=True, text=True).stdout.split("\n")

    def clicked_row(self, row):
        rows = self.snapshot()
        return rows[row] if row < len(rows) else ""

    def close(self):
        subprocess.run(self.tmux + ["kill-server"], env=self.env)
        shutil.rmtree(self.work, ignore_errors=True)


def lines_program(scenario_lines):
    path = tempfile.mktemp(prefix="miadi-tmux-lines-")
    with open(path, "w") as fh:
        fh.write("\n".join(scenario_lines) + "\n")
    return f"cat {path}; rm -f {path}; sleep 60"


def check(name, got, want):
    results.append((f"{name} (opened {got})", got == want))


version, numbers = tmux_version()

# A wide pane: beside, on, after wide characters, a ~ prompt, a double click.
line = "see miadi-chronicle:092/126#scene=river, then 世界 miadi-chronicle:311."
prompt = "~/src/Miadi main > echo miadi-chronicle:126"     # a shell would expand a leading ~
s = Scenario(100, lines_program([line, prompt]))
try:
    s.click(1)
    check("a click beside a reference opens nothing", s.opened_lines(), [])
    s.click(12)
    check("a click on a reference opens its open door", s.opened_lines(),
          [f"{FRONT}miadi-chronicle%3A092%2F126%23scene%3Driver"])
    if numbers < (3, 6):
        # Measured on 3.2a and 3.4 (Ubuntu 22.04, 24.04): mouse_line ends at the first wide character.
        print(f"  - wide characters skipped: tmux {version} cuts mouse_line at the first one")
    else:
        s.click(line.index("世界") + 2 + 3 + 2)
        check("columns count wide characters as two cells", s.opened_lines()[-1:], [f"{FRONT}miadi-chronicle%3A311"])
    s.click(prompt.index("miadi-chronicle") + 3, row=1)
    check("a prompt line starting with ~ keeps its columns", s.opened_lines()[-1:], [f"{FRONT}miadi-chronicle%3A126"])
    before = len(s.opened_lines())
    s.drain(1.6)                   # past the repeat window, then a double click
    s.click(prompt.index("miadi-chronicle") + 3, row=1, settle=0.1)
    s.click(prompt.index("miadi-chronicle") + 3, row=1)
    check("a double click opens once", s.opened_lines()[before:], [f"{FRONT}miadi-chronicle%3A126"])
finally:
    s.close()

# A 20-cell pane, a phone's width: wraps, a split scheme, emoji variation selectors.
s = Scenario(20, lines_program([
    "see the room miadi-chronicle:092/126 now",   # the edge falls inside "miadi-chronicle:"
    "✔️ tests pass, ship!!",                      # U+FE0F takes no cell: exactly 20 cells, one row
    "a miadi-chronicle:1",
    "b miadi-chronicle:2",
]))
try:
    s.click(15)                    # row 0 ends "miadi-c": joined, the whole reference opens
    check("a scheme split by the pane edge opens from its first row", s.opened_lines(),
          [f"{FRONT}miadi-chronicle%3A092%2F126"])
    s.drain(1.6)
    s.click(3, row=1)              # row 1 is "hronicle:092/126 now": neither word, the documented limit
    check("its second row, holding neither word, opens nothing", s.opened_lines()[1:], [])
    s.click(4, row=2)              # after ✔️ on its own row: "tests" opens nothing, cells line up
    check("a click on text after an emoji variation selector opens nothing", s.opened_lines()[1:], [])
    s.click(5, row=4)              # below the ✔️ line, which tmux versions lay out in one row or two
    shown = s.clicked_row(4)
    want = [f"{FRONT}miadi-chronicle%3A{shown.split(':')[-1].strip()}"] if "miadi-chronicle:" in shown else ["?"]
    check(f"below an emoji variation selector, the row the reader sees opens ({shown!r})",
          s.opened_lines()[-1:], want)
finally:
    s.close()

# Tabs (3.7 keeps them in what it captures) and an upper-case scheme.
s = Scenario(60, lines_program(["a\tmiadi-chronicle:1\tmiadi-chronicle:2", "see MIADI-CHRONICLE:126 here"]))
try:
    s.click(22)                    # a tab runs to cell 8: cells 8-24 are the first reference
    check("a tab runs to the next stop of 8", s.opened_lines(), [f"{FRONT}miadi-chronicle%3A1"])
    s.click(6, row=1)
    check("an upper-case scheme opens", s.opened_lines()[1:], [f"{FRONT}MIADI-CHRONICLE%3A126"])
finally:
    s.close()

# Two clicks on different rows 30 ms apart: each opens its own reference.
s = Scenario(60, lines_program(["a miadi-chronicle:1 here", "miadi-chronicle:2 miadi-chronicle:3"]))
try:
    s.click(5, settle=0.03)
    s.click(25, row=1, settle=1.5)
    check("two fast clicks each open their own reference", sorted(s.opened_lines()),
          sorted([f"{FRONT}miadi-chronicle%3A1", f"{FRONT}miadi-chronicle%3A3"]))
finally:
    s.close()


def streaming(width, name):
    """A pane still printing: the click opens what was under it when it landed."""
    s = Scenario(width, "i=0; while [ $i -lt 400 ]; do echo \"see miadi-chronicle:$i\"; i=$((i+1)); "
                        "sleep 0.02; done; sleep 30")
    try:
        s.drain(1.0)
        for row in (6, 7):         # at width 20 every other row is only the number
            s.click(6, row=row, settle=1.0)
            rows = s.snapshot()
            if len(rows) > row + 1 and "miadi-chronicle:" in rows[row]:
                break
        line = rows[row] + (rows[row + 1] if rows[row].endswith(":") else "")
        want = [f"{FRONT}miadi-chronicle%3A{line.split(':')[-1].strip()}"] if "miadi-chronicle:" in line else ["?"]
        check(f"{name} ({line!r})", s.opened_lines(), want)
    finally:
        s.close()


streaming(60, "a click in a streaming pane opens the row it landed on")
streaming(20, "and when every reference wraps into rows that repeat")

for name, ok in results:
    print(f"  {'✓' if ok else '✗'} {name}")
sys.exit(0 if all(ok for _, ok in results) else 1)
