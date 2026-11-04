"""Refuse a tool call that would print a credential, before it runs.

secret_print_guard.sh runs this. The rule is one sentence: the guard runs the command's own
filters over a fake copy of the credentials, and refuses when a fake value comes out.

Earned 2026-11-04. Of 46,023 calls in 30 days of transcripts, 15 printed a credential held on
the host, nearly all `env | grep X` or `grep X .env`. `grep MIADI_INQUIRY .env | cut -c1-80`
printed a whole token. `env | grep ^MIADI_ | sed -E 's/(TOKEN|KEY)=.*/\\1=<set>/'` printed the
names the agent's mask left out. So no mask is trusted by its look: it is run.

Stays open, because no value comes out: X=$(grep ^X= .env | cut -d= -f2-) (a capture prints
nothing), `cut -d= -f1 .env`, `env | grep -o '^MIADI_[A-Z_]*'`, `grep -c`, `grep ^PORT= .env`,
`[ -n "$X" ]`, `${#X}`, `curl -H "... $X"`, and `echo "$X" | gh auth login --with-token`, which
hands the value to another program. A .env with no credential in it can be read whole.

Anything it cannot judge falls open: secret_exposure_alert.sh reports what got past.
"""
import glob
import json
import os
import re
import shlex
import subprocess
import sys

FAKE = "q7Zx9Kp2Lm4Vb8Nc1Rt6Yw3Hd5Gf0Js"
SEEN = FAKE[:12]  # A shorter piece of a value says nothing: agents check a token's prefix.
QUOTED_DOLLAR = "\x01"

CREDENTIAL = re.compile(r"TOKEN|SECRET|PASSW(?:OR)?D|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIAL|_PAT$|AUTH(?!OR)", re.I)
NOT_CREDENTIAL = re.compile(r"(?:_SOCK|_FILE|_PATH|_DIR|_HOST|_PORT|_URL|_URI|_NAME|_USER|_ID|_COUNT|_LEN|_LENGTH|_CHECK|_MODE|_TYPE|_ENABLED|AUTHORITY)$", re.I)
ASSIGNMENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")
URL_PASSWORD = re.compile(r"(://[^/\s:@]*:)[^/\s@]+@")
LINE = re.compile(r"^(\s*(?:export\s+)?)([^=\s#]+)(\s*=\s*)(\S.*)$")

FILE_EXEMPT = (".example", ".sample", ".template", ".dist", ".pub")
FILE_KEYS = re.compile(r"\.env(\..*|\*|rc)?|.+\.env|\.netrc|_netrc|\.pgpass|\.npmrc|\.pypirc|\.git-credentials|\.htpasswd"
                       r"|credentials|\.my\.cnf|\.s3cfg|.+\.tfvars|rclone\.conf|wp-config\.php")
FILE_BLOB = re.compile(r"id_rsa|id_dsa|id_ecdsa|id_ed25519|.+\.pem|.+\.key|.+\.p12|.+\.pfx"
                       r"|.*credentials.*\.json|service-account.*\.json|.+\.tfstate|kubeconfig")
FILE_PATH = re.compile(r"/\.aws/|/\.docker/config\.json$|/\.kube/config$|/\.config/gh/hosts\.yml$|/\.config/gcloud/")

GREPS = {"grep", "egrep", "fgrep", "rg"}
RUN = GREPS | {"sed", "awk", "gawk", "cut", "head", "tail", "sort", "uniq", "tr", "wc", "cat", "tac", "nl", "column", "paste"}
SHOWN = {"tee", "less", "more", "strings", "xxd", "od", "hexdump", "base64", "jq", "yq", "bat", "diff"}
READERS = RUN | SHOWN - {"tee"}
PATTERN_FIRST = GREPS | {"sed", "awk", "gawk"}
PREFIXES = {"if", "then", "else", "elif", "do", "while", "until", "!", "time", "{", "}", "sudo", "nice", "command", "exec"}


def is_credential_name(name):
    return bool(CREDENTIAL.search(name)) and not NOT_CREDENTIAL.search(name)


