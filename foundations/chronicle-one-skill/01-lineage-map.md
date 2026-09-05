# 01. Lineage map: where every section of the one skill came from

Written 2026-09-04 (Lane A). Sources:

- G = `/etc/claude-code/skills/chronicle-episode/SKILL.md` (Gaia lineage, 395 lines, revised 2026-09-04)
- I = `/home/mia/.agents/skills/chronicle-episode/SKILL.md` (Ilex lineage, 172 lines)
- Target = `skills/chronicle-episode/SKILL.md` in this repo, sections S0 to S14

Dispositions: `verbatim` (kept as written, light edits), `condensed` (kept as one dated line), `env` (host fact moved to an environment name), `api` (superseded by an API or MCP verb, CLI kept as second door), `kin` (pointed to another skill or package), `dropped` (stale, with the reason). Every line cited was re-read this turn; code line numbers were measured against `/a/src/Miadi` at `passages` 0.3.1, `@miadi/inquiry-weave` 0.8.3, `voice-mcp` 0.4.0.

## Gaia lineage (G)

| # | source | teaches | disposition | lands in |
|---|---|---|---|---|
| G01 | G:1-4 frontmatter | name, description naming Gaia | `env`: description rewritten to name no host and to trigger on every verb | frontmatter |
| G02 | G:6-12 intro, host-variant note | "this is the Gaia variant; Ilex owns Termux paths" | `dropped`: the two-variant arrangement is the thing removed | none |
| G03 | G:14-18 §0 created is not closed | 147/15/10 counts; fail-open registration; the gate is yours | `condensed` (counts to one dated line) + `verbatim` (fail-open, gate is yours) | S0, S14 |
| G04 | G:20-31 §1 five stages table | the five proofs with literal roots | `env`: same five probes with `$MIADI_CHRONICLE_ROOT`, `$GIT_ROOT`, `$LEDGER`, `$MIADI_CHRONICLE_MW_URL` | S1 |
| G05 | G:32-46 §1 curl is proof; MCP get_relational_node cannot close stage 4 | JSONL fallback in `store.ts`; no `url` in response | `verbatim` (two sentences) | S1 |
| G06 | G:48 §1 git root is one level up | `/srv/miadi/episodes` | `env`: `rev-parse --show-toplevel` from the ledger | S1, S2 |
| G07 | G:50-62 §2 canonical invocation | `mkepisode … --register "$MIADI_CHRONICLE_MW_URL"` | `api`: API and MCP doors first, this CLI form kept as door 3 | S4 |
| G08 | G:64-75 §2 presence is not capability; 0.1.4 measured 2026-08-13 | `grep -c adopt`, `npm view` | `condensed`: the measure-it block kept, the version numbers moved to one dated line | S3, S14 |
| G09 | G:77-83 §2 `$MIADI_SRC` source run; three symlinks to `/a/src/Miadi-18` | source-run fallback | `env`: `node "$MIADI_SRC/packages/passages/js/mkepisode.js"`; symlink facts dropped | S3 |
| G10 | G:85-89 §2 mightyeagle `/usr/local/src/…` is not an equal fallback, 0.1.4 | a second checkout is behind | `dropped`: jgwill/Miadi#621 measured that checkout current on 2026-08-16; a dated version claim rots in both directions | none |
| G11 | G:91-101 §2 the MCP layer; call the tool; "not implemented" rots | voice tools status | `condensed`: rule kept in S3, the ep319/ep320 history as one dated line | S3, S14 |
| G12 | G:103 §2 `-r` required, first `owner/repo#n` is `source_issue` | provenance anchor | `verbatim` with the code cite (mkepisode.js:236-238) | S4 |
| G13 | G:105 §2 `-n` free/taken; `--adopt`; `resolveEpisode` by directory name; ep117, ep126, ep078, ep098 | manifest-less repair | `verbatim` (mechanics, in S10) + `condensed` (examples, one dated line) | S10, S14 |
| G14 | G:107 §2 adoption is a repair never a birth | do not normalise hand-made folders | `verbatim` | S10 |
| G15 | G:109-125 §2b the shape from ep323 | tree of a well-formed vessel | `verbatim` re-measured: tree kept, `script.md` no longer labelled a derivation unit (see C08) | S11 |
| G16 | G:127-138 §2b the verbs table | inquire, lineage, status, sketch, validate, closing_status | `api`: each verb regrouped under its own section with API/MCP/CLI order; sketch and validate `kin` | S6, S7, S8, S13 |
| G17 | G:142-149 §2b trap: `relate --artefact .` | resolves to the shelf root; ep347 | `verbatim` with code cites (artefact.ts:47-61, cli.ts:347-348) + one dated line | S7, S14 |
| G18 | G:151-161 §2b trap: sketch output is not a book | shape and look is the one stage no tool performs | `kin` + `condensed`: pointed to the two Twine skills, ep039 as one dated line | S13, S14 |
| G19 | G:162-165 §2b trap: an artefact is a directory | `statSync().isDirectory()` | `verbatim` | S7 |
| G20 | G:166-170 §2b trap: `passages validate` reports unstamped, never fails | `RESULT: clean` with `matched: 0` | `kin`: belongs with book derivation, `miadi-chronicle-to-twine` | S13 |
| G21 | G:172-174 §2b how common the shape is (26 of 175) | the habit is the exception | `dropped` as a count that ages; today 35 of 185 carry a weave, 53 are manifest-less (measured 2026-09-04) | 02-host-facts |
| G22 | G:176-182 §2b the contradiction not resolved (stage 2/3) | flagged, not decided | `superseded`: William's word 2026-09-04, see C01 | S5 |
| G23 | G:184-187 §2b `ep<NNN>` resolves since `fdc08053`; `dist/` gitignored | address forms | `condensed` to one dated line; the `grep -c resolve` probe carries the capability check | S3, S14 |
| G24 | G:189-207 §2c the room reads roles (table) | filename conventions | `verbatim` re-measured from `classify()`: transcript row corrected (C07), extension sets added | S11 |
| G25 | G:209-238 §2c the decision-state practice; attention contract | verbs, item shape, read/answer authorities, depth | `api`: the HTTP door exists and is measured, MCP second, CLI third; contract shape kept with the schema cite | S9 |
| G26 | G:240-248 §2c why this aligns (four surfaces) | chart store, issues, HELD.md, room | `dropped`: prose about the method; the one rule it carries ("the store points, never restates") is in S9 | S9 |
| G27 | G:250-252 §2c use `chronicle-reference` | the portable name | `kin` corrected: that skill exists on no host; `inquiry-weave resolve` owns the name (C09) | S13 |
| G28 | G:254-258 §2c prove it on the surface; proven-and-mute | open the room | `verbatim` (the room rendering is the proof; the `?capabilities=1` read replaces guessing) | S9, S11 |
| G29 | G:260-262 §3 the `MIADI_CHRONICLE_MW_URL` law; `MW_API_URL` tool-contract; retired `MW_API_URL_OVERRIDE` chain | variable of record | `verbatim` (as the S2 table) + one dated line | S2, S14 |
| G30 | G:264-270 §3 poisoned wheel host; grep for receipts | `tail3b11eb` detection | `env` + `verbatim`: literal root replaced, the host string kept as the one refusal literal (02-host-facts explains why) | S10 |
| G31 | G:272-282 §4 pending or lying receipt; redeem-receipt.sh; exit codes; ep308 | receipt repair | `verbatim` with `<skill-dir>` path; ep308 as one dated line | S10, S14 |
| G32 | G:284-294 §5 commit discipline; main-only; named files | git rules | `verbatim`, literal git root replaced, rebase rule added per C02 | S5 |
| G33 | G:296-313 §6 reconcile.py; drift shapes table | disk x git x wheel x receipt | `verbatim` condensed to one list of shapes | S10 |
| G34 | G:315-319 §6 66 of 166; sweeps; adopt before you redeem; ep117 inverse orphan | repair one at a time | `verbatim` (rules) + `condensed` (counts, one dated line) | S10, S14 |
| G35 | G:321-336 §7 what an episode becomes (surfaces table) | inquiry-weave, passages, composition-to-episode, the app, attention-ui, Twine, voice | `kin`: rewritten as the S13 table with owners only | S13 |
| G36 | G:337-346 §7 two rules: chronicle read-only to derivation; AGENTS.md is the operating law | canonical vessel | `kin` (derivation) + `env` (`$MIADI_CHRONICLE_ROOT/AGENTS.md`) | S13 |
| G37 | G:348-359 §8 two env layers: `bash_env_common` authors, `.mcp.json` consumes | subprocesses see less | `env`: the file paths dropped; the rule "an MCP subprocess sees only what its config passes" is in S3 (call the tool) and the 2026-08-07 line | S3, S14 |
| G38 | G:361-372 §8 env table with literal values | variables and their values | `env`: values removed, names kept; `MWCV`/`CNCV`, `MIADI_ASSEMBLY_VOICE_AUDIO_DIR`, `MIADI_API_TOKEN_WRITER` dropped as not this skill's | S2 |
| G39 | G:374-387 §8 the resolve chain `MIADI_CHRONICLE_MW_URL:-MW_API_URL:-literal` | fallback order | `env`: the chain lives in the two companion scripts; the skill states the order in words and carries no default url | S2, S10 |
| G40 | G:389-393 §8 one character is an outage (`${$MIADI_SRC}`) | suspect the config | `condensed` to one dated line | S14 |
| G41 | G:395 closing line | 🌸 | replaced by a new closing line | end |

