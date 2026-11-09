# The Miadi web app in a container, from the miadi-server package alone: no source and no build.
#
# The build context holds debs/ with miadi-server, miadi-config and miadi-node.
#
# The app's settings and its data are given at run time, and nothing secret is in the image:
#   docker run -p 127.0.0.1:3335:3335 \
#     -v /path/to/.env:/home/miadi/.config/miadi-server/env:ro \
#     -v /srv/miadi:/srv/miadi miadi-server
#
# The container serves on its own, but the app needs two services it can reach: the Redis in
# KV_REST_API_URL and the medicine wheel in MIADI_CHRONICLE_MW_URL. A URL that only the host
# can reach, such as a tailnet name or 127.0.0.1, has to change in the settings, or the container
# has to run with --network host and MIADI_BIND=127.0.0.1.
FROM ubuntu:24.04

RUN apt-get update -qq && apt-get install -y -qq --no-install-recommends ca-certificates curl >/dev/null

COPY debs/ /tmp/debs/
RUN apt-get install -y -qq /tmp/debs/*.deb >/dev/null && rm -rf /tmp/debs

# Give the uid that owns /srv/miadi on the host, so a mounted data folder stays writable.
ARG MIADI_UID=1001
RUN useradd -m -u "$MIADI_UID" miadi
USER miadi

ENV MIADI_BIND=0.0.0.0
EXPOSE 3335
CMD ["/usr/bin/miadi-server"]
