# 01 — Reverse engineering: Jerry's agent telephone

The prototype is Jerry's repository `Gerico1007/assembly-call` (folder name "agent-telephone"), read on 2026-11-14 in its clone `/home/gmusic/salix/production/agent-telephone` on eury, at commit `f9d57ba`. It carries its own RISE specifications in French (`rispecs/app.specs.md` first). This file records what it does, what it enables, and the call that showed where it stops. Every claim is in `05-source-ledger.md`.

## What it enables

A person away from the screen and an agent at work can reach each other by voice. The prototype's own sentence: a front door receives a call and hands it to a speech loop that listens, consults the agent and answers aloud; the same door serves the other way when the agent has a question (`README.md`). Its outgoing-call spec names the value: "la valeur d'une décision humaine décroît avec le temps", a question asked at the right moment is worth an hour of work, the same question found the next day in a terminal is worth a restart (`rispecs/appel-sortant.spec.md`).

## The flows

| flow | what happens | where |
|---|---|---|
| The agent calls, discussion mode | The kitchen speaker announces the call, the phone (extension 100) rings, and a voice that knows only the agent's question and the context it was given discusses it with the person. When the person says « c'est ma réponse », the voice summarizes, reads it back, and only the confirmed answer returns to the agent. | `ligne/appeler_jerry.py` `discuter`, skill `appeler-jerry` |
| The agent calls, relay mode (`--relais`) | The voice says the agent's point, can send a visual to the phone, acknowledges briefly while the person talks, and returns everything said, word for word. It does not try to understand. Jerry's word: the small model was "slow-witted". | `appeler_jerry.py` `relayer` |
| The person calls the agent (extension 200) | The voice listens, acknowledges and drops everything said, word for word, into the agent's box. Jerry's decision of 2026-10-18: « je veux juste qu'il reçoive le prompt et te l'envoie ». | `ligne/poste_agent.py` |
| Text both ways | `texto-jerry envoyer|lire|attendre`: SIP messages in baresip to extension 100, replies to 200, read with what was said by voice, each marked (texto) or (voix). | `ligne/texto.py` |

## The machinery

- Telephony: Asterisk on eury hands each call over AudioSocket (TCP), raw 8 kHz 16-bit mono audio in 20 ms frames, both ways (`ligne/voix.py`).
- Listening: a sentence ends after 40 silent frames (800 ms) under an RMS threshold of 600, or at a frame maximum. Each sentence goes to Groq's `whisper-large-v3-turbo` in French. Whisper's inventions on silence ("merci d'avoir regardé", lone dots) are dropped as phantoms.
- Speaking: `edge-tts`.
- Thinking, in discussion mode only: `claude -p --tools ""` with a Haiku model (`POSTE_MODELE`).
- Ending: regular expressions. Discussion mode closes on `CLOTURE` (« c'est ma réponse », « tu peux l'envoyer »…) or `FIN_APPEL` (« au revoir », « bye »…). Relay mode closes on `FIN_RELAIS` (« c'est tout », « j'ai fini », « envoie ça »…). Any other sentence in relay mode gets the next of five fixed acknowledgements: « Je note. », « D'accord, continue. », « Oui. », « Je t'écoute. », « Noté. Autre chose ? ».
- Rules before a call: allowed hours (`APPEL_HEURES`, 8 to 22), a minimum interval (`APPEL_INTERVALLE_MIN`, 10 minutes), and a refusal to ring again for a question already asked without answer (a fingerprint of the question).
- The register: `~/.local/state/agent-telephone/appels.jsonl`, one line per call: `id`, `heure`, `question`, `contexte`, `travail`, `discussion`, `réponse`, `dénouement`, `raison`, `durée_s`, `empreinte`.

## Patterns worth keeping

1. **The voice is not the agent.** It knows the question and its context, nothing else, and says so when asked beyond it. The agent interprets with its full context.
2. **Only what the person confirmed, or everything word for word.** Never a paraphrase the person did not hear.
3. **One door, both directions**, and the free internal extension is the first half of a rented number, not a draft of it.
4. **The register** keeps every call with its question, the discussion and how it ended.
5. **Rules that protect the person**: hours, interval, no second ring for the same unanswered question.

