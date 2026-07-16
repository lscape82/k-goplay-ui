# -*- coding: utf-8 -*-
"""
build-media-pages.py — 매체 카탈로그(글자 목록) + 매체별 상세 페이지 생성 데모.
- media-catalog.html : 크롤 가능한 '글자 매체 목록' (지도 옆/아래에 붙일 그 목록). 각 매체 → 상세로 링크.
- media-<slug>.html  : 매체 상세. Place + Product/Offer(가격) + FAQPage 스키마.
데모용으로 15개만 생성(실제로는 media.json 513개 전부 가능).
"""
import os, json, html
os.chdir(r"C:/goplay/k-goplay-ui")
SRC = r"C:/Users/lscap/AppData/Local/Temp/claude/C--goplay-k-goplay-ui/5eef989c-a26f-4928-bc94-3ddaa95bbea4/scratchpad/media_sample.json"
BASE = "https://lscape82.github.io/k-goplay-ui"
LOGO = f"{BASE}/assets/images/k-goplay-logo-new.png"

CAT = {
  "large_billboard": "대형 전광판",
  "shopping_mall_did": "쇼핑몰 DID",
  "transport_hub": "도시 철도·버스·터미널",
  "bus": "버스·쉘터",
  "package": "패키지",
  "subway": "지하철",
  "other": "기타",
}
CAT_ORDER = ["large_billboard","shopping_mall_did","transport_hub","bus","package","subway","other"]

def esc(s): return html.escape(str(s or ""), quote=True)

def won(v):
    if not v: return "상담"
    v=int(v)
    if v>=100000000:
        e=v/100000000
        return (f"{e:.1f}".rstrip("0").rstrip("."))+"억원"
    return f"{round(v/10000):,}만원"

items = json.load(open(SRC, encoding="utf-8"))

CSS = """
 body{margin:0;background:#fff;font-family:system-ui,-apple-system,sans-serif;color:#1c1c1c}
 .hd{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;z-index:10}
 .hd .mk{background:#111;color:#fff;font:800 13px/1 sans-serif;border-radius:8px;padding:6px 9px}
 .hd strong{font:800 16px/1 system-ui}
 .hd nav{margin-left:auto;display:flex;gap:16px}
 .hd a{color:#333;text-decoration:none;font:600 14px/1 system-ui}
 .wrap{max-width:900px;margin:0 auto;padding:22px 18px 90px}
 .bc{font:13px/1.6 system-ui;color:#8a8a8a;margin:0 0 8px}
 .bc a{color:#8a8a8a;text-decoration:none}
 h1{font:800 27px/1.35 system-ui;margin:6px 0 8px}
 .lead{font:16px/1.75 system-ui;color:#2a2a2a;margin:0 0 18px}
 h2{font:800 19px/1.4 system-ui;margin:26px 0 10px}
 h2 .c{color:#c0246f}
 table.t{border-collapse:collapse;width:100%;font:14px/1.6 system-ui;margin:0 0 6px}
 table.t th,table.t td{border:1px solid #e8e8e8;padding:10px 12px;text-align:left}
 table.t th{background:#faf7f9;font-weight:700;white-space:nowrap;color:#333;width:130px}
 /* 카탈로그 목록 */
 .cat-group{margin:0 0 22px}
 ul.mlist{list-style:none;margin:0;padding:0;border-top:1px solid #eee}
 ul.mlist li{border-bottom:1px solid #eee;padding:12px 4px;display:flex;justify-content:space-between;gap:12px;align-items:baseline}
 ul.mlist a{color:#161616;text-decoration:none;font:700 15px/1.5 system-ui}
 ul.mlist a:hover{color:#c0246f}
 ul.mlist .addr{color:#777;font:13px/1.5 system-ui;font-weight:400}
 ul.mlist .price{color:#c0246f;font:700 14px/1 system-ui;white-space:nowrap}
 .cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
 .cta a{display:inline-block;font:700 15px/1 system-ui;padding:14px 22px;border-radius:11px;text-decoration:none}
 .cta .p{background:#c0246f;color:#fff}.cta .s{background:#f2f2f2;color:#222}
 .faq details{border-bottom:1px solid #eee;padding:12px 2px}
 .faq summary{font:700 15px/1.5 system-ui;cursor:pointer}
 .faq p{margin:8px 0 0;font:14px/1.7 system-ui;color:#333}
 .note{font:12px/1.6 system-ui;color:#9a9a9a;margin-top:8px}
"""

