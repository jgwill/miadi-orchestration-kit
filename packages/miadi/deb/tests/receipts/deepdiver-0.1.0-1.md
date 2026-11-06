# DeepDiver 0.1.0-1 validation — kit #135 / PR #136

Validated 2026-11-06. Release/index/install receipts are recorded on
https://github.com/jgwill/miadi-orchestration-kit/issues/135 after publication;
this document records the pre-publication checks, not a claim of publication.

## Immutable inputs

- Fork: https://github.com/miadisabelle/deepdiver/commit/91898f367d519f8468943afcec356b839652a58c
- Source archive SHA256: `56e5e747b3bfef6598c238d5c0b139cdb24b170b3dbf8025ae9b8c33aeb90931`.
- Normalized fork wheel SHA256: `3e9ee42092a9f5840dedf104625fb5d85f7973dd5e8f11378ee5727a589c8ce2`.
- Dependency/browser versions and URL hashes: `prep/miadi-deepdiver.lock.json`.
- Python install is offline and private. Browser first configuration downloads
  the exact hash-checked archives directly from upstream; cached reconfiguration
  works offline. No Chrome/Widevine binaries or upstream debug captures are
  redistributed in the Debian artifacts. First configuration downloads about
  328 MB directly from upstream and retains about 1 GB including the cache.

## Tests run, all passed

| command | Ubuntu 22.04 / Python 3.10 | Ubuntu 24.04 / Python 3.12 | Debian 12 / Python 3.11 |
|---|---|---|---|
| `IMAGE=<image> bash tests/deepdiver.sh` | exit 0 | exit 0 | exit 0 |
| `IMAGE=<image> bash tests/deepdiver-claude.sh` | exit 0 | exit 0 | exit 0 |

The lifecycle matrix proves package metadata, pinned source and wheel hashes,
help/version, working private-venv console scripts, import dependency checks,
root-browser refusal, config mode 600/idempotency, explicit old-venv removal
with private recovery copies, unknown legacy launcher preservation/nonexecution,
effective project-config rejection, full and headless Chromium, forced SUID
fallback (`chrome://sandbox`: adequately sandboxed), absent/bad display,
embedded skill preservation, source `chrome launch` exit 2 and a not-ready
`chrome status` (2/3) for an anonymous profile, listener **127.0.0.1:9222**, cached browser offline
reconfiguration, reinstall, upgrade from a generated 0.0.9 fixture, remove/purge,
and preservation of config, skills, APT profile and an untouched old profile
through plain launch, interactive `init`, and `--clone-profile` launch routes.
The fixture is not represented as a previously published release.

The separate agent-driven README walkthrough has not been run as part of
these pre-publication scripts; its post-publication receipt will be on #135.

Real Claude Code marketplace tests (no model invocation or Claude sign-in) run
from a non-home project directory: existing canonical plugin and embedded fork
skill, repeated setup/doctor, personal theme/env/other-plugin preservation, and
an explicitly disabled plugin remaining disabled. Plugin hooks/plan gate:

```
node --test claude/miadi-deepdiver/scripts/plan-read.test.mjs \
  claude/miadi-deepdiver/hooks/word-gate.test.mjs
# tests 20, pass 20, fail 0
```

All three `.deb` artifacts reproduce byte-for-byte from a clean git archive
under umask 0022 versus the builder's 0007. The comparison caught and fixed
newly-created `/usr/share` parent modes in metapackages; the fork wheel is also
normalized independently of builder zip metadata.

## Artifact hashes

```
02f41ef324fb534db49bf287dbf020a84bb6d5ba4e520c629055f719faccb1aa  deepdiver_0.1.0-1_all.deb
90e1e8efc8e6f57e597e96bb019dd62f114b77b73bc2b43a7d38bbae02ee60d2  miadi-deepdiver_0.1.0-1_amd64.deb
e002dfbf5caa017d4f608924c7d7d7e86b8467ed33976cf7e30d2eeb78e0ce04  miadi-deepdiver-chromium_1.64.1-1_amd64.deb
```

## Boundaries and follow-up

- No Google sign-in or NotebookLM generation was performed. A human signs in
  once in `~/.chrome-deepdiver-apt`; the old `~/.chrome-deepdiver` is not opened
  or migrated automatically. No existing-account compatibility claim.
- Tests use disposable supported-distribution containers. No real Ubuntu 24.04
  AppArmor VM was available. Forced SUID fallback was exercised rather than
  disabling a host security setting; Docker fixture capabilities are documented.
- Independent Claude Opus review blocked the first candidate; fixes remove
  redistribution/privacy risks and correct sandbox, plugin, dependency,
  effective-config and legacy-install behaviour. Detailed security analysis
  remains local, not in this public receipt.
- Factory home/Wall, relative association and permissioned agent interaction
  are deferred by Guillaume to https://github.com/jgwill/Miadi/issues/941,
  assigned to `jgwill` and `avadisabelle`. No Factory app change ships here.
