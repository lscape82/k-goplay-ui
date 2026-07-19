# -*- coding: utf-8 -*-
"""
build-area-pages.py — '지역별 옥외광고' 정적 랜딩 페이지 생성기 (SEO/GEO/AEO 자산).

배경: 기존 areas.html / area-detail.html 은 JS 렌더라 봇(네이버 Yeti·GPTBot·ClaudeBot)에게
      빈 페이지였다. '강남 전광판 광고' 같은 지역+매체 검색은 상업 의도가 가장 높은 롱테일인데
      정적 HTML이 없어 노출 0이었음 → 상권 데이터(data/areas.json)와 매체(data/media.json, areaSlug)를
      묶어 정적 HTML + JSON-LD(Place·ItemList·FAQPage·BreadcrumbList)로 미리 찍어낸다.

출력: areas.html(허브, 정적으로 교체) + area-<slug>.html(상권별, 매체 있는 지역만).
      기존 UI/지도/목록 무변경 — 정적 페이지만 (재)생성. 개별 매체는 media-<slug>.html 로 링크.
빌드 후: python scripts/build-sitemap.py 를 돌려 area-*.html 을 색인에 넣는다.
"""
import os, json, html, re

os.chdir(r"C:/goplay/k-goplay-ui")

BASE = "https://lscape82.github.io/k-goplay-ui"
PUB = "2026-07-19"
LOGO = f"{BASE}/assets/images/k-goplay-logo-new.png"
SRC_NOTE = ("데이터 출처 — 일평균 유동인구: 중소벤처기업부 빅데이터플랫폼 소상공인365"
            "(SKT 통신사 데이터 2025.10 기준, KT 미반영) · 지하철/버스 승하차: 서울시 열린데이터광장"
            "(2025.12 기준) · 교통량: 서울시 교통정보(2025.11 기준)")

AREAS = json.load(open("data/areas.json", encoding="utf-8"))
MEDIA = json.load(open("data/media.json", encoding="utf-8"))
# 카테고리 라벨은 filters.json 단일 출처에서 읽는다(하드코딩 인코딩 사고 방지).
CAT_LABEL = {c["value"]: c["label"] for c in json.load(open("data/filters.json", encoding="utf-8"))["categories"]}


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def fmt(n):
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return "-"


def won(v):
    """common.js formatKRW 와 동일 (억원 / 만원)"""
    if not v:
        return "상담"
    v = int(v)
    if v >= 100000000:
        e = v / 100000000
        return (f"{e:.1f}".rstrip("0").rstrip(".")) + "억원"
    return f"{round(v / 10000):,}만원"


def min_price(x):
    ps = [r.get("monthlyPriceKRW") for r in (x.get("pricing") or []) if r.get("monthlyPriceKRW")]
    return min(ps) if ps else None


def gu_of(x):
    """주소에서 '서울 OO구' 구 단위만 뽑아 목록 표기에 쓴다(정확 주소는 매체 상세에)."""
    a = x.get("address") or ""
    m = re.search(r"(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\S*\s+(\S+[구군시])", a)
    if not m:
        return ""
    return f"{m.group(1)} {m.group(2)}" if m.group(1) != "서울" else f"서울 {m.group(2)}"


def area_media(slug):
    """해당 상권 매체 — media.json 은 수작업 큐레이션 순서라 필터만(재정렬 안 함)."""
    return [x for x in MEDIA if x.get("areaSlug") == slug]


def short_kw(name):
    """키워드용 짧은 지역 토큰 — '강남역/강남대로'→'강남', '삼성 코엑스'→'삼성 코엑스'."""
    head = re.split(r"[/·]", name)[0].strip()
    return head or name

# ── 공통 골격(헤더/푸터/도크/CSS) — build-insights.py 와 동일 기준선 ──────────────

