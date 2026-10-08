#!/usr/bin/env node
// team-fit — the measured half of a session's team-fit report (skill team-fit,
// jgwill/miadi-orchestration-kit#76). It evaluates every rule of teams/teams.json on its
// own, so the report can cite each rule that placed the session, and takes the decision in
// the order teams.json documents: declared, sessions, folders (longest prefix), name_patterns.
// The declared team is kept beside the decision, because a seat's declared team and the team
// its work fits can differ. The skill adds the meaning: responsibility, actions, proposal.
//
//   team-fit.mjs --session <id> [--json]       facts from the session's latest binding line
//   team-fit.mjs --tmux <name> [--json]        the latest non-headless binding line for that tmux session
//   team-fit.mjs --cwd <path> [--name <n>] [--tmux <name>] [--json]
//                                               no binding line: the rules on what you give
//
// Glyphs come from teams.json when a team carries one. Otherwise from DRAFT_GLYPHS below,
// marked "draft": the table is held until William confirms it (jgwill/Miadi#746 H2).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defaultPaths, readBindings } from "../service/threads.mjs";

export const DRAFT_GLYPHS = {
  T1: "🔁",
  T2: "📡",
  T3: "👁️",
  T4: "📈",
  T5: "🌱",
  T6: "🎬",
  T7: "🛎️",
  unassigned: "❔",
  proposed: "🆕",
};

const ORDER = ["declared", "sessions", "folders", "name_patterns"];

function isHeadless(argv) {
  return Array.isArray(argv) && argv.some((arg) => arg === "-p" || arg === "--print");
}

export function latestBinding(lines, { sessionId, tmux }) {
  let found = null;
  for (const line of lines) {
    if (isHeadless(line.argv)) continue;
    if (sessionId && line.session_id !== sessionId) continue;
    if (tmux && line.tmux?.session !== tmux) continue;
    found = line;
  }
  return found;
}

function tmuxDeclared(tmux) {
  if (!tmux) return null;
  try {
    const value = execFileSync("tmux", ["show-options", "-t", tmux, "-qv", "@miadi-team"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return value || null;
  } catch {
    return null;
  }
}

// Every rule, on its own. Returns the matches in teams.json order, one per team and rule.
export function evaluateRules({ tmux, name, cwd, declared }, teams) {
  const list = teams?.teams ?? [];
  const names = [tmux, name].filter(Boolean);
  const matches = [];
  if (declared?.team) matches.push({ rule: "declared", team: declared.team, evidence: declared.source });
  for (const team of list) {
    const hit = (team.sessions ?? []).find((session) => names.includes(session));
    if (hit) matches.push({ rule: "sessions", team: team.id, evidence: hit });
  }
  for (const team of list) {
    for (const folder of team.folders ?? []) {
      if (cwd && (cwd === folder || cwd.startsWith(`${folder}/`))) {
        matches.push({ rule: "folders", team: team.id, evidence: folder, length: folder.length });
      }
    }
  }
  for (const team of list) {
    const hit = (team.name_patterns ?? []).find((pattern) => names.some((value) => new RegExp(pattern).test(value)));
    if (hit) matches.push({ rule: "name_patterns", team: team.id, evidence: hit });
  }
  return matches;
}

// The decision, in the documented order. Folders take the longest prefix.
export function decide(matches) {
  for (const rule of ORDER) {
    const hits = matches.filter((match) => match.rule === rule);
    if (!hits.length) continue;
    const winner = rule === "folders" ? hits.reduce((a, b) => (b.length > a.length ? b : a)) : hits[0];
    return { team: winner.team, decided_by: rule };
  }
  return { team: "unassigned", decided_by: null };
}

export function teamFit(inputs, teams) {
  const matches = evaluateRules(inputs, teams);
  const { team, decided_by } = decide(matches);
  const record = (teams?.teams ?? []).find((entry) => entry.id === team);
  const glyph = record?.glyph ?? DRAFT_GLYPHS[team] ?? DRAFT_GLYPHS.unassigned;
  const others = [...new Set(matches.map((match) => match.team))].filter((id) => id !== team);
  return {
    team: {
      id: team,
      name: record?.name ?? null,
      level: record?.level ?? null,
      human_lead: record?.human_lead ?? null,
      agent_lead: record?.agent_lead ?? null,
      glyph,
      glyph_source: record?.glyph ? "teams.json" : "draft",
    },
    decided_by,
    matches: matches.map(({ length, ...rest }) => rest),
    declared: inputs.declared ?? null,
    also_matched: others,
    inputs: {
      session_id: inputs.sessionId ?? null,
      tmux: inputs.tmux ?? null,
      name: inputs.name ?? null,
      cwd: inputs.cwd ?? null,
      binding_at: inputs.bindingAt ?? null,
    },
  };
}

function parseArgs(argv) {
  const args = { json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--json") args.json = true;
    else if (["--session", "--tmux", "--cwd", "--name"].includes(flag)) args[flag.slice(2)] = argv[++i];
    else throw new Error(`unknown flag ${flag}`);
  }
  return args;
}

function render(fit) {
  const t = fit.team;
  const out = [];
  out.push(t.id === "unassigned" ? `${t.glyph} unassigned: no rule of teams.json placed this session` : `${t.glyph} ${t.id} · ${t.name} (${t.level}), decided by ${fit.decided_by}`);
  for (const match of fit.matches) out.push(`  ${match.rule}: ${match.team} by ${match.evidence}`);
  if (fit.declared) out.push(`  declared: ${fit.declared.team} (${fit.declared.source})`);
  if (fit.also_matched.length) out.push(`  also matched: ${fit.also_matched.join(", ")}`);
  if (t.glyph_source === "draft") out.push("  glyph: draft table, held until William confirms it");
  out.push(`  inputs: tmux ${fit.inputs.tmux ?? "-"} · name ${fit.inputs.name ?? "-"} · cwd ${fit.inputs.cwd ?? "-"}${fit.inputs.binding_at ? ` · binding ${fit.inputs.binding_at}` : ""}`);
  return out.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = defaultPaths();
  if (!existsSync(paths.teams)) throw new Error(`teams.json not found at ${paths.teams}`);
  const teams = JSON.parse(readFileSync(paths.teams, "utf8"));
  let inputs = { sessionId: args.session, tmux: args.tmux, name: args.name, cwd: args.cwd };
  if (args.session || (args.tmux && !args.cwd)) {
    const { lines } = readBindings(paths.bindings);
    const line = latestBinding(lines, { sessionId: args.session, tmux: args.session ? null : args.tmux });
    if (!line) throw new Error(`no binding line for ${args.session ?? args.tmux}; pass --cwd and --name`);
    inputs = {
      sessionId: line.session_id,
      tmux: args.tmux ?? line.tmux?.session ?? null,
      name: args.name ?? line.name?.name ?? null,
      cwd: args.cwd ?? line.cwd ?? null,
      bindingAt: line.at ?? null,
      declared: line.team?.source === "declared" ? { team: line.team.id, source: "binding line (declared)" } : null,
    };
  }
  if (!inputs.declared) {
    const tmuxTeam = tmuxDeclared(inputs.tmux);
    if (tmuxTeam) inputs.declared = { team: tmuxTeam, source: "tmux @miadi-team" };
  }
  if (!inputs.cwd && !inputs.tmux && !inputs.name) throw new Error("give --session, --tmux, or --cwd");
  const fit = teamFit(inputs, teams);
  process.stdout.write(args.json ? `${JSON.stringify(fit, null, 2)}\n` : `${render(fit)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`team-fit: ${error.message}\n`);
    process.exit(2);
  }
}
