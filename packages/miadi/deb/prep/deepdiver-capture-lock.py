#!/usr/bin/python3
"""Maintainer-only lock refresh: capture already-resolved wheel directories.

Run with a scratch directory containing build-wheels/, wheels-cp310/311/312/,
fork-wheel/ and the three browser ZIPs. Builds never run this resolver.
"""
import email
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
import zipfile
from deepdiver_wheel import normalize

root = Path(sys.argv[1])
out = Path(__file__).with_name('miadi-deepdiver.lock.json')
normalize(root/'fork-wheel/deepdiver-0.1.1-py3-none-any.whl', 1793939798)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def wheels(folder):
    result = []
    for p in sorted((root / folder).glob('*.whl')):
        with zipfile.ZipFile(p) as z:
            meta = email.message_from_bytes(z.read(next(n for n in z.namelist() if n.endswith('.dist-info/METADATA'))))
        with urllib.request.urlopen(f'https://pypi.org/pypi/{meta["Name"]}/{meta["Version"]}/json') as r:
            data = json.load(r)
        remote = next(u for u in data['urls'] if u['filename'] == p.name)
        assert remote['digests']['sha256'] == digest(p), p
        result.append(dict(name=meta['Name'], version=meta['Version'], filename=p.name,
                           sha256=digest(p), url=remote['url']))
    assert result, folder
    return result

lock = dict(schema=1, source=dict(repository='https://github.com/miadisabelle/deepdiver',
    commit='91898f367d519f8468943afcec356b839652a58c',
    url='https://codeload.github.com/miadisabelle/deepdiver/tar.gz/91898f367d519f8468943afcec356b839652a58c',
    sha256=digest(root / 'source.tar.gz'), epoch=1793939798,
    wheel='deepdiver-0.1.1-py3-none-any.whl',
    wheel_sha256=digest(root / 'fork-wheel/deepdiver-0.1.1-py3-none-any.whl')),
    build=wheels('build-wheels'), runtime={f'cp{p}': wheels(f'wheels-cp{p}') for p in (310,311,312)},
    browsers=[dict(name='chromium', revision='1248', version='156.0.8078.4',
        url='https://cdn.playwright.dev/builds/cft/156.0.8078.4/linux64/chrome-linux64.zip',
        filename='chrome-linux64.zip', directory='chromium-1248', sha256=digest(root/'chrome-linux64.zip')),
        dict(name='chromium-headless-shell', revision='1248', version='156.0.8078.4',
        url='https://cdn.playwright.dev/builds/cft/156.0.8078.4/linux64/chrome-headless-shell-linux64.zip',
        filename='chrome-headless-shell-linux64.zip', directory='chromium_headless_shell-1248', sha256=digest(root/'chrome-headless-shell-linux64.zip')),
        dict(name='ffmpeg', revision='1013',
        url='https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1013/ffmpeg-linux.zip',
        filename='ffmpeg-linux.zip', directory='ffmpeg-1013', sha256=digest(root/'ffmpeg-linux.zip'))])
out.write_text(json.dumps(lock, indent=2, sort_keys=True)+'\n')
print(out)
