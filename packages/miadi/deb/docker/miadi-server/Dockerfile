# The Miadi web app in a container, installed from the miadi-server package.
#
# The build context holds two things:
#   debs/        miadi-server, miadi-config and miadi-node
#   source.tar   a `git archive` of the jgwill/Miadi commit to serve
#
# Nothing secret goes into a layer. The build reads the app's .env as a secret:
#   docker build --secret id=dotenv,src=/path/to/.env -t miadi-server <context>
# Values named NEXT_PUBLIC_* in that file are compiled into the client bundle, as in any Next.js build.
# The app's .env and its data are given again at run time:
#   docker run -p 3335:3335 -v /path/to/.env:/app/.env:ro -v /srv/miadi:/srv/miadi miadi-server
#
# The container serves on its own, but the app needs two services it can reach: the Redis in
# KV_REST_API_URL and the medicine wheel in MIADI_CHRONICLE_MW_URL. A URL that only the host
# can reach, such as a tailnet name or 127.0.0.1, has to change in .env or be routed in.
# Without the wheel, person tokens answer 502 and /chronicle answers 500.
FROM ubuntu:24.04

ARG PNPM_VERSION=11.13.0
ARG NPM_VERSION=12.2.2

RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ca-certificates curl git build-essential python3 >/dev/null

COPY debs/ /tmp/debs/
RUN apt-get install -y -qq /tmp/debs/*.deb >/dev/null && rm -rf /tmp/debs

# miadi-node carries no npm, so pnpm and npm come from their release tarballs and run on that
# node. The build needs both: @miadi/inquiry-weave's build script calls npm.
RUN mkdir -p /opt/pnpm /opt/npm \
 && curl -fsSL "https://registry.npmjs.org/pnpm/-/pnpm-${PNPM_VERSION}.tgz" | tar -xz -C /opt/pnpm --strip-components=1 \
 && curl -fsSL "https://registry.npmjs.org/npm/-/npm-${NPM_VERSION}.tgz" | tar -xz -C /opt/npm --strip-components=1 \
 && printf '#!/bin/sh\nexec /usr/lib/miadi-node/bin/node /opt/pnpm/bin/pnpm.mjs "$@"\n' > /usr/local/bin/pnpm \
 && printf '#!/bin/sh\nexec /usr/lib/miadi-node/bin/node /opt/npm/bin/npm-cli.js "$@"\n' > /usr/local/bin/npm \
 && chmod +x /usr/local/bin/pnpm /usr/local/bin/npm

# Give the uid that owns /srv/miadi on the host, so a mounted data folder stays writable.
ARG MIADI_UID=1001
RUN useradd -m -u "$MIADI_UID" miadi && mkdir -p /app && chown miadi:miadi /app

# miadi-server reads these. HOSTNAME is the address `next start` binds, and Docker would
# otherwise fill it with the container's name.
ENV PATH=/usr/lib/miadi-node/bin:/usr/local/bin:/usr/bin:/bin \
    MIADI_PROJECT_DIR=/app \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS=--max-old-space-size=8192 \
    NEXT_TELEMETRY_DISABLED=1

COPY --chown=miadi:miadi source.tar /tmp/source.tar
USER miadi
WORKDIR /app
RUN tar -xf /tmp/source.tar -C /app

RUN pnpm install --frozen-lockfile

# The app resolves its workspace packages through their dist/, which no install creates.
# @miadi/voice-client is named separately: the app reaches it through a tsconfig path, not a dependency.
RUN pnpm --filter "miadi-project^..." --filter "@miadi/voice-client..." run build

# Next.js loads the API routes while building, and some open their database client on load, so
# the build reads .env too. A BuildKit secret: it exists for this step and is in no layer.
# Next's build cache keeps values it read from .env, so the cache goes in the same step.
RUN --mount=type=secret,id=dotenv,target=/app/.env,mode=0444 pnpm build && rm -rf .next/cache

EXPOSE 3335
CMD ["/usr/bin/miadi-server"]
