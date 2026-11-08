"""Native Hermes capture plugin. Recording never publishes or launches another agent."""

from pathlib import Path

from .capture import Capture, EVENTS, resolve_root


def register(ctx):
    capture = Capture(resolve_root(), profile=ctx.profile_name)
    # Fail visibly at load, before any event can be mistaken for a successful capture.
    capture.check_root()
    for hook in EVENTS:
        ctx.register_hook(hook, capture.callback(hook))
    ctx.register_skill(
        "session-continuity",
        Path(__file__).parent / "skills" / "session-continuity" / "SKILL.md",
        "Find and restore Hermes sessions through Miadi's terminal binding line; verify capture and cutover.",
    )
