"""Installed-package provenance assertions; stdlib, no account or browser access."""
import hashlib
import json
from pathlib import Path
import subprocess

share = Path('/usr/share/miadi-deepdiver')
lock = json.loads((share/'SOURCE.json').read_text())
assert lock['source']['commit'] == '91898f367d519f8468943afcec356b839652a58c'
assert lock['source']['sha256'] == '56e5e747b3bfef6598c238d5c0b139cdb24b170b3dbf8025ae9b8c33aeb90931'
assert not (share/'source.tar.gz').exists(), 'raw upstream diagnostic archive must not ship'
assert hashlib.sha256((share/'wheels'/lock['source']['wheel']).read_bytes()).hexdigest() == lock['source']['wheel_sha256']
for abi, items in lock['runtime'].items():
    assert abi in ('cp310', 'cp311', 'cp312')
    for item in items:
        assert hashlib.sha256((share/'wheels'/item['filename']).read_bytes()).hexdigest() == item['sha256']
assert subprocess.check_output(['dpkg-query', '-W', '-f=${Version}', 'miadi-deepdiver'], text=True) == '0.1.0-1'
assert subprocess.check_output(['dpkg-query', '-W', '-f=${Version}', 'miadi-deepdiver-chromium'], text=True) == '1.64.1-1'
print('PASS dpkg versions, pinned source/hash, captured wheel hashes and exclusion of raw debug/source archive')
