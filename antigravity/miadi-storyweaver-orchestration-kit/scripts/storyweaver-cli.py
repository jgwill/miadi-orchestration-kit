#!/usr/bin/env python3
"""Interactive & Non-Interactive Storyweaver Command Line Orchestrator.

Enables developers and agents to bootstrap, transition, validate, and query
story workspaces directly from any command line shell.
"""

from __future__ import annotations

import argparse
import datetime
import os
import re
import sys
from pathlib import Path

# Terminal Colors
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[31m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_BLUE = "\033[34m"
C_CYAN = "\033[36m"


def print_header(title: str) -> None:
    print(f"\n{C_BOLD}{C_CYAN}{'=' * 60}{C_RESET}")
    print(f"{C_BOLD}{C_CYAN}  {title}{C_RESET}")
    print(f"{C_BOLD}{C_CYAN}{'=' * 60}{C_RESET}\n")


def print_success(msg: str) -> None:
    print(f"{C_GREEN}✔ {msg}{C_RESET}")


def print_error(msg: str) -> None:
    print(f"{C_RED}✘ {msg}{C_RESET}", file=sys.stderr)


def print_warn(msg: str) -> None:
    print(f"{C_YELLOW}⚠ {msg}{C_RESET}")


def print_info(msg: str) -> None:
    print(f"{C_BLUE}ℹ {msg}{C_RESET}")


class StoryweaverWorkspace:
    def __init__(self, workspace_path: Path):
        self.root = workspace_path.resolve()
        self.slug = self.root.name
        self.state_file = self.root / "state.md"
        self.charter_file = self.root / "session-charter.md"
        self.index_file = self.root / "artefact-index.md"

    def is_initialized(self) -> bool:
        return self.state_file.is_file() and self.charter_file.is_file()

    def bootstrap(self, title: str, stage: str, route: str, interactive: bool = False) -> None:
        if interactive:
            print_header("STORYWEAVER INTERACTIVE BOOTSTRAP")
            user_title = input(f"Enter Story Title [{title}]: ").strip()
            if user_title:
                title = user_title
            
            stages = ["brief", "bible", "research", "outline", "draft", "review", "revise", "line-edit", "export", "closed"]
            print(f"Available stages: {', '.join(stages)}")
            user_stage = input(f"Enter Active Stage [{stage}]: ").strip()
            if user_stage in stages:
                stage = user_stage

            routes = ["continue", "revise", "pause", "ask-human", "closed"]
            print(f"Available routes: {', '.join(routes)}")
            user_route = input(f"Enter Current Route [{route}]: ").strip()
            if user_route in routes:
                route = user_route

        # Create directories
        subdirs = [
            "inputs", "research", "chapter-contracts", "chapters", 
            "scenes", "reviews", "exports", "episodes"
        ]
        for d in subdirs:
            (self.root / d).mkdir(parents=True, exist_ok=True)
        
        # Write Charter
        if not self.charter_file.is_file():
            charter_content = f"""# Session Charter: {title}

## Structural Tension
- **Desired Outcome**: Complete premium story manuscript package with full provenance and Chronicle episodic seeds.
- **Current Reality**: Initial creative brief or prompt ingested, waiting for outline and bible structural advancement.
- **Natural Progression**: Brief Intake -> Story Bible -> Outline Mapping -> Chapter Wave drafting loops.

## Deliverables
- [ ] Accepted Creative Brief (`creative-brief.md`)
- [ ] Durable Story Bible (`story-bible.md`)
- [ ] Narrative Outline Map (`outline.md`)
- [ ] Integrated Manuscript (`exports/story.md`)
- [ ] Chronicle Episode Packet (`episodes/...`)

## Boundary Constraints
- Separate operational prompts from final story manuscript pages.
- Honor cultural protocol checks: pause when consent boundaries are reached.
- Preserve factual accuracy of real agent sessions inside Chronicle episode seeds.
"""
            self.charter_file.write_text(charter_content, encoding="utf-8")
            print_success(f"Created session-charter.md at {self.charter_file.relative_to(self.root.parent)}")

        # Write default State
        if not self.state_file.is_file():
            state_content = f"""# Storyweaver State

## Structural Tension
- Desired Outcome: Turn the brief for "{title}" into a completed, polished story package.
- Current Reality: Workspace initialized at stage "{stage}".
- Natural Progression: Proceed with brief ingestion and world construction.

## Active Stage
{stage}

## Accepted Artefacts
- path: session-charter.md
  status: accepted
  accepted_at: {datetime.date.today().isoformat()}
  accepted_by: storyweaver-cli

## Pending Artefacts

## Current Route
{route}

## Next Recommended Skill
storyweaver-brief-intake

## Blockers Or Pause Conditions
- None

## Last Handoff
- from_agent: storyweaver-cli
  to_agent_or_skill: Creative Brief Archaeologist
  summary: Workspace successfully initialized from command line.
  created_at: {datetime.datetime.now().isoformat()}
"""
            self.state_file.write_text(state_content, encoding="utf-8")
            print_success(f"Created state.md at {self.state_file.relative_to(self.root.parent)}")

        # Write default Artefact Index
        if not self.index_file.is_file():
            index_content = """# Storyweaver Artefact Index

This file tracks active assets generated in this story workspace.

| Path | Phase | Role / Description | Status |
| --- | --- | --- | --- |
| `session-charter.md` | bootstrap | Desired outcome, constraints, and pause triggers | accepted |
| `state.md` | bootstrap | Active stage, current route, and last agent handoff | accepted |
"""
            self.index_file.write_text(index_content, encoding="utf-8")
            print_success(f"Created artefact-index.md at {self.index_file.relative_to(self.root.parent)}")

        print_success(f"Storyweaver workspace '{self.slug}' bootstrapped successfully.")

    def get_status(self) -> None:
        if not self.is_initialized():
            print_error(f"Workspace '{self.slug}' is not initialized or state.md is missing.")
            sys.exit(1)
        
        state_text = self.state_file.read_text(encoding="utf-8")
        
        # Parse sections
        stage_match = re.search(r"## Active Stage\s*\n\s*([a-z\-]+)", state_text)
        route_match = re.search(r"## Current Route\s*\n\s*([a-z\-]+)", state_text)
        skill_match = re.search(r"## Next Recommended Skill\s*\n\s*([a-zA-Z0-9\-]+)", state_text)
        
        active_stage = stage_match.group(1) if stage_match else "unknown"
        current_route = route_match.group(1) if route_match else "unknown"
        next_skill = skill_match.group(1) if skill_match else "none"

        print_header(f"STATUS: {self.slug.upper()}")
        print(f"{C_BOLD}Workspace Path:{C_RESET} {self.root}")
        print(f"{C_BOLD}Active Stage:  {C_RESET}{C_CYAN}{active_stage}{C_RESET}")
        print(f"{C_BOLD}Current Route: {C_RESET}{C_GREEN if current_route == 'continue' else C_YELLOW}{current_route}{C_RESET}")
        print(f"{C_BOLD}Next Skill:    {C_RESET}{C_BLUE}{next_skill}{C_RESET}")
        
        # Validation checks
        print(f"\n{C_BOLD}Workspace Structure Health Checks:{C_RESET}")
        expected_dirs = ["inputs", "research", "chapter-contracts", "chapters", "scenes", "reviews", "exports"]
        for d in expected_dirs:
            p = self.root / d
            status = f"{C_GREEN}Present{C_RESET}" if p.is_dir() else f"{C_RED}Missing{C_RESET}"
            print(f"  - Directory '{d}/': {status}")

    def transition(self, stage: str | None, route: str | None, skill: str | None) -> None:
        if not self.is_initialized():
            print_error(f"Workspace '{self.slug}' is not initialized.")
            sys.exit(1)

        state_text = self.state_file.read_text(encoding="utf-8")

        if stage:
            stages = ["brief", "bible", "research", "outline", "draft", "review", "revise", "line-edit", "export", "closed"]
            if stage not in stages:
                print_error(f"Invalid stage '{stage}'. Must be one of: {', '.join(stages)}")
                sys.exit(1)
            state_text = re.sub(
                r"(## Active Stage\s*\n\s*)[a-z\-]+",
                rf"\g<1>{stage}",
                state_text
            )
            print_success(f"Stage transitioned to: {C_CYAN}{stage}{C_RESET}")

        if route:
            routes = ["continue", "revise", "pause", "ask-human", "closed"]
            if route not in routes:
                print_error(f"Invalid route '{route}'. Must be one of: {', '.join(routes)}")
                sys.exit(1)
            state_text = re.sub(
                r"(## Current Route\s*\n\s*)[a-z\-]+",
                rf"\g<1>{route}",
                state_text
            )
            print_success(f"Route transitioned to: {C_GREEN if route == 'continue' else C_YELLOW}{route}{C_RESET}")

        if skill:
            state_text = re.sub(
                r"(## Next Recommended Skill\s*\n\s*)[a-zA-Z0-9\-]+",
                rf"\g<1>{skill}",
                state_text
            )
            print_success(f"Next recommended skill set to: {C_BLUE}{skill}{C_RESET}")

        self.state_file.write_text(state_text, encoding="utf-8")

    def register_artefact(self, filepath: str, status: str, description: str | None = None) -> None:
        if not self.is_initialized():
            print_error(f"Workspace '{self.slug}' is not initialized.")
            sys.exit(1)

        valid_statuses = ["draft", "in-review", "accepted", "accepted-with-known-risk", "needs-revision", "needs-human", "superseded"]
        if status not in valid_statuses:
            print_error(f"Invalid status '{status}'. Must be one of: {', '.join(valid_statuses)}")
            sys.exit(1)

        # 1. Add to state.md (under Accepted or Pending based on status)
        state_text = self.state_file.read_text(encoding="utf-8")
        
        entry = f"- path: {filepath}\n  status: {status}\n  accepted_at: {datetime.date.today().isoformat()}\n  accepted_by: storyweaver-cli"
        
        if status == "accepted" or status == "accepted-with-known-risk":
            # Add under Accepted Artefacts
            if "## Accepted Artefacts" in state_text:
                state_text = state_text.replace(
                    "## Accepted Artefacts",
                    f"## Accepted Artefacts\n{entry}"
                )
        else:
            # Add under Pending Artefacts
            if "## Pending Artefacts" in state_text:
                pending_entry = f"- path: {filepath}\n  status: {status}\n  next_action: review/revision needed"
                state_text = state_text.replace(
                    "## Pending Artefacts",
                    f"## Pending Artefacts\n{pending_entry}"
                )
        
        self.state_file.write_text(state_text, encoding="utf-8")
        print_success(f"Registered artefact '{filepath}' in state.md with status '{status}'")

        # 2. Add to artefact-index.md table
        if description:
            index_text = self.index_file.read_text(encoding="utf-8")
            table_row = f"| `{filepath}` | active | {description} | {status} |"
            
            # Append row to end of the table
            index_text = index_text.strip() + "\n" + table_row + "\n"
            self.index_file.write_text(index_text, encoding="utf-8")
            print_success(f"Registered row in artefact-index.md: {table_row}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Miadi Storyweaver interactive & non-interactive command line workspace manager.",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Bootstrap Command
    boot_parser = subparsers.add_parser("bootstrap", help="Initialize or bootstrap a story workspace")
    boot_parser.add_argument("slug", help="Story workspace directory slug name")
    boot_parser.add_argument("--dir", default=None, help="Custom parent folder path (default: .storyweaver/)")
    boot_parser.add_argument("--title", default="Storyweaver Workspace", help="Story Title")
    boot_parser.add_argument("--stage", default="brief", help="Initial Active Stage")
    boot_parser.add_argument("--route", default="continue", help="Initial Route Value")
    boot_parser.add_argument("--interactive", action="store_true", help="Launch interactive interview prompt mode")

    # Status Command
    status_parser = subparsers.add_parser("status", help="Get status and health overview of story workspace")
    status_parser.add_argument("slug", help="Story workspace directory slug name")
    status_parser.add_argument("--dir", default=None, help="Custom parent folder path (default: .storyweaver/)")

    # Transition Command
    trans_parser = subparsers.add_parser("transition", help="Transition workspace stage, route, or next skill")
    trans_parser.add_argument("slug", help="Story workspace directory slug name")
    trans_parser.add_argument("--dir", default=None, help="Custom parent folder path (default: .storyweaver/)")
    trans_parser.add_argument("--stage", help="Set Active Stage")
    trans_parser.add_argument("--route", help="Set Current Route decision")
    trans_parser.add_argument("--skill", help="Set Next Recommended Skill")

    # Register Artefact Command
    reg_parser = subparsers.add_parser("register-artefact", help="Register a workspace file in state and index")
    reg_parser.add_argument("slug", help="Story workspace directory slug name")
    reg_parser.add_argument("file", help="Filepath relative to workspace root (e.g. story-bible.md)")
    reg_parser.add_argument("status", help="Artefact status (accepted, draft, needs-revision, etc.)")
    reg_parser.add_argument("--description", help="Description of what this file contains")
    reg_parser.add_argument("--dir", default=None, help="Custom parent folder path (default: .storyweaver/)")

    args = parser.parse_args()

    # Determine story workspace root path
    parent_dir = Path(args.dir) if args.dir else Path(".storyweaver")
    workspace_path = parent_dir / args.slug

    ws = StoryweaverWorkspace(workspace_path)

    if args.command == "bootstrap":
        ws.bootstrap(args.title, args.stage, args.route, args.interactive)
    elif args.command == "status":
        ws.get_status()
    elif args.command == "transition":
        if not (args.stage or args.route or args.skill):
            print_error("You must specify at least one transition flag: --stage, --route, or --skill")
            sys.exit(1)
        ws.transition(args.stage, args.route, args.skill)
    elif args.command == "register-artefact":
        ws.register_artefact(args.file, args.status, args.description)


if __name__ == "__main__":
    main()
