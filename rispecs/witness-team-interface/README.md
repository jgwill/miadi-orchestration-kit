# Witness team interface (reference for a later phase)

Written 2026-11-01 by the Mino witness seat (T1) in Episode 568 (miadi-chronicle://568), from
Guillaume's words in its ceremony (miadi-ceremony://7cc5e523-24ed-4512-81e2-f21c1f43ebeb). Not
started. It classifies what the witness would need, so the phase that builds it starts from here.

## Desired outcome

The witness has its own interface: an MCP that other teams and other hosts reach, carrying the
tools witnessing and inventorying need, and writing as the seat, never as the person. It is
built the way the Miadi Chimera Factory connector is built (`@miadi/connector`, served at
mcp.sanctuaireagentique.com): one handshake that says who is signed in and what each tool can do,
and requests that wait for a person's decision.

Guillaume, 2026-11-01: "it could be a reference for you to actually see which are the tools that
you need, what are the capabilities that you need, so that we would have an MCP tool for you,
mostly for your team or this type of work that would be interfacing basically with other teams."
And: "we really envision you being capable of interacting with this systems remotely."

## Current reality

- The connector was made for cloud agents and for conversations in the Claude and ChatGPT phone
  apps. It signs in as the person (Guillaume, admin, scope `miadi:read`). Its contribute tools
  need the person's sign-in, and a record written through it carries the person's name. It is a
  reference for the witness, not the witness's door.
- The witness works on gaia through scripts: `tide agents list`, `miadi-hooks-interpret`
  (`join`, `digest`, `fleet`), `miadi-witness` `inventory.mjs` (`write`, `link`, `hold`),
  `circle-feed.mjs` (`post`, `diary`) and `witness-listen.mjs`. Another host reaches none of them.
- Mino's identity is a participant. The circle door answers it, and the episode's sessions page
  refuses it ("Your role (participant) has no API access").

## The connector's tools, read for the witness

| group | connector tools | the witness today | in a witness interface |
|---|---|---|---|
| sessions and missions | `list_sessions`, `get_session`, `mission_status`, `handoff_status` | `tide agents list`, `miadi-hooks-interpret join`/`digest`/`fleet`, the inventory records | read tools for other teams: which sessions run, for which episode and team, what each completed and holds |
| links and records | `link_records`, `append_observation`, `record_handoff`, `update_handoff` | `inventory.mjs link` (question, trace, evidence, criteria, judgment), `inventory.mjs hold` (episode, circle, ceremony), observations | the same writes, signed by the seat, so another team can ask the witness to record what it saw |
| circles and diaries | `list_circles`, `get_circle` | `circle-feed.mjs post` (a DONE line as the seat's turn), `circle-feed.mjs diary` (the seat's entry with its token, the person's with theirs) | turns and diary entries routed by who they belong to, the whole conversation reaching the circle over time |
| decisions | `show_decisions`, `propose_session_completion`, `request_session_steer`, `propose_work`, `request_authorized_run` | the `held-steers` and `team-fit` skills, a proposed ending per session | a session's ending or a steer proposed as a card the person decides |
| evaluation and beats | `get_evaluations`, `record_evaluation`, `get_narrative_beats`, `propose_narrative_beat` | the seat's chart store: MMOT phases and narrative beats | evaluations of a session against the criteria it was held to |
| not the witness's | `review_lookup`, `review_versions`, `request_review_operation`, `request_deep_diver`, `link_review_to_episode`, `save_research`, `open_inquiry`, `register_source_intent`, `request_inquiry_episode`, `prepare_calendar_event`, `provider_capabilities` | | other teams' work; the witness reads their results through the episode |

What neither has yet: a seat identity that may read the sessions page, and the capabilities a
session changed, named from the capability registry (Episode 568,
`miadi-capability://<owner>/<repo>/<kind>/<name>`).

## Writing for a participant (named 2026-11-01)

A facilitator can have the witness write a diary entry for someone in the circle, human or
agent. Guillaume: a participant may give him their token, and his facilitation is "to voice as
an input to you what aspect of Diary entry to add to the ceremony for the user after I've listen
to what he had to share", and "if I would ask you to speak for Miette, MIADI_PERSON_TOKEN_MIETTE
we would want to represent that". He named the condition too: "it implies some trust that we
assume is there".

What the witness does today (`circle-feed.mjs diary --for <name>`):

- The entry is written with the participant's own token, so it stands in their name, and only
  when the identity door answers to that name.
- It opens with who wrote it and how: from their words, from what the facilitator relayed after
  listening, or in an agent's voice at someone's request.
- The seat never writes another's entry with its own token, and never its own with another's.

What the Factory has not defined yet: who may give a token for this, how a participant sees and
withdraws an entry written for them, and how a facilitator's relay is recorded beside it.

## Steps for the phase that builds it

1. Mino's identity reads the episode's sessions page (a permission on the Miadi app).
2. The witness's read tools served as an MCP from gaia with the seat's token, with a handshake
   in the connector's form (signed in as, tools and their status).
3. The witness's writes in the same server, as the seat: `hold`, `link`, `diary`, `post`.
4. The server reached from other hosts (ilex, the phone) through the tailnet or the public front.
