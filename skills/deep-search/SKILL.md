---
name: deep-research
description: >
  This skill should be used when the user asks for "deep research", "thorough research",
  "research everything about", "cover every angle", "comprehensive research on",
  "spawn research agents", "/deep-research", or wants multi-agent parallel research
  on any topic. Also triggers when user says "research this for me", "find everything
  about", "I need a research doc on", or describes needing exhaustive coverage of a
  subject. NOT for quick lookups or single questions — this is for producing
  comprehensive research documents saved to the vault.
version: 0.2.0
---

# Deep Research

Multi-agent parallel research orchestrator. Decomposes any research topic into 3-6 specialized angles using MECE principles, spawns Opus sub-agents to cover each angle simultaneously, runs gap analysis, then synthesizes findings into one comprehensive vault document.

Anthropic's own multi-agent research system outperforms single-agent by **90.2%**. This skill applies those same proven patterns.

For detailed sub-agent prompt templates by research type: read `references/agent-templates.md`.
For the full research on multi-agent orchestration patterns: read `references/orchestration-patterns.md`.

## Who This Is For

Olle Dyberg — AI content creator and consultant (@olleai on TikTok, ~9K followers, 1.1M+ views) building around Claude Code, AI agents, and context engineering. Research serves: content creation, meta-prompts, consulting prep, and product development.

## The Research Diamond

Every research session follows this shape:

```
         [Broad: Decompose question]
              /        \
    [Narrow: 3-5 parallel agents]     ← Wave 1
              \        /
         [Evaluate: Gap analysis]
              /        \
    [Deep: 1-2 targeted agents]       ← Wave 2 (if needed)
              \        /
         [Synthesize: Final report]
```

Start wide, go narrow in parallel, identify gaps, go deep on gaps, synthesize.

## Research Orchestration Process

### Phase 0: Establish Date Context

Before anything else, note today's date. You can get it from the system prompt or by running `date`. Inject this date into every sub-agent prompt so they search for current information and properly date the final document. This is critical — sub-agents without date context will search for and cite outdated information.

### Phase 1: Gather Context

Before spawning any agents:

1. **Read `05 - Resources/People/Olle.md`** — understand who the research is for
2. **Read `_Index.md`** — scan for existing vault content on the topic
3. **Read any relevant vault files** — build on existing knowledge, never start from scratch
4. **Clarify purpose** if unclear — ask "Is this for a meta-prompt, content, consulting, or personal learning?"
5. **Ask about sources** — Use the `AskUserQuestion` tool to ask:
   - "Are there specific sources you want me to prioritize?" with options like:
     - "No, use defaults" — proceed with standard source strategy
     - "Specific people/accounts" — X accounts, bloggers, researchers to focus on
     - "Specific sites/communities" — subreddits, forums, documentation sites, YouTube channels
     - "I'll paste links" — user provides specific URLs to anchor the research around
   - This is what separates surface-level research from alpha insights. Default web search scrapes the obvious — user-directed sources find the unusual.
   - If the user provides specific sources, inject them into the relevant sub-agent prompts in Phase 3 (add to SEARCH STRATEGY and SOURCE QUALITY sections).

### Phase 2: MECE Decomposition

Break the topic into **Mutually Exclusive, Collectively Exhaustive** angles. Each angle:
- Does NOT overlap with any other (prevents duplicate work)
- Together they cover everything relevant (no gaps)
- Is specific enough for one agent to investigate thoroughly

**Common decomposition patterns:**

| Research Type | Typical Angles |
|--------------|----------------|
| Content/Platform | General best practices, Niche-specific (AI/tech), Real examples with metrics, Psychology/copywriting, Vault knowledge, X discourse |
| Technology | Current state/ecosystem, Real shipped code (grep MCP), Community sentiment (X), Comparisons/alternatives, Vault knowledge, Implementation patterns |
| Business | Market data/benchmarks, Niche-specific practices, Strategy frameworks, Vault knowledge, X practitioner discourse |

