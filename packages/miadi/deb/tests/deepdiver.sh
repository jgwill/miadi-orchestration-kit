#!/usr/bin/env bash
# Clean amd64 containers. No Google account, review, transcript, host profile or root GUI.
# IMAGE=ubuntu:22.04 (also ubuntu:24.04 / debian:12) bash tests/deepdiver.sh
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
image=${IMAGE:-ubuntu:22.04}
# Metadata alone can be read while dpkg-deb is still writing data.tar.
for deb in miadi-deepdiver-chromium_1.64.1-1_amd64 miadi-deepdiver_0.1.0-2_amd64 deepdiver_0.1.0-1_all; do
  test "$(dpkg-deb -f "$here/dist/$deb.deb" Package)" = "${deb%%_*}"
  dpkg-deb --contents "$here/dist/$deb.deb" >/dev/null
done
docker run --rm --cap-add=SYS_ADMIN --security-opt apparmor=unconfined \
  --shm-size=1g -v "$here/dist:/debs:ro" -v "$here/tests:/tests:ro" \
  "$image" bash /tests/deepdiver-container.sh
