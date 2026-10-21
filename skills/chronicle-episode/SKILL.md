---
name: chronicle-episode
description: Stage, create, relate, and verify Chronicle episodes.
---

# Chronicle Episode

Every verb below is given API first, MCP second, CLI third. Raw `git` and `curl` appear only as proof of record. Every path is an environment name. The episode API rows were reconciled on 2026-09-05 against `app/api/chronicle/episodes/**` in jgwill/Miadi (commit 123446ec); the design and the verification record are `foundations/chronicle-one-skill/03-api-design.md` and `04-api-implementation-plan.md` in the kit. The API base is `$MIADI_API_URL`; every POST needs writer authority (loopback, an allowlisted tailnet identity, or `Authorization: Bearer $MIADI_API_TOKEN_WRITER`), most record-level GETs are public, while host-working-state and operator views (including sessions) can require reader authority. Verify the current route and audience; a protected GET is not a missing capability. Send `dryRun: true` before any first real call.

## Before an episode: T5 production context exploration

When the request is to explore a possible Chronicle or prepare its context/script without creating an episode, use [`production-context-exploration`](../production-context-exploration/SKILL.md) first. Its shared practice keeps the actual workspace under `$MIADI_CHRONICLE_ROOT/_staging_for_new_episodes/`, preserves supplied Mia–Ava interpretations and corrections under `.mia/`, and keeps academic lenses subordinate to the work. It authorizes no number, manifest, mint, registration, or episode lineage. This routing addition is the first-version T5 practice (jgwill/miadi-orchestration-kit#91); team names and the choice to mint remain with their owners.

## S0. Desired outcome

An episode exists when one directory under `$MIADI_CHRONICLE_ROOT` holds `episode.yaml` and a truthful `.mw-registration.json`, both are in a commit reachable from `origin/main`, the chronicle wheel serves `chronicle:<name>`, and the receipt says what the wheel says. `mkepisode` exits 0 whether or not registration happened (mkepisode.js:264-284). Created is not closed. Never report a later stage than the one you proved.

## S1. Five stages, five proofs

```bash
: "${MIADI_CHRONICLE_ROOT:?}" "${MIADI_CHRONICLE_MW_URL:?}"
GIT_ROOT="$(git -C "$MIADI_CHRONICLE_ROOT" rev-parse --show-toplevel)"   # one level above the ledger
LEDGER="$(basename "$MIADI_CHRONICLE_ROOT")"
EP=<directory-name>                                                         # YYYY-MM-DD-episode-NNN-slug
ls "$MIADI_CHRONICLE_ROOT/$EP/episode.yaml"                                                         # 1 created
git -C "$GIT_ROOT" log -1 --oneline -- "$LEDGER/$EP"                                                # 2 committed: one line
git -C "$GIT_ROOT" fetch -q origin main && git -C "$GIT_ROOT" rev-list --count origin/main..main    # 3 pushed: 0
curl -sf -o /dev/null -w '%{http_code}\n' "$MIADI_CHRONICLE_MW_URL/api/nodes/chronicle:$EP"         # 4 registered: 200
jq -r '[.state,.url]|@tsv' "$MIADI_CHRONICLE_ROOT/$EP/.mw-registration.json"                        # 5 registered|already-registered, url == $MIADI_CHRONICLE_MW_URL
```

A `git -C` pointed anywhere but `$GIT_ROOT` reports a clean tree for a chronicle it cannot see. Stage 4 is proven by `GET /api/nodes/<id>` only. The chronicle and wheel page routes are client-routed and answer 200 for any name. The wheel MCP's `get_relational_node` can answer from a local file store and returns no `url`, so it inspects a card and cannot close stage 4.

## S2. Environment: names, never literals

| name | is | note |
|---|---|---|
| `MIADI_CHRONICLE_ROOT` | the episode ledger | git root is `rev-parse --show-toplevel` from it |
| `MIADI_CHRONICLE_MW_URL` | the chronicle wheel, the variable of record (William, 2026-09-04) | hand it to tools at the flag or inline; never export `MW_API_URL` to reach it |
| `MW_API_URL` | the tool-contract name `mkepisode`, `inquiry-weave`, `passages attention` read when no flag is given | a fallback the binaries own, never a name to reason from |
| `MIADI_INQUIRY_DIR` | the artefact shelf (`inquiry-weave` reads it before `MIADI_INQUIRY_ROOT`, env.ts:38-44) | `.` is the working directory from 0.18.0; before it, the shelf root in `relate`/`sync` (S7) |
| `MIADI_API_URL` | the Miadi app: the episode door (`/api/chronicle/episodes`) and the Attention door | not the wheel |
| `MIADI_API_TOKEN_WRITER` | writer authority for POSTs from outside loopback or the tailnet | never inline it; `GET …/episodes` reports `capabilities.mint` for the caller you are |
| `MIADI_PERSON_TOKEN` | the Miadi sign-in token of the person the agent acts for, named here on 2026-09-23 | needed to open a circle or speak in one (S15); an admin's token also opens every episode door; never inline it |
| `MIADI_<SEAT>_TOKEN` | an agent seat's own Miadi identity, e.g. `MIADI_MINO_TOKEN` | the seat speaks as itself with it, mapped onto `MIADI_PERSON_TOKEN` in that seat's MCP config (S15) |
| `MIADI_SRC` | the Miadi checkout | source-run fallback, S3 |
| `MIADI_URL_BASE_INTERNAL`, `MIADI_URL_BASE`, `MIADI_WEB_URL` | the room's doors, read by `inquiry-weave resolve` | ask `resolve`, do not compose room URLs |

`inquiry-weave` carries compiled defaults for the shelf, the ledger, and the wheel (env.ts:7-10). They describe one host. Set the names and they are never consulted.

## S3. Readiness: measure, do not recall

```bash
command -v mkepisode inquiry-weave passages
npm ls -g --depth=0 passages @miadi/inquiry-weave      # installed (none of the three binaries answers --version)
npm view passages version; npm view @miadi/inquiry-weave version
mkepisode --help | grep -c adopt                        # 0: cannot repair a manifest-less directory
inquiry-weave --help | grep -c resolve                  # 0: no ep<NNN> form, no resolve verb
passages help | grep -c attention                       # 0: no attention verbs
node -e 'const{createRequire}=require("node:module"),{execFileSync}=require("node:child_process"),{realpathSync}=require("node:fs");const x=realpathSync(execFileSync("which",["mkepisode"],{encoding:"utf8"}).trim());console.log(createRequire(x)("@miadi/inquiry-weave/package.json").version)'   # the weave mkepisode actually loads
```

Upgrade: `npm i -g passages@latest @miadi/inquiry-weave@latest`. Source run when the global is behind: `node "$MIADI_SRC/packages/passages/js/mkepisode.js"` with the same flags; it loads the sibling weave dist. MCP tools: call each in the turn you rely on it. A schema is a promise and a note saying "not implemented" ages the same way.

## S4. Mint

1. API. `POST $MIADI_API_URL/api/chronicle/episodes` with `{title, goal, references[], number?, date?, lineage?[], inquiry?, register?, land?, dryRun?}`. It writes the mkepisode-shaped manifest, registers the card, writes the receipt, lands (S5), and returns `{ok, episode, number, manifest, files, registration, landing, closing[5], drift, owedActions}`; `ok` is computed from `closing`, never asserted. `GET …/episodes?number=N` says whether N is free on disk, on `origin/main`, and on the wheel; `?allocate=1` previews max+1 and never fills a hole (an explicit `number` is how a lower free number is taken). A taken number is `409 number_taken` with where it was seen. A wheel card with no directory is a reservation and counts as taken.
2. MCP. `chronicle_episode_mint` and `chronicle_episode_number` on `inquiry-weave-mcp` (same fields; the tool calls the library on disk when `MIADI_CHRONICLE_ROOT` is set, otherwise forwards to the API through `MIADI_INQUIRY_API_BASE` and `MIADI_API_TOKEN_WRITER`; `MIADI_EPISODE_DOOR=http` forwards even where the root is set, 0.14.2). Published in `@miadi/inquiry-weave` 0.9.0 (2026-09-05). On miadi-voice, `voice_resolve_episode` first ("no episode is adequate" is a valid answer); `voice_create_episode` mints and registers but does not commit or push (closing.ts:14), so its caller finishes S5.
3. CLI.

```bash
mkepisode -n <N> -t "<title>" -g "<desired result this episode advances>" \
  -r "owner/repo#n" [-r "<more provenance>"] --register "$MIADI_CHRONICLE_MW_URL"
```

`-n -t -g -r` are all required; `-r` repeats in order and the first `owner/repo#n` becomes the card's `source_issue` (mkepisode.js:236-238). `--register` with no url reads `MW_API_URL`; with neither, the vessel is born invisible and writes no receipt at all. `--no-register` is the only deliberate way to skip. Output ends with `registration: <state> chronicle:<name>`; that line is stage 4's claim only. Never create an episode directory by hand. Never write `inquiry-weave inquire --new-episode` for a birth: it scaffolds `status: scaffold` with no goal and no references (episode.ts:206-214).

Number claim, before `-n`:

```bash
git -C "$GIT_ROOT" fetch -q origin main
{ ls "$MIADI_CHRONICLE_ROOT"; git -C "$GIT_ROOT" ls-tree --name-only "origin/main:$LEDGER"; } | grep -E -- "-episode-0*<N>-"
```

Empty output means free. `mkepisode` checks the local tree only (jgwill/Miadi#584); `voice_create_episode` checks the union (closing.ts:290-318). A hit is taken even when the directory carries no manifest. A number a human reserved, as a placeholder directory or as a word in the day's ledger, is never yours; `--adopt` repairs it for them, it does not free it for you.

## S5. Commit and push (stages 2 and 3)

Owner, stated once: the tool or API that minted the vessel commits and pushes it, integrating origin first (William's word, 2026-09-04). The episode API does this itself (`land: true` by default): fetch, fast-forward or `merge --no-edit origin/main`, path-limited add of the vessel files, commit with the source issue as `Ref:`, push; a rejected push is integrated once and retried once, then reported as stage 3 `owed` with `POST …/episodes/<ref>/land` in `owedActions`, never forced. Rebase is not what runs, because the chronicle's `.githooks/reference-transaction` refuses any non-fast-forward move of `main`; a merge commit is the price of a shared tree that forbids rewinds. `POST …/episodes/<ref>/land` (MCP `chronicle_episode_land`) is the recovery verb for a vessel that exists but was never committed or pushed. `mkepisode` and `voice_create_episode` both stop at the receipt, so when you mint by CLI or by voice you perform both stages in the same turn:

```bash
git -C "$GIT_ROOT" add "$LEDGER/$EP/episode.yaml" "$LEDGER/$EP/.mw-registration.json"   # named files only
git -C "$GIT_ROOT" commit -m "ep<N>: <imperative subject>" -m "Ref: owner/repo#n"
git -C "$GIT_ROOT" fetch -q origin main
# Do not rebase guarded shared main. If origin advanced, obey the host's inherited
# shared-tree law before integrating; a rejected push is a boundary to report.
git -C "$GIT_ROOT" push origin main
```

On an integration or push refusal: preserve the tree and report the exact stage. Never force, rewind, clean, stash, or automatically merge over another occupant to finish the report. The API's landing behavior described above is implementation evidence, not permission to override a stricter inherited repository rule; inspect that boundary before delegating automatic landing. The ledger is main-only: no branches, no worktrees, no non-main push. Never `add .`, `-A`, or `commit -a`; the receipt is a dotfile and is left behind by habit. Message shape and trailers follow `$GIT_ROOT/CLAUDE.md`; read it on the host you are on. An unpushed vessel is invisible to every other host.

## S6. Status and closure report

1. API. `GET $MIADI_API_URL/api/chronicle/episodes/<ref>` (public): `{episode, closing[5], drift[], owedActions[], manifest}`, each stage with its probe and what the probe observed. `<ref>` is `347`, `ep347`, or the directory name, never a path.
2. MCP. `chronicle_episode_status` on `inquiry-weave-mcp`; `voice_episode_closing_status` (miadi-voice): read-only, runs the five probes, reports `state`, `probe`, `observed`, plus `drift` and `owedActions` (closing.ts:135-283).
3. CLI. `inquiry-weave resolve "miadi-chronicle:<N>" --verify --json` for the wheel leg and every door; `inquiry-weave status --episode ep<N> --json` for the weave leg.
4. Proof of record: S1.

## S7. Inquiry: relate and sync

A folder of documents with no issue yet (an exported conversation, a research result) is opened with `inquiry-weave open` (0.18.2): the inquiry issue (the folder's documents as its body, label `inquiry`), the actions issue (written by the agent who read the folder, labelled by its type, e.g. `enhancement`), both recorded in `.weave.yaml` (`issue`, `related_issues`), the weave through door 1 below with its landing, and the folder committed and pushed in the shelf's repository. The episode is `--episode`, else the one the folder is woven into, else its `ep<N>-` prefix; `--new-episode "<title>"` mints through S2's door. The output's `woven: miadi-chronicle://<N> <- inquiry …, actions …` line and the `Woven into miadi-chronicle://<N>` line each issue ends with are the claim of the weave; the reply to the person carries that address, both issue URLs and the two pushes, nothing about the documents' content. The `inquiry-weave` skill (`inquiry-weave skill show`) carries the steps.

```bash
inquiry-weave open --artefact <folder> --title "<the inquiry>" --actions-file <file> --actions-label <label> --dry-run
```

1. API. `POST $MIADI_API_URL/api/chronicle/episodes/<ref>/inquiry` with `{artefact: <bare directory name on the shelf>, issue?, land?, dryRun?}`: relate, sync, weave registration, then land the episode side. The artefact side (`.weave.yaml`, `AGENTS.md`) is written in the inquiry repository and not committed there; the response says so. A path or `..` in `artefact` is refused at the door.
2. MCP. `chronicle_episode_inquiry` on `inquiry-weave-mcp` (published 0.9.0; 0.8.3 carried thread reads, `inquiry_weave_kin`, and the attention tools only).
3. CLI.

```bash
inquiry-weave inquire --episode ep<N> --artefact .            # from inside an artefact folder: issue + weave
inquiry-weave inquire --episode ep<N> --slug <slug>           # a new, empty artefact on the shelf
inquiry-weave relate  --artefact <NAME> --episode ep<N> [--issue owner/repo#n]
inquiry-weave sync    --artefact <NAME> --episode ep<N>
inquiry-weave status  --episode ep<N> --json
```

Before 0.18.0, `relate --artefact .` and `sync --artefact .` resolved `.` to the shelf root (`join(inquiryRoot, ".")`), and a sync of `.` once copied the whole shelf. From 0.18.0 `.`, `./x` and `../x` name the working directory in every command (artefact.ts `resolveArtefact`). On a host whose global is older, pass the artefact by name. An artefact is a directory on the shelf (artefact.ts:54), never a file. `sync` copies the whole tree into `<vessel>/inquiry/<NAME>` and records a tree hash (sync.ts:63-101); read `status` freshness before syncing anything large. `inquiry-weave register --episode` posts weave records to `/api/inquiry-weaves` (register.ts:79); it is not stage 4.

## S8. Lineage

1. API. `POST $MIADI_API_URL/api/chronicle/episodes/<ref>/lineage` with `{field: continues_from|relates_to, to: <ref>, relation, reverse?, land?, dryRun?}`: the manifest edge, the wheel edge, then land.
2. MCP. `chronicle_episode_lineage` on `inquiry-weave-mcp` (published 0.9.0). The `miadi-chronicle-episode-kit` plugin (`claude/miadi-chronicle-episode-kit`, `.mcp.json`) starts it from npm with `MIADI_EPISODE_DOOR=http` at `MIADI_API_URL`, so the write takes the app's door on any host; `claudeyolochronicle` and the aliases built on it load that plugin. The tool arrives as `mcp__plugin_miadi-chronicle-episode-kit_inquiry-weave__chronicle_episode_lineage`. `medicine-wheel-miadi-chronicle` is not a lineage door: it writes the wheel alone and `episode.yaml` never hears of it.
3. CLI. `inquiry-weave lineage --from ep<N> --to ep<M> --relation "<one sentence true from both doors>" --kind continues-from|relates-to [--reverse] [--dry-run]`.
4. Page. On `/chronicle/<episode>`, a signed-in writer uses "+ Add related episode" on the Lineage card: the other episode by number or title, relates to or continues from, the sentence (required), an optional reverse with its own sentence. It posts to door 1.

`relation` is the sentence a person reads. It is written to `episode.yaml` and to the wheel edge's `description` (medicine-wheel 0.16.1, jgwill/medicine-wheel#150), and it is shown under the row on the episode page. Write why the two episodes belong together, in plain words, true from both rooms. An edge the wheel already holds without a description receives the manifest's sentence the next time the relation is authored (`@miadi/inquiry-weave` 0.14.3).

Both manifests must exist (lineage.ts:117-121; the error names `--adopt`). Idempotent by target (lineage.ts:160): an existing entry keeps its sentence, and a new sentence for the same target is not written over it. The edge is projected onto the wheel by default; `--no-wheel` writes the manifest only (cli.ts:660-663). One pair is one wheel edge: an edge of the other type for the pair is reported in `wheel.error` and left as it is. `--json` carries `wheel.state`; the proof is the room's Lineage row showing the link with the sentence under it.

## S9. Attention

The store is `attention.json` in the vessel; the surface is the room. Item: `{id, question, unlocks?, asked?, state: open|answered, answer?, answered_at?, depth?[]}` (episodic-memory-schema attention.ts:22-36). The receipt is `.mw-attention.json`; the wheel node is `attention:<episode>/<id>`. One item per decision: the question in one line, what answering it unlocks, and `depth` pointing at where the record lives. The store points; it never restates.

1. API (exists, measured 2026-09-04). `GET $MIADI_API_URL/api/chronicle/attention?episode=<ref>[&id=<id>][&state=open|answered|all]`; `?capabilities=1` reports `{view, answer}` for this caller; `POST` needs writer authority (route.ts:60-71). Never post a guessed answer to test access.
2. MCP. `chronicle_attention_list`, `chronicle_attention_get`, `chronicle_attention_answer` on `inquiry-weave-mcp` (needs `MIADI_CHRONICLE_ROOT`; wheel from `MW_API_URL_OVERRIDE`, `MW_API_URL`, `MIADI_CHRONICLE_MW_URL` in that order, mcp-server.ts:46-53).
3. CLI. `passages attention` has no wheel flag and reads the same three names in the same order (attention.js:83), so hand it the variable of record inline:

```bash
MW_API_URL="$MIADI_CHRONICLE_MW_URL" passages attention add    --episode ep<N> --id <id> --question "<one line>" --unlocks "<what it releases>" --depth "<file.md#heading>"
MW_API_URL="$MIADI_CHRONICLE_MW_URL" passages attention answer --episode ep<N> --id <id> --answer "<the human's exact words>"
MW_API_URL="$MIADI_CHRONICLE_MW_URL" passages attention list   [--episode ep<N>] [--open]
MW_API_URL="$MIADI_CHRONICLE_MW_URL" passages attention sync   --episode ep<N>     # redeem pending projections
```

Exit 0 written and verified, 3 written but the wheel leg is pending, 1 refused (a malformed store is never overwritten). A hand-written `attention.json` is legal and reads `wheel: unregistered` until synced.

## S10. Repair: receipts, drift, manifests

- Receipt. `state: pending` is a debt; `state: registered` with no node on the wheel is a lie; a `url` naming the retired `tail3b11eb` host is poison (`grep -l tail3b11eb "$MIADI_CHRONICLE_ROOT"/*/.mw-registration.json`). Never commit either unredeemed and never edit the word by hand. `<skill-dir>/redeem-receipt.sh "$EP" [--dry-run]` retries `registerEpisodeNode`, which preflights `GET` and never overwrites an existing card (episode-node.ts:10-14), then rewrites the receipt truthfully. Exit 0 registered or already-registered, 1 still pending, 2 setup refusal. `--dry-run` performs the GET only. A receipt that stays `pending` while the wheel is down is correct and dated; commit it and leave the retry owed. Over HTTP the same repair is `POST $MIADI_API_URL/api/chronicle/episodes/<ref>/register` (MCP `chronicle_episode_register`): re-register, rewrite the receipt truthfully, land it.
- Reconcile. `python3 <skill-dir>/reconcile.py [--all] [--json]`: read-only, disk x git x wheel x receipt; exit 0 clean, 1 drift, 2 could not look. Shapes: `GHOST-NODE`, `UNCOMMITTED-VESSEL`, `UNPUSHED-VESSEL`, `DIRTY-VESSEL`, `LYING-RECEIPT`, `PENDING-RECEIPT`, `POISONED-RECEIPT`, `UNREGISTERED-VESSEL`, `MANIFESTLESS-VESSEL`. Repair one vessel at a time, on the human's word; a sweep is a second event with nobody to answer for it.
- Manifest-less. `resolveEpisode` matches by directory name alone (episode.ts:87-124); `lineage` and the room read the manifest; the wheel derives its card from the name too, so such a vessel registers and reads healthy. `mkepisode --adopt -n <N> -t -g -r --register "$MIADI_CHRONICLE_MW_URL"` writes only `episode.yaml`, keeps the directory's own date, number, and slug, refuses when a manifest exists or the number is ambiguous. Adopt before you redeem. A repair, never a birth.
- Companion files. `redeem-receipt.sh`, `redeem-receipt.mjs`, `reconcile.py` ship beside this SKILL.md (`${CLAUDE_PLUGIN_ROOT}/skills/chronicle-episode/` when installed as a plugin). Both read `MIADI_CHRONICLE_MW_URL` then `MW_API_URL`; both refuse the poisoned host.

## S11. Vessel shape and the room's roles

```
<date>-episode-NNN-<slug>/
  episode.yaml                 mkepisode: episode, title, slug, date, series, status, type, goal, references[]
  .mw-registration.json        mkepisode or redeem: {state, node_id, timestamp, url[, error]}
  script.md                    the spine
  chapter-NN[-slug]-script.md  segment N; -narration.md / -revision-notes.md siblings share the stem
  attention.json, .mw-attention.json
  inquiry/weave.yaml, inquiry/<artefact>/     inquiry-weave
  captures/<stem>/capture.json, transcription*.json|txt     the capture family; raw media stays out of git
  ceremonies/<id>/notes.md     Miadi or gmtermux: one per ceremony and per closing; landed by the door (S15)
  episode.mp3, chapter-NN.mp3  rendered voice, tracked
```

The room reads filenames (episodeRoom.ts `classify()` 142-152, `segmentKey()` 160-171, `DOC_LABELS` 173-184; re-measured 2026-09-04). Text is `.md` or `.txt` only; audio is `.mp3` or `.ogg`. `script.md` is the spine, `narration.md|txt` the narration, `revision-notes.md` the revision. `chapter-NN`, `interlude-NN`, `part-NN[-slug]` stems with `-script`, `-narration`, `-revision-notes` become segment panes. `<stem>-transcript.md` is classified and then skipped (line 358): it renders nowhere. `readme`, `source-ledger`, `agents`, `relational-map`, `medicine-wheel-snapshot`, `audio-manifest`, `delivery-notes`, `synopsis`, `context-setting`, `status` are labeled docs; any other text file is an untitled doc. `episode.mp3|ogg` is "Full episode" with one primary; `chapter-NN.mp3` attaches to its segment. `references:` and `issue_refs:` both feed the Source-issues card (line 309). `passages sketch` derives from top-level `.md` files not in its reserved set (`source-ledger.md`, `delivery-notes.md`, `script.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, vessel.js:247-254), so chapters are both room segments and derivation units while `script.md` is the room's spine only. Re-measure `classify()` before trusting this paragraph.

## S12. Where file access is still required

1. Narrative: `script.md`, chapters, `status.md`, `HELD.md`, `source-ledger.md`. No verb writes prose.
2. Capture custody: copying a take under `captures/<stem>/`. Raw `.m4a .mp4 .mov .wav .aac .flac` are ignored at `$GIT_ROOT` (`git -C "$GIT_ROOT" check-ignore -v <file>` proves it); `keep/` is the deliberate exception. Never force-add media.
3. The bytes a wheel card points at (`metadata.relative_path`): the wheel holds the card, not the vessel.
4. `git` for stages 2 and 3 when the vessel was minted by CLI or by voice; the episode API lands them itself.
5. Redeem and reconcile: the scripts read the disk and the index.
6. Anything under `ceremonies/<id>/` other than `notes.md` (a report, a ledger): the door lands only the note.

Everything else (mint, number check, status, relate and sync, lineage, register and redeem, attention) has an HTTP door on the Miadi app and a tool on `inquiry-weave-mcp` since 2026-09-05. A talking circle that people sit in has an HTTP door only (S15).

## S13. Kin: what this skill does not do

| not here | owner |
|---|---|
| which episodes relate to a composition, theme, or recording | `miadi-chronicle-search` |
| promoting an episode into a Twine book, the walk, the built `.html` | `miadi-chronicle-to-twine` |
| how a book looks; `passages sketch` output is not a book until styled | `miadi-chronicle-twine-style-signature` |
| catalogs, the story shelf, the terminal handler, `resolve` doors | `inquiry-weave` skill, `@miadi/inquiry-weave` |
| a composition entering as an episode | `@miadi/composition-to-episode` under `$MIADI_SRC/packages` |
| voice bound to an episode, playback, TTS | `miadi-voice` skill, miadi-voice MCP |
| which host, repo, or service a name points to | `miadi-stack-map` |
| verifying any command in a pipeline | `pipeline-masks-the-exit` |
| people, roles, grants, who may do what in the community | `/admin` on the Miadi app, `@medicine-wheel/community-identity` |
| the portable `miadi-chronicle:<N>[/artifact]` name | `inquiry-weave resolve`; the `chronicle-reference` skill both lineages cite exists on no host measured 2026-09-04 |
| the chronicle's own operating law | `$MIADI_CHRONICLE_ROOT/AGENTS.md`, `$GIT_ROOT/CLAUDE.md` |

## S14. Earned, one line each

- 2026-07-19 ep250: survey what already runs before dispatching anything; spawning is the last step.
- 2026-08-03 ep308: committed with a pending receipt and never revisited; a pending receipt is a dated debt, and the retry stays owed.
- 2026-08-04 ep241, ep293, ep307: 147 vessels, 15 cards, 10 receipts; a card for an episode with no directory, receipts reading registered for nodes never there; created is not closed.
- 2026-08-04 ep241: a dry run that still posted; `--dry-run` now performs the GET only.
- 2026-08-07: `${$MIADI_SRC}` in an MCP config produced a session with no voice tools and no error; suspect the config before the code.
- 2026-08-12 ep319, ep320: `voice_create_episode` was "not implemented" in the morning and live by evening; call the tool, never the note.
- 2026-08-13 ep322: `which mkepisode` resolved while the binary behind it was 0.1.4 with no `--adopt`; presence is not capability.
- 2026-08-13: 66 of 166 directories manifest-less, ep117 and ep126 registered and healthy without a manifest, ep078 twice on disk; adopt before you redeem, one at a time.
- 2026-08-14 ep325: `ep325` failed while `325` resolved the same vessel; one address, two resolvers, fixed in jgwill/Miadi `fdc08053`.
- 2026-08-14 ep327: 372 seconds on disk and on the wheel with nothing in git while two parties each believed the other held stages 2 and 3; owner named 2026-09-04 (S5).
- 2026-08-15 ep332: a proven, woven, registered episode rendered "No script or narration files"; the room reads filenames (S11).
- 2026-08-15: `attention.json` is the store and the page is the surface; William will not open a terminal or a markdown file for a decision.
- 2026-08-16 ep333: `Skill(chronicle-episode)` answered "Unknown skill" because the host's policy checkout sat seven commits behind; a skill copied is not distributed (jgwill/miadi-orchestration-kit#41).
- 2026-08-16 ep333: passages 0.2.2 answered `episode not found: ep333` for a vessel on disk and on the wheel; a tool behind its contract blames the caller (jgwill/Miadi#621).
- 2026-08-16 ep039: sketch output handed over unstyled was unreadable in every story format; shape and look is the one stage no tool performs.
- 2026-08-17 ep335: eight raw takes against a 394M `.git`; media travels by custody, not by history (S12).
- 2026-09-04 ep347: `relate --artefact .` wove the whole shelf and `sync` copied 31 865 files (1.5 GB) into the vessel; name the artefact (S7).
- 2026-09-04: `MIADI_CHRONICLE_MW_URL` is the variable of record; the `MW_API_URL_OVERRIDE` chain is retired (William).
- 2026-09-04: stages 2 and 3 belong to the minting tool or API, safe rebase first (William); `closing.ts:11` is stale.
- 2026-09-04: `closing.ts:278` names `chronicle-episode-closing/redeem-receipt.sh`, a directory that no longer exists; an owed action that points nowhere is owed twice (amended in jgwill/Miadi 9e59e946).
- 2026-09-05: the episode door landed (jgwill/Miadi 123446ec, 24 library tests and 7 route tests); rebase is impossible on the chronicle because its reference-transaction hook refuses non-fast-forward moves of main, so the door merges and says so. `@miadi/inquiry-weave` 0.9.0, `@miadi/voice-mcp` 0.4.1, and `passages` 0.3.2 published the same day; `ep348` was the door's first real mint.
- 2026-09-23: "I want a new ceremony with a talking circle" had no reading here while Miadi had held circles, bound ceremonies and spoken turns since 2026-09-18 (jgwill/Miadi#647). A door the skill does not name does not exist for an agent (jgwill/miadi-orchestration-kit#51, S15).
- 2026-09-23: three doors disagreed on how a ceremony belongs to its episode. The MCP wrote no binding, gmtermux read only the legacy `research_context` string and showed 1 of Episode 349's 10 ceremonies, and the episode door left ceremony notes for a hand to commit. Each was fixed where it lives: jgwill/medicine-wheel#144 (0.15.3), miadisabelle/gmtermux#89, jgwill/Miadi#678.
- 2026-09-27: ceremonies and circles got an address (jgwill/Miadi#680); what an agent copies into the vessel's text bypasses the page's per-reader view, so S17 names what to write (jgwill/miadi-orchestration-kit#58).

## S15. Ceremonies and circles: "a new ceremony with a talking circle"

Read the ask as three records, all on the chronicle wheel, all reached through the Miadi app and never written to the wheel directly. Reconciled 2026-09-23 against `app/api/circles/**`, `app/api/ceremony/**` and `app/api/chronicle/episodes/[ref]/wheel` in jgwill/Miadi (`dcefdd06`; jgwill/Miadi#647, jgwill/medicine-wheel#141).

| word | record | door |
|---|---|---|
| ceremony | `CeremonyLog`, type `talking_circle` unless told otherwise (`opening`, `smudging`, `spirit_feeding`; `closing` is made by close); `episode_path`, `circle_id`, `closes` typed on the record | `POST /api/circles/<circle>/ceremonies` |
| circle | a `circle` node; members are `member_of` edges with role `facilitator` or `member` | `POST /api/circles` |
| talking circle | the turns: one beat per spoken turn, carrying `speaker` and `witnesses` | `POST /api/ceremony/<id>/turns` |

Identity. A circle is opened by someone, and a turn is spoken by someone, so these routes need the Miadi token of the person the agent acts for: `Authorization: Bearer $MIADI_PERSON_TOKEN`. The shared writer token is refused for opening a circle, speaking, witnessing and joining ("Sign in as a person"). Loopback and the tailnet do not stand in for a person either. An admin's own token also passes every episode door as the writer, so one credential carries the whole sequence. When no token is at hand, ask the person for theirs once; they issue one at `/me`. Before the first write, `GET $MIADI_API_URL/api/identity/me` says whose token it is and what it may do.

An agent can be a participant in its own name. A seat that holds its own Miadi identity (`being: agent`) speaks, witnesses and joins with its own token, held in a seat variable such as `MIADI_MINO_TOKEN`. It never takes `MIADI_PERSON_TOKEN` for that, because that token speaks as the person. The seat's MCP config maps its own variable onto the name the tools read: `"MIADI_PERSON_TOKEN": "${MIADI_MINO_TOKEN:-}"`. An agent identity with the role `participant` may join a circle and speak once seated there (`join_circles`, `create_beats`). It cannot open a circle or seat itself, so a facilitator seats it, or it redeems an invitation code. Roles differ between agents: `/api/identity/me` answers each one's role and permissions, and an agent whose role carries `create_circles` (a `ceremony_facilitator`, a `companion_ai`) can open one. Added 2026-10-02: the Mino seat's identity was issued 2026-10-01, and on this host a fresh shell exported the impersonating person token and not the seat's own.

Finding a token before saying there is none. "This seat has no token" is a routing failure until the identity door says otherwise. A seat's token can live outside your shell: in your `~/.env`, in the environment file of the seat's own user on a multi-user host, or in a seat token file under `~/.config/miadi/seats/`. Read variable names, never values, and put each candidate to `GET $MIADI_API_URL/api/identity/me`, which answers the name, `being`, role and permissions behind it. An admin (`manage_people`) lists a person's credentials with `GET /api/identity/people/<id>/tokens`: a recent `last_used_at` means the token exists and something is using it. `POST` to the same route issues a new one, shown once; issue only when every place has been read. The names and places measured on each host are in the `miadi-stack-map` skill. Added 2026-10-15: a coordinator reported that Ava had no token while hers sat in her own user's environment file and had been used that morning.

1. Episode. Bind the ceremony to the episode the conversation is in. `episode_path` is the directory name, never a number. `GET $MIADI_API_URL/api/chronicle/episodes/<N>/wheel` answers `.episode.path` together with everything step 2 needs. A ceremony without an episode is legal; leave `episode_path` out only when the person says so.
2. Where. From the same answer: `.hosts[]` are the circles where this person may hold a ceremony now (`opened_for` this episode, `seated`); `.circles[]` are those already gathered for the episode; `.can.create_circle` and `.can.freestanding` say what else is open. Use the circle the person named, else a host `opened_for` this episode. A seated circle of another episode is used only when named. When neither exists, "with a talking circle" asks for a new circle: step 3.
3. Circle. `POST $MIADI_API_URL/api/circles` with `{name, intention, episode_path, direction?, circle_type?: ongoing|seasonal|one_time, capacity?, is_public?}` → 201 `{circle, facilitator}`. Needs `create_circles` (admin, ceremony_facilitator, firekeeper). The opener becomes facilitator; an admin may pass `facilitator_id` to open it for someone else. Names on the wheel read `Episode <N> <purpose> circle`. Seat people before step 4, because a ceremony's participants are the circle's members at the moment it opens. The facilitator or an admin seats directly with `POST /api/circles/<id>/members {person_id, role?}` (ids from `GET /api/identity/people?search=<name>`). Anyone else is invited: `POST /api/circles/<id>/invite {intended_for?, max_uses?, expires_at?}` → `{invitation}` whose code the person redeems at `POST /api/circles/<id>/join {code}`.
4. Open. `POST $MIADI_API_URL/api/circles/<circle>/ceremonies` with `{intention: "<what this ceremony holds>", type: "talking_circle", direction: "east", episode_path}` → 201 `{ceremony, note}`. The intention is required, and it is the person's words. The wheel mints the id. The facilitator and an admin open by their seat; another member needs `facilitate_ceremony`. An inactive circle answers 409. With no circle at all (only when the person says "no circle"): `POST /api/ceremony/list {type, direction, intentions[], episode_path}` under writer authority. It carries no members and no seat.
5. Land the note. `note.written: true` means `ceremonies/<id>/notes.md` now sits in the vessel uncommitted. `POST $MIADI_API_URL/api/chronicle/episodes/<ref>/land` commits and pushes it with the vessel (jgwill/Miadi#678, `@miadi/inquiry-weave` 0.11.2). `note.written: false` with a `reason` (no `MIADI_CHRONICLE_ROOT`, no vessel) means the ceremony exists on the wheel only. Report that; do not write the note by hand.
6. Prove and hand over. `GET $MIADI_API_URL/api/ceremony/<id>` → `.ceremony.type`, `.episode`, `.circle.members`, `.turns`, `.closed`, `.can`. `curl -sf -o /dev/null -w '%{http_code}\n' "$MIADI_CHRONICLE_MW_URL/api/ceremonies/<id>"` → 200. The episode's `…/wheel` lists it in `.ceremonies`. Give the person the page `/ceremony/<id>` on the Miadi front they use. The room's wheel panel links it from there.

In the circle, after it opens:

- Speak. `POST /api/ceremony/<id>/turns {said, title?, learnings?[]}` → `{turn}`. Needs `create_beats` and a seat. A closed ceremony answers 409. The token's person is the speaker, so post only words that person said, verbatim. An agent seated as its own person (Mia is one, jgwill/Miadi#647) speaks with its own token, never with the human's.
- Witness. `POST /api/ceremony/<id>/turns/<beatId>/witness` with no body. Needs `witness`. A speaker cannot witness their own turn (409).
- Diary. `POST /api/ceremony/<id>/diary {content, phase?, entryType?}`. `phase` is one of `miigwechiwendam`, `nindokendaan` (default), `ningwaab`, `nindoodam`, `migwech`. `entryType` is one of `intention`, `observation`, `hypothesis`, `data`, `synthesis`, `action`, `reflection` (default), `learning`.
- Close, on the facilitator's word only. `POST /api/ceremony/<id>/close {learnings?[]}` → 201 `{closing, note}`: a `closing` record whose `closes` names the ceremony. A second call answers `{closing, already: true}`. The facilitator or an admin closes. The closing writes its own note, which is landed as in step 5.

Other doors, and what each one is for:

- The wheel MCP (`@medicine-wheel/mcp` 4.15.3 and later, jgwill/medicine-wheel#144). `mw_ceremony_open` takes `type`, `episode_path` and `circle_id`; `mw_ceremony_close` writes `closes`; `log_ceremony_with_memory` takes the binding. The wheel then lists the record under its episode and circle. The MCP checks no seat, writes no note and keeps no audit, so it is the door for an agent's own ceremony. A talking circle that people sit in opens through Miadi. Below 4.15.3 these tools drop the binding: read `npm ls -g @medicine-wheel/mcp` before relying on them.
- gmtermux's episode recorder (`:3768`, "Open a new ceremony in this episode"). It opens an `opening` in the east with no circle and no people, writes directly to the wheel, and edits `notes.md` in the room under a revision guard. Since miadisabelle/gmtermux#89 it lists the ceremonies a Miadi circle holds for the episode and posts the typed binding. A host that runs an older build lists only its own.
- `medicine_wheel_ceremony_id` in `episode.yaml` (10 manifests carry it) is read by no Miadi code. The binding of record is the ceremony's `episode_path`. The manifest key is not proof.

## S16. Reviews: "put this review in the episode", "an episode from this review"

A Miadi review (`miadi-review` skill) enters an episode through the episode door, never by hand on the wheel. Reconciled 2026-09-24 against `app/api/chronicle/episodes/[ref]/reviews` and `@miadi/inquiry-weave` `attachEpisodeReview` (jgwill/Miadi#682, jgwill/medicine-wheel#146). It keeps the practice Episode 345 set by hand (`review-medicine-wheel-experiment.md` in that vessel).

| record | where | written by |
|---|---|---|
| `reviews:` entry `{id, url, title, version, relation, added, ceremony?, circle?}` | `episode.yaml` | the door; `version` is the one the episode used and is never rewritten |
| `review:<uuid>` node, `type: knowledge`, `metadata.kind: miadi_review` | the wheel | created when absent; only `latest_version` is refreshed |
| `chronicle:<episode>` → `review:<uuid>` edge, `relationship_type` = the relation | the wheel | created when absent; a hand-made edge is kept as it is |
| `talking_circle` with `subject_id: review:<uuid>`, `episode_path`, `circle_id` | the wheel, note in `ceremonies/<id>/notes.md` | the app, for a person |

1. Add. `POST $MIADI_API_URL/api/chronicle/episodes/<ref>/reviews {review, relation?, obligations?, intention?, circle_id?, ceremony?, land?, dryRun?}`. `review` is the page URL, its `/json` form, `miadi-review:<uuid>`, or the uuid, and only on `MIADI_REVIEW_BASE_URL` (default `https://miadi-review-service.vercel.app`). `relation` is a kebab-case phrase completing "Episode <relation> Review" (default `discusses`); name the real contribution when you know it. Manifest and ceremony note land in one commit. Repeating the call adds nothing.
2. The circle opens only for a person. The door's write gate admits the writer token or an admin, so an agent sends `Authorization: Bearer $MIADI_API_TOKEN_WRITER` and the person it acts for in `x-miadi-person-token: $MIADI_PERSON_TOKEN`; an admin's own bearer, or the browser cookie of an admin, also works. A person who is not an admin reaches the door only through that header, because a non-admin role does not carry the write tier. It is the named `circle_id`, else a circle opened for this episode where that person may hold a ceremony, else a new "Episode <N> review circle" (needs `create_circles`). With the writer token the answer is `ceremony.state: "owed"` with the reason; repeat the call with the person's token. `intention` is the person's words; absent, it names the review and its URL.
3. Mint from a review. `POST $MIADI_API_URL/api/chronicle/episodes {review, title?, goal?, references?, number?, …}`. Title, goal and references default from the review, and `fromReview` lists which ones did; the goal it writes is computed, so say so or pass the person's. The review then enters as in step 1, circle included. Send `dryRun: true` first: it reads the review (a bad or missing one refuses) and answers `review: null` with `ok: false`, because nothing is attached or proven. Read `wouldAttachReview` instead: the version it would pin, the relation, the node and edge ids, and `ceremony.expect` (`opens` as the named person, `owed` with the reason, or `skipped`). Needs `@miadi/inquiry-weave` 0.13.4 on the app.
   `ceremony: false` on either door means no circle: the answer is `skipped`, the review is attached, and nothing is owed.
4. Read. `GET …/episodes/<ref>/reviews` lists both declarations (`reviews:` and Episode 345's `references: miadi-review:<uuid>`), each with `latest_version` and `newer`. `GET $MIADI_CHRONICLE_MW_URL/api/ceremonies?subject_id=review:<uuid>` finds the circles held about a review (wheel 0.15.5 and later).
5. MCP. `chronicle_episode_review` and `review` on `chronicle_episode_mint` (`inquiry-weave-mcp` 0.13.1). Over HTTP they send `MIADI_PERSON_TOKEN` in `x-miadi-person-token` beside the writer token, so the circle opens; on the library path no person is present and the ceremony is owed.
7. Idempotent on the wheel, not only the manifest: before opening, the app asks `GET /api/ceremonies?subject_id=review:<uuid>&episode_path=<dir>&type=talking_circle` and answers an existing circle as `already-open`. A relation the caller asks for that differs from an edge already on the wheel is reported in `relationNote` and not written.
6. The room (`/chronicle/<episode>`) has a Reviews card with the add form; `/chronicle` has "Begin an episode from a review". Give the person the room and `/ceremony/<id>`.

## S17. Naming a ceremony or circle in the vessel's text

A script, a chapter or `status.md` names a ceremony as `miadi-ceremony:<id>` and a circle as `miadi-circle:<id>`, written as a directive: `{{ miadi-ceremony:<id> | label="<the episode's words>" }}`, `show=card` for a card. The room and articles render it for each reader: a person the circle admits sees the ceremony, anyone else sees a private chip (jgwill/Miadi#680, `rispecs/miadi-chronicle-dsl/SPEC.md` §9 in jgwill/Miadi). `miadi-chronicle:<N>/ceremonies` and `…/circles` list what the episode holds.

1. Link, never copy. Do not write a ceremony's intention, turns, witnesses or diary into the text. The page shows them to the people the circle admits; text copied into the vessel shows them to everyone. Quote a turn only when its speaker said so.
2. The whole id, from a door's answer: `ceremony.id` in the 201 of `POST /api/circles/<circle>/ceremonies`, or `.ceremonies[].id` and `.circles[].id` from `GET …/episodes/<N>/wheel`. Never an id from memory.
3. The canonical form only, rootless: `miadi-ceremony:<id>`, `miadi-circle:<id>`. Short forms (`{{ ceremony:<first 8> }}`) are for people typing; a prefix unique today can match two ceremonies later.
4. A `label=` renders to every reader, signed in or not. Write it in the episode's words, never the intention and never a person's name.
5. A reference is not a binding. The binding is the ceremony's `episode_path` (S15). Naming another episode's ceremony is fine; when the episodes relate, author lineage too (S8).
6. Order: open the ceremony and land its note (S15 steps 1 to 5), then write the reference, then land the text (S5, S12). Needing something to name is never a reason to open a ceremony.
7. Check twice: signed in as the person, `/chronicle/<episode>` shows the card; signed out, the same page shows the private chip. `chronicle_resolve {uri, verify: true}` on `inquiry-weave-mcp`, or `inquiry-weave resolve miadi-ceremony:<id> --verify` (`@miadi/inquiry-weave` 0.14.1), prints the page and says whether the wheel holds the id; a UUID prefix reports the whole id it names.

## S18. Holdings: what the episode room shows beyond its text

The room's cards (Foundations, Specifications, Prototypes, Traces and prompts, Notebooks, Screenwalks, Reviews, Inquiries) are read from `episode.yaml` keys and from files, through doors under `$MIADI_API_URL/api/chronicle/episodes/<ref>/`. A file an agent writes in the vessel shows on no card until it is held. Measured 2026-10-12 in Episode 120 against jgwill/Miadi `28dc1df9`.

| card | door | body | held as |
|---|---|---|---|
| Foundations | `POST …/foundations` | `{foundation, source?, relation}` | `foundations:` in the manifest; a package packet (`GET /api/foundations` lists the slugs) or, with `source: "episode"`, the episode's own `foundations/<slug>/README.md` |
| Specifications | `POST …/rispecs` | `{spec: "rise://<owner>/<repo>/<path>", commit, title?, relation?}` | `rispecs:`; a spec kept in the episode is `rise://jgwill/episodes/miadi-chronicle/<episode>/<path>` |
| Prototypes | `POST …/prototypes` | `{prototype, url, editor?, made_with?, …}` | `prototypes:`; the editing address goes to the wheel node only |
| Traces and prompts | `POST …/tracing` | `{reference \| domain+resource+id, …}` | `tracing:`; never a key, a base URL or a provider |
| Notebooks | `POST …/notebooks` | `{notebook, …}` | `notebooks:`; files under `captures/notebook-<uuid>/` |
| Screenwalks | `GET …/screenwalks` (no POST) | | the file `captures/screenwalk-<id>/screenwalk.json` (`@miadi/episodic-memory-schema` `screenwalk.ts`), its closing as `closing.md` beside it |
| Reviews | S16 | "No talking circle yet" means no circle was opened for that review | |
| Inquiries | S7 | "not copied yet" means never synced; `POST …/inquiry {artefact}` copies it | |

1. `relation` is a kebab-case phrase completing "Episode <relation> Foundation" (`grounded-by`, `clarifies`, `specifies`). A sentence is refused with `invalid_field`.
2. A grounding or a spec a lane writes goes where its card reads it (`foundations/<slug>/README.md`, a `rise://` path), and is held in the same turn. A loose file in a branch folder is invisible to the room.
3. A screenwalk id is the minute the person pressed record, `yymmddHHMM`, or `yymmdd-NNN` when that minute is unknown; say which in `recording.evidence`. Output kinds are `dialogue`, `chapters`, `short`, `audio`, `other`.
4. Each POST lands its own commit on `main`. Commit and push your own files first, send `dryRun: true`, then post. Read the card's `GET` after, as the proof.

🌸: One skill that names no host is the difference between an agent that can close an episode wherever it is running and one that has to be told, again, which machine it is on.
