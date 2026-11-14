# Agent phone line (working name)

A RISE packet for a plugin that gives an agent a phone line to its person: the agent calls when a decision is the person's, the person calls the agent with a prompt, and Jev, the decision model of Episode 564 (miadi-chronicle://564), reads each transcribed sentence during the call to decide whether to repeat, keep listening, close, or note a question for the agent.

Reverse-engineered from Jerry's prototype `Gerico1007/assembly-call` (the "agent-telephone", in Jerry's account on eury), and from its call `1fa8c5ec` of 2026-11-14, in which a request to repeat and three ways of saying "I'm done" were not heard. The prototype and its own French specifications are Jerry's.

Status: specified; prototyped by Jerry's agent on branch `jev-dans-le-relais` of Gerico1007/assembly-call (`a28adbe`), whose replay of call `1fa8c5ec` passed acceptance 1 on 2026-11-14 (Episode 576, `jev-replay-1fa8c5ec.md`). The neutral acknowledgement during the Jev request is not built yet. Jerry gave his feedback on the next generation by phone the same afternoon (Episode 576, `feedback-next-generation-261114.md`); eight of his answers are in the specification, and the name waits for Guillaume. Issue: jgwill/miadi-orchestration-kit#154. Asked for by Guillaume on 2026-11-14; his words and the decomposition are in `.pde/2611141514--b47769d5-6a45-4c4f-a7f4-cd3fad02678f/`.

## Desired outcome

An agent and its person talk by phone as easily as they type. The person never has to learn a magic word, can ask to hear a question again, and never hangs up wondering whether they were heard. Every call, and every decision the line took in it, is kept in the person's account.

## Files

| file | phase | holds |
|---|---|---|
| `01-reverse-engineer.md` | R | what the prototype does, its machinery, the patterns worth keeping, call `1fa8c5ec` sentence by sentence |
| `02-intent.md` | I | desired outcome, current reality, the tension, boundaries, open questions Q-A to Q-D |
| `03-specify.md` | S | the person and the line, hearing, Jev in the loop (state, questions, bands, failures, latency), the calls, the MCP tools, skills and hooks, records and events, three creative advancement scenarios |
| `04-export.md` | E | where the plugin would live, acceptance (a replay of call `1fa8c5ec` first), where the export is recorded |
| `05-source-ledger.md` | | each claim with its source and confidence |

## Acceptance

1. Call `1fa8c5ec` replays correctly against live Jev: the questions are said again after sentence 2, the call closes by sentence 4 to 6, and a question containing « j'ai fini » does not close it.
2. Another agent can build the plugin from `03-specify.md` and `04-export.md` alone.
3. Nothing rings when the phone is not registered, outside the person's hours, or twice for the same unanswered question.
4. The person's words leave their account only with their consent; events carry ids, counts and decisions.

## Related

- `rispecs/hosted-witness-service/` and `claude/miadi-mentorship/`: the relationship between a mentor seat and a person, whose events would include calls.
- `claude/miadi-session-observability/`: the steering inbox an inbound call reaches a session through, and the capture a call's record is copied into.
- Episode 564 (miadi-chronicle://564): `jev-study-261026.md` and `advance-gate-261114/`.
