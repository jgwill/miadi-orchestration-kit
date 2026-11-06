---
name: bounded-apt-release
description: >
  Close a bounded APT build/test/merge/publish mission without an open-ended review
  loop. Load for Debian package releases, focused re-review after a passing matrix,
  a user asking whether a release is finished, or scope narrowed to packaging only.
---

# Bounded APT release: review defects, then finish delivery

Earned in kit #135 / PR #136: the first adversarial review found material
sandbox, privacy and redistribution defects. It was necessary. Re-review then
ran over sixteen minutes despite a focused brief, while the six-container
matrix already passed; Guillaume had to ask whether the mission was finished.

1. Survey once, isolate the branch, preserve other work and record the approved
   scope. A later direct correction wins: defer secondary work to an assigned
   issue, not a running implementation lane.
2. Build pinned artifacts and run the supported-distro matrix. Require one
   adversarial review; do not skip measured security or distribution blockers.
3. For a re-review, name the exact changed files/findings and require an interim
   blocker list within five minutes. Budget each additional probe. Do not
   silently launch another broad container fleet or repeat an already-passing
   matrix without a finding that calls for it.
4. At the budget boundary, collect the report. A measured blocker is fixed and
   regression-tested; silence is not approval. If the reviewer gives an exact
   conditional approval, satisfy those conditions instead of commissioning
   another general review. Missing real-host/account instruments are labelled,
   never represented by Docker or anonymous sign-in tests.
5. Separate scripted checks from an agent-operated clean-host walkthrough.
   Prove pinned artifacts, old-version cleanup, preserved data, signed APT
   metadata and a real install. Keep account sign-in manual.
6. Finish the authorized sequence: commit → PR → merge → build/verify artifact
   identity → publish in dependency order → signed-index/install readback →
   canonical checkout on main → issue/connector receipt. Test success alone is
   not shipment. Keep the user informed during a long-running step; never say
   "finishing" while opening unrelated scope.

Reviews keep the release safe. A review that never closes is not the release.
