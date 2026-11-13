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
import pwd
import select
import shutil
import socket
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

# A bare circle id and a ceremony by its scheme: the row holds neither word
# when it has no scheme, so "circle:" is what tmux looks for.
s = Scenario(60, lines_program(["seated in circle:1790787727155:2slscw.", "see miadi-ceremony:ceremony:ep343:talk:1", "the circle: people"]))
try:
    s.click(14)
    check("a bare circle id opens its circle", s.opened_lines(),
          [f"{FRONT}miadi-circle%3Acircle%3A1790787727155%3A2slscw"])
    s.click(8, row=1)
    check("a ceremony reference opens its ceremony", s.opened_lines()[1:],
          [f"{FRONT}miadi-ceremony%3Aceremony%3Aep343%3Atalk%3A1"])
    s.click(6, row=2)
    check("the word circle: is not a reference", s.opened_lines()[2:], [])
finally:
    s.close()

# A foundation packet and one of its files (jgwill/miadi-orchestration-kit#69).
s = Scenario(80, lines_program(["grounded in miadi-foundation:resource-addressing-and-terminal-hypermedia.", "read miadi-foundation://lattice/synthesis.md#through-line"]))
try:
    s.click(20)
    check("a foundation reference opens its packet", s.opened_lines(),
          [f"{FRONT}miadi-foundation%3Aresource-addressing-and-terminal-hypermedia"])
    s.click(10, row=1)
    check("a foundation file opens with its place", s.opened_lines()[1:],
          [f"{FRONT}miadi-foundation%3A%2F%2Flattice%2Fsynthesis.md%23through-line"])
finally:
    s.close()

# What an episode holds and a specification (jgwill/miadi-orchestration-kit#86).
# rise:// holds none of the other words, so "rise://" is what tmux looks for.
s = Scenario(100, lines_program(["notes: miadi-notebook:6c3f477f-3606-47bf-871c-29bf66a3988e.",
                                 "ran miadi-prompt:story/miadiRun-x@3 and miadi-prototype:ep550-walk",
                                 "spec rise://jgwill/Miadi/rispecs/miadi-chronicle-dsl/SPEC.md#4.1 here",
                                 "Enterprise: rise to the occasion"]))
try:
    s.click(12)
    check("a notebook reference opens its notebook", s.opened_lines(),
          [f"{FRONT}miadi-notebook%3A6c3f477f-3606-47bf-871c-29bf66a3988e"])
    s.click(10, row=1)
    s.click(50, row=1)
    check("a prompt and a prototype open what they name", s.opened_lines()[1:],
          [f"{FRONT}miadi-prompt%3Astory%2FmiadiRun-x%403", f"{FRONT}miadi-prototype%3Aep550-walk"])
    s.click(12, row=2)
    check("a specification opens from a row holding no other word", s.opened_lines()[3:],
          [f"{FRONT}rise%3A%2F%2Fjgwill%2FMiadi%2Frispecs%2Fmiadi-chronicle-dsl%2FSPEC.md%234.1"])
    s.click(14, row=3)
    check("the word rise is not a reference", s.opened_lines()[4:], [])
finally:
    s.close()

# A capability (Episode 568): the address keeps the // it was written with, and a
# scoped package keeps its @ and /. The row holds "miadi", which tmux looks for.
s = Scenario(100, lines_program(["revised miadi-capability://jgwill/medicine-wheel/skill/fire-keeper-check.",
                                 "uses miadi-capability:jgwill/Miadi/package/@miadi/inquiry-weave here"]))
try:
    s.click(20)
    check("a capability opens its page", s.opened_lines(),
          [f"{FRONT}miadi-capability%3A%2F%2Fjgwill%2Fmedicine-wheel%2Fskill%2Ffire-keeper-check"])
    s.click(20, row=1)
    check("a scoped package keeps its @ and /", s.opened_lines()[1:],
          [f"{FRONT}miadi-capability%3Ajgwill%2FMiadi%2Fpackage%2F%40miadi%2Finquiry-weave"])
finally:
    s.close()

# A Miadi review (jgwill/etc-claude-code#23): the door opens its page on the review service.
s = Scenario(100, lines_program(["reviewed in miadi-review://5ceaaf3e-eeb9-4afd-9079-42a6a31a5b08."]))
try:
    s.click(20)
    check("a review opens the door with its address", s.opened_lines(),
          [f"{FRONT}miadi-review%3A%2F%2F5ceaaf3e-eeb9-4afd-9079-42a6a31a5b08"])
finally:
    s.close()

# A connector record id (jgwill/Miadi#879): the row holds no Miadi word, only the
# id the connector minted. The word "inquiry:" and another kind's UUID are text.
RECORD = "f6938a49-d7d5-4d64-bd47-fd2004f38865"
s = Scenario(100, lines_program([f"I1 opened inquiry:{RECORD}, pending.",
                                 "the inquiry: is still open",
                                 f"seen session:{RECORD} here"]))