def head(title, desc, canon, extra_ld=""):
    return f"""<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canon}">
<link rel="stylesheet" href="assets/css/styles.css">
{extra_ld}
<style>{CSS}</style></head><body>
<header class="hd"><span class="mk">AD</span><strong>광고플레이</strong>
<nav><a href="media-catalog.html">전체 매체</a><a href="map.html">지도</a><a href="insights.html">가이드</a><a href="estimate.html">견적</a></nav></header>"""

def detail(x):
    name=x["name"]; slug=x["slug"]; cat=CAT.get(x.get("category"),"매체")
    price_rows=""
    for r in (x.get("pricing") or []):
        price_rows+=f"<tr><td>{esc(r.get('label') or r.get('rawText') or '-')}</td><td>{won(r.get('monthlyPriceKRW'))}/월</td><td>{esc(r.get('rawText') or '')}</td></tr>"
    if not price_rows: price_rows="<tr><td colspan='3'>상담 시 안내</td></tr>"
    spec=[("매체 유형",x.get("mediaType") or cat),("위치",x.get("address")),
          ("규격",x.get("sizeText") or (f"{x.get('widthM')}m × {x.get('heightM')}m" if x.get("widthM") else "상담")),
          ("해상도",x.get("resolutionPx") or "상담 시 안내"),("운영시간",x.get("operationHours") or "상담 시 안내")]
    spec_rows="".join(f"<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>" for a,b in spec if b)
    minp=x.get("minPrice")
    faqs=[(f"{name} 광고 비용은 얼마인가요?", f"월 {won(minp)}부터이며(VAT 별도), 기간·소재에 따라 달라집니다. 정확한 비용은 상담 시 확정됩니다."),
          (f"{name}은 어디에 있나요?", f"{x.get('address') or '서울'}에 위치한 {cat} 매체입니다."),
          ("단기 집행도 가능한가요?", "네, 매체에 따라 1일 단위부터 집행할 수 있습니다.")]
    faq_html="".join(f"<details{' open' if i==0 else ''}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>" for i,(q,a) in enumerate(faqs))
    ld=[
      {"@context":"https://schema.org","@type":"Product","name":f"{name} 옥외광고","category":"옥외광고 매체",
       "description":f"{x.get('exposureShort') or name} — {cat} 옥외광고 매체","brand":{"@type":"Organization","name":"광고플레이"},
       "offers":{"@type":"Offer","priceCurrency":"KRW","price":int(minp) if minp else 0,
                 "availability":"https://schema.org/InStock",
                 "priceSpecification":{"@type":"UnitPriceSpecification","price":int(minp) if minp else 0,"priceCurrency":"KRW","unitText":"월"},
                 "seller":{"@type":"Organization","name":"광고플레이","url":f"{BASE}/"}}},
      {"@context":"https://schema.org","@type":"Place","name":name,
       "address":{"@type":"PostalAddress","streetAddress":x.get("address") or "","addressLocality":"서울","addressCountry":"KR"}},
      {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
      {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"홈","item":f"{BASE}/"},
        {"@type":"ListItem","position":2,"name":"전체 매체","item":f"{BASE}/media-catalog.html"},
        {"@type":"ListItem","position":3,"name":name,"item":f"{BASE}/media-{slug}.html"}]},
    ]
    ld_html="\n".join(f'<script type="application/ld+json">{json.dumps(o,ensure_ascii=False)}</script>' for o in ld)
    desc=f"{name}({cat}) 옥외광고 매체 — 위치 {x.get('address') or '서울'}, 월 {won(minp)}부터. 규격·광고비·집행 안내."
    return head(f"{name} 옥외광고 매체 – 위치·광고비 | 광고플레이", desc, f"{BASE}/media-{slug}.html", ld_html)+f"""
<main class="wrap">
<p class="bc"><a href="index.html">홈</a> › <a href="media-catalog.html">전체 매체</a> › {esc(name)}</p>
<h1>{esc(name)} 옥외광고 매체</h1>
<p class="lead">{esc(x.get('exposureShort') or name)} · <b>{esc(cat)}</b> · 월 <b>{won(minp)}</b>부터(VAT 별도)</p>
<h2>매체 규격·위치</h2>
<table class="t">{spec_rows}</table>
<h2><span class="c">광고비</span> (VAT 별도)</h2>
<table class="t"><tr><th style="width:auto">소재</th><th style="width:auto">월 광고비</th><th style="width:auto">비고</th></tr>{price_rows}</table>
<p class="note">표기 광고비는 참고가이며, 최종 비용·구좌 가능 여부는 상담 시 확인이 필요합니다.</p>
<h2>자주 묻는 질문</h2>
<div class="faq">{faq_html}</div>
<div class="cta"><a class="p" href="estimate.html">이 매체로 견적 문의</a><a class="s" href="map.html">지도에서 위치 보기</a><a class="s" href="media-catalog.html">← 전체 매체 목록</a></div>
</main></body></html>"""