CSS = """
    body{margin:0;background:#fff}
    :root{--shell-max:1760px;--dock-gutter:248px;--dock-top:145px;--dock-w:210px}
    :root{--shell-w:min(var(--shell-max),calc(100% - 40px))}
    .hd{position:sticky;top:0;z-index:30;border-bottom:1px solid #e9edf3;background:#fff;font-family:var(--font-sans)}
    .hd-in{display:flex;align-items:center;gap:22px;min-height:54px;flex-wrap:wrap;box-sizing:border-box;
           width:min(var(--shell-max),calc(100% - 40px));margin:0 auto;padding-inline:var(--dock-gutter)}
    .hd-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;flex:none}
    .hd-brand strong{font-size:18.5px;font-weight:760;letter-spacing:-0.01em;color:#0f172a}.hd-brand .brand-mark{width:30px;height:30px;background-size:auto 30px}
    .hd-nav{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}
    .hd-act{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
    .hd a{font-size:13px;font-weight:620;color:#475467;text-decoration:none;white-space:nowrap;transition:color .15s ease,transform .15s ease}
    .hd-nav a:hover,.hd-nav a:focus,.hd-act a:hover,.hd-act a:focus{color:#0b1b3f;transform:translateY(-2px)}
    .hd-nav a.on,.hd-act a.on{color:#0b3a91;font-weight:750}
    .ins-wrap{width:min(var(--shell-max),calc(100% - 40px));margin:0 auto;box-sizing:border-box;
              padding:22px var(--dock-gutter) 90px;font-family:var(--font-sans);color:#1c1c1c}
    @media(max-width:1079px){
      .hd-in{padding-inline:0}
      .ins-wrap{padding-inline:0;padding-bottom:100px}
      .viewtog{right:10px;left:10px;top:auto;bottom:10px;width:auto;flex-direction:row;flex-wrap:wrap;justify-content:center}
      .viewtog a{flex:1 1 auto;justify-content:center;padding:9px 10px;font-size:12.5px}}
    @media(max-width:900px){.hd-in{gap:12px;min-height:50px}.hd-nav{gap:14px}.hd-act{gap:12px}.hd a{font-size:13px}}
    .viewtog{position:fixed;top:var(--dock-top);z-index:19;display:flex;flex-direction:column;gap:5px;
             width:var(--dock-w);right:auto;
             left:calc(50% + var(--shell-w)/2 - var(--dock-gutter) + (var(--dock-gutter) - var(--dock-w))/2)}
    .viewtog a{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid #e2e7f0;border-radius:11px;
               background:rgba(255,255,255,.97);text-decoration:none;font:700 13px/1.3 var(--font-sans);color:#2b3242;
               box-shadow:none;transition:border-color .15s ease}
    .viewtog a:hover{border-color:#3b74f2}
    .viewtog a.on{border-color:#0b3a91;color:#0b3a91;background:#f4f8ff}
    .viewtog a.on .ic{background:#0b3a91;color:#fff}
    .viewtog .ic{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:6px;background:#eaf0ff;color:#0b3a91}
    .viewtog .ic svg{width:14px;height:14px;flex:none}
    .viewtog .consult .ic{background:#0b3a91;color:#fff}
    .ins-bc{font:13px/1.6 var(--font-sans);color:#8a8a8a;margin:0 0 8px}
    .ins-bc a{color:#8a8a8a;text-decoration:none}
    .ins-wrap h1{font:850 26px/1.3 var(--font-sans);margin:6px 0 8px}
    .ins-meta{font:13px/1.6 var(--font-sans);color:#888;margin:0 0 16px}
    .ins-lead{font:17px/1.75 var(--font-sans);color:#2a2a2a;margin:0 0 14px}
    .ins-sticky{position:sticky;top:calc(var(--hd-h,54px) - 1px);z-index:20;background:#fff;padding:16px 0 10px}
    .ins-sticky::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:200px;background:#fff}
    .ins-sticky h1{margin-top:0}
    .ins-wrap:has(> .ins-sticky){padding-top:0}
    .ins-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 26px}
    .ins-tags span{background:#eef4ff;color:#0b3a91;font:600 13px/1 var(--font-sans);padding:7px 11px;border-radius:20px}
    .ins-wrap h2{font:760 17px/1.4 var(--font-sans);margin:30px 0 12px;padding-top:6px}
    table.ins{border-collapse:collapse;width:100%;font:14px/1.6 var(--font-sans);margin:0 0 6px}
    table.ins th,table.ins td{border:1px solid #e8e8e8;padding:10px 12px;text-align:left;vertical-align:top}
    table.ins th{background:#f8fafc;font-weight:700;white-space:nowrap;color:#333}
    .ins-src{font:12px/1.6 var(--font-sans);color:#9a9a9a;margin:8px 0 0}
    .faq details{border-bottom:1px solid #eee;padding:13px 2px}
    .faq summary{font:700 16px/1.5 var(--font-sans);cursor:pointer;color:#181818}
    .faq p{margin:9px 0 0;font:15px/1.75 var(--font-sans);color:#333}
    .ins-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
    .ins-cta a{display:inline-block;font:700 15px/1 var(--font-sans);padding:15px 24px;border-radius:11px;text-decoration:none}
    .ins-cta .p{background:#0b3a91;color:#fff}
    .ins-cta .s{background:#f2f2f2;color:#222}
    /* 지역 매체 목록 — 정적 링크 리스트(봇 크롤 + 내부링크). 사진 없이 '읽는' 인덱스. */
    .area-media{list-style:none;margin:12px 0 0;padding:0;border-top:1px solid #ececf1}
    .area-media li{border-bottom:1px solid #ececf1}
    .area-media a{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 18px;align-items:center;
                  padding:16px 8px;text-decoration:none;color:inherit;transition:background .15s ease}
    .area-media a:hover{background:#f8fafc}
    .area-media .nm{font:750 16px/1.4 var(--font-sans);color:#111827;margin:0 0 4px}
    .area-media .mt{font:13px/1.5 var(--font-sans);color:#6b7280}
    .area-media .mt b{color:#0b3a91;font-weight:700}
    .area-media .pr{font:800 15px/1.3 var(--font-sans);color:#172033;white-space:nowrap;text-align:right}
    /* 지역 인덱스(허브) — 인사이트 허브와 동일 편집형 인덱스 */
    .ins-sec{margin-top:38px}
    .ins-sec-head{display:flex;align-items:baseline;gap:10px;padding-bottom:2px}
    .ins-sec-head h2{font:800 18px/1.4 var(--font-sans);margin:0;padding:0}
    .ins-sec-head span{font:13px/1 var(--font-sans);color:#9aa1ad}
    .ins-index{list-style:none;margin:12px 0 0;padding:0;border-top:1px solid #ececf1}
    .ins-index li{border-bottom:1px solid #ececf1}
    .ins-index a{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:20px;align-items:center;
                 padding:24px 10px;text-decoration:none;color:inherit;transition:background .15s ease}
    .ins-index a:hover{background:#f8fafc}
    .ins-index .num{align-self:start;font:800 19px/1.3 var(--font-sans);color:#ccd2de}
    .ins-index .kicker{display:inline-block;font:700 11.5px/1 var(--font-sans);color:#0b3a91;
                       background:#eef4ff;border-radius:999px;padding:6px 10px;margin:0 0 10px}
    .ins-index h3{font:750 20px/1.4 var(--font-sans);margin:0 0 5px;padding:0;color:#111827}
    .ins-index .sub{font:14px/1.6 var(--font-sans);color:#6b7280;margin:0 0 14px}
    .ins-index .stats{display:flex;flex-wrap:wrap;gap:12px 30px;margin:0;padding:0}
    .ins-index .stats dt{font:600 12px/1.4 var(--font-sans);color:#98a0ad;margin:0 0 2px}
    .ins-index .stats dd{font:800 17px/1.35 var(--font-sans);color:#172033;margin:0}
    .ins-index .go{font:800 13px/1 var(--font-sans);color:#0b3a91;white-space:nowrap;display:inline-flex;align-items:center}
    .ins-index .go::after{content:"";width:6px;height:6px;margin-left:7px;border-top:2px solid currentColor;
                          border-right:2px solid currentColor;transform:rotate(45deg)}
    /* 다른 지역 보기 — 상권 페이지 하단 상호링크(크롤 경로) */
    .area-siblings{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
    .area-siblings a{font:650 13.5px/1 var(--font-sans);color:#0b3a91;background:#eef4ff;border-radius:999px;
                     padding:9px 14px;text-decoration:none}
    .area-siblings a:hover{background:#e0eaff}
    @media(max-width:640px){
      .ins-wrap h1{font-size:23px}
      .ins-index a{grid-template-columns:36px minmax(0,1fr);gap:12px;padding:20px 4px}
      .ins-index .go{grid-column:2;justify-self:start;margin-top:12px}}
    .site-foot{border-top:1px solid #e9e9ee;background:#fafafb;margin-top:56px}
    .foot-inner{width:min(var(--shell-max),calc(100% - 40px));margin:0 auto;box-sizing:border-box;
                padding:26px var(--dock-gutter) 34px}
    @media(max-width:1079px){.foot-inner{padding-inline:0}}
    .foot-nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-bottom:16px}
    .foot-nav a{color:#33363d;text-decoration:none;font:600 13.5px/1 var(--font-sans)}
    .foot-info{display:flex;flex-wrap:wrap;gap:6px 20px;font-style:normal;font:13px/1.7 var(--font-sans);color:#5c616b}
    .foot-info b{color:#33363d;font-weight:650;margin-right:4px}
    .foot-copy{margin:14px 0 0;font:12.5px/1.6 var(--font-sans);color:#9a9ea7}
"""