try:
    s.click(20)
    check("a connector record opens the door with its id", s.opened_lines(), [f"{FRONT}inquiry%3A{RECORD}"])
    s.click(6, row=1)
    s.click(14, row=2)
    check("the word inquiry: and a session id are not records", s.opened_lines()[1:], [])
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


# A tmux session (jgwill/Miadi#968). Naming this account, this host and a session
# on this server moves the client and opens no browser; anything else opens the door.
ME = pwd.getpwuid(os.getuid()).pw_name
HOST = socket.gethostname().split(".")[0]
s = Scenario(100, lines_program([f"see miadi-tmux://{ME}@{HOST}:other-seat.",
                                 f"see miadi-tmux://{ME}@{HOST}.example.net:other-seat here",
                                 f"gone miadi-tmux://{ME}@{HOST}:no-such-seat here",
                                 f"pref miadi-tmux://{ME}@{HOST}:other here",
                                 f"away miadi-tmux://{ME}@{HOST}-elsewhere:other-seat here",
                                 f"them miadi-tmux://{ME}x@{HOST}:other-seat here",
                                 f"flag miadi-tmux://{ME}@{HOST}:-other-seat here",
                                 f"path miadi-tmux://{ME}@{HOST}/other-seat here",
                                 f"away miadi-tmux://{ME}@{HOST}-elsewhere/other-seat here"]))


def on_session(scenario):
    return subprocess.run(scenario.tmux + ["list-clients", "-F", "#{session_name}"], env=scenario.env,
                          capture_output=True, text=True).stdout.strip()


try:
    s.run("new-session", "-d", "-s", "other-seat", "sleep 60")
    typed_before = subprocess.run(s.tmux + ["capture-pane", "-p", "-t", "=other-seat:"], env=s.env,
                                  capture_output=True, text=True).stdout
    s.click(20)
    results.append((f"a click moves the client to the session it names (on {on_session(s)})", on_session(s) == "other-seat"))
    check("and opens no browser", s.opened_lines(), [])
    typed_after = subprocess.run(s.tmux + ["capture-pane", "-p", "-t", "=other-seat:"], env=s.env,
                                 capture_output=True, text=True).stdout
    # The window takes the client's size, so only the blank rows may differ; a typed key would echo on sleep's terminal.
    results.append((f"and types nothing into that pane ({typed_after.strip()!r})", typed_before.strip() == typed_after.strip() == ""))
    s.run("switch-client", "-t", "=click:")
    s.drain(0.5)
    s.click(20, row=1)
    results.append((f"a full host name is this host (on {on_session(s)})", on_session(s) == "other-seat"))
    s.run("switch-client", "-t", "=click:")
    s.drain(0.5)
    for row, name, want in [
        (2, "a session not on this server opens the door", f"{FRONT}miadi-tmux%3A%2F%2F{ME}%40{HOST}%3Ano-such-seat"),
        (3, "a name that only prefixes a session is not that session", f"{FRONT}miadi-tmux%3A%2F%2F{ME}%40{HOST}%3Aother"),
        (4, "another host opens the door", f"{FRONT}miadi-tmux%3A%2F%2F{ME}%40{HOST}-elsewhere%3Aother-seat"),
        (5, "another account opens the door", f"{FRONT}miadi-tmux%3A%2F%2F{ME}x%40{HOST}%3Aother-seat"),
        (6, "a name that reads as a flag reaches tmux as no target", f"{FRONT}miadi-tmux%3A%2F%2F{ME}%40{HOST}%3A-other-seat"),
    ]:
        before = len(s.opened_lines())
        s.click(20, row=row)
        check(name, s.opened_lines()[before:], [want])
        results.append((f"and the client stays (on {on_session(s)})", on_session(s) == "click"))
    s.click(20, row=7)
    results.append((f"a / between host and session moves the client too (on {on_session(s)})", on_session(s) == "other-seat"))
    s.run("switch-client", "-t", "=click:")
    s.drain(0.5)
    before = len(s.opened_lines())
    s.click(20, row=8)
    check("and on another host opens the door as written", s.opened_lines()[before:],
          [f"{FRONT}miadi-tmux%3A%2F%2F{ME}%40{HOST}-elsewhere%2Fother-seat"])
finally:
    s.close()

streaming(60, "a click in a streaming pane opens the row it landed on")
streaming(20, "and when every reference wraps into rows that repeat")

for name, ok in results:
    print(f"  {'✓' if ok else '✗'} {name}")
sys.exit(0 if all(ok for _, ok in results) else 1)
