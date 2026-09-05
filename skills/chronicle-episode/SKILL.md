---
name: chronicle-episode
description: The one entry point for Miadi Chronicle episode work on any host and from any agent. Mint a vessel with mkepisode or the episode API, prove the five stages (created, committed, pushed, registered, receipt-verified), register on the chronicle medicine wheel, relate and sync an inquiry with inquiry-weave, author lineage, raise and answer Attention items, redeem receipts, reconcile drift, adopt a manifest-less directory. Use for mkepisode, episode vessels, episode rooms, chronicle registration, closure, attention.json, inquiry weave, lineage, or any write into the chronicle.
---

# Chronicle Episode

Every verb below is given API first, MCP second, CLI third. Raw `git` and `curl` appear only as proof of record. Every path is an environment name. The episode API rows were reconciled on 2026-09-05 against `app/api/chronicle/episodes/**` in jgwill/Miadi (commit 123446ec); the design and the verification record are `foundations/chronicle-one-skill/03-api-design.md` and `04-api-implementation-plan.md` in the kit. The API base is `$MIADI_API_URL`; every POST needs writer authority (loopback, an allowlisted tailnet identity, or `Authorization: Bearer $MIADI_API_TOKEN_WRITER`), every GET is public. Send `dryRun: true` before any first real call.

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
| `MIADI_INQUIRY_DIR` | the artefact shelf (`inquiry-weave` reads it before `MIADI_INQUIRY_ROOT`, env.ts:38-44) | `.` does not mean cwd here, see S7 |
| `MIADI_API_URL` | the Miadi app: the episode door (`/api/chronicle/episodes`) and the Attention door | not the wheel |
| `MIADI_API_TOKEN_WRITER` | writer authority for POSTs from outside loopback or the tailnet | never inline it; `GET …/episodes` reports `capabilities.mint` for the caller you are |
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
2. MCP. `chronicle_episode_mint` and `chronicle_episode_number` on `inquiry-weave-mcp` (same fields; the tool calls the library on disk when `MIADI_CHRONICLE_ROOT` is set, otherwise forwards to the API through `MIADI_INQUIRY_API_BASE` and `MIADI_API_TOKEN_WRITER`). Published in `@miadi/inquiry-weave` 0.9.0 (2026-09-05). On miadi-voice, `voice_resolve_episode` first ("no episode is adequate" is a valid answer); `voice_create_episode` mints and registers but does not commit or push (closing.ts:14), so its caller finishes S5.
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
git -C "$GIT_ROOT" pull --rebase origin main   # no autostash: a dirty tree makes it refuse, and refusal is the safe answer
git -C "$GIT_ROOT" push origin main
```

On a rebase conflict: `git rebase --abort`, report the exact stage, stop. The ledger is main-only: no branches, no worktrees, no non-main push. Never `add .`, `-A`, or `commit -a`; the receipt is a dotfile and is left behind by habit. Never force-push, reset, clean, or stash to make the tree look clean; other hosts pull the same origin. Message shape and trailers follow `$GIT_ROOT/CLAUDE.md`; read it on the host you are on. An unpushed vessel is invisible to every other host.

## S6. Status and closure report

1. API. `GET $MIADI_API_URL/api/chronicle/episodes/<ref>` (public): `{episode, closing[5], drift[], owedActions[], manifest}`, each stage with its probe and what the probe observed. `<ref>` is `347`, `ep347`, or the directory name, never a path.
2. MCP. `chronicle_episode_status` on `inquiry-weave-mcp`; `voice_episode_closing_status` (miadi-voice): read-only, runs the five probes, reports `state`, `probe`, `observed`, plus `drift` and `owedActions` (closing.ts:135-283).
3. CLI. `inquiry-weave resolve "miadi-chronicle:<N>" --verify --json` for the wheel leg and every door; `inquiry-weave status --episode ep<N> --json` for the weave leg.
4. Proof of record: S1.

## S7. Inquiry: relate and sync

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

`relate --artefact .` and `sync --artefact .` resolve `.` to the shelf root: `resolveArtefact` tries `join(inquiryRoot, ref)` first (artefact.ts:47-61) and `join(root, ".")` is the root. Only `inquire` maps `.` to cwd (cli.ts:347-348). Pass the artefact by name to `relate` and `sync`. An artefact is a directory on the shelf (artefact.ts:54), never a file. `sync` copies the whole tree into `<vessel>/inquiry/<NAME>` and records a tree hash (sync.ts:63-101); read `status` freshness before syncing anything large. `inquiry-weave register --episode` posts weave records to `/api/inquiry-weaves` (register.ts:79); it is not stage 4.

## S8. Lineage

1. API. `POST $MIADI_API_URL/api/chronicle/episodes/<ref>/lineage` with `{field: continues_from|relates_to, to: <ref>, relation, reverse?, land?, dryRun?}`: the manifest edge, the wheel edge, then land.
2. MCP. `chronicle_episode_lineage` on `inquiry-weave-mcp` (published 0.9.0).
3. CLI. `inquiry-weave lineage --from ep<N> --to ep<M> --relation "<one sentence true from both doors>" --kind continues-from|relates-to [--reverse] [--dry-run]`.

Both manifests must exist (lineage.ts:117-121; the error names `--adopt`). Idempotent by target (lineage.ts:160). The edge is projected onto the wheel by default; `--no-wheel` writes the manifest only (cli.ts:660-663). `--json` carries `wheel.state`; the room's Lineage card rendering the link is the proof.

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
  episode.mp3, chapter-NN.mp3  rendered voice, tracked
```

