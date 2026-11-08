"""Idempotent user setup and doctor; never copy the kit plugin or edit settings JSON."""
import argparse
import csv
from email.parser import Parser
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

import yaml

SHARE = Path('/usr/share/miadi-deepdiver')
PLUGIN = 'miadi-deepdiver@miadi-orchestration-kit'
MARKET = 'miadi-orchestration-kit'
REPO = 'jgwill/miadi-orchestration-kit'
CONFIG = Path.home()/'.config/deepdiver/config.yaml'


def run(args, timeout=180):
    # No shell and no subprocess output/exception text that could echo credentials.
    # args come from this file, so naming the whole command exposes nothing.
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError(f'{" ".join(args)} failed (exit {p.returncode}); run that command directly to diagnose.')
    return p.stdout


def claude_json(*args):
    value = json.loads(run(['claude', 'plugin', *args, '--json']))
    if not isinstance(value, list):
        raise RuntimeError('Claude returned an unsupported plugin inventory; no settings changed.')
    return value


def claude_label():
    p = subprocess.run(['claude', '--version'], capture_output=True, text=True, timeout=60)
    return shutil.which('claude')+' '+(p.stdout.split() or ['(unknown version)'])[0]


def claude_lacks_inventory():
    # Claude Code 2.0.76 has no `plugin list` and no --json on `marketplace list`.
    for args in (('plugin', 'list', '--json'), ('plugin', 'marketplace', 'list', '--json')):
        p = subprocess.run(['claude', *args], capture_output=True, text=True, timeout=180)
        if p.returncode and ('unknown command' in p.stderr or 'unknown option' in p.stderr):
            return True
    return False


def bring_claude_forward():
    if not claude_lacks_inventory():
        return
    print('CLAUDE UPDATE: '+claude_label()+' cannot list plugins; running claude install stable.')
    # `claude update` fails from 2.0.76. The old version stays beside the new one.
    run(['claude', 'install', 'stable'], timeout=600)
    if claude_lacks_inventory():
        raise RuntimeError('CLAUDE TOO OLD: '+claude_label()+' comes first on PATH and still cannot list plugins. Put ~/.local/bin ahead of it, then rerun setup --claude.')
    print('OK Claude Code: '+claude_label())


def plugin_rows():
    return [r for r in claude_json('list') if r.get('id') == PLUGIN]


def plugin_check():
    if not shutil.which('claude'):
        raise RuntimeError('CLAUDE MISSING: install/sign in to Claude Code separately, then setup --claude.')
    rows = plugin_rows()
    if not rows:
        raise RuntimeError('PLUGIN MISSING: miadi-deepdiver setup --claude')
    # enabled is the installed scope's setting. projectEnabled can be false
    # merely because the cwd is outside a trusted project, not a disabled user plugin.
    if any(not r.get('enabled', False) for r in rows):
        raise RuntimeError('PLUGIN DISABLED: preserved personal/project settings; explicitly enable the intended scope with claude plugin enable '+PLUGIN)
    for row in rows:
        root = Path(row.get('installPath', '/nonexistent'))
        if not (root/'skills/screenwalk-notebook/SKILL.md').is_file() or not (root/'scripts/plan-read.mjs').is_file():
            raise RuntimeError('PLUGIN INCOMPLETE: existing canonical skill/plan reader missing; update via Claude marketplace.')
    print('OK plugin: existing screenwalk-notebook and plan reader; restart Claude to load hooks.')


