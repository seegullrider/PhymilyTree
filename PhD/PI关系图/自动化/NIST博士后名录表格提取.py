"""Extract the named fellow and advisor columns from NIST SP 955, Appendix F."""
import argparse
from collections import defaultdict
from contextlib import closing
from ctypes import byref, c_double
import json
from pathlib import Path
import re
import unicodedata

from pypdfium2 import PdfDocument, raw

SOURCE = "https://www.nist.gov/system/files/documents/nvl/SP955_Suppl_08_Appendix_F.pdf"
LAYOUTS = (
    (8, (73, 154, 268, 370, 448, 592), ("fellow", "phd_institution", "phd_field", "advisor", "laboratory", "division")),
    (20, (73, 223, 355, 565), ("fellow", "advisor", "laboratory", "division")),
    (24, (73, 169, 312, 415, 592), ("fellow", "phd_institution", "advisor", "laboratory", "division")),
)
NICKNAMES = {
    "alex": ("alexander", "alexandra"),
    "ben": ("benjamin",),
    "bill": ("william",),
    "bob": ("robert",),
    "chris": ("christopher", "christine"),
    "dan": ("daniel",),
    "dave": ("david",),
    "ed": ("edward", "edwin", "edmund"),
    "jeff": ("jeffrey", "jeffery"),
    "jim": ("james",),
    "joe": ("joseph",),
    "mike": ("michael",),
    "pat": ("patrick", "patricia"),
    "rich": ("richard",),
    "steve": ("steven", "stephen"),
    "tom": ("thomas",),
}

def name_key(name):
    label = re.split(r"[（(—]", name, maxsplit=1)[0]
    normalized = unicodedata.normalize("NFKD", label)
    normalized = "".join(c for c in normalized if not unicodedata.combining(c))
    normalized = re.sub(r"(?<=\w)['’\ufffd](?=\w)", "", normalized)
    return tuple(word for word in re.findall(r"[a-z]+", normalized.lower()) if len(word) > 1)

def read_rows(pdf_path):
    entries, unparsed = [], []
    period = ""
    with closing(PdfDocument(pdf_path)) as document:
        if len(document) != 24:
            raise ValueError("Expected the 24-page NIST Appendix F.")
        for page_number in range(2, len(document) + 1):
            _, starts, columns = next(layout for layout in LAYOUTS if page_number <= layout[0])
            # In the sideways table, the baseline X groups one row and Y advances through its columns.
            lines = defaultdict(list)
            with closing(document[page_number - 1]) as page, closing(page.get_textpage()) as text:
                for index in range(text.count_chars()):
                    char = chr(raw.FPDFText_GetUnicode(text, index))
                    if not char.isprintable():
                        continue
                    x, y = c_double(), c_double()
                    if raw.FPDFText_GetCharOrigin(text, index, byref(x), byref(y)) and x.value > 110 and y.value >= 71:
                        lines[round(x.value, 2)].append((y.value, char))
            for row, chars in sorted(lines.items()):
                cells = [""] * len(columns)
                for advance, char in sorted(chars, key=lambda item: item[0]):
                    column = max(i for i, start in enumerate(starts) if advance >= start - 2)
                    cells[column] += char
                entry = dict(zip(columns, (cell.strip() for cell in cells)))
                name = entry["fellow"]
                if re.match(r"^(?:19|20)\d{2}\b", name):
                    period = name
                    continue
                if not name or not entry["advisor"]:
                    unparsed.append({"pdf_page": page_number, "baseline": row, **entry})
                    continue
                entries.append({"pdf_page": page_number, "period_as_printed": period, **entry})
    berry = [e for e in entries if e["fellow"] == "Joseph Berry"]
    if len(berry) != 1 or berry[0]["advisor"] != "Norman Sanford" or berry[0]["pdf_page"] != 10:
        raise ValueError("Joseph Berry control row did not match the inspected original.")
    return entries, unparsed

def cross_match(entries, manifest):
    people = defaultdict(list)
    for node in manifest["nodes"]:
        key = name_key(node["name"])
        if len(key) < 2:
            continue
        bases = [(key[0], "first_last")]
        bases.extend((alias, "nickname_first_last") for alias in NICKNAMES.get(key[0], ()))
        for first, method in bases:
            people[(first, key[-1])].append({
                "id": node["id"], "name": node["name"], "unit": node["unit"], "match_method": method,
            })
    matches = []
    for entry in entries:
        key = name_key(entry["fellow"])
        if len(key) < 2:
            continue
        candidates = people.get((key[0], key[-1]), [])
        if candidates:
            matches.append({**entry, "candidates": candidates})
    return matches

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("appendix", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    entries, unparsed = read_rows(args.appendix)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    matches = cross_match(entries, manifest)
    result = {
        "source": SOURCE,
        "school_records": len(manifest["nodes"]),
        "extracted_rows": len(entries),
        "not_matched_as_rows": unparsed,
        "matches": matches,
        "entries": entries,
        "policy": "Only fellow names generate matches. Candidate records require manual identity and stage review.",
    }
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rows": len(entries), "unparsed_lines": len(unparsed), "matched_rows": len(matches)}))