The room reads filenames (episodeRoom.ts `classify()` 142-152, `segmentKey()` 160-171, `DOC_LABELS` 173-184; re-measured 2026-09-04). Text is `.md` or `.txt` only; audio is `.mp3` or `.ogg`. `script.md` is the spine, `narration.md|txt` the narration, `revision-notes.md` the revision. `chapter-NN`, `interlude-NN`, `part-NN[-slug]` stems with `-script`, `-narration`, `-revision-notes` become segment panes. `<stem>-transcript.md` is classified and then skipped (line 358): it renders nowhere. `readme`, `source-ledger`, `agents`, `relational-map`, `medicine-wheel-snapshot`, `audio-manifest`, `delivery-notes`, `synopsis`, `context-setting`, `status` are labeled docs; any other text file is an untitled doc. `episode.mp3|ogg` is "Full episode" with one primary; `chapter-NN.mp3` attaches to its segment. `references:` and `issue_refs:` both feed the Source-issues card (line 309). `passages sketch` derives from top-level `.md` files not in its reserved set (`source-ledger.md`, `delivery-notes.md`, `script.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`, vessel.js:247-254), so chapters are both room segments and derivation units while `script.md` is the room's spine only. Re-measure `classify()` before trusting this paragraph.

## S12. Where file access is still required

1. Narrative: `script.md`, chapters, `status.md`, `HELD.md`, `source-ledger.md`. No verb writes prose.
2. Capture custody: copying a take under `captures/<stem>/`. Raw `.m4a .mp4 .mov .wav .aac .flac` are ignored at `$GIT_ROOT` (`git -C "$GIT_ROOT" check-ignore -v <file>` proves it); `keep/` is the deliberate exception. Never force-add media.
3. The bytes a wheel card points at (`metadata.relative_path`): the wheel holds the card, not the vessel.
4. `git` for stages 2 and 3 when the vessel was minted by CLI or by voice; the episode API lands them itself.
5. Redeem and reconcile: the scripts read the disk and the index.

Everything else (mint, number check, status, relate and sync, lineage, register and redeem, attention) has an HTTP door on the Miadi app and a tool on `inquiry-weave-mcp` since 2026-09-05.

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

🌸: One skill that names no host is the difference between an agent that can close an episode wherever it is running and one that has to be told, again, which machine it is on.
