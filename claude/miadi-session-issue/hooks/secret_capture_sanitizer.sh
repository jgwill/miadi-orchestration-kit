#!/usr/bin/env bash
# Shared sanitizer for agent hook/sessiondata capture.
# Redacts credentials before JSONL/JSON is persisted.

hook_secret_sanitize_stream() {
    if ! command -v perl >/dev/null 2>&1; then
        printf '%s\n' '{"redacted":true,"reason":"secret sanitizer unavailable"}'
        return 0
    fi

    perl -0pe '
        sub redact {
            my ($value) = @_;
            my $keep = length($value) >= 7 ? 6 : (length($value) >= 4 ? 4 : length($value));
            return substr($value, 0, $keep) . "***";
        }

        s{-----BEGIN [^-]*PRIVATE KEY-----.*?-----END [^-]*PRIVATE KEY-----}{-----BEGIN PRIVATE KEY-----***-----END PRIVATE KEY-----}gs;
        s{PuTTY-User-Key-File-[0-9].*?(?=\\n\\S|$)}{PuTTY-User-Key-File-***}gs;

        s{(AKIA[0-9A-Z]{16})}{redact($1)}ge;
        s{(ASIA[0-9A-Z]{16})}{redact($1)}ge;
        s{(gh[pousr]_[A-Za-z0-9_]{20,})}{redact($1)}ge;
        s{(github_pat_[A-Za-z0-9_]{20,})}{redact($1)}ge;
        s{(glpat-[A-Za-z0-9_-]{18,})}{redact($1)}ge;
        s{(sk-ant-[A-Za-z0-9_-]{20,})}{redact($1)}ge;
        s{(sk-proj-[A-Za-z0-9_-]{20,})}{redact($1)}ge;
        s{(sk-[A-Za-z0-9_-]{20,})}{redact($1)}ge;
        s{(xox[baprs]-[A-Za-z0-9-]{10,})}{redact($1)}ge;
        s{(AIza[0-9A-Za-z_-]{35})}{redact($1)}ge;
        s{(ya29\.[0-9A-Za-z_-]{20,})}{redact($1)}ge;
        s{(hf_[A-Za-z0-9]{20,})}{redact($1)}ge;
        s{(npm_[A-Za-z0-9]{30,})}{redact($1)}ge;
        s{((?:sk|pk|rk)_live_[A-Za-z0-9]{20,})}{redact($1)}ge;
        s{(dop_v1_[A-Za-z0-9]{32,})}{redact($1)}ge;
        s{(shpat_[A-Za-z0-9]{32,})}{redact($1)}ge;
        s{(mwt_[A-Za-z0-9_-]{32,})}{redact($1)}ge;
        s{(mr_[A-Za-z0-9]{32,})}{redact($1)}ge;
        s{(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})}{redact($1)}ge;
        s{\b([A-Za-z][A-Za-z0-9+.-]*://[^\s/:@"\047<>]*:)([^\s@/"\047<>]{3,})(@)}{$1 . redact($2) . $3}ge;
        s{(\bdefine\(\s*["\047][A-Za-z0-9_]*(?i:password|passwd|secret|token|key|salt)[A-Za-z0-9_]*["\047]\s*,\s*["\047])([^"\047]{4,})}{$1 . redact($2)}ge;
        s{((?i:\bBearer\s+))([A-Za-z0-9._~+/=-]{12,})}{$1 . redact($2)}gex;
        s{((?i:\b[A-Za-z0-9_.-]*(?:api[_-]?key|secret|token|passwd|password|client[_-]?secret|access[_-]?key|private[_-]?key|auth[_-]?token)[A-Za-z0-9_.-]*\b)["\047\s]*[:=]\s*["\047]?)([A-Za-z0-9][A-Za-z0-9/_+.\-=~:]{7,})}{$1 . redact($2)}gex;
    '
}

hook_secret_sanitize_text() {
    printf '%s' "$1" | hook_secret_sanitize_stream
}

hook_secret_write_line() {
    local file="$1"
    local text="$2"
    hook_secret_sanitize_text "$text" >> "$file"
    printf '\n' >> "$file"
}

hook_secret_overwrite_line() {
    local file="$1"
    local text="$2"
    hook_secret_sanitize_text "$text" > "$file"
    printf '\n' >> "$file"
}

hook_secret_sanitize_file_to() {
    local src="$1"
    local dest="$2"
    if [ -f "$src" ]; then
        hook_secret_sanitize_stream < "$src" > "$dest"
    fi
}

hook_secret_self_test() {
    local sample sanitized failed=0
    local openai anthropic github aws slack google hf npm stripe miadi miadi_reader jwt kv bearer pem dburl
    openai="sk-b45abcDEF1234567890""XYZ"
    anthropic="sk-ant-api03-ABCDEFGHIJKLM""NOPQRSTUVWX"
    github="ghp_ABCDefgh1234""IJKLmnop5678QRSTuvwx9012"
    aws="AKIAIOSFODNN7""EXAMPLE"
    slack="xoxb-1234567890-""abcdefghijklmno"
    google="AIzaSyA1234567890abcde""fghijklmnopqrstuvw"
    hf="hf_ABCDEFGHIJKLMNO""PQRSTUVWXYZ123456"
    npm="npm_abcdefghijklmnop""qrstuvwxyz1234567890"
    stripe="sk_live_abcdefghijklm""nopqrstuvwxyz"
    miadi="mwt_Qn5pB2ctOgl0-xY_""abcdefghijklmnopqrstuvwxyz0"
    miadi_reader="mr_ABCDEFGHIJKLMNOPQRST""abcdefghijklmnopqrst"
    jwt="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"".eyJzdWIiOiIxMjM0NQ.SflKxwRJSMeKKF2QT4fwpMeJ"
    kv="DATABASE_PASSWORD=s3cr3tP4ssw0rdValue"
    bearer="Authorization: Bearer abcdefghijklmnopqrstuvwxyz"
    pem=$'-----BEGIN OPENSSH PRIVATE KEY-----\nsecret-material\n-----END OPENSSH PRIVATE KEY-----'
    dburl="postgres://neondb_owner:npg_Zx81kQ""wPq3Lm@ep-cool-1.neon.tech/neondb"
    sample="$(
        jq -nc \
            --arg openai "$openai" \
            --arg anthropic "$anthropic" \
            --arg github "$github" \
            --arg aws "$aws" \
            --arg slack "$slack" \
            --arg google "$google" \
            --arg hf "$hf" \
            --arg npm "$npm" \
            --arg stripe "$stripe" \
            --arg miadi "$miadi" \
            --arg miadi_reader "$miadi_reader" \
            --arg jwt "$jwt" \
            --arg kv "$kv" \
            --arg bearer "$bearer" \
            --arg pem "$pem" \
            --arg dburl "$dburl" \
            '{dburl:$dburl,openai:$openai,anthropic:$anthropic,github:$github,aws:$aws,slack:$slack,google:$google,hf:$hf,npm:$npm,stripe:$stripe,miadi:("your token is " + $miadi),miadi_reader:$miadi_reader,jwt:$jwt,kv:$kv,bearer:$bearer,pem:$pem}'
    )"
    sanitized="$(hook_secret_sanitize_text "$sample")"

    for raw in "$openai" "$anthropic" "$github" "$aws" "$slack" "$google" "$hf" "$npm" "$stripe" "$miadi" "$miadi_reader" "$jwt" \
        's3cr3tP4ssw0rdValue' 'abcdefghijklmnopqrstuvwxyz' 'secret-material' 'npg_Zx81kQwPq3Lm'; do
        if printf '%s' "$sanitized" | grep -Fq "$raw"; then
            printf 'FAILED: raw secret remained: %s\n' "$raw" >&2
            failed=1
        fi
    done

    printf '%s' "$sanitized" | grep -Fq 'sk-b45***' || { printf 'FAILED: OpenAI prefix redaction missing\n' >&2; failed=1; }
    printf '%s' "$sanitized" | grep -Fq 'ghp_AB***' || { printf 'FAILED: GitHub prefix redaction missing\n' >&2; failed=1; }
    printf '%s' "$sanitized" | grep -Fq 'mwt_Qn***' || { printf 'FAILED: Miadi token prefix redaction missing\n' >&2; failed=1; }
    printf '%s' "$sanitized" | grep -Fq 'DATABASE_PASSWORD=s3cr3t***' || { printf 'FAILED: key/value redaction missing\n' >&2; failed=1; }
    printf '%s' "$sanitized" | grep -Fq 'postgres://neondb_owner:npg_Zx***@ep-cool-1' || { printf 'FAILED: URL password redaction missing\n' >&2; failed=1; }
    printf '%s' "$(hook_secret_sanitize_text "define('DB_PASSWORD', 'Hunter2-Pa55word');")" | grep -Fq "define('DB_PASSWORD', 'Hunter***')" || { printf 'FAILED: PHP define redaction missing\n' >&2; failed=1; }

    if [ "$failed" -eq 0 ]; then
        printf 'secret_capture_sanitizer self-test passed\n'
    fi
    return "$failed"
}

case "${1:-}" in
    --stream)
        hook_secret_sanitize_stream
        ;;
    --self-test)
        hook_secret_self_test
        ;;
esac
