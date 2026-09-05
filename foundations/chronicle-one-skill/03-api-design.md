# 03 — The HTTP door for a Chronicle episode

Lane B, Gaia, 2026-09-04. Anchor: jgwill/Miadi#621 (companion jgwill/miadi-orchestration-kit#41).
Model class: Fable 5.1 (`claude-fable-5-1`).

William's word: "adding/extending/creating `/a/src/Miadi/app/api/chronicle` so that we could
create a new chronicle without having direct access to the files"; the route "commits and
push and make sure to pull (rebase if needed safely before)".

Every fact below carries a file:line or a command run on Gaia this turn. Re-measure before
extending; nothing here is a version claim that will not age.

---

## R — Reverse-engineer what exists

### R1. The two routes already at the door

| file | shape | what to keep |
|---|---|---|
| `app/api/chronicle/attention/route.ts:25-30` | `noStore(body, status)` — JSON + `cache-control: no-store` | reuse verbatim |
| `…/attention/route.ts:41-57` | `errorResponse()` maps `AttentionServiceError.code` → 422/404/409, `EpisodeResolutionError` → 404, else 500 `attention_failed` | mirror the taxonomy, one error class per module |
| `…/attention/route.ts:60-71` | GET public; `capabilities.answer = requireMiadiAuth(req,{write:true}) === null` | same capability echo |
| `…/attention/route.ts:114-116` | POST gated by `requireMiadiAuth(request, { write: true })` (`lib/api-gate.ts:298`) returning `Response \| null` | every write |
| `…/attention/route.ts:22-23` | `export const dynamic = "force-dynamic"; export const runtime = "nodejs"` | both (git + fs need node) |
| `app/api/chronicle/resolve/route.ts:31-43` | a 400 that carries a `USAGE` document | the collection GET describes itself |
| `app/chronicle/lib/getManifest.ts:17-19` | `chronicleRoot()` = `MIADI_CHRONICLE_ROOT ?? /srv/miadi/episodes/miadi-chronicle` | reuse |
| `app/api/lattice/[key]/route.ts:12-14` | `params: Promise<{ key: string }>` (Next 16 dynamic segment) | the `[ref]` routes |

### R2. The library that already knows how to do each act (`packages/inquiry-weave/src/`)

| verb | function | file:line | note |
|---|---|---|---|
| resolve a ref (`347`, `ep347`, dir name, path) | `resolveEpisode` | `episode.ts:87-124` | by DIRECTORY NAME only; `AmbiguousEpisodeError` on duplicates |
| allocate | `allocateEpisodeNumber` | `episode.ts:164-171` | max+1 over local dir names; blind to origin and wheel |
| scaffold | `scaffoldEpisode` | `episode.ts:188-217` | writes `status: scaffold`, `issue_anchors`, `artifacts` — NOT the vessel shape |
| manifest presence | `hasEpisodeManifest`, `missingManifestRemedy` | `episode.ts:144-161` | |
| register card | `registerEpisodeNode` | `episode-node.ts:338-392` | GET-then-POST, fail-open → `pending` |
| card shape | `projectEpisodeNode` | `episode-node.ts:303-322` | `chronicle:<dir>`, `source_issue` |
| relate artefact ↔ episode | `relate` | `relate.ts:47-122` | writes `<episode>/inquiry/weave.yaml`, `<artefact>/.weave.yaml`, `<artefact>/AGENTS.md` |
| sync copy | `syncArtefact` | `sync.ts:180-225` | copies the artefact tree into `<episode>/inquiry/<artefact>/` |
| lineage edge (manifest) | `appendLineageEdge` | `lineage.ts:179-253` | idempotent, refuses a manifest-less dir |
| lineage edge (wheel) | `projectLineageEdge` | `lineage-edge.ts:102` | list-and-scan, fail-open |
| weave registration | `registerEpisode` | `register.ts:175-194` | POST `/api/inquiry-weaves` |
| env | `resolveEnv` | `env.ts:33-53` | `mwUrl` reads `MW_API_URL` only (see R5) |
| MCP | `TOOLS[]`, `callTool()` | `mcp-server.ts:97-204` | raw JSON-RPC over stdio, six tools, serverInfo 0.8.3 |

### R3. The canonical vessel manifest is passages', not inquiry-weave's

