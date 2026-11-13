#!/usr/bin/env bash
# A credential is masked in place wherever a session recorded it: same inode, size and mtime,
# valid JSON, and never a value in what the script prints. Words and placeholders stay.
# All values here are random at run time. Run: bash tests/scrub-secrets.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRUB="$HERE/scripts/miadi-scrub-secrets.py"
WORK="$(mktemp -d)"
trap 'chmod -R u+w "$WORK"; rm -rf "$WORK"' EXIT

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $2, got $3"; failures=$((failures + 1)); fi
}
random() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
stamp() { stat -c '%i %s %Y' "$1"; }

VALUE="$(random 40)"; FILED="$(random 44)"; PASSWORD="$(random 20)"; QUOTED="ab\"$(random 24)"
mkdir -p "$WORK/home" "$WORK/s/sub"
cat > "$WORK/env" <<ENV
EXAMPLE_API_KEY=$FILED
DATABASE_URL=postgres://app:$PASSWORD@db.internal/app
MIADI_AUTH_ISSUER=miadi-chronicle
EXAMPLE_PLACEHOLDER_TOKEN=your-token-here
PUBLIC_URL=https://example.org
LOCAL_DB_URL=postgres://postgres:postgres@localhost:5432/app
ENV
T="$WORK/s/session.jsonl"
jq -nc --arg a "$VALUE" --arg b "$FILED" --arg q "$QUOTED" --arg c "${VALUE:0:20}" --arg p "$PASSWORD" \
    '{type:"user", stdout:("EXAMPLE_TOKEN=\"" + $a + "\"\nKEY=" + $b + "\nquoted=" + $q + "\ncut=" + $c + "\nurl=postgres://app:" + $p + "@db.internal/app\nmiadi-chronicle your-token-here\n")}' > "$T"
printf 'ordinary line with no credential\n' > "$WORK/s/sub/plain.txt"
printf '%s\n' "$VALUE" > "$WORK/s/sub/locked.txt"; chmod 444 "$WORK/s/sub/locked.txt"
touch -d '2026-01-02 03:04:05' "$T" "$WORK/s/sub/plain.txt"
printf 'EXAMPLE_TOKEN=%s\n' "$VALUE" > "$WORK/s/.env"
printf '{"env":{"X":"%s"}}\n' "$VALUE" > "$WORK/s/.mcp.json"
mkdir -p "$WORK/s/proposed"; printf 'EXAMPLE_TOKEN=%s\n' "$VALUE" > "$WORK/s/proposed/.env.proposed.md"

run() { env -i PATH="$PATH" HOME="$WORK/home" EXAMPLE_TOKEN="$VALUE" EXAMPLE_QUOTED_SECRET="$QUOTED" python3 -B "$SCRUB" --only-roots --root "$WORK/s" --env-file "$WORK/env" "$@" 2>&1; }
no_value() { for v in "$VALUE" "$FILED" "$PASSWORD" "$QUOTED"; do printf '%s' "$1" | grep -qF -- "$v" && { echo yes; return; }; done; echo no; }

before=$(stamp "$T"); sum=$(sha256sum "$T"); plain=$(stamp "$WORK/s/sub/plain.txt")
said=$(run)
expect "counting changes nothing" "$sum" "$(sha256sum "$T")"
expect "counting names the credential" "yes" "$(printf '%s' "$said" | grep -q 'EXAMPLE_TOKEN' && echo yes || echo no)"
expect "and says how to apply" "yes" "$(printf '%s' "$said" | grep -q -- '--apply' && echo yes || echo no)"
expect "counting prints no value" "no" "$(no_value "$said")"

said=$(run --apply)
expect "applying prints no value" "no" "$(no_value "$said")"
expect "the file keeps its inode, size and mtime" "$before" "$(stamp "$T")"
expect "the file is still valid JSON" "user" "$(jq -r .type "$T")"
expect "an environment value is gone" "0" "$(grep -cF -- "$VALUE" "$T")"
expect "a value from an env file is gone" "0" "$(grep -cF -- "$FILED" "$T")"
expect "a password in a URL is gone" "0" "$(grep -cF -- "$PASSWORD" "$T")"
expect "a value cut short by what printed it is gone" "0" "$(grep -cF -- "${VALUE:0:20}" "$T")"
expect "a value with a quote is gone" "0" "$(jq -r .stdout "$T" | grep -cF -- "$QUOTED")"
expect "the mask is as long as the value" "yes" "$(jq -r .stdout "$T" | grep -qE '^EXAMPLE_TOKEN="\*{40}"$' && echo yes || echo no)"
expect "the URL around the password stays" "yes" "$(jq -r .stdout "$T" | grep -qE '^url=postgres://app:\*{20}@db\.internal/app$' && echo yes || echo no)"
expect "words and placeholders stay" "yes" "$(jq -r .stdout "$T" | grep -qF 'miadi-chronicle your-token-here' && echo yes || echo no)"
expect "a file with no value is left alone" "$plain" "$(stamp "$WORK/s/sub/plain.txt")"
expect "a captured copy of a .env is masked" "0" "$(grep -cF -- "$VALUE" "$WORK/s/proposed/.env.proposed.md")"
expect "a .env is left alone" "1" "$(grep -cF -- "$VALUE" "$WORK/s/.env")"
expect "a .mcp.json is left alone" "1" "$(grep -cF -- "$VALUE" "$WORK/s/.mcp.json")"
expect "and both are listed" "2" "$(printf '%s\n' "$said" | grep -c 'left alone')"
expect "a file it cannot write is counted" "yes" "$(printf '%s' "$said" | grep -q '1 files could not be opened' && echo yes || echo no)"
expect "and keeps its content" "1" "$(grep -cF -- "$VALUE" "$WORK/s/sub/locked.txt")"

printf 'next line\n' >> "$T"
expect "a session can keep appending" "yes" "$(tail -1 "$T" | grep -q 'next line' && echo yes || echo no)"
chmod 644 "$WORK/s/sub/locked.txt"; run --apply >/dev/null
said=$(run)
expect "a second pass finds nothing" "yes" "$(printf '%s' "$said" | grep -q 'nothing to mask' && echo yes || echo no)"

# Without ripgrep: the same result through grep and Python.
mkdir -p "$WORK/bin" "$WORK/t"; ln -s "$(command -v python3)" "$WORK/bin/python3"; ln -s "$(command -v grep)" "$WORK/bin/grep"
printf 'EXAMPLE_TOKEN=%s\n' "$VALUE" > "$WORK/t/session.txt"
env -i PATH="$WORK/bin" HOME="$WORK/home" EXAMPLE_TOKEN="$VALUE" python3 -B "$SCRUB" --only-roots --root "$WORK/t" --apply >/dev/null 2>&1
expect "without ripgrep the value is gone too" "0" "$(grep -cF -- "$VALUE" "$WORK/t/session.txt")"

[ "$failures" -eq 0 ] && echo "scrub-secrets: all passed" || { echo "scrub-secrets: $failures failed"; exit 1; }
