#!/usr/bin/env bash
# prep/miadi-server.sh <stage>: the built Miadi web app, at /usr/lib/miadi-server/app.
#   MIADI_SERVER_SOURCE   a jgwill/Miadi checkout (default MIADI_SRC, else /src/Miadi)
#   MIADI_SERVER_REF      the commit to build (default HEAD)
# Builds a clean export of that commit, so nothing uncommitted reaches the package. No secret
# is read: routes that open a database client on load get a placeholder that connects nowhere.
# Needs pnpm and npm on the builder.
set -euo pipefail
stage=${1:?usage: prep/miadi-server.sh <stage>}
src=${MIADI_SERVER_SOURCE:-${MIADI_SRC:-/src/Miadi}}
commit=$(git -C "$src" rev-parse "${MIADI_SERVER_REF:-HEAD}")
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git -C "$src" archive "$commit" | tar -x -C "$work"
cd "$work"
pnpm install --frozen-lockfile >&2
pnpm --filter "miadi-project^..." --filter "@miadi/voice-client..." run build >&2
placeholder=postgresql://build:build@127.0.0.1:5432/build
MIADI_NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=8192 \
	DATABASE_URL=$placeholder POSTGRES_URL=$placeholder pnpm build >&2

app=$stage/usr/lib/miadi-server/app
mkdir -p "$app"
# The trace follows the app's reads of its working directory and copies most of the repository
# into the standalone folder, so only what runs is taken from it.
for entry in server.js package.json node_modules .next; do
	cp -a ".next/standalone/$entry" "$app/"
done
cp -a .next/static "$app/.next/static"
cp -a public "$app/public"
# What the app reads beside itself at run time, by path.
for path in data config foundations scripts/rag .github-hooks app/articles/files app/ava/consultations/files; do
	if [ -e "$path" ]; then
		mkdir -p "$app/$(dirname "$path")"
		cp -a "$path" "$app/$path"
	fi
done
find "$app" -maxdepth 2 -name '.env*' -delete
rm -rf "$app/.next/cache"
find "$app" -name '*.map' -type f -delete
chmod -R u=rwX,go=rX "$app"
printf 'jgwill/Miadi %s\n' "$commit" > "$stage/usr/lib/miadi-server/SOURCE"
chmod 0644 "$stage/usr/lib/miadi-server/SOURCE"
echo "miadi-server: built ${commit:0:8}, $(du -sh "$app" | cut -f1)" >&2
