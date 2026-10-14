# Termux builds

Termux cannot install the Ubuntu packages: its files live under
`/data/data/com.termux/files/usr`, not `/usr`. `build.sh` builds a Termux
variant of each package that has a directory here, from the same tree:

| file | holds |
|---|---|
| `<package>/control` | the Termux `DEBIAN/control`; `@VERSION@` takes the Ubuntu package's version |
| `<package>/postinst` | the Termux maintainer script, if any |
| `<package>/include` | the paths of the Ubuntu tree the Termux build carries |

A directory here with no Ubuntu package beside it is a Termux-only package:
its `control` carries its own `Version:` and it needs no `include`.
`miadi-termux` is one: the umbrella that brings the Termux packages a Miadi
phone runs, plus `miadi-terminal`.

Every carried text file has `/usr/` and `/etc/miadi` rewritten under the
Termux prefix, shebangs included. The result is `dist/termux/<package>_<version>_all.deb`.

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

Finishing a Termux package: bump `Version:`, commit and push, build, run
`apt-repo.sh` with the new `.deb`, `apt upgrade` on the phone, and say what
was published.