FOOTER = """
    <footer class="site-foot"><div class="foot-inner">
      <nav class="foot-nav" aria-label="회사 정보 메뉴">
        <a href="index.html">홈</a><a href="about.html">회사소개</a><a href="terms.html">이용약관</a><a href="privacy.html">개인정보처리방침</a><a href="media-policy.html">매체관리규정</a>
      </nav>
      <address class="foot-info">
        <span><b>회사명</b> 광고플레이 주식회사(Adplay Co., Ltd)</span>
        <span><b>대표자</b> 임정언</span>
        <span><b>이용문의</b> 1533-1975</span>
        <span><b>팩스</b> 044-902-6029</span>
        <span><b>이메일</b> info@k-goplay.com</span>
        <span><b>주소</b> 세종특별자치시 한누리대로 350, 뱅크빌딩 6층 D45호(어진동)</span>
        <span><b>통신판매업신고</b> 제2024-세종아름-0724</span>
        <span><b>사업자등록번호</b> 148-81-03399</span>
      </address>
      <p class="foot-copy">Copyright &copy; Adplay Korea Co., Ltd. All Rights Reserved.</p>
    </div></footer>"""

IC_MAP = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
          'stroke-linejoin="round" aria-hidden="true"><path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/>'
          '<path d="M9 3v15M15 6v15"/></svg>')
