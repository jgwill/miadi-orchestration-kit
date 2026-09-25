# miadi (apt packages)

`sudo apt install miadi` sets up a Miadi host. `miadi` is the umbrella
package: each part of a host is its own package and joins it as a dependency.
On a new system, add the repository first:

```bash
curl -fsSL https://apt.sanctuaireagentique.com/sanctuaire-agentique.gpg \
  | sudo tee /usr/share/keyrings/sanctuaire-agentique.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/sanctuaire-agentique.gpg] https://apt.sanctuaireagentique.com stable main" \
  | sudo tee /etc/apt/sources.list.d/sanctuaire-agentique.list
sudo apt update && sudo apt install miadi
```

| package | gives the host | since |
|---|---|---|
| `miadi` | its dependencies (through 0.1.x it held the settings itself) | 0.1.0 |
| `miadi-config` | the `MIADI_*` settings and the `miadi-config` command | 0.2.0 |
| `miadi-terminal` | a client's clickable `miadi-chronicle:` references: desktop, Terminator, tmux | 0.1.0 |
| `miadi-tide` | the review loop (`tan`, `plannotator-tui`) and the tide runtime (`tide`, its daemon) | 0.1.0 |

Each package is a directory here holding its `DEBIAN/control` and the files it
installs. The packages are MIT-licensed (`LICENSE`, as in jgwill/Miadi), and
`build.sh` writes each one's `/usr/share/doc/<package>/copyright` from it.

## miadi-config

| file | holds | on upgrade |
|---|---|---|
| `/etc/miadi/miadi.env` | this host's values, plain `KEY=VALUE` | conffile: an edited copy is kept |
| `/usr/share/miadi/env.sh` | the defaults and how each value is built | replaced |
| `/usr/share/miadi/settings` | every known setting and what it does | replaced |
| `/etc/profile.d/miadi.sh` | loads `env.sh` into bash login shells | conffile |
| `/usr/bin/miadi-config` | the command below | replaced |

A value in the environment wins over `miadi.env`, which wins over the defaults.
`env.sh` prints nothing and loads under `set -u`. Sourced a second time in the
same shell, as binscripts `load.sh` does after `~/.env`, it rebuilds the values
it filled in the first time from the new inputs and keeps any value changed in
between. Because `miadi.env` is plain
`KEY=VALUE`, systemd `EnvironmentFile=` and docker compose `env_file` read it
too. It holds no secrets: a user's tokens stay in that user's `~/.env`, a
service's in its own env file.

```bash
miadi-config                              # every setting, its value, and its source: env, miadi.env, default, unset
miadi-config get MIADI_DATA_DIR           # one resolved value, for scripts
sudo miadi-config set MIADI_SRC /a/src/Miadi
sudo miadi-config unset MIADI_SRC
miadi-config check                        # what this host is missing
miadi-config settings                     # what each setting does
```

`miadi.env` stays the same file from 0.1.x on. A host that edited it keeps its
edits through the upgrade without a prompt.

Termux cannot install Ubuntu packages. There, set `MIADI_ETC` and source
`miadi-config/usr/share/miadi/env.sh` from this checkout.

## miadi-terminal

For a machine that reads chronicle references, not one that serves them. A
click turns `miadi-chronicle:126` into `<front>/api/chronicle/open?uri=…` and the
Miadi server redirects to the room, so nothing is resolved here.

```bash
sudo apt install miadi-terminal
miadi-terminal front https://<your Miadi>   # when MIADI_URL_BASE is not already it
miadi-terminal enable                       # per user; or: enable desktop terminator tmux
miadi-terminal status
```

| integration | a click is | file |
|---|---|---|
| `desktop` | an OSC 8 link or a page link carrying `miadi-chronicle:` | `/usr/share/applications/miadi-chronicle-open.desktop` |
| `terminator` | Ctrl+click a bare reference | `/usr/share/miadi-terminal/terminator/`, linked into Terminator's plugin directory |
| `tmux` | click, or tap on Termux, a bare reference in a pane | `/usr/share/miadi-terminal/tmux/miadi-chronicle.conf` |

The package installs system-wide; its maintainer scripts write nothing into a
home directory. `enable`, run by the user, changes that user's Terminator
`enabled_plugins`, adds one line to their tmux config, and sets the scheme
default in `~/.config/mimeapps.list`. Each config it changes keeps a
`.bak-miadi-terminal` copy of how it was before the first change. The plugin
and wrapper an earlier `inquiry-weave terminal install` left are moved to
`~/.local/share/miadi-terminal/legacy/`; its environment drop-in stays, since
the session may read its values. The front is `MIADI_CHRONICLE_OPEN_URL`, else `MIADI_URL_BASE`.
A Termux build of the same tree is made by `build.sh` (`termux/README.md`).
Contract: jgwill/Miadi `rispecs/miadi-chronicle-dsl/SPEC-TERMINAL.md` §3.

