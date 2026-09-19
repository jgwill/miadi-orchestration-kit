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
`env.sh` prints nothing and loads under `set -u`. Because `miadi.env` is plain
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

## Build, test, install

```bash
bash build.sh                               # -> dist/<package>_<version>_all.deb for each package
bash test-install.sh dist/*_<version>_all.deb   # clean ubuntu:22.04 container
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
```

The Miadi umbrella packages (`packages/miadi/js`, `packages/miadi/py` in
jgwill/Miadi) can join here later.
