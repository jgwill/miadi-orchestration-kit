# 04 — Implementation of the episode door

Lane B, Gaia, 2026-09-04/05. Design: `03-api-design.md`. Anchor jgwill/Miadi#621, companion
jgwill/miadi-orchestration-kit#41. Model class: Fable 5.1.

## 1. Files

### Created

| path (under `/a/src/Miadi`) | purpose |
|---|---|
| `packages/inquiry-weave/src/git-landing.ts` | fetch → integrate (ff-only, else merge, never rebase) → `git add -- <paths>` → `git commit -- <paths>` → push with one integrate-and-retry; in-process lock per git root; every step reports what git said |
| `packages/inquiry-weave/src/closing.ts` | the five-stage proof mirrored from voice-mcp (`proveEpisodeClosing`), drift names, poisoned-wheel refusal, `closingIsProven` |
| `packages/inquiry-weave/src/mint.ts` | `buildVesselManifestYaml` (mkepisode shape), number check over disk ∪ origin/main ∪ wheel, `previewAllocation`, `mintEpisode`, `landEpisode`, `authorEpisodeLineage`, `weaveEpisodeInquiry`, `redeemEpisodeRegistration`, `episodeDoorStatus`, `EpisodeServiceError`, `chronicleWheelUrl` |
| `app/api/chronicle/episodes/shared.ts` | `noStore`, error taxonomy → HTTP status, door context, JSON body reader, `{ref}` param reader |
| `app/api/chronicle/episodes/route.ts` | `GET` usage / capabilities / `?allocate=1` / `?number=N`; `POST` mint |
| `app/api/chronicle/episodes/[ref]/route.ts` | `GET` five-stage status (public) |
| `app/api/chronicle/episodes/[ref]/land/route.ts` | `POST` path-limited commit + push (recovery verb) |
| `app/api/chronicle/episodes/[ref]/lineage/route.ts` | `POST` lineage edge (manifest + wheel), landed |
| `app/api/chronicle/episodes/[ref]/inquiry/route.ts` | `POST` relate + sync + weave registration for an artefact on the shelf, landed |
| `app/api/chronicle/episodes/[ref]/register/route.ts` | `POST` redeem the wheel card and the receipt, landed |
| `packages/inquiry-weave/test/door-fixtures.mjs` | bare origin + server clone + other-host clone (optional ff-only hook), stub wheel |
| `packages/inquiry-weave/test/git-landing.test.mjs` | 8 tests: preflight, ff beside a dirty file, merge on divergence under the hook, refusal on overlap, path-limited commit leaving another seat's staged path, rejected push retried once then reported, the lock |
| `packages/inquiry-weave/test/closing.test.mjs` | 3 tests: poisoned wheel, the owed/failed shape, GHOST-NODE / LYING-RECEIPT / PENDING-RECEIPT / proven |
| `packages/inquiry-weave/test/mint.test.mjs` | 10 tests: byte parity with passages' `buildManifestYaml`, wheel-URL precedence, poisoned refusal, disk/origin/wheel collisions (343 on the wheel only), allocation refusing a silent wheel, dry run, full mint with all five proven, register:false + land recovery + redeem, lineage idempotency, inquiry weave |
| `packages/inquiry-weave/test/mcp-episodes.test.mjs` | 3 tests: seven tools listed and minting through the library, HTTP forwarding with the writer bearer, the two-variable error |
| `tests/chronicle-episodes-route.test.mjs` | 7 tests against the real handlers through `tests/helpers/next-route-harness.mjs`: public GET + capability echo, 401/400/422, dry run then 201 with five proven, 409 `number_taken`, status 200/404/422, lineage 422/409/200, inquiry 422/200, land + register idempotency |

### Modified

| path | change |
|---|---|
| `packages/inquiry-weave/src/index.ts` | `export *` for the three new modules |
| `packages/inquiry-weave/src/mcp-server.ts` | seven `chronicle_episode_*` tools; library when `MIADI_CHRONICLE_ROOT` exists, else forward to `MIADI_INQUIRY_API_BASE` with `MIADI_API_TOKEN_WRITER`; serverInfo version untouched |

Not modified: `packages/voice-mcp/**`, `packages/passages/**`, `app/api/chronicle/attention/route.ts`, `env.ts`, the chronicle, the wheel.

## 2. One measured divergence from the design

`03-api-design.md` S5 said the door refuses a diverged main with a dirty tree. The chronicle's
`.githooks/reference-transaction` forbids rebase (non-ff move of `main`), so the implementation
integrates divergence with `git merge --no-edit origin/main`, which the hook admits and which
git itself refuses before touching anything when a file it would change is dirty or when the
index holds another seat's staged change. Proven in `git-landing.test.mjs` ("merges (never
rebases) … the ff hook lets it through" and "refuses, without touching anything …").

