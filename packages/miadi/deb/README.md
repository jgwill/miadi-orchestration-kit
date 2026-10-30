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

`miadi` brings `miadi-tide`, whose tide runtime needs Python 3.11 or newer with
`venv`. Ubuntu 24.04 has it. On 22.04, add the deadsnakes PPA before installing
(see [miadi-tide](#miadi-tide)).

| package | gives the host | since |
|---|---|---|
| `miadi` | its dependencies (through 0.1.x it held the settings itself) | 0.1.0 |
| `miadi-config` | the `MIADI_*` settings and the `miadi-config` command | 0.2.0 |
| `miadi-tmux` | `/usr/bin/tmux` 3.7c built from the upstream release, replacing the distribution's tmux (3.2a on 22.04): one tmux version on a host, since a client cannot attach to a server of another version | 3.7c-1 |
| `miadi-terminal` | a client's clickable `miadi-chronicle:`, `miadi-ceremony:`, `miadi-circle:`, `miadi-foundation:` (0.2.2), `miadi-notebook:`, `miadi-prototype:`, `miadi-tracing:` and `rise://` (0.4.0) references, and bare circle ids (0.1.4): desktop, Terminator, tmux; the tmux settings every user starts with, `/etc/miadi/tmux.conf` (0.3.0; `miadi` depends on it since 0.5.0) | 0.1.0 |
| `miadi-tide` | the review loop (`tan`, `plannotator-tui`) and the tide runtime (`tide`, its daemon) | 0.1.0 |
| `miadi-perms` | group read and write on the shared session capture (`MIADI_SESSIONDATA_ROOT`), every 4 hours, so one user's agent hooks can write where another user's session created files | 0.1.0 |
| `miadi-node` | Node.js 24 LTS at `/usr/lib/miadi-node`, private to the two below: nothing on `PATH`, no npm | 24.21.0-1 |
| `miadi-chronicle-client` | the chronicle's commands and MCP servers from pinned npm releases: `inquiry-weave`, `inquiry-weave-mcp`, `passages`, `mkepisode`, `miadi-voice-mcp`, `medicine-wheel-mcp` | 0.1.0 |
| `miadi-chronicle-server` | the chronicle's host services: `miadi-capture-service` (a per-user unit, not started), `miadi-episode-capture`, `miadi-transcription`, `miadi-hooks`, `miadi-hooks-interpret`, `plan-insight-register` (`miadi` depends on it since 0.4.0) | 0.1.0 |
| `miadi-music` | music on the host, for an album or an episode's score: brings the three below and the `miadi-music` command | 0.1.0 |
| `miadi-music-render` | ABC to MIDI, audio and the engraved page: abcmidi, abcm2ps, fluidsynth with the FluidR3 soundfont, ffmpeg | 0.1.0 |
| `miadi-music-measure` | NumPy, SciPy and Pillow, pinned, in their own venv, built from one of the three below | 0.1.0 |
| `miadi-music-wheels-cp310`, `-cp311`, `-cp312` | the wheels for that venv, one package per Python (Ubuntu 22.04, Debian 12, Ubuntu 24.04); apt installs the one matching `python3` | 0.1.0 |
| `miadi-music-video` | score videos for an episode: ImageMagick and ffmpeg beside the two above (recommended by `miadi-music`) | 0.1.0 |
| `miadi-feedback` | for a maintainer's host: an issue opened with one of the kit's forms wakes a seat that ships a minor fix, answers a question, or brings the rest to a maintainer | 0.1.0 |

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
| `/usr/bin/miadi-hermes-tailnet` | opt-in Kherix/Laskmi API provisioning | replaced |
| `/usr/share/miadi/hermes-tailnet/` | repeatable installer, publisher and runbook | replaced |
| `/usr/bin/miadi-mirror-monitor` | opt-in, lid-aware X11 monitor reconciliation | replaced |

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
miadi-config report                       # what to paste into an issue: versions, sources, check, units (0.2.8)
miadi-config report --url install         # the same, as a link to the issue form, filled in (or music, question)
```

`miadi.env` stays the same file from 0.1.x on. A host that edited it keeps its
edits through the upgrade without a prompt.

Termux cannot install Ubuntu packages. There, set `MIADI_ETC` and source
`miadi-config/usr/share/miadi/env.sh` from this checkout.

### Optional Hermes tailnet APIs (0.2.5)

After restoring Hermes's default and `laskmi` profiles and connecting/tagging
Tailscale, run `miadi-hermes-tailnet` as the Hermes account. It uses the existing
`TAILSCALE_API_TOKEN` from `~/.env` to publish and approve Kherix (`:8643`) and
Laskmi (`:8646`), preserving the supported shared gateway and distinct profile
keys. It installs only `apache2-bin` if the loopback proxy needs it; no default
Apache server. Package installation alone publishes nothing.

`miadi-hermes-tailnet --verify --chat-smoke` checks both HTTPS completion
endpoints, bearer-key isolation and streaming. Keys stay in the private Hermes
`.env` files, never this package. The adjacent runbook covers reinstallation,
boot ownership and overrides. Copies track Gaia's `linux_migration/` installer;
run `bash tests/hermes-tailnet-sync.sh` after changing either copy.

### Optional X11 monitor mirror (0.2.7)

On an X11/KDE laptop, run `miadi-mirror-monitor --install-autostart` as the
**desktop user** (needs `x11-xserver-utils` and a systemd user manager). It
installs that user's `mirror-monitor.timer` and KDE autostart; package
installation alone changes no display or home directory. For 5 minutes after
each login (`MIRROR_CHECK_WINDOW`, seconds), every 10 seconds, `--ensure`
checks the layout and only applies a modeset when it is wrong:

- Lid open: both outputs use the external's native resolution at the same
  origin, falling back to the highest common mode. The external refresh is
  capped at 144 Hz (override: `MIRROR_EXTERNAL_MAX_HZ` in a service drop-in).
- Lid closed: the external alone stays at that resolution, as the primary.
- External disconnected: restore the internal panel's native mode when open.
- Late monitor detection, failed modesets and KScreen overrides are retried
  until the window ends. Each check runs `xrandr --query` 5 times and each
  probe holds the X server ~0.27 s, so checking indefinitely made the cursor
  lag (0.2.7). A monitor plugged in or turned on later needs `--apply`.

KDE login refreshes the user manager's actual `DISPLAY`/`XAUTHORITY`; no `:0`
is hardcoded. `systemctl --user status mirror-monitor.timer` checks it,
`journalctl --user -t mirror-monitor` shows changes/errors, and
`miadi-mirror-monitor --uninstall-autostart` removes the automation (for
example, before choosing an extended desktop). `--apply` is a one-time repair.
Copies track Gaia's `linux_migration/66-mirror-monitor.sh`; run
`bash tests/mirror-monitor-sync.sh` after editing either side (jgwill/gaia#71,
jgwill/miadi-orchestration-kit#102).

## miadi-terminal

For a machine that reads chronicle references, not one that serves them. A
click turns `miadi-chronicle:126` into `<front>/api/chronicle/open?uri=…` and the
Miadi server redirects to the room, so nothing is resolved here. A ceremony or
circle reference opens its page the same way: `miadi-circle:<id>`,
`miadi-ceremony:<id>`, or the bare wheel id `circle:1790787727155:2slscw`
(jgwill/Miadi `rispecs/miadi-chronicle-dsl/SPEC.md` §9).

```bash
sudo apt install miadi-terminal
miadi-terminal front https://<your Miadi>   # when MIADI_URL_BASE is not already it
miadi-terminal enable                       # per user; or: enable desktop terminator tmux defaults
miadi-terminal status
```

| integration | a click is | file |
|---|---|---|
| `desktop` | an OSC 8 link or a page link carrying `miadi-chronicle:`, `miadi-ceremony:`, `miadi-circle:`, `miadi-foundation:`, `miadi-notebook:`, `miadi-prototype:`, `miadi-tracing:` (`miadi-trace:`, `miadi-prompt:`) or `rise:` | `/usr/share/applications/miadi-chronicle-open.desktop` |
| `terminator` | Ctrl+click a bare reference | `/usr/share/miadi-terminal/terminator/`, linked into Terminator's plugin directory |
| `tmux` | click, or tap on Termux, a bare reference in a pane | `/usr/share/miadi-terminal/tmux/miadi-chronicle.conf` |
| `defaults` (0.3.0) | the tmux settings every user starts with: `/etc/tmux.conf` reads `/etc/miadi/tmux.conf`; enabling comments out the lines of the user's config that repeat it | `/etc/tmux.conf`, `/etc/miadi/tmux.conf` |
| `restore` (0.2.0, by name only) | tmux starts at boot, restores its sessions, and tide brings the agents back | `/usr/share/miadi-terminal/session-continuity/`, `/usr/lib/systemd/user/tmux-server.service`, `tmux-save.timer` |

The package installs system-wide; its maintainer scripts write nothing into a
home directory. `enable`, run by the user, changes that user's Terminator
`enabled_plugins`, adds one line to their tmux config, and sets the scheme
default in `~/.config/mimeapps.list`. Each config it changes keeps a
`.bak-miadi-terminal` copy of how it was before the first change. The plugin
and wrapper an earlier `inquiry-weave terminal install` left are moved to
`~/.local/share/miadi-terminal/legacy/`; its environment drop-in stays, since
the session may read its values. `status` names each key that drop-in still
sets over `/etc/miadi/miadi.env`, with both values, and says nothing when it
overrides none. The front is `MIADI_CHRONICLE_OPEN_URL`, else `MIADI_URL_BASE`.
A Termux build of the same tree is made by `build.sh` (`termux/README.md`).
Contract: jgwill/Miadi `rispecs/miadi-chronicle-dsl/SPEC-TERMINAL.md` §3.

### tmux settings for every user

Every tmux reads `/etc/tmux.conf` before the user's `~/.tmux.conf`, so a line
a user writes there wins. `miadi-terminal` installs both files as conffiles:

| file | holds | change it |
|---|---|---|
| `/etc/tmux.conf` | one line, `source-file -q /etc/miadi/tmux.conf`, and room for the host's own settings | never in the package: as long as it stays the same, dpkg asks at most once, on a host that already had its own `/etc/tmux.conf` |
| `/etc/miadi/tmux.conf` | the settings mia, jgi and ava each kept on gaia: extended keys, focus events, `tmux-256color` with 24-bit colour, the mouse on, 50,000 lines of history, the wheel scrolling tmux's scrollback | here, with a version bump; an unedited copy is replaced on upgrade, an edited one makes dpkg ask |

`status-left-length` stays with each user (ava 50, mia and jgi 100), and the
plugin lines stay with `enable restore`. `miadi-terminal enable defaults`
comments out each line of the user's config that repeats one of
`/etc/miadi/tmux.conf`, marked `# in /etc/miadi/tmux.conf: `, after a
`.bak-miadi-terminal` copy; `disable defaults` puts them back. A running
server reads the settings with `tmux source-file /etc/tmux.conf`.

## A user on a Miadi host

The steps an administrator runs for one more account (group, linger,
`miadi-terminal enable`, restore, the user units) are in `miadi`'s
`/usr/share/doc/miadi/README`. Creating the accounts `mia`, `ava` and
`tushell` on a new host, each for its own purpose, is
jgwill/miadi-orchestration-kit#79.

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

Since 0.1.11, the review loop, Codex/Pi session resolver and pane guard come
from `jgwill/Miadi/packages/tide/scripts`. The native annotator is built at
Miadi's `runtime/plannotator-tui` gitlink. Build and runtime require no Gaia
`linux_migration` checkout. The same backend serves `/tide` and
`@miadi/chronicle-tui` through `/api/tide/annotate/*`.

Each user's replies and marks live in `$MIADI_TIDE_DIR/reviews/<user>/` and
`$MIADI_TIDE_DIR/annotations/<user>/` (`MIADI_TIDE_DIR` defaults to
`$MIADI_DATA_DIR/tide`), so the host's data backup carries them. `miadi-config`'s
`env.sh` sets `PLANNOTATOR_TMUX_REVIEW_DIR` and `PLANNOTATOR_DATA_DIR` from it in
login shells; a service such as the Miadi app sets the same two in its unit.
`postinst` creates both parents, sticky and writable by every user, since a tmux
pane id names a pane in one user's server only (jgwill/miadi-orchestration-kit#96).

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

To check it, as the user who enabled it:

```bash
systemctl --user status tide-runtime.service   # Active: active (running)
tide doctor --require-daemon --strict          # last line: READY package=<ironsilk version>
```

`tide doctor` prints one row per check, then `READY` or `BLOCKED`. With
`--require-daemon`, `daemon_ping` must answer on the daemon socket,
`~/.miadi/navigator/daemon.sock`: the unit sets `MIADI_HOME=%h/.miadi/navigator`,
and a login shell leaves `MIADI_HOME` unset. `--strict` makes `BLOCKED` exit 1.
Two rows read `warn` on a fresh package install and do not block: `user_service`
looks for the file `tide service install` writes in `~/.config/systemd/user/`,
not the packaged unit, and `domains_config` waits for `tide init`.
`miadi-config check` is a different check: it covers this host's `MIADI_*`
settings and directories, not the runtime.

`build.sh` runs `prep/miadi-tide.sh` to add what git does not keep: the binary
(rustup's cargo), the wheels (`pip`), and the packed Node sources (`pnpm`). It reads
`MIADI_SRC` (default `/a/src/Miadi`), `GAIA_SRC` (`/a/src/gaia`, for the review
script) and `PANE_WRITE_GUARD_SRC`, and caches builds under `MIADI_DEB_CACHE`
(`~/.cache/miadi-deb`).

## miadi-feedback

A person trying these packages reports through one of the kit's issue forms
(installation, music, question). `miadi-config report --url <form>` opens it with
their host's facts filled in. On the maintainer's host, `miadi-feedback` reads the
open issues of each channel every 5 minutes and starts one seat per new issue
(jgwill/miadi-orchestration-kit#109):

```bash
sudo apt install miadi-feedback
miadi-feedback enable              # per user, from the shell where agents start
miadi-feedback poll --dry-run      # what the next run would start
miadi-feedback status              # channels, the timer, live seats, the last decisions
miadi-feedback trust <login>       # a tester whose minor reports a seat may fix and ship
miadi-feedback release <o/r#n> "<why>"   # give back an issue a seat should not have taken
```

| file | holds |
|---|---|
| `/etc/miadi/feedback.d/<channel>.conf` | the repository, the form's label, `SINCE` and `EXPIRES`, the seat's team, folder, brief and models (conffile; a user's file of the same name under `~/.config/miadi/feedback.d/` is read after it) |
| `/usr/share/miadi-feedback/briefs/` | what a seat does: `install.md` (installation and music), `question.md` |
| `/usr/lib/systemd/user/miadi-feedback.timer` | every 5 minutes, off until `enable` |
| `~/.local/state/miadi-feedback/decisions.jsonl` | each seat started and each decision |

A seat is a tmux session started with `mct new`, so tide and tmux restore
bring it back after a reboot, and the timer comes back with the user manager
(linger). Its model is the channel model nearest to what Episode 564's worker
chooser (Jev, `claude/miadi-witness/scripts/choose-worker.mjs`) answers. An issue
opened by the maintainers' circle (owner, members, collaborators, the poll's own
account, the logins in `/etc/miadi/feedback.d/circle`) wakes no seat. A tester listed
by `miadi-feedback trust` gets a seat that may ship a minor fix; any other author gets
a seat in plan mode, and the maintainer approves its plan. The brief says what is minor and what is a maintainer's. Every
seat ends with `miadi-feedback decide`, which sets one label: `feedback:shipped`,
`answered`, `no-change`, `waiting` or `needs-guillaume`. After `EXPIRES` a channel
posts what it handled to its tracking issue and reads nothing more. A new kind of
feedback is one more channel file and brief.

## miadi-perms

Several users' agent sessions write into one capture directory,
`MIADI_SESSIONDATA_ROOT` (`/src/_sessiondata` by default). A file one user
creates there is often not writable by the others. `miadi-perms.timer`, a
system timer enabled at install, runs `miadi-perms` as root at 00:00, 04:00,
08:00, 12:00, 16:00 and 20:00, and at the next boot when a run was missed. It
gives the group read and write on every file there that lacks it, and leaves
the others untouched.

```bash
systemctl list-timers miadi-perms.timer        # when it runs next
sudo miadi-perms                               # run it now; or: sudo miadi-perms <dir>...
journalctl -u miadi-perms.service              # how many entries each run changed
sudo systemctl disable --now miadi-perms.timer # stop it; an upgrade keeps it off
```

It replaces the `sudo chmod -R g+rw /workspace/repos/ /src/_sessiondata` that
jgwill/Miadi's `.github-hooks/push` ran on every push until 2026-10-08: that
walked 3 million files per push, and push bursts started several at once.

## miadi-node, miadi-chronicle-client, miadi-chronicle-server

The chronicle's commands are npm packages from jgwill/Miadi `packages/*`. These
three packages put them on a machine without npm, npx or a Node of its own
(jgwill/miadi-orchestration-kit#77). They split as a client and a server half
around one private runtime:

| package | half | for |
|---|---|---|
| `miadi-node` | runtime | Node.js 24 LTS from nodejs.org, sha256-checked, at `/usr/lib/miadi-node/bin/node`. Nothing on `PATH`, so a system or nvm `node` is left alone |
| `miadi-chronicle-client` | client | any machine an agent or a person works from: reads, relates and writes the chronicle through the Miadi API |
| `miadi-chronicle-server` | server | the host where sessions run and takes are recorded; `miadi` (the host) depends on it and recommends the client |

```bash
sudo apt install miadi-chronicle-client          # a client: brings miadi-node
inquiry-weave --help
systemctl --user enable --now miadi-capture-service   # on a host, per user
```

Each half installs its pinned npm releases (`prep/<half>.packages`) under
`/usr/lib/<half>` with the npm of the same Node it runs on, and gets a
`/usr/bin` wrapper for every command those packages declare. Install scripts
are not run; no package in either list has a native module. `SOURCE` in
`/usr/share/<half>/` lists the pins and the resolved tree. The MCP servers are
pinned at the versions the `miadi-chronicle-episode-kit` plugin runs with
`npx`, so an MCP config can call `/usr/bin/miadi-voice-mcp` instead, with no
npm cache and no network at session start. A user's own npm install, earlier
on `PATH`, still wins.

To move a pin: change `prep/<half>.packages`, bump the half's `Version:`,
build, test, publish. A Node release is a new `miadi-node` Version
(`24.21.0-1` names `v24.21.0`); the halves accept any 24.x.

## miadi-music

Music on a Miadi host, installed beside the platform. The parts are split by
what a host makes, so an album workstation and a host scoring episodes each
install only what they use:

| package | an album | an episode's score |
|---|---|---|
| `miadi-music-render` | yes | yes |
| `miadi-music-measure` | yes | yes |
| `miadi-music-video` | no | yes |

```bash
sudo apt install miadi miadi-music                          # the platform, and music with score video
sudo apt install --no-install-recommends miadi-music        # an album host: render and measure only
miadi-music check                                           # every tool each part needs, and its package
miadi-music python script.py                                # run under the measuring Python
```

`miadi-music-measure` follows `miadi-tide`: its `postinst` builds
`/usr/lib/miadi-music/venv` with `--no-index` from the wheels in
`/usr/share/miadi-music/wheels/cp<NN>/`, and checks that NumPy and SciPy import
together without a warning. A NumPy that pip put in `/usr/local` cannot pair with
the distribution's SciPy there. The pins are in
`prep/miadi-music-measure.constraints.txt`.

The wheels for all three Pythons came to about 175 MB, over the repository's
100 MB limit for a `.deb`. They are three packages instead, about 55 MB each,
built by `prep/miadi-music-wheels.sh`. Each `miadi-music-wheels-cp<NN>` depends on
the `python3` of its version, and `miadi-music-measure` depends on any one of them,
so apt installs only the set the host can use. A wheels package installed,
upgraded or replaced triggers `miadi-music-measure` (`DEBIAN/triggers`), which
rebuilds the venv: after a release upgrade changes `python3`, apt swaps the
wheels package and the venv follows.

`miadi-music` itself carries the watch tools (rsync, ssh, jq, curl, file) and
`/usr/bin/miadi-music`. `MIADI_MUSIC_SOUNDFONT` (else `JAMAI_SOUNDFONT`) and
`MIADI_MUSIC_PYTHON` override its defaults. The `atelier-jerry` plugin
(jgwill/miadi-orchestration-kit#44) tries the venv first for its measurements.

## Build, test, install

```bash
bash build.sh                               # -> dist/<package>_<version>_<arch>.deb for each package
bash build.sh miadi-tide                    # one package
bash test-install.sh dist/*_<version>_*.deb     # clean ubuntu:22.04 container
IMAGE=ubuntu:24.04 bash test-install.sh dist/miadi-tide_<version>_amd64.deb
python3 tests/tmux-click.py miadi-terminal/usr/share/miadi-terminal/tmux/miadi-chronicle.conf miadi-terminal/usr/bin/miadi-chronicle-open
bash tests/session-continuity-sync.sh   # restore's copies against jgwill/gaia's installer
bash tests/hermes-tailnet-sync.sh        # tailnet installer/publisher/proxy tests against Gaia
bash tests/mirror-monitor-sync.sh        # lid/hotplug/reboot mirror tests against Gaia
bash tests/feedback.sh                   # which issue wakes a feedback seat, its trust, model and labels
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
bash "$publish" dist/miadi-perms_<version>_all.deb    # after miadi-config, before the miadi that depends on it
bash "$publish" dist/miadi-node_<version>_amd64.deb   # before the two halves that run on it
bash "$publish" dist/miadi-chronicle-client_<version>_all.deb
bash "$publish" dist/miadi-chronicle-server_<version>_all.deb   # before the miadi that depends on it
bash "$publish" dist/miadi-terminal_<version>_all.deb   # after the miadi-config it depends on, before the miadi that depends on it
bash "$publish" dist/miadi_<version>_all.deb
bash "$publish" dist/miadi-tide_<version>_amd64.deb     # before the miadi that depends on it
bash "$publish" dist/miadi-music-render_<version>_all.deb
for w in dist/miadi-music-wheels-cp3*_<version>_amd64.deb; do bash "$publish" "$w"; done
bash "$publish" dist/miadi-music-measure_<version>_all.deb   # after the wheels it depends on
bash "$publish" dist/miadi-music-video_<version>_all.deb   # after the two it depends on
bash "$publish" dist/miadi-music_<version>_all.deb         # last
bash "$publish" dist/miadi-feedback_<version>_all.deb      # after the miadi-config it recommends; nothing depends on it
```

The repository publishes `amd64` only, so the Termux builds in `dist/termux/`
go into a flat apt repository on the phone (`termux/README.md`). It is a Cloudflare Worker over R2, and an uploaded
`.deb` must stay under 100 MB: split a package that grows past it, as the music
wheels are split by Python.

The Miadi umbrella packages (`packages/miadi/js`, `packages/miadi/py` in
jgwill/Miadi) can join here later.