## Ilex lineage (I)

| # | source | teaches | disposition | lands in |
|---|---|---|---|---|
| I01 | I:1-6 frontmatter, `compatibility` naming Termux, 0.2.0, 0.3.1, port 8040 | host and version floors | `env` + `dropped`: no compatibility line; floors become S3 probes | frontmatter, S3 |
| I02 | I:8-12 intro, host-variant note | "this is the Ilex variant" | `dropped`: same reason as G02 | none |
| I03 | I:14-20 read AGENTS.md, CLAUDE.md, episodes/CLAUDE.md at Termux paths | the chronicle's own law | `env`: `$MIADI_CHRONICLE_ROOT/AGENTS.md`, `$GIT_ROOT/CLAUDE.md` (C06) | S13, S5 |
| I04 | I:22-29 Ilex paths and endpoints (git root, chronicle root, wheel, forgewright) | literal addresses | `env`: `$GIT_ROOT`, `$MIADI_CHRONICLE_ROOT`, `$MIADI_CHRONICLE_MW_URL`; forgewright maps to `$MIADI_CHRONICLE_FW_URL` and no verb in this skill needs it (02-host-facts) | S1, S2 |
| I05 | I:31 the retired local bare path is not the origin; measure `git remote -v` | do not restore stale pointers | `verbatim` in spirit: S1 fetches `origin` by name and composes nothing | S1 |
| I06 | I:33-50 tool readiness block with the node one-liner | presence is not capability, measured | `verbatim`: the one-liner is the S3 "weave mkepisode actually loads" probe; `npm ls -g` kept as the version reading since none of the binaries answers `--version` (measured 2026-09-04) | S3 |
| I07 | I:52 floors 0.2.0 and 0.3.1 in prose; a top-level weave does not prove what mkepisode loads | version floors | `condensed`: floors become capability probes (C04); the second sentence kept as the one-liner's purpose | S3 |
| I08 | I:54-56 `npm install -g passages@<reviewed-version> --prefer-online` | deliberate install | `verbatim` as `npm i -g passages@latest @miadi/inquiry-weave@latest` (the reviewed-version form is a host practice, not a rule) | S3 |
| I09 | I:58 never hand-create an episode directory | mkdir refusal | `verbatim` | S4 |
| I10 | I:60-69 required birth fields; derived fields; survey after fetching; never silently replace a colliding number | the four inputs | `verbatim`: the four flags are required by the tool (mkepisode.js:163-186); the number-claim rule kept with the union check from closing.ts | S4 |
| I11 | I:71-84 safe preflight; never stash/reset/clean/force/auto-rebase; refuse on divergence | git safety | `verbatim` except the rebase clause, superseded by William's word (C02) | S5 |
| I12 | I:86-103 create and register; `export MW_API_URL="$MIADI_CHRONICLE_MW_URL"` then `--register "$MW_API_URL"` | derive the tool name from the record | `superseded`: pass the record at the flag; inline derivation only for `passages attention`, which has no flag (C03) | S4, S9 |
| I13 | I:104 argv-based process execution; never concatenate browser input into a shell | application boundary | `superseded by API`: an implementation rule for the episode API, handed to `03-api-design.md` | 03-api-design |
| I14 | I:106 do not substitute `inquire --new-episode` or `promote --new-episode` for a governed birth | scaffold has no goal/reference | `verbatim` with the code cite (episode.ts:206-214); overrides G16's listing of it as a birth verb (C05) | S4 |
| I15 | I:108-115 separate owners: chronicle-episode, chronicle-reference, inquiry-weave, attention | ownership | `kin`: the S13 table; `chronicle-reference` corrected (C09) | S13 |
| I16 | I:117-122 `inquiry-weave resolve 'miadi-chronicle:<n>' --verify --json` | the portable name | `verbatim` as the S6 CLI door and the S13 owner of the name | S6, S13 |
| I17 | I:124-131 attention verbs with `miadi-chronicle:<number>` refs | CLI attention | `api`: HTTP door first, MCP second, these verbs third with the inline wheel derivation | S9 |
| I18 | I:133 the room's posture (History, Attention complete); read vs answer authorities; MCP tool names | surface behaviour | `condensed`: authorities and tool names kept; posture prose dropped (the room owns its rendering) | S9 |
| I19 | I:135 never submit a guessed answer to test access; preserve the human's exact word | write-probe refusal | `verbatim` | S9 |
| I20 | I:137-139 capture custody; raw media device-local; never force-add `.m4a .mp4 .mov .wav` | media stays out of git | `verbatim` extended: the ignore list is now the git root's `.gitignore` (ep335, adds `.aac .flac`, `keep/` exception); proven with `check-ignore` | S12, S11 |
| I21 | I:141-148 textual publication paths (`captures/<stem>/capture.json`, transcriptions) | what may be committed from a capture | `verbatim` as the captures line in the vessel tree | S11 |
| I22 | I:150 local copy, registration, commit, push are separate stages; preserve partial success | stage separation | `verbatim` (S0 and S1 are that rule) | S0, S1 |
| I23 | I:152-154 git publication: fetch, clean index, named files, imperative subject, receipts, `Ref:`, trailer, fetch again, never force | commit shape | `verbatim` except the trailer clause, deferred to `$GIT_ROOT/CLAUDE.md` (C10) | S5 |
| I24 | I:156-166 five-stage proof; `resolve --verify`; page routes answer 200 for absent names | proofs | `verbatim`: identical to G04 in substance; the page-route sentence kept in S1 | S1, S6 |
| I25 | I:168 a pending receipt is debt; a local save remains successful if later stages refuse | partial success | `verbatim` | S10, S0 |
| I26 | I:170-172 event-ready application boundary (sinks, correlation keys, no transcript bodies in payloads) | API implementation contract | `superseded by API`: handed to `03-api-design.md`; not an agent instruction | 03-api-design |

