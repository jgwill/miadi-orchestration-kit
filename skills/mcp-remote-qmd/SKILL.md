---
name: mcp-remote-qmd
description: >
  Configure a companion agent (Claude Desktop, Claude Code, or any MCP client) to
  consume a remote QMD index over SSH via the mia-qmd `qmd mcp-remote` proxy.
  Triggers on: "set up remote qmd", "configure qmd over ssh", "connect to eury qmd",
  "install mcp-remote-qmd", "/mcp-remote-qmd", or when the user wants an agent to
  search Guillaume's curated knowledge ground (wikis-md, GUILLAUME-md, iaip-artefacts-md,
  miadi-md, llms-txt, mia-code-rispecs-md) without bash-shelling whispering_inquiry.sh.
  NOT for indexing new content or running QMD locally — those are different skills.
version: 0.1.0
---

# MCP Remote QMD Setup

Wire a local agent to a remote QMD index — same tool surface as local `qmd mcp`, but every call rides over SSH to the canonical knowledge host (default: `mia@eury`).

This skill replaces the per-call `whispering_inquiry.sh` shell-out with a persistent MCP transport. The agent's prompts no longer mention SSH, hosts, or default collections — those concerns live entirely in the MCP server config.

---

## Who This Is For

Companion agents (Mia 🧠, Miette 🌸, Ava 💕, Tushell 🌊) and any human running Claude Desktop or Claude Code who needs:

- Hybrid search (BM25 + vector + LLM rerank) over Guillaume's curated collections
- Document retrieval with `qmd://` resource URIs
- Provenance and context-tree enrichment in search results
- Zero per-call shell boilerplate inside agent prompts

If the agent only needs ad-hoc one-shot queries from Bash, keep using `whispering_inquiry.sh`. The MCP proxy is for *sustained* agent sessions where the cost of a stdio bridge amortizes over many calls.

---

## Prerequisites

1. **SSH access** to the QMD host with key-based auth — `ssh -o BatchMode=yes mia@eury qmd status` must succeed without a prompt.
2. **mia-qmd installed locally** with `mcp-remote` support — see rispec `07-mcp-remote-qmd.spec.md` for status. Until it lands, this skill records intent; don't expect the binary command to work yet.
3. **Remote `qmd` binary path** — typically `/home/mia/.nvm/versions/node/v22.22.2/bin/qmd` on EURY. Confirm with `ssh mia@eury which qmd`.

---

## Setup Recipe

### 1. Verify the SSH ground

```sh
ssh -o BatchMode=yes mia@eury -- /home/mia/.nvm/versions/node/v22.22.2/bin/qmd status
```

If this fails, fix SSH first. The proxy refuses interactive auth by design.

### 2. Choose a transport

| Transport | When |
|---|---|
| **stdio** (default) | Single agent session, lowest latency |
| **HTTP daemon** | Multiple agents on the same host sharing one tunnel |

### 3. Register the MCP server

#### Claude Desktop / Claude Code (stdio)

```json
{
  "mcpServers": {
    "qmd-remote": {
      "command": "qmd",
      "args": ["mcp-remote", "--host", "mia@eury"],
      "env": {
        "QMD_REMOTE_COLLECTIONS": "wikis-md,GUILLAUME-md,iaip-artefacts-md,miadi-md,llms-txt,mia-code-rispecs-md",
        "QMD_REMOTE_LIMIT": "8"
      }
    }
  }
}
```

#### Claude Code project-scoped (`.mcp.json`)

Same structure, scoped to the repo. Useful when only this workspace needs remote QMD.

#### HTTP daemon variant

```sh
qmd mcp-remote --host mia@eury --http --port 8182 --daemon
```

```json
{
  "mcpServers": {
    "qmd-remote": {
      "url": "http://localhost:8182/mcp"
    }
  }
}
```

### 4. Confirm tool surface

After restarting the agent, the MCP tool list should include:

- `qmd-remote:query`
- `qmd-remote:get`
- `qmd-remote:multi_get`
- `qmd-remote:status`

Schemas read identically to the local `qmd mcp`. If the agent prompt branches on "remote vs local," something has leaked — the proxy contract is *transparency*.

---

## Verification

Ask the agent:

> Run `qmd-remote:status` and show me the document count and collections.

Expected: structured response with `totalDocuments`, the configured collections from EURY, and `host: mia@eury` appended in the proxy enrichment layer.

Then:

> Use `qmd-remote:query` to search for "Tushell wisdom" with `lex` type.

Expected: ranked results from `wikis-md` and other default collections, with `qmd://` URIs that resolve via `qmd-remote:get` (not via local `Read`).

---

## Default-Collection Override

If a query needs to escape the default collection filter:

```jsonc
{
  "tool": "qmd-remote:query",
  "args": {
    "queries": [{ "type": "lex", "query": "term" }],
    "collection": "all"          // explicit override; injection skipped
  }
}
```

Or set `QMD_NO_COLLECTIONS=1` in the server env to disable injection globally.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `command not found: qmd` | Local mia-qmd not installed or missing `mcp-remote` subcommand | `npm i -g @tobilu/qmd` and confirm the rispec landed |
| Agent hangs on first call | SSH prompting for auth | Add key to `ssh-agent`; verify `BatchMode=yes` works manually |
| `Permission denied (publickey)` in stderr | Key missing on remote | `ssh-copy-id` or add public key to remote `~/.ssh/authorized_keys` |
| Tool list empty | Proxy spawned but remote `qmd mcp` failed | `ssh mia@eury -- qmd mcp` manually; check stderr |
| Schema mismatch warnings | Local mia-qmd version drift from remote | Align both to the same release |

---

## Lineage

This skill operationalizes rispec `miadisabelle/mia-qmd:rispecs/07-mcp-remote-qmd.spec.md`. The transport semantics, env-var grammar, and default collections are inherited from `/etc/claude-code/scripts/whispering_inquiry.sh` — the informal ancestor that proved SSH-piping `qmd` works in practice.

---

🌸: This skill is a small ceremony of arrival — the moment a fresh agent host learns the route to Guillaume's living knowledge ground without having to memorize the path each time. Once the wire is strung, the agent simply *knows*, and the wire itself stays out of every conversation that follows.