`packages/passages/js/lib/mkepisode.js:83-97` `buildManifestYaml()` emits exactly:

```
episode: <n>
title: <scalar>
slug: <scalar>
date: '<YYYY-MM-DD>'
series: miadi-chronicle
status: vessel
type: chronicle-episode
goal: <scalar>
references:
  - <scalar>
```

with `yamlScalar()` (`:74-81`) quoting anything outside `/^[A-Za-z][A-Za-z0-9 ._-]*$/` or a YAML
reserved word. Measured on disk: `2026-09-04-episode-347-…/episode.yaml` is byte-for-byte that
shape. The receipt `.mw-registration.json` (`:199, :453-465`) is
`{ state, node_id, timestamp, url[, error] }`.

`scaffoldEpisode`'s manifest (`episode.ts:205-214`) is a different, thinner record
(`status: scaffold`, `issue_anchors`, `artifacts`, no `goal`, no `type`). mkepisode calls
`scaffoldEpisode` and then REPLACES the file (`mkepisode.js:403-425`) and `rmdir`s the empty
`inquiry/`.

**Decision D1 — lift the manifest writer into inquiry-weave (`src/mint.ts`), do not call
passages from the route.** Why:

1. `packages/passages/js` is CommonJS, not a pnpm workspace member of the app
   (`mkepisode.js:294-296` says so; `ls node_modules/passages` → absent). The route cannot
   import it without a path hack.
2. The dependency direction is written down: "passages imports inquiry-weave, never the
   reverse" (`mkepisode.js:8-10`). The app already depends on `@miadi/inquiry-weave`
   (`node_modules/@miadi/inquiry-weave → packages/inquiry-weave`, `main: dist/index.js`).
3. voice-mcp shells out to `mkepisode` and parses its stdout (`closing.ts:326-372`). A process
   boundary inside a request handler is the wrong seam for typed errors and dry-run.
4. #621's own action step: "Extend `mkepisode` (or add `passages mint`) so one invocation
   writes manifest + receipt + lineage + script". A typed `mintEpisode()` in the package
   passages already imports lets passages adopt it later without a second writer.

The lifted writer is tested for byte parity against passages' `buildManifestYaml` (the test
`require()`s `packages/passages/js/lib/mkepisode.js` read-only).

### R4. The five-stage gate exists as code in voice-mcp, and cannot be imported

`packages/voice-mcp/src/closing.ts:135-283` `proveClosing()` — the five probes and drift
names (`GHOST-NODE`, `UNCOMMITTED-VESSEL`, `DIRTY-VESSEL`, `UNPUSHED-VESSEL`,
`UNREGISTERED-VESSEL`, `POISONED-RECEIPT`, `PENDING-RECEIPT`, `LYING-RECEIPT`).
`closing.ts:11-14` says stages 2/3 belong to the human. William resolved that today: the API
owns commit and push. voice-mcp is out of scope for this lane; the coordinator carries the
amendment.

`@miadi/voice-mcp` is not in the app's `node_modules`, depends on `@miadi/voice` and
`@modelcontextprotocol/sdk`, and would invert the direction (voice-mcp is a consumer).

