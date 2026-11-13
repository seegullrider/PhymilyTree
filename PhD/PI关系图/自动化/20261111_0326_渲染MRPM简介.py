import pypdfium2 as pdfium
from pathlib import Path
p=Path(r"C:/Users/32187/.codex/visualizations/2026/11/01/01a19844-0920-7d62-8e33-7e52115a2a23/20261111_MRPM15.pdf")
d=pdfium.PdfDocument(str(p))
for n in [23,50]:
 d[n-1].render(scale=1.5).to_pil().save(p.with_name("20261111_MRPM15_p"+str(n)+".png"))
 print(n)