def factory_report():
    """What /deepdive reaches beyond this CLI: each item is named with its remedy.

    Never blocks, since a host that only makes notebooks works without these.
    Names only: no value of any setting is printed.
    """
    env = os.environ.get
    root, src = env('MIADI_CHRONICLE_ROOT'), env('MIADI_SRC') or '/src/Miadi'
    review = 'packages/review-service/skills/miadi-review'
    client = 'scripts/miadi_review.py'
    lane = Path(env('LANE_CHECK_DIR') or '/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check')
    kit = any(r.get('id') == 'miadi-chronicle-episode-kit@'+MARKET for r in claude_json('list'))
    checks = [
        ('node', shutil.which('node'),
         'install Node.js on PATH; the word-gate hook and plan reader call node, and miadi-node stays private'),
        ('ffmpeg and ffprobe', shutil.which('ffmpeg') and shutil.which('ffprobe'), 'sudo apt install ffmpeg'),
        ('chronicle checkout', root and next(Path(root).glob('*/episode.yaml'), None),
         'sudo apt install miadi-config, open a login shell, and clone the chronicle to $MIADI_CHRONICLE_ROOT'),
        ('MIADI_API_URL and MIADI_API_TOKEN_WRITER', env('MIADI_API_URL') and env('MIADI_API_TOKEN_WRITER'),
         'add MIADI_API_TOKEN_WRITER to ~/.env and open a login shell'),
        ('episode door', kit or shutil.which('inquiry-weave-mcp'),
         'sudo apt install miadi-chronicle-client, or claude plugin install miadi-chronicle-episode-kit@'+MARKET),
        ('miadi-review client', (Path.home()/'.claude/skills/miadi-review'/client).is_file() or (Path(src)/review/client).is_file(),
         'keep a jgwill/Miadi checkout at $MIADI_SRC, then ln -s "$MIADI_SRC/'+review+'" ~/.claude/skills/miadi-review'),
        ('Jev plan reader', (lane/'lib/decider.mjs').is_file() and env('JEV_AI_API_KEY'),
         'clone jgwill/smcraft or set LANE_CHECK_DIR, and add JEV_AI_API_KEY to ~/.env'),
    ]
    missing = 0
    for name, found, remedy in checks:
        if found:
            print('OK factory: '+name)
        else:
            missing += 1
            print('FACTORY NEEDS '+name+': '+remedy)
    print('FACTORY READY' if not missing else f'FACTORY NOT READY: /deepdive needs the {missing} item(s) above; plain notebooks work without them.')


def install_claude():
    if not shutil.which('claude'):
        raise RuntimeError('CLAUDE MISSING: install/sign in to Claude Code separately, then setup --claude.')
    bring_claude_forward()
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
    factory_report()


def legacy_installations():
    """Inspect PATH launchers without executing old DeepDiver code or scanning homes."""
    found, seen = [], set()
    for folder in os.environ.get('PATH', '').split(os.pathsep):
        candidate = Path(folder or '.')/'deepdiver'
        if not candidate.is_file() or not os.access(candidate, os.X_OK):
            continue
        real = candidate.resolve()
        if real == Path('/usr/bin/deepdiver').resolve() or real in seen:
            continue
        seen.add(real)
        item = dict(path=str(candidate), removable=False)
        try:
            text = candidate.read_text()[:16384]
            first = text.splitlines()[0]
            py = first[2:].strip() if first.startswith('#!/') else ''
            if 'deepdiver.deepdive' not in text or not Path(py).is_file() or ' ' in py:
                raise ValueError('not a verified pip launcher')
            # Static metadata only: a plain doctor must never execute an old
            # PATH interpreter, its sitecustomize or a user's .pth files.
            prefix = Path(py).parent.parent.resolve()
            if not (prefix/'pyvenv.cfg').is_file():
                raise ValueError('not a dedicated venv')
            metas = list(prefix.glob('lib/python*/site-packages/deepdiver-*.dist-info/METADATA'))
            if len(metas) != 1:
                raise ValueError('ambiguous metadata')
            meta_file = metas[0]
            meta = Parser().parsestr(meta_file.read_text())
            if meta['Name'].lower() != 'deepdiver':
                raise ValueError('different distribution')
            site = meta_file.parent.parent
            with (meta_file.parent/'RECORD').open() as record:
                records = [(site/row[0]).resolve() for row in csv.reader(record) if row]
            # Shared/system Python and pipx installs use their own uninstaller.
            allowed = prefix.is_relative_to(Path.home().resolve()) and prefix.stat().st_uid == os.getuid() and not (prefix/'pipx_metadata.json').exists()
            safe_records = records and all(p.is_relative_to(prefix) for p in records) and real in records
            item.update(version=meta['Version'], python=py, prefix=str(prefix), files=[str(p) for p in records], removable=bool(allowed and safe_records))
        except Exception:
            pass
        found.append(item)
    return found


