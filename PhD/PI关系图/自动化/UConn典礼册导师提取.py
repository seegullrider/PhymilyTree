import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


ADVISOR = re.compile(r"(?m)^[ \t]*(?:Co[- ]?)?Major Advis[eo]rs?[ \t]*:[ \t]*")
DISSERTATION = re.compile(r"(?m)^[ \t]*Doctoral Dissertation[ \t]*:[ \t]*")
HEADER = re.compile(
    r"(?m)^[ \t]*(?P<name>[^\n,:]{3,90}?(?:,[ \t]*(?:Jr\.?|Sr\.?|II|III|IV))?)"
    r",?[ \t]+in(?:[ \t]+|[ \t]*\n[ \t]*)(?P<program>[A-Z][^\n]{1,125})"
)
NAME_WORD = re.compile(r"[^\W\d_][\w.'’‑\-]*", re.UNICODE)
FIELD_END = re.compile(
    r"\n[ \t]*(?:\n|(?:August|December|May) \d{1,2}, \d{4}\b)"
)
NAME_PARTICLES = {"al", "bin", "da", "de", "del", "den", "der", "di", "du", "la", "van", "von"}


def clean(text):
    return " ".join(text.split()).strip()


def looks_like_name(value):
    words = value.split()
    return (
        2 <= len(words) <= 10
        and words[0][0].isupper()
        and all(
            NAME_WORD.fullmatch(word) and (word[0].isupper() or word in NAME_PARTICLES)
            for word in words
        )
    )


def extract_page(text):
    headers = []
    for match in HEADER.finditer(text):
        name = clean(match.group("name").replace(",", " "))
        start = match.start()
        previous_lines = text[:start].rsplit("\n", 3)
        if len(previous_lines) >= 3 and not previous_lines[-3].strip():
            previous_line = previous_lines[-2]
            if looks_like_name(clean(previous_line)):
                # A wrapped name can precede the line containing the degree.
                candidate = clean(previous_line + " " + name)
                if looks_like_name(candidate):
                    start -= len(previous_line) + 1
                    name = candidate
        if looks_like_name(name):
            headers.append((match, start, name))
    for index, (match, _, name) in enumerate(headers):
        end = headers[index + 1][1] if index + 1 < len(headers) else len(text)
        block = text[match.end():end]
        advisors = list(ADVISOR.finditer(block))
        dissertations = list(DISSERTATION.finditer(block))
        if len(advisors) != 1 or len(dissertations) != 1:
            continue
        advisor, dissertation = advisors[0], dissertations[0]
        advisor_end = dissertation.start() if advisor.start() < dissertation.start() else len(block)
        advisor_text = clean(FIELD_END.split(block[advisor.end():advisor_end], maxsplit=1)[0])
        if len(advisor_text) > 160 or not advisor_text:
            continue
        program = clean(match.group("program") + " " + block[:min(advisor.start(), dissertation.start())])
        title_end = advisor.start() if dissertation.start() < advisor.start() else len(block)
        title = clean(FIELD_END.split(block[dissertation.end():title_end], maxsplit=1)[0])
        yield {
            "name": name,
            "program": program,
            "advisor_as_printed": advisor_text,
            "dissertation_as_extracted": title[:400],
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
    entries = []
    documents = []
    for source in manifest:
        path = Path(source["path"])
        if not path.is_file():
            documents.append({**source, "error": "No local source file"})
            continue
        with path.open("rb") as stream:
            fingerprint = hashlib.file_digest(stream, "sha256").hexdigest()
        pdf = PdfReader(path)
        before = len(entries)
        relevant_pages = 0
        printed_advisor_lines = 0
        for page_number, page in enumerate(pdf.pages, 1):
            text = page.extract_text() or ""
            if not ADVISOR.search(text) or not DISSERTATION.search(text):
                continue
            relevant_pages += 1
            printed_advisor_lines += len(ADVISOR.findall(text))
            for entry in extract_page(text):
                entries.append({
                    **entry,
                    "ceremony_year": source["year"],
                    "pdf_page": page_number,
                    "url": source["url"] + f"#page={page_number}",
                })
        documents.append({
            **source,
            "sha256": fingerprint,
            "pages": len(pdf.pages),
            "pages_with_role_and_dissertation": relevant_pages,
            "printed_advisor_lines": printed_advisor_lines,
            "extracted_entries": len(entries) - before,
        })
    result = {
        "source": "https://commencement.uconn.edu/history/",
        "title": "University of Connecticut commencement programs, 2019–2026",
        "documents": documents,
        "entries": entries,
        "scope": "Name and advisor associations from the printed program are leads. Verify each match and conferral against the source page.",
    }
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for doc in documents:
        print(doc["year"], doc.get("extracted_entries"), doc.get("printed_advisor_lines"), doc.get("error", ""))


if __name__ == "__main__":
    main()
