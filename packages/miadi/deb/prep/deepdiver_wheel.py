"""Normalize pure-Python fork wheel metadata across build umasks/zlib versions."""
import io
import time
import zipfile


def normalize(path, epoch):
    result = io.BytesIO()
    with zipfile.ZipFile(path) as source, zipfile.ZipFile(result, 'w', compression=zipfile.ZIP_STORED) as dest:
        for name in sorted(source.namelist()):
            info = zipfile.ZipInfo(name, time.gmtime(epoch)[:6])
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            dest.writestr(info, source.read(name))
    path.write_bytes(result.getvalue())
