# Medicine Wheel Orchestration Plugin - Documentation Index

This folder provides documentation and navigation for the Medicine Wheel orchestration plugin contract and implementation guidance.

## Overview

The Medicine Wheel orchestration plugin is a **RISE specification packet** that enables Miadi agents to scaffold and deploy Medicine Wheel orchestration capabilities across multiple agent harnesses: Claude Code, Gemini CLI, GitHub Copilot, Codex, and generic MCP-aware runtimes.

**Spec Packet Location**: [`../../rispecs/medicine-wheel/`](../../rispecs/medicine-wheel/)

**Issue**: [jgwill/miadi-orchestration-kit#36](https://github.com/jgwill/miadi-orchestration-kit/issues/36)

## Quick Navigation

| Document | Purpose | Audience |
|---|---|---|
| [README](../../rispecs/medicine-wheel/README.md) | Spec packet overview and acceptance criteria | Everyone |
| [01 - Reverse-Engineer](../../rispecs/medicine-wheel/01-reverse-engineer.md) | Analysis of Medicine Wheel PR #62 and local observations | Architects, Reviewers |
| [02 - Intent](../../rispecs/medicine-wheel/02-intent.md) | Desired relationships and structural boundaries | Decision-makers |
| [03 - Specify](../../rispecs/medicine-wheel/03-specify.md) | Portable plugin contract specification | Spec reviewers |
| [04 - Export](../../rispecs/medicine-wheel/04-export.md) | **Implementation guides for each harness** | **Plugin developers** |
| [05 - Source Ledger](../../rispecs/medicine-wheel/05-source-ledger.md) | Evidence citations and claim confidence | Auditors, Reviewers |

## For Plugin Developers

If you're implementing a Medicine Wheel plugin for a specific harness:

1. **Start with [04-export.md](../../rispecs/medicine-wheel/04-export.md)**
   - Find your target harness (Copilot, Codex, Claude Code, Gemini, or Generic MCP)
   - Use the folder structure and manifest sketches as templates
   - Follow the promotion order and smoke test guidelines

2. **Key artifacts to create**:
   - Folder structure matching your harness pattern
   - Plugin manifest (plugin.json or equivalent)
   - 5 core skills:
     - Session orientation (Four Directions classification)
     - Fire Keeper gate validation
     - RISE spec advising
     - MCP/API health checks
     - Source ledger tracking

3. **Before implementation**:
   - Review [03-specify.md](../../rispecs/medicine-wheel/03-specify.md) for the contract
   - Check [05-source-ledger.md](../../rispecs/medicine-wheel/05-source-ledger.md) for known issues #64-#67

## Key Concepts

### Four Directions
- Orient work through Four Directions classification to determine mission scope and complexity

### Fire Keeper Gates
- Validation checkpoints before action
- Ensure consistency with relational accountability and certification requirements

### Ceremony Lifecycle
- **Gathering**: Initial setup and context preparation
- **Kindling**: Planning and design phases
- **Tending**: Active implementation
- **Harvesting**: Results and documentation
- **Resting**: Closure and archival

### MCP/API Health
- Probe tool availability and health status
- List accessible Medicine Wheel tools for the current session

### Source Ledger
- Track observed facts vs. inferred claims
- Document confidence levels and evidence sources
- Support auditability and cross-harness consistency

## Implementation Status

Current status per [05-source-ledger.md](../../rispecs/medicine-wheel/05-source-ledger.md):
- **Specification**: ✓ Ready
- **Plugin Implementation**: Pending (choose one harness to start)
- **Related Issues**: Medicine Wheel #64-#67 document known runtime caveats

## Related Resources

- **Medicine Wheel PR #62**: [jgwill/medicine-wheel/pull/62](https://github.com/jgwill/medicine-wheel/pull/62)
- **Medicine Wheel Issues #64-#67**: Validator and ceremony lifecycle caveats
- **Miadi Plugin Patterns**: See `copilot/`, `codex/`, `claude-code/`, `gemini/` folders in root
- **RISE Framework**: Foundations-based specification methodology

## Next Steps

1. **For implementation**: Select a harness and follow [04-export.md](../../rispecs/medicine-wheel/04-export.md)
2. **For review**: Consult [05-source-ledger.md](../../rispecs/medicine-wheel/05-source-ledger.md) for evidence and confidence
3. **For architecture**: Review [03-specify.md](../../rispecs/medicine-wheel/03-specify.md) for the contract details
4. **For context**: Read [01-reverse-engineer.md](../../rispecs/medicine-wheel/01-reverse-engineer.md) to understand the source analysis

---

**Last Updated**: September 2026  
**Spec Status**: Specification-ready for implementation wave  
**Version**: 0.1.0
