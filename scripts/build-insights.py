# -*- coding: utf-8 -*-
"""
build-insights.py — '옥외광고 가이드' 콘텐츠(전광판 인사이트) 정적 페이지 생성기.
PPTX(광고인사이트1) 실데이터 기반. 크롤 가능 HTML + Article/Place/FAQPage 스키마.
출력: insights.html(허브) + insight-<slug>.html(개별) — 기존 UI/지도 무변경, 새 페이지만 추가.
"""
import os, json, html
os.chdir(r"C:/goplay/k-goplay-ui")

BASE = "https://lscape82.github.io/k-goplay-ui"
PUB = "2026-07-08"
LOGO = f"{BASE}/assets/images/k-goplay-logo-new.png"
SRC_NOTE = ("데이터 출처 — 일평균 유동인구: 중소벤처기업부 빅데이터플랫폼 소상공인365"
            "(SKT 통신사 데이터 2025.10 기준, KT 미반영) · 지하철/버스 승하차: 서울시 열린데이터광장"
            "(2025.12 기준) · 교통량: 서울시 교통정보(2025.11 기준)")

ITEMS = [
  {
    "slug": "cheonggye",
    "name": "광화문 청계광장 전광판",
    "h1": "광화문 청계광장 전광판 광고 – 위치·광고비·유동인구 완전정리",
    "hero": "assets/images/insights/cheonggye-3.jpg",
    "heroAlt": "광화문 청계광장 전광판 광고 매체 – 청계광장 야경과 유동인구",
    "address": "서울시 종로구 청계천로 11",
    "size": "12.0m × 18.5m (세로형)",
    "res": "1,200 × 1,869 px",
    "hours": "06:00 ~ 24:00 (18시간)",
    "tags": ["청계광장", "고소득 직장인 유동", "관광특구", "축제", "광화문"],
    "summary": ("광화문 청계광장 전광판은 서울 종로구 청계천로 11에 위치한 12.0×18.5m 세로형 LED 매체로, "
                "반경 500m 일평균 유동인구 약 22.9만 명의 관광특구 한복판에 있습니다. 1일 20초 100회 기준 "
                "월 1,200만 원부터 집행 가능하며, 1일 단위 초단기 집행도 지원합니다."),
    "pricing": [
      ("1일 20초 100회", "1,200만원/월", "720만원/15일", "420만원/7일", "200만원/3일", "70만원/1일"),
      ("1일 30초 100회", "1,500만원/월", "900만원/15일", "600만원/7일", "270만원/3일", "100만원/1일"),
    ],
    "traffic": [
      ("반경 500m 일평균 유동인구", "약 229,578명"),
      ("광화문역 5호선 월 승하차", "2,462,249명"),
      ("세종대로 시청역·종로3가역 일대 일평균 교통량", "50,815대 / 41,936대"),
    ],
    "why": [
      ("입지", "연 65일 축제·행사·관광이 이어지는 서울 대표 상설 이벤트 공간(청계광장). 서울야외도서관·빛초롱축제·크리스마스 페스티벌 등과 자연 연계."),
      ("노출 환경", "높이가 낮은 개방형 시야로 보행자 누구나 자연스럽게 시선이 닿는 강제 주목형 매체."),
    ],
  },
  {
    "slug": "myeongdong",
    "name": "명동 을지한국빌딩 전광판",
    "h1": "명동 을지한국빌딩 전광판 광고 – 위치·광고비·유동인구 완전정리",
    "hero": "assets/images/insights/myeongdong-6.jpg",
    "heroAlt": "명동 을지한국빌딩 전광판 광고 매체 – 을지로입구 사거리 교통량",
    "address": "서울시 중구 을지로 50, 을지한국빌딩",
    "size": "20.3m × 11.0m (가로형)",
    "res": "1,872 × 1,008 px",
    "hours": "06:00 ~ 24:00 (18시간)",
    "tags": ["명동", "명동거리", "관광특구", "롯데백화점", "면세점"],
    "summary": ("명동 을지한국빌딩 전광판은 을지로입구역 사거리(서울 중구 을지로 50)의 20.3×11.0m 가로형 LED 매체입니다. "
                "을지로입구역·명동역 월 승하차 합계 600만 명이 넘는 국내 최대 관광·쇼핑 특구로, 국내외 관광객까지 "
                "동시에 커버합니다. 1일 20초 100회 기준 월 1,200만 원부터."),
    "pricing": [
      ("1일 20초 100회", "1,200만원/월", "600만원/15일", "300만원/7일", "180만원/3일", "60만원/1일"),
      ("1일 30초 70회", "상담", "상담", "상담", "상담", "상담"),
    ],
    "traffic": [
      ("반경 500m 일평균 유동인구", "약 254,317명"),
      ("을지로입구역 2호선 월 승하차", "3,342,538명"),
      ("명동역 4호선 월 승하차", "2,667,264명"),
      ("을지로3가·2가 일대 일평균 교통량", "30,395대"),
    ],
    "why": [
      ("입지", "국내외 관광객이 밀집하는 서울 대표 관광·쇼핑 특구. 외국인 포함 글로벌 타깃까지 동시 커버."),
      ("노출 환경", "보행 중심 대로변·횡단보도 대기 구간에서 국내외 관광객의 시선이 자연스럽게 집중."),
    ],
  },
  {
    "slug": "jeokseon",
    "name": "경복궁 현대 적선빌딩 전광판",
    "h1": "경복궁 적선현대빌딩 전광판 광고 – 위치·광고비·관광 유동 완전정리",
    "hero": "assets/images/insights/jeokseon-1.jpg",
    "heroAlt": "경복궁 적선현대빌딩 전광판 광고 매체 – 광화문 일대 유동인구",
    "address": "서울시 종로구 사직로 130",
    "size": "19.0m × 10.0m (옥상 가로형)",
    "res": "1,120 × 608 px",
    "hours": "06:00 ~ 24:00 (18시간)",
    "tags": ["경복궁", "광화문", "청와대", "경복궁역", "안국역", "공연"],
    "summary": ("경복궁 적선현대빌딩 전광판은 서울 종로구 사직로 130의 19.0×10.0m 옥상형 LED 매체로, "
                "청와대-경복궁-광화문광장-송현동으로 이어지는 국내 최대 관광루트 위에 있습니다. "
                "수문장 교대의식 등으로 하루 약 1만 명이 체류하며, 1일 20초 100회 기준 월 500만 원부터로 가성비가 높습니다."),
    "pricing": [
      ("1일 20초 100회", "500만원/월", "250만원/15일", "140만원/7일", "60만원/3일", "상담"),
      ("1일 30초 100회", "700만원/월", "350만원/15일", "190만원/7일", "80만원/3일", "상담"),
    ],
    "traffic": [
      ("관광루트", "청와대 개방 K-관광 랜드마크 — 청와대·경복궁·광화문광장·송현동문화공원 연계"),
      ("행사 체류 인원", "광화문 수문장 교대의식 등에 약 1만여 명 체류(행사 시)"),
      ("복합산업지역", "금융·경제·언론·문화·쇼핑·관광·관공서 밀집, 외국관광객 1차 관광 포인트"),
    ],
    "why": [
      ("입지", "청와대 개방으로 형성된 관광루트의 핵심. 경복궁·광화문광장·해치마당 등 고궁 관광 1번지."),
      ("노출 환경", "옥상형 대형 LED로 광화문 대로·횡단 구간에서 원거리 주목도 확보."),
    ],
  },
]

