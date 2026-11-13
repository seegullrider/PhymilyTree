from pypdf import PdfReader
from pathlib import Path
import json,hashlib,sys
sys.stdout.reconfigure(encoding='utf-8')
p=Path(r"C:/Users/32187/.codex/visualizations/2026/11/01/01a19844-0920-7d62-8e33-7e52115a2a23/20261111_MRPM15.pdf")
r=PdfReader(p)
hits=[]
for n,page in enumerate(r.pages,1):
 t=page.extract_text() or ""
 if "Yue Wu" in t or "Stesmans" in t or "Pines" in t:
  hits.append({"pdf_page":n,"text":t})
out={"source":"https://www.ampere-society.org/books/MRPM15.pdf","sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"pages":len(r.pages),"hits":hits}
Path("20261111_MRPM15人物原文.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
print(json.dumps(out,ensure_ascii=False))
