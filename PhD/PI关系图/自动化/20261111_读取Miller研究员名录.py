import hashlib
import html
import json
import re
from pathlib import Path

source = Path("20261111_Miller全部研究员原页.html")
raw = source.read_bytes()
text = raw.decode("utf-8")
rows = re.findall(r'<tr class="(?:altRowColor|rowColor)">(.*?)</tr>\s*<tr>(.*?)</tr>', text, re.DOTALL)
entries = []
for person_row, term_row in rows:
    strong = re.search(r"<strong>(.*?)</strong>", person_row, re.DOTALL)
    if strong is None:
        raise ValueError("A roster row is missing its name")
    label = html.unescape(re.sub(r"<[^>]+>", " ", strong[1]))
    label = " ".join(label.split())
    last, separator, first = label.partition(",")
    term = html.unescape(re.sub(r"<[^>]+>", " ", term_row))
    term = " ".join(term.split())
    if not separator or re.search(r"Miller (?:Postdoctoral )?Fellow", term) is None:
        raise ValueError(f"Unrecognized roster entry: {label}, {term}")
    link = re.search(r'<a href="([^"]+)"', strong[1])
    entries.append({
        "name": f"{first.strip()} {last.strip()}",
        "source": "https://millermembers.berkeley.edu/all.php?nav=46",
        "official_name": label,
        "term": term,
        "profile_link": html.unescape(link[1]) if link else None,
    })
expected = len(re.findall(r'<tr class="(?:altRowColor|rowColor)">', text))
if len(entries) != expected:
    raise ValueError(f"Expected {expected} roster entries, parsed {len(entries)}")
result = {
    "program": "Miller Institute official all Miller Fellows roster",
    "source_sha256": hashlib.sha256(raw).hexdigest(),
    "entries": entries,
}
Path("20261111_Miller历届研究员名录.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"entries": len(entries), "source_sha256": result["source_sha256"]}))
