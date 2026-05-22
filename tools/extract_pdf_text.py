#!/usr/bin/env python3
"""Extract page-level text from the first relevant PDF into data/pdf_pages_text.json."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SOURCE_PDF = ROOT / "source" / "adplay-dooh.pdf"


def find_pdf() -> Path:
    if SOURCE_PDF.exists():
        return SOURCE_PDF

    pdfs = sorted(ROOT.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError("No PDF file found in project root.")

    preferred_keywords = ("매체정보", "DOOH", "도산", "삼성")
    for pdf in pdfs:
        if any(keyword in pdf.name for keyword in preferred_keywords):
            return pdf
    return pdfs[0]


def page_count(pdf_path: Path) -> int:
    result = subprocess.run(
        ["pdfinfo", str(pdf_path)],
        check=True,
        text=True,
        capture_output=True,
    )
    for line in result.stdout.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise RuntimeError("Could not read page count from pdfinfo.")


def extract_page(pdf_path: Path, page_number: int) -> str:
    result = subprocess.run(
        [
            "pdftotext",
            "-layout",
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            str(pdf_path),
            "-",
        ],
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip("\f\n ")


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pdf_path = find_pdf()
    total_pages = page_count(pdf_path)
    pages = []

    for page_number in range(1, total_pages + 1):
        try:
            text = extract_page(pdf_path, page_number)
            error = ""
        except Exception as exc:  # pragma: no cover - diagnostic path
            text = ""
            error = str(exc)
        pages.append(
            {
                "page": page_number,
                "text": text,
                "charCount": len(text),
                "needsReview": len(text.strip()) == 0,
                "error": error,
            }
        )

    output = {
        "sourcePdf": str(pdf_path.relative_to(ROOT)),
        "pageCount": total_pages,
        "pages": pages,
    }
    (DATA_DIR / "pdf_pages_text.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Extracted {total_pages} pages to data/pdf_pages_text.json")


if __name__ == "__main__":
    main()
