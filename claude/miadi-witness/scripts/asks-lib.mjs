// asks-lib — the asks ledger: one JSON file per seat, each ask holding William's words
// verbatim, when he said them, a status and its evidence. Shared by asks.mjs (the script
// that adds and updates) and the witness service (which shows it).

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const STATUSES = ["open", "partial", "done", "dropped"];
export const LEDGER_VERSION = 1;

export function asksDir(env = process.env) {
  return env.WITNESS_ASKS_DIR || join(homedir(), "workspace", ".mino", "asks");
}

export function ledgerPath(seat, dir = asksDir()) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(seat)) throw new Error(`seat id "${seat}" must be lowercase letters, digits and dashes`);
  return join(dir, `${seat}.json`);
}

export function emptyLedger(seat) {
  return { version: LEDGER_VERSION, seat, updated_at: null, asks: [] };
}

export function readLedger(seat, dir = asksDir()) {
  const path = ledgerPath(seat, dir);
  if (!existsSync(path)) return emptyLedger(seat);
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeLedger(ledger, dir = asksDir()) {
  const path = ledgerPath(ledger.seat, dir);
  mkdirSync(dir, { recursive: true });
  ledger.updated_at = new Date().toISOString();
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
  renameSync(tmp, path);
  return path;
}

export function readAllLedgers(dir = asksDir()) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^[a-z0-9][a-z0-9-]*\.json$/.test(name))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(dir, name), "utf8"));
      } catch (error) {
        return { seat: name.replace(/\.json$/, ""), error: String(error.message ?? error), asks: [] };
      }
    });
}

function nextId(ledger) {
  const numbers = ledger.asks.map((ask) => Number(String(ask.id).replace(/^ask-/, ""))).filter(Number.isInteger);
  return `ask-${(numbers.length ? Math.max(...numbers) : 0) + 1}`;
}

export function addAsk(ledger, { title, words, said_at = null, session_id = null, where = null, status = "open", evidence = [], by = null, note = "" }) {
  if (!title) throw new Error("an ask needs a title");
  if (!words) throw new Error("an ask needs William's words, verbatim");
  if (!STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(", ")}`);
  const at = new Date().toISOString();
  const ask = {
    id: nextId(ledger),
    title,
    words: [{ text: words, said_at, session_id, where }],
    status,
    evidence: [...evidence],
    history: [{ at, status, by, note: note || "added" }],
  };
  ledger.asks.push(ask);
  return ask;
}

export function updateAsk(ledger, id, { status, expect = null, reopen = false, evidence = [], words = null, said_at = null, session_id = null, where = null, by = null, note = "" }) {
  const ask = ledger.asks.find((candidate) => candidate.id === id);
  if (!ask) throw new Error(`no ask ${id} in seat ${ledger.seat}`);
  if (status && !STATUSES.includes(status)) throw new Error(`status must be one of ${STATUSES.join(", ")}`);
  // A merge between seats can renumber asks, so an id read earlier may now name another ask (2026-11-07).
  if (expect && !ask.title.toLowerCase().includes(String(expect).toLowerCase())) {
    throw new Error(`${id} is now "${ask.title}", which does not contain "${expect}". Read the id again with list.`);
  }
  if (status && status !== "done" && ask.status === "done" && !reopen) {
    throw new Error(`${id} is done ("${ask.title}"). Pass --reopen to change that.`);
  }
  if (words) ask.words.push({ text: words, said_at, session_id, where });
  for (const item of evidence) if (!ask.evidence.includes(item)) ask.evidence.push(item);
  if (status) ask.status = status;
  ask.history.push({ at: new Date().toISOString(), status: ask.status, by, note: note || "updated" });
  return ask;
}