def esc(s): return html.escape(str(s), quote=True)

CSS = """
    body{margin:0;background:#fff}
    .ins-hdr{display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid #eee;position:sticky;top:0;background:#fff;z-index:10}
    .ins-hdr .mk{background:#111;color:#fff;font:800 13px/1 sans-serif;border-radius:8px;padding:6px 9px}
    .ins-hdr a{color:#333;text-decoration:none;font:600 14px/1 system-ui,sans-serif}
    .ins-hdr nav{margin-left:auto;display:flex;gap:18px}
    .ins-wrap{max-width:860px;margin:0 auto;padding:22px 18px 90px;font-family:system-ui,-apple-system,sans-serif;color:#1c1c1c}
    .ins-bc{font:13px/1.6 system-ui;color:#8a8a8a;margin:0 0 8px}
    .ins-bc a{color:#8a8a8a;text-decoration:none}
    .ins-wrap h1{font:800 28px/1.35 system-ui;margin:6px 0 8px}
    .ins-meta{font:13px/1.6 system-ui;color:#888;margin:0 0 16px}
    .ins-hero{width:100%;height:auto;border-radius:14px;display:block;margin:0 0 16px}
    .ins-lead{font:17px/1.75 system-ui;color:#2a2a2a;margin:0 0 14px}
    .ins-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 26px}
    .ins-tags span{background:#f4eef2;color:#a8306c;font:600 13px/1 system-ui;padding:7px 11px;border-radius:20px}
    .ins-wrap h2{font:800 20px/1.4 system-ui;margin:30px 0 12px;padding-top:6px}
    table.ins{border-collapse:collapse;width:100%;font:14px/1.6 system-ui;margin:0 0 6px}
    table.ins th,table.ins td{border:1px solid #e8e8e8;padding:10px 12px;text-align:left;vertical-align:top}
    table.ins th{background:#faf7f9;font-weight:700;white-space:nowrap;color:#333}
    .ins-src{font:12px/1.6 system-ui;color:#9a9a9a;margin:8px 0 0}
    .ins-why{margin:0}
    .ins-why b{display:block;color:#a8306c;font:700 15px/1.5 system-ui;margin-top:12px}
    .ins-why p{margin:2px 0 0;font:15px/1.75 system-ui;color:#2a2a2a}
    .faq details{border-bottom:1px solid #eee;padding:13px 2px}
    .faq summary{font:700 16px/1.5 system-ui;cursor:pointer;color:#181818}
    .faq p{margin:9px 0 0;font:15px/1.75 system-ui;color:#333}
    .ins-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
    .ins-cta a{display:inline-block;font:700 15px/1 system-ui;padding:15px 24px;border-radius:11px;text-decoration:none}
    .ins-cta .p{background:#c0246f;color:#fff}
    .ins-cta .s{background:#f2f2f2;color:#222}
    .ins-cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
    .ins-card{border:1px solid #ececec;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;display:block}
    .ins-card img{width:100%;height:170px;object-fit:cover;display:block}
    .ins-card .b{padding:14px 16px}
    .ins-card h3{font:700 17px/1.4 system-ui;margin:0 0 6px;color:#161616}
    .ins-card p{font:14px/1.6 system-ui;color:#555;margin:0}
    .ins-card .k{color:#c0246f;font-weight:700;font-size:13px;margin-top:8px;display:block}
    @media(max-width:640px){.ins-cards{grid-template-columns:1fr}.ins-wrap h1{font-size:23px}}
"""