def is_credential_file(path):
    path = path.replace(QUOTED_DOLLAR, "$")
    name = path.rsplit("/", 1)[-1]
    if name.endswith(FILE_EXEMPT):
        return False
    return bool(FILE_KEYS.fullmatch(name) or FILE_BLOB.fullmatch(name) or FILE_PATH.search(path))


def fake_env():
    """Every credential this environment holds, with a fake value."""
    names = (n for n, v in os.environ.items()
             if is_credential_name(n) and len(v) >= 8 and not v.startswith(("/", "~", ".")) and not re.search(r"\s", v))
    return "".join(f"{n}={FAKE}\n" for n in sorted(names))


def fake_file(path, cwd):
    """The file as it stands with each credential's value replaced. Values never leave this process."""
    expanded = os.path.expandvars(os.path.expanduser(path.replace(QUOTED_DOLLAR, "$")))
    paths = glob.glob(os.path.join(cwd, expanded))
    if not paths:
        return fake_env() if "$" in expanded else ""  # A name we cannot resolve is judged by its name.
    out = []
    for p in paths:
        if os.path.isdir(p):
            continue
        name = p.rsplit("/", 1)[-1]
        if FILE_BLOB.fullmatch(name):
            out.append(FAKE)
            continue
        try:
            with open(p, errors="replace") as fh:
                text = fh.read(1 << 20)
        except OSError:
            return fake_env()
        for line in text.splitlines():
            m = LINE.match(line)
            if m and URL_PASSWORD.search(m[4]):
                line = URL_PASSWORD.sub(rf"\1{FAKE}@", line)
            elif m and is_credential_name(m[2]):
                quote = m[4][0] if m[4][0] in "\"'" else ""
                line = f"{m[1]}{m[2]}{m[3]}{quote}{FAKE}{quote}"
            out.append(line)
    return "".join(line + "\n" for line in out)


def without_captures(command):
    """Mark the $ in single quotes, which expands nothing, and drop what a $(...), <(...) or `...` holds: it
    prints nothing where it stands, and its quotes nest, which shlex cannot read."""
    out, i, quote = [], 0, None
    while i < len(command):
        c = command[i]
        if quote == "'":
            out.append(QUOTED_DOLLAR if c == "$" else c)
            quote = None if c == "'" else quote
        elif c == "\\":
            out.append(command[i:i + 2])
            i += 1
        elif c == "'" and quote is None:
            quote = c
            out.append(c)
        elif c == '"':
            quote = None if quote == c else c
            out.append(c)
        elif command.startswith("$(", i) or (quote is None and command.startswith("<(", i)):
            depth, inner = 1, None
            i += 2
            while i < len(command) and depth:
                d = command[i]
                if d == "\\":
                    i += 1
                elif inner:
                    inner = None if d == inner else inner
                elif d in "'\"":
                    inner = d
                else:
                    depth += {"(": 1, ")": -1}.get(d, 0)
                i += 1
            out.append("CAPTURED")
            continue
        else:
            out.append(c)
        i += 1
    return re.sub(r"`[^`]*`", "CAPTURED", "".join(out))


def pipelines(command):
    """The pipelines whose output reaches the agent. A function body prints only where it is called."""
    command = re.sub(r"(<<-?\s*(['\"]?)(\w+)\2)([^\n]*)\n.*?\n\s*\3[ \t]*(?=\n|$)", r"\4\n", command, flags=re.S)
    command = re.sub(r"^\s*#.*$", "", command, flags=re.M)
    command = command.replace("\\\n", " ")
    command = re.sub(r"\d?>&\d", " ", command).replace("&>", ">")
    command = without_captures(command)

    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()\n")
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    lexer.commenters = ""

    found, stages, stage = [], [], []
    previous, in_function = "", 0

    def end_stage():
        nonlocal stage
        if stage and not in_function:
            stages.append(stage)
        stage = []

    def end_pipeline():
        nonlocal stages
        end_stage()
        if stages:
            found.append(stages)
        stages = []

    for token in lexer:
        if token and set(token) <= set(";&|()\n"):
            for mark in re.findall(r"\|\||&&|\|&|;;|[;&|()\n]", token):
                end_stage() if mark in ("|", "|&") else end_pipeline()
        elif token == "{" and previous == "()":
            end_pipeline()
            in_function += 1
        elif token == "}" and in_function:
            end_pipeline()
            in_function -= 1
        else:
            stage.append(token)
        previous = token
    end_pipeline()
    return found


