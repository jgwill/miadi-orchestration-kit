#!/usr/bin/env node
// score-proposal — ask Jev, for every coded card on a proposal page, whether it is obvious
// enough to execute now, and split the page into "would do now", "after your go" and "needs you".
//
//   node score-proposal.mjs <page.html> --request <request.md> [--facts <facts.md>]
//        [--questions questions.json] [--policy policy.json] [--model jev-1.13.0]
//        [--only A,E,D,Q] [--dry] [--out scores.json] [--ledger <file.jsonl>]
//   node score-proposal.mjs models            # the key's service and models; no inference
//
// What leaves the host, per card: the card's own text, Guillaume's request (the --request
// file, his words), the page's "Today" facts, and the typed questions. Nothing else. The key
// is read by lane-check's decider from the environment or one literal line of ~/.env, and
// it is never printed. `--dry` sends nothing and prints the request sizes.
//
// The decider and the DecisionGate machine are lane-check's (jgwill/smcraft
// examples/decision-gate/lane-check), imported by path until they move into the kit
// (lane-check/ISSUE-DRAFTS.md). Set LANE_CHECK_DIR to another checkout.
//
// Bands, per card, after the Decision Gate's D1 rule: a card the engine reads as naming,
// deleting, reaching an outside audience or settling a relationship goes to "needs you"
// whatever its number. Otherwise obvious_now decides: do_now at or above act_at is
// "would do now"; do_now below it, or do_after_go, is "after your go"; needs_decision is
// "needs you". Thresholds come from policy.json and say who set them.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
const decider = await import(pathToFileURL(join(LANE_CHECK, "lib", "decider.mjs")).href);
const { buildRequest, decideDry, decideJev, listModels, readAnswer, estimateTokens } = decider;

export const BANDS = { act: "would do now", ask: "after your go", owner: "needs you" };

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith("--")) { args._.push(t); continue; }
    const key = t.slice(2); const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) args.flags[key] = true; else { args.flags[key] = next; i += 1; }
  }
  return args;
}

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, " ").trim();

// Every coded card on the page: an element whose id is a code (A1, D2, E7, Q3 …). A card's
// text runs from its opening tag to the next card or the next section heading.
export function extractCards(html, only = null) {
  const re = /<(?:div|li|section|article)[^>]*\bid="([A-Z]{1,2}\d{1,3})"[^>]*>/g;
  const starts = [];
  let m;
  while ((m = re.exec(html))) starts.push({ code: m[1], at: m.index });
  const cards = [];
  for (let i = 0; i < starts.length; i += 1) {
    const { code, at } = starts[i];
    const kind = code.replace(/\d+$/, "");
    if (only && !only.includes(kind)) continue;
    const nextCard = starts[i + 1]?.at ?? html.length;
    const nextHeading = html.indexOf("<h2", at + 1);
    const end = Math.min(nextCard, nextHeading === -1 ? html.length : nextHeading);
    const text = strip(html.slice(at, end)).replace(new RegExp(`^${code}\\s+`), "");
    cards.push({ code, kind, text: text.slice(0, 1600) });
  }
  return cards;
}

// The page's own "Today" facts, so the engine reads the same current reality the reader does.
export function extractFacts(html) {
  const m = /<h3>\s*Today\s*<\/h3>([\s\S]*?)<\/ul>/i.exec(html);
  return m ? strip(m[1]) : "";
}

export function loadJson(path) { return JSON.parse(readFileSync(path, "utf8")); }

function wire(questions) {
  return Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, { type: q.type, instructions: q.instructions, criteria: q.criteria }]));
}

// One card's readings into a band. The D1 rule first, then obvious_now against the policy.
export function bandOf(readings, policy, set) {
  const ownerQ = set.owner_question;
  const owner = readings[ownerQ];
  const act_at = policy.classes?.obvious_now?.act_at;
  if (owner && owner.value === true && typeof owner.p === "number" && owner.p >= (policy.classes?.[ownerQ]?.owner_at ?? 0.5)) {
    return { band: "owner", why: `${ownerQ} ${owner.p.toFixed(2)}: the Decision Gate's D1 rule, never settled by the number` };
  }
  const o = readings.obvious_now;
  if (!o || o.value == null) return { band: "ask", why: "obvious_now unanswered" };
  if (o.value === "needs_decision") return { band: "owner", why: `obvious_now needs_decision ${o.p.toFixed(2)}` };
  if (o.value === "do_now" && typeof act_at === "number" && o.p >= act_at) return { band: "act", why: `obvious_now do_now ${o.p.toFixed(2)} at or above act_at ${act_at}` };
  if (o.value === "do_now") return { band: "ask", why: `obvious_now do_now ${o.p.toFixed(2)} below act_at ${act_at ?? "unset"}` };
  return { band: "ask", why: `obvious_now ${o.value} ${o.p.toFixed(2)}` };
}

export function ledgerPath(env = process.env) {
  return env.PROPOSAL_SCORE_LEDGER || join(homedir(), ".miadi", "decisions", "proposal-score.jsonl");
}