## The call that showed the limit (2026-11-14)

Call `1fa8c5ec`, 14:36 EST, relay mode, 125 seconds, placed by the Miette seat in the `gmusic` account with three questions for Jerry. The register keeps the whole discussion. Each of Jerry's sentences as Whisper returned it, the voice's answer, and what he meant:

| # | Jerry | the voice | what he meant |
|---|---|---|---|
| 1 | « Salut ! » | « Je note. » | a greeting |
| 2 | « Il va falloir que tu me répètes les questions. Relance-moi ça, voir si tu es capable. » | « D'accord, continue. » | **say the questions again** |
| 3 | « Ok, donc on a une amélioration quand même possible, mais si je ne me trompe pas les questions, tu posais si je dois signer ce que Jamai fait. Quand c'est des brouillons, […] moi je dois y signer. » | « Oui. » | an answer, to the one question he remembered |
| 4 | « Tu peux envoyer mes réponses. » | « Je t'écoute. » | **finished, send it** |
| 5 | « Terminé. » | « Noté. Autre chose ? » | **finished** |
| 6 | « Non. » | « Je note. » | **nothing else, finished** |
| 7 | « On en voit. » | « D'accord, continue. » | unclear (a transcription of something short) |
| 8 | « Je ne me souviens plus, c'est quoi le mot qu'il faut que je te dise pour dire que j'ai fini? End up. Close. Finish. Done. » | « Je transmets tout ce que tu as dit. À bientôt. » | **finished**, and a question about the end word |

The call ended at sentence 8 because `FIN_RELAIS` matched « j'ai fini » inside his question about which word ends the call. Sentences 4, 5 and 6 each said he was done, and none matched. Sentence 2 asked to hear the questions again, and relay mode has no way to say its point twice.

Two calls before it, at 14:19 and 14:20, rang with no phone registered on extension 100. The agent had no way to know beforehand.

What it shows: the line hears well and transcribes well. What it lacks is a judgment, after each sentence, of what the person means to do: go on, hear it again, finish, or ask the agent something. Fixed patterns cannot hold that judgment, and a conversational model was too slow and too eager. A typed decision model in the loop can, which is what `02-intent.md` sets out.

## A second prototype: the companion's phone page

`claude/mia-episode-companion/phone-capture/` in this kit records a person's voice in a phone's browser and lands each take in an episode. Read on 2026-11-14 (`public/index.html`, `server.mjs`, `test/phone-capture.test.mjs`). It solves a problem the phone line will meet once a call is a page instead of a ring: not losing what was said while it is still being said.

- The page's recorder cuts the audio into one-second slices (`recorder.start(1000)`).
- Every 10 seconds (`PART_EVERY_MS = 10000`) the page sends the bytes the server does not hold yet: `POST /api/takes/part?rec=<id>&offset=<bytes the page believes the server holds>`.
- The server appends without harm: a part sent twice changes nothing, an overlapping part keeps only its new tail, and a part past the end is answered 409 with the bytes the server holds. The page's offset moves only when the server says so.
- When the recorder fails, or the person leaves the page, what was sent is kept and becomes a take by itself.
- The rule came from a loss: "a few minutes of recording were lost when the recorder failed at Stop. The page now sends what it captured every 10 seconds" (Ada, Episode 120 (miadi-chronicle://120), 2026-10-12, in the test file).
- The page asks for the agent's reply every 4 seconds while it waits, and every 10 seconds otherwise, so the person hears the agent answer on the same page.

What it adds to the line: a door without a phone number, where the person speaks in a page, the server holds every ten seconds of it, and the agent's answer comes back to the same page. That door ends what it hears only when the person presses Stop; the phone line's specification gives it a way to know without a button (`03-specify.md`, sections 2b and 4b).