def strip_prefixes(args):
    while args:
        if args[0] in PREFIXES or ASSIGNMENT.match(args[0]):
            args = args[1:]
        elif args[0] == "timeout":
            args = args[1:]
            while args and (args[0].startswith("-") or re.match(r"^[0-9.]+[smhd]?$", args[0])):
                args = args[1:]
        else:
            break
    return args


def file_words(prog, args):
    words, skip_next, explicit = [], False, False
    for a in args:
        if skip_next:
            skip_next = False
        elif a in ("-e", "-f", "--regexp", "--file"):
            skip_next, explicit = True, True
        elif a != "<" and not a.startswith("2>") and (not a.startswith("-") or a == "-"):
            words.append(a.lstrip("<"))
    return words[1:] if prog in PATTERN_FIRST and not explicit else words


def source_of(args, cwd):
    """(what the stage is, the fake text it would print) when the stage emits credentials."""
    args = strip_prefixes(args)
    if not args:
        return None
    prog, rest = os.path.basename(args[0]), args[1:]
    if prog == "env":
        words = [a for a in rest if a not in ("-0", "--null")]
        while words and (words[0].startswith("-") or ASSIGNMENT.match(words[0])):
            words = words[1:]
        return source_of(words, cwd) if words else ("env", fake_env())
    if prog == "printenv":
        names = [a for a in rest if not a.startswith("-")]
        if not names:
            return ("printenv", fake_env())
        held = [n for n in names if is_credential_name(n)]
        return ("printenv", "".join(f"{n}={FAKE}\n" for n in held)) if held else None
    if (prog == "export" and rest in ([], ["-p"])) or (prog == "set" and not rest) \
            or (prog in ("declare", "typeset") and rest and all(re.fullmatch(r"-[px]+", a) for a in rest)):
        return (prog, fake_env())
    if prog == "gh" and (rest[:2] == ["auth", "token"]
                         or (rest[:2] == ["auth", "status"] and ("-t" in rest or "--show-token" in rest))):
        return ("gh auth", f"GH_TOKEN={FAKE}\n")
    if prog in ("echo", "printf"):
        names = set()
        for a in rest:
            for m in re.finditer(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?:\}|:?-)|\$([A-Za-z_][A-Za-z0-9_]*)", a):
                name = m.group(1) or m.group(2)
                if is_credential_name(name):
                    names.add(name)
        return (prog, "".join(f"{n}={FAKE}\n" for n in sorted(names))) if names else None
    if prog not in READERS:
        return None
    if prog == "sed" and any(re.fullmatch(r"-[A-Za-z]*i.*|--in-place.*", a) for a in rest):
        return None
    if any(re.search(r"/proc/.*/environ", a) for a in rest):
        return ("/proc/<pid>/environ", fake_env())
    paths = [w for w in file_words(prog, rest) if is_credential_file(w)]
    if paths:
        return (f"reading {paths[0]}", "".join(fake_file(p, cwd) for p in paths))
    return None


