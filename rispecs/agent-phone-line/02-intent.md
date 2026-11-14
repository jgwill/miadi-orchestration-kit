# 02 — Intent

## Desired outcome

An agent and its person talk by phone as easily as they type. When the agent reaches a decision that belongs to the person, it calls; the person answers in their own words, can ask to hear the question again, says they are done in whatever words come to them, and the agent receives exactly what was said or what was confirmed. When the person has something to say, they call the agent and it arrives as a prompt. Every call is kept: its question, its words, how it ended, and each decision the line took during it.

How the person knows it works: they never have to learn a magic word, and they never hang up wondering whether they were heard.

## Current reality

Jerry's prototype (`01-reverse-engineer.md`) already reaches the person: the phone rings, the line transcribes well, the agent receives the words. It lives in one account, for one person ("Jerry" is in the command's name), as scripts and one skill. During a call, every judgment about what the person means is a fixed pattern. In the call of 2026-11-14, a request to repeat was acknowledged with « D'accord, continue », three ways of saying "I'm done" were not heard, and the call ended because « j'ai fini » appeared inside a question about how to end it.

## The tension

Between a line that hears every word and a line that understands what each sentence asks of it. The prototype tried a conversational model for that understanding and found it slow and too eager to talk; it fell back to patterns. The decision model studied in Episode 564 (miadi-chronicle://564), Jev, answers typed questions about a piece of text with calibrated numbers and no prose. Seven questions on a short state cost between 960 and 1,041 paid input tokens per call on 2026-11-14 (Episode 564's `advance-gate-261114/ledger-261114.jsonl` and the live ledger). It can read each sentence the moment it is transcribed and say, as a number, whether it asks for a repeat, ends the call, or needs the agent, while the line keeps listening.

## What this does for the people

- The person talks the way they talk. "Terminé", "tu peux envoyer", "non, c'est tout", "done" all end a call.
- The person can ask "répète" at any time and hears the point again, one question at a time.
- The agent receives words it can trust: confirmed, or word for word, never a summary the person did not hear.
- Guillaume, Jerry and the agents can read every call afterwards, and every decision the line made in it.

## Boundaries

1. **The person's phone, the person's hours.** Calls only in the hours and at the interval the person set, never twice for the same unanswered question. These rules from the prototype stay.
2. **The voice is not the agent.** It knows the question and its context and nothing else. It never decides for the person and never invents an answer.
3. **What leaves the host is named.** Each transcribed sentence goes to the transcription service, and each sentence with the agent's point goes to the decision model. The person is told this once, before the first call.
4. **Numbers do not settle a person's choice.** Jev decides how the line behaves (repeat, keep listening, close, pass on). It never decides what the person meant to answer.
5. **The call's words belong to the person.** They are recorded in the person's own account. Events that leave the account carry counts and decisions, and the words only when the person has agreed.
6. **A call is placed by the agent's explicit act**, never by a hook on its own. A hook may suggest a call; the agent decides, under the rules above.

## Open questions

- Q-A. The plugin's name. "agent-phone-line" is a working name for this folder. Jerry, call `4bbd87c1`, asked whether to keep his repository's name: « Oui, on garde ce nom » (`assembly-call`). The kit's name waits for Guillaume.
- Q-B. Settled by Jerry on 2026-11-14: the skill is inspired by `appeler-jerry` and made generic, the person to call an argument (`03-specify.md`, section 6). The prototype and its specifications are Jerry's.
- Q-C. Which Jev model and which thresholds. `jev-1.14.0` pinned, thresholds null until rulings set them (Episode 564's practice).
- Q-D. Settled by Jerry on 2026-11-14: the line asks the agent at once, and an agent that needs time calls back (`03-specify.md`, section 3).
- Q-E. The listening window and the pause that ends a sentence on a phone page (`03-specify.md` section 2b), and the two silences that close a call (section 4b), set from measured calls.