**Scale effort to complexity:**
- Simple factual topic: 3 agents
- Multi-faceted topic: 4-5 agents
- Complex strategic topic: 5-6 agents

### Phase 3: Spawn Parallel Sub-Agents

Spawn **minimum 3, ideally 4-5** sub-agents in parallel using the Task tool. **Always use `model: "opus"`** for all research sub-agents. Research quality depends on reasoning depth — sonnet is not sufficient.

Every sub-agent prompt MUST include these 6 elements:

1. **WHO** — "This research is for Olle Dyberg, a 25-year-old Swedish AI content creator and consultant (@olleai, ~5.5K TikTok followers, 1.1M+ views). His niche is AI tools — Claude Code, agents, context engineering."

2. **WHY** — The specific purpose. "...because Olle will feed this into a meta-prompt" or "...because this becomes a vault reference document." Agents that know WHY produce dramatically better results.

3. **WHAT ANGLE** — Specific scope AND explicit boundaries: "Cover X. Do NOT cover Y — another agent handles that."

4. **HOW** — Which tools to use (see Tools Reference below)

5. **SEARCH STRATEGY** — "Start with SHORT, BROAD queries (2-4 words). Evaluate results. Then progressively narrow focus. Do NOT start with long, specific queries — they return poor results."

6. **SOURCE QUALITY** — "Prefer: practitioner blogs, official docs, academic papers, primary sources. Avoid: SEO content farms, listicles, aggregator sites."

#### Sub-Agent Prompt Template

```
You are researching [ANGLE] for Olle Dyberg, a 25-year-old Swedish AI content creator
and consultant (@olleai, ~5.5K TikTok followers, 1.1M+ views). His niche is AI tools —
Claude Code, AI agents, and context engineering. He also does AI consulting and builds
digital products.

TODAY'S DATE: [INSERT CURRENT DATE, e.g. 2026-02-10]

PURPOSE: [WHY this research matters — what Olle will do with it]

YOUR ANGLE: [SPECIFIC SCOPE — what you cover]
BOUNDARIES: [What you do NOT cover — other agents handle those angles]

SEARCH STRATEGY:
- Start with short, broad queries (2-4 words)
- Evaluate what's available, then progressively narrow
- Cross-reference claims across multiple sources
- Aim for 2+ independent sources per key finding

SOURCE QUALITY: Prefer practitioner blogs, official docs, engineering posts, primary
sources. Avoid SEO content farms and listicles.

TOOLS TO USE: [SPECIFIC tools for this angle]

QUALITY BAR: Be exhaustive. Extract every actionable insight, specific number, concrete
example, framework, and contrarian take. Density matters — thin research is useless.
Include sources/URLs for everything. If you find only 3 bullet points, you failed.

OUTPUT FORMAT:
## Key Findings
[Numbered list with inline source citations]

## Evidence Quality
[Which findings are well-sourced vs. speculative]

## Contradictions Found
[Any conflicting information between sources]

## Notable Quotes
[Direct quotes from authoritative sources with attribution]

## Sources
[Full list with URLs]
```

#### Agent Type Selection

| Angle Type | subagent_type | model | Tools |
|-----------|---------------|-------|-------|
| Web research | `general-purpose` | `opus` | `mcp__exa__web_search_exa`, `WebSearch`, `WebFetch` |
| Vault search | `Explore` | `opus` | Glob, Grep, Read on vault path |
| Code examples | `general-purpose` | `opus` | `mcp__grep__searchGitHub` |
| X Research | `Bash` | `opus` | x-research CLI (see below) |

**X Research CLI:**
```bash
cd ~/clawd/skills/x-research && source ~/.config/env/global.env
bun run x-search.ts search "<query>" --quality --quick
```

### Phase 4: Gap Analysis

After ALL sub-agents return (batch — do not process one-at-a-time to avoid anchoring bias):

1. Review all findings together
2. Check: Does each MECE angle have 2+ independent sources?
3. Identify contradictions between agent findings
4. Identify coverage gaps — topics no agent covered adequately
5. **If significant gaps exist**: Spawn 1-2 targeted follow-up agents (Wave 2)

