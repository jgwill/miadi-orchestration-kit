# 05 — Source ledger

Read 2026-11-14 on eury by the Mia seat (Claude Code session `f08783a7`, miadi-tmux://mia@eury/miette), with read-only access to the `gmusic` account (`sudo -n -u gmusic`).

| claim | source | confidence |
|---|---|---|
| The prototype is `Gerico1007/assembly-call`, cloned at `/home/gmusic/salix/production/agent-telephone`, last commit `f9d57ba` | `git remote -v`, `git log` in the clone | read |
| `appeler-jerry` runs `ligne/appeler_jerry.py` with `~/.env` loaded | `/home/gmusic/.local/bin/appeler-jerry` (4 lines) | read |
| The skill `appeler-jerry`: when to call, writing for the ear, background run, relay mode | `skills/appeler-jerry/SKILL.md`, linked from `~/.claude/skills/appeler-jerry` | read |
| Audio over AudioSocket, 8 kHz 16-bit mono, 20 ms frames | `ligne/voix.py` docstring | read |
| Sentence end: RMS threshold 600, 40 silent frames (800 ms) | `ligne/voix.py` lines 26 and 28 | read |
| Transcription: Groq `whisper-large-v3-turbo`, French; phantom filter | `ligne/voix.py` lines 23, 41-42, 72-77 | read |
| Voice: `edge_tts`; discussion model `claude -p --tools ""` with `POSTE_MODELE` (Haiku by default) | `ligne/voix.py` lines 18, 22, 86, 113 | read |
| Relay loop, its five acknowledgements and `FIN_RELAIS` | `ligne/appeler_jerry.py` lines 243-268, `ligne/voix.py` lines 47-49 | read |
| `CLOTURE`, `FIN_APPEL`, hours 8-22, interval 10 min, ring 45 s | `ligne/appeler_jerry.py` lines 37-48 | read |
| Inbound extension 200 relays word for word; Jerry's decision of 2026-10-18 | `ligne/poste_agent.py` docstring | read |
| Texts both ways, marked (texto) and (voix) | `ligne/texto.py` docstring | read |
| The register's fields | last line of `~/.local/state/agent-telephone/appels.jsonl` | read |
| Call `1fa8c5ec`: relay, 125 s, `répondu`, its eighteen lines of discussion | the register's line for `1fa8c5ec` | read |
| Calls at 14:19 and 14:20 rang with no phone registered | `jerry-answers-261114.md` in the chronicle staging folder `jerry-label-musical-belt-261114/`, written by the Miette seat of the `gmusic` account | reported by that seat |
| The prototype's intent sentences (value of a decision decays, the speech-loop budget) | `rispecs/appel-sortant.spec.md`, `rispecs/boucle-parole.spec.md` | read |
| Jev: typed questions, `choice` confidence formula, noul as probability, 32k limit for state plus a question, option-order lean, failure and replay rules, pinned models | Episode 564 (miadi-chronicle://564) `jev-study-261026.md`, parts 1.2 to 1.7 | read |
| Seven-question Jev calls cost 960 to 1,041 paid input tokens on 2026-11-14 | `~/.miadi/decisions/advance-gate.jsonl` (the mia account) | measured |
| The steering inbox and its contract `miadi.steering/1` | `claude/miadi-session-observability/hooks/steering_inbox.mjs` | read |
| The event envelope | jgwill/Miadi `packages/hooks-core/src/envelope.ts` | read |
| Jev's latency per request on a phone call | | **not measured**: the first build measures it |
