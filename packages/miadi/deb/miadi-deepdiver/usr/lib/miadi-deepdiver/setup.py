"""Idempotent user setup and doctor; never copy the kit plugin or edit settings JSON."""
import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.parse import urlparse

import yaml

SHARE = Path('/usr/share/miadi-deepdiver')
PLUGIN = 'miadi-deepdiver@miadi-orchestration-kit'
MARKET = 'miadi-orchestration-kit'
REPO = 'jgwill/miadi-orchestration-kit'
CONFIG = Path.home()/'.config/deepdiver/config.yaml'


def run(args):
    # No shell and no subprocess output/exception text that could echo credentials.
    p = subprocess.run(args, capture_output=True, text=True, timeout=180)
    if p.returncode:
        raise RuntimeError(f'{args[0]} {args[1]} failed (exit {p.returncode}); run that command directly to diagnose.')
    return p.stdout


def claude_json(*args):
    value = json.loads(run(['claude', 'plugin', *args, '--json']))
    if not isinstance(value, list):
        raise RuntimeError('Claude returned an unsupported plugin inventory; no settings changed.')
    return value


def plugin_rows():
    return [r for r in claude_json('list') if r.get('id') == PLUGIN]


def plugin_check():
    if not shutil.which('claude'):
        raise RuntimeError('CLAUDE MISSING: install/sign in to Claude Code separately, then setup --claude.')
    rows = plugin_rows()
    if not rows:
        raise RuntimeError('PLUGIN MISSING: miadi-deepdiver setup --claude')
    # A disabled project override must not be silently overridden by user install.
    if any(not r.get('enabled', False) or r.get('projectEnabled') is False for r in rows):
        raise RuntimeError('PLUGIN DISABLED: preserved personal/project settings; explicitly enable the intended scope with claude plugin enable '+PLUGIN)
    for row in rows:
        root = Path(row.get('installPath', '/nonexistent'))
        if not (root/'skills/screenwalk-notebook/SKILL.md').is_file() or not (root/'scripts/plan-read.mjs').is_file():
            raise RuntimeError('PLUGIN INCOMPLETE: existing canonical skill/plan reader missing; update via Claude marketplace.')
    print('OK plugin: existing screenwalk-notebook and plan reader; restart Claude to load hooks.')


def install_claude():
    if not shutil.which('claude'):
        raise RuntimeError('CLAUDE MISSING: install/sign in to Claude Code separately, then setup --claude.')
    markets = [r for r in claude_json('marketplace', 'list') if r.get('name') == MARKET]
    if markets and any(r.get('repo') != REPO for r in markets):
        raise RuntimeError('MARKETPLACE COLLISION: existing registration preserved; expected '+REPO)
    if not markets:
        run(['claude', 'plugin', 'marketplace', 'add', REPO])
    if not plugin_rows():
        run(['claude', 'plugin', 'install', PLUGIN, '--scope', 'user'])
    # Upstream install skips existing skills without --force. Never overwrite one.
    run(['/usr/bin/deepdiver', 'skills', 'install', '--agent', 'claude'])
    plugin_check()
    from deepdiver.skills_manager import list_bundled_skills
    for skill in list_bundled_skills():
        source = Path(skill['path'])/'SKILL.md'
        target = Path.home()/'.claude/skills'/skill['dir_name']/'SKILL.md'
        if not target.is_file():
            raise RuntimeError('EMBEDDED SKILL MISSING: '+skill['dir_name'])
        if source.read_bytes() != target.read_bytes():
            raise RuntimeError('EMBEDDED SKILL PRESERVED: existing '+skill['dir_name']+' differs; review it before an explicit upstream --force install.')
    print('OK embedded skills: fork operating manual; kit skill remains canonical for the media workflow.')


def setup():
    os.umask(0o077)
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    data = Path.home()/'.local/share/deepdiver'
    defaults = dict(BASE_PATH=str(data/'output'),
        BROWSER_SETTINGS=dict(headless=False, cdp_url='http://127.0.0.1:9222',
                              user_data_dir=str(Path.home()/'.chrome-deepdiver'), timeout=60),
        SESSION_TRACKING=dict(enabled=True, metadata_format='yaml', session_dir=str(data/'sessions')),
        NOTEBOOKLM_SETTINGS=dict(base_url='https://notebooklm.google.com', upload_timeout=120, generation_timeout=300))
    try:
        with CONFIG.open('x') as f:
            yaml.safe_dump(defaults, f, sort_keys=False)
        print('OK created private user config.')
    except FileExistsError:
        print('OK preserved existing config (not rewritten).')
    for name in ('output', 'sessions'):
        (data/name).mkdir(parents=True, exist_ok=True)
    print('SIGN-IN NEEDED until deepdiver chrome status verifies your own NotebookLM account; never supply credentials to an agent.')


