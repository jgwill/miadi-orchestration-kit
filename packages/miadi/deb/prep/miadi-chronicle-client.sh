#!/usr/bin/env bash
# prep/miadi-chronicle-client.sh <stage>: see prep/miadi-chronicle-npm.sh. Ref: jgwill/miadi-orchestration-kit#77
exec bash "$(dirname "$0")/miadi-chronicle-npm.sh" "$1" miadi-chronicle-client
