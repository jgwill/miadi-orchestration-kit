# Termux builds

Termux cannot install the Ubuntu packages: its files live under
`/data/data/com.termux/files/usr`, not `/usr`. `build.sh` builds a Termux
variant of each package that has a directory here, from the same tree:

| file | holds |
|---|---|
| `<package>/control` | the Termux `DEBIAN/control`; `@VERSION@` takes the Ubuntu package's version |
| `<package>/postinst`, `<package>/prerm` | the Termux maintainer scripts, if any |
| `<package>/include` | the paths of the Ubuntu tree the Termux build carries |
| `<package>/prefix/` | files only the Termux build has, laid out as under the prefix (`prefix/bin/x` is `$PREFIX/bin/x`) |

A directory here with no Ubuntu package beside it is a Termux-only package:
its `control` carries its own `Version:` and it needs no `include`.
`miadi-termux` is one: the umbrella that brings the Termux packages a Miadi
phone runs, plus `miadi-terminal`.

Every carried text file has `/usr/` and `/etc/miadi` rewritten under the
Termux prefix, shebangs included. The result is `dist/termux/<package>_<version>_all.deb`.

`bash build.sh termux/<package>` builds only the Termux build. Use it on the
phone for a package whose Ubuntu build needs a prep step, such as `miadi-tide`.

On the phone, from the Miadi Termux repository below (or `apt install ./<file>.deb`):

```bash
apt install miadi-terminal
miadi-terminal enable
miadi-terminal front https://<your Miadi>
```

A tap reaches tmux only with `set -g mouse on` in `~/.tmux.conf`; `enable`
says so when it is off. Reload a running server with `tmux source-file ~/.tmux.conf`.

## The Miadi Termux repository

The Sanctuaire apt repository publishes one architecture (`amd64`), so the
Termux builds go into a flat apt repository on the phone itself
(jgwill/miadi-orchestration-kit#90). `apt-repo.sh` copies builds into it and
writes `Packages`, `Packages.gz` and `Release`:

```bash
bash build.sh miadi-termux && bash build.sh miadi-terminal
bash termux/apt-repo.sh dist/termux/*.deb      # $MIADI_TERMUX_APT_DIR, default /data/data/com.termux/files/srv/apt/miadi-termux
echo 'deb [trusted=yes] file:///data/data/com.termux/files/srv/apt/miadi-termux ./' \
  > $PREFIX/etc/apt/sources.list.d/miadi-termux.list    # once
apt update && apt install miadi-termux
```

`trusted=yes` is for a repository on the same phone, written only by its
owner. A repository served to other phones needs a signed `Release`.

Finishing a Termux package: bump its version, commit and push. On a phone
with `miadi-termux` 0.3.0 or later, `apt update` first runs
`share/miadi-termux/apt-update.sh` (from `apt.conf.d/50miadi-termux`): it
fetches the kit checkout (`MIADI_ORCHESTRATION_KIT`), builds from
`git archive origin/main` every Termux package whose version the repository
lacks, and indexes them. Then `apt upgrade` installs them. The checkout's
working tree is not touched. A Termux build of an Ubuntu package takes the
Ubuntu version, or a Termux revision of it with `Version: @VERSION@-1`, which
is how a change only the Termux build has gets a new version.

## miadi-tide

Termux has no systemd, so the Termux `miadi-tide` keeps the tide daemon in
tmux (jgwill/miadi-orchestration-kit#118):

| part | what it does |
|---|---|
| `$PREFIX/bin/tide` | runs tide from the venv `postinst` builds in `$PREFIX/lib/miadi-tide/tide-runtime`, from `share/miadi-tide/requirements.txt` on PyPI |
| `miadi-tide-service ensure` | starts the tmux session `tide-runtime` (`tide daemon --interval 60`, nice 10) and `tide-runtime-watchdog`, which starts the daemon again within a minute and prunes its store once a day |
| `miadi-tide-service status`, `restart`, `stop`, `prune` | what they say. Logs in `~/.cache/miadi-tide/` |
| `$PREFIX/share/miadi/termux-boot/50-miadi-tide.sh` | for a phone's Termux:Boot script, which runs every file in that folder |

The review loop (`tan`, `plannotator-tui`) is not in the Termux build. After
Termux's Python moves to a new minor version, rebuild the venv with
`apt install --reinstall miadi-tide`. When the Ubuntu build moves to a new
ironsilk, change `requirements.txt` with it.
