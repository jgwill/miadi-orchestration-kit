# 05 · Source ledger

## Measurements (session `5ffaf964-f4cb-470d-a1da-35fdd040073a`, 2026-11-19 near 12:35Z, gaia, mia)

| Claim | Source | Confidence |
|---|---|---|
| 5118 binding lines, 3760 starts, 1133 ends, 2026-09-28 to 2026-11-19 | `jq -r .event` over `/src/_sessiondata/data/terminal_bindings.jsonl` | measured |
| 1002 interactive sessions, 520 with an end line, 482 without | `jq` on start and end lines filtered on `argv` without `-p`/`--print`, `comm -23` of the two id lists | measured |
| End reasons 517 / 172 / 26 / 2 / 1 interactive, 415 `other` headless | `jq` on `select(.event=="session.end") \| .source`, split on `argv` | measured |
| Start sources, 2295 `resume` | `jq` on `select(.event=="session.start") \| .source` | measured |
| 3189 of 3312 interactive start lines name no `--model` | `jq` on `argv` | measured |
| Inventory status, disposition and end-capture counts, 465 records, 0 `exit` blocks | `jq` over `~/workspace/.mino/session-inventory/*.json` | measured |
| inventory-at-exit decisions 23 / 1 / 6 / 20 / 4 | `jq` over `~/.miadi/decisions/inventory-at-exit.jsonl` | measured |
| `digest` and `session` carry no model and no end reason | `miadi-hooks-interpret digest <id> --json \| jq keys`, same for `session`, `@miadi/hooks-interpreter` 0.12.0 | measured |
| The session's model is in `_claude_session_starts.jsonl` and the transcript | this session's own capture, read before the guard refusal, `claude-opus-5-5` in both | measured, one session |
| The raw read of `*/_claude_SessionEnd.jsonl` is refused | `session_lookup_guard.sh` refusal in this session | observed |
| A read through a shell variable passes the guard | same session, earlier call | observed, one case |
| The 482 sessions with no end line were killed, crashed or are running | inference from the binding line alone | hypothesis, not checked per session |

## Cases quoted

| Case | Source |
|---|---|
| Session `675a74db` on Sonnet 5.5 for 120 replies, launched with no `--model` | jgwill/Miadi#1060 body, 2026-11-19 |
| `work_proposal:376ea1ae` launched on Sonnet below its model floor | jgwill/Miadi#1028 body, 2026-11-15 |

## Related issues

| Issue | Relation |
|---|---|
| jgwill/miadi-orchestration-kit#56 | The capture plugin, where S1 lives and the S3 guard text goes |
| jgwill/miadi-orchestration-kit#76 | A session's team fit and proposed ending, written by the inventory ritual |
| jgwill/miadi-orchestration-kit#89 | The session issue that comments at each exit, a second place an exit is told |
| jgwill/Miadi#1060 | `mct new` launches name their model: the first `wrong_model` condition |
| jgwill/Miadi#1028 | A model floor in a request's words is not met: a second `wrong_model` condition |
| jgwill/Miadi#1008 | A mission's model chosen from the request's size and clarity |
| jgwill/Miadi#913 | Jev-aware model-choice preflight |
| jgwill/Miadi#746 | Every inventoried session carries its team fit and its ending |
| jgwill/Miadi#806 | JEV shadow study on closure readiness: separates `session.exited` from `cycle.completed` |
| jgwill/Miadi#805 | An offline evaluation dataset for handoffs and closure, which S4's pass files can feed |
| jgwill/Miadi#857 | Durable session suspension and accountable return |
| jgwill/Miadi#869 | A seat returning from a failure is given its mission with a briefing |
| jgwill/gaia#90, jgwill/gaia#97 | After a crash or reset, the sessions and missions that were running come back |

## Still to confirm

- Whether the `other` end reason of 172 interactive sessions includes tmux kills, reboots and
  remote-control closes, or only some of them. S3's `last_seen` per session answers it.
- Whether Codex sessions (`_codex_*`) end with a reason the interpreter can read. This packet
  measured Claude Code sessions only.