IC_LIST = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
           'aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>')
IC_CHAT = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
           'stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.4-.6L3 21l1.7-5'
           'a8.2 8.2 0 0 1-.7-3.4 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.6 7.9z"/></svg>')
IC_AREA = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
           'stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/>'
           '<circle cx="12" cy="10" r="2.5"/></svg>')


def viewtog(active=""):
    """우측 플로팅 뷰 전환 도크 — 지도로/목록으로/지역으로 + 상담. 지역 페이지는 '지역으로 보기' 활성."""
    on = lambda k: ' class="on"' if active == k else ''
    return ('<div class="viewtog">'
            f'<a href="map.html"><span class="ic">{IC_MAP}</span>지도로 보기</a>'
            f'<a href="media-catalog.html"><span class="ic">{IC_LIST}</span>목록으로 보기</a>'
            f'<a{on("area")} href="areas.html"><span class="ic">{IC_AREA}</span>지역으로 보기</a>'
            f'<a class="consult" href="estimate.html"><span class="ic">{IC_CHAT}</span>상담신청</a>'
            '</div>')


def header(active=""):
    """전 페이지 공통 헤더 — 확정 메뉴(지도·목록·사례·인사이트). 지역 페이지는 '옥외광고 목록' 계열."""
    on = lambda k: ' class="on"' if active == k else ''
    return f"""<header class="hd"><div class="hd-in">
      <a class="hd-brand" href="map.html" aria-label="광고플레이 홈"><span class="brand-mark">AD</span><strong>광고플레이</strong></a>
      <nav class="hd-nav" aria-label="주요 메뉴">
        <a href="map.html">옥외광고 지도</a>
        <a{on('list')} href="media-catalog.html">옥외광고 목록</a>
        <a href="cases.html">광고집행사례</a>
        <a href="insights.html">광고 인사이트</a>
      </nav>
      <div class="hd-act">
        <a href="about.html">회사소개</a>
        <a href="admin.html">관리자</a>
        <a href="login.html">로그인</a>
        <a href="join.html">회원가입</a>
      </div>
    </div></header>"""

# ── 상권 상세 페이지 ────────────────────────────────────────────────────────


