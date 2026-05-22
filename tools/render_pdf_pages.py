#!/usr/bin/env python3
"""Render PDF pages to compressed JPEG images for static media thumbnails."""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_PDF = ROOT / "source" / "adplay-dooh.pdf"
OUT_DIR = ROOT / "assets" / "images" / "pdf-pages"


def find_pdf() -> Path:
    if SOURCE_PDF.exists():
        return SOURCE_PDF
    pdfs = sorted(ROOT.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError("No PDF file found.")
    preferred_keywords = ("매체정보", "DOOH", "도산", "삼성")
    for pdf in pdfs:
        if any(keyword in pdf.name for keyword in preferred_keywords):
            return pdf
    return pdfs[0]


def page_count(pdf_path: Path) -> int:
    result = subprocess.run(["pdfinfo", str(pdf_path)], text=True, capture_output=True, check=True)
    for line in result.stdout.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise RuntimeError("Could not read page count.")


def compress_jpeg(path: Path, max_width: int = 1200) -> None:
    with Image.open(path) as image:
        image = image.convert("RGB")
        if image.width > max_width:
            ratio = max_width / image.width
            image = image.resize((max_width, int(image.height * ratio)), Image.Resampling.LANCZOS)
        image.save(path, "JPEG", quality=78, optimize=True, progressive=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Render all pages.")
    parser.add_argument("--pages", default="", help="Comma-separated page numbers.")
    parser.add_argument("--dpi", type=int, default=120)
    args = parser.parse_args()

    pdf_path = find_pdf()
    total = page_count(pdf_path)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_dir = OUT_DIR / "_tmp"
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir()

    if args.all:
        pages = list(range(1, total + 1))
    elif args.pages:
        pages = sorted({int(item.strip()) for item in args.pages.split(",") if item.strip()})
    else:
        pages = [1, 2, 3, 7, 9, 10, 11, 12, 13, 14, 18, *range(19, 38), 39, *range(40, 51), 52]

    rendered = 0
    for page in pages:
        if page < 1 or page > total:
            continue
        prefix = tmp_dir / f"page-{page:03d}"
        subprocess.run(
            [
                "pdftoppm",
                "-jpeg",
                "-r",
                str(args.dpi),
                "-f",
                str(page),
                "-l",
                str(page),
                str(pdf_path),
                str(prefix),
            ],
            check=True,
            capture_output=True,
        )
        matches = sorted(tmp_dir.glob(f"page-{page:03d}-*.jpg"))
        if not matches:
            continue
        final_path = OUT_DIR / f"page-{page:03d}.jpg"
        matches[0].replace(final_path)
        compress_jpeg(final_path)
        rendered += 1

    shutil.rmtree(tmp_dir)
    print(f"Rendered {rendered} pages to {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
