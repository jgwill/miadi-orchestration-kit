# Release notes, jgwill/miadi-orchestration-kit

Newest first. Each note says what changed and for whom, which pull requests the next note
should carry, and the road ahead: what the sessions are working toward. A note is sent by
email to the people it concerns, and a reply to it reaches the sessions that hold the road
ahead. The practice is the `release-notes-road-ahead` skill of the `miadi-release-notes`
plugin (`claude/miadi-release-notes/`).

---

## Note 001, 2026-11-17

### What changed

**miadi-chronicle-episode-kit 0.3.61** (commit `3619785`)

On 2026-11-17 the plugin was upgraded in the seat that prepares Jerry's atelier mail
(miadi-tmux://mia@gaia:f1-t6-mailing-and-prep-atelier-jerry-2611131123), and its wheel
server stopped answering: "Failed to reconnect to
plugin:miadi-chronicle-episode-kit:medicine-wheel-miadi-chronicle". Without that server the
seat cannot read or write the chronicle wheel (nodes, relations, ceremonies, circles).

Two facts caused it. The plugin read its wheel package as `${MWCV:-@medicine-wheel/mcp@4.27.15}`.
`MWCV` is exported on every gaia shell by `/opt/binscripts/etc/bash_env_common`, where it is
moved by hand, and it still said 4.27.10. So the upgrade changed nothing for that seat: it
kept asking for 4.27.10. Then npx's cached copy of 4.27.10 had lost its `package.json`,
and npx stopped with `ENOENT` before the server could start.

The plugin now reads its own override, `MIADI_CHRONICLE_MW_MCP`, which no host sets, the
same shape as its two other servers (`MIADI_INQUIRY_WEAVE_MCP`, `MIADI_VOICE_MCP`). The
version pinned in the plugin is the version a session starts, and moving the pin with
`scripts/kit-mcp-upgrade.sh` moves every new session. `MWCV` stays where it is, because
other configurations on the host read it. Proof, with `MWCV=@medicine-wheel/mcp@4.27.10`
still exported: `claude --plugin-dir claude/miadi-chronicle-episode-kit mcp list` connected
3 of 3 servers, the wheel on 4.27.15. The broken cache folder on gaia was moved aside and
rebuilt.

What you do: nothing in a new session. A session started before 0.3.61 keeps the
environment it was launched with. In such a seat, run `/mcp` and reconnect
`medicine-wheel-miadi-chronicle` (it answers again, on the repaired 4.27.10 or on 4.27.15),
or start a new session to be sure of 4.27.15. As this note is written, the atelier mail
seat has not reconnected since its last failure at 13:37 UTC.

**Also released since 2026-11-16**

- miadi-chronicle-episode-kit 0.3.59 and 0.3.60: the wheel pin moved to
  `@medicine-wheel/mcp` 4.27.14, then 4.27.15. 0.3.61 is what lets that move reach a seat whose shell exports `MWCV`.
- miadi-chronicle-client 0.1.7: the deb carries the plugin's pins again, inquiry-weave
  0.18.14 and `@medicine-wheel/mcp` 4.27.14.
- mia-episode-companion 0.6.1: held replies play once the take is sent, a loading reply is
  no longer cut off, and the wide-take step (jgwill/miadi-orchestration-kit#156).
- miadi-config 0.2.13: `MIADI_CONNECTOR_PUBLIC_URL`, the connector's public address as a
  host setting.
- `rispecs/hosted-witness-service/`: the run log, where Jerry's side runs the
  steer-by-file practice for its own package.

### Next release: the pull requests in motion

Twelve pull requests are open. Each was test-merged into `main` on 2026-11-17.

**Ready after a read**

- jgwill/miadi-orchestration-kit#159, Field-kit: one living gesture reaches the score
  without leaving its keeper (Iris). Merges cleanly, together with #152 as well.
- jgwill/miadi-orchestration-kit#152, each team carries its criteria for routing. Two files.
- jgwill/miadi-orchestration-kit#142, miadi-server 0.2.0, the built app with no source on
  the host. A deb change: it is built and passes `test-install.sh` before it is published.

**#159 brings a new skill: `on-set-performance`**

The pull request opens a tenth team, T10 Embodied Performance & Capture, as the pilot of
Episode 120 (miadi-chronicle://120), beside the production team T8. Its skill prepares,
rehearses, runs, monitors and closes one expressive take on a set: a performer's gesture,
caught by cameras, microphones, phone sensors, MIDI or OSC, that a composer and a film
editor can later take up. The take stays recognisable from the set to the score and to the
film's timeline, and the person who made it keeps custody of the recording.

The skill keeps three things apart. The physical field kit is the equipment, its
placement, calibration, monitoring and offline fallback, described in `field-kit.yaml`.
The App Workspace is the place in the episode that holds consent, the episode, the
composition and the timeline. Between them, `@miadi/expressive-take` writes a thin receipt:
which devices, which clock, which rates were asked and which were observed, which consent
and custody references apply. The receipt carries no recording and no participant's words.
Raw media stays on the device or in ignored capture storage and never enters git.

Before a take, the operator gets one short readiness answer: equipment, power and storage,
the clock and slate, the network state, the visible consent indicator, the start and stop
commands and the recovery steps. The skill stops when the consent keeper, the custodian or
the fallback is unknown. It does not compose, choose a cut, publish or start a second
recorder. Its first rehearsal replays receipts against the Episode 575
(miadi-chronicle://575) stringout, without recording anything new. No real field take,
consent decision or composition is claimed yet: those wait for the people on set.

**Main to be merged in, then a new version number**

- jgwill/miadi-orchestration-kit#150, phone-capture chooses a free port when 8771 is taken.
  Not on `main` yet, and it matters on eury, where Jerry's `forest-registry` also defaults
  to 8771. Only the version lines conflict: 0.5.11 in the branch, 0.6.1 on `main`, so it
  ships as 0.6.2.
- jgwill/miadi-orchestration-kit#144, miadi-claude 0.1.0, one command sets up Claude Code
  for an account. The session-observability version conflicts (0.1.40 in the branch, 0.1.48
  on `main`), and the changes between them are checked against it.
- jgwill/miadi-orchestration-kit#143, miadi-operator-desk 0.3.0, planning with Miette.
  Draft, version lines only.

**Not ready**

- jgwill/miadi-orchestration-kit#145, Codex miadi-session-observability 0.1.4. `main` is at
  0.1.5 and seven hook and test files conflict: rebased by its author, or closed if 0.1.5
  covers it.
- jgwill/miadi-orchestration-kit#124, session restore in one install. Held by its own last
  comment (the install test passed 4 of 12 runs on gaia), and it now conflicts in
  miadi-config.
- jgwill/miadi-orchestration-kit#44, atelier-jerry, the music atelier as a plugin. It
  merges cleanly but is 463 commits behind, is not in `marketplace.json`, and the op-021
  comment of 2026-11-16 lists what a production session did without it. It needs a
  marketplace entry and a decision on that list.

**Candidates to close**: jgwill/miadi-orchestration-kit#47 and
jgwill/miadi-orchestration-kit#32 (drafts from May and September, more than 660 commits
behind), jgwill/miadi-orchestration-kit#23 (a May rispec with a README conflict).

### The road ahead

1. **Release notes become a practice.** This note is the first. The `miadi-release-notes`
   plugin (0.1.0) carries the skill that drafts one: what changed, the next release, the
   road ahead, written as a key moment of the session that made it, kept here, and sent to
   the people it concerns. Once or twice a week.
2. **A mailing list in the factory.** jgwill/Miadi#1050 proposes two permissions: one that
   subscribes a person to the release notes, and one that lets that person's emailed reply
   count as feedback that the sessions and ceremonies working on the road ahead take up. It
   builds on jgwill/Miadi#1015 (an authenticated sender) and jgwill/Miadi#1024 (an arriving
   email recorded as `mail.received`).
3. **The next release.** #159 and #152 merged; #150 brought up to `main` first, because
   Jerry's port needs it; then #144 and #143.
4. **One command updates the kit's plugins in every harness an account uses**
   (jgwill/miadi-orchestration-kit#155). No pull request yet.

Until the second permission exists, a reply to this note is read by a person, who brings
it to the session.
