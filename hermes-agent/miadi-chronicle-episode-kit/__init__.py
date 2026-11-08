"""Chronicle policy and practices; Miadi remains the sole HTTP/tool transport."""

import json
import logging
import os
from pathlib import Path
import re
from typing import Any
from urllib.parse import quote

from .policy import add_addresses, guard

KIT = Path(os.environ.get("MIADI_ORCHESTRATION_KIT_ROOT", str(Path(__file__).resolve().parents[2]))).expanduser().resolve()
LOG = logging.getLogger("miadi-chronicle-episode-kit")
TRUSTED = {"cli", "tui", "desktop", "acp", "telegram"}
REFERENCE = re.compile(r"(?:[0-9]+|ep[0-9]+|[0-9]{4}-[0-9]{2}-[0-9]{2}-episode-[0-9]+-[A-Za-z0-9_.-]+)\Z")


def bridge(ctx, path, method="GET", body=None) -> dict[str, Any]:
    if ctx.session_surface() not in TRUSTED:
        return {"error": "Chronicle commands require an authenticated local/Telegram session; webhook and unknown surfaces are refused."}
    if not ctx.has_plugin("miadi"):
        return {"error": "Enable the existing miadi plugin for HTTP transport; no second client or MCP is installed by this plugin."}
    payload = {"path": path, "method": method}
    if body is not None:
        payload["body"] = body
    return json.loads(ctx.dispatch_tool("miadi_api", payload))


def episode_status(ctx, raw):
    ref = raw.strip()
    if not REFERENCE.fullmatch(ref):
        return json.dumps({"error": "Use an exact number, epNNN or episode directory name; never a path/URL."})
    return json.dumps(bridge(ctx, "/api/chronicle/episodes/" + quote(ref, safe="")), ensure_ascii=False)


def mint_episode(ctx, raw):
    apply = raw.startswith("--apply ")
    text = raw[len("--apply "):] if apply else raw
    try:
        body = json.loads(text)
        if not isinstance(body, dict):
            raise ValueError()
        if not all(isinstance(body.get(k), str) and body[k].strip() for k in ("title", "goal")):
            raise ValueError()
        refs = body.get("references")
        if not isinstance(refs, list) or not refs or not all(isinstance(r, str) and r.strip() for r in refs):
            raise ValueError()
        if any(k in body and type(body[k]) is not bool for k in ("land", "register", "mainCircle", "dryRun")):
            raise ValueError()
        if apply and (type(body.get("number")) is not int or body["number"] < 1):
            return json.dumps({"error": "Applying requires an explicit positive number, previewed first, so a retry cannot silently mint a second episode."})
    except (ValueError, TypeError):
        return json.dumps({"error": 'Usage: /mint-episode [--apply] {"title":"...","goal":"...","references":["owner/repo#N"],"number":N}'})
    body = {**body, "dryRun": not apply, "land": body.get("land", True) if apply else False,
            "register": body.get("register", True), "mainCircle": body.get("mainCircle", True)}
    result = bridge(ctx, "/api/chronicle/episodes", "POST", body)
    status = result.get("status")
    if apply and isinstance(status, int) and 200 <= status < 300:
        # Read back the exact numbered target; do not promote a write receipt to proof.
        result["verification"] = bridge(ctx, "/api/chronicle/episodes/" + str(body["number"]))
    return json.dumps(result, ensure_ascii=False)


def register(ctx):
    skills = {
        "chronicle-episode": KIT / "skills/chronicle-episode/SKILL.md",
        "production-context-exploration": KIT / "skills/production-context-exploration/SKILL.md",
        "screenwalk-names": KIT / "claude/miadi-chronicle-episode-kit/skills/screenwalk-names/SKILL.md",
    }
    for name, path in skills.items():
        ctx.register_skill(name, path, "Canonical Miadi " + name + " practice (shared source, not a copied skill).")

    def before_tool(tool_name=None, args=None, **kwargs):
        try:
            cwd = (args or {}).get("workdir") or kwargs.get("cwd") or ctx.session_cwd() or str(Path.cwd())
            return guard(tool_name, args, cwd)
        except Exception as exc:
            LOG.warning("Chronicle guard unavailable (%s); no policy decision", type(exc).__name__)
            return None

    def addresses(response_text=None, **kwargs):
        return add_addresses(response_text)

    ctx.register_hook("pre_tool_call", before_tool)
    # One complete reply, not a second model turn containing only corrections.
    ctx.register_hook("transform_llm_output", addresses, hold_stream=True)
    ctx.register_command("mint-episode", lambda raw: mint_episode(ctx, raw),
                         description="Preview a Chronicle mint; --apply and an explicit number authorize the real API call.",
                         args_hint="[--apply] <JSON>")
    ctx.register_command("episode-status", lambda raw: episode_status(ctx, raw),
                         description="Read the Chronicle API's actual five-stage proof.", args_hint="<ref>")
    ctx.register_system_prompt_section("miadi.chronicle", "Use the canonical chronicle-episode skill for episode work. "
        "Never create a vessel by hand or use miadi_episode_register as a birth/lineage door: that tool writes a wheel weave card only. "
        "Use the existing miadi_api transport with /api/chronicle/episodes and dryRun:true before a first write. "
        "No new MCP server or duplicate Miadi tool is installed by this plugin.", max_chars=700)
