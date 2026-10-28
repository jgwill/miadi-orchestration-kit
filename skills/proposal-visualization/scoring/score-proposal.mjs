#!/usr/bin/env node
// score-proposal — ask Jev, for every coded card on a proposal page, whether it is obvious
// enough to execute now, and split the page into "would do now", "after your go" and "needs you".
//
//   node score-proposal.mjs <page.html> --request <request.md> --facts <facts.md>
//        [--questions questions.json] [--policy policy.json] [--model jev-1.14.0]
//        [--only A,E,D,Q] [--dry] [--out scores.json] [--ledger <file.jsonl>]
//   node score-proposal.mjs models            # the key's service and models; no inference
//
// What leaves the host, per card: the card's own text, Guillaume's request (the --request
// file, his words), the page's facts file (--facts: the paths and numbers the cards rest on;
// without it, the page's "Today" list), and the typed questions. Nothing else. The key is
// read by lane-check's decider from the environment or one literal line of ~/.env, and it is
// never printed. `--dry` sends nothing and prints the request sizes, with the paid tokens to
// expect at Episode 562's measured ratio.
//
// The decider and the DecisionGate machine are lane-check's (jgwill/smcraft
// examples/decision-gate/lane-check), imported by path until they move into the kit
// (lane-check/ISSUE-DRAFTS.md). Set LANE_CHECK_DIR to another checkout.
//
// Bands, per card, in this order (Jev study of Episode 564, S2):
//   1. any of the six trigger nouls at or above owner_at -> needs you (the D1 rule);
//   2. any trigger inside the uncertain band (0.4 to 0.6) -> needs you;
//   3. obvious_now needs_decision, or its exit `other` -> needs you;
//   4. obvious_now do_now at confidence >= act_at -> would do now;
//   5. otherwise -> after your go.
// Thresholds come from policy.json and say who set them. A choice's confidence is
// (p_max - 1/n) / (1 - 1/n), so each record keeps top_probability beside it.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
const decider = await import(pathToFileURL(join(LANE_CHECK, "lib", "decider.mjs")).href);
const { buildRequest, decideDry, decideJev, listModels, readAnswer, estimateTokens } = decider;

export const BANDS = { act: "would do now", ask: "after your go", owner: "needs you" };
// Paid input tokens were 1.61 times the JSON/4 estimate over Episode 562's 2,001 calls
// (jev-study-261026.md part 2.6). The dry run prints the estimate at that ratio until each
// page's ledger measures its own (estimated_input_tokens beside paid_input_tokens).
export const PAID_RATIO = 1.61;
// Aliases resolve to different versions on the two hosts; a ledger on one cannot be read.
export const ALIASES = ["jev-latest", "jev-preview"];

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

// The questions for one card: the set's own questions plus the six trigger nouls.
export function questionsFor(set, setName) {
  const own = set.sets?.[setName];
  if (!own) return null;
  return { ...own, ...(set.triggers ?? {}) };
}

// obvious_now's options in a rotated order, so the first-option lean the vendor documents
// can be measured (R7). Card i gets the options shifted by i.
export function rotateCriteria(criteria, shift) {
  const keys = Object.keys(criteria);
  const k = ((shift % keys.length) + keys.length) % keys.length;
  const order = [...keys.slice(k), ...keys.slice(0, k)];
  return { order, criteria: Object.fromEntries(order.map((key) => [key, criteria[key]])) };
}

export function wire(questions, shift = 0, rotate = []) {
  const orders = {};
  const out = {};
  for (const [id, q] of Object.entries(questions)) {
    let criteria = q.criteria;
    if (q.type === "choice" && criteria && !Array.isArray(criteria)) {
      if (rotate.includes(id)) ({ criteria } = rotateCriteria(criteria, shift));
      orders[id] = Object.keys(criteria);
    }
    out[id] = { type: q.type, instructions: q.instructions, criteria };
  }
  return { questions: out, orders };
}

export function topProbability(probabilities) {
  const values = Object.values(probabilities ?? {}).filter((v) => typeof v === "number");
  return values.length ? Math.max(...values) : null;
}

