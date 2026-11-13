import argparse
import hashlib
import json
import sys
from contextlib import closing
from pathlib import Path

from pypdf import PdfReader


def main():
    parser = argparse.ArgumentParser(description="读取本地 PDF 的指定页和文件指纹，供师承人工核查。")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--pages", type=int, nargs="+", help="PDF 页码，从 1 开始。默认读取前 8 页。")
    parser.add_argument("--pdfium", action="store_true", help="旧 PDF 文本层返回字体编码时，改用 PDFium 读取。")
    args = parser.parse_args()

    with args.pdf.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
        stream.seek(0)
        reader = PdfReader(stream)
        total = len(reader.pages)
        pages = list(dict.fromkeys(args.pages)) if args.pages else list(range(1, min(total, 8) + 1))
        if any(number < 1 or number > total for number in pages):
            parser.error(f"页码须在 1 到 {total} 之间。")
        if args.pdfium:
            try:
                from pypdfium2 import PdfDocument
            except ImportError:
                parser.error("--pdfium 需要当前 Python 环境提供 pypdfium2。")
            with PdfDocument(args.pdf) as document:
                texts = []
                for number in pages:
                    with closing(document[number - 1]) as page:
                        with closing(page.get_textpage()) as text_page:
                            texts.append(text_page.get_text_bounded())
        else:
            texts = [reader.pages[number - 1].extract_text() for number in pages]

        evidence = []
        for number, text in zip(pages, texts):
            extracted = (text or "").strip()
            evidence.append({"pdf_page": number, "text_layer_available": bool(extracted), "text": extracted})

    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"file": args.pdf.name, "sha256": digest, "total_pages": total, "pages": evidence}, ensure_ascii=False))


if __name__ == "__main__":
    main()
