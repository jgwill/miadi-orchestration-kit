# Termux builds

Termux cannot install the Ubuntu packages: its files live under
`/data/data/com.termux/files/usr`, not `/usr`. `build.sh` builds a Termux
variant of each package that has a directory here, from the same tree:

| file | holds |
|---|---|
| `<package>/control` | the Termux `DEBIAN/control`; `@VERSION@` takes the Ubuntu package's version |
| `<package>/postinst` | the Termux maintainer script, if any |
| `<package>/include` | the paths of the Ubuntu tree the Termux build carries |

Every carried text file has `/usr/` and `/etc/miadi` rewritten under the
Termux prefix, shebangs included. The result is `dist/termux/<package>_<version>_all.deb`.

On the phone:

```bash
apt install ./miadi-terminal_<version>_all.deb
miadi-terminal enable
miadi-terminal front https://<your Miadi>
```

A tap reaches tmux only with `set -g mouse on` in `~/.tmux.conf`; `enable`
says so when it is off. Reload a running server with `tmux source-file ~/.tmux.conf`.

The Sanctuaire apt repository publishes one architecture (`amd64`), so the
Termux build is installed from the file for now.
