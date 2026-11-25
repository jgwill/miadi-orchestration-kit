#!/usr/bin/env python3
"""film_desk.py: an agent in a production program on a person's own display, while the person watches.

Verbs, by group (rispecs/agents-in-the-programs/03-specify.md of the kit):

  look   list [--root DIR]            the film projects under the Chronicle, newest first, with their kind
         open PROJECT                 the project's git state, then the program on the display, maximized
                                      (a project already open is raised, not opened twice)
         look [--out PNG] [--window]  a screenshot of the display, or of the program's window
         sound                        whether the program is sending sound, corked or muted
         probe                        the program's window, pid and the action names it accepts by name
         acts [--last N] [--episode]  this host's log of acts, newest last
  drive  raise                        the program's window to the front, maximized
         play [--from-start]          play (from the start of the timeline)
         pause
         seek start|end|next-guide|prev-guide|+N|-N   (N seconds)
         action NAME                  any action of the program by its name (see probe)
  write  save --person-asked          the program saves the project the person has open
         reload --person-asked        the program reloads the project from disk (its unsaved changes are lost)

Kdenlive is reached by action name over its D-Bus main window interface (org.kde.KMainWindow.activateAction),
never by a screen coordinate. Ardour and MuseScore have no such interface here: their drive verbs press the
program's own keys on its activated window. Every verb writes one line to the acts log
(MIADI_FILM_ACTS_LOG, default ~/.local/state/miadi-film/acts.jsonl). The display is MIADI_FILM_DISPLAY,
else DISPLAY, else :0. Stdlib only, Python 3.8.
"""
import argparse
import getpass
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROGRAMS = {
    ".kdenlive": {
        "name": "kdenlive",
        "bin": ["kdenlive"],
        "audio": "kdenlive",
        "actions": {
            "play": "monitor_play",
            "pause": "monitor_pause",
            "start": "seek_start",
            "end": "seek_end",
            "next-guide": "monitor_seek_guide_forward",
            "prev-guide": "monitor_seek_guide_backward",
            "+1": "monitor_seek_forward-one-second",
            "-1": "monitor_seek_backward-one-second",
            "save": "file_save",
            "reload": "file_revert",
        },
    },
    ".ardour": {
        "name": "ardour",
        "bin": ["ardour8", "ardour7", "ardour6", "ardour"],
        "audio": "ardour",
        "keys": {"play": "space", "pause": "space", "start": "Home", "end": "End", "save": "ctrl+s"},
    },
    ".mscz": {
        "name": "musescore",
        "bin": ["musescore4", "mscore4portable", "musescore3", "musescore", "mscore"],
        "audio": "musescore",
        "keys": {"play": "space", "pause": "space", "start": "ctrl+Home", "end": "ctrl+End", "save": "ctrl+s"},
    },
}
PROGRAMS[".mscx"] = PROGRAMS[".mscz"]
GROUP = {"list": "look", "open": "look", "look": "look", "sound": "look", "probe": "look", "acts": "look",
         "raise": "drive", "play": "drive", "pause": "drive", "seek": "drive", "action": "drive",
         "save": "write", "reload": "write"}
KINDS = [("proposal.json", "proposal timeline"), ("room.json", "editing room"), ("scenes.json", "stringout")]
STATE = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local/state") / "miadi-film"


class Refusal(Exception):
    pass


def display():
    return os.environ.get("MIADI_FILM_DISPLAY") or os.environ.get("DISPLAY") or ":0"


def env():
    e = dict(os.environ, DISPLAY=display())
    run_dir = e.get("XDG_RUNTIME_DIR") or f"/run/user/{os.getuid()}"
    e.setdefault("XDG_RUNTIME_DIR", run_dir)
    e.setdefault("DBUS_SESSION_BUS_ADDRESS", f"unix:path={run_dir}/bus")
    return e


def need(*tools):
    missing = [t for t in tools if not shutil.which(t)]
    if missing:
        raise Refusal(f"missing on {socket.gethostname()}: {', '.join(missing)}. The miadi-film package and "
                      "xdotool, wmctrl, imagemagick, pulseaudio-utils and dbus provide them.")


def sh(cmd, check=True, **kw):
    r = subprocess.run(cmd, env=env(), capture_output=True, text=True, **kw)
    if check and r.returncode != 0:
        raise Refusal(f"{' '.join(cmd)} exited {r.returncode}: {(r.stderr or r.stdout).strip()[:300]}")
    return r


