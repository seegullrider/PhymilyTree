import hashlib
import json
import sys
from bisect import bisect_right
from pathlib import Path

import pdfplumber

SOURCE = "https://www.ipcms.fr/uploads/2021/02/Theses_pour-le-web_040918.pdf"
COLUMNS = (105, 303, 375, 490, 564, 622, 698)


def extract_catalog(pdf_path):
    entries, unparsed = [], []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            rules = []
            for top in sorted(edge["top"] for edge in page.horizontal_edges if edge["width"] > 700):
                if not rules or top - rules[-1] > 1:
                    rules.append(top)
            words = page.extract_words()
            for top, bottom in zip(rules, rules[1:]):
                cells = [[] for _ in range(8)]
                for word in words:
                    center = (word["top"] + word["bottom"]) / 2
                    if top < center < bottom:
                        cells[bisect_right(COLUMNS, word["x0"])].append(word["text"])
                if not any(cells):
                    continue
                name, title, year, degree, specialty, university, advisor, lab = map(" ".join, cells)
                row = dict(name=name, title=title, year=year, degree=degree, specialty=specialty,
                           affiliation=university, listed_advisor=advisor, lab=lab, page=page.page_number,
                           url=f"{SOURCE}#page={page.page_number}", description=year + " · " + title)
                if name and title and "," in name:
                    entries.append(row)
                    continue
                parts = name.split()
                if title and len(parts) >= 2:
                    # The printed names without a comma use mixed conventions.
                    # Keep both the original and every possible family/given split as leads.
                    row["aliases"] = [
                        " ".join(parts[:i]) + ", " + " ".join(parts[i:])
                        for i in range(1, len(parts))
                    ]
                    row["name_order_uncertain"] = True
                    entries.append(row)
                else:
                    unparsed.append(row)
        pages = len(pdf.pages)
    return {
        "source": SOURCE,
        "title": "Thèses et Habilitations à Diriger de Recherches disponibles à la Bibliothèque de l'IPCMS",
        "pdf_sha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
        "pdf_pages": pages,
        "scope": "Local PDF row and column extraction. Catalog inclusion, institution, degree and adviser must be checked on each matching original page.",
        "entries": entries,
        "unparsed_nonempty_rows": unparsed,
    }


if __name__ == "__main__":
    input_path, output_path = map(Path, sys.argv[1:])
    result = extract_catalog(input_path)
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"pages": result["pdf_pages"], "entries": len(result["entries"]),
                      "unparsed": len(result["unparsed_nonempty_rows"])}))
