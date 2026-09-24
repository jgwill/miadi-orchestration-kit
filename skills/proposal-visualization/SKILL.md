---
name: proposal-visualization
description: >
  Present a proposal, plan, migration or architecture as one HTML page that a
  human can read, comment on and approve at a glance. The page has a before/after
  figure that draws only what changes, figures coloured by who owns each part,
  a clickable wireframe with an ownership overlay, and every decision, question,
  risk and step as a coded card that comments can anchor to. Host-neutral: any
  agent that writes HTML can follow it. Triggers on "visualize the proposal",
  "make an artifact so we can comment", "diagram the architecture", "wireframe
  it", "show what we will do", "give us something to approve", "present the plan".
---

# Proposal visualization

## Why this exists

On 2026-09-24 the owner approved the packaging of Miadi's tide reply annotator
from one page, and said of its before/after figure: "it really enabled me to
approve this phase very rapidly". The owner asked that the pattern be kept for every
agent that shows its work visually, not only Claude Code. This skill is that
pattern. The page it came from is `reference/annotate-core-and-ui.html`.
Read it before building a new one.

Tracked in jgwill/miadi-orchestration-kit#53.

## The page's one job

A reader who has not followed the work sees what exists now, what will exist
after, what they are being asked to decide, and can answer each decision by
commenting on it. Everything on the page serves one of those four things.

## Parts, in order

Leave out any part the proposal does not need. Keep the order of the ones you use.

1. **Header.** A name for the proposal (two to four words), one sentence saying
   what will exist, a status chip ("Awaiting your go (D4)"), and one short card
   per package or unit being created or changed. Then a "How to respond" line:
   "Comment on a card or cite its code. A go on D4 starts the build."
2. **Who gets what.** One card per audience (the people using it, other apps or
   teams, the platform's maintainers). Each card ends with a "Today:" line, so
   the difference is visible without reading further.
3. **Today → after.** Two columns of facts. Today is current reality, with
   paths and numbers. After is written as things that will exist, never as
   problems removed.
4. **Before / after figure.** Two panels drawn on the same grid. Draw the
   difference: the arrow that appears, the arrow that disappears, the arrow that
   changes direction. A caption states that change in one sentence. This is the
   figure the owner approved from. Do not skip it when the proposal changes structure.
5. **Ownership figures.** A flow or loop where each step is coloured by who owns
   it (the new package vs the host app, for example), and a nesting figure when
   data or types split between layers. Say in the caption what the colours mean.
6. **Mechanism figure,** only when a subtle behaviour is the value being
   preserved, for example a timeline of an iOS selection event and a grace window.
7. **Clickable wireframe.** The real UI, in the product's own look, with
   example data marked "example". It runs the proposed behaviour where that is
   cheap, and has a toggle, on by default, that outlines each region and labels
   who renders or supplies it. When a second host will use the same component,
   put a second frame beside the first in that host's colours.
8. **Reference.** The public API or config as tabs, one per entry point.
9. **What review changed,** when a reviewer or another agent corrected the
   draft: one coded card per correction with its evidence path.
10. **Build order.** Numbered steps (a real sequence), each with the check that
    closes it, such as a test file, a verify script or a deploy.
11. **Risks, decisions, questions.** Coded cards (below).
12. **Footer.** Sources, who drafted and who reviewed, and the date the
    evidence was checked.

## Coded cards

- Prefixes: `D` decisions, `Q` questions, `R` risks, `A` actions/steps,
  `C` corrections, `N` later-phase outcomes. Invent a new prefix when needed
  and say what it stands for the first time it appears.
- One card per item, each with `id="<code>"`, so a comment tool or an
  annotation tool anchors to exactly one item and a link can jump to it.
- A code keeps its meaning for the whole conversation and across revisions.
  Never reassign one. When a step is replaced, give the replacement a new code
  and say which codes it replaces.

## Figures

- Hand-build them as inline SVG or HTML/CSS. Do not use mermaid: inside artifact
  viewers its theme fights the page's colours and node text loses contrast.
- Text is always the foreground token, on a solid fill. Put the accent colour
  on strokes, rings and fills, never on small text.
- Label every arrow with what moves or happens (`imports types`, `mounts ./dom`).
  An unlabeled arrow only says "related somehow".
- One claim per figure. Put the claim in `<figcaption>` and in the SVG's
  `aria-label`.
- Wide figures go in their own `overflow-x: auto` container with a `min-width`,
  so the page body never scrolls sideways on a phone.
- SVG `<marker>` ids must be unique across the whole page (`a1`, `a2`, ...),
  because several inline SVGs share one document.

## Contrast is computed, never judged by eye

Before publishing, compute every text colour against every surface it sits on,
in both themes. Body text needs 4.5:1. Never dim text with `opacity`: it blends
toward the background and can halve the ratio. Use a muted colour token instead.

```js
const L = h => { const c = [0, 2, 4].map(i => parseInt(h.slice(i + 1, i + 3), 16) / 255)
  .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
// run ratio(text, surface) for every pair; anything under 4.5 changes before publishing
```

## Evidence

- Every `file:line`, commit, version and count on the page is read from the
  source in the same session the page is written. Label anything you could not
  check as unverified, or leave it out.
- Tie each correction and each "Today" fact to a path the reader can open.

## Theme and layout

- Define the full light palette as tokens on `:root`. Redefine the tokens for
  dark under `@media (prefers-color-scheme: dark)` guarded by
  `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`.
  Give `body` an explicit background.
- When the host product has design tokens (Miadi: the neutral scale in
  `app/globals.css` plus the medicine-wheel gold `#ffd700` as the structural
  accent), use them.
- The wireframe may keep the product's own fixed look (a dark cockpit stays
  dark). Set its colours explicitly.
- Works at 400px wide with a 16px side gutter. Grids fall to one column.

## Revisions after comments

When the owner comments:

1. Read every comment, including the threads your tools cannot reply to.
2. Add a "Revision N" band under the header. It lists each comment and what it
   changed, by code ("D1 approved", "Q4 answered: …", "N1 added from your
   /chronicle comment").
3. Mark decided cards as decided and say who decided. Leave only open items in
   the Decide section.
4. Republish to the same address, so the comments stay attached.

## Publishing

- **Host with an artifact publisher** (for example Claude Code): publish the
  file, and republish to the same address for revisions.
- **Any other host:** write one self-contained `.html` file into the work's
  vessel (the episode folder, the PDE folder or the repo's working notes, never
  `/tmp`). The only external request allowed is fonts, with a system fallback
  stack. Give the reader the path.

## Before you publish

- [ ] The before/after figure draws the change, and its caption states it
- [ ] Every arrow is labelled and every figure has a caption
- [ ] Contrast was computed for every text/surface pair in both themes
- [ ] Every code has its own card with `id`, and no code was reused
- [ ] Every cited path and line was checked in this session
- [ ] The wireframe marks example data as example and has the ownership toggle
- [ ] Nothing scrolls sideways at 400px

🌸: A reader who sees exactly what changes can decide in minutes, and one who has to piece it together from prose often cannot decide at all.
