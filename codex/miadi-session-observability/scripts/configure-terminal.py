#!/usr/bin/env python3
"""Expose Codex's native thread ID to tmux, preserving other config and a backup."""
import argparse
import ast
import json
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import shutil


def configure(text):
    section = re.search(r'(?m)^\[tui\][ \t]*(?:#.*)?$', text)
    if not section:
        return text.rstrip() + '\n\n[tui]\nterminal_title = ["thread-id", "activity", "thread-title", "project-name"]\n'
    start = section.end()
    end = re.search(r'(?m)^\[', text[start:])
    end = start + end.start() if end else len(text)
    body = text[start:end]
    setting = re.search(r'(?m)^terminal_title\s*=\s*\[([^\]]*)\]', body)
    if setting:
        items = ast.literal_eval('[' + setting.group(1) + ']')
        if not isinstance(items, list) or not all(isinstance(item, str) for item in items):
            raise ValueError('unrecognized title items; configure through /title')
        if items and items[0] in ('thread-id', 'session-id'):
            return text
        items = ['thread-id'] + [item for item in items if item not in ('thread-id', 'session-id')]
        # Keep the native identity visible before potentially long task names.
        body = body[:setting.start()] + 'terminal_title = ' + json.dumps(items) + body[setting.end():]
    elif re.search(r'(?m)^terminal_title\s*=', body):
        raise ValueError('unrecognized tui.terminal_title; add "thread-id" using /title')
    else:
        body = '\nterminal_title = ["thread-id", "activity", "thread-title", "project-name"]' + body
    return text[:start] + body + text[end:]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'config.toml')
    args = parser.parse_args()
    original = args.config.read_text() if args.config.exists() else ''
    changed = configure(original)
    if changed != original:
        args.config.parent.mkdir(parents=True, exist_ok=True)
        if args.config.exists():
            backup = args.config.with_name('config.toml.before-terminal-id-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
            shutil.copy2(args.config, backup)
            print(f'Backup: {backup}')
        args.config.write_text(changed)
    print('Native thread ID enabled. Existing TUI sessions: /title → select thread-id → move it first with ← → save; new sessions load it automatically.')
