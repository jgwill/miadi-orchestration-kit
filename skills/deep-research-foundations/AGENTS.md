# AGENTS.md - Deep Research Foundations

## Purpose

This skill turns external inquiry into durable `foundations/<topic>/` packets that serve three
audiences at once:

- academic readers: fields, concepts, citations, cautions
- engineering readers: architecture, source ledgers, data-model implications
- the person who asked, and the persona that discusses the packet with them: the intent, the
  evidence state of each claim, what must not be claimed

## Inquiry relation

Ask: what recognized academic or professional fields does this design decomposition imply, and
what should we search externally so the work can teach itself without drifting into unsupported
lore?

## Relations

- `../production-context-exploration/SKILL.md`: a staged exploration holds a foundations packet
  beside its concepts before an episode exists (teams/README.md, T5).
- `../chronicle-episode/SKILL.md`: an episode holds a released packet through the foundation door.
- jgwill/Miadi `packages/foundations`: the package that distributes the factory's packets and a copy
  of this skill (`skills/deep-research-foundations/SKILL.md` there). Which copy is canonical is
  jgwill/miadi-orchestration-kit#167's question.

## Origin

Forked from `deep-research`, a vault-research skill written for another creator's project, and
renamed `deep-research-foundations` because the output is a repo-local foundations packet, not a
vault research document. Imported into this kit from jgwill/dotagents
(`/home/mia/.agents/skills/deep-research-foundations`) on 2026-11-22, commit `790495f`. Version
0.3.0 removed the residue of that fork and the three named stewards; see the change log in
`SKILL.md`.
