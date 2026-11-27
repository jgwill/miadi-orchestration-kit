# Expressive-take field map

Use `miadi.expressive-take.v1` through `@miadi/expressive-take`. This page maps
field evidence to the portable receipt; it does not redefine the package.

| Field evidence | Receipt field | Rule |
|---|---|---|
| Episode vessel | `episodeRef` | Portable episode reference only |
| Calibrated equipment set | `deviceProfileRef` | Refer to the field-kit profile and local amendments |
| Consent decision | `consentRef` | Reference only; no participant words or names |
| Raw-media keeper/location | `custodyRef` | Reference only; no filesystem path or media |
| Slate/clock | `timebase.clockRef` | One shared observed event across active channels |
| Capture intention | `markers.scene`, `cue`, `slate` | Machine-readable identifiers |
| Device stream | `channels[]` | Complete, partial, missing or failed; keep distinct |
| Planned vs real sampling | `requestedHz`, `observedHz` | Never overwrite one with the other |
| Clock comparison | `driftMs` | Signed observation |
| Local artifact | `refs[]` + `sha256` | Portable identity and digest; bytes stay local |
| Accepted musical work | `compositionRef` | Added only after creator/composer choice |
| Accepted placement | `timelineGuides[]` | Added only after editor/director choice |

## Lifecycle events

`started`, `completed`, `held`, `linked` and `failed` are lifecycle states and
events. The event id is deterministic from take id, revision and status.

- Start before recorders.
- Complete after hashes, rates, drift and channel states are observed.
- Hold when consent, reliability or artistic judgment has not advanced.
- Link only from completed, with a composition and timeline guide.
- Fail with a machine-readable code and optional device-receipt reference.

## Refusal checks

Reject any manifest containing:

- absolute/Windows/local filesystem paths or `..` traversal;
- `data:`, `blob:` or `file:` URLs;
- credentials or token/key/secret/password query parameters;
- embedded bytes, base64, raw-media/content/payload fields;
- transcript, utterance or participant-word fields;
- unknown schema fields.
