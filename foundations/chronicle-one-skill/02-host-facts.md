# 02. Host facts: every literal in the two lineages, and the name that replaces it

Written 2026-09-04 (Lane A). After this file, the one skill names no host. Each row is a literal path, port, host name, or version claim found in `/etc/claude-code/skills/chronicle-episode/SKILL.md` (G) or `/home/mia/.agents/skills/chronicle-episode/SKILL.md` (I), the environment name or measure-it command that replaces it, and what that name held on Gaia when measured this turn. The measured column is a record, never a value for the skill to carry.

## Paths

| literal | where | is | replaced by | measured on Gaia 2026-09-04 |
|---|---|---|---|---|
| `/srv/miadi/episodes/miadi-chronicle` | G:48,53,267,366 | the episode ledger | `$MIADI_CHRONICLE_ROOT` | `/srv/miadi/episodes/miadi-chronicle` |
| `/srv/miadi/episodes` | G:27,28,48,289,294 | the git root, one level above the ledger | `GIT_ROOT="$(git -C "$MIADI_CHRONICLE_ROOT" rev-parse --show-toplevel)"` | `/srv/miadi/episodes`; origin `ssh://mia@gaia:/srv/git/jgwill/episodes.git` |
| `miadi-chronicle/<name>` as a git pathspec | G:27,289-291 | the ledger's directory name inside the git root | `LEDGER="$(basename "$MIADI_CHRONICLE_ROOT")"` then `"$LEDGER/$EP"` | `miadi-chronicle` |
| `/data/data/com.termux/files/srv/miadi/episodes` | I:25,76 | the git root on Ilex | same `rev-parse` | not this host |
| `/data/data/com.termux/files/srv/miadi/episodes/miadi-chronicle` | I:18-19,26,77,91 | the ledger on Ilex | `$MIADI_CHRONICLE_ROOT` | not this host |
| `…/miadi-chronicle/AGENTS.md`, `…/miadi-chronicle/CLAUDE.md`, `…/episodes/CLAUDE.md` | I:18-20; G:344-345 | the chronicle's operating law | `$MIADI_CHRONICLE_ROOT/AGENTS.md`, `$MIADI_CHRONICLE_ROOT/CLAUDE.md`, `$GIT_ROOT/CLAUDE.md` | all three exist; `$GIT_ROOT/CLAUDE.md:9` names the commit trailers |
| `/home/mia/.agents/skills/chronicle-episode` | G:12 | the Ilex lineage | none: the one skill replaces both | exists, 172 lines |
| `/etc/claude-code/skills/chronicle-episode` | I:12; G:277,299 | the Gaia lineage and its scripts | `<skill-dir>` = the directory holding SKILL.md (`${CLAUDE_PLUGIN_ROOT}/skills/chronicle-episode` as a plugin) | exists, 395 lines, with `redeem-receipt.sh`, `redeem-receipt.mjs`, `reconcile.py` |
| `/etc/claude-code/skills/chronicle-episode-closing/redeem-receipt.sh` | not in either skill; `voice-mcp/src/closing.ts:278` | the owed action the closing report prints | `<skill-dir>/redeem-receipt.sh`; the code path is stale | directory does not exist |
| `$MIADI_SRC`, `/a/src/Miadi`, `/src/Miadi`, `/a/src/Miadi-18` | G:77-83,367; I: none | the Miadi checkout and its symlinks | `$MIADI_SRC`; source run `node "$MIADI_SRC/packages/passages/js/mkepisode.js"` | `MIADI_SRC=/src/Miadi`; `/a/src/Miadi` resolves to the same tree |
| `/usr/local/src/mightyeagle/packages/passages/js/mkepisode.js` | G:85 | a second checkout | dropped (jgwill/Miadi#621 measured it current on 2026-08-16) | not measured |
| `/opt/binscripts/etc/bash_env_common` (`:852`) | G:262,352,365 | the login profile that authors `MIADI_*` | "the host's login profile authors the names"; no path | exists |
| `$MIADI_SRC/etc/mcp-config-voice.json`, `mcp-config-mw-ilex.json`, `/etc/claude-code/mcp-config-miadi-agent.json` | G:354-356,389 | the `.mcp.json` files that hand a subset of env to MCP subprocesses | "an MCP subprocess sees only what its config passes; call the tool" | not re-read |
| `/srv/miadi/voice-audio` | G:371 | voice audio dir | `$MIADI_ASSEMBLY_VOICE_AUDIO_DIR`; not this skill's (kin: miadi-voice) | `/srv/miadi/voice-audio` |
| `/chronicle/<name>` | G:254 | the room's route | `inquiry-weave resolve "miadi-chronicle:<N>"` prints every door | doors: local `$MIADI_WEB_URL`, tailnet `$MIADI_URL_BASE_INTERNAL`, public `$MIADI_URL_BASE` (chronicle-terminal.ts:217-221) |
| `GET /api/chronicle/attention` | G:232 | the Attention HTTP door | `$MIADI_API_URL/api/chronicle/attention` | route exists; `?capabilities=1` answered `{"view":true,"answer":false}` from this shell |
| `<episode>/captures/<take-stem>/…` | I:139-148 | capture custody layout | kept as a vessel-relative layout (no host in it) | present in ep094, ep333, ep337 |
| `medicine-wheel/mcp/src/store.ts` | G:37 | the JSONL fallback that makes the wheel MCP unfit for stage 4 | kept as a code cite (not a host path) | not re-read |
| `packages/inquiry-weave/src/episode.ts`, `episodeRoom.ts`, `validate.js:18`, `closing.ts:11` | G:105,178,167,191 | code cites | kept as cites, re-measured | see 01-lineage-map |

## Hosts and ports

| literal | where | is | replaced by | measured on Gaia 2026-09-04 |
|---|---|---|---|---|
| `http://127.0.0.1:8040` | G:363,377; I:27,92 | the chronicle wheel (an ssh tunnel from Ilex, per `miadi-stack-map`) | `$MIADI_CHRONICLE_MW_URL` | `http://127.0.0.1:8040`; `GET /api/nodes/chronicle:miadi-chronicle` answered 200 |
| `http://127.0.0.1:8040` compiled in | `inquiry-weave/src/env.ts:10` (`DEFAULT_MW_URL`), `voice-mcp/src/closing.ts:38` (error text), `redeem-receipt.sh:17`, `reconcile.py:33` | fallback defaults inside the tools | set `MIADI_CHRONICLE_MW_URL`; the skill never relies on a compiled default | present in code |
| `http://127.0.0.1:8031` | I:28 | Forgewright | `$MIADI_CHRONICLE_FW_URL`; no verb in the one skill needs it | `MIADI_CHRONICLE_FW_URL=http://127.0.0.1:8031` |
| `http://127.0.0.1:3335` | G:368-369 | the Miadi app (`MIADI_API_URL`, `MIADI_INQUIRY_API_BASE`) | `$MIADI_API_URL`, `$MIADI_INQUIRY_API_BASE` | both are `https://miadi.tail3b11eb.ts.net` in this shell, not `:3335`; `chronicle-terminal.ts:184` still names `:3335` as the local default |
| `https://mw.tail3b11eb.ts.net`, `tail3b11eb` | G:264-270,311; `closing.ts:28`, `redeem-receipt.sh:35`, `reconcile.py:38` | the retired Gaia ceremony wheel, offline since 2026-07-29 | kept as the one refusal literal: receipts carry the string, and detection is a string match the three tools already perform | `grep -l tail3b11eb $MIADI_CHRONICLE_ROOT/*/.mw-registration.json` is the probe |
| `MW_API_URL` | G:262,364,377; I:93,96 | the tool-contract name the binaries read | never exported to reach the wheel; passed at the flag, or inline for `passages attention` | set to `http://127.0.0.1:8040` in this shell by the profile |
| `MW_API_URL_OVERRIDE` | G:365,383 | a retired valve | dropped from the skill; still read first by `attention.js:83`, `mcp-server.ts:48`, `attention/route.ts:34` | unset |
| `/a/src/IAIP/prototypes/artefacts` | `inquiry-weave/src/env.ts:7` (`DEFAULT_INQUIRY_ROOT`); not in either skill | the artefact shelf | `$MIADI_INQUIRY_DIR` (read first), `$MIADI_INQUIRY_ROOT` (env.ts:38-44) | `MIADI_INQUIRY_DIR=/a/src/IAIP/prototypes/artefacts`, `MIADI_INQUIRY_ROOT=/src/IAIP/prototypes/artefacts` (same tree) |
| `miadisabelle/Etuaptmumk-RSM` | `env.ts:9` (`DEFAULT_INQUIRY_REPO`); not in either skill | the inquiry issue repo | `$MIADI_INQUIRY_GITHUB_REPO` | `miadisabelle/Etuaptmumk-RSM` |
| `/workspace/repos/jgwill/miadi-orchestration-kit` | coordinator brief | this repo | `$MIADI_ORCHESTRATION_KIT_ROOT` | set |

## Version claims

| claim | where | replaced by | measured on Gaia 2026-09-04 |
|---|---|---|---|
| `passages` 0.1.4 behind, `which` lied on 2026-08-13 | G:71-75 | `command -v mkepisode` proves a name resolves; `npm ls -g --depth=0 passages` reads the version | `passages@0.3.1` |
| `passages ≥ 0.2.0` adds `--adopt` | G:67,75,105; I:5,52; AGENTS.md | `mkepisode --help \| grep -c adopt` (0 means cannot repair) | 3 |
| `passages ≥ 0.3.0` attention verbs | G:215 | `passages help \| grep -c attention` | 1 |
| `passages 0.3.1` alignment floor reaching weave 0.8.x | I:5,52 | `npm ls -g --depth=0 @miadi/inquiry-weave` plus the node one-liner (what `mkepisode` loads) | global 0.8.3; the weave under `mkepisode` is 0.8.3 |
| `@miadi/inquiry-weave` 0.3.1 under a `^0.3.0` pin; `^0.6.0`; `≥0.7.0` | G:73-75,217 | same one-liner | 0.8.3 |
| `@miadi/episodic-memory-schema ≥0.8.0` | G:220 | `npm view @miadi/episodic-memory-schema version`; the item shape is cited from source (attention.ts:22-36) | source 0.8.0 |
| `ep<NNN>` resolves since `fdc08053` (2026-08-14) | G:184-187 | `inquiry-weave --help \| grep -c resolve` (0 means an old build) | 2 |
| `passages --version`, `inquiry-weave --version` | coordinator brief | neither exists; `npm ls -g` is the reading | `unknown command '--version'`, `unknown flag --version` |
| `@medicine-wheel/mcp@4.5.8`, `coaia-narrative@0.16.2` (`MWCV`, `CNCV`) | G:372 | dropped; not this skill's | `MWCV=@medicine-wheel/mcp@4.6.4`, `CNCV=coaia-narrative@0.16.2` |
| `voice-mcp ≥ 0.3.3` falls back to the repo `.env` | G:370 | dropped; voice kin | source 0.4.0 |
| `passages assert-closed`, one-command mint (jgwill/Miadi#621) | issue 621 | `passages help \| grep -c 'assert-closed\|mint'` | 0: not implemented |

## Counts that were prose

| count | where | today |
|---|---|---|
| 147 vessels, 15 cards, 10 receipts (2026-08-04) | G:16 | one dated line in S14 |
| 26 of 175 vessels carry a weave (2026-08-14) | G:172 | 35 of 185 (`ls -d $MIADI_CHRONICLE_ROOT/*episode-*/inquiry/weave.yaml \| wc -l`) |
| 66 of 166 manifest-less (2026-08-13); 63 of 172 (2026-08-16) | G:315; issue 41, 621 | 53 of 185 (`for d in *episode-*/; do [ -f "$d/episode.yaml" ] \|\| echo "$d"; done \| wc -l`); ep117, ep126, ep098 still manifest-less; ep078 still twice on disk |
| 130 unregistered vessels | G:317 | `python3 <skill-dir>/reconcile.py --json` reports it; not re-run this turn (read-only, but the coordinator owns reconciliation) |

## What this leaves in the skill by name

`MIADI_CHRONICLE_ROOT`, `MIADI_CHRONICLE_MW_URL`, `MW_API_URL` (as a tool-contract name only), `MIADI_INQUIRY_DIR`, `MIADI_INQUIRY_ROOT`, `MIADI_API_URL`, `MIADI_SRC`, `MIADI_URL_BASE_INTERNAL`, `MIADI_URL_BASE`, `MIADI_WEB_URL`, `MW_API_URL_OVERRIDE` (named once, as the first thing three tools read), `CLAUDE_PLUGIN_ROOT`, and the string `tail3b11eb`. No path, port, or host name otherwise. Version numbers appear only inside dated lines in S14.
