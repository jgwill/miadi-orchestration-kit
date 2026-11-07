# Hosted witness service (`miadi-hosted-witness`)

A RISE packet for a Debian package that hosts one of our witness seats on a relative's machine. The seat watches the sessions the relative works in. It does the obvious work itself: commits, pushes, checks the steps the relative is about to run. It brings the relative's words to the maintainer and prepares the next major step, which then waits for a person's decision in the Miadi factory on gaia (miadi.sanctuaireagentique.com).

Reverse-engineered from the prototype run of 2026-11-04 on eury. In it, the witness seat `6ad00fd4` (user `mia`) watched Jerry's session T5 `d8e16584` (user `gmusic`) while it prepared and delivered his handle. That handle is staged in the chronicle at `_staging_for_new_episodes/stcmastery-plugin-structure-atelier-jerry-near-the-loop-261104/` (miadisabelle/chronicle-sessions#103). The prototype continues as long as Jerry works with the handle. `01-reverse-engineer.md` keeps its record.

Status: specified, not built. Issue: jgwill/miadi-orchestration-kit#138. Also: jgwill/miadi-orchestration-kit#109 (its maintainer-side sibling, `miadi-feedback`) and jgwill/miadi-orchestration-kit#91 (T5 production context exploration).

## Desired outcome

A relative installs one package and enables it once. From then on, a witness seat is present beside their sessions. They never message it, and nothing reaches their pane without a person's go. Their feedback is kept in their own words, committed and pushed. The maintainer receives each piece of feedback and each proposed next step as a decision in the factory.

## Files

| file | phase | holds |
|---|---|---|
| `01-reverse-engineer.md` | R | what the prototype did, step by step, and what it could and could not see |
| `02-intent.md` | I | desired outcome, current reality, the tension, boundaries, consent |
| `03-specify.md` | S | the package: commands, configuration, watcher, steering, feedback, landing, factory relay |
| `04-export.md` | E | the deb layout, its tests, the acceptance gates, where it is recorded |
| `05-source-ledger.md` | | each claim with its source and confidence |

The foundation it rests on is `foundations/hosted-witness/README.md` in this kit.

## Acceptance

1. Another agent can build the package from `03-specify.md` and `04-export.md` alone.
2. The witness sees when a turn ends in the relative's session from the capture, without reading the relative's private session registry.
3. The witness writes to the relative's pane only through a guarded delivery that a scoped sudoers rule allows. It does not need `NOPASSWD: ALL`.
4. Each wake leaves a pushed commit or an observation that names why nothing was committed.
5. The relative can see what the witness may read and can turn it off with one command.

## Related

- `rispecs/witness-team-interface/`: the MCP the witness would offer other teams. This package is the host side of that interface.
- `claude/miadi-mentorship/` (draft 0.0.1): the events of this relationship as CloudEvents (`miadi.mentee.said`, `miadi.mentee.turn_ended`, `miadi.mentor.steer_sent`, …), kept locally and posted to a webhook the maintainer names. Jerry asked to observe events, and named the seat's work mentorship (2026-11-06).
- `packages/miadi/deb/miadi-feedback`: on the maintainer's host, an issue wakes a seat. Here, on the relative's host, a turn end or a feedback line wakes one.
- Episode 1000 (miadi-chronicle://1000): factory machines that install themselves from apt.
- Episodes 250 to 259 (miadi-chronicle://250 to miadi-chronicle://259): the work with Jerry. 259 is the reserved first chapter of the handle.
