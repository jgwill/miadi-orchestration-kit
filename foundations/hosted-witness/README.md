# Hosted witness: foundations

A basic research foundation for `rispecs/hosted-witness-service/`: an agent seat hosted on a relative's machine that witnesses their sessions, does the obvious work and prepares the next step for a person's decision. Written 2026-11-04 by the witness seat `6ad00fd4` from a first search. Each field below is under 55 words. The sources are the starting reading, not a review of each field.

## Fields

### Informal technical support at home
The relative's machine is kept by someone close to them, not by an IT department. Studies of home help find that helpers act out of obligation to their circle, and that the relationship shapes what help is given and how well (Poole et al. 2009). The witness takes on part of that obligation.

### Remote help with a shared view
Helpers guide better when they see the same workspace as the person doing the task. Over a remote link, that shared view is what gets lost first (Fussell, Kraut and Siegel 2000). The capture and the pane give the witness that shared view. The feedback file gives one back to the relative.

### Mixed initiative and adjustable autonomy
An assistant should act where automation is clearly useful and ask when it is unsure of the person's goal. It should also keep the cost of interrupting low (Horvitz 1999). The witness acts alone on reversible finishing. Steers and endings go to a person as decisions. The pane guard keeps it from interrupting someone who is typing.

### Cognitive apprenticeship
A learner watches an expert's thinking made visible, then practises with support that is gradually withdrawn: modeling, coaching, scaffolding, articulation, reflection, exploration (Collins, Brown and Newman 1989). Jerry learns plugins by watching his own agent work, with one decision at a time and each step's proof shown to him.

### Legitimate peripheral participation
Newcomers join a practice by taking real but bounded part in it, and move toward its centre over time (Lave and Wenger 1991). The relative's feedback is a real contribution to the factory from its edge. Episode 253 (miadi-chronicle://253) asks for exactly that: contributing without code.

### Relational accountability
Research is accountable to the relationships it is part of: consent, respect, reciprocity, responsibility (Wilson 2008). The relative consents to being witnessed and can withdraw. Their words are kept as said. What the seat learns comes back to them in their own session.

### Packaging as distribution of a practice
A Debian package carries configuration as conffiles. dpkg keeps the user's edits through upgrades and must not have maintainer scripts rewrite them (Debian Policy 4.7.2.0, §10.7 and chapter 6). The witness's per-relative configuration is a conffile for that reason. Consent and scope live where the relative can read them.

### Privacy as contextual integrity
A flow of information is appropriate when it keeps the norms of the context it came from (Nissenbaum 2004). Jerry typed to his agent; the same words reach the witness and every account on the host. Whether that flow is appropriate is a question about contexts, not about secrecy.

### Data sovereignty
OCAP (ownership, control, access, possession) names who governs data about a community (First Nations Information Governance Centre). Asked of one relative's sessions: who owns the capture, who controls what is read, who may access it, where it is kept.

### Research-creation in music for the screen
Research-creation treats making a work as a way of producing knowledge, with the work and the writing about it held together (Chapman and Sawchuk 2012). William's interest, composition in relation to film and the artefacts it makes, sits here. Jerry's atelier is that kind of making, measured and written down.

## Research questions this run raises

- **RQ1.** Jerry's "I don't get it" was answered in 45 words, in the session where he asked. How does a person come to understand an agent system when the explanation arrives in the conversation where they ask, compared with a prepared page?
- **RQ2.** Jerry learned that his sessions were already recorded and readable after the recording began. What does consent mean when the observation started before the person knew of it?
- **RQ3.** "This is a plugin that running here who analyze all Claude instance.?" Which flows from a relative's sessions to a maintainer are appropriate, and who decides them: the relative, the maintainer, or a decision model such as Jev (Episode 564, miadi-chronicle://564)?
- **RQ4.** How does relational accountability become design in a witnessing agent: words kept verbatim, consent that can be withdrawn, and what the relative receives back?
- **RQ5.** Did the witness's presence change what Jerry did? He opened a session of his own, named it after the handle and went to his music.