def log_act(verb, args, result):
    path = Path(os.environ.get("MIADI_FILM_ACTS_LOG") or STATE / "acts.jsonl")
    path.parent.mkdir(parents=True, exist_ok=True)
    project = getattr(args, "project", None)
    root = os.environ.get("MIADI_CHRONICLE_ROOT")
    episode = None
    if project and root:
        try:
            episode = Path(project).resolve().relative_to(Path(root).resolve()).parts[0]
        except ValueError:
            pass
    line = {
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "host": socket.gethostname(), "user": getpass.getuser(), "display": display(),
        "verb": verb, "group": GROUP[verb], "argv": sys.argv[2:],
        "project": str(Path(project).resolve()) if project else None, "episode": episode,
        "tmux_pane": os.environ.get("TMUX_PANE"), "seat": os.environ.get("MIADI_SEAT_NAME"),
        "result": result,
    }
    with path.open("a") as f:
        f.write(json.dumps(line, ensure_ascii=False) + "\n")


def program_for(path):
    ext = Path(path).suffix.lower()
    if ext not in PROGRAMS:
        raise Refusal(f"no program for {ext or 'a file without extension'}: kdenlive, ardour, mscz, mscx")
    return PROGRAMS[ext]


def windows(pattern):
    r = sh(["xdotool", "search", "--onlyvisible", "--name", pattern], check=False)
    return [w for w in r.stdout.split() if w.strip()]


def window_name(wid):
    return sh(["xdotool", "getwindowname", wid], check=False).stdout.strip()


def find_window(project=None):
    """The program window for PROJECT, or the one open program window when PROJECT is not given."""
    if project:
        stem = re.escape(Path(project).name if Path(project).suffix == ".kdenlive" else Path(project).stem)
        found = windows(stem)
        return (found[0], program_for(project)) if found else (None, program_for(project))
    hits = []
    # xdotool's regex does not anchor reliably on these titles (an em dash precedes "Kdenlive"): match the word,
    # then check the full title here
    for prog, word, ok in (("kdenlive", "Kdenlive", lambda t: t.endswith("Kdenlive")),
                           ("ardour", "Ardour", lambda t: t.startswith("Ardour")),
                           ("musescore", "MuseScore", lambda t: "MuseScore" in t)):
        for w in windows(word):
            if ok(window_name(w)):
                hits.append((w, next(p for p in PROGRAMS.values() if p["name"] == prog)))
    if not hits:
        raise Refusal(f"no Kdenlive, Ardour or MuseScore window on {display()}")
    seen = {}
    for w, p in hits:
        seen.setdefault(w, p)
    hits = list(seen.items())
    if len(hits) > 1:
        names = "; ".join(window_name(w) for w, _ in hits)
        raise Refusal(f"several program windows on {display()} ({names}): name the project")
    return hits[0]


def bring_forward(wid):
    """Maximize and activate through the window manager; say so when there is none (a hidden display)."""
    m = sh(["wmctrl", "-i", "-r", wid, "-b", "add,maximized_vert,maximized_horz"], check=False)
    act = sh(["xdotool", "windowactivate", wid], check=False)
    if m.returncode or act.returncode:
        sh(["xdotool", "windowraise", wid], check=False)
        return "raised (no window manager answered: not maximized or focused)"
    return "raised and maximized"


def kdenlive_service(wid):
    pid = sh(["xdotool", "getwindowpid", wid]).stdout.strip()
    return f"org.kde.kdenlive-{pid}", pid


def dbus_kmainwindow(service, method, *strings):
    cmd = ["dbus-send", "--session", "--print-reply", f"--dest={service}", "/kdenlive/MainWindow_1",
           f"org.kde.KMainWindow.{method}"] + [f"string:{s}" for s in strings]
    return sh(cmd)


def kdenlive_action(wid, name):
    service, _ = kdenlive_service(wid)
    out = dbus_kmainwindow(service, "activateAction", name).stdout
    if "boolean false" in out:
        raise Refusal(f"Kdenlive has no action named {name} (see probe)")


def press(wid, keys):
    sh(["xdotool", "windowactivate", "--sync", wid])
    sh(["xdotool", "key", "--clearmodifiers", keys])


def drive(wid, prog, what, count=1):
    if prog["name"] == "kdenlive":
        for _ in range(count):
            kdenlive_action(wid, prog["actions"][what])
        return f"kdenlive action {prog['actions'][what]} x{count}"
    keys = prog.get("keys", {})
    if what not in keys:
        raise Refusal(f"{prog['name']} has no '{what}' here yet (03-specify.md names what each program offers)")
    for _ in range(count):
        press(wid, keys[what])
    return f"{prog['name']} key {keys[what]} x{count}"


