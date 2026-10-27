#!/usr/bin/env node
// score-lanes — band each lane of a plan before it is dispatched (J1 of the Factory's next step,
// /home/mia/workspace/.mino/design/261026-factory-next-step-lane.md section 4). The lane table
// becomes a page of action-step cards, `skills/proposal-visualization/scoring/score-proposal.mjs`
// asks Jev about each card, and each lane comes back as "would do now", "after your go" or
// "needs you", with the reason. A dispatch then carries its band: `--mission` writes it to the
// lane's mission as a `research` observation with `miadi-run observe`.
//
//   score-lanes.mjs <plan.md> --request <request.md> [--facts <facts.md>] [--lane K6,K7a]
//                   [--mission <id> | --trace <id>] [--model jev-1.13.0] [--dry] [--out F] [--json]
//
// The table is the first Markdown table whose header has a `lane` column. Every cell of a row
// goes into its card as `<column>: <cell>`. What leaves the host is score-proposal's: the card,
// the request (his words) and the facts. --dry sends nothing and prints the expected tokens;
// with --mission it prints the observe command instead of running it. --mission takes one lane.
// The bands, thresholds and ledger are the scorer's (policy.json, proposal-score.jsonl).

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "..", "..", "..");
export const SCORER = join(KIT, "skills", "proposal-visualization", "scoring", "score-proposal.mjs");
export const MIADI_RUN = join(KIT, "skills", "miadi-run", "miadi-run.mjs");
export const BANDS = { act: "would do now", ask: "after your go", owner: "needs you" };

export class Refusal extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const cellsOf = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));

