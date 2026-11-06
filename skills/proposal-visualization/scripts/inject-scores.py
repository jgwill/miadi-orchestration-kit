#!/usr/bin/env python3
"""Put Jev's scores on a page: a chip on each scored card and the three lists.

    inject-scores.py <page.src.html> <scores.json> <page.html>

The source marks each card with <!--jev:CODE--> and the lists' place with <!--jev:lists-->.
scores.json is what scoring/score-proposal.mjs --out wrote. Exit 1 when a mark stays unfilled.
"""

import json
import re
import sys

BAND = {"act": "would do now", "ask": "after your go", "owner": "needs you"}


def codes(items):
    return "".join(f'<a href="#{c}">{c}</a>' for c in items) or '<span class="state">none</span>'


def main(src, scores, out):
    page = open(src, encoding="utf-8").read()
    data = json.load(open(scores, encoding="utf-8"))
    lists = {"act": [], "ask": [], "owner": []}
    for card in data["cards"]:
        reading, band = card["readings"]["obvious_now"], card["band"]
        lists[band].append(card["code"])
        why = card.get("why") or ""
        trigger = re.match(r"([a-z_]+ [0-9.]+)", why) if band == "owner" and "obvious_now" not in why else None
        score = reading.get("confidence", reading.get("p")) or 0
        tail = f" · {trigger.group(1)}" if trigger else ""
        value = str(reading.get("value")).replace("_", " ")
        chip = f'<p class="jev">Jev reads: {BAND[band]} · {value} {score:.2f} of 1{tail}</p>'
        page = page.replace(f"<!--jev:{card['code']}-->", chip)
    section = f'''<section aria-labelledby="s-jev">
  <h2 id="s-jev">How Jev read these cards</h2>
  <p class="lede">Jev scored the {len(data["cards"])} cards ({data["requested_model"]}). "Needs you" means a person has to decide. "After your go" means the suggestion on the card can stand with a yes. It is not calibrated yet, and your answer outranks it.</p>
  <div class="bands">
    <div class="band"><b>Would do now</b><div class="codes">{codes(lists["act"])}</div></div>
    <div class="band"><b>After your go</b><div class="codes">{codes(lists["ask"])}</div></div>
    <div class="band"><b>Needs you</b><div class="codes">{codes(lists["owner"])}</div></div>
  </div>
</section>'''
    page = page.replace("<!--jev:lists-->", section)
    left = re.findall(r"<!--jev:[^>]*-->", page)
    if left:
        print(f"inject-scores: no score for {left}", file=sys.stderr)
        return 1
    open(out, "w", encoding="utf-8").write(page)
    print({BAND[k]: v for k, v in lists.items()})
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    sys.exit(main(*sys.argv[1:]))