## miadi-tide

The terminal half of Miadi's review loop and the tide runtime, as one
`amd64` package. It is built from sources pinned in other repositories and is
neither an npm nor a PyPI release (jgwill/miadi-orchestration-kit#55).

| installed | what it is | client or server |
|---|---|---|
| `/usr/bin/tan <target>` | review the last reply of the agent in a tmux pane, deliver on submit | client |
| `/usr/bin/plannotator-tmux-review` | the loop itself; the script and its pane-write guard sit in `/usr/lib/miadi-tide/` | client |
| `/usr/bin/plannotator-tui` | the annotator, built from `miadisabelle/mia-plannotator-tui` at jgwill/Miadi's `runtime/plannotator-tui` pin | client |
| `/usr/bin/tide` | the tide CLI, from the runtime venv | client |
| `/usr/share/miadi-tide/node/@miadi/{tide,tide-contract}` | the Node client, as `pnpm pack` would publish it | client |
| `/usr/lib/systemd/user/tide-runtime.service` | `tide daemon --interval 60`, the context daemon the cockpit reads through `$MIADI_HOME/daemon.sock` | server |
| `/usr/lib/systemd/user/tide-store-prune.{service,timer}` | keeps the daemon's snapshot store to 7 days | server |
| `/usr/share/miadi-tide/SOURCE` | the repository and commit each part was built from | |

The tide runtime (`ironsilk`) runs in its own venv, `/usr/lib/miadi-tide/tide-runtime`,
which `postinst` builds from the wheels in the package with `--no-index`. Its
dependencies are pinned in `prep/miadi-tide.constraints.txt`, and it reads nothing
from system site-packages or a user's conda. It needs a Python 3.11 or newer with
`venv`. That is `python3-venv` on Ubuntu 24.04. On 22.04, add the deadsnakes PPA
first so apt can install `python3.12-venv`:

```bash
sudo add-apt-repository -y ppa:deadsnakes/ppa && sudo apt update
sudo apt install miadi-tide
```

The daemon observes one user's tmux, so it is a user unit that each user turns on.
Its name is the one `ironsilk`'s `tide service install` writes, so a user's own
`~/.config/systemd/user/tide-runtime.service` replaces it instead of running
beside it:

```bash
systemctl --user enable --now tide-runtime.service tide-store-prune.timer
```

`build.sh` runs `prep/miadi-tide.sh` to add what git does not keep: the binary
(rustup's cargo), the wheels (`pip`), and the packed Node sources (`pnpm`). It reads
`MIADI_SRC` (default `/a/src/Miadi`), `GAIA_SRC` (`/a/src/gaia`, for the review
script) and `PANE_WRITE_GUARD_SRC`, and caches builds under `MIADI_DEB_CACHE`
(`~/.cache/miadi-deb`).

## Build, test, install

```bash
bash build.sh                               # -> dist/<package>_<version>_<arch>.deb for each package
bash build.sh miadi-tide                    # one package
bash test-install.sh dist/*_<version>_*.deb     # clean ubuntu:22.04 container
IMAGE=ubuntu:24.04 bash test-install.sh dist/miadi-tide_<version>_amd64.deb
python3 tests/tmux-click.py miadi-terminal/usr/share/miadi-terminal/tmux/miadi-chronicle.conf miadi-terminal/usr/bin/miadi-chronicle-open
sudo apt install ./dist/*_<version>_all.deb
```

The host-level check is `runtime/miadi-host` in miadisabelle/workspace. It
installs through apt with the published repository beside the kit's build,
covers the upgrade from the published version, and opens a shell in a clean
host (`shell.sh`).

Publishing to `apt.sanctuaireagentique.com` uses `scripts/apt-publish.sh` from
miadisabelle/mia-parallel-code, which needs the repository's signing key and
`APT_PUBLISH_TOKEN`. It takes one `.deb` per run. Bump `Version:` in each
`DEBIAN/control`, build, and publish the dependencies before `miadi`, so the
index never lists a `miadi` whose dependency is missing:

```bash
publish=/workspace/repos/miadisabelle/mia-parallel-code/scripts/apt-publish.sh
bash "$publish" dist/miadi-config_<version>_all.deb
bash "$publish" dist/miadi_<version>_all.deb
bash "$publish" dist/miadi-terminal_<version>_all.deb   # after the miadi-config it depends on
bash "$publish" dist/miadi-tide_<version>_amd64.deb     # before the miadi that depends on it
```

The repository publishes `amd64` only, so the Termux build in `dist/termux/`
is installed from the file.

The Miadi umbrella packages (`packages/miadi/js`, `packages/miadi/py` in
jgwill/Miadi) can join here later.