**Decision D2 — mirror `proveClosing` into `packages/inquiry-weave/src/closing.ts`**, probe for
probe, drift name for drift name, with the same `ClosingStageProof` shape
(`voice-mcp/src/types.ts:170-178`: `{stage, state: proven|owed|failed, probe, observed}`).
Divergence from the original is deliberate in one place only: `owedActions` for stages 2/3
name the API verb (`POST …/land`) before the raw git commands. Once this lands, voice-mcp can
import it and delete its copy (coordinator's call).

### R5. Wheel URL: the variable of record moved today

`/srv/miadi/episodes` commit `1900c1b` (2026-09-04): "MIADI_CHRONICLE_MW_URL is the wheel
variable of record … retire the MW_API_URL_OVERRIDE chain". The attention route
(`route.ts:32-39`) and mcp-server (`:46-53`) still read `MW_API_URL_OVERRIDE ?? MW_API_URL ??
MIADI_CHRONICLE_MW_URL`; `env.ts:51` reads `MW_API_URL` only.

**Decision D3 —** the episode door reads `MIADI_CHRONICLE_MW_URL ?? MW_API_URL ??
http://127.0.0.1:8040` and refuses any URL containing `tail3b11eb`
(`voice-mcp/src/closing.ts:28-45`, mirrored). It does not read `MW_API_URL_OVERRIDE`. The
attention route's order is left as is (out of scope); the difference is recorded in §E.

### R6. The chronicle repo, measured

```
git -C /srv/miadi/episodes rev-parse --show-toplevel        → /srv/miadi/episodes
git -C /srv/miadi/episodes/miadi-chronicle rev-parse --show-toplevel → /srv/miadi/episodes
remote origin                                               → ssh://mia@gaia:/srv/git/jgwill/episodes.git
branch                                                      → main
rev-list --count origin/main..main / main..origin/main      → 0 / 0
git status --short | wc -l                                  → 20 modified paths, other seats' work
config user.name / user.email (file:.git/config)            → jgi / jgi@gaia.jgwill.com
config core.hooksPath                                       → .githooks
git version                                                 → 2.34.1
```

`.githooks/reference-transaction` (read whole): **refuses any move of `refs/heads/main` that is
not a fast-forward** unless `MINO_ALLOW_REWIND=1`. So `git rebase origin/main` on a diverged
main is refused by the chronicle's own law, which is why `/srv/miadi/episodes/pull-rebase-push.sh`
runs with `-c core.hooksPath=/dev/null` and refuses to start on a dirty tracked tree.

Chronicle `AGENTS.md:200-215` (main-only workflow): no branches, no worktrees, fetch and
integrate before push, never force, never reset/clean/checkout/autostash to make the tree look
clean, stage named files only. Commit subject style in the log: `ep347: <title>` with a prose
body naming the issue.

### R7. Number collision, measured

```
ls $ROOT | grep -oE 'episode-[0-9]+' | sort -n | tail  → …345 346 347 543 544 545 546
allocateEpisodeNumber → 547 (max+1; the 543–546 series sits above the 335–347 run)
GET :8040/api/nodes?kind=chronicle_episode&limit=2000 → count 84, total 206, truncated false
  ids carry numbers … 342 343 344 345 346 347 543 544 545
  chronicle:2026-08-31-episode-343-a-witness-finds-its-right-episode  ← on the wheel,
  created 2026-08-31, source jgwill/Miadi#452
ls $ROOT | grep 343                                   → (nothing)
git ls-tree --name-only origin/main:miadi-chronicle | grep 343 → (nothing)
```

343 is on the wheel and nowhere on disk or origin: a card with no vessel. In `reconcile.py`'s
vocabulary that is a `GHOST-NODE`; in William's vocabulary today it is a reservation. Both
readings say the same thing to a minting door: **343 is taken.** The wheel accepts
`?kind=chronicle_episode&parent_id=…&limit=` and no free-text search
(`accepted: type, direction, kind, parent_id, limit`), so the check is list-and-scan, as
`lineage-edge.ts:20-27` already does for edges.

### R8. How the app is served (discovered, not run)

```
systemctl --user list-units → miadi-server.service  active running  "Miadi Next.js Server"
systemctl --user cat miadi-server.service → ExecStart=/etc/jgwill/miadi-server.sh start,
  WorkingDirectory=/a/src/Miadi-18, HOSTNAME=127.0.0.1, PIDFile=/tmp/miadi-server.pid
cat /etc/jgwill/miadi/mode → prod        (→ `pnpm start` = `next start -H 127.0.0.1 -p 3335`)
ps → 2128140 sh -c next start -H ${HOSTNAME:-127.0.0.1} -p ${PORT:-3335}; 2128141 next-server (v16.2.12)
pm2 → not installed; docker → no Miadi container
```

Restart is in `04-api-implementation-plan.md` §5.

### R9. The test harness

`tests/helpers/next-route-harness.mjs` registers a resolve hook so a `route.ts` can be imported
under `node --experimental-transform-types --test` with `@/` mapped to the repo root
(`tests/langfuse-callout-route.test.mjs:1-60` is the model). `packages/inquiry-weave/test/*.test.mjs`
run against `dist/` (`package.json` `test: npm run build && node --test test/*.test.mjs`);
`episode-node.test.mjs:25-57` already stands up a stub wheel with `node:http`. `dist/` is
gitignored (`.gitignore:58`), so the app sees a package change only after
`npm run build` in `packages/inquiry-weave`.

---

## I — Intent

An agent that can reach `http://127.0.0.1:3335` (or the tunnel with a writer token) and cannot
open `/srv/miadi/episodes` can:

1. mint a vessel that is byte-identical to what `mkepisode` writes, numbered without colliding
   with disk, origin, or wheel;
2. have that vessel committed and pushed by the server, path-limited, on a tree other seats are
   editing right now, with no rewind, no stash, no reset;
3. have the card registered and the receipt written;
4. read the five-stage proof back, stage by stage, with the exact probe and what it said;
5. relate and sync an inquiry artefact that already exists on the server's shelf, by name;
6. author a lineage edge on an existing episode;
7. redeem a pending receipt, or land a vessel some other tool left uncommitted;
8. ask all of this as a dry run first;
9. do the same through `inquiry-weave-mcp`, from a host that has the chronicle on disk or from
   one that only has the API.

What stays off the door, deliberately (§E4): writing chapters and narration, capture custody,
deleting or renaming episodes, and moving `main` anywhere but forward.

---

## S — Specification

### S1. Endpoint set

| method | path | auth | act |
|---|---|---|---|
| GET | `/api/chronicle/episodes` | public | usage document, `capabilities`, allocation preview (`?allocate=1`), free-check (`?number=N`) |
| POST | `/api/chronicle/episodes` | writer | **mint**: manifest → optional lineage/inquiry → register+receipt → land (commit+push) → prove |
| GET | `/api/chronicle/episodes/{ref}` | public | five-stage closing report + drift + owedActions |
| POST | `/api/chronicle/episodes/{ref}/land` | writer | path-limited add + commit + push of the vessel files; the recovery verb |
| POST | `/api/chronicle/episodes/{ref}/lineage` | writer | `appendLineageEdge` + `projectLineageEdge`, then land |
| POST | `/api/chronicle/episodes/{ref}/inquiry` | writer | `relate` + `syncArtefact` + `registerEpisode`, then land |
| POST | `/api/chronicle/episodes/{ref}/register` | writer | `registerEpisodeNode` + rewrite the receipt (redeem), then land the receipt |
| — | `/api/chronicle/attention` | — | unchanged; already exists |

`{ref}` accepts what `resolveEpisode` accepts: `347`, `ep347`, or the directory name. A path
is refused at the door (`invalid_ref`) — the filesystem is never addressed by the caller.

### S2. Request and response shapes

**POST /api/chronicle/episodes** (mint)

```jsonc
{
  "title": "the wheel remembered what git forgot",   // required, → slug per mkepisode normalizeSlug
  "goal": "<desired result this episode advances>",  // required
  "references": ["jgwill/Miadi#621", "…"],           // required, ≥1; first owner/repo#n → source_issue
  "number": 348,                                     // optional; absent → allocated (S4)
  "date": "2026-09-04",                              // optional; default local date (episode.ts:182)
  "status": "vessel",                                // optional; default vessel
  "lineage": [                                       // optional, applied before the commit
    { "field": "continues_from", "to": "ep347", "relation": "<prose>" }
  ],
  "inquiry": { "artefact": "ep347-job-…-de93ca6c72e9", "issue": "owner/repo#n" }, // optional
  "register": true,                                  // default true; false → born unregistered, receipt says so
  "land": true,                                      // default true; false → created, not committed (stage 2 owed)
  "dryRun": false
}
```

Response `201` (created) or `200` (dry run):

```jsonc
{
  "ok": true,                       // true only when every stage in `closing` is proven
  "dryRun": false,
  "episode": { "name": "2026-09-04-episode-348-the-wheel-…", "number": 348, "slug": "…", "date": "…", "path": "…" },
  "number": { "source": "explicit" | "allocated", "observed": "348 is free over 209 names (disk ∪ origin/main) and 84 wheel cards" },
  "manifest": "episode: 348\ntitle: …",             // the bytes written (or that would be)
  "files": ["miadi-chronicle/<name>/episode.yaml", "miadi-chronicle/<name>/.mw-registration.json"],
  "lineage": [ { "field": "continues_from", "entry": {…}, "alreadyPresent": false, "wheel": { "state": "created", "edge_id": "…" } } ],
  "inquiry": { "related": {…}, "synced": { "status": "synced", … }, "registered": {…} } | null,
  "registration": { "state": "registered" | "already-registered" | "pending" | "skipped", "node_id": "chronicle:<name>", "url": "http://127.0.0.1:8040", "error"?: "…" },
  "landing": {
    "integration": { "state": "up-to-date" | "fast-forwarded" | "merged" | "refused", "observed": "…" },
    "commit": { "state": "committed" | "owed", "sha"?: "…", "subject": "ep348: the wheel …", "observed": "…" },
    "push": { "state": "pushed" | "rejected" | "owed", "observed": "…" }
  },
  "closing": [ { "stage": "created", "state": "proven", "probe": "ls \"…/episode.yaml\"", "observed": "…" }, … five … ],
  "drift": [],
  "owedActions": []
}
```

`ok` is computed from `closing`, never asserted. A rejected push gives `201` with
`landing.push.state: "rejected"`, `closing[2].state: "owed"`, `drift: ["UNPUSHED-VESSEL"]`,
and `owedActions` starting with `POST /api/chronicle/episodes/ep348/land`. The vessel is on
disk and committed; nothing is undone. Stage 3 is reported unproven because it is.

**GET /api/chronicle/episodes/{ref}** → `200 { episode, closing[5], drift[], owedActions[], manifest: { present, status?, goal?, references? } }`.

**POST …/{ref}/land** `{ "subject"?: "…", "dryRun"?: false }` → `{ ok, episode, files, landing, closing, drift, owedActions }`.
Files are the vessel files the door itself knows: `episode.yaml`, `.mw-registration.json`,
`inquiry/weave.yaml`, and `inquiry/<artefact>/` for every artefact `weave.yaml` names. Never
`git add <dir>` of the whole episode: a chapter someone is drafting in that folder is not the
API's to commit.

**POST …/{ref}/lineage** `{ "field": "continues_from"|"relates_to", "to": "<ref>", "relation": "<prose>", "reverse"?: "<prose>", "land"?: true, "dryRun"?: false }`.

**POST …/{ref}/inquiry** `{ "artefact": "<name under MIADI_INQUIRY_ROOT>", "issue"?: "owner/repo#n", "land"?: true, "dryRun"?: false }`.
`artefact` is a bare directory name (no `/`, no `..`); the server resolves it under
`resolveEnv().inquiryRoot`. The artefact-side writes (`.weave.yaml`, `AGENTS.md`) land in the
inquiry repo, which is a different git repository; the door does not commit there and says so
in `inquiry.artefactSide: "written, not committed (other repository)"`.

**POST …/{ref}/register** `{ "land"?: true, "dryRun"?: false }` → `{ registration, receipt, landing?, closing }`.

**GET /api/chronicle/episodes**

```jsonc
{ "usage": {…the table above…}, "capabilities": { "view": true, "mint": <writer gate passes> },
  "chronicle": { "root": "/srv/…/miadi-chronicle", "gitRoot": "/srv/miadi/episodes", "wheel": "http://127.0.0.1:8040" },
  "allocation"?: { "next": 547, "max": 546, "observed": "…", "reserved": [343] },   // ?allocate=1
  "number"?: { "value": 343, "free": false, "observed": "episode 343 already resolves on the wheel: chronicle:2026-08-31-episode-343-…" } // ?number=343
}
```

`?allocate=1` runs `git fetch` (a read of the remote) and lists the wheel; it writes nothing.

### S3. Auth

Every POST opens with `const denied = requireMiadiAuth(request, { write: true }); if (denied) return denied;`
(`lib/api-gate.ts:298`). Every GET is public, and echoes `capabilities.mint` the way the
attention route echoes `capabilities.answer`, so a client can render an honest button.

### S4. Number rule

An explicit `number` is accepted when it is free everywhere the chronicle is known. Absent, the
door allocates. Both paths run the same check; the check is fail-**closed** (jgwill/Miadi#584):

1. `git fetch origin main` (timeout 30 s). If the fetch fails, the check continues on local
   + wheel and says `origin unreadable, local only` in `observed` — the same sentence
   `voice-mcp/src/closing.ts:316` uses.
2. Integrate (S5) so the local root sees what origin has. If integration is refused, the check
   still unions `git ls-tree --name-only origin/main:miadi-chronicle` so a number pushed by
   another host is seen even when it is not yet on this disk.
3. Union: local dir names ∪ origin/main tree names ∪ wheel card ids
   (`GET {wheel}/api/nodes?kind=chronicle_episode&parent_id=chronicle:miadi-chronicle&limit=5000`,
   5 s timeout). A wheel that does not answer makes the check say so (`wheel unreachable`) and
   **refuses to allocate** (an allocation blind to the wheel is the #584 defect); an explicit
   number is still accepted when disk and origin are free, with `observed` naming the blind spot.
4. Taken = any name matching `/-episode-0*<n>-/`. Taken → `409 number_taken` with `existing[]`
   (names and where each was seen: `disk`, `origin`, `wheel`).
5. Allocation = `max(union) + 1`. It never fills a hole: today that is 547, not 348. A caller
   who wants 348 says `"number": 348`; explicit is not silent.

**Reservation (D4).** A reservation is a wheel card: `chronicle:<date>-episode-<n>-<slug>`
registered before the directory exists. That is what 343 is today (R7), it is visible to every
host without a pull, and the door already lists the wheel for #584 — so the check costs nothing
extra. The reconciler will read such a card as `GHOST-NODE` until it carries a status of its
own; that is the coordinator's and the wheel's to name, not this lane's. No reservation file,
no env list: two mechanisms for one fact is how facts drift.

### S5. The git sequence and why it is safe beside other seats' dirty files

Run with `execFile("git", ["-C", gitRoot, …])`, 30 s timeout each, `env` inherited plus
`GIT_TERMINAL_PROMPT=0`. `gitRoot` is measured (`git -C <chronicleRoot> rev-parse --show-toplevel`),
never assumed.

```
0  preflight    rev-parse --abbrev-ref HEAD == main            else 409 chronicle_not_main
                no .git/rebase-merge, rebase-apply, MERGE_HEAD  else 409 chronicle_busy
1  fetch        git fetch origin main --quiet
2  integrate    if origin/main is an ancestor of main  → up-to-date
                elif main is an ancestor of origin/main → git merge --ff-only origin/main
                else (diverged)                        → git merge --no-edit origin/main
                on any failure                         → 409 chronicle_integration_refused
                                                          body carries git's own words + status --short
3  write        mkdir <root>/<name>   (non-recursive; EEXIST = the atomicity primitive)
                write episode.yaml via temp + rename (mkepisode.js:414-424)
                lineage / inquiry writes (S2), then registration + receipt
4  add          git add -- <each vessel file by relative path>
5  commit       git commit -m "<subject>" -m "<body>"   (path-limited by what was staged in 4;
                 the index may hold nothing else because the door never stages anything else,
                 and a pre-existing staged path of another seat is refused at preflight:
                 git diff --cached --quiet must pass, else 409 chronicle_busy "index holds another seat's staged paths")
6  push         git push origin main
                rejected (non-fast-forward)            → fetch again, one integrate (step 2) — the
                 merge touches only the remote's new files — then one more push; still rejected
                 → stop. landing.push = rejected, stage 3 owed, drift UNPUSHED-VESSEL.
```

Why not rebase: `.githooks/reference-transaction` refuses any non-fast-forward move of `main`,
and rebase moves `main` sideways. `--autostash` would stash other seats' files. `-c
core.hooksPath=/dev/null` and `MINO_ALLOW_REWIND=1` are the human's escape hatches
(`pull-rebase-push.sh`), not an API's. A merge commit is the price of a shared tree that
forbids rewinds; it never drops a commit and the hook lets it through (old reachable from new).

Why a dirty tree is safe: `git merge` (ff or not) refuses before touching anything when a file it
would change is dirty ("Your local changes … would be overwritten by merge") — so other seats'
edits are either untouched or the door stops. The door never runs `stash`, `reset`, `checkout
--`, `clean`, or `add .`. It never resolves a conflict: a merge that stops with `MERGE_HEAD`
present is reported as `chronicle_integration_refused` with `git status --short`, and the next
call sees `chronicle_busy` until a human clears it. Both states are named, neither is hidden.

What the response says about each step is what git said (`observed`), sliced to 500 chars, the
way `voice-mcp/src/closing.ts:49-69 observe()` reports.

Commit message: subject `ep<n>: <title>` (the chronicle's own style, R6), body
`Vessel minted through POST /api/chronicle/episodes.\n\nRef: <first owner/repo#n>` plus every
other reference on its own line. Author is the repo-local `jgi <jgi@gaia.jgwill.com>`; the door
adds a trailer `Minted-By: miadi-api` so a seat can tell an API commit from a hand one, which
the hook's comment says the author field cannot.

Concurrency: one in-process mutex serialises mint/land/lineage/inquiry/register (a promise
chain in `git-landing.ts`). Two servers or a CLI seat racing the door are bounded by `mkdir`
EEXIST and by git's index lock; a different-slug same-number race across processes is not
prevented, and the design says so rather than pretending.

### S6. Registration and receipt

After the manifest exists: `registerEpisodeNode(wheel, { episodeName, name: "Episode <n> — <title>", description: goal, sourceIssue })`
(`episode-node.ts:338`) — fail-open, then the receipt `{ state, node_id, timestamp, url[, error] }`
written beside `episode.yaml` (`mkepisode.js:453-465`, same keys, same order). `register:false`
skips the call and writes **no receipt** — exactly mkepisode's unflagged behaviour — and the
closing report then says `born invisible` for stage 5, as `closing.ts:246` does. The wheel URL
is refused when it contains `tail3b11eb` (`409 wheel_refused`) before anything is written.

### S7. Idempotency

- Mint with an explicit `number` that now exists → `409 number_taken` carrying `existing[]` and,
  when exactly one vessel carries it on disk, that vessel's full closing report. A retry after a
  timeout therefore learns what happened instead of minting a twin.
- Mint without `number` twice → two episodes. The door says so in the usage document and
  recommends `GET ?allocate=1` then POST with the number when a retry may happen.
- `land`, `lineage`, `inquiry`, `register` are idempotent by construction: `appendLineageEdge`
  reports `alreadyPresent`, `syncArtefact` reports `up-to-date`, `registerEpisodeNode` reports
  `already-registered`, and `git commit` with nothing staged is reported as `commit: owed,
  observed: "nothing to commit for <paths>"` rather than an error.
- Dry run is side-effect free at every layer: no mkdir, no wheel POST, no git write. It still
  runs `git fetch` and the wheel GET so the number answer is the real one.

### S8. Error taxonomy (HTTP → `{ error, message[, …] }`, `cache-control: no-store`)

| status | error | when |
|---|---|---|
| 400 | `invalid_json` | body is not JSON |
| 401 | `Unauthorized` | `requireMiadiAuth` (its own body) |
| 404 | `episode_not_found` | `EpisodeResolutionError` |
| 409 | `episode_ambiguous` | `AmbiguousEpisodeError` (candidates listed) |
| 409 | `number_taken` | S4 (`existing[]`) |
| 409 | `number_unverifiable` | allocation asked while the wheel does not answer |
| 409 | `wheel_refused` | poisoned host |
| 409 | `chronicle_not_main` / `chronicle_busy` / `chronicle_integration_refused` | S5 |
| 409 | `manifest_missing` | lineage/inquiry on a manifest-less dir (`missingManifestRemedy`) |
| 409 | `weave_error` | `WeaveError` from relate/sync/register |
| 422 | `identity_required` | mint without title/goal/references; lineage without field/to/relation; inquiry without artefact |
| 422 | `invalid_number` / `invalid_date` / `invalid_field` / `invalid_ref` / `invalid_artefact` / `invalid_reference` | shape failures, each naming the rule |
| 500 | `episode_failed` | anything else, logged `[chronicle/episodes]` |

One class carries the 409/422 codes: `EpisodeServiceError(code, message, detail?)` in
`mint.ts`, the way `AttentionServiceError` does (`attention.ts:196-204`).

### S9. Dry-run mode

`dryRun: true` on every POST. Mint dry-run returns the identity that would be created, the
manifest bytes, the number evidence (real fetch, real wheel read), the files that would be
staged, the commit subject, and `landing: { integration: <what would run>, commit: "would commit", push: "would push" }`.
Lineage/inquiry/land/register dry-runs return their library's own dry-run results
(`appendLineageEdge {dryRun}`, `syncArtefact {dryRun}`, `projectLineageEdge {dryRun}`).

### S10. MCP tools (`packages/inquiry-weave/src/mcp-server.ts`, same `TOOLS[]` pattern)

| tool | input | maps to |
|---|---|---|
| `chronicle_episode_mint` | `{ title, goal, references[], number?, date?, lineage?[], inquiry?, register?, land?, dryRun? }` | `mintEpisode` |
| `chronicle_episode_status` | `{ episode }` | `proveEpisodeClosing` |
| `chronicle_episode_land` | `{ episode, subject?, dryRun? }` | `landEpisode` |
| `chronicle_episode_lineage` | `{ episode, field, to, relation, reverse?, land?, dryRun? }` | `authorEpisodeLineage` |
| `chronicle_episode_inquiry` | `{ episode, artefact, issue?, land?, dryRun? }` | `weaveEpisodeInquiry` |
| `chronicle_episode_register` | `{ episode, land?, dryRun? }` | `redeemEpisodeRegistration` |
| `chronicle_episode_number` | `{ number? }` | `checkEpisodeNumber` / `previewAllocation` |

Transport rule: when `MIADI_CHRONICLE_ROOT` is set and exists, the tool calls the library on
disk (as the attention tools do). Otherwise, when `MIADI_INQUIRY_API_BASE` is set, the tool
forwards to `/api/chronicle/episodes…` with `Authorization: Bearer $MIADI_API_TOKEN_WRITER`
— so an agent whose MCP host has no chronicle still has the verbs. Neither set → the error
names both variables. serverInfo version is left at `0.8.3`; the coordinator decides releases.

---

## E — Export (what leaves this design, and what is kept off it)

### E1. New files

- `packages/inquiry-weave/src/mint.ts` — manifest writer (mkepisode shape), receipt, number
  check, `mintEpisode`, `landEpisode`, `authorEpisodeLineage`, `weaveEpisodeInquiry`,
  `redeemEpisodeRegistration`, `EpisodeServiceError`.
- `packages/inquiry-weave/src/git-landing.ts` — preflight, fetch, integrate, path-limited
  add/commit, push, the mutex.
- `packages/inquiry-weave/src/closing.ts` — five-stage proof, drift names, poisoned-wheel refusal.
- `app/api/chronicle/episodes/route.ts`, `[ref]/route.ts`, `[ref]/land/route.ts`,
  `[ref]/lineage/route.ts`, `[ref]/inquiry/route.ts`, `[ref]/register/route.ts`,
  `app/api/chronicle/episodes/shared.ts`.
- Tests: `packages/inquiry-weave/test/{git-landing,mint,closing,mcp-episodes}.test.mjs`,
  `tests/chronicle-episodes-route.test.mjs`.

### E2. Modified

- `packages/inquiry-weave/src/index.ts` (exports), `src/mcp-server.ts` (seven tools).

### E3. Not modified, on purpose

`packages/voice-mcp/**` (closing.ts:11 amendment is the coordinator's), `packages/passages/**`
(it may later import `buildVesselManifestYaml` from inquiry-weave and drop its own),
`app/api/chronicle/attention/route.ts` (wheel-URL order, R5), `env.ts` (`mwUrl` precedence —
the door resolves its own, S3/D3, so that a package-wide change is one deliberate commit, not a
side effect here).

### E4. Deliberately NOT over HTTP

- **Writing chapters, scripts, narration, any content file.** The door creates vessels and
  relations, never inquiry content — the package's own boundary (`artefact.ts:3-6`,
  `mkepisode.js:12-13`). Content arrives by a human's or an agent's own custody of the files,
  or by the sync verb from an artefact the human already wrote.
- **Capture custody** (voice, audio, screenshots) — owned by the Ilex skill variant and the
  voice layer; this door does not hold media.
- **Delete, rename, renumber** — the chronicle forbids rewinds and the duplicates are permanent
  (#584); the door only ever adds.
- **Force-push, reset, stash, rebase, hook bypass** — S5.
- **Creating the GitHub issue** (`inquiry-weave inquire` does, via `gh`) — a token the server
  does not hold, and the attention door's inheritance ("no GitHub token exists in this process").
- **Reservations as a file** — D4.

### E5. Open to the coordinator

- Whether `Minted-By: miadi-api` is the trailer name the hook's witness log should learn.
- Whether the wheel should give a reservation card a status of its own so `reconcile.py` stops
  reading 343 as a `GHOST-NODE`.
- Whether voice-mcp's `closing.ts` becomes an import of inquiry-weave's.

🌸: A vessel that reaches the chronicle through this door arrives the same shape as one made by
hand, and the person who asked for it can read, stage by stage, what actually happened.
