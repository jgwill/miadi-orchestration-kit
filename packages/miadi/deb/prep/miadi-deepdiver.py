#!/usr/bin/python3
"""Build from the committed lock only; no resolver, mutable branch or host checkout."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from deepdiver_wheel import normalize

HERE = Path(__file__).resolve().parent
LOCK = HERE / 'miadi-deepdiver.lock.json'
lock = json.loads(LOCK.read_text())
cache = Path(os.environ.get('MIADI_DEB_CACHE', Path.home()/'.cache/miadi-deb')) / 'deepdiver'
cache.mkdir(parents=True, exist_ok=True)
stage = Path(sys.argv[2])

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''):
            h.update(b)
    return h.hexdigest()

def fetch(item, filename=None):
    dest = cache / (filename or item['filename'])
    if not dest.exists():
        temp = dest.with_suffix(dest.suffix+'.download')
        with urllib.request.urlopen(item['url'], timeout=120) as r, temp.open('wb') as f:
            shutil.copyfileobj(r, f)
        if sha(temp) != item['sha256']:
            temp.unlink()
            raise RuntimeError('Hash mismatch: '+dest.name)
        temp.replace(dest)
    if sha(dest) != item['sha256']:
        raise RuntimeError('Hash mismatch in cache: '+dest.name)
    return dest

def requirements(items):
    return ''.join(f'{i["name"]}=={i["version"]} --hash=sha256:{i["sha256"]}\n' for i in items)

def copy(src, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)
    dest.chmod(0o644)

share = stage / 'usr/share' / ('miadi-deepdiver' if sys.argv[1] == 'runtime' else 'miadi-deepdiver-chromium')
share.mkdir(parents=True, exist_ok=True)
copy(LOCK, share/'SOURCE.json')
copy(HERE.parent/'LICENSE', share/'PACKAGING-LICENSE')
if sys.argv[1] == 'runtime':
    src = fetch(lock['source'], 'source-'+lock['source']['commit']+'.tar.gz')
    wheels = share/'wheels'
    wheels.mkdir(exist_ok=True)
    for abi, items in lock['runtime'].items():
        for item in items:
            copy(fetch(item), wheels/item['filename'])
        (share/(abi+'.txt')).write_text(requirements(items)+f'deepdiver==0.1.1 --hash=sha256:{lock["source"]["wheel_sha256"]}\n')
    with tempfile.TemporaryDirectory() as work:
        work = Path(work)
        # All build tools, including wheel's transitive dependency, are locked.
        bw = work/'build-wheels'
        bw.mkdir()
        for item in lock['build']:
            copy(fetch(item), bw/item['filename'])
        req = work/'build.txt'
        req.write_text(requirements(lock['build']))
        subprocess.run([sys.executable, '-m', 'venv', str(work/'venv')], check=True)
        py = str(work/'venv/bin/python')
        env = dict(os.environ, SOURCE_DATE_EPOCH=str(lock['source']['epoch']),
                   PYTHONHASHSEED='0', PIP_CONFIG_FILE='/dev/null', PIP_NO_INDEX='1',
                   PIP_DISABLE_PIP_VERSION_CHECK='1')
        subprocess.run([py, '-m', 'pip', 'install', '--no-index', '--no-deps', '--require-hashes',
                        '--find-links', str(bw), '-r', str(req)], check=True, env=env)
        with tarfile.open(src) as tar:
            # The pinned GitHub archive may contain no escaping members or links.
            for member in tar.getmembers():
                if member.name.startswith('/') or '..' in Path(member.name).parts or member.issym() or member.islnk():
                    raise RuntimeError('Unsafe source archive member')
            tar.extractall(work/'source')
        source = next((work/'source').iterdir())
        subprocess.run([py, '-m', 'pip', 'wheel', '--no-index', '--no-deps', '--no-build-isolation',
                        '--no-cache-dir', '-w', str(work/'dist'), str(source)], check=True, env=env)
        wheel = work/'dist'/lock['source']['wheel']
        normalize(wheel, lock['source']['epoch'])
        if sha(wheel) != lock['source']['wheel_sha256']:
            raise RuntimeError('Built fork wheel differs from committed reproducible hash')
        copy(wheel, wheels/wheel.name)
        copy(source/'LICENSE', share/'DEEPDIVER-LICENSE')
    # Do not ship the whole upstream archive: non-runtime diagnostics can
    # contain captured account pages. SOURCE.json retains its verifiable pin.
    for req in share.glob('cp*.txt'):
        req.chmod(0o644)
    (stage/'usr/lib/miadi-deepdiver/bin/google-chrome').chmod(0o755)
else:
    # Verify the pinned browser inputs at build time, but do NOT redistribute
    # them. The installed manifest/installer fetches directly from upstream.
    for item in lock['browsers']:
        fetch(item)
# Normalize input and generated timestamps; dpkg-deb also consumes SOURCE_DATE_EPOCH.
for root, dirs, files in os.walk(stage):
    for name in dirs+files:
        path = Path(root)/name
        if not path.is_symlink():
            os.utime(path, (lock['source']['epoch'],)*2)