## 3. Verification (commands run on Gaia, real exit codes)

```
cd packages/inquiry-weave && npm run build                                   exit=0  (tsc, 0 errors)
../../node_modules/.bin/tsc -p tsconfig.build.json --noEmit                  exit=0  (0 errors)
MIADI_TEST_TMP=<scratchpad>/tmp node --test test/git-landing.test.mjs test/mint.test.mjs \
    test/closing.test.mjs test/mcp-episodes.test.mjs                         exit=0  tests 24 pass 24 fail 0
npx tsc -p <scratchpad>/tsconfig.routes.json   (extends the repo tsconfig, include = the
    episode routes + next-env.d.ts)                                          exit=0  (0 errors)
node --experimental-transform-types --test tests/chronicle-episodes-route.test.mjs
                                                                             exit=0  tests 7 pass 7 fail 0
npx eslint <my files>                                                        exit=2  "ESLint couldn't find a configuration file"
```

Lint is not runnable in this checkout: `package.json` `lint` is `eslint .` with eslint 8.57.1
and no `.eslintrc*` / `eslint.config.*` exists at the root (`ls -a | grep eslint` → nothing).
That is the checkout's state, not this lane's to change.

Every test run creates its git repositories under the session scratchpad (`MIADI_TEST_TMP`)
and its wheel on a random loopback port. `/srv/miadi/episodes` and `:8040` were read (fetch,
`ls-tree`, `GET /api/nodes`) while designing and never written.

## 4. What was not verified

- The live route on `:3335`: the app runs `next start` from a prod build that predates these
  files, so the door is not reachable until the rebuild + restart in §5 (not run by this lane).
- A push to the real bare origin `ssh://mia@gaia:/srv/git/jgwill/episodes.git` by the service
  user (`mia`, `HOME=/home/mia`) — the tests push to a local bare repo. The commit identity
  will be the repo-local `jgi <jgi@gaia.jgwill.com>`.
- The real wheel accepting `POST /api/nodes` from the app process (the stub accepted it).
- `next build` of the whole app with these routes (the scoped tsc passed; a full build was not
  run to avoid disturbing the `.next` the running server is serving).

## 5. Build and restart on Gaia (discovered, not run)

The app is `miadi-server.service` (systemd user unit), `ExecStart=/etc/jgwill/miadi-server.sh start`,
`WorkingDirectory=/a/src/Miadi-18`, mode file `/etc/jgwill/miadi/mode` = `prod` → `pnpm start`
(`next start -H 127.0.0.1 -p 3335`) from `.next/BUILD_ID`. `pm2` is not installed; no Docker
container serves Miadi.

```bash
# 1. the package the routes import (dist/ is gitignored; the app reads dist/index.js)
cd /a/src/Miadi-18/packages/inquiry-weave && npm run build
# 2. the app (prod mode serves .next; the script refuses to start without BUILD_ID)
cd /a/src/Miadi-18 && pnpm build
# 3. restart
systemctl --user restart miadi-server.service
systemctl --user status miadi-server.service --no-pager
# 4. prove the door answers
curl -s http://127.0.0.1:3335/api/chronicle/episodes | head -c 400
curl -s -H "Authorization: Bearer $MIADI_API_TOKEN_WRITER" \
  "http://127.0.0.1:3335/api/chronicle/episodes?allocate=1&number=343"
```

`/etc/jgwill/miadi-server.sh` mentions `miadi-prod-rebuild.sh` for step 2; that script was not
found under `/etc/jgwill/` on this host (`ls /etc/jgwill` shows no such file), so `pnpm build`
is named directly. A first live mint should be a `dryRun: true` POST, then one real POST with an
explicit free number, then `GET /api/chronicle/episodes/{ref}` to read the five stages back.

## 6. MCP

`inquiry-weave-mcp` gains `chronicle_episode_number|mint|status|land|lineage|inquiry|register`.
With `MIADI_CHRONICLE_ROOT` on the host it calls the library; without it and with
`MIADI_INQUIRY_API_BASE` (+ `MIADI_API_TOKEN_WRITER`) it forwards to the door. The wheel is
`MIADI_CHRONICLE_MW_URL` first, `MW_API_URL` second, `http://127.0.0.1:8040` last.

🌸: The person minting an episode from a phone or a remote seat now gets the same vessel a hand
would make, and a report that says which of the five stages actually happened.
