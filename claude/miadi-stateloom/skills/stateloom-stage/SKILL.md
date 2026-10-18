---
name: stateloom-stage
description: Show the person your work on the live stateloom canvas and hear what they point at — the stage and the marks (Spec 83). Use when calling show_step, write_tour, play_tour, stage_control, read_marks, await_marks, answer_mark, add_mark or what_is_on_screen, or `smcx stage` / `smcx marks`; when explaining a design (state machine, ERD, sequence, system) to a person instead of describing it in text; when preparing a walkthrough someone will play later; when the person says they marked, selected, circled or pointed at something on a diagram; before replying to a person who has the canvas open; or when a session must wake when the person marks something.
---

# The stage and the marks

The canvas is where you **show** the work and where the person **points back** at it.

- **The stage** (you → person). A step names a drawing, what to light in it, and the sentence you
  say there. The canvas opens the drawing, dims everything but what you lit, and shows your words
  as a caption (read aloud when the person turns the voice on). Steps go out one at a time while
  you talk (`show_step`), or as a whole tour the canvas plays with its own controls
  (`write_tour` + `play_tour`), like slides over the real drawings.
- **The marks** (person → you, and back). The person turns on ✎, taps an element or drags around
  several, and writes (or says) what you should know. A mark is anchored to those elements; your
  answer goes in its thread, on the drawing. Marks live beside the drawing in
  `<drawing>.marks.json`, never inside it.

Nothing here changes a drawing. Full specification: `rispecs/83-stage-and-marks.spec.md` in
`jgwill/smcraft`.

## Before you reply to the person

**If they have the canvas open, call `read_marks` first.** Their words are about what they marked
and what is on their screen; the review tells you both:

```
Guillaume is on elliott_wave_count.smdf.json (machine), with state:Reading in hand. Tour 'Why the walk stops' at step 2 of 3, paused.
1 mark(s):
1. [open · comment] Guillaume on state:Reading, event:LabelWave (elliott_wave_count.smdf.json) — m-0mvd4k2tckndr
   "why does the walk stop here?"
```

Answer each mark where it was raised with `answer_mark {id, text}` — add `show: true` and the
canvas lights the marked elements with your answer as the caption. Close it with `resolve: true`
when the person agrees it is settled (or leave that to them). `read_marks` lists only the marks
waiting for you; `all: true` lists every mark.

## Showing, not describing

When you would write "the `Published` state, which the `Evaluate` event leaves…", show it:

```
show_step {
  doc: "elliott_wave_count.smdf.json",
  spotlight: ["state:Published", "event:Evaluate"],
  say: "The count must be Published before Evaluate can leave it — and the scenario fires Evaluate one step too early."
}
```

- `focus` selects and centres **one** element (the workspace's own focus: a machine drills to its
  level, a sequence selects the message).
- `spotlight` lights **several** and dims the rest; the view fits them all.
- `region` frames an area `{x, y, width, height}` in the drawing's coordinates.
- `say` is one or two sentences. It is a caption, not a report; the detail stays in your reply.
- `doc` defaults to the active document; a drawing that a system lists opens inside that system
  (the strip stays).

Element names are `<kind>:<name>`: `state:`, `event:` (machine — and on a sequence, every message
that fires it), `entity:`, `attribute:Entity.field` (ERD), `participant:`, `message:9` / `message:f1.2`
(sequence), `machine:`, `object:`.

A step during a playing tour pauses the tour; closing the caption returns to it.

## A tour: a walkthrough that can be played again

Write one when the work needs explaining in an order, when the person will look at it later, or
when the session will end before the work does:

```
write_tour {
  name: "Why the walk stops",
  notes: "The question Guillaume asked on 2026-10-18, and the three drawings that answer it.",
  steps: [
    { doc: "wave_count_to_entry.sqdf.json", spotlight: ["message:7", "message:8"], title: "The ask", say: "…" },
    { doc: "elliott_wave_count.smdf.json", focus: "state:Published", title: "Where the count must be", say: "…" },
    { doc: "elliott_wave_count.erdf.json", spotlight: ["entity:WaveCount", "entity:TradeSetup"], say: "…" }
  ]
}
play_tour {}                       # the tour just written; autoplay true
stage_control { action: "pause" }  # play, pause, next, prev, goto (index from 1), stop
```