def run_filter(args, text, cwd):
    """The stage's own program over the fake text. One that cannot be run passes everything through."""
    prog = os.path.basename(args[0])
    if prog in GREPS and any(re.fullmatch(r"-[A-Za-z]*[qlLc][A-Za-z]*|--quiet|--silent|--count|--files-with(out)?-match(es)?", a)
                             for a in args[1:]):
        return ""  # Prints a count or a file name, whatever its pattern is.
    files = {w for w in file_words(prog, args[1:])
             if "/" in w or is_credential_file(w) or glob.glob(os.path.join(cwd, os.path.expanduser(w)))}
    rest = []
    for a in args[1:]:
        if a == "<" or a.startswith(("<", "2>")) or a in files:
            continue
        a = os.path.expandvars(a.replace("\\$", QUOTED_DOLLAR))
        if re.search(r"\$\{?[A-Za-z0-9_]", a):
            return text  # A variable the hook cannot see: the filter is unknown.
        rest.append(a.replace(QUOTED_DOLLAR, "$"))
    if prog in GREPS:
        rest = [re.sub(r"^(-[A-Za-z]*?)[rR]([A-Za-z]*)$", r"\1\2", a) for a in rest if a != "--recursive"]
        rest = [a for a in rest if a != "-"]
    elif prog == "sed":
        rest = ["--sandbox"] + rest
    elif prog in ("awk", "gawk"):
        if any(re.search(r"system|getline|\||>", a) for a in rest):
            return text
    elif prog == "sort" and any(a.startswith(("-o", "--output")) for a in rest):
        return text
    try:
        done = subprocess.run([prog] + rest, input=text, capture_output=True, text=True, errors="replace", timeout=2,
                              cwd=cwd if os.path.isdir(cwd) else "/")
    except (OSError, subprocess.SubprocessError):
        return text
    ran = done.returncode == 0 or (prog in GREPS and done.returncode == 1) or "No such file" in done.stderr
    return done.stdout if ran else text


def redirected(args):
    return any(re.match(r"^1?>", a) for a in args)


def named(label, text):
    names = []
    for line in text.splitlines():
        if SEEN in line:
            m = re.search(r"([A-Za-z_][A-Za-z0-9_]*)[\"' ]*=", line)
            if m and m[1] not in names:
                names.append(m[1])
    if not names:
        return f"{label} would print a credential"
    shown = ", ".join("$" + n for n in names[:3]) + (f" and {len(names) - 3} more" if len(names) > 3 else "")
    return f"{label} would print {shown}"


def pipeline_prints(stages, cwd):
    for index, stage in enumerate(stages):
        found = source_of(stage, cwd)
        if found:
            break
    else:
        return None
    label, text = found
    args = strip_prefixes(stage)
    if redirected(args):
        return None
    prog = os.path.basename(args[0])
    if prog in RUN:
        text = run_filter(args, text, cwd)
    for later in stages[index + 1:]:
        args = strip_prefixes(later)
        if not args or redirected(args):
            return None
        prog = os.path.basename(args[0])
        if prog in RUN:
            text = run_filter(args, text, cwd)
        elif prog not in SHOWN:
            return None  # Handed to another program, not to the output.
    return named(label, text) if SEEN in text else None


def refusal(payload):
    tool = payload.get("tool_name")
    tool_input = payload.get("tool_input") or {}
    cwd = payload.get("cwd") or os.getcwd()
    if tool in ("Read", "Grep"):
        path = tool_input.get("file_path" if tool == "Read" else "path") or ""
        if not is_credential_file(path) or (tool == "Grep" and tool_input.get("output_mode") != "content"):
            return None
        text = fake_file(path, cwd)
        if tool == "Grep":
            text = run_filter(["grep", "-E", tool_input.get("pattern") or ""], text, cwd)
        return named(f"reading {path.rsplit('/', 1)[-1]}", text) if SEEN in text else None
    if tool != "Bash":
        return None
    for stages in pipelines(tool_input.get("command") or ""):
        first = strip_prefixes(stages[0])
        if first[:1] == ["cd"] and len(first) > 1:
            cwd = os.path.join(cwd, os.path.expandvars(os.path.expanduser(first[1])))
            continue
        reason = pipeline_prints(stages, cwd)
        if reason:
            return reason
    return None


def main():
    try:
        reason = refusal(json.load(sys.stdin))
    except Exception:
        return 0
    if not reason:
        return 0
    sys.stderr.write(
        f"secret-print-guard: refused, {reason}.\n"
        "Names only: env | cut -d= -f1, cut -d= -f1 .env. Is it set: [ -n \"$X\" ] && echo set. "
        "Use it unseen: X=$(grep ^X= .env | cut -d= -f2-).\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
