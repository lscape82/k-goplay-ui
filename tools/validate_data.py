#!/usr/bin/env python3
"""Validate generated static data and write data-quality reports."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"

ALLOWED_CATEGORIES = {
    "large_billboard",
    "shopping_mall_did",
    "subway",
    "bus",
    "transport_hub",
    "daily_touchpoint",
    "package",
    "other",
}


def load_json(name: str):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def add(issues: list[dict], level: str, item_type: str, slug: str, message: str) -> None:
    issues.append({"level": level, "type": item_type, "slug": slug, "message": message})


def has_price_text(raw: str) -> bool:
    return bool(re.search(r"\d|만원|억원", raw or ""))


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    media = load_json("media.json")
    areas = load_json("areas.json")
    guides = load_json("guides.json")
    issues: list[dict] = []

    media_slugs = [item.get("slug") for item in media]
    area_slugs = [item.get("slug") for item in areas]
    area_slug_set = set(area_slugs)

    for slug, count in Counter(media_slugs).items():
        if count > 1:
            add(issues, "error", "media", slug or "", "media slug 중복")
    for slug, count in Counter(area_slugs).items():
        if count > 1:
            add(issues, "error", "area", slug or "", "area slug 중복")

    for area in areas:
        slug = area.get("slug", "")
        if not area.get("name"):
            add(issues, "error", "area", slug, "지역명 누락")
        if not area.get("sourcePages"):
            add(issues, "error", "area", slug, "sourcePages 누락")
        if area.get("needsReview") and not area.get("dataQualityNote"):
            add(issues, "error", "area", slug, "needsReview true이나 dataQualityNote 비어 있음")

    for item in media:
        slug = item.get("slug", "")
        if item.get("areaSlug") not in area_slug_set:
            add(issues, "error", "media", slug, f"areaSlug가 areas에 없음: {item.get('areaSlug')}")
        if not item.get("name"):
            add(issues, "error", "media", slug, "매체명 누락")
        if not item.get("sourcePages"):
            add(issues, "error", "media", slug, "sourcePages 누락")
        if item.get("category") not in ALLOWED_CATEGORIES:
            add(issues, "error", "media", slug, f"허용되지 않은 category: {item.get('category')}")
        if not item.get("operationHours"):
            add(issues, "error", "media", slug, "operationHours 누락")
        elif item.get("operationHours") == "상세 정보 확인" and not item.get("needsReview"):
            add(issues, "error", "media", slug, "operationHours 상세 정보 확인인데 needsReview false")
        if not item.get("address"):
            add(issues, "error", "media", slug, "주소 누락")
        if item.get("needsReview") and not item.get("dataQualityNote"):
            add(issues, "error", "media", slug, "needsReview true이나 dataQualityNote 비어 있음")

        for row in item.get("pricing", []):
            for key, value in row.items():
                if key.endswith("KRW") and value is not None and value < 0:
                    add(issues, "error", "pricing", slug, f"{key}가 음수")
            numeric_values = [
                row.get(key)
                for key in (
                    "monthlyPriceKRW",
                    "price15DaysKRW",
                    "price10DaysKRW",
                    "price7DaysKRW",
                    "price5DaysKRW",
                    "price3DaysKRW",
                    "price1DayKRW",
                )
            ]
            raw = row.get("rawText", "")
            has_any_number = any(value is not None for value in numeric_values)
            if has_price_text(raw) and not has_any_number and not (row.get("needsReview") or item.get("needsReview")):
                add(issues, "error", "pricing", slug, "가격 원문이 있으나 숫자 변환 실패 및 needsReview 미표시")

    report = {
        "summary": {
            "mediaCount": len(media),
            "areaCount": len(areas),
            "guideCount": len(guides),
            "issueCount": len(issues),
            "errorCount": sum(1 for issue in issues if issue["level"] == "error"),
            "needsReviewMediaCount": sum(1 for item in media if item.get("needsReview")),
            "needsReviewAreaCount": sum(1 for item in areas if item.get("needsReview")),
        },
        "issues": issues,
    }
    (DATA_DIR / "data-quality-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        "# 데이터 품질 리포트",
        "",
        f"- 매체 수: {report['summary']['mediaCount']}",
        f"- 지역 수: {report['summary']['areaCount']}",
        f"- 가이드 수: {report['summary']['guideCount']}",
        f"- 검수 필요 매체 수: {report['summary']['needsReviewMediaCount']}",
        f"- 검수 필요 지역 수: {report['summary']['needsReviewAreaCount']}",
        f"- 검증 이슈 수: {report['summary']['issueCount']}",
        "",
        "## 검증 결과",
    ]
    if issues:
        for issue in issues:
            lines.append(f"- [{issue['level']}] {issue['type']} `{issue['slug']}`: {issue['message']}")
    else:
        lines.append("- 오류 없음")
    lines.extend(
        [
            "",
            "## 검수 필요 항목 기준",
            "",
            "- PDF 원문에 가격 조건이 복수로 병기된 경우",
            "- OCR 또는 텍스트 추출 오류로 보이는 가격이 있는 경우",
            "- 요약 표에만 있고 운영시간·규격이 별도 확인 필요한 경우",
            "- 지역 단위 수치가 대표값으로만 제공된 경우",
        ]
    )
    (DOCS_DIR / "data-quality-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