The tour lands beside the active document as `<name>.tour.json`, its paths relative to itself, so
it moves with the drawings. A step without `doc` stays on the previous step's drawing. Checked
T001–T009 (`say` present, element names well formed, region a box, paths `.json`, `audio` a URL).
The person moves through it with ◀ ▶, the step dots, or the keyboard; the caption has a voice
toggle and **Answer**, which opens a mark on whatever the step lit.

**A voice of your own.** The canvas reads captions with the browser's voice only when the person
turns it on. To be heard in your own voice, render the words with the `miadi-voice` MCP (the one
sanctioned voice path) and put the recording's URL in the step's `audio`.

## Leaving a question on the drawing

```
add_mark { doc: "elliott_wave_count.erdf.json", elements: ["entity:TradeSetup"],
           text: "Should a TradeSetup keep the version of the count it was drafted from?" }
```

It is pinned on the element (violet: a question waiting for the person). Their reply arrives in
the thread; `await_marks` waits for it.

## Waiting for the person

- `await_marks {timeoutSeconds: 120}` holds the tool call until a new mark or reply arrives.
- To wake a session without holding a call — the companion pattern — run the CLI as a
  **background task**; it exits 0 with the mark, the context, and the exact commands to answer and
  to listen again (4 on timeout):

  ```bash
  smcx --doc /abs/system.sysdf.json marks await --timeout 1800
  smcx --doc /abs/system.sysdf.json marks reply m-… "what you say"
  ```

## When the person speaks from the canvas (Spec 84)

The designer's Talk dock records a take into the Chronicle episode, the same thread as the
episode companion's phone page. When the take reaches you (`mia-listen` wakes the seat), the wake
says **spoken at the canvas**: the drawing, the element in focus, and the marks waiting on an
agent. Read those marks with `read_marks` as you would for a typed message.

When your answer is about the drawings, answer as **steps**: the canvas plays them as a tour,
opening each drawing and lighting what you name while that step's words play in Mia's voice.

```bash
cat > reply-steps.json <<'JSON'
[
  {"doc": "/abs/wave_count_to_entry.sqdf.json", "spotlight": ["message:7", "message:8"], "title": "The ask",
   "say": "You asked me for a blueprint from your count, and I draft the setup here."},
  {"doc": "/abs/elliott_wave_count.smdf.json", "focus": "state:Published", "spotlight": ["state:Published"],
   "say": "That ask is answered only once the count is Published."}
]
JSON
mia-listen reply <take> --steps reply-steps.json
```

- The step is a Spec 83 step with absolute paths (or paths relative to the episode). One or two
  sentences per step: each is voiced on its own and the next step waits for it to end.
- The names are the document's own (`state:Published`, `message:7`, `entity:TradeSetup`). A name
  that does not exist lights nothing; check it with `get_state` / `list_states` or the ERD/SQDF
  tools before posting.
- A reply without steps plays as one caption with the whole voice. Use that for answers that are
  not about a drawing.
- Replies wait their turn on the canvas: never over the person's recording, never over another
  reply. Post the second thought; it plays after the first.

## Requirements

- The hub (`STATELOOM_BRIDGE_URL`, 4599) and the canvas (4598) running — `stateloom-live-loop`.
  Without a hub the marks still work (they are files); the stage does not.
- The MCP server and the canvas on the same **stage**: `STATELOOM_STAGE` on both (default
  `default`); a page joins another with `?stage=<name>`.
- `STATELOOM_AGENT_NAME` names you on marks and on the caption.
- `what_is_on_screen` answers what the person is looking at without the marks; `GET
  <hub>/stage/<name>` answers the same in JSON for a script.

## Mistakes that cost a turn

- Replying to the person's message without `read_marks` when they have the canvas open — they
  pointed at something and you answered something else.
- A caption that is a paragraph. Say one thing per step; make another step.
- `focus` with several elements — it takes one. Use `spotlight`.
- A bare name (`Pending`) where a kind is needed (`state:Pending`): T004/T005.
- Writing a tour nobody plays. Tell the person it exists and play it, or say where it is for the
  next instance.
