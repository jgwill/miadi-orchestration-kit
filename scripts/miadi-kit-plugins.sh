# shellcheck shell=bash
# Source this file to get `miadi-kit` from this checkout: one command that updates the
# kit's plugins in every harness this account uses (Claude Code, Codex, Copilot CLI,
# Gemini CLI, Pi). An apt host has the same command from the miadi-kit package.
#
#   source /workspace/repos/jgwill/miadi-orchestration-kit/scripts/miadi-kit-plugins.sh
#   miadi-kit update                          # update every installed kit plugin
#   miadi-kit update --check                  # say what would move, change nothing
#   miadi-kit update --harness claude,codex   # only these harnesses
#   miadi-kit-update                          # the same as miadi-kit update
#
# Put the `source` line in ~/.bashrc to have it in every shell. The command itself is
# packages/miadi/deb/miadi-kit/usr/bin/miadi-kit: `miadi-kit update --help` says the rest.

_MIADI_KIT_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/packages/miadi/deb/miadi-kit/usr/bin/miadi-kit"

miadi-kit() { python3 "$_MIADI_KIT_BIN" "$@"; }
miadi-kit-update() { miadi-kit update "$@"; }
