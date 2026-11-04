#!/usr/bin/env bash
# A credential printed in a tool's output reaches the model, and Claude Code's own
# transcript under ~/.claude/projects, before any hook runs. Claude Code lets a
# PostToolUse hook replace only an MCP tool's output, so no hook can take it back.
# secret_print_guard.sh refuses what it can before the call. This reports what got past it.
# What this plugin writes under <root>/<session_id>/ is already redacted
# (secret_capture_sanitizer.sh).
#
# It reads the tool's output and reports two findings, told apart in what the person reads:
#
#   held   The output contains the value of a credential this host holds: a variable in
#          the session environment named like one (*TOKEN*, *SECRET*, *PASSWORD*,
#          *API_KEY*, *ACCESS_KEY*, *PRIVATE_KEY*, *CREDENTIAL*, *AUTH*, *_PAT). That is a
#          real credential, so the person is told to mask the local copies with
#          scripts/miadi-scrub-secrets.py, by variable name, with the word it followed in the
#          output, so the claim can be checked at a glance. Earned 2026-11-04: rotating every
#          credential printed on a host is not what its owner will do, nor what they asked.
#   shaped A string shaped like a vendor credential (ghp_, sk-ant-, mwt_, AKIA, a JWT, a
#          private key block, a password in a URL) that is no value this host holds. It
#          may be live somewhere else, so the person is told to check it, by kind and
#          redacted prefix. Fixtures are left out: a value holding test, fake, example,
#          dummy, sample, fixture, placeholder, redacted or changeme, a run of six
#          ascending or six equal characters, or under 3 bits of entropy per character.
#
# "Bearer <x>" and "token: <x>" count only as held: in code the strings they catch
# ("Bearer review-token") are fixtures far more often than credentials. Earned
# 2026-11-04: the test fixture "Bearer review-token" in Miadi's connector tests was
# announced as a credential to rotate. 22 of the 23 alerts up to that day were fixtures.
#
# Each finding is one line in <root>/<session_id>/_claude_secret_exposures.jsonl, with
# action "rotate" (held) or "check" (shaped only). A session is told once per credential:
# an Edit of the same file carries the same string each time, and the ledger keeps every
# call. The value itself is never printed, stored or forwarded. Earned 2026-11-01: a probe
# command printed a person token into session 201371c1 and nothing said so.
#
# COST  This runs after every tool call and about 1 call in 3,000 has a finding, so a clean
# call starts only bash and perl. jq and lib.sh load when there is something to report:
# 267 ms per call came down to 46 ms (0.1.32, measured on gaia).

input=$(cat -)