- **RQ6.** Consent could be held by a decision layer the relative builds for himself, one that decides, informs and discusses. Which of Jerry's agents can learn such a decision engine (Episode 564), and how does it change the way musical work is judged?

## Wilson (2008), pages 78 to 81, collected for William to choose

William photographed these pages on 2026-11-06. The passages are quoted as printed. Each is set beside the question it speaks to. Which of them are kept is William's choice.

| | page | Wilson's words | speaks to |
|---|---|---|---|
| W1 | 78 | "She could have merely stayed in the university library and re-translated the text, but that would not have accomplished her purpose. That may have helped to correct the misinformation, but it would not have restored the relationship." | RQ1: two rewritten pages did not reach Jerry; a conversation in his own session did |
| W2 | 78 | "the language was taken out of its context of relationality. In the translation given, relationships were broken." | RQ3: words captured in one context and read in another |
| W3 | 79 | "So the methodology is simply the building of more relations." | the run itself: a circle, two sessions, Episodes 250 to 259 |
| W4 | 79 | "We must ensure that both sides in the relationship are sharing the power going into these new connections. Without this reciprocity, one side of the relationship may gain power and substance at the expense of the other." | RQ2 and RQ4: the witness reads Jerry's sessions; what Jerry receives back |
| W5 | 79 | "Our axiology demands that we be accountable to these relations that we form." | RQ4 |
| W6 | 80 | "Rather than viewing ourselves as being in relationship with other people or things, we are the relationships that we hold and are part of." | RQ5 |
| W7 | 81 | "In healthy Indigenous communities though, the strength of already established bonds between people can be used to help uplift others to bring them into the circle." | Jerry entering the circle through his bond with William; Episode 253 |

William, 2026-11-06, in his own words and not Wilson's: "yes, we are our relationship, but the more relationship we have, the more we are something that you will have to study." It joins W3 and W6.

## Related packets the Miadi app already serves

`delegation-and-adjustable-autonomy`, `learning-sciences-cognitive-apprenticeship`, `software-supply-chain-and-release-engineering` (listed by `GET /api/foundations`). Episode 1000 (miadi-chronicle://1000) holds the last of these.

## Sources

- Poole, E. S., Chetty, M., Morgan, T., Grinter, R. E., Edwards, W. K. (2009). Computer help at home: methods and motivations for informal technical support. CHI '09, 739–748. https://doi.org/10.1145/1518701.1518816
- Fussell, S. R., Kraut, R. E., Siegel, J. (2000). Coordination of communication: effects of shared visual context on collaborative work. CSCW '00, 21–30. https://doi.org/10.1145/358916.358947
- Horvitz, E. (1999). Principles of mixed-initiative user interfaces. CHI '99, 159–166. https://doi.org/10.1145/302979.303030
- Collins, A., Brown, J. S., Newman, S. E. (1989). Cognitive apprenticeship: teaching the craft of reading, writing, and mathematics. In L. B. Resnick (Ed.), Knowing, Learning, and Instruction. Erlbaum. Method list read from secondary summaries, not the chapter.
- Lave, J., Wenger, E. (1991). Situated Learning: Legitimate Peripheral Participation. Cambridge University Press. From model knowledge, not searched.
- Wilson, S. (2008). Research Is Ceremony: Indigenous Research Methods. Fernwood. From model knowledge, not searched.
- Nissenbaum, H. (2004). Privacy as contextual integrity. Washington Law Review, 79(1), 119–157. From model knowledge, not searched.
- First Nations Information Governance Centre. The First Nations Principles of OCAP®. From model knowledge, not searched.
- Chapman, O., Sawchuk, K. (2012). Research-creation: intervention, analysis and "family resemblances". Canadian Journal of Communication, 37(1), 5–26. From model knowledge, not searched.
- Wilson, S. (2008). Research Is Ceremony, pages 78 to 81, read from William's photographs of 2026-11-06.
- Debian Policy Manual 4.7.2.0 (2025-02-27), §10.7 Configuration files, chapter 6 Maintainer scripts. https://www.debian.org/doc/debian-policy/
