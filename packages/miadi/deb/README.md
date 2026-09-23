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

## Build, test, install

```bash
bash build.sh                               # -> dist/<package>_<version>_all.deb for each package
bash test-install.sh dist/*_<version>_all.deb   # clean ubuntu:22.04 container
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
```

The repository publishes `amd64` only, so the Termux build in `dist/termux/`
is installed from the file.

The Miadi umbrella packages (`packages/miadi/js`, `packages/miadi/py` in
jgwill/Miadi) can join here later.
