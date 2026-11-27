---
name: on-set-performance
description: Prepare, rehearse, run, monitor, and close a consent-bounded expressive field take for T10 Embodied Performance & Capture. Use for Episode 120 capture, an on-set field kit, camera/microphone/phone-sensor/MIDI/OSC calibration, offline fallback, requested-versus-observed rates, clock drift, raw-media custody, or turning a performer’s gesture into an expressive-take receipt that a composer and film editor can take up. Do not use it to compose music, choose a cut, publish media, or launch a competing recorder.
---

# On-set performance

Keep one embodied act recognizable from the set to the composition and film
timeline while the maker keeps custody of the recording.

## Preserve the three boundaries

1. Treat the **physical field kit** as T10's equipment, placement, calibration,
   monitoring, custody and fallback practice.
2. Treat the **App Workspace** as the analogous episode place that holds
   consent, episode, composition, timeline and session relations.
3. Treat `@miadi/expressive-take` as a thin portable receipt between them. It
   records nothing, contains no participant words and moves no raw media.

Use existing capture, movement, phone, composition and `miadi-film` surfaces.
Do not open a second recorder.

## Run the practice

### 1. Name the intended passage

Before equipment is placed, record:

- episode, scene, cue and participants;
- what the take may make possible for music and picture;
- the consent keeper and raw-media custodian;
- permitted derivations and explicit refusals;
- devices, requested rates, clock/slate, storage and offline fallback;
- what never leaves the device.

Class each statement as observed, human-chosen, proposed or desired future.
Episode 044 teaches this distinction. A proposed cue is not an accepted cue.

### 2. Select and amend one field-kit profile

Read [`field-kit.yaml`](./field-kit.yaml). Copy no secrets or media into the
profile. Resolve each `select_on_site` device to a device-profile reference and
write the observed capacity, battery, free storage, port, clock and monitoring
path in the local session receipt.

Use current equipment first. Record procurement only after the take reveals a
measured gap.

### 3. Publish the field-readiness answer

Give the operator one short answer containing:

- equipment and placement;
- battery/power and free storage;
- clock/slate and expected drift check;
- ports and network/offline state;
- visible consent indicator;
- the existing start and stop commands;
- recovery steps and raw-media location.

Stop when the consent indicator, custodian, start/stop path or fallback is
unknown. Do not infer authority from presence on set.

### 4. Calibrate before the performance

Run the profile's calibration checks. Make one slate event heard/seen by every
active channel. Record requested and observed rates separately. Confirm that
monitoring hears each intended channel and that disconnecting the network does
not stop local capture.

Use Episode 575's existing stringout as the no-new-media rehearsal: identify an
empty music track and a guide, exercise receipt creation/linking against those
portable references, and do not edit the Episode 575 source.

### 5. Start the receipt, then the existing recorders

Create the `started` expressive-take receipt before capture. It carries only
episode, device profile, clock, consent/custody references, markers, channels
and requested rates.

Start each existing recorder through its own supported interface. Keep raw
media in device-local or ignored capture storage. Never add it to Git.

### 6. Monitor without directing the art

Watch channel presence, clock, storage, power and the consent indicator. Mark a
channel partial or failed when its evidence says so. Do not tell the performer
what the gesture means, revise the artist's composition or move equipment in a
way that changes an accepted performance intention without asking.

If consent is withdrawn, stop or hold as the consent practice says. A held take
does not travel onward.

### 7. Close and verify the receipt

Stop the existing recorders, then:

- hash each referred artifact locally;
- record observed rates and signed drift;
- mark complete, partial, missing and failed channels truthfully;
- prove offline event replay and exact-duplicate idempotency;
- refuse traversal, absolute paths, local-file/data URLs, embedded bytes,
  participant words and secret-bearing references;
- scan the proposed Git diff for raw media, credentials and host paths.

A partial channel may coexist with a completed take when usable evidence
survived. Read [`references/expressive-take.md`](./references/expressive-take.md)
for the receipt map.

### 8. Pass three separate human gates

Do not collapse these judgments:

1. **Consent/custody:** the participant or keeper says the permitted use.
2. **Technical reliability:** a person independent of the capture reports
   whether timing, rates, hashes, channels and replay are trustworthy.
3. **Artistic usefulness:** the creator/composer accepts, refuses or holds the
   take as musical material; the editor separately accepts a guide.

Only a completed take with accepted composition and timeline decisions becomes
`linked`.

### 9. Leave the handoff

Leave a compact handoff naming desired state, current evidence, receipt/event
ids, local custody location by reference, open human decisions and the next
event/keeper/target state. Another agent must be able to resume without reading
the originating session.

T3 records the creator experience and narrative beat. T6 places the accepted
composer pass. T1 preserves session/episode/device identity. T2 carries only
references and hashes. See [`references/field-run.md`](./references/field-run.md)
for the acceptance ledger.

## Episode 120 pilot boundary

Episode 257's PT1 says the music Episode 044's film asks for comes from Shared
Spark; jgwill/Miadi#1035 holds that musical desire. Preserve that creative
lineage. Do not claim the cue is composed or placed until the people who hold
those decisions accept it.

Formalize T10 only after one verified take, linked composition, timeline
placement, human decision and replayable receipt exist.
