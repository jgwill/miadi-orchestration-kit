# Pi observability cutover — mia@eury, 2026-10-22

Tracking: [#99](https://github.com/jgwill/miadi-orchestration-kit/issues/99).
Package: local `@miadi/pi-session-observability` **0.1.0** from this directory.
Runtime: Pi **1.4.0**, Node **24.18.0**. No npm publication.

## Finding and account-local changes

`pi list` initially reported no packages. `/home/mia/.pi/agent/settings.json`
had neither package nor extension registrations. Nevertheless, the current
session's terminal binding showed the legacy
`/opt/binscripts/hooks/pi_hooks/event_capture.ts` passed through CLI `-e`.
The shared binscripts `mpi` alias supplied it alongside Miette.

- Applied `scripts/migrate-settings.mjs --apply` for `mia` only. Settings now
  register `/workspace/repos/jgwill/miadi-orchestration-kit/pi/miadi-session-observability`
  as a local package. Other settings were preserved; a repeat invocation
  reported already migrated.
- Added an override in `/home/mia/.bash_aliases`, after shared aliases load:

  ```sh
  export MIADI_PLUGIN_SESSION_OBSERVABILITY_PI="$MIADI_ORCHESTRATION_KIT_ROOT/pi/miadi-session-observability"
  alias mpi='pit -e "$MIADI_PI_EXTENSIONS_ROOT/miette-echo/index.ts"'
  ```

  Pi settings now supply capture; the launcher still supplies Miette and
  inherits `pit`'s thinking level. A fresh-shell argv check confirmed the legacy
  capture argument is absent and the environment points to the local package.
- Kept capture root `/src/_sessiondata`. No shared binscripts files, other
  accounts, running agents, dashboards, or forwarding services were changed.

## Activation boundary

Session `01a165de-d7e5-71d8-adf4-c8208f7727a2` continues using its original
legacy CLI extension until exit. **Do not use `/reload` to cut over this
process:** explicit CLI extension paths survive reload and would load alongside
the newly installed package, duplicating capture.

After exiting Pi, in the same project directory:

```sh
source "$HOME/.bash_aliases"  # refresh an existing parent shell's mpi alias
mpi --continue
```

A newly opened interactive shell already loads the override. Ordinary `pi`
launches also discover the package automatically. Captures made before this
restart do not retroactively gain canonical telemetry, although the package
can archive the native transcript when that session resumes.

## Validation

- All **13** package tests passed; sanitizer self-test passed.
- Isolated installed-Pi RPC smoke passed with explicit package selection.
- Ordinary configured-account RPC startup, **without** capture `-e` and without
  `--no-extensions`, discovered the installed package automatically. Both the
  canonical and compatibility streams contained exactly one start and one
  shutdown; canonical sequences were `0, 1`. Two terminal bindings retained the
  agent PID, the writer lock was released, and package-owned directory/file
  permissions were `0700`/`0600`.
- The ordinary smoke initially rejected Pi's expected new-session-ID warning
  as unexpected stderr. A rerun allowing exactly that warning passed; there
  were no extension or capture errors.
- Migration CLI checks passed for dry-run nonmutation, private backup, unrelated
  settings preservation, the CLI restart warning, and repeat-apply idempotence.
- Shell syntax and fresh-shell launcher argv checks passed. Smoke captures and
  native sessions were confined to temporary directories and removed. No
  model/API requests were made by these smoke checks.

## Private backups / rollback

Backups remain on this host, not in Git:

- `/home/mia/.pi/agent/settings.json.before-miadi-pi-observability-1792710615428`
- `/home/mia/.bash_aliases.before-miadi-pi-observability-20261022T231015Z`

Both backups are mode `0600`. To roll back, exit the affected Pi process,
restore both files, refresh the parent shell's aliases, and restart. Restore
both settings and launcher together: restoring only the legacy launcher while
the package remains configured would cause duplicate capture. The legacy
scripts and existing session data were not deleted.
