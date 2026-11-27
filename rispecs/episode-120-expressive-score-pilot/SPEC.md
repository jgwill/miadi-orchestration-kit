# Specification — one embodied take becomes one film cue

## Inputs

- a human-approved capture intention with episode, scene/cue purpose, consent
  keeper, custodian, permitted derivations and refusals;
- one amended `miadi.field-kit.v1` device profile;
- existing recorders and device-local or ignored capture storage;
- portable identities for episode, take, movement score, composition and
  timeline guides.

## Outputs

- an ordered lifecycle of `miadi.expressive-take.v1` manifests and events;
- local hashes and technical observations without embedded media or speech;
- three separate human judgments: consent/custody, technical reliability and
  artistic usefulness, plus an editor's placement decision;
- one continuation handoff naming the next event, keeper and target state.

## Lifecycle

`started → completed → linked` is the successful path. `held` and `failed` are
truthful outcomes, not errors to hide. Events are idempotent and carry
references and hashes rather than recordings.

`linked` requires both a human-accepted composition reference and a
human-accepted timeline guide. The adapter cannot create either decision.

## Required observations

- clock reference, start/end, requested and observed rates, signed drift;
- channels and their complete, partial, missing or failed states;
- device-profile, consent and custody references;
- portable artifact references and sha256 digests;
- scene, cue and slate markers;
- composition and timeline guides only when accepted.

## Prohibited content

- recordings, image/audio/video bytes or base64;
- participant names, words, transcripts or utterances;
- credentials, secret-bearing references and local file URLs;
- absolute host paths and traversal;
- inferred consent, publication authority or creative acceptance.

## Claim status

This specification is testable in software and by reference rehearsal. It does
not claim that the Episode 120 field take, cue or timeline placement exists.