async function scoreCard({ card, request, facts, set, policy, model, dry }) {
  const questions = set.sets[set.kind_sets[card.kind]];
  if (!questions) return null;
  const state = { card: { code: card.code, kind: set.kind_names[card.kind] ?? card.kind, text: card.text }, request, facts, rule: set.rule };
  const req = buildRequest(state, wire(questions), model);
  const result = dry ? await decideDry(req) : await decideJev(req);
  const readings = {};
  for (const [id, q] of Object.entries(questions)) {
    const r = readAnswer(result.answers?.[id]);
    readings[id] = { class: q.class, type: q.type, value: r.value, p: r.p, p_measures: r.p_measures, probabilities: r.probabilities ?? null };
  }
  const band = dry ? { band: null, why: "dry run: nothing sent" } : bandOf(readings, policy, set);
  return { code: card.code, kind: card.kind, estimated_input_tokens: estimateTokens(req), model: result.model, sent: result.sent, run_id: result.billing?.run_id ?? result.id ?? null, billing: result.billing ?? null, readings, ...band };
}

function ledgerRecords(scored, { page, policy, set, now }) {
  const out = [];
  for (const s of scored) {
    for (const [qid, r] of Object.entries(s.readings)) {
      out.push({
        kind: "decision",
        id: `prop-${s.code}-${qid}-${now.replace(/[-:.TZ]/g, "").slice(0, 14)}`,
        at: now,
        question: { id: qid, class: r.class, kind: r.type, subject_ref: `proposal:${page}#${s.code}`, criteria_ref: set.version },
        relation: policy.classes?.[r.class] ? { word_owner: policy.classes[r.class].word_owner ?? "lane", reversible: policy.classes[r.class].reversible ?? true, outward_facing: policy.classes[r.class].outward_facing ?? false } : null,
        policy: { class: r.class, act_at: policy.classes?.[r.class]?.act_at ?? null, block_at: policy.classes?.[r.class]?.block_at ?? null, set_by: policy.set_by ?? null },
        value: r.value, p: r.p, p_measures: r.p_measures, probabilities: r.probabilities,
        band: s.band, band_why: s.why, decider: s.model, run_id: s.run_id, ruling_id: null,
      });
    }
  }
  return out;
}

export function summary(scored) {
  const lines = ["| code | band | obvious_now | p | why |", "|---|---|---|---|---|"];
  for (const s of scored) {
    const o = s.readings.obvious_now;
    lines.push(`| ${s.code} | ${s.band ? BANDS[s.band] : "dry"} | ${o?.value ?? "-"} | ${typeof o?.p === "number" ? o.p.toFixed(2) : "-"} | ${s.why} |`);
  }
  const by = (b) => scored.filter((s) => s.band === b).map((s) => s.code).join(", ") || "none";
  lines.push("", `would do now: ${by("act")}`, `after your go: ${by("ask")}`, `needs you: ${by("owner")}`);
  return lines.join("\n");
}

async function main() {
  const { _: pos, flags } = parseArgs(process.argv.slice(2));
  if (pos[0] === "models") {
    const m = await listModels();
    console.log(`${m.service} · ${m.keyName} · ${m.destination}`);
    for (const model of m.models) console.log(`  ${model.id ?? model.name}`);
    return;
  }
  const page = pos[0];
  if (!page || !flags.request) {
    console.log("usage: score-proposal.mjs <page.html> --request <request.md> [--facts <facts.md>] [--questions q.json] [--policy p.json] [--model jev-1.13.0] [--only A,E,D,Q] [--dry] [--out scores.json] [--ledger file]");
    process.exit(2);
  }
  const html = readFileSync(page, "utf8");
  const set = loadJson(flags.questions || join(HERE, "questions.json"));
  const policy = loadJson(flags.policy || join(HERE, "policy.json"));
  const only = (flags.only || set.default_kinds || "A,E,D,Q").split(",").map((s) => s.trim());
  const request = readFileSync(flags.request, "utf8").trim();
  const facts = flags.facts ? readFileSync(flags.facts, "utf8").trim() : extractFacts(html);
  const model = flags.model || set.model || "jev-latest";
  const dry = Boolean(flags.dry);
  const cards = extractCards(html, only);
  if (cards.length === 0) throw new Error("no coded cards found on the page");
  const scored = [];
  for (const card of cards) {
    const s = await scoreCard({ card, request, facts, set, policy, model, dry });
    if (!s) continue;
    scored.push(s);
    const o = s.readings.obvious_now;
    console.log(`${(s.band ? BANDS[s.band] : "dry").padEnd(13)} ${s.code.padEnd(4)} ${String(o?.value ?? "-").padEnd(15)} p=${typeof o?.p === "number" ? o.p.toFixed(2) : "  -  "} ~${s.estimated_input_tokens} tokens${s.sent ? "" : " (not sent)"}`);
  }
  const now = new Date().toISOString();
  const record = { at: now, page: resolve(page), model, questions_version: set.version, policy_set_by: policy.set_by ?? null, dry, cards: scored };
  if (flags.out) writeFileSync(flags.out, JSON.stringify(record, null, 2) + "\n");
  if (!dry) {
    const ledger = flags.ledger || ledgerPath();
    mkdirSync(dirname(ledger), { recursive: true });
    for (const r of ledgerRecords(scored, { page: resolve(page), policy, set, now })) appendFileSync(ledger, `${JSON.stringify(r)}\n`);
    console.log(`ledger ${ledger}`);
  }
  console.log("");
  console.log(summary(scored));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`score-proposal: ${error.message}`); process.exit(1); });
}