def header():
    return ('<header class="ins-hdr"><span class="mk">AD</span><strong>광고플레이</strong>'
            '<nav><a href="insights.html">옥외광고 가이드</a><a href="map.html">전광판 지도</a>'
            '<a href="estimate.html">견적 문의</a></nav></header>')

def article_html(it):
    price_rows = "".join(
        f"<tr><th>{esc(r[0])}</th><td>{esc(r[1])}</td><td>{esc(r[2])}</td><td>{esc(r[3])}</td><td>{esc(r[4])}</td><td>{esc(r[5])}</td></tr>"
        for r in it["pricing"])
    traffic_rows = "".join(f"<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>" for a,b in it["traffic"])
    tags = "".join(f"<span>#{esc(t)}</span>" for t in it["tags"])
    why = "".join(f'<b>{esc(t)}</b><p>{esc(d)}</p>' for t,d in it["why"])
    min1 = it["pricing"][0][5] if it["pricing"][0][5] != "상담" else it["pricing"][0][4]
    faqs = [
      (f"{it['name']} 광고 비용은 얼마인가요?",
       f"1일 20초 100회 기준 {it['pricing'][0][1]}이며, 기간(1일·3일·7일·15일·월)과 소재 길이(20초/30초)에 따라 달라집니다. 표기 금액은 모두 VAT 별도 참고가이며 정확한 비용은 상담 시 확정됩니다."),
      (f"{it['name']}은 며칠부터 집행할 수 있나요?",
       f"단기 집행이 가능하며 최소 단위는 {esc(min1)}부터입니다. 1일·3일·7일·15일·월 단위로 예약할 수 있습니다."),
      ("광고 영상 제작과 송출도 대행하나요?",
       "네. 광고플레이는 소재 디자인부터 구좌 예약, 영상 송출, 현장 모니터링, 결과보고까지 원스톱으로 대행합니다."),
    ]
    faq_html = "".join(
        f"<details{' open' if i==0 else ''}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>"
        for i,(q,a) in enumerate(faqs))
    ld = [
      {"@context":"https://schema.org","@type":"Article","headline":it["h1"],
       "datePublished":PUB,"dateModified":PUB,"image":f"{BASE}/{it['hero']}",
       "author":{"@type":"Organization","name":"광고플레이"},
       "publisher":{"@type":"Organization","name":"광고플레이","logo":{"@type":"ImageObject","url":LOGO}},
       "mainEntityOfPage":f"{BASE}/insight-{it['slug']}.html",
       "about":["전광판 광고","디지털 옥외광고","DOOH",it["name"]]},
      {"@context":"https://schema.org","@type":"Place","name":it["name"],
       "address":{"@type":"PostalAddress","streetAddress":it["address"],"addressLocality":"서울","addressCountry":"KR"}},
      {"@context":"https://schema.org","@type":"FAQPage",
       "mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
    ]
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x,ensure_ascii=False)}</script>' for x in ld)
    desc = it["summary"][:150]
    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{esc(it['h1'])} | 광고플레이</title>
    <meta name="description" content="{esc(desc)}">
    <meta name="keywords" content="{esc(it['name'])}, 전광판 광고, 옥외광고, 디지털 옥외광고, DOOH, {esc(it['tags'][0])} 전광판, 광고플레이">
    <link rel="canonical" href="{BASE}/insight-{it['slug']}.html">
    <meta property="og:type" content="article">
    <meta property="og:title" content="{esc(it['h1'])}">
    <meta property="og:description" content="{esc(desc)}">
    <meta property="og:image" content="{BASE}/{it['hero']}">
    <meta property="og:url" content="{BASE}/insight-{it['slug']}.html">
    <link rel="stylesheet" href="assets/css/styles.css">
    {ld_html}
    <style>{CSS}</style>
  </head>
  <body>
    {header()}
    <main class="ins-wrap">
      <p class="ins-bc"><a href="index.html">홈</a> › <a href="insights.html">옥외광고 가이드</a> › {esc(it['name'])}</p>
      <h1>{esc(it['h1'])}</h1>
      <p class="ins-meta">발행일 {PUB} · 작성 광고플레이(주)</p>
      <img class="ins-hero" src="{it['hero']}" alt="{esc(it['heroAlt'])}" loading="eager">
      <p class="ins-lead">{esc(it['summary'])}</p>
      <div class="ins-tags">{tags}</div>

      <h2>매체 규격·운영 정보</h2>
      <table class="ins">
        <tr><th>위치</th><td>{esc(it['address'])}</td></tr>
        <tr><th>매체 규격</th><td>{esc(it['size'])}</td></tr>
        <tr><th>해상도</th><td>{esc(it['res'])}</td></tr>
        <tr><th>운영 시간</th><td>{esc(it['hours'])}</td></tr>
      </table>

      <h2>광고비 (VAT 별도)</h2>
      <table class="ins">
        <tr><th>소재</th><th>월</th><th>15일</th><th>7일</th><th>3일</th><th>1일</th></tr>
        {price_rows}
      </table>

      <h2>매체 주변 유동인구·교통 (반경 500m)</h2>
      <table class="ins">{traffic_rows}</table>
      <p class="ins-src">{esc(SRC_NOTE)}</p>

      <h2>이 매체가 강한 이유</h2>
      <div class="ins-why">{why}</div>

      <h2>자주 묻는 질문</h2>
      <div class="faq">{faq_html}</div>

      <div class="ins-cta">
        <a class="p" href="estimate.html">이 매체로 견적 문의</a>
        <a class="s" href="map.html">지도에서 위치 보기</a>
      </div>
    </main>
  </body>