## Contradictions between the lineages, and what the one skill says

| # | G says | I says | resolution | lands in |
|---|---|---|---|---|
| C01 | §1 and §5: the agent commits and pushes; §2b: flagged against `closing.ts:11` | Git publication: the agent commits and pushes | William, 2026-09-04: the minting tool or API commits and pushes, safe rebase first. `closing.ts:11` is stale. Interim: the invoking agent does both in the same turn. Stated once. | S5 |
| C02 | §5: fetch and integrate `origin/main` before pushing | Safe preflight: never automatically rebase shared main; refuse on divergence | `git pull --rebase origin main` without autostash (a dirty tree makes it refuse); abort and report on conflict; never force. This is the "safe rebase" William named. | S5 |
| C03 | §3: pass `$MIADI_CHRONICLE_MW_URL` at the flag; do not export `MW_API_URL` | Create: `export MW_API_URL="$MIADI_CHRONICLE_MW_URL"` then flag | Flag where a flag exists (`mkepisode --register`, `inquiry-weave --mw-url`). Inline `MW_API_URL="$MIADI_CHRONICLE_MW_URL" passages attention …` where none exists (attention.js:83 reads env only). Never a shell-wide export. | S2, S4, S9 |
| C04 | §2: "≥ 0.2.0", "pin ^0.6.0", §2c "≥0.3.0", "≥0.7.0", "≥0.8.0" | frontmatter and Tool readiness: 0.2.0 and 0.3.1 floors | No version number in prose. Capability probes (`grep -c adopt`, `grep -c resolve`, `grep -c attention`) and `npm ls -g` for the reading. `--version` does not exist on any of the three binaries (measured 2026-09-04). | S3 |
| C05 | §2b lists `inquire --artefact . --new-episode` as "issue + artefact + new episode in one command" | Create: do not substitute `inquire --new-episode` for a governed birth | Ilex is right for birth: `scaffoldEpisode` writes `status: scaffold` with no goal and no references (episode.ts:206-214). Mint with `mkepisode`, then `inquire --episode`. | S4, S7 |
| C06 | §7: `AGENTS.md` at the chronicle root is the operating law | Authority: three files at Termux paths | `$MIADI_CHRONICLE_ROOT/AGENTS.md` and `$GIT_ROOT/CLAUDE.md`, by name. | S13, S5 |
| C07 | §2c table: `<stem>-transcript.md` renders a transcript pane | (silent) | `classify()` tags the role and `getEpisodeRoom()` skips it (episodeRoom.ts:358). It renders nowhere. Corrected. | S11 |
| C08 | §2b tree: `script.md` is "the derivation units passages reads" | (silent) | `script.md` is in `RESERVED_DOCS` (vessel.js:247-254) and is skipped by `sketch`. It is the room's spine only; chapters are both. Corrected. | S11 |
| C09 | §2c: use `chronicle-reference` | Name: `chronicle-reference` owns the portable identity | The skill exists on no host measured 2026-09-04 (`/etc/claude-code/skills`, `~/.agents/skills`, `~/.claude/skills`). `inquiry-weave resolve` owns the name. | S13 |
| C10 | (silent) | Git publication: a truthful co-author or service trailer is required by the Chronicle law | `$GIT_ROOT/CLAUDE.md:9` names `Ref:` and `Co-Authored-By` trailers; the host policy at `/etc/claude-code/CLAUDE.md` forbids co-author trailers. Inside the chronicle its own law governs; the skill defers to `$GIT_ROOT/CLAUDE.md` by name and flags the conflict to William. | S5 |
| C11 | §2: mightyeagle checkout is 0.1.4 and behind | (silent) | jgwill/Miadi#621 measured it current on 2026-08-16. Dropped, per the issue's own action step. | none |