def catalog(items):
    groups={}
    for x in items: groups.setdefault(x.get("category"),[]).append(x)
    sec=""
    for c in CAT_ORDER:
        if c not in groups: continue
        lis=""
        for x in groups[c]:
            lis+=f'<li><span><a href="media-{esc(x["slug"])}.html">{esc(x["name"])}</a> <span class="addr">{esc(x.get("address") or "")}</span></span><span class="price">월 {won(x.get("minPrice"))}~</span></li>'
        sec+=f'<div class="cat-group"><h2><span class="c">{esc(CAT.get(c,c))}</span></h2><ul class="mlist">{lis}</ul></div>'
    ld={"@context":"https://schema.org","@type":"ItemList","name":"광고플레이 옥외광고 매체 목록",
        "itemListElement":[{"@type":"ListItem","position":i+1,"name":x["name"],"url":f"{BASE}/media-{x['slug']}.html"} for i,x in enumerate(items)]}
    ld_html=f'<script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script>'
    return head("전체 옥외광고 매체 목록 – 전광판·쇼핑몰·교통 | 광고플레이",
                "광고플레이가 운영하는 전국 옥외광고 매체 목록입니다. 대형 전광판·쇼핑몰 DID·교통 매체의 위치와 월 광고비를 한눈에 비교하세요.",
                f"{BASE}/media-catalog.html", ld_html)+f"""
<main class="wrap">
<p class="bc"><a href="index.html">홈</a> › 전체 매체</p>
<h1>전체 옥외광고 매체 목록</h1>
<p class="lead">광고플레이가 운영하는 전국 옥외광고 매체입니다. 매체명을 누르면 위치·규격·광고비 상세를 볼 수 있습니다. <b>(이 목록은 글자로 되어 있어 네이버·AI 봇도 그대로 읽습니다.)</b></p>
{sec}
<p class="note">데모: 15개 표시. 실제로는 media.json의 513개 매체 전부 자동 생성됩니다.</p>
<div class="cta"><a class="p" href="map.html">지도에서 보기</a><a class="s" href="estimate.html">견적 문의</a></div>
</main></body></html>"""

def main():
    for x in items:
        open(f"media-{x['slug']}.html","w",encoding="utf-8").write(detail(x))
    open("media-catalog.html","w",encoding="utf-8").write(catalog(items))
    print("생성: media-catalog.html +", len(items), "개 상세 (media-<slug>.html)")

if __name__=="__main__":
    main()
