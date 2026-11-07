#!/usr/bin/env node
// screenwalk-name: print a screenwalk's safe title and check one, so a seat need not recall the form.
//
//   screenwalk-name.mjs [--tmux <session>] [--stamp yymmddHHMM] [--tail <words>] [--topic <words>] [--part N]
//   screenwalk-name.mjs --check "<safe title>" [--title "<title>"]
//
// A safe title is screenwalk-<stamp>-<relation>[-<topic>][-part-NNN]. The relation comes from the tmux session
// that was recorded, so a reader can find the session from the file. Without --tail it is that session's name
// with its time stamps removed. Pass --tail to keep a start the person gave or to shorten it. Without --tmux the
// current tmux session is read. Without --stamp the first stamp in the session's name is used, and the output
// says so, because the stamp is the minute the person named.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const SAFE_TITLE = /^screenwalk-\d{10}(-[A-Za-z0-9]+)+$/;
const STAMP = /^\d{8,12}$/;
export const TITLE_MAX = 100;

export function slug(words) {
  return String(words).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function relationFromTmux(name) {
  return slug(String(name).split("-").filter((t) => !STAMP.test(t)).join("-"));
}

export function stampFromTmux(name) {
  return String(name).split("-").find((t) => /^\d{10}$/.test(t)) ?? null;
}

export function safeTitle({ tmux, stamp, tail, topic, part }) {
  const use = stamp ?? stampFromTmux(tmux ?? "");
  if (!use) throw new Error("no stamp: pass --stamp yymmddHHMM, the minute the person named");
  const relation = tail ? slug(tail) : relationFromTmux(tmux ?? "");
  if (!relation) throw new Error("nothing to put after the stamp: pass --tmux or --tail");
  const parts = [`screenwalk-${use}`, relation];
  if (topic) parts.push(slug(topic));
  if (part) parts.push(`part-${String(part).padStart(3, "0")}`);
  return parts.join("-");
}

export function check(safe, title) {
  const problems = [];
  if (!SAFE_TITLE.test(safe)) {
    if (/^screenwalk-\d+$/.test(safe)) problems.push("nothing after the stamp: a bare screenwalk-<stamp> is the record's id, not a safe title");
    else problems.push("not screenwalk-<yymmddHHMM>-<relation to the tmux session>, in ASCII letters, digits and hyphens");
  }
  if (title !== undefined) {
    const stamp = (safe.match(/^screenwalk-(\d+)/) ?? [])[1];
    if (!title.startsWith(`screenwalk-${stamp} | `)) problems.push("the title does not start with `screenwalk-<stamp> | `");
    if (title.length > TITLE_MAX) problems.push(`the title has ${title.length} characters, and YouTube stops at ${TITLE_MAX}`);
  }
  return problems;
}

function arg(argv, name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const toCheck = arg(argv, "check");
  if (toCheck !== undefined) {
    const problems = check(toCheck, arg(argv, "title"));
    for (const p of problems) console.error(`screenwalk-name: ${p}`);
    if (problems.length) process.exit(1);
    console.log("ok");
    process.exit(0);
  }
  let tmux = arg(argv, "tmux");
  if (!tmux && !arg(argv, "tail")) tmux = execFileSync("tmux", ["display-message", "-p", "#S"], { encoding: "utf8" }).trim();
  const stamp = arg(argv, "stamp");
  try {
    console.log(safeTitle({ tmux, stamp, tail: arg(argv, "tail"), topic: arg(argv, "topic"), part: arg(argv, "part") }));
    if (!stamp) console.error("screenwalk-name: the stamp came from the session's name, so say so and let the person correct it");
  } catch (e) {
    console.error(`screenwalk-name: ${e.message}`);
    process.exit(2);
  }
}