def media_rows(items):
    rows = ""
    for x in items:
        cat = CAT_LABEL.get(x.get("category"), x.get("mediaType") or "옥외광고")
        gu = gu_of(x)
        meta = f"<b>{esc(cat)}</b>" + (f" · {esc(gu)}" if gu else "")
        mp = min_price(x)
        price = f"월 {won(mp)}" if mp else "월 비용 상담"
        rows += (f'<li><a href="media-{esc(x["slug"])}.html">'
                 f'<span><span class="nm">{esc(x["name"])}</span>'
                 f'<span class="mt">{meta}</span></span>'
                 f'<span class="pr">{esc(price)}</span></a></li>')
    return rows


def subway_table(area):
    rows = [r for r in (area.get("subwayMonthlyUsers") or []) if r.get("users")]
    rows.sort(key=lambda r: -int(r["users"]))
    if not rows:
        return ""
    body = "".join(f"<tr><th>{esc(r['station'])}</th><td>{fmt(r['users'])}명</td></tr>" for r in rows[:6])
    return ("<h2>지하철 월 이용객 (인근 역)</h2>"
            f"<table class=\"ins\"><tr><th>역</th><th>월 승하차</th></tr>{body}</table>")


def area_page(area, all_areas):
    slug, name = area["slug"], area["name"]
    items = area_media(slug)
    count = len(items)
    kw = short_kw(name)
    cats = []
    for x in items:
        lbl = CAT_LABEL.get(x.get("category"))
        if lbl and lbl not in cats:
            cats.append(lbl)
    cats_text = "·".join(cats[:4]) if cats else "대형 전광판 등"
    prices = [min_price(x) for x in items if min_price(x)]
    minp = min(prices) if prices else None

    h1 = f"{name} 옥외광고·전광판 광고"
    title = f"{name} 옥외광고·전광판 광고 매체 – 위치·유동인구·광고비 | 광고플레이"
    foot = area.get("dailyFootTraffic")
    lead = area.get("description") or area.get("summary") or ""
    desc = (f"{name} 옥외광고·전광판 광고 매체 {count}개를 위치·유동인구·광고비로 정리했습니다. "
            + (f"일평균 유동인구 약 {fmt(foot)}명, " if foot else "")
            + f"{cats_text} 등 {kw} 상권 매체를 한눈에 비교하고 상담하세요.")[:155]

    keywords = ", ".join([f"{kw} 전광판 광고", f"{kw} 옥외광고", f"{name} 전광판", "옥외광고",
                          "디지털 옥외광고", "DOOH", "광고플레이"])

    # 핵심 지표
    metric_rows = ""
    if foot:
        metric_rows += f"<tr><th>일평균 유동인구</th><td>약 {fmt(foot)}명</td></tr>"
    if area.get("trafficVolumeDaily"):
        metric_rows += f"<tr><th>일 교통량</th><td>약 {fmt(area['trafficVolumeDaily'])}대</td></tr>"
    metric_rows += f"<tr><th>등록 옥외광고 매체</th><td>{count}개</td></tr>"
    if cats:
        metric_rows += f"<tr><th>매체 유형</th><td>{esc('·'.join(cats))}</td></tr>"

    tags = "".join(f"<span>#{esc(t)}</span>" for t in (area.get("recommendedIndustries") or [])[:6])
    targets = "".join(f"<span>{esc(t)}</span>" for t in (area.get("primaryTargets") or [])[:6])

    # FAQ (AEO)
    faqs = [
        (f"{name}에서 옥외광고(전광판)를 할 수 있는 매체는 몇 개인가요?",
         f"현재 {name} 상권에서 광고플레이가 운영하는 옥외광고 매체는 {count}개입니다. "
         f"{cats_text} 등 유형별로 지도와 목록에서 위치·규격·광고비를 비교할 수 있습니다."),
        (f"{name} 전광판 광고 비용은 얼마인가요?",
         (f"매체와 기간에 따라 다르며, 이 지역은 최저 월 {won(minp)}부터 집행할 수 있습니다. "
          if minp else "매체와 기간에 따라 다르며, 정확한 비용은 상담 시 확정됩니다. ")
         + "표기 금액은 모두 VAT 별도 참고가입니다."),
    ]
    if foot:
        faqs.append((f"{name} 유동인구는 얼마나 되나요?",
                     f"{name} 상권의 일평균 유동인구는 약 {fmt(foot)}명 규모입니다. "
                     "주요 타깃은 " + ", ".join((area.get("primaryTargets") or [])[:3]) + " 등입니다."))
    faq_html = "".join(
        f"<details{' open' if i == 0 else ''}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>"
        for i, (q, a) in enumerate(faqs))

    # 다른 지역
    sibs = "".join(f'<a href="area-{esc(a["slug"])}.html">{esc(a["name"])}</a>'
                   for a in all_areas if a["slug"] != slug and area_media(a["slug"]))

    # JSON-LD
    ld = [
        {"@context": "https://schema.org", "@type": "Place", "name": f"{name} 옥외광고 상권",
         "description": area.get("summary") or "",
         "address": {"@type": "PostalAddress", "addressLocality": "서울특별시", "addressCountry": "KR"},
         "url": f"{BASE}/area-{slug}.html"},
        {"@context": "https://schema.org", "@type": "ItemList",
         "name": f"{name} 옥외광고·전광판 광고 매체",
         "numberOfItems": count,
         "itemListElement": [
             {"@type": "ListItem", "position": i + 1,
              "url": f"{BASE}/media-{x['slug']}.html", "name": x["name"]}
             for i, x in enumerate(items[:50])]},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q,
                         "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "지역별 옥외광고", "item": f"{BASE}/areas.html"},
            {"@type": "ListItem", "position": 3, "name": f"{name} 옥외광고", "item": f"{BASE}/area-{slug}.html"}]},
    ]
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)

    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{esc(title)}</title>
    <meta name="description" content="{esc(desc)}">
    <meta name="keywords" content="{esc(keywords)}">
    <link rel="canonical" href="{BASE}/area-{slug}.html">
    <meta property="og:type" content="website">
    <meta property="og:title" content="{esc(title)}">
    <meta property="og:description" content="{esc(desc)}">
    <meta property="og:url" content="{BASE}/area-{slug}.html">
    <meta property="og:image" content="{LOGO}">
    <link rel="stylesheet" href="assets/css/styles.css">
    {ld_html}
    <style>{CSS}</style>
  </head>
  <body>
    {header('list')}
    <main class="ins-wrap">
      {viewtog('area')}
      <p class="ins-bc"><a href="index.html">홈</a> › <a href="areas.html">지역별 옥외광고</a> › {esc(name)}</p>
      <h1>{esc(h1)}</h1>
      <p class="ins-meta">갱신일 {PUB} · 광고플레이(주) · 이 상권 매체 {count}개</p>
      <p class="ins-lead">{esc(lead)}</p>
      <div class="ins-tags">{tags}</div>

      <h2>상권 핵심 지표</h2>
      <table class="ins">{metric_rows}</table>
      <p class="ins-src">{esc(SRC_NOTE)}</p>

      {subway_table(area)}

      <h2>주요 타깃</h2>
      <div class="ins-tags">{targets}</div>

      <h2>{esc(name)} 옥외광고 매체 {count}개</h2>
      <ul class="area-media">{media_rows(items)}</ul>

      <h2>자주 묻는 질문</h2>
      <div class="faq">{faq_html}</div>

      <h2>다른 지역 옥외광고</h2>
      <div class="area-siblings">{sibs}</div>

      <div class="ins-cta">
        <a class="p" href="estimate.html">이 지역 매체로 견적 문의</a>
        <a class="s" href="map.html">지도에서 {esc(kw)} 매체 보기</a>
      </div>
    </main>
{FOOTER}
  </body>