def git_state(path):
    d = str(Path(path).parent)
    top = sh(["git", "-C", d, "rev-parse", "--show-toplevel"], check=False)
    if top.returncode != 0:
        return "not in a git tree"
    st = sh(["git", "-C", d, "status", "--porcelain", "--", Path(path).name], check=False).stdout.strip()
    sha = sh(["git", "-C", d, "log", "-1", "--format=%h %as", "--", Path(path).name], check=False).stdout.strip()
    if st.startswith("??"):
        return "untracked"
    return f"modified since {sha}" if st else f"committed, unchanged since {sha}"


# --- verbs -------------------------------------------------------------------------------------------

def v_list(a):
    root = Path(a.root or os.environ.get("MIADI_CHRONICLE_ROOT") or ".")
    rows = []
    for ext in PROGRAMS:
        for p in root.glob(f"*/**/*{ext}"):
            if ".kdenlive-home" in p.parts or "node_modules" in p.parts:
                continue
            kind = next((k for f, k in KINDS if (p.parent / f).exists()), "project")
            rows.append((p.stat().st_mtime, kind, p))
    rows.sort(reverse=True)
    for mtime, kind, p in rows:
        print(f"{datetime.fromtimestamp(mtime):%Y-%m-%d %H:%M}  {kind:<18} {p}")
    return f"{len(rows)} projects under {root}"


def v_open(a):
    need("xdotool", "wmctrl")
    path = Path(a.project).resolve()
    if not path.exists():
        raise Refusal(f"no such project: {path}")
    prog = program_for(path)
    print(f"git: {git_state(path)}")
    wid, _ = find_window(str(path))
    if wid:
        return f"already open, {bring_forward(wid)}: {window_name(wid)}"
    exe = next((b for b in prog["bin"] if shutil.which(b)), None)
    if not exe:
        raise Refusal(f"{prog['name']} is not installed on {socket.gethostname()} (the miadi-film package installs it)")
    STATE.mkdir(parents=True, exist_ok=True)
    log = open(STATE / f"{prog['name']}-{datetime.now():%y%m%d%H%M%S}.log", "w")
    child = subprocess.Popen([exe, str(path)], cwd=str(path.parent), env=env(), stdin=subprocess.DEVNULL,
                             stdout=log, stderr=log, start_new_session=True)
    deadline = time.time() + a.wait
    while time.time() < deadline:
        wid, _ = find_window(str(path))
        if wid:
            break
        if child.poll() is not None:
            raise Refusal(f"{exe} exited {child.returncode} before its window appeared; log {log.name}")
        time.sleep(0.5)
    else:
        raise Refusal(f"no window naming {path.name} after {a.wait}s on {display()}; log {log.name}")
    shown = "" if a.no_maximize else f", {bring_forward(wid)}"
    return f"opened pid {child.pid}, window {wid}{shown}: {window_name(wid)}"


def v_look(a):
    need("import")
    out = Path(a.out) if a.out else STATE / "looks" / f"{datetime.now():%y%m%d%H%M%S}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    target = "root"
    if a.window:
        target, _ = find_window(a.project)
        if not target:
            raise Refusal("no program window to look at")
    sh(["import", "-display", display(), "-window", target, str(out)])
    print(out)
    return str(out)


def v_sound(a):
    need("pactl")
    _, prog = find_window(a.project)
    blocks = sh(["pactl", "list", "sink-inputs"]).stdout.split("Sink Input #")[1:]
    mine = [b for b in blocks if re.search(rf'application\.name = "{prog["audio"]}"', b, re.I)]
    if not mine:
        return f"{prog['name']} has no sound stream open"
    states = []
    for b in mine:
        corked = re.search(r"Corked: (\w+)", b).group(1)
        muted = re.search(r"Mute: (\w+)", b).group(1)
        states.append(f"corked {corked}, muted {muted}")
    return f"{prog['name']}: {len(mine)} stream(s): " + "; ".join(states)


def v_probe(a):
    need("xdotool")
    wid, prog = find_window(a.project)
    if not wid:
        raise Refusal("no program window")
    print(f"window {wid}: {window_name(wid)}")
    if prog["name"] != "kdenlive":
        print(f"{prog['name']}: keys {prog.get('keys')}")
        return f"{prog['name']} window {wid}"
    service, pid = kdenlive_service(wid)
    names = re.findall(r'string "([^"]+)"', dbus_kmainwindow(service, "actions").stdout)
    print(f"pid {pid}, D-Bus {service}, {len(names)} actions")
    if a.all:
        print("\n".join(names))
    return f"kdenlive pid {pid}, {len(names)} actions"


