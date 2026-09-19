# miadi (apt package)

`sudo apt install miadi` gives a host its `MIADI_*` environment.

| file | holds | in the package |
|---|---|---|
| `/usr/share/miadi/env.sh` | the defaults and how each value is built | replaced on upgrade |
| `/etc/miadi/miadi.env` | this host's values, plain `KEY=VALUE` | conffile: an edited copy is kept on upgrade |

A shell sources `env.sh` (binscripts `load.sh` does). A value already in the
environment wins over `miadi.env`, which wins over the defaults. `miadi.env`
holds no secrets: a user's client tokens stay in that user's `~/.env`.
Because `miadi.env` is plain `KEY=VALUE`, systemd `EnvironmentFile=` and
docker compose `env_file` can read it too.

Termux cannot install Ubuntu packages. There, set `MIADI_ETC` and source
`root/usr/share/miadi/env.sh` from this checkout.

## Build, test, install

```bash
bash build.sh                                   # -> dist/miadi_<version>_all.deb
bash test-install.sh dist/miadi_<version>_all.deb   # clean ubuntu:22.04 container
sudo apt install ./dist/miadi_<version>_all.deb
```

Publishing to `apt.sanctuaireagentique.com` uses `scripts/apt-publish.sh` from
miadisabelle/mia-parallel-code, which needs the repository's signing key and
`APT_PUBLISH_TOKEN`.

This directory sits where the Miadi umbrella packages (`packages/miadi/js`,
`packages/miadi/py` in jgwill/Miadi) can join it later.