### Phase 5: Synthesize Into Document

Cross-reference all findings and produce ONE comprehensive document. Do NOT simply concatenate agent outputs — synthesize them into something greater than the sum of parts.

**File location**: `/mnt/c/Users/olled/Documents/Obsidian/Notes/02 - Content/Research/[Topic Folder]/[Document Name] [Year].md`

**Topic folder organization**: Group all research outputs into a topic subfolder within `02 - Content/Research/`. If a research session produces multiple files (master synthesis + companion documents from sub-agents), they ALL go in the same topic folder. Create the folder if it doesn't exist.

| Research Topic | Folder |
|---------------|--------|
| YouTube strategy, algorithm, scripting, titles, SEO, case studies | `Research/YouTube/` |
| TikTok hooks, growth, scripts, descriptions | `Research/TikTok/` |
| Meta-prompting, prompt engineering, scriptwriter optimization | `Research/Meta-Prompting/` |
| New topic that doesn't fit existing folders | `Research/[New Topic Name]/` |
| One-off research that doesn't warrant its own folder | `Research/Other/` |

**Rules:**
- ALWAYS check existing folders first (`ls "02 - Content/Research/"`) — use an existing folder if the topic fits
- If 3+ files exist on a topic, they deserve their own folder
- Sub-agent companion files go in the SAME folder as the master synthesis
- When updating `_Index.md`, group entries under `### Research/[Folder]/` headers

**Document structure**:
```markdown
# [Topic Name] [Year]

Research compiled for @olleai ([niche context]). [N] parallel research tracks synthesized.

**Purpose**: [What this research will be used for]
**Date**: [Current date]
**Sources**: [N] web sources, [N] X posts, [N] vault references, [N] code examples

---

## Executive Summary

[3-5 bullet points — the most important findings]

---

## Part N: [Angle Name]

### [Sub-topic]

[Dense, actionable content with specific numbers and examples]

---

## Niche-Specific Applications

[How findings apply to Olle's AI/tech niche specifically]

---

## Contradictions & Open Questions

[Where sources disagreed, what remains unresolved]

---

## Key Takeaways

[Numbered list of the most actionable insights]

---

## Sources

[All sources cited, organized by section]
```

**Quality gate — do NOT save until ALL pass:**
- Document exceeds 2,000 words (minimum for "comprehensive")
- Specific numbers present, not just generalities
- Concrete examples from real creators/companies included
- AI/tech niche addressed specifically
- Sources attributed throughout
- Contradictions flagged (not hidden)
- Olle would learn something genuinely new

### Phase 6: Vault Housekeeping

After saving, update `_Index.md` if a new file was created in a location not yet indexed.

## Tools Reference

| Tool | Use For | Notes |
|------|---------|-------|
| `mcp__exa__web_search_exa` | Current web information | Best for recent articles, guides |
| `WebSearch` | Quick web lookups | Good for current events, dates |
| `mcp__grep__searchGitHub` | Real code patterns from 1M+ repos | Search for actual code, not keywords |
| `WebFetch` | Deep-dive specific URLs | Use after finding promising links |
| x-research CLI | X/Twitter discourse | Creator opinions, recent changes |
| Glob/Grep on vault | Existing vault knowledge | Always check first |

## Important Principles

- **Currency**: Algorithms change fast. Emphasize finding current (2026) information. Stale advice is dangerous.
- **Density over length**: 3,000 words with specific numbers > 10,000 words of generic advice.
- **Build on vault**: Check existing knowledge first. Extend it, don't repeat it.
- **WHY multiplier**: Sub-agents knowing WHY produces dramatically better results. Never skip context injection.
- **MECE or bust**: Overlapping agents waste tokens and produce duplicate content. Boundaries matter.
- **Batch synthesis**: Collect ALL findings before synthesizing. Processing one-at-a-time creates anchoring bias.
- **Start broad**: Agents default to overly-specific queries. Explicitly instruct broad-first search strategy.
