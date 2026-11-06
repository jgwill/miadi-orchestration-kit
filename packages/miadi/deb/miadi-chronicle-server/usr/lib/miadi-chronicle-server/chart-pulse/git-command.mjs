// Read a Bash command the way the shell would run it, far enough to answer:
// which git subcommands does it run, and in which directory. Shared by the
// chart-pulse hook.

import { resolve } from "node:path"
import { homedir } from "node:os"

// Heredoc bodies are commit messages, not commands. Keep the line that opens one.
function stripHeredocs(s) {
  return s.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, (_m, _q, _tag, rest) => `<<HEREDOC${rest}`)
}

// Split a shell command into simple commands of words. Quotes may span lines.
function segments(s) {
  const segs = [[]]
  let cur = null
  const push = () => {
    if (cur !== null) segs[segs.length - 1].push(cur)
    cur = null
  }
  for (let i = 0; i < s.length; ) {
    const c = s[i]
    if (c === "'") {
      const j = s.indexOf("'", i + 1)
      cur = (cur ?? "") + s.slice(i + 1, j < 0 ? s.length : j)
      i = j < 0 ? s.length : j + 1
    } else if (c === '"') {
      let j = i + 1
      let buf = ""
      while (j < s.length && s[j] !== '"') {
        if (s[j] === "\\" && j + 1 < s.length) {
          buf += s[j + 1]
          j += 2
        } else buf += s[j++]
      }
      cur = (cur ?? "") + buf
      i = j + 1
    } else if (c === "\\" && i + 1 < s.length) {
      if (s[i + 1] !== "\n") cur = (cur ?? "") + s[i + 1]
      i += 2
    } else if ("\n;&|()".includes(c)) {
      push()
      if (segs[segs.length - 1].length) segs.push([])
      i++
    } else if (/\s/.test(c)) {
      push()
      i++
    } else {
      cur = (cur ?? "") + c
      i++
    }
  }
  push()
  return segs.filter((x) => x.length)
}

export const plain = (t) => !t.includes("$") && !t.includes("`")
export const pathOf = (base, p) => (p.startsWith("~/") ? resolve(homedir(), p.slice(2)) : resolve(base, p))

/** Every git invocation in the command: { dir, sub, args }. Tracks cd and -C. */
export function gitInvocations(command, cwd) {
  let dir = cwd
  const out = []
  for (const seg of segments(stripHeredocs(command))) {
    if (seg[0] === "cd" && seg[1] && plain(seg[1])) {
      dir = pathOf(dir, seg[1])
      continue
    }
    const g = seg.indexOf("git")
    if (g < 0 || !seg.slice(0, g).every((t) => /^\w+=/.test(t))) continue
    let gitDir = dir
    let k = g + 1
    while (k < seg.length && seg[k].startsWith("-")) {
      if (seg[k] === "-C" && seg[k + 1]) {
        if (plain(seg[k + 1])) gitDir = pathOf(gitDir, seg[k + 1])
        k += 2
      } else if (seg[k] === "-c") k += 2
      else k++
    }
    if (seg[k]) out.push({ dir: gitDir, sub: seg[k], args: seg.slice(k + 1) })
  }
  return out
}
