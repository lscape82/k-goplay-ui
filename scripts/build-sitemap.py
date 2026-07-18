# -*- coding: utf-8 -*-
"""
build-sitemap.py — sitemap.xml 자동 생성.
봇에게 "우리 사이트에 이런 페이지가 있다"고 알려주는 목록 파일.
매체 상세(media-m-*.html)·가이드(insight-*.html)를 자동 수집하므로,
페이지를 새로 만들면 이 스크립트만 다시 돌리면 됩니다.
"""
import os, glob

os.chdir(r"C:/goplay/k-goplay-ui")
BASE = "https://lscape82.github.io/k-goplay-ui"
TODAY = "2026-07-13"

# (파일, 우선순위, 갱신주기) — 우선순위: 1.0 최상 ~ 0.5 낮음
FIXED = [
    ("", "1.0", "weekly"),                    # 홈
    ("map.html", "0.9", "weekly"),            # 지도
    ("media-catalog.html", "0.9", "weekly"),  # 옥외광고 매체 목록
    ("about.html", "0.8", "monthly"),         # 회사소개
    ("insights.html", "0.8", "weekly"),       # 광고 인사이트
    ("elevator.html", "0.9", "weekly"),       # 엘리베이터 광고 허브 — 매체 10,247곳으로 최대 자산
    ("media.html", "0.7", "weekly"),
    ("areas.html", "0.6", "monthly"),
    ("estimate.html", "0.6", "monthly"),
]

# 관리자/도구/데모 등 색인 제외
EXCLUDE = {
    "media-management.html", "geocode.html", "login.html", "join.html",
    "guides.html", "guide-detail.html", "media-detail.html", "area-detail.html",
    "bus-shelter-map-260622.html", "seo-demo-a.html", "seo-demo-b.html",
}

def url_block(loc, pr, freq):
    return (f"  <url>\n    <loc>{loc}</loc>\n    <lastmod>{TODAY}</lastmod>\n"
            f"    <changefreq>{freq}</changefreq>\n    <priority>{pr}</priority>\n  </url>")

def main():
    seen, blocks = set(), []

    for f, pr, freq in FIXED:
        if f and (not os.path.exists(f) or f in EXCLUDE):
            continue
        loc = f"{BASE}/{f}" if f else f"{BASE}/"
        seen.add(f)
        blocks.append(url_block(loc, pr, freq))

    # 가이드 글
    for f in sorted(glob.glob("insight-*.html")):
        if f in seen or f in EXCLUDE:
            continue
        seen.add(f)
        blocks.append(url_block(f"{BASE}/{f}", "0.7", "monthly"))

    # 엘리베이터 상품 상세 (elevator-*.html) — 허브는 위 FIXED 에 있음
    for f in sorted(glob.glob("elevator-*.html")):
        if f in seen or f in EXCLUDE:
            continue
        seen.add(f)
        blocks.append(url_block(f"{BASE}/{f}", "0.8", "monthly"))

    # 매체 상세 513개
    media = sorted(glob.glob("media-m-*.html"))
    for f in media:
        if f in seen or f in EXCLUDE:
            continue
        seen.add(f)
        blocks.append(url_block(f"{BASE}/{f}", "0.7", "monthly"))

    # 집행사례(생기면 자동 포함)
    for f in sorted(glob.glob("case-*.html")) + (["cases.html"] if os.path.exists("cases.html") else []):
        if f in seen or f in EXCLUDE:
            continue
        seen.add(f)
        blocks.append(url_block(f"{BASE}/{f}", "0.7", "monthly"))

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + "\n".join(blocks) + "\n</urlset>\n")
    open("sitemap.xml", "w", encoding="utf-8").write(xml)
    print(f"sitemap.xml 생성: 총 {len(blocks)}개 URL (매체 상세 {len(media)}개 포함)")

if __name__ == "__main__":
    main()
