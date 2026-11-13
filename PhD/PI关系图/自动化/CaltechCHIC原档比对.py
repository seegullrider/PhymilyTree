import argparse
import json
import re
import sqlite3
import unicodedata
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit

from lxml import html


def normalized(name):
    label = re.split(r"[（(—]", name, maxsplit=1)[0]
    text = unicodedata.normalize("NFKD", label).casefold()
    return tuple(re.findall(r"[a-z0-9]+", text.encode("ascii", "ignore").decode()))


def initials_key(words):
    if len(words) < 2:
        return None
    return words[0], words[-1]


def node_text(node):
    return " ".join(node.text_content().split())


def read_catalogue(path):
    doc = html.fromstring(path.read_bytes())
    canonical = doc.xpath("//link[@rel='canonical']/@href")
    if len(canonical) != 1 or urlsplit(canonical[0]).hostname != "chic.caltech.edu":
        raise ValueError(f"Unexpected canonical source in {path}")
    cards = doc.xpath("//div[contains(concat(' ', normalize-space(@class), ' '), ' mentor-details ')]")
    if not cards:
        raise ValueError(f"No genealogy cards found in {path}")
    entries = []
    for card in cards:
        headings = [node_text(heading) for heading in card.xpath("./h4")]
        if not headings or not headings[0]:
            continue
        roles = []
        for row in card.xpath("./table//tr"):
            position = row.xpath("./td[@class='position']")
            person = row.xpath("./td[@class='name']")
            if len(position) != 1 or len(person) != 1:
                continue
            label, mentor = node_text(position[0]), node_text(person[0])
            if mentor and re.search(r"ph\.?d\.?|post[ -]?doc", label, re.IGNORECASE):
                links = person[0].xpath("./a/@href")
                roles.append({"position": label, "name": mentor, "url": next(iter(links), None)})
        if roles:
            entries.append({"name": headings[0], "headings": headings, "roles": roles, "source": canonical[0]})
    return {"source": canonical[0], "cards": len(cards), "entries_with_mentor": len(entries),
            "next": doc.xpath("//link[@rel='next']/@href"), "entries": entries}


def compare(records, entries):
    exact, partial = defaultdict(list), defaultdict(list)
    for record in records:
        words = normalized(record["name"])
        exact[words].append(record)
        partial[initials_key(words)].append(record)
    matches = []
    for entry in entries:
        words = normalized(entry["name"])
        hit = exact[words]
        strength = "normalized_full_name"
        if not hit:
            hit = partial.get(initials_key(words), []) if initials_key(words) else []
            strength = "first_and_last_name"
        if hit:
            matches.append({**entry, "match_kind": strength, "records": hit})
    return matches


def main():
    parser = argparse.ArgumentParser(description="Compare downloaded public Caltech genealogy pages to the local PI queue.")
    parser.add_argument("pages", nargs="+", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    with sqlite3.connect("file:检索队列.sqlite?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        records = [dict(row) for row in db.execute("SELECT id, name, unit, filename FROM records ORDER BY unit, name, id")]
    catalogues = [read_catalogue(path) for path in args.pages]
    unique_entries = {}
    for catalogue in catalogues:
        new_entries = 0
        for entry in catalogue.pop("entries"):
            key = (normalized(entry["name"]), tuple(entry["headings"][1:]),
                   tuple((role["position"], role["name"], role["url"]) for role in entry["roles"]))
            if key not in unique_entries:
                unique_entries[key] = {**entry, "also_listed_at": []}
                new_entries += 1
            elif entry["source"] != unique_entries[key]["source"]:
                unique_entries[key]["also_listed_at"].append(entry["source"])
        catalogue["new_entries"] = new_entries
    matches = compare(records, unique_entries.values())
    out = {"school_records": len(records), "catalogues": catalogues, "matches": matches,
           "scope": "Name matching is for discovery. Verify the identity, degree, source, and role before any database change."}
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"catalogues": catalogues, "records": len(records), "matched_entries": len(matches)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
