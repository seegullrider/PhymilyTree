import argparse
import json
import re
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

from lxml import html


def words(text):
    normalized = unicodedata.normalize("NFKD", text).casefold()
    return tuple(re.findall(r"[a-z]+", normalized.encode("ascii", "ignore").decode()))


def record_name(name):
    return words(re.split(r"[（(—]", name, maxsplit=1)[0])


def index_matches(doc, base, records):
    by_family = defaultdict(list)
    for row in records:
        name = record_name(row["name"])
        if len(name) > 1 and len(name[-1]) > 1:
            by_family[name[-1]].append((name, row))
    seen = set()
    matches = []
    notices = 0
    for anchor in doc.xpath("//a[@href]"):
        url = urljoin(base, anchor.attrib["href"])
        info = urlsplit(url)
        if info.hostname != urlsplit(base).hostname or not info.path.startswith("/deptfiles/") or url in seen:
            continue
        seen.add(url)
        filename = unquote(info.path.rsplit("/", 1)[-1])
        stem = words(Path(filename).stem)
        marker = re.search(r"thesis|dissertat|defen[sc]e", filename, re.IGNORECASE)
        if not marker or Path(filename).suffix.casefold() not in {".pdf", ".jpg", ".png", ".jpeg"}:
            continue
        notices += 1
        stem_counts = Counter(stem)
        candidates = []
        for family in set(stem) & by_family.keys():
            for name, row in by_family[family]:
                given_and_family = not (Counter((name[0], name[-1])) - stem_counts)
                candidates.append({"name_match": "given_and_family" if given_and_family else "family_only", **row})
        if candidates:
            matches.append({"filename": filename, "url": url,
                            "candidates": sorted(candidates, key=lambda item: (item["name_match"] != "given_and_family",
                                                                              item["unit"], item["name"]))})
    return notices, matches


def main():
    parser = argparse.ArgumentParser(description="Match public Wisconsin Chemistry defense filenames to the local PI list.")
    parser.add_argument("index", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    base = "https://www2.chem.wisc.edu/deptfiles/"
    with sqlite3.connect("file:检索队列.sqlite?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        records = [dict(row) for row in db.execute("SELECT id, name, unit FROM records ORDER BY name, id")]
    doc = html.fromstring(args.index.read_bytes())
    notices, matches = index_matches(doc, base, records)
    if not notices:
        raise ValueError("The supplied HTML did not contain defense notice links.")
    out = {"catalogue": base, "school_records": len(records), "notice_files": notices, "matches": matches,
           "scope": "Filename matches only. Confirm the notice contents and the graduate's identity before adding a relationship."}
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"notices": notices, "matching_files": len(matches), "full_name_files": sum(
        any(row["name_match"] == "given_and_family" for row in item["candidates"]) for item in matches)}))


if __name__ == "__main__":
    main()