findings=$(printf '%s' "$input" | perl -e '
    use strict; use warnings; no warnings "utf8";
    local $/; my $raw = <STDIN>; $raw = "" unless defined $raw;

    # The text of .tool_response. Unescaped by hand, because a JSON parser costs more than
    # the rest of this hook and only the strings matter here.
    my $start = index($raw, q{"tool_response"});
    exit 0 if $start < 0;
    my $text = substr($raw, $start);
    $text =~ s/^"tool_response"\s*:\s*\{?(?:"[A-Za-z_]+"\s*:\s*")?//;
    my %esc = (n => "\n", t => "\t", r => "\r", b => "\b", f => "\f");
    $text =~ s{\\(u[0-9a-fA-F]{4}|.)}{ length($1) > 1 ? chr(hex(substr($1, 1))) : (defined $esc{$1} ? $esc{$1} : $1) }ge;

    sub entropy {
        my ($v) = @_; my %n; $n{$_}++ for split //, $v;
        my $h = 0; my $len = length $v;
        for (values %n) { my $p = $_ / $len; $h -= $p * log($p) / log(2); }
        return $h;
    }
    sub fixture {
        my ($v) = @_;
        return 1 if $v =~ /test|fake|example|dummy|sample|fixture|placeholder|redacted|changeme/i;
        my $lc = lc $v; my ($asc, $same) = (1, 1);
        for my $i (1 .. length($lc) - 1) {
            my ($p, $q) = (ord(substr($lc, $i - 1, 1)), ord(substr($lc, $i, 1)));
            $asc  = $q == $p + 1 ? $asc + 1 : 1;
            $same = $q == $p     ? $same + 1 : 1;
            return 1 if $asc >= 6 || $same >= 6;
        }
        return entropy($v) < 3.0;
    }
    sub prefix { my ($v) = @_; substr($v, 0, length($v) >= 7 ? 6 : 4) . "***" }

    # held: the values of the credentials in this environment.
    my @held; my @found;
    for my $n (sort keys %ENV) {
        next unless $n =~ /TOKEN|SECRET|PASSW(?:OR)?D|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIAL|_PAT$|AUTH(?!OR)/i;
        next if $n =~ /(?:_SOCK|_FILE|_PATH|_DIR|_HOST|_PORT|_URL|_URI|_NAME|_USER|_ID|AUTHORITY|_CHECK)$/i;
        my $v = $ENV{$n};
        next if length($v) < 12 || $v =~ m{^[/~.]} || $v =~ /\s/ || $v =~ m{^[a-z+]+://}i;
        my $at = index($text, $v);
        next if $at < 0;
        push @held, $v;
        # The word before the value: enough to check the claim, and none of the value.
        my $line = rindex($text, "\n", $at) + 1;
        my ($word) = substr($text, $line, $at - $line) =~ /(\S*)\s*$/;
        $word =~ s/.*[;,&]//;
        $word = substr($word, -40) if length($word) > 40;
        push @found, [$n, $word];
    }
    for my $f (@found) {
        my ($n, $word) = @$f;
        for my $v (@held) { $word =~ s/\Q$v\E/***/g }
        print "held\t$n\t$word***\n";
    }
    my $is_held = sub { my ($v) = @_; for (@held) { return 1 if index($v, $_) >= 0 || index($_, $v) >= 0 } 0 };

    # shaped: the patterns that name a credential by its own shape (the strong ones in
    # secret_capture_sanitizer.sh), each starting after a non-alphanumeric character.
    my $lb = qr/(?<![A-Za-z0-9])/;
    my @shapes = (
        ["AWS access key",     qr/$lb((?:AKIA|ASIA)[0-9A-Z]{16})(?![A-Za-z0-9])/],
        ["GitHub token",       qr/$lb(gh[pousr]_[A-Za-z0-9_]{20,})/],
        ["GitHub token",       qr/$lb(github_pat_[A-Za-z0-9_]{20,})/],
        ["GitLab token",       qr/$lb(glpat-[A-Za-z0-9_-]{18,})/],
        ["Anthropic key",      qr/$lb(sk-ant-[A-Za-z0-9_-]{20,})/],
        ["OpenAI key",         qr/$lb(sk-(?!ant-)[A-Za-z0-9_-]{20,})/],
        ["Slack token",        qr/$lb(xox[baprs]-[A-Za-z0-9-]{10,})/],
        ["Google API key",     qr/$lb(AIza[0-9A-Za-z_-]{35})/],
        ["Google OAuth token", qr/$lb(ya29\.[0-9A-Za-z_-]{20,})/],
        ["Hugging Face token", qr/$lb(hf_[A-Za-z0-9]{20,})/],
        ["npm token",          qr/$lb(npm_[A-Za-z0-9]{30,})/],
        ["Stripe key",         qr/$lb((?:sk|pk|rk)_live_[A-Za-z0-9]{20,})/],
        ["DigitalOcean token", qr/$lb(dop_v1_[A-Za-z0-9]{32,})/],
        ["Shopify token",      qr/$lb(shpat_[A-Za-z0-9]{32,})/],
        ["Miadi person token", qr/$lb(mwt_[A-Za-z0-9_-]{32,})/],
        ["Miadi reader token", qr/$lb(mr_[A-Za-z0-9]{32,})/],
        ["JWT",                qr/$lb(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})/],
    );
    my %seen;
    for my $s (@shapes) {
        my ($kind, $re) = @$s;
        while ($text =~ /$re/g) {
            my $v = $1;
            next if $seen{$v}++ || $is_held->($v) || fixture($v);
            print "shaped\t$kind\t" . prefix($v) . "\n";
        }
    }
    # A password in a URL: named by the URL up to its user, never by any of the password.
    while ($text =~ m{\b([A-Za-z][A-Za-z0-9+.-]*://[^\s/:@"\x27<>]*:)([^\s@/"\x27<>]{3,})@}g) {
        my ($head, $v) = ($1, $2);
        next if $seen{$v}++ || length($v) < 10 || $v =~ /[\$\{\}]/ || $is_held->($v) || fixture($v);
        print "shaped\tURL password\t$head***\n";
    }
    # A private key block with a body the length of a real key.
    while ($text =~ /-----BEGIN ([A-Z ]*)PRIVATE KEY-----(.*?)-----END [A-Z ]*PRIVATE KEY-----/gs) {
        my ($type, $body) = ($1, $2);
        (my $b64 = $body) =~ s/[^A-Za-z0-9+\/=]//g;
        next if length($b64) < 100 || $is_held->($body) || fixture($b64);
        print "shaped\t${type}private key\t-----BEGIN ${type}PRIVATE KEY-----***\n";
    }
    while ($text =~ /(PuTTY-User-Key-File-[0-9])/g) {
        next if $seen{$1}++;
        print "shaped\tPuTTY private key\t$1***\n";
    }
')
[ -n "$findings" ] || exit 0

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/claude_hooks/lib.sh"

held=$(printf '%s\n' "$findings" | awk -F'\t' '$1 == "held" { print $2 }')
shaped=$(printf '%s\n' "$findings" | awk -F'\t' '$1 == "shaped" { print $2 "\t" $3 }')

session_id=$(printf '%s' "$input" | jq -r '.session_id // "unknown"')
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // "a tool"')
out="$CLAUDE_SESSIONDATA_ROOT/$session_id"
ledger="$out/_claude_secret_exposures.jsonl"
mkdir -p "$out"

told=$(jq -r '.held[]?, (.shaped[]? | .kind + "\t" + .prefix)' "$ledger" 2>/dev/null)
claude_write_jsonl "$ledger" "$(jq -nc \
    --arg at "$(date -Iseconds)" --arg sid "$session_id" --arg tool "$tool_name" \
    --arg use "$(printf '%s' "$input" | jq -r '.tool_use_id // empty')" \
    --arg transcript "$(printf '%s' "$input" | jq -r '.transcript_path // empty')" \
    --arg held "$held" --arg shaped "$shaped" \
    '{at:$at, session_id:$sid, tool_name:$tool, tool_use_id:$use, transcript_path:$transcript,
      held:($held | split("\n") | map(select(. != ""))),
      shaped:($shaped | split("\n") | map(select(. != "") | split("\t") | {kind:.[0], prefix:.[1]})),
      where:["the model context","Claude Code transcript_path"],
      action:(if $held != "" then "rotate" else "check" end)}')"

# Told once per session. The ledger above keeps every call.
fresh=$(printf '%s\n' "$findings" | TOLD="$told" awk -F'\t' '
    BEGIN { n = split(ENVIRON["TOLD"], a, "\n"); for (i = 1; i <= n; i++) told[a[i]] = 1 }
    !(($1 == "held" ? $2 : $2 "\t" $3) in told)')
[ -n "$fresh" ] || exit 0

names=$(printf '%s\n' "$fresh" | awk -F'\t' '$1 == "held" { printf "%s$%s (%s)", (n++ ? ", " : ""), $2, $3 }')
shapes=$(printf '%s\n' "$fresh" | awk -F'\t' '$1 == "shaped" && n < 3 { printf "%s%s %s", (n++ ? ", " : ""), $2, $3 }')

jq -nc --arg tool "$tool_name" --arg names "$names" --arg shapes "$shapes" --arg scrub "$HERE/../scripts/miadi-scrub-secrets.py" '
  (if $names != "" then
     $tool + " printed " + $names + ", held on this host. Mask the local copies: miadi-scrub-secrets.py --apply."
     + (if $shapes != "" then " Also a string shaped like a credential (" + $shapes + "): check it." else "" end)
   else
     $tool + " printed a string shaped like a credential (" + $shapes + ") that this host does not hold: check which before rotating."
   end) as $msg |
  {systemMessage: $msg,
   hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext:
     ($msg + " The person has seen this. Do not repeat or reuse the value, and print no more secrets: refer to variables by name, never by expansion. The script is " + $scrub + ".")}}'
exit 0
