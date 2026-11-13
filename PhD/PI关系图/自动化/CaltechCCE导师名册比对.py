import argparse
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from CaltechCHIC原档比对 import normalized


def roster_name(label):
    if "," in label:
        family, given = label.split(",", maxsplit=1)
        return normalized(f"{given.strip()} {family.strip()}")
    return normalized(label)


def main():
    parser = argparse.ArgumentParser(description="Match an extracted Caltech CCE advisor/supervisor roster to the local PI queue.")
    parser.add_argument("roster", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    roster = json.loads(args.roster.read_text(encoding="utf-8"))
    candidates_by_name = defaultdict(list)
    with sqlite3.connect("file:检索队列.sqlite?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        records = [dict(row) for row in db.execute("SELECT id, name, unit FROM records ORDER BY name, id")]
    for record in records:
        name = normalized(record["name"])
        if len(name) >= 2:
            candidates_by_name[(name[0], name[-1])].append((name, record))
    matches = []
    for entry in roster["entries"]:
        name = roster_name(entry["name"])
        if len(name) < 2:
            continue
        candidates = [{"matching": "full_name" if name == key else "first_and_last_name", **record}
                      for key, record in candidates_by_name.get((name[0], name[-1]), [])]
        if candidates:
            matches.append({**entry, "candidates": candidates})
    result = {"source": roster["source"], "title": roster["title"], "school_records": len(records),
              "source_entries": len(roster["entries"]), "matches": matches,
              "scope": "Verify same person, actual training stage, and full supervisor identity in original sources before recording."}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"entries": len(roster["entries"]), "school_records": len(records),
                      "matching_entries": len(matches)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
