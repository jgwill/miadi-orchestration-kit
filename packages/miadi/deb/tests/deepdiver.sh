#!/usr/bin/env bash
# Clean amd64 containers. No Google account, review, transcript, host profile or root GUI.
# IMAGE=ubuntu:22.04 (also ubuntu:24.04 / debian:12) bash tests/deepdiver.sh
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
image=${IMAGE:-ubuntu:22.04}
docker run --rm --cap-add=SYS_ADMIN --security-opt apparmor=unconfined \
  --shm-size=1g -v "$here/dist:/debs:ro" -v "$here/tests:/tests:ro" \
  "$image" bash /tests/deepdiver-container.sh
