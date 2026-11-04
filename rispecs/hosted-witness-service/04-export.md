# 04 Export

## Package layout

Built like its siblings in `packages/miadi/deb/` (`bash build.sh miadi-hosted-witness`). Its law is that folder's `AGENTS.md`, "Finishing is publishing".

```
miadi-hosted-witness/
  DEBIAN/control              Package, Version 0.1.0, Architecture: all
                              Depends: bash, jq, tmux, sudo, git, coreutils
                              Recommends: miadi-config (>= 0.2.8), miadi-perms, miadi-terminal
  DEBIAN/conffiles            /etc/miadi/hosted-witness.d/example.conf
  DEBIAN/postinst             nothing enabled; prints how to enable
  DEBIAN/prerm                disable every enabled relative before removal
  usr/bin/miadi-hosted-witness
  usr/lib/miadi-hosted-witness/pane-as-relative        the only command the sudoers rule allows
  usr/lib/miadi-hosted-witness/pane-write-guard.sh     a copy of /etc/claude-code/skills/dispatch-discipline/pane-write-guard.sh and its fixtures
  usr/lib/systemd/user/miadi-hosted-witness@.service   one instance per relative, off until enable
  usr/share/miadi-hosted-witness/steer-template.md
  usr/share/miadi-hosted-witness/feedback-template.md
  usr/share/doc/miadi-hosted-witness/README
  etc/miadi/hosted-witness.d/example.conf
```

`enable` writes `/etc/sudoers.d/miadi-hosted-witness-<relative>` and checks it with `visudo -c` before it keeps the file. `disable` removes it.

## Tests

| test | proves |
|---|---|
| `tests/hosted-witness-status.sh` | busy, idle and ended are read correctly from a fixture capture, with the registry absent |
| `tests/hosted-witness-guard.sh` | `deliver` refuses on guard exit 1, 2 and 3, using the guard's own fixtures |
| `tests/hosted-witness-sudoers.sh` | the rule allows `pane-as-relative` as the relative and nothing else (`sudo -l -U <witness>`) |
| `tests/hosted-witness-landing.sh` | in a scratch repository: only the folder's paths are added, the Ref trailer is present, and a non-fast-forward push is merged once |
| `test-install.sh dist/miadi-hosted-witness_*.deb` | clean install and removal in ubuntu:22.04 |

## Acceptance gates

1. `miadi-hosted-witness check <relative>` passes on eury for gmusic, as user `mia`, after `NOPASSWD: ALL` is replaced by the scoped rule.
2. The prototype's run continues on the package. The next T5 turn end is a `turn_end` wake, and its landing is a commit with `Ref: miadisabelle/chronicle-sessions#103`.
3. Every steer delivered names a decision id from the factory, or the maintainer's verbatim go, in its `go_by`.

## Where the export is recorded

- This packet is held in Episode 1000 (miadi-chronicle://1000) through the episode's rispecs door. Episode 1000 is about factory machines installing themselves from apt, and this package is one more of them.
- The prototype's staging folder lists the packet in its `relations.md`.
- Once the run with Jerry is ready for an episode of its own, that episode holds the packet with `derived_from` naming the staging folder.