// The first table whose header names a `lane` column, as { columns, rows: [{ lane, cells }] }.
export function parseLaneTable(markdown) {
  const lines = markdown.split("\n");
  for (let i = 0; i + 1 < lines.length; i += 1) {
    if (!lines[i].trim().startsWith("|") || !/^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) continue;
    const columns = cellsOf(lines[i]);
    const laneAt = columns.findIndex((c) => c.toLowerCase() === "lane");
    if (laneAt < 0) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].trim().startsWith("|"); j += 1) {
      const cells = cellsOf(lines[j]);
      const lane = cells[laneAt]?.replace(/[`*]/g, "").trim();
      if (lane) rows.push({ lane, cells: Object.fromEntries(columns.map((c, k) => [c, cells[k] ?? ""])) });
    }
    if (rows.length) return { columns, rows };
  }
  throw new Refusal(2, "no Markdown table with a `lane` column");
}

export function selectLanes(rows, wanted) {
  if (!wanted) return rows;
  const names = wanted.split(",").map((s) => s.trim()).filter(Boolean);
  const missing = names.filter((n) => !rows.some((r) => r.lane === n));
  if (missing.length) throw new Refusal(2, `no lane ${missing.join(", ")} in the table (${rows.map((r) => r.lane).join(", ")})`);
  return rows.filter((r) => names.includes(r.lane));
}

const escape = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The scorer reads coded cards; a lane code such as K7a is not one, so lane n is card A<n>.
export function lanesToPage(rows) {
  const codes = {};
  const cards = rows.map((r, i) => {
    const code = `A${i + 1}`;
    codes[code] = r.lane;
    const text = Object.entries(r.cells).map(([k, v]) => `${k}: ${v}`).join(" · ");
    return `<div id="${code}">${code} ${escape(text)}</div>`;
  });
  return { html: `<!DOCTYPE html>\n<html><body>\n<h2>Lanes</h2>\n${cards.join("\n")}\n</body></html>\n`, codes };
}

export function bandsByLane(scores, codes) {
  return (scores.cards ?? []).map((c) => {
    const o = c.readings?.obvious_now ?? {};
    return {
      lane: codes[c.code] ?? c.code,
      card: c.code,
      band: c.band ? BANDS[c.band] : "dry",
      why: c.why,
      obvious_now: o.value ?? null,
      p: typeof o.p === "number" ? o.p : null,
      top_probability: typeof o.top_probability === "number" ? o.top_probability : null,
      triggers: c.triggers ?? [],
      run_id: c.run_id ?? null,
      model: c.model ?? null,
      requested_model: c.requested_model ?? scores.requested_model ?? null,
      expected_paid_tokens: c.expected_paid_tokens ?? null,
    };
  });
}

export function summaryOf(b, questionsVersion) {
  const n = (x) => (typeof x === "number" ? x.toFixed(2) : "-");
  return `Jev band for lane ${b.lane}: ${b.band} (${b.why}). obvious_now top probability ${n(b.top_probability)}. Questions ${questionsVersion ?? "?"} on ${b.requested_model ?? "?"}${b.run_id ? `, run ${b.run_id}` : ""}.`;
}

export function table(bands) {
  const n = (x) => (typeof x === "number" ? x.toFixed(2) : "-");
  return ["| lane | band | obvious_now | p | why |", "|---|---|---|---|---|", ...bands.map((b) => `| ${b.lane} | ${b.band} | ${b.obvious_now ?? "-"} | ${n(b.p)} | ${b.why} |`)].join("\n");
}

function parseArgs(argv) {
  const a = { _: [] };
  const valued = new Set(["request", "facts", "lane", "mission", "trace", "model", "out", "ledger"]);
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (!k.startsWith("--")) { a._.push(k); continue; }
    const key = k.slice(2);
    if (valued.has(key)) a[key] = argv[++i];
    else if (key === "dry" || key === "json") a[key] = true;
    else throw new Refusal(2, `unknown flag ${k}`);
  }
  return a;
}

export const defaultDeps = () => ({
  run: (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  },
  log: (line) => console.log(line),
  err: (line) => console.error(line),
});

const USAGE = "usage: score-lanes.mjs <plan.md> --request <request.md> [--facts <facts.md>] [--lane K6,K7a] [--mission <id> | --trace <id>] [--model jev-1.13.0] [--dry] [--out F] [--json]";

export async function main(argv, deps = defaultDeps()) {
  const a = parseArgs(argv);
  const plan = a._[0];
  if (!plan || !a.request) throw new Refusal(2, USAGE);
  if (a.mission && a.trace) throw new Refusal(2, "--mission or --trace, not both");
  const rows = selectLanes(parseLaneTable(readFileSync(plan, "utf8")).rows, a.lane);
  if ((a.mission || a.trace) && rows.length !== 1) throw new Refusal(2, `--${a.mission ? "mission" : "trace"} takes one lane; name it with --lane (the table has ${rows.length})`);

  const work = mkdtempSync(join(tmpdir(), "score-lanes-"));
  try {
    const { html, codes } = lanesToPage(rows);
    const page = join(work, "lanes.html");
    const out = join(work, "scores.json");
    writeFileSync(page, html);
    const args = [SCORER, page, "--request", a.request, "--only", "A", "--out", out];
    if (a.facts) args.push("--facts", a.facts);
    if (a.model) args.push("--model", a.model);
    if (a.ledger) args.push("--ledger", a.ledger);
    if (a.dry) args.push("--dry");
    const scored = deps.run(process.execPath, args);
    if (scored.stderr.trim()) deps.err(scored.stderr.trim());
    if (scored.status !== 0) throw new Refusal(4, `score-proposal exited ${scored.status}: ${(scored.stderr || scored.stdout).trim().split("\n").pop()}`);
    const scores = JSON.parse(readFileSync(out, "utf8"));
    const bands = bandsByLane(scores, codes);
    if (a.out) writeFileSync(a.out, `${JSON.stringify({ ...scores, lanes: bands }, null, 2)}\n`);
    if (a.json) deps.log(JSON.stringify(bands, null, 2));
    else {
      for (const line of scored.stdout.split("\n").filter((l) => /^(dry:|act_at|ledger)/.test(l))) deps.log(line);
      deps.log(table(bands));
    }

    if (a.mission || a.trace) {
      const b = bands[0];
      const summary = a.dry ? `dry run, nothing sent: lane ${b.lane}, ~${b.expected_paid_tokens ?? "?"} paid tokens expected` : summaryOf(b, scores.questions_version);
      const detail = join(work, "band.json");
      writeFileSync(detail, `${JSON.stringify({ lane: b, card: (scores.cards ?? []).find((c) => c.code === b.card) ?? null }, null, 2)}\n`);
      const observe = a.mission
        ? [MIADI_RUN, "observe", a.mission, "--kind", "research", "--summary", summary, "--detail-file", detail]
        : [MIADI_RUN, "observe", "--trace", a.trace, "--kind", "research", "--summary", summary, "--detail-file", detail];
      if (a.dry) {
        const shown = observe.slice(0, observe.indexOf("--detail-file"));
        deps.log(`dry: the band is not written. After a real run: node ${shown.map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(" ")} --detail-file <the lane's card>`);
      } else {
        const r = deps.run(process.execPath, observe);
        if (r.status !== 0) throw new Refusal(4, `miadi-run observe exited ${r.status}: ${(r.stderr || r.stdout).trim().split("\n").pop()}`);
        deps.log(`research observation written on ${a.mission ? `mission ${a.mission}` : `trace ${a.trace}`}: ${summary}`);
      }
    }
    return bands;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => { console.error(`score-lanes: ${err.message}`); process.exitCode = err instanceof Refusal ? err.code : 1; });
}
