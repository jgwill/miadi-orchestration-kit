"""Fetch locked browser archives directly from upstream; never redistribute them.

APT owns this installer/manifest, not Chrome's redistribution rights. Downloads
are cached for offline reinstall, hash-checked on every configuration, and staged
before an atomic swap. Never visit a home, launch a browser or sign in here.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import urllib.request
import zipfile

BASE = Path('/usr/lib/miadi-deepdiver')
CACHE = Path('/var/cache/miadi-deepdiver/browser-archives')
LOCK = Path('/usr/share/miadi-deepdiver-chromium/SOURCE.json')


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda: f.read(1024*1024), b''):
            h.update(data)
    return h.hexdigest()


def fetch(item):
    path = CACHE/item['filename']
    if path.is_file() and sha(path) == item['sha256']:
        return path
    for attempt in range(3):
        temp = None
        try:
            fd, temp = tempfile.mkstemp(prefix='fetch-', dir=CACHE)
            with os.fdopen(fd, 'wb') as out, urllib.request.urlopen(item['url'], timeout=120) as response:
                shutil.copyfileobj(response, out)
            temp = Path(temp)
            if sha(temp) != item['sha256']:
                raise RuntimeError('upstream archive hash mismatch')
            temp.chmod(0o644)
            temp.replace(path)
            return path
        except Exception:
            if temp is not None:
                Path(temp).unlink(missing_ok=True)
            if attempt == 2:
                raise RuntimeError('Cannot fetch the pinned browser archive; check network/CA trust and retry apt configuration. No unverified browser was installed.') from None
    raise AssertionError('unreachable')


def install():
    if os.geteuid() != 0:
        raise RuntimeError('Browser installation requires the APT administrator.')
    os.umask(0o022)
    BASE.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    lock = json.loads(LOCK.read_text())
    stage = Path(tempfile.mkdtemp(prefix='browsers-stage-', dir=BASE))
    try:
        for item in lock['browsers']:
            print('Checking/fetching locked upstream '+item['name']+' '+item['revision'], flush=True)
            archive = fetch(item)
            dest = stage/item['directory']
            dest.mkdir()
            with zipfile.ZipFile(archive) as z:
                for member in z.infolist():
                    if member.filename.startswith('/') or '..' in Path(member.filename).parts:
                        raise RuntimeError('Unsafe archive path')
                    path = Path(z.extract(member, dest))
                    if not path.is_dir():
                        path.chmod(0o755 if (member.external_attr >> 16) & 0o111 else 0o644)
            (dest/'INSTALLATION_COMPLETE').touch(mode=0o644)
        sandbox = stage/'chromium-1248/chrome-linux64/chrome_sandbox'
        for directory in (sandbox.parent, stage/'chromium_headless_shell-1248/chrome-headless-shell-linux64'):
            fallback = directory/'chrome-sandbox'
            shutil.copyfile(sandbox, fallback)
            fallback.chmod(0o4755)
        for root, dirs, _ in os.walk(stage):
            for name in dirs:
                (Path(root)/name).chmod(0o755)
        stage.chmod(0o755)
        old = BASE/'browsers.previous'
        if old.exists():
            shutil.rmtree(old)
        if (BASE/'browsers').exists():
            (BASE/'browsers').rename(old)
        stage.rename(BASE/'browsers')
        if old.exists():
            shutil.rmtree(old)
        print('Pinned browsers installed directly from upstream; upstream terms/notices retained. No browser launched or account accessed.')
    finally:
        if stage.exists():
            shutil.rmtree(stage)


if __name__ == '__main__':
    install()
