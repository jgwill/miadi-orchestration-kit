"""Native Hermes equivalents of the Chronicle mkdir and address hooks.

This is a targeted mistake guard, not a shell sandbox. Commands are parsed,
never executed. Arbitrary programs, eval and dynamically computed paths are
outside its visibility, as they are for the Claude guard.
"""

import os
from pathlib import Path
import re
import shlex

BREAKS = {"&&", "||", ";", "|", "&", "(", ")", "{", "}"}


def absolute(raw, cwd):
    return (Path(cwd) / os.path.expandvars(os.path.expanduser(raw))).resolve()


def new_vessel(path, root):
    try:
        child = path.relative_to(root).parts[0]
    except (ValueError, IndexError):
        return False
    return not (root / child).exists()


def command_targets(command, cwd):
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|()<>")
    lexer.whitespace_split = True
    tokens = list(lexer)
    i = 0
    while i < len(tokens):
        token = tokens[i]
        base = Path(token).name
        if base == "cd" and i + 1 < len(tokens) and tokens[i + 1] not in BREAKS:
            cwd = str(absolute(tokens[i + 1], cwd))
            i += 2
            continue
        if base in ("mkdir", "install"):
            j = i + 1
            args = []
            while j < len(tokens) and tokens[j] not in BREAKS and not tokens[j].startswith(">"):
                args.append(tokens[j])
                j += 1
            creates = base == "mkdir" or any(a == "--directory" or (a.startswith("-") and not a.startswith("--") and "d" in a) for a in args)
            skip = False
            options = True
            for arg in args:
                if skip:
                    skip = False
                    continue
                if options and arg == "--":
                    options = False
                    continue
                if options and arg in ("-m", "--mode", "-o", "--owner", "-g", "--group", "--context"):
                    skip = True
                    continue
                if options and arg.startswith("-"):
                    continue
                if creates:
                    yield absolute(arg, cwd)
            i = j
            continue
        if token in (">", ">>", ">|") and i + 1 < len(tokens):
            yield absolute(tokens[i + 1], cwd).parent
            i += 1
        i += 1


def guard(tool_name, args, cwd, root=None):
    declared = os.environ.get("MIADI_CHRONICLE_ROOT") if root is None else root
    if not declared:
        return None
    root_path = Path(declared).expanduser().resolve()
    args = args if isinstance(args, dict) else {}
    targets = []
    if tool_name in ("terminal", "Bash") and isinstance(args.get("command"), str):
        targets.extend(command_targets(args["command"], cwd))
    elif tool_name in ("write_file", "patch"):
        if isinstance(args.get("path"), str):
            targets.append(absolute(args["path"], cwd).parent)
        if isinstance(args.get("patch"), str):
            for raw in re.findall(r"^\*\*\* (?:Add|Update) File: (.+)$", args["patch"], re.M):
                targets.append(absolute(raw, cwd).parent)
    if any(new_vessel(path, root_path) for path in targets):
        return {"action": "block", "message":
                "Episode vessels are born through the Chronicle episode API or mkepisode, never mkdir/write_file/patch. "
                "Load miadi-chronicle-episode-kit:chronicle-episode; preview POST /api/chronicle/episodes with dryRun:true. "
                "For an existing manifest-less vessel use mkepisode --adopt, not a second birth. "
                "Work inside an existing vessel remains allowed."}
    return None


def add_addresses(text):
    if not isinstance(text, str):
        return None
    prose = re.sub(r"```[\s\S]*?```|`[^`\n]*`", " ", text)
    named = {int(n) for n in re.findall(r"\b(?:[Ee]pisodes?|ep)\s?(\d{1,4})\b", prose)}
    addressed = {int(n) for n in re.findall(r"miadi-chronicle:(?://)?(?:ep)?(\d{1,4})\b", text)}
    addressed |= {int(n) for n in re.findall(r"miadi-chronicle:(?://)?\d{4}-\d{2}-\d{2}-episode-(\d{1,4})-", text)}
    circles = {m[1] for m in re.findall(r"(miadi-circle:(?://)?)?\b(circle:\d{10,}:[a-z0-9]{4,})", prose) if not m[0]}
    circles -= set(re.findall(r"miadi-circle:(?://)?(circle:\d{10,}:[a-z0-9]{4,})", text))
    links = ["miadi-chronicle://" + str(n) for n in sorted(named - addressed)]
    links += ["miadi-circle://" + c for c in sorted(circles)]
    return text + "\n\nMiadi addresses: " + ", ".join(links) if links else None