</html>
"""

def hub_html():
    cards = ""
    for it in ITEMS:
        cards += (f'<a class="ins-card" href="insight-{it["slug"]}.html">'
                  f'<img src="{it["hero"]}" alt="{esc(it["heroAlt"])}" loading="lazy">'
                  f'<div class="b"><h3>{esc(it["name"])} 광고</h3>'
                  f'<p>{esc(it["address"])} · {esc(it["size"])}</p>'
                  f'<span class="k">위치·광고비·유동인구 자세히 →</span></div></a>')
    ld = {"@context":"https://schema.org","@type":"CollectionPage",
          "name":"옥외광고 가이드 | 광고플레이",
          "url":f"{BASE}/insights.html",
          "about":["전광판 광고","디지털 옥외광고","DOOH","옥외광고 매체"],
          "isPartOf":{"@type":"WebSite","name":"광고플레이","url":f"{BASE}/"}}
    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>옥외광고 가이드 – 전광판 광고 매체 인사이트 | 광고플레이</title>
    <meta name="description" content="서울 핵심 상권 전광판 광고 매체의 위치·광고비·유동인구를 실데이터로 정리한 옥외광고 가이드입니다. 청계광장·명동·경복궁 대형 전광판을 비교하세요.">
    <meta name="keywords" content="옥외광고 가이드, 전광판 광고, 옥외광고, 디지털 옥외광고, DOOH, 전광판 광고비, 광고플레이">
    <link rel="canonical" href="{BASE}/insights.html">
    <meta property="og:type" content="website">
    <meta property="og:title" content="옥외광고 가이드 – 전광판 광고 매체 인사이트 | 광고플레이">
    <meta property="og:description" content="서울 핵심 상권 전광판 광고 매체의 위치·광고비·유동인구를 실데이터로 정리했습니다.">
    <meta property="og:url" content="{BASE}/insights.html">
    <link rel="stylesheet" href="assets/css/styles.css">
    <script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script>
    <style>{CSS}</style>
  </head>
  <body>
    {header()}
    <main class="ins-wrap">
      <p class="ins-bc"><a href="index.html">홈</a> › 옥외광고 가이드</p>
      <h1>옥외광고 가이드</h1>
      <p class="ins-lead">서울 핵심 상권 전광판 광고 매체의 <b>위치·광고비·유동인구</b>를 실데이터로 정리합니다. 광고 집행 전 매체별 특성과 비용을 한눈에 비교하세요.</p>
      <div class="ins-cards">{cards}</div>
    </main>
  </body>
</html>
"""

def main():
    for it in ITEMS:
        open(f"insight-{it['slug']}.html","w",encoding="utf-8").write(article_html(it))
    open("insights.html","w",encoding="utf-8").write(hub_html())
    print("생성:", "insights.html +", ", ".join(f"insight-{it['slug']}.html" for it in ITEMS))

if __name__ == "__main__":
    main()