## Counts

Rows: 41 (G) + 26 (I) + 11 (C) = 78. One primary disposition per source row; a row's secondary treatment is named in its own cell. `superseded` covers both "by an API or MCP verb" and "by a later word" (G22, I12).

| disposition | G | I | total | rows |
|---|---|---|---|---|
| kept verbatim | 15 | 15 | 30 | G05 G12 G13 G14 G15 G17 G19 G24 G28 G29 G30 G31 G32 G33 G34; I05 I06 I08 I09 I10 I11 I14 I16 I19 I20 I21 I22 I23 I24 I25 |
| kept condensed to one dated line | 5 | 2 | 7 | G03 G08 G11 G23 G40; I07 I18 |
| host fact moved to env | 7 | 3 | 10 | G01 G04 G06 G09 G37 G38 G39; I01 I03 I04 |
| superseded | 4 | 4 | 8 | G07 G16 G22 G25; I12 I13 I17 I26 |
| pointed to kin skill | 5 | 1 | 6 | G18 G20 G27 G35 G36; I15 |
| dropped as stale | 5 | 1 | 6 | G02 G10 G21 G26 G41; I02 |
| | 41 | 26 | 67 | |

Contradiction rows: 11, all resolved above. C01, C02, C04, C10 rest on William's word or the chronicle's own law; the other seven rest on code measured this turn.
