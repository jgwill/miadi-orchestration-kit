"""Native Hermes capture plugin. Recording never publishes or launches another agent."""

from pathlib import Path

from .capture import Capture, EVENTS, resolve_root


def register(ctx):
    owner = ctx.get_config("continuity_owner", "auto")
    if owner not in ("auto", "bridge", "capture"):
        raise ValueError("continuity_owner must be auto, bridge, or capture")
    bridge_owns = owner == "bridge" or (owner == "auto" and ctx.has_plugin("miadi"))
    capture = Capture(resolve_root(), profile=ctx.profile_name,
                      continuity=not bridge_owns, cwd_resolver=ctx.session_cwd)
    # Fail visibly at load, before any event can be mistaken for a successful capture.
    capture.check_root()
    for hook in EVENTS:
        ctx.register_hook(hook, capture.callback(hook))
    ctx.register_skill(
        "session-continuity",
        Path(__file__).parent / "skills" / "session-continuity" / "SKILL.md",
        "Find and restore Hermes sessions through Miadi's terminal binding line; verify capture and cutover.",
    )