// The top probability a confidence bar requires on a choice of n options.
export function topProbabilityFor(confidence, n) {
  return Number((confidence * (1 - 1 / n) + 1 / n).toFixed(3));
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

// One card's readings into a band, in the order of S2.
export function bandOf(readings, policy, set) {
  const trigger = policy.classes?.trigger ?? {};
  const ownerAt = trigger.owner_at ?? 0.5;
  const [low, high] = trigger.uncertain_band ?? [0.4, 0.6];
  const ids = set.trigger_questions ?? [];
  const fmt = (id) => `${id} ${typeof readings[id]?.p === "number" ? readings[id].p.toFixed(2) : "unanswered"}`;
  const over = ids.filter((id) => typeof readings[id]?.p === "number" && readings[id].p >= ownerAt);
  if (over.length) return { band: "owner", why: `${over.map(fmt).join(", ")}: the Decision Gate's D1 rule, never settled by the number`, triggers: over };
  const unsure = ids.filter((id) => typeof readings[id]?.p !== "number" || (readings[id].p >= low && readings[id].p <= high));
  if (unsure.length) return { band: "owner", why: `${unsure.map(fmt).join(", ")}: uncertain, so it errs toward the person`, triggers: unsure };
  const actAt = policy.classes?.obvious_now?.act_at;
  const exit = set.exit_options?.obvious_now ?? "other";
  const o = readings.obvious_now;
  if (!o || o.value == null) return { band: "ask", why: "obvious_now unanswered", triggers: [] };
  if (o.value === "needs_decision") return { band: "owner", why: `obvious_now needs_decision ${o.p.toFixed(2)}`, triggers: [] };
  if (o.value === exit) return { band: "owner", why: `obvious_now ${exit} ${o.p.toFixed(2)}: none of the options fits, so he reads it whatever its confidence`, triggers: [] };
  if (o.value === "do_now" && typeof actAt === "number" && o.p >= actAt) return { band: "act", why: `obvious_now do_now ${o.p.toFixed(2)} at or above act_at ${actAt}`, triggers: [] };
  if (o.value === "do_now") return { band: "ask", why: `obvious_now do_now ${o.p.toFixed(2)} below act_at ${actAt ?? "unset"}`, triggers: [] };
  return { band: "ask", why: `obvious_now ${o.value} ${o.p.toFixed(2)}`, triggers: [] };
}

export function ledgerPath(env = process.env) {
  return env.PROPOSAL_SCORE_LEDGER || join(homedir(), ".miadi", "decisions", "proposal-score.jsonl");
}

async function scoreCard({ card, index, request, facts, set, policy, model, dry }) {
  const questions = questionsFor(set, set.kind_sets[card.kind]);
  if (!questions) return null;
  const state = { card: { code: card.code, kind: set.kind_names[card.kind] ?? card.kind, text: card.text }, request, facts };
  const { questions: wired, orders } = wire(questions, index, set.rotate ?? []);
  const req = buildRequest(state, wired, model);
  const result = dry ? await decideDry(req) : await decideJev(req);
  const readings = {};
  for (const [id, q] of Object.entries(questions)) {
    const r = readAnswer(result.answers?.[id]);
    readings[id] = { class: q.class, type: q.type, value: r.value, p: r.p, p_measures: r.p_measures, probabilities: r.probabilities ?? null, top_probability: q.type === "choice" ? topProbability(r.probabilities) : null, option_order: orders[id] ?? null, read_status: r.read_status ?? null, failures: r.failures ?? null };
  }
  const band = dry ? { band: null, why: "dry run: nothing sent", triggers: [] } : bandOf(readings, policy, set);
  const estimated = estimateTokens(req);
  const paid = Number(result.billing?.paid_input_tokens_used ?? NaN);
  return {
    code: card.code, kind: card.kind, requested_model: model, model: result.model, sent: result.sent,
    run_id: result.billing?.run_id ?? result.id ?? null, billing: result.billing ?? null, usage: result.usage ?? null,
    estimated_input_tokens: estimated, expected_paid_tokens: Math.round(estimated * PAID_RATIO),
    paid_input_tokens: Number.isFinite(paid) ? paid : (result.usage?.input_tokens ?? null),
    validation: result.validation ?? null, readings, ...band,
  };
}

export function ledgerRecords(scored, { page, policy, set, now, facts }) {
  const stamp = now.replace(/[-:.TZ]/g, "").slice(0, 14);
  const out = [];
  for (const s of scored) {
    const subject = `proposal:${page}#${s.code}`;
    // One record per call: what it cost, beside what the dry estimate said (R5).
    out.push({
      kind: "call", id: `call-${s.code}-${stamp}`, at: now, subject_ref: subject, questions_version: set.version,
      requested_model: s.requested_model, decider: s.model, run_id: s.run_id,
      facts_source: facts.source, facts_sha256: facts.sha256,
      option_orders: Object.fromEntries(Object.entries(s.readings).filter(([, r]) => r.option_order).map(([q, r]) => [q, r.option_order])),
      estimated_input_tokens: s.estimated_input_tokens, expected_paid_tokens: s.expected_paid_tokens, paid_input_tokens: s.paid_input_tokens,
      billing: s.billing, usage: s.usage, validation: s.validation,
    });
    for (const [qid, r] of Object.entries(s.readings)) {
      const cls = policy.classes?.[r.class];
      out.push({
        kind: "decision",
        id: `prop-${s.code}-${qid}-${stamp}`,
        at: now,
        question: { id: qid, class: r.class, kind: r.type, subject_ref: subject, criteria_ref: set.version },
        relation: cls ? { word_owner: cls.word_owner ?? "lane", reversible: cls.reversible ?? true, outward_facing: cls.outward_facing ?? false } : null,
        policy: { class: r.class, act_at: cls?.act_at ?? null, owner_at: cls?.owner_at ?? null, block_at: cls?.block_at ?? null, set_by: policy.set_by ?? null },
        value: r.value, p: r.p, p_measures: r.p_measures, probabilities: r.probabilities, top_probability: r.top_probability,
        option_order: r.option_order, read_status: r.read_status, failures: r.failures,
        band: s.band, band_why: s.why, requested_model: s.requested_model, decider: s.model, run_id: s.run_id,
        facts_sha256: facts.sha256, ruling_id: null,
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
    console.log("usage: score-proposal.mjs <page.html> --request <request.md> --facts <facts.md> [--questions q.json] [--policy p.json] [--model jev-1.14.0] [--only A,E,D,Q] [--dry] [--out scores.json] [--ledger file]");
    process.exit(2);
  }
  const html = readFileSync(page, "utf8");
  const set = loadJson(flags.questions || join(HERE, "questions.json"));
  const policy = loadJson(flags.policy || join(HERE, "policy.json"));
  const only = (flags.only || set.default_kinds || "A,E,D,Q").split(",").map((s) => s.trim());
  const request = readFileSync(flags.request, "utf8").trim();
  const factsText = flags.facts ? readFileSync(flags.facts, "utf8").trim() : extractFacts(html);
  const facts = { text: factsText, source: flags.facts ? `file:${resolve(flags.facts)}` : "page Today list", sha256: sha256(factsText) };
  if (!flags.facts) console.error("score-proposal: no --facts file; the page's Today list is sent, and evidence_sufficient reads thin on it (R4). Write the paths and numbers the cards rest on into a facts file.");
  const model = flags.model || set.model;
  if (!model) throw new Error(`${flags.questions || "questions.json"} pins no model; pin one version (R1)`);
  if (ALIASES.includes(model)) throw new Error(`${model} is an alias that resolves differently on jev-ai.pro and TypeSafe; pin a version such as ${set.model ?? "jev-1.14.0"} (R1)`);
  if (set.model && model !== set.model) console.error(`score-proposal: questions ${set.version} are pinned to ${set.model}; this run on ${model} is recorded as requested_model ${model} and is not the pinned series (R1).`);
  const dry = Boolean(flags.dry);
  const cards = extractCards(html, only);
  if (cards.length === 0) throw new Error("no coded cards found on the page");
  const scored = [];
  for (const [index, card] of cards.entries()) {
    const s = await scoreCard({ card, index, request, facts: facts.text, set, policy, model, dry });
    if (!s) continue;
    scored.push(s);
    const o = s.readings.obvious_now;
    const tokens = dry ? `~${s.estimated_input_tokens} tokens estimated, ~${s.expected_paid_tokens} paid expected at Episode 562's ratio ${PAID_RATIO} (not sent)` : `${s.paid_input_tokens ?? "?"} tokens paid (estimated ~${s.estimated_input_tokens})`;
    console.log(`${(s.band ? BANDS[s.band] : "dry").padEnd(13)} ${s.code.padEnd(4)} ${String(o?.value ?? "-").padEnd(15)} p=${typeof o?.p === "number" ? o.p.toFixed(2) : "  -  "} top=${typeof o?.top_probability === "number" ? o.top_probability.toFixed(2) : "  -  "} ${tokens}`);
  }
  const now = new Date().toISOString();
  const n = Object.keys(set.sets?.step?.obvious_now?.criteria ?? {}).length || 4;
  const actAt = policy.classes?.obvious_now?.act_at;
  if (typeof actAt === "number") console.log(`act_at ${actAt} on obvious_now's ${n} options is a top probability of ${topProbabilityFor(actAt, n)}`);
  if (dry) {
    const est = scored.reduce((a, s) => a + s.estimated_input_tokens, 0);
    console.log(`dry: ${scored.length} calls, ~${est} tokens estimated, ~${Math.round(est * PAID_RATIO)} paid expected at Episode 562's ratio ${PAID_RATIO}`);
  }
  const record = { at: now, page: resolve(page), requested_model: model, questions_version: set.version, policy_set_by: policy.set_by ?? null, facts_source: facts.source, facts_sha256: facts.sha256, dry, cards: scored };
  if (flags.out) writeFileSync(flags.out, JSON.stringify(record, null, 2) + "\n");
  if (!dry) {
    const ledger = flags.ledger || ledgerPath();
    mkdirSync(dirname(ledger), { recursive: true });
    const records = ledgerRecords(scored, { page: resolve(page), policy, set, now, facts });
    for (const r of records) appendFileSync(ledger, `${JSON.stringify(r)}\n`);
    console.log(`ledger ${ledger}`);
    const owner = new Set(scored.filter((s) => s.band === "owner").map((s) => s.code));
    const ids = records.filter((r) => r.kind === "decision" && r.question.id === "obvious_now" && owner.has(r.question.subject_ref.split("#").pop()));
    if (ids.length) {
      console.log("his answer on each 'needs you' card is a ruling on its obvious_now decision:");
      for (const r of ids) console.log(`  LANE_CHECK_LEDGER=${ledger} node ${join(LANE_CHECK, "lane-check.mjs")} rule ${r.id} --by Guillaume --verdict <act|hold|deepen|return|defer|no> --words "<his words>"`);
    }
  }
  console.log("");
  console.log(summary(scored));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`score-proposal: ${error.message}`); process.exit(1); });
}
