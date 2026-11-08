# miadi-chronicle-episode-kit — Hermes 0.1.0

Native Chronicle practice and policy for Hermes >=0.23.0. Related issues:
jgwill/miadi-orchestration-kit#41, #64, #103. Requires this kit checkout and the
existing `miadi` bridge for API commands. No bridge source is copied or modified.

## Features

- Registers the canonical `skills/chronicle-episode/SKILL.md` and
  `skills/production-context-exploration/SKILL.md` directly, read-only.
- Registers the Claude kit's canonical `screenwalk-names` skill and its sibling
  naming script, without a second prose or script copy.
- A native pre_tool_call guard refuses a **new direct child** of the Chronicle
  root through mkdir/install/redirection and Hermes write_file/patch paths.
  Work inside existing vessels remains allowed; an unset root disables the
  guard, matching the Claude contract. It parses text, never runs the command.
- A native transform_llm_output hook preserves the complete answer and appends
  missing `miadi-chronicle://` / `miadi-circle://` addresses. `hold_stream=True`
  keeps the visible answer consistent with the persisted final answer. This
  deliberately avoids Claude's Stop/re-inference/full-reply resend workaround.
- `/episode-status <exact-ref>` dispatches the existing `miadi_api` tool with a
  GET for the API's five-stage proof. A path or URL is refused, not normalized.
- `/mint-episode <JSON>` previews a mint (`dryRun:true`, `land:false` regardless
  of supplied values). `--apply <JSON>` is explicit authorization for the real
  call and requires an explicit positive number to prevent duplicate births on
  retries. After a successful real call, it reads that exact numbered target
  back and returns the verification separately. A write receipt alone is not proof.

Example input for a preview (this README does not mint an episode):

    /mint-episode {"title":"A chosen outcome","goal":"What should exist","references":["owner/repo#N"]}

For apply, preview/check a number first, add `"number":N`, and use `--apply`.
Actual API defaults can register, open the main circle and commit/push the vessel;
check inherited Chronicle repository rules before authorizing that operation.
The shared skill owns the procedure. No episode was minted by verification.

## Existing Miadi bridge: reuse, not duplication

The installed bridge was found at
`/usr/local/src/mightyeagle.wt/733-hermes-session-continuity/runtime/hermes-plugins/miadi`,
not the older `/usr/local/src/mightyeagle/runtime/hermes-plugins/miadi` copy.
It already supplies generic HTTP, wheel-weave registration, scoped memory,
conductor tools, Herdr routing and Tide inventory. This plugin registers **zero
new tools**, no HTTP client, no credential loader, and no MCP server.

Every native command uses ctx.dispatch_tool("miadi_api", ...). The existing
transport and token handling stay canonical in MightyEagle. Commands refuse
webhook/unknown origins; they support authenticated CLI/TUI/Desktop/ACP/Telegram.
The bridge's `miadi_api_read` allowlist does not cover Chronicle, so commands
use the authenticated full transport rather than silently broadening that allowlist.
`miadi_episode_register` posts an inquiry-weave card: it is **not** episode mint
or lineage and is never substituted for the episode API's manifest+wheel door.

Claude's three MCP servers remain optional independent surfaces, not installed
here. The canonical skill's API-first episode/lineage/attention/ceremony workflows
are available through the existing bridge. Dedicated voice MCP/TTS and raw wheel
MCP tooling are not claimed by this adapter; connect them separately with the
supported MCP installer when needed, not by editing mcp_servers manually.

## Boundaries

This mistake guard is not a shell sandbox. Arbitrary scripts, eval, computed
paths and unsupported shell constructs can evade text inspection. Internal
parse failures log the exception class and decline a policy decision, as the
Claude guard does. The native hook does not inspect secret files.

The opt-in chart-pulse Stop/commit protocol is not ported: miadi-chart-pulse is
not installed on the measured host, and Hermes has no identical Stop contract.
No dummy chart check is wired. This is a declared gap, not silent parity.

## Install and verify

`MIADI_ORCHESTRATION_KIT_ROOT` names the checkout. Installed source symlinks also
resolve it from __file__; set the variable explicitly when plugin doctor copies
an isolated package away from the repository.

    python scripts/install-hermes-kit.py --home ~/.hermes
    python scripts/install-hermes-kit.py --home ~/.hermes --apply
    hermes plugins doctor ./hermes-agent/miadi-chronicle-episode-kit --ci
    hermes plugins validate ./hermes-agent/miadi-chronicle-episode-kit
    python -m unittest discover -s hermes-agent/tests -v
    python hermes-agent/tests/smoke_features.py --live-ref 573

The installer defaults to a dry run; `--apply` alone stages disabled symlinks,
leaving config bytes intact. At a coordinated restart, first apply the legacy
observability cutover, then enable these plugins with the installer `--enable`.
Restart Hermes; no hot-swap is promised. No other profile is modified. A shared
gateway restart affects other sessions, so installation does not restart it.
