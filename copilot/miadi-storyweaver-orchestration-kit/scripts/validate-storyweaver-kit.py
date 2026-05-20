#!/usr/bin/env python3
"""Deterministic validation for the Storyweaver kit and portable companions."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "copilot" / "miadi-storyweaver-orchestration-kit"
PLUGIN_JSON = KIT / ".github" / "plugin" / "plugin.json"

EXPECTED_COMPANION_FILES = [
    "gemini/miadi-storyweaver-orchestration-kit/README.md",
    "gemini/miadi-storyweaver-orchestration-kit/GEMINI.md",
    "gemini/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md",
    "gemini/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md",
    "claude-code/miadi-storyweaver-orchestration-kit/README.md",
    "claude-code/miadi-storyweaver-orchestration-kit/CLAUDE.md",
    "claude-code/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md",
    "claude-code/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md",
]


def load_manifest(errors: list[str]) -> dict:
    if not PLUGIN_JSON.is_file():
        errors.append(f"missing plugin JSON: {PLUGIN_JSON.relative_to(ROOT)}")
        return {}

    try:
        return json.loads(PLUGIN_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(
            "plugin JSON does not parse: "
            f"{PLUGIN_JSON.relative_to(ROOT)}:{exc.lineno}:{exc.colno}: {exc.msg}"
        )
    return {}


def resolve_manifest_path(raw_path: str, errors: list[str]) -> Path | None:
    path = (KIT / raw_path).resolve()
    kit_root = KIT.resolve()
    try:
        path.relative_to(kit_root)
    except ValueError:
        errors.append(f"manifest path escapes kit root: {raw_path}")
        return None
    return path


def check_manifest_skills(manifest: dict, errors: list[str]) -> None:
    skills = manifest.get("skills")
    if not isinstance(skills, list):
        errors.append("plugin JSON field `skills` must be a list")
        return

    for raw_path in skills:
        if not isinstance(raw_path, str):
            errors.append(f"plugin JSON skill path is not a string: {raw_path!r}")
            continue

        skill_dir = resolve_manifest_path(raw_path, errors)
        if skill_dir is None:
            continue

        skill_md = skill_dir / "SKILL.md"
        if not skill_dir.is_dir():
            errors.append(f"missing skill directory: {skill_dir.relative_to(ROOT)}")
        elif not skill_md.is_file():
            errors.append(f"missing skill file: {skill_md.relative_to(ROOT)}")


def check_manifest_agents(manifest: dict, errors: list[str]) -> None:
    agents = manifest.get("agents", [])
    if not isinstance(agents, list):
        errors.append("plugin JSON field `agents` must be a list when present")
        return

    for raw_path in agents:
        if not isinstance(raw_path, str):
            errors.append(f"plugin JSON agent path is not a string: {raw_path!r}")
            continue

        agent_path = resolve_manifest_path(raw_path, errors)
        if agent_path is not None and not agent_path.exists():
            errors.append(f"missing agent path: {agent_path.relative_to(ROOT)}")


def check_companion_files(errors: list[str]) -> None:
    for rel_path in EXPECTED_COMPANION_FILES:
        path = ROOT / rel_path
        if not path.is_file():
            errors.append(f"missing companion file: {rel_path}")


def main() -> int:
    errors: list[str] = []
    manifest = load_manifest(errors)

    if manifest:
        check_manifest_skills(manifest, errors)
        check_manifest_agents(manifest, errors)

    check_companion_files(errors)

    if errors:
        print("Storyweaver validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    skill_count = len(manifest.get("skills", []))
    print("Storyweaver validation passed")
    print(f"- plugin JSON parsed: {PLUGIN_JSON.relative_to(ROOT)}")
    print(f"- manifest skills checked: {skill_count}")
    print(f"- companion files checked: {len(EXPECTED_COMPANION_FILES)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