def check_legacy(remove=False):
    old = legacy_installations()
    for item in old:
        print('LEGACY CLI: '+item['path']+' version='+item.get('version', 'unknown'))
        if remove:
            if not item['removable']:
                raise RuntimeError('LEGACY PRESERVED: not a verified caller-owned venv. Remove this CLI with its original installer; never delete its profile/config.')
            # pip can remove an edited template living inside site-packages.
            # Keep a private, non-executable recovery copy of every recorded file
            # first; no profile/config/content is silently discarded by migration.
            state = Path.home()/'.local/state/miadi-deepdiver/legacy'
            state.mkdir(parents=True, exist_ok=True, mode=0o700)
            backup = Path(tempfile.mkdtemp(prefix='removed-', dir=state))
            for name in item['files']:
                old_file = Path(name)
                if old_file.is_file():
                    dest = backup/old_file.relative_to(item['prefix'])
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(old_file, dest)
                    dest.chmod(0o600)
            print('OK private legacy recovery copy: '+str(backup))
            run([item['python'], '-I', '-m', 'pip', 'uninstall', '--yes', 'deepdiver'])
            if Path(item['path']).exists():
                raise RuntimeError('LEGACY CLEANUP INCOMPLETE: old launcher still exists.')
            print('OK removed old venv DeepDiver distribution/launcher; venv, dependencies, config and browser profiles retained.')
    if old and not remove:
        raise RuntimeError('LEGACY CLI DETECTED: run miadi-deepdiver setup --remove-legacy for verified user venv copies; other installers must remove their own copy. Then hash -r and type -a deepdiver.')


def setup():
    os.umask(0o077)
    CONFIG.parent.mkdir(parents=True, exist_ok=True)
    data = Path.home()/'.local/share/deepdiver'
    defaults = dict(BASE_PATH=str(data/'output'),
        BROWSER_SETTINGS=dict(headless=False, cdp_url='http://127.0.0.1:9222',
                              user_data_dir=str(Path.home()/'.chrome-deepdiver-apt'), timeout=60),
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
    check_legacy()
    lock = json.loads((SHARE/'SOURCE.json').read_text())
    print('SOURCE '+lock['source']['repository']+'@'+lock['source']['commit'])
    abi = f'cp{sys.version_info.major}{sys.version_info.minor}'
    for item in lock['runtime'][abi]:
        if importlib.metadata.version(item['name']) != item['version']:
            raise RuntimeError('RUNTIME VERSION MISMATCH: '+item['name'])
    print('OK private Python '+sys.executable+'; locked dependencies match.')
    if CONFIG.exists():
        from deepdiver.notebooklm_automator import find_config_file, get_cdp_url
        effective = find_config_file()
        # Reuse the fork's actual cwd/user/package discovery and env precedence.
        # Reading only CONFIG would miss a project override and give false readiness.
        parsed = urlparse(get_cdp_url(config_path=effective))
        if parsed.scheme != 'http' or parsed.hostname not in ('localhost', '127.0.0.1', '::1') or parsed.port != 9222 or parsed.username or parsed.password or parsed.path not in ('', '/') or parsed.query or parsed.fragment:
            raise RuntimeError('UNSAFE CDP CONFIG: use loopback port 9222 only; config preserved, value not printed.')
        print('OK effective fork config and CDP override (values not logged).')
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
        if shutil.which('claude') and claude_lacks_inventory():
            raise RuntimeError('CLAUDE TOO OLD: '+claude_label()+' cannot list plugins. miadi-deepdiver setup --claude brings it forward.')
        plugin_check()
        factory_report()
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
    s.add_argument('--remove-legacy', action='store_true', help='Uninstall verified caller-owned PATH venv DeepDiver copies, never configs/profiles or shared Python')
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
            check_legacy(remove=args.remove_legacy)
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