def doctor(args):
    lock = json.loads((SHARE/'SOURCE.json').read_text())
    print('SOURCE '+lock['source']['repository']+'@'+lock['source']['commit'])
    abi = f'cp{sys.version_info.major}{sys.version_info.minor}'
    for item in lock['runtime'][abi]:
        if importlib.metadata.version(item['name']) != item['version']:
            raise RuntimeError('RUNTIME VERSION MISMATCH: '+item['name'])
    print('OK private Python '+sys.executable+'; locked dependencies match.')
    if CONFIG.exists():
        cfg = yaml.safe_load(CONFIG.read_text()) or {}
        url = (cfg.get('BROWSER_SETTINGS') or {}).get('cdp_url', 'http://127.0.0.1:9222')
        parsed = urlparse(os.environ.get('DEEPDIVER_CDP_URL', url))
        if parsed.scheme != 'http' or parsed.hostname not in ('localhost', '127.0.0.1', '::1') or parsed.username or parsed.password:
            raise RuntimeError('UNSAFE CDP CONFIG: use loopback only; config preserved, value not printed.')
        print('OK user config (values not logged).')
    else:
        raise RuntimeError('CONFIG MISSING: miadi-deepdiver setup')
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        binary = Path(p.chromium.executable_path)
        if not binary.is_file():
            raise RuntimeError('BROWSER MISSING: reinstall miadi-deepdiver-chromium.')
        print('OK bundled Chromium '+str(binary))
        if args.browser_smoke:
            # No network, profile, credentials, CDP or NotebookLM used by this probe.
            browser = p.chromium.launch(headless=True, chromium_sandbox=True)
            page = browser.new_page()
            page.set_content('<title>DeepDiver offline smoke</title>')
            assert page.title() == 'DeepDiver offline smoke'
            browser.close()
            print('OK sandboxed headless browser; no authenticated automation performed.')
    if args.claude:
        plugin_check()
    if not os.environ.get('DISPLAY'):
        print('DISPLAY UNAVAILABLE: headless checks do not establish desktop/sign-in readiness.')
    if not args.offline:
        status = subprocess.run(['/usr/bin/deepdiver', 'chrome', 'status'], capture_output=True, timeout=60)
        if status.returncode == 2:
            print('SIGN-IN NEEDED: sign in manually in your DeepDiver Chrome window.')
        elif status.returncode == 1:
            print('SIGN-IN NEEDED: no CDP Chrome; run deepdiver chrome launch as your desktop user.')
        elif status.returncode == 3:
            print('ATTACH BLOCKED: run deepdiver chrome status; do not close another person\'s tabs.')
        elif status.returncode != 0:
            raise RuntimeError('Chrome status failed.')
        if status.returncode:
            return status.returncode
        print('READY: source chrome status verified the signed-in session.')
    else:
        print('SIGN-IN NOT CHECKED (offline); this is not NotebookLM readiness.')
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    s = sub.add_parser('setup', help='Create config only if absent; optional existing Claude marketplace plugin')
    s.add_argument('--claude', action='store_true')
    s.add_argument('--launch', action='store_true', help='Launch the upstream desktop browser; human sign-in only')
    d = sub.add_parser('doctor', help='Verify runtime; exit 0 ready/offline-ok, 1 blocked, 2 sign-in, 3 attach blocked')
    d.add_argument('--claude', action='store_true')
    d.add_argument('--offline', action='store_true')
    d.add_argument('--browser-smoke', action='store_true')
    args = parser.parse_args()
    if os.geteuid() == 0:
        parser.exit(1, 'USER SETUP REQUIRED: run without sudo; no root browser or home setup.\n')
    try:
        if args.command == 'setup':
            setup()
            if args.claude:
                install_claude()
            if args.launch:
                return subprocess.call(['/usr/bin/deepdiver', 'chrome', 'launch'])
            return 0
        return doctor(args)
    except RuntimeError as e:
        print('BLOCKED: '+str(e), file=sys.stderr)
    except Exception as e:
        # Browser/Claude exceptions may hold page URLs or tokens; do not print them.
        print('BLOCKED: '+type(e).__name__+' (check sandbox/display, package integrity or Claude installation).', file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
