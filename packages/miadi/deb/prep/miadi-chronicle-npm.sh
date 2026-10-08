#!/usr/bin/env bash
# prep/miadi-chronicle-npm.sh <stage> <package>: install the npm packages prep/<package>.packages
# pins into /usr/lib/<package>, with the npm of the Node miadi-node carries, and write a
# /usr/bin wrapper for each command those packages declare in "bin" (not their dependencies').
# /usr/share/<package>/SOURCE records each pin and the resolved tree; package-lock.json stays.
# Install scripts are not run: no package in either list has a native module (#77).
# Ref: jgwill/miadi-orchestration-kit#77
set -euo pipefail
stage=${1:?usage: prep/miadi-chronicle-npm.sh <stage> <package>}
package=${2:?usage: prep/miadi-chronicle-npm.sh <stage> <package>}
here=$(cd "$(dirname "$0")" && pwd)
. "$here/node-release.sh"
trap 'rm -rf "$node_dir"' EXIT
lib=/usr/lib/$package
mapfile -t pins < <(grep -v -e '^#' -e '^\s*$' "$here/$package.packages")
mkdir -p "$stage$lib" "$stage/usr/bin" "$stage/usr/share/$package"
PATH="$node_dir/bin:$PATH" npm install --prefix "$stage$lib" --omit=dev --ignore-scripts \
	--no-audit --no-fund --loglevel=error --cache "$node_cache/npm" "${pins[@]}" >&2
rm -rf "$stage$lib/node_modules/.bin"

{
	echo "Installed with npm $(PATH="$node_dir/bin:$PATH" npm --version) on node $node_release:"
	printf '  %s\n' "${pins[@]}"
	echo
	PATH="$node_dir/bin:$PATH" npm ls --prefix "$stage$lib" --all --omit=dev 2>/dev/null | sed "s#$stage##"
} > "$stage/usr/share/$package/SOURCE"

for pin in "${pins[@]}"; do
	name=${pin%@*}
	"$node_dir/bin/node" -e '
		const [dir, name] = process.argv.slice(1)
		const p = require(dir + "/node_modules/" + name + "/package.json")
		const bin = typeof p.bin === "string" ? { [name.split("/").pop()]: p.bin } : (p.bin || {})
		for (const [cmd, file] of Object.entries(bin)) console.log(cmd + " " + file.replace(/^\.\//, ""))
	' "$stage$lib" "$name" | while read -r cmd file; do
		cat > "$stage/usr/bin/$cmd" <<WRAP
#!/bin/sh
# $cmd from $pin, run by the Node.js miadi-node carries. Installed by $package.
exec /usr/lib/miadi-node/bin/node $lib/node_modules/$name/$file "\$@"
WRAP
		chmod 0755 "$stage/usr/bin/$cmd"
		echo "$package: /usr/bin/$cmd -> $name/$file" >&2
	done
done
# npm wrote with the builder's umask (007 on gaia): every reader on the host needs these.
chmod -R u=rwX,go=rX "$stage$lib" "$stage/usr/share/$package"