</html>
"""

# ── 허브(areas.html) ────────────────────────────────────────────────────────


def hub(areas_with_media):
    # 기존 배포본과 동일한 카드 그리드(.directory-card) — 단, 정적 HTML이라 봇이 읽는다.
    rows = ""
    for area, items in areas_with_media:
        foot = area.get("dailyFootTraffic")
        traffic = area.get("trafficVolumeDaily")
        foot_val = f"{fmt(foot)}명" if foot else "확인 필요"
        traffic_val = f"{fmt(traffic)}대" if traffic else "확인 필요"
        tags = "".join(f'<span class="tag">{esc(t)}</span>'
                       for t in (area.get("recommendedIndustries") or [])[:5])
        rows += (
            '<article class="directory-card">'
            f'<div class="directory-meta"><span>{len(items)}개 매체</span></div>'
            f'<h3>{esc(area["name"])}</h3>'
            f'<p>{esc(area.get("summary") or "")}</p>'
            '<div class="compact-metrics">'
            f'<div><span>일 유동</span><strong>{foot_val}</strong></div>'
            f'<div><span>교통량</span><strong>{traffic_val}</strong></div>'
            '</div>'
            f'<div class="tag-list">{tags}</div>'
            f'<a class="button secondary" href="area-{esc(area["slug"])}.html">상세보기</a>'
            '</article>')

    total_media = sum(len(items) for _, items in areas_with_media)
    ld = [
        {"@context": "https://schema.org", "@type": "CollectionPage",
         "name": "지역별 옥외광고 | 광고플레이",
         "url": f"{BASE}/areas.html",
         "about": ["옥외광고", "전광판 광고", "디지털 옥외광고", "DOOH", "지역 옥외광고"],
         "isPartOf": {"@type": "WebSite", "name": "광고플레이", "url": f"{BASE}/"},
         "hasPart": [{"@type": "Place", "name": f'{a["name"]} 옥외광고',
                      "url": f'{BASE}/area-{a["slug"]}.html'} for a, _ in areas_with_media]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "지역별 옥외광고", "item": f"{BASE}/areas.html"}]},
    ]
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)

    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>지역별 옥외광고 – 서울 핵심 상권 전광판 광고 매체 | 광고플레이</title>
    <meta name="description" content="강남·코엑스·명동·홍대 등 서울 핵심 상권별 옥외광고·전광판 광고 매체 {total_media}개를 유동인구·광고비와 함께 정리했습니다. 지역을 골라 매체를 비교하고 상담하세요.">
    <meta name="keywords" content="지역별 옥외광고, 강남 전광판, 코엑스 전광판, 명동 옥외광고, 홍대 옥외광고, 전광판 광고, DOOH, 광고플레이">
    <link rel="canonical" href="{BASE}/areas.html">
    <meta property="og:type" content="website">
    <meta property="og:title" content="지역별 옥외광고 – 서울 핵심 상권 전광판 광고 매체 | 광고플레이">
    <meta property="og:description" content="서울 핵심 상권별 옥외광고·전광판 광고 매체를 유동인구·광고비와 함께 정리했습니다.">
    <meta property="og:url" content="{BASE}/areas.html">
    <meta property="og:image" content="{LOGO}">
    <link rel="stylesheet" href="assets/css/styles.css">
    {ld_html}
    <style>{CSS}</style>
  </head>
  <body>
    {header()}
    <main class="ins-wrap">
      {viewtog('area')}
      <div class="ins-sticky">
      <p class="ins-bc"><a href="index.html">홈</a> › 지역별 옥외광고</p>
      <h1>지역별 옥외광고</h1>
      <p class="ins-lead">서울 핵심 상권별 <b>옥외광고·전광판 광고 매체</b>를 유동인구·교통량·광고비와 함께 정리했습니다. 지역을 골라 매체를 비교하고 바로 상담하세요.</p>
      </div><!-- /ins-sticky -->

      <section class="ins-sec">
        <div class="ins-sec-head"><h2>상권별 매체</h2><span>공공 실데이터 기준 · {len(areas_with_media)}개 지역 · 매체 {total_media}개</span></div>
        <div class="directory-grid">{rows}</div>
      </section>
    </main>
{FOOTER}
    <script>(function(){{var d=document.documentElement,h=document.querySelector(".hd");if(!h)return;function s(){{d.style.setProperty("--hd-h",h.offsetHeight+"px")}}s();try{{new ResizeObserver(s).observe(h)}}catch(e){{}}addEventListener("resize",s);addEventListener("load",s)}})();</script>
  </body>
</html>
"""


def main():
    # 매체가 있는 상권만 페이지로(other-national 등 매체 0개는 제외 — 빈 페이지는 SEO 감점)
    with_media = [(a, area_media(a["slug"])) for a in AREAS]
    with_media = [(a, m) for a, m in with_media if m]
    # 정렬 안 함 — data/areas.json 큐레이션 순서(도산·코엑스·강남…) 유지, 배포본과 동일

    made = []
    for area, _ in with_media:
        open(f"area-{area['slug']}.html", "w", encoding="utf-8").write(area_page(area, [a for a, _ in with_media]))
        made.append(f"area-{area['slug']}.html")
    open("areas.html", "w", encoding="utf-8").write(hub(with_media))
    print(f"생성: areas.html + {len(made)}개 상권 페이지")
    print("  " + ", ".join(made))
    print("다음: python scripts/build-sitemap.py 로 색인 갱신")


if __name__ == "__main__":
    main()
