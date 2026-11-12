# Every agent on a host reaches the same settings and writes where the others read: a proposal for T8

Proposed 2026-11-12 by the Claude Code session `7c06cec8-1fe9-4b86-84e0-368e3ec5e7ee` (miadi-tmux://jgi@hu:t8-parity-codex-plugin-setup-990), after it set up Codex capture for jgi on hu (jgwill/Miadi#990). It is addressed to T8 · Software development, which owns the host install. Nothing in P1 to P5 is built. What this pull request adds is listed at the end.

Guillaume, on the settings: "it's possible that we never really set up all of the environment variable for what you're actually running." On the per-account fallback: "That makes any agent incapable of being informed of a session about what's going on in that session, if that's happening."

## Findings, measured on hu, 2026-11-09 to 2026-11-12

### F1. The desktop session has none of the host settings, and the check says ok

The Plasma session started at boot on 2026-08-06. `miadi-config`'s login hook, `/etc/profile.d/miadi.sh`, was installed on 2026-09-19. `plasmashell` holds 0 `MIADI_*` variables, and so does the Codex desktop app it launches. A bash shell that reads `/etc/profile` gets 46. `miadi-config check` reports every line `ok`.

### F2. The settings reach bash login shells only

`/etc/profile.d/miadi.sh` loads `env.sh` only when `BASH_VERSION` is set. SDDM's `Xsession` reads `/etc/profile` for a user whose shell is bash, and reads `zprofile` for zsh. A bash user's next desktop login gets the settings. A zsh user's never does, and neither does a session already running when the package was installed.

### F3. With no capture root set, each agent falls back to its own folder

- Claude would use `~/_sessiondata` (jgwill/miadi-orchestration-kit#144). That is also the default `miadi-config settings` states: "default /src/_sessiondata, else ~/_sessiondata".
- Codex uses `${PLUGIN_DATA}/_sessiondata`, inside its own plugin folder.
- `miadi-hooks-interpret` reads `$MIADI_SESSIONDATA_ROOT` or `/src/_sessiondata`. tide reads the first root variable set, else `/src/_sessiondata`.
- `miadi-perms` exists so that every account can write into one shared capture.

A session written into a per-account folder is therefore invisible to the witness, to tide and to every other account's agents. On hu `/src/_sessiondata` exists, which is the only reason this did not happen.

### F4. Claude has a setup command, and Codex has none

`miadi-claude setup` (jgwill/miadi-orchestration-kit#144) installs the plugin, proves one hook records, and retires hand-wired hooks last. For Codex on hu every step was done by hand:

1. Back up with `legacy-cutover.py backup`.
2. Add the marketplace and the plugin.
3. Trust exactly the plugin's 12 hooks through Codex's own app-server.
4. Prove capture in three fresh sessions.
5. Retire the 8 legacy handlers with `legacy-cutover.py clear`.
6. Restart the desktop app on a person's word.

The trust step lived in a session's scratch folder until this pull request.

### F5. `miadi-config check` looks at Claude capture only

It names a missing Claude plugin and hand-wired Claude hooks. It says nothing about Codex: whether the plugin is installed, whether its hooks are trusted, or whether `~/.codex/hooks.json` still writes every event twice.

### F6. Three Codex runtimes on one host

`/usr/bin/codex` is codex-cli 0.0.2505291458 and has no `plugin` command. jgi's `PATH` finds 0.167.0 first, and the desktop app runs its own 0.167.0-alpha.3.2. A service or a script on a plain `PATH` would reach the old one.

### F7. The factory does not see a session on another host

On 2026-11-12 the factory connector's `list_sessions` found nothing for `t8-parity-codex-plugin-setup-990`. Its `search_sessions` read all 6268 session folders on the factory's host and matched none of this session's four days of work. That work is captured on hu, in 857 local session folders, by this plugin. hu runs `tide-runtime.service` and two `miadi-tunnel@` units, which bring gaia's and ilex's services to hu's loopback. Nothing sends hu's sessions the other way. The staged exploration `the-session-on-another-host-261110` already names this as capability C5, "missing", for T1 and T3.

## From the recommendation of 2026-11-12

The seat first recommended a `~/.config/environment.d/miadi.conf` for the desktop session, without tokens. Two parts of it stand:

- The settings have to reach every process an agent runs in, the graphical session included (F1, F2).
- Tokens stay out of the graphical session, which is what `miadi-config` already does.

The per-account file is withdrawn. The package writes nothing into a home directory, and `miadi-terminal` already treats such a drop-in as legacy.

## Proposals

### P1. The check names a session that does not hold the settings

`miadi-config check` compares the host settings with the environment of the account's graphical session and of its systemd user manager. When they differ, it says which processes started before the install, and that a new login brings them in. A zsh login gets a hook of its own, or `env.sh` becomes loadable from any POSIX shell. Tokens stay in each account's `~/.env`.

### P2. One shared capture, never a silent per-account one

Every agent's plugin resolves the capture root the same way. When neither `MIADI_SESSIONDATA_ROOT` nor `/src/_sessiondata` exists, the default is a shared folder that a package creates and `miadi-perms` keeps writable, for example under `MIADI_DATA_DIR`. It is never `~/_sessiondata` or a plugin's own data folder. A per-account folder is used only when a person sets it, and `check` reports it as hidden from the others. This needs deciding before #144 merges its `~/_sessiondata` fallback.

### P3. `miadi-codex setup` and `status`, like `miadi-claude`

One command per account, run as that account, stopping at the first step it cannot do:

1. Check the capture folder is writable.
2. Check that the Codex it will use supports plugins.
3. Add the marketplace and install the plugin.
4. Trust exactly the plugin's hooks, with `scripts/trust-hooks.mjs`.
5. Prove one hook records into a throwaway folder.
6. Back up, then retire hand-wired capture with `legacy-cutover.py`.
7. Name the running Codex apps and TUIs that keep their old hook list until they restart.

### P4. The check covers Codex as it covers Claude

It reports the Codex plugin and its hook trust, legacy entries in `~/.codex/hooks.json`, and a `/usr/bin/codex` too old for plugins that would shadow the others.

### P5. Each host reports its sessions to the factory

Guillaume, 2026-11-12: "if there's anything that we run as a service to inform the factory of what are the session of the user, that's something else, but I think we never designed something like that, and it might be relevant."

A shared folder (P2) serves the agents of one host. The factory needs a report from every host. A user service on each host would send each new binding line to the factory: session id, account, host, agent, tmux address, team, episode, start and end. Drafts and tide's snapshot could follow later. Content stays on the host, and the factory asks that host for more when someone needs it. Without this report, a capability record can say which implementation exists, but not on which hosts it runs, which is the availability column parity needs. Design owners: T1 for capture, T2 for the event path, T3 for the inventory that reads it.

## In this pull request

- `codex/miadi-session-observability/scripts/trust-hooks.mjs`: Codex's own list of the account's hooks, and `--trust` for this plugin's hooks only, over a private app-server. It was run read-only on hu: 12 hooks, all trusted, exit 0. On an empty Codex home it reports 0 hooks and exits 1.
- The README's install section names it and the legacy cutover.
