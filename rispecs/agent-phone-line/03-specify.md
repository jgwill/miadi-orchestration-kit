# 03 — Specification: agent phone line

A plugin that gives an agent a phone line to its person, built on the shape of Jerry's prototype (`01-reverse-engineer.md`) and on Jev's decisions during the call (`02-intent.md`). Implementation-agnostic: the first telephony adapter is Asterisk's AudioSocket, as in the prototype, and nothing below depends on it.

## 1. The person and the line

**PersonProfile**: `name` (spoken in greetings), `language` (the transcription language and the voice's), `extension` (the phone the agent calls), `inbound_extension` (where the person calls the agent), `hours` (default 8 to 22), `min_interval_minutes` (default 10), `voice`, `consented_at` (when the person heard what leaves the host, `02-intent.md` boundary 3). No name is in a command or a file path; "Jerry" becomes `name`.

**People and their devices.** The line keeps a list of people it may call, each with their profile and one or more devices: an extension, a phone page, a number. Adding a device, a number or a person widens the line without changing it. Jerry, 2026-11-14 (call `4bbd87c1`, Episode 576, `feedback-next-generation-261114.md`): « à partir du moment qu'on a l'option d'ajouter des appareils, d'ajouter des numéros de téléphone à appeler, … des personnes à appeler, bien là, on peut élargir la fonctionnalité ». His example of a device is his phone, Larix as he spells it.

**Line readiness** is a fact the agent can ask for before calling: is the person's phone registered on the extension now, which hours apply, when the next call is allowed. In the prototype the agent learned that the phone was not registered only after two calls rang unanswered.

## 2. Hearing a sentence

As in the prototype: audio in short frames, a sentence ends after a silence (800 ms by default) or a maximum length, the sentence is transcribed, and transcription phantoms (lone dots, "merci d'avoir regardé") are dropped. Each kept sentence is appended to the call's discussion with who said it.

**A listening tone, as an option.** `listening_tone`, off by default and set per mode: a short beep when the line starts listening, so the person knows what they say is being kept. Jerry, call `7292c704`: « quand ça fait bip, elle est en train d'écouter. Donc, ça me rassurait que quand je parle, tout est retenu », and « ce serait vraiment une option qu'on active ».

**Continuity of listening.** The silence that ends a sentence is not fixed. When Jev reads the last sentence as stopping mid-thought (`mid_thought`, below), the next sentence may run longer before it is cut (1,600 ms by default) and the voice says nothing in between, so a person who pauses to think is not interrupted by an acknowledgement.

## 2b. A phone page as the line: two windows

A second door, taken from the companion's phone page (`01-reverse-engineer.md`, the second prototype): the person speaks in a page on their phone instead of answering a ring, and the page sends what it records in parts. A call needs two windows, because keeping a recording and deciding during a conversation do not wait the same way.

- **The keeping window**: every 10 seconds, the bytes the server does not hold yet, as the companion does (`PART_EVERY_MS`). Nothing said is lost if the page or the network fails.
- **The listening window**: during a call, a shorter part, `listen_window_s`, 2 seconds by default and between 1 and 10. A sentence such as « je suis over » must be heard within about a second of the person's last word, and a 10-second window could hear it 10 seconds late.
- **One button per agent.** The page lists the person's agents, one button each, so the person knows which agent a call reaches, and each button calls that agent. Jerry, call `7292c704`: « en sachant déjà quel agent est relié à quel appel. Donc, j'aurais plusieurs boutons ».
- The parts follow the companion's rules: each names the offset the page believes the server holds; a part sent twice changes nothing, an overlap keeps its new tail, a gap is answered 409 with what the server holds.
- The server measures speech and silence in code on each new part (frames above a loudness threshold, as the prototype's line does). It transcribes the audio since the last sentence end once it finds a pause (`sentence_pause_ms`, 800 by default), and Jev reads each new sentence (section 3). Jev is asked once per sentence, not once per window, so its cost follows what the person says: about a thousand input tokens per sentence, measured on 2026-11-14.

Open question Q-E: `listen_window_s` and `sentence_pause_ms`, set from real calls by two measures: the time from the person's last word to the line's next words, and the transcription cost per minute.

## 3. Deciding after each sentence: Jev in the loop

After each kept sentence, the line asks Jev one request. It runs while the voice speaks a short neutral acknowledgement, so it adds no silence to the turn. The line acts on the answer at once, or, when the answer arrives after the next sentence has started, on that next sentence.

**State** (only what the questions need, no rule inside it, per Episode 564's study):

```json
{ "mode": "relay | discuss",
  "point": "<what the agent asked, as the voice said it>",
  "questions": ["<each question of the point, when it holds several>"],
  "times_said": 1,
  "recent": [["agent", "<…>"], ["person", "<…>"]],
  "sentence": "<the sentence just transcribed>" }
```

`recent` holds the last six turns. The state stays far under Jev's 32k-token limit.

**Questions**, each one literal and about one thing:

| id | type | instruction | criteria |
|---|---|---|---|
| `move` | choice | What does the person do with `sentence`? | `go_on`: they are answering or thinking aloud and have more to say. `repeat`: they ask to hear the point or the questions again. `finished`: they say they are done, in any words, such as "c'est tout", "terminé", "tu peux envoyer", "non" after "autre chose ?", "done". `ask_agent`: they ask something about the work that only the agent could answer. `not_to_line`: they speak to someone else, or the sentence is noise. |
| `asks_repeat` | noul | Does `sentence` ask to hear the point or the questions again? | true: it asks for a repeat. false: it does not. |
| `is_finished` | noul | Does `sentence` say the person has nothing more to say on this call? | true: they are done. false: they are not. |
| `mid_thought` | noul | Does `sentence` stop before the thought it started is complete? | true: it stops mid-thought. false: it is a complete thought. |
| `asks_callback` | noul | Does `sentence` ask to be called back later? | true: it asks for a callback. false: it does not. |
| `confirms` | noul | (discussion mode, after a read-back) Does `sentence` confirm that the read-back is their answer? | true: it confirms. false: it does not. |

The options of `move` are rotated between sentences and the order is recorded (Jev leans toward the first option). The model is pinned (`jev-1.14.0` today); an alias such as `jev-latest` is refused, because it resolves differently on the two hosts.

**Bands**, computed in code. Every threshold is configuration, and each one starts as provisional until rulings set it (section 7):

| reading | the line does |
|---|---|
| `is_finished` ≥ 0.8, or `move` = `finished` with confidence ≥ 0.6 | closes: relay mode says it passes everything on; discussion mode reads back the answer and waits for `confirms` |
| `is_finished` between 0.4 and 0.6 | asks once: "Est-ce que c'est tout ?" The next sentence decides |
| `asks_repeat` ≥ 0.7, or `move` = `repeat` with confidence ≥ 0.6 | says the point again from its beginning, the introduction included, then the questions one at a time, each by its number, waiting after each. When the person says they did not understand, discussion mode rephrases instead of repeating. On call `8d8d3f50` the repeat brought back only the question, and Jerry asked twice for « les idées ». His words for what is missing: « la capacité à refraser quand je ne comprends pas … recommence du début » |
| `asks_callback` ≥ 0.7 | notes the callback and says so: "D'accord, l'agent te rappellera". The agent calls back with the same question and its context, in discussion mode. On call `8d8d3f50`, « Demande à l'agent qu'il me rappelle » read `ask_agent` at 0.39 and was not noted |
| `mid_thought` ≥ 0.7 | says nothing and lengthens the next silence window |
| `move` = `ask_agent` with confidence ≥ 0.6 | asks the agent at once (`phone_answer`, section 5) and says its answer if it comes within `ask_wait_s` (20 by default); otherwise says the agent will look and call back, and the agent does. Jerry settled Q-D on call `7292c704`: « Je crois qu'elle peut aller lui demander tout de suite », and asked whether an agent without the answer « peut se questionner lui-même et me revenir » |
| `move` = `not_to_line` with confidence ≥ 0.6 | says nothing, keeps listening |
| anything else | the next acknowledgement, as today |

**When Jev is not there.** A request that fails with 422 is never resent. 429, 502, 503 and 529 are resent with backoff while the next sentence is heard. 504, a timeout or a lost connection may already be charged, so they are never replayed (Episode 564's rule). For that sentence the line uses the prototype's patterns, with one change: a pattern that ends the call is not applied to a sentence that is itself a question.

**Latency.** Each request records how long it took. The speech-loop budget of the prototype (`boucle-parole.spec.md`: under 0.8 s a turn is acceptable) is the measure. The first build reports the distribution of Jev's latency on real calls before any claim about milliseconds is made.

## 4. The calls

**Outgoing, discussion mode**: the prototype's flow. The voice knows only the point and its context, reads back the answer, returns only what the person confirmed.

**Outgoing, relay mode**: the prototype's flow, with section 3's decisions. Everything the person said is returned word for word, with the decisions beside it.

**Inbound**: the person calls `inbound_extension`. The voice says one sentence of welcome, the same decisions apply (`finished` ends the call), and the words arrive in the agent's inbox (section 5).

**Rules before ringing** (unchanged): hours, interval, no second call for an unanswered question with the same fingerprint, and, new, a refusal with its reason when the phone is not registered.

## 4b. How a call ends, and how the loop closes

A call ends in one of three ways, and the record says which (`closed_on`):

1. **The person says so**, in any words: « je suis over », « c'est tout », « terminé », « tu peux envoyer ». Jev reads it (`is_finished`, or `move` = `finished`, section 3) and the line closes. `closed_on: words`.
2. **Silence.** Time is measured in code, never by Jev, which does not count. After the line has said its point or an acknowledgement, if no speech comes for `silence_ask_s` (6 by default; Jerry, call `7292c704`: « six secondes, ça semble assez bien. C'est un délai raisonnable »), the line asks once « Est-ce que c'est tout ? ». If no speech comes for `silence_close_s` (6 by default) after that, it closes. A silence is not read as an answer. `closed_on: silence`.
3. **The connection ends**: the person hangs up or leaves the page. What was said is kept and passed on, as the prototype already does. `closed_on: hangup`.

**The calling loop** is complete only when the person has heard the agent's reply to what they said:

1. The voice says it passes everything on.
2. The agent receives the words, word for word in relay mode or the confirmed answer in discussion mode, with every decision beside them.
3. The agent replies to the person: on the same page (the companion's page already asks for a reply every 4 seconds), by text, or at the start of its next call. The reply says what the agent understood and what it will do.
4. The call's record closes with `closed_on`, the reply's reference (`reply_ref`) and the loop's state: `answered` when the reply reached the person, `unanswered` when no reply came within `reply_within_min` (30 by default), which the agent's next session is told at its start.

## 5. What the agent gets: MCP tools

An MCP server, so the same tools serve Claude Code and Codex. Every agent that has the plugin may call the person when the person needs to know something or decide; the person may name agents that never call. Jerry, call `4bbd87c1`: « je crois que tous les agents pourraient appeler … C'est vraiment quand j'ai besoin d'être au courant, de prendre une décision ». He named no agent that must never call. A call returns at once and the agent keeps working; no tool holds a shell for the length of a call.

| tool | input | output |
|---|---|---|
| `phone_line` | | `{person, registered, hours, next_allowed_at}` |
| `phone_call` | `question`, `context?`, `mode` (`discuss` or `relay`), `link?`, `work?` | `{call_id, status: "ringing"}` or `{status: "refused", reason}` |
| `phone_status` | `call_id` | `{state: ringing | in_call | ended, elapsed_s}` |
| `phone_result` | `call_id`, `wait_s?` | `{outcome, answer | words, discussion[], decisions[]}` |
| `phone_inbox` | `wait_s?` | what the person said on the inbound line or texted, each marked `voice` or `text`, not yet read |
| `phone_text` | `message` | `{sent}` |
| `phone_answer` | `call_id`, `question_id`, `text` | the agent's answer to a question asked during the call, spoken by the line if it arrives within `ask_wait_s` |
| `phone_reply` | `call_id`, `text` | `{delivered_by: "page" | "text" | "next_call", loop_state}`: the agent's reply that closes the calling loop (section 4b) |
| `phone_calls` | `limit?` | the register, newest first |

## 6. What the plugin carries besides the server

**Skills.**
- `call-my-person`: when to call and when not to, how to write a question for the ear and a context for a discussion, relay or discussion, one question at a time when there are several. Inspired by `appeler-jerry` and made generic, with the person to call as an argument: Jerry settled Q-B on call `4bbd87c1`, « on peut s'en inspirer et la rendre utilisable … on va utiliser un mot plus générique et avoir un argument avec le nom de la personne qu'on va appeler ».
- `line-setup`: the extension, the audio bridge, the phone app's registration, the transcription and voice keys, with the audible sign that proves each step (from the prototype's `INSTALLATION.md` and `poste-interne.spec.md`).
- `call-review`: read a finished call, decision by decision, and record a ruling on each (section 7).

**Hooks.**
- SessionStart: one line telling the agent the line exists, the person's hours and whether the phone is registered now.
- UserPromptSubmit and PostToolUse: what the person said on the inbound line or texted reaches the session at its next continuation as additional context. The delivery uses the steering inbox of `miadi-session-observability` (`miadi.steering/1`), one envelope per inbound message, so a person's call is a prompt like any other.
- Stop: when the agent's last reply ends on a question to the person and the person has typed nothing for a set time, the hook adds one line: the person is away, and `phone_call` is there. The hook never places a call (`02-intent.md` boundary 6).
- PostToolUse on `phone_result`: the call's record is copied into the session's capture (`<root>/<session>/calls/<call_id>.json`), so session observability holds the calls of the session.

## 7. Records

**CallRecord**, in the person's account: the prototype's fields (`id`, `heure`, `question`, `contexte`, `travail`, `discussion`, `réponse`, `dénouement`, `raison`, `durée_s`, `empreinte`) plus `mode`, `decisions[]`, `person`, `closed_on` (`words`, `silence` or `hangup`), `reply_ref` and `loop_state` (`answered` or `unanswered`).

**DecisionRecord**, one per sentence, in a ledger beside the register: `call_id`, `index`, `move` with its probabilities and confidence, the four nouls, `option_order`, the band applied, `latency_ms`, `requested_model` and `model`, `run_id` and the paid tokens. The sentence itself stays in the CallRecord, in the person's account.

**Ruling**: after a call, the person or the agent marks a decision `confirm` or `override` with the right reading (`call-review`). A ruling names the decision by its id. Twenty rulings in one class are what set that class's threshold (Episode 564's study, S5).

**Events.** `call.placed`, `call.decision`, `call.ended` as envelopes for the factory's event path (`@miadi/hooks-core`), and as mentorship events when a mentor seat follows the person (`claude/miadi-mentorship`). They carry ids, counts, decisions and durations. The person's words travel only with their consent.

## 8. Creative advancement scenarios

**Creative Advancement Scenario**: The person asks to hear the questions again

**User Intent**: The agent needs three answers from the person, who is in the kitchen.
**Current Reality**: The agent's work waits on the three choices; the person's phone is registered.
**Natural Progression Steps**:
  1. The agent checks `phone_line`, then places a relay call with the three questions.
  2. The person says « Il va falloir que tu me répètes les questions ». Jev reads `asks_repeat` high; the voice says the first question alone and waits.
  3. The person answers it; the voice says the second, then the third.
  4. The person says « Terminé ». Jev reads `is_finished` high; the voice says it passes everything on and hangs up.
**Achieved Outcome**: The agent receives three answers, word for word, with each decision beside them.
**Supporting Features**: Jev's `asks_repeat` and `is_finished`, the point stored as separate questions, `phone_result`.

**Creative Advancement Scenario**: The person calls with an idea still forming

**User Intent**: The person wants to give the agent a direction while cooking.
**Current Reality**: The agent is working in a session; the person is away from the screen.
**Natural Progression Steps**:
  1. The person calls the inbound extension and starts describing an idea, pausing to think.
  2. Jev reads `mid_thought` high on the paused sentence; the voice stays silent and the line waits longer.
  3. The person finishes the idea and says « c'est tout, tu peux l'envoyer ».
  4. The words reach the running session at its next continuation through the steering inbox.
**Achieved Outcome**: The idea arrives whole, in the person's words, as the session's next prompt.
**Supporting Features**: continuity of listening, the inbound line, the UserPromptSubmit and PostToolUse hooks.

**Creative Advancement Scenario**: The phone is not on the line

**User Intent**: The agent needs a decision but should not ring a phone that cannot answer.
**Current Reality**: The phone app is closed; the extension has no registered device.
**Natural Progression Steps**:
  1. The agent asks `phone_line`, which answers `registered: false`.
  2. The agent sends a `phone_text` saying a question waits, and keeps working.
  3. When the phone registers, `phone_line` says so and the agent places the call.
**Achieved Outcome**: No call rings into nothing; the person learns a question waits.
**Supporting Features**: line readiness, `phone_text`, the refusal reason "not registered".

**Creative Advancement Scenario**: The person says « je suis over » on the phone page, and hears the agent's reply

**User Intent**: The person answers an agent's question from the phone page while walking, and wants to know it was heard.
**Current Reality**: The agent placed a call through the page; the page sends a part every 2 seconds during the call and keeps every 10 seconds of it.
**Natural Progression Steps**:
  1. The person answers in three sentences, pausing once; the server finds each pause and Jev reads each sentence, and on the pause `mid_thought` keeps the line quiet.
  2. The person says « OK, je suis over ». Jev reads it as finished; the line says it passes everything on.
  3. The agent receives the words with the decisions, replies with `phone_reply`, and the reply appears on the same page within seconds.
**Achieved Outcome**: The call's record reads `closed_on: words` and `loop_state: answered`; the person heard what the agent understood and what it will do.
**Supporting Features**: the two windows (2b), Jev per sentence (3), the closing of the loop (4b), `phone_reply`.