def v_acts(a):
    path = Path(os.environ.get("MIADI_FILM_ACTS_LOG") or STATE / "acts.jsonl")
    if not path.exists():
        print(f"no acts yet ({path})")
        return None
    lines = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    if a.episode:
        lines = [l for l in lines if l.get("episode") and a.episode in l["episode"]]
    for l in lines[-a.last:]:
        print(f"{l['at']} {l['group']:<5} {l['verb']:<6} {' '.join(l['argv'][1:]) if l['argv'] else ''}  -> {l['result']}")
    return None


def v_raise(a):
    need("xdotool", "wmctrl")
    wid, _ = find_window(a.project)
    if not wid:
        raise Refusal("no program window")
    return f"{bring_forward(wid)}: {window_name(wid)}"


def v_play(a):
    need("xdotool", "dbus-send")
    wid, prog = find_window(a.project)
    if not wid:
        raise Refusal("no program window")
    done = [drive(wid, prog, "start")] if a.from_start else []
    done.append(drive(wid, prog, "play"))
    return "; ".join(done)


def v_pause(a):
    need("xdotool", "dbus-send")
    wid, prog = find_window(a.project)
    if not wid:
        raise Refusal("no program window")
    return drive(wid, prog, "pause")


def v_seek(a):
    need("xdotool", "dbus-send")
    wid, prog = find_window(a.project)
    if not wid:
        raise Refusal("no program window")
    m = re.fullmatch(r"([+-])(\d+)", a.where)
    if m:
        n = int(m.group(2))
        if n > 600:
            raise Refusal("more than 600 one-second steps: seek to a guide instead")
        return drive(wid, prog, m.group(1) + "1", n)
    if a.where not in ("start", "end", "next-guide", "prev-guide"):
        raise Refusal("seek start|end|next-guide|prev-guide|+N|-N")
    return drive(wid, prog, a.where)


def v_action(a):
    need("xdotool", "dbus-send")
    wid, prog = find_window(a.project)
    if not wid or prog["name"] != "kdenlive":
        raise Refusal("action NAME is for an open Kdenlive window")
    blocked = {"file_save", "file_revert", "file_save_as", "file_quit", "file_close", "project_render"}
    if a.name in blocked or a.name.startswith(("delete", "cut_", "paste")):
        raise Refusal(f"{a.name} changes the project or ends the work: it is a write act (save, reload), "
                      "or the person's own")
    kdenlive_action(wid, a.name)
    return f"kdenlive action {a.name}"


def write_verb(what):
    def run(a):
        if not a.person_asked:
            raise Refusal(f"{what} changes the person's project: run it only when the person asked for it, with "
                          "--person-asked")
        need("xdotool", "dbus-send")
        wid, prog = find_window(a.project)
        if not wid:
            raise Refusal("no program window")
        if prog["name"] == "kdenlive":
            kdenlive_action(wid, prog["actions"][what])
            return f"kdenlive action {prog['actions'][what]}" + (
                " (Kdenlive may ask to confirm on screen)" if what == "reload" else "")
        return drive(wid, prog, what)
    return run


def main():
    ap = argparse.ArgumentParser(prog="film_desk.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="verb", required=True)
    p = sub.add_parser("list"); p.add_argument("--root"); p.set_defaults(fn=v_list)
    p = sub.add_parser("open"); p.add_argument("project"); p.add_argument("--wait", type=int, default=90)
    p.add_argument("--no-maximize", action="store_true"); p.set_defaults(fn=v_open)
    for name, fn in (("look", v_look), ("sound", v_sound), ("probe", v_probe), ("raise", v_raise),
                     ("play", v_play), ("pause", v_pause), ("seek", v_seek), ("action", v_action),
                     ("save", write_verb("save")), ("reload", write_verb("reload"))):
        p = sub.add_parser(name); p.add_argument("--project", help="the project, when several program windows are open")
        p.set_defaults(fn=fn)
        if name == "look":
            p.add_argument("--out"); p.add_argument("--window", action="store_true")
        if name == "probe":
            p.add_argument("--all", action="store_true", help="print every action name")
        if name == "play":
            p.add_argument("--from-start", action="store_true")
        if name == "seek":
            p.add_argument("where")
        if name == "action":
            p.add_argument("name")
        if name in ("save", "reload"):
            p.add_argument("--person-asked", action="store_true")
    p = sub.add_parser("acts"); p.add_argument("--last", type=int, default=20); p.add_argument("--episode")
    p.set_defaults(fn=v_acts)
    a = ap.parse_args()
    try:
        result = a.fn(a)
    except Refusal as e:
        if a.verb != "acts":
            log_act(a.verb, a, f"refused: {e}")
        print(f"refused: {e}", file=sys.stderr)
        return 2
    if a.verb != "acts":
        log_act(a.verb, a, result)
        if result:
            print(result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
