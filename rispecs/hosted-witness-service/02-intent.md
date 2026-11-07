# 02 Intent

## Desired outcome

A relative who tries what the maintainer builds has a witness seat present beside their sessions on their own machine.

- The seat reads what the relative's sessions do, and only that. It checks the steps they are about to take before they take them.
- It commits and pushes what their sessions write where their account cannot.
- It keeps the relative's feedback in their own words.
- It turns the next major step into a decision the maintainer makes in the Miadi factory.

The relative learns by watching their own agents work, with one decision at a time and the proof of each step in front of them. The maintainer is close enough to decide what matters, without having to read the relative's sessions.

William, 2026-11-04: "this remote feedback-system or assistance where we host one of our agent to witness and do some obvious work and prepare next major steps based on that relative's experiment".

## Current reality

- The witness practice exists as skills and scripts in `claude/miadi-witness`: inventory, asks ledger, listener, first impression, witness editor. They were written for a seat that watches the maintainer's own sessions, as the same user.
- On a host shared with a relative, the same seat runs as another user. It reads the shared capture. It reaches the relative's pane only through an unrestricted sudo rule, and it cannot read the relative's session registry, so the listener misreads a working session as "not running".
- The relative's account cannot commit in the chronicle. A person or the seat has to land their work.
- `miadi-feedback` already turns an issue into a seat, on the maintainer's host. Nothing turns a relative's turn end or spoken feedback into one.
- The factory connector (mcp.sanctuaireagentique.com) already offers `append_observation`, `request_session_steer`, `propose_session_completion` and `show_decisions`. Requests made through it wait for a person's decision. No package on a relative's host uses them.

## Structural tension

The relative's sessions produce work and words every day, and today they reach the maintainer only when someone sits a seat beside them by hand. The package makes that seat a property of the host. It is installed, enabled with consent, scoped and revocable, so the maintainer receives each step as a decision.

## Boundaries

- **Consent has two layers.** The first is the relative's invitation. Jerry asked William for this work, through his PR reports and through the handle he expected William to make, so he consented to being brought into the narrative. The second is consent to each flow: what is read, who reads it, what is decided for him. That layer is asked, and the relative is surveyed on it (William, 2026-11-06). Its first mechanism exists: a participant consent request in the factory connector (jgwill/Miadi `c2c900fa`, 2026-11-06) gives the relative his own link, with no sign-in, to say Yes or Not yet to his words being published, and nobody can approve it for him. It could be held for him by a decision layer he builds himself, one that decides, informs and discusses (Episode 564). He is told about Episode 564 before it decides anything.
- **Turning it on and off.** The relative turns the witness on and can turn it off. Enabling it names which of their sessions and folders it reads, and that is all it reads. Turning it off removes its access the same minute.
- **Say who can read.** Before the relative consents, they are told who can read their capture. On eury that is every account on the host, the words they type included. `enable` shows it, and `check` reports it each time it runs.
- **Read is not write.** Reading the capture needs group read. Writing to the relative's pane needs a separate, narrow sudo rule, and each delivery needs a person's go: the maintainer's or the relative's.
- **Their words stay theirs.** Feedback is written verbatim with its date and speaker. The seat never paraphrases it into the record.
- **No second steerer.** The seat never types while someone is composing in the pane (guard exit 1) or while a turn runs (exit 2).
- **Decisions wait.** A proposed steer or completion goes to the factory as a request in `awaiting_approval`. The seat delivers it only after the decision.
- **No public act unasked.** The seat commits and pushes to the repositories its configuration names. It opens an issue only through a script the folder already uses, and it mints no episode.

## Open topics

- **Who reads the capture.** Today every account on the host can read it, including what the relative types. It could be limited to a group of readers the relative names. That is a host-wide change to what `miadi-perms` sets, held for a discussion with William.
- **Watching every session.** Jerry asked whether something analyses all his Claude instances. If the witness watches every session of a relative, from a chosen date onward, something has to decide which wakes reach a person. Episode 564 (miadi-chronicle://564) studies Jev for decisions of that kind (lane-check reads a session's inputs, commits and last messages). Each watched period could be held as a ceremony in the episode it belongs to.

## Who is touched

| person | what changes for them |
|---|---|
| the relative | their feedback is kept as they said it; the steps they are asked to run are checked before they run them |
| the maintainer | each wake arrives as an observation or a decision in the factory, with its proof |
| the next agent | finds the steer, the feedback and the run log in the folder and the packet, not in a conversation |
