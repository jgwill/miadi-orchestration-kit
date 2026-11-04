#!/usr/bin/env bash
# PreToolUse guard for Bash, Read and Grep: a call that would print a credential is refused
# before it runs. secret_print_guard.py holds the rules. The test below keeps it to under
# 30 ms on nearly every call: python starts only when the call names something that can
# print a credential.
#
# OFF   MIADI_SECRET_PRINT_GUARD=off in the session's environment. A prefix in the command
#       text does not count.
# EXIT  0 allow, also on any internal failure. 2 refuse, the reason and the safe forms on stderr.
# TEST  bash tests/secret-print-guard.sh
[ "${MIADI_SECRET_PRINT_GUARD:-on}" = "off" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0
input=$(cat -)
shopt -s nocasematch
re='(^|[^a-z0-9_-])(env|printenv|set|export|declare|typeset)([^a-z0-9_=-]|$)|/environ|\.env|\.netrc|_netrc|\.pgpass|\.npmrc|\.pypirc|git-credentials|\.htpasswd|id_rsa|id_dsa|id_ecdsa|id_ed25519|\.pem|\.key|\.p12|\.pfx|credentials|service-account|\.tfvars|\.tfstate|kubeconfig|\.my\.cnf|\.s3cfg|wp-config|rclone\.conf|/\.aws/|/\.kube/|/\.docker/|hosts\.yml|/gcloud/|gh auth|\$\{?[a-z0-9_]*(token|secret|passw|key|credential|auth|_pat)'
[[ $input =~ $re ]] || exit 0
exec python3 -I -S "$(dirname "${BASH_SOURCE[0]}")/secret_print_guard.py" <<<"$input"
