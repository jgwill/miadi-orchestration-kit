#!/usr/bin/env node
// asks — add or update an ask in a seat's ledger (~/workspace/.mino/asks/<seat>.json).
//
//   asks.mjs list   [--seat mino] [--status open]
//   asks.mjs show   <ask-id> [--seat mino]
//   asks.mjs add    --title <t> --words <verbatim> [--said-at <iso>] [--session <id>] [--where <w>]
//                   [--status open] [--evidence <e>]... [--seat mino] [--by <who>] [--note <n>]
//   asks.mjs update <ask-id> --expect <words of its title> [--status partial] [--evidence <e>]...
//                   [--words <verbatim> --said-at <iso>] [--reopen] [--seat mino] [--by <who>] [--note <n>]
//
// Ids move when a merge between seats renumbers the ledger: --expect refuses when the id now names another
// ask. A done ask keeps its status unless --reopen says otherwise.
//
// --words - reads the words from stdin, so a long message keeps its exact bytes.

import { STATUSES, addAsk, asksDir, ledgerPath, readLedger, updateAsk, writeLedger } from "./asks-lib.mjs";

function parse(argv) {
  const args = { _: [], evidence: [], seat: "mino" };
  const keys = { "--expect": "expect", "--seat": "seat", "--status": "status", "--title": "title", "--words": "words", "--said-at": "said_at", "--session": "session_id", "--where": "where", "--by": "by", "--note": "note" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--evidence") args.evidence.push(argv[++i]);
    else if (keys[arg]) args[keys[arg]] = argv[++i];
    else if (arg === "--reopen") args.reopen = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else args._.push(arg);
  }
  return args;
}

async function stdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text.replace(/\n$/, "");
}

function line(ask) {
  return `${ask.id}  ${ask.status.padEnd(7)}  ${ask.title}  (${ask.evidence.length} evidence)`;
}

const USAGE = `usage: asks.mjs list|show|add|update … (see the header of this file)
ledger dir: ${asksDir()} (WITNESS_ASKS_DIR overrides)
statuses: ${STATUSES.join(", ")}`;

async function main() {
  const args = parse(process.argv.slice(2));
  const command = args._[0];
  if (args.help || !["list", "show", "add", "update"].includes(command)) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  if (args.words === "-") args.words = await stdin();
  const ledger = readLedger(args.seat);

  if (command === "list") {
    const asks = ledger.asks.filter((ask) => !args.status || ask.status === args.status);
    console.log(`${ledgerPath(args.seat)} · ${asks.length} of ${ledger.asks.length} asks`);
    for (const ask of asks) console.log(line(ask));
    return 0;
  }
  if (command === "show") {
    const ask = ledger.asks.find((candidate) => candidate.id === args._[1]);
    if (!ask) {
      console.error(`asks: no ${args._[1] ?? "(missing id)"} in ${args.seat}`);
      return 2;
    }
    console.log(JSON.stringify(ask, null, 2));
    return 0;
  }
  const ask = command === "add"
    ? addAsk(ledger, { ...args, evidence: args.evidence, status: args.status || "open" })
    : updateAsk(ledger, args._[1], { ...args, evidence: args.evidence });
  const path = writeLedger(ledger);
  console.log(`asks: ${command === "add" ? "added" : "updated"} ${line(ask)} → ${path}`);
  return 0;
}

main().then((code) => { process.exitCode = code; }, (error) => {
  console.error(`asks: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
