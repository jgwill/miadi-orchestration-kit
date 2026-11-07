import assert from "node:assert/strict";
import { test } from "node:test";
import { check, relationFromTmux, safeTitle, stampFromTmux } from "./screenwalk-name.mjs";

const mino = "mino-t3-2611071211-fork1-t5-miadi-film-apt-2611071058";

test("the relation is the tmux name without its stamps", () => {
  assert.equal(relationFromTmux(mino), "mino-t3-fork1-t5-miadi-film-apt");
  assert.equal(relationFromTmux("fork1-t5-miadi-film-apt-what-can-I-do-2611071058"), "fork1-t5-miadi-film-apt-what-can-i-do");
});

test("the stamp defaults to the first in the name", () => assert.equal(stampFromTmux(mino), "2611071211"));

test("part one of this session", () => {
  assert.equal(safeTitle({ tmux: mino, part: 1 }), "screenwalk-2611071211-mino-t3-fork1-t5-miadi-film-apt-part-001");
});

test("a start the person gave is kept", () => {
  assert.equal(safeTitle({ stamp: "2611071342", tail: "film-apt-fork1-t5", topic: "words as script" }), "screenwalk-2611071342-film-apt-fork1-t5-words-as-script");
});

test("nothing after the stamp is refused", () => {
  assert.match(check("screenwalk-2611071342")[0], /nothing after the stamp/);
  assert.throws(() => safeTitle({ stamp: "2611071342" }), /nothing to put after the stamp/);
});

test("an ep-prefixed slug is refused", () => assert.equal(check("ep120-screenwalk-261107-mino").length, 1));

test("the title carries the stamp and fits", () => {
  const s = "screenwalk-2611071342-film-apt-fork1-t5-words-as-script";
  assert.deepEqual(check(s, "screenwalk-2611071342 | Writing with the Voice"), []);
  assert.equal(check(s, "Writing with the Voice").length, 1);
  assert.equal(check(s, `screenwalk-2611071342 | ${"x".repeat(90)}`).length, 1);
});
