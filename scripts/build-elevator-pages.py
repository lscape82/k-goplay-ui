# -*- coding: utf-8 -*-
"""
build-elevator-pages.py — 엘리베이터 광고 허브 + 상품 상세 페이지 생성.

왜 필요한가
 - 엘리베이터는 매체 9,470건으로 회사 최대 자산인데, 지도(JS)로만 그려져서
   봇에게는 존재하지 않는다. 사이트 HTML의 '엘리베이터' = 0건.
 - 반면 관련 등록 키워드는 184개(승강기모니터·아파트엘리베이터광고·타운보드광고…).
   돈 내고 데려온 사람이 착지할 페이지가 없다.

무엇을 만드나
 - elevator.html                 허브 1장 (상품 6개 비교)
 - elevator-<slug>.html          상품 6장

무엇을 안 만드나
 - 단지 9,470장. "마포건영월드컵 엘리베이터 광고"를 검색하는 사람은 없다.
   (전광판은 건물명 키워드를 657개나 사고 있어서 매체별 페이지가 맞았다. 축이 다르다.)

원본: data/elevator-networks.json + data/elevator-sites.json (지도와 동일 소스)
"""
import os, json, html, statistics as st
from collections import Counter

os.chdir(r"C:/goplay/k-goplay-ui")
BASE = "https://lscape82.github.io/k-goplay-ui"
NET_SRC = "data/elevator-networks.json"
SITE_SRC = "data/elevator-sites.json"

# 대당 단가 이상치 컷 — 진해자은더샵 80,000원(원본 엑셀은 8,000으로 수정 완료,
# elevator-sites.json 재생성 전이라 아직 남아 있음). 재생성되면 이 필터는 무해하게 통과.
UNIT_MAX = 20000

# 상품별 페이지 slug — 브랜드명 그대로 URL에 쓰면 한글이라 곤란하다
SLUG = {"townboard": "townboard", "fmk": "focus", "gsa": "mediamid",
        "officebiz": "officebiz", "primeliving": "prime-living", "asa": "prime-office"}

# 판매안(2026) 패키지 단가표 — 대표님 확인 후 공개 결정. VAT 별도.
# ※ 단지 단위가 주력이고 패키지는 대량 옵션이라 페이지 아래쪽에 둔다.
PACKAGES = {
    "townboard": {
        "note": "1일 15초 영상 100회 보장 · 운영 06:00~24:00 (18시간)",
        "rows": [("전국 Full", "50,000대", "1억 5,000만원"), ("전국 Half", "25,000대", "8,000만원"),
                 ("서울·수도권 Full", "25,000대", "8,500만원"), ("서울·수도권 Half", "12,000대", "4,500만원"),
                 ("지방 전체 Full", "25,000대", "7,000만원"), ("지방 전체 Half", "12,000대", "4,000만원"),
                 ("대구 Full", "3,600대", "1,800만원"), ("대구 Half", "1,700대", "1,000만원"),
                 ("부산 Full", "3,200대", "1,800만원"), ("부산 Half", "1,500대", "1,000만원"),
                 ("경남", "3,400대", "1,300만원"), ("충남", "2,600대", "1,000만원"),
                 ("대전", "2,300대", "900만원"), ("전북", "2,100대", "850만원"),
                 ("경북", "2,000대", "800만원"), ("세종", "1,600대", "650만원"),
                 ("천안", "1,500대", "600만원"), ("충북", "1,500대", "600만원"),
                 ("강원", "1,400대", "650만원"), ("창원", "1,300대", "650만원"),
                 ("울산", "1,200대", "600만원")],
    },
    "fmk": {
        "note": "1일 15초 영상 90회 보장 · 운영 06:00~24:00 (18시간)",
        "rows": [("전국 Full", "60,000대", "1억 8,000만원"), ("전국 Half", "30,000대", "9,000만원"),
                 ("프리미엄 패키지", "10,000대", "4,000만원"),
                 ("오피스 패키지 (오피스텔)", "2,000대", "3,000만원")],
    },
    "gsa": {
        "note": "VAT 별도",
        "rows": [("전국", "16,000대", "5,000만원"), ("서울·수도권", "12,000대", "4,000만원"),
                 ("지방 전체", "4,000대", "1,600만원"), ("충북", "1,100대", "550만원"),
                 ("충남", "1,100대", "550만원"), ("대구", "1,100대", "550만원"),
                 ("세종", "455대", "300만원")],
    },
}

# 검색 수요에 맞춘 페이지별 문구 — 등록 키워드 184개 대조 결과 반영
COPY = {
    "townboard": ("전국 최대 커버리지", "아파트 단지 수·모니터 수 모두 1위인 아파트 엘리베이터 TV 매체입니다."),
    "fmk": ("도달 인구 최다", "수도권 아파트·오피스텔에 집중된 엘리베이터 매체로, 도달 인구 규모가 가장 큽니다."),
    "gsa": ("15초·30초 선택", "소재 길이에 따라 단가가 갈리는 아파트 엘리베이터 매체입니다."),
    "officebiz": ("사무실 직장인", "오피스 빌딩 엘리베이터에서 상주 직장인과 방문 고객에게 노출됩니다."),
    "primeliving": ("도심 주상복합", "CBD·GBD 등 핵심 업무권역의 주상복합·레지던스 매체입니다."),
    "asa": ("프라임 오피스", "CBD·GBD·YBD 핵심 업무권역 프라임 오피스 빌딩 매체입니다."),
}

nets = json.load(open(NET_SRC, encoding="utf-8"))["networks"]
sites = json.load(open(SITE_SRC, encoding="utf-8"))


def esc(s):
    return html.escape(str(s or ""), quote=True)


def n_(v):
    return f"{int(v):,}"


def won(v):
    v = int(v)
    if v >= 100000000:
        e = v / 100000000
        return (f"{e:.1f}".rstrip("0").rstrip(".")) + "억원"
    if v >= 10000:
        return f"{round(v / 10000):,}만원"
    return f"{v:,}원"


def unit_range(nid):
    """대당 단가 범위 — 이상치 제외"""
    v = [x["unitPrice"] for x in sites.get(nid, [])
         if x.get("unitPrice") and x["unitPrice"] < UNIT_MAX]
    return (min(v), max(v)) if v else None


def example(nid):
    """계산 예시 — 모니터 수 중앙값 단지 중 세대가 가장 큰 곳"""
    v = [x for x in sites.get(nid, []) if x.get("monitors") and x.get("monthlyCost")]
    if not v:
        return None
    med = int(st.median([x["monitors"] for x in v]))
    cand = [x for x in v if x["monitors"] == med] or v
    return sorted(cand, key=lambda y: -(y.get("households") or 0))[0]


HEADER = """<header class="hd"><div class="hd-in">
  <a class="hd-brand" href="index.html" aria-label="광고플레이 홈"><span class="brand-mark">AD</span><strong>광고플레이</strong></a>
  <nav class="hd-nav" aria-label="주요 메뉴">
    <a href="map.html">옥외광고 지도</a>
    <a class="on" href="media-catalog.html">옥외광고 목록</a>
    <a href="cases.html">광고집행사례</a>
    <a href="insights.html">광고 인사이트</a>
  </nav>
  <div class="hd-act">
    <a href="about.html">회사소개</a>
    <a href="login.html">로그인</a>
    <a href="join.html">회원가입</a>
  </div>
</div></header>"""

FOOTER = """
<footer class="site-foot"><div class="foot-inner">
  <nav class="foot-nav" aria-label="회사 정보 메뉴">
    <a href="about.html">회사소개</a><a href="terms.html">이용약관</a><a href="privacy.html">개인정보처리방침</a><a href="media-policy.html">매체관리규정</a>
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

CSS = """
 body{margin:0;background:#fff;font-family:var(--font-sans);color:#1c1c1c}
 :root{--shell-max:1760px;--dock-gutter:226px;--dock-top:145px;--dock-w:210px}
 :root{--shell-w:min(var(--shell-max),calc(100% - 40px))}
 .hd{position:sticky;top:0;z-index:30;border-bottom:1px solid #e9edf3;background:rgba(255,255,255,.98);font-family:var(--font-sans)}
 .hd-in{display:flex;align-items:center;gap:22px;min-height:54px;flex-wrap:wrap;box-sizing:border-box;
        width:var(--shell-w);margin:0 auto;padding-inline:var(--dock-gutter)}
 .hd-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;flex:none}
 .hd-brand strong{font-size:16px;font-weight:800;color:#0f172a}
 .hd-nav{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}
 .hd-act{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
 .hd a{font-size:14px;font-weight:650;color:#344054;text-decoration:none;white-space:nowrap;transition:color .15s ease,transform .15s ease}
 .hd-nav a:hover,.hd-act a:hover{color:#0b1b3f;transform:translateY(-2px)}
 .hd-nav a.on{color:#0b3a91;font-weight:750}
 .wrap{width:var(--shell-w);margin:0 auto;box-sizing:border-box;padding:22px var(--dock-gutter) 90px}
 .bc{font:13px/1.6 var(--font-sans);color:#8a8a8a;margin:0 0 8px}
 .bc a{color:#8a8a8a;text-decoration:none}
 h1{font:850 26px/1.3 var(--font-sans);margin:6px 0 10px}
 .lead{font:16px/1.75 var(--font-sans);color:#4a5568;margin:0 0 22px;max-width:860px}
 .lead b{color:#111827}
 h2{font:800 18px/1.4 var(--font-sans);margin:34px 0 12px}
 /* 핵심 수치 — 봇이 인용하는 자리라 텍스트로 */
 .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 6px}
 .stats div{border:1px solid #e8eaf0;border-radius:12px;padding:13px 15px}
 .stats dt{font:600 12px/1.4 var(--font-sans);color:#98a0ad;margin:0 0 3px}
 .stats dd{font:800 20px/1.3 var(--font-sans);color:#111827;margin:0}
 /* 브랜드별 섹션 (아파트/오피스 패키지 페이지) */
 .brand-sec{border:1px solid #e8eaf0;border-radius:14px;padding:18px 20px;margin:16px 0}
 .brand-head{display:flex;align-items:baseline;gap:12px;margin:0 0 4px}
 .brand-head h2{font:800 19px/1.4 var(--font-sans);margin:0;color:#111827}
 .brand-go{margin-left:auto;font:800 13px/1 var(--font-sans);color:#0b3a91;text-decoration:none;white-space:nowrap}
 .brand-go:hover{text-decoration:underline}
 .brand-edge{font:14px/1.6 var(--font-sans);color:#4a5568;margin:0 0 12px}
 .brand-price{font:14.5px/1.6 var(--font-sans);color:#172033;margin:10px 0 8px}
 .brand-price b{color:#0b3a91}
 table.t{border-collapse:collapse;width:100%;font:14px/1.6 var(--font-sans);margin:0 0 6px}
 table.t th,table.t td{border:1px solid #e8e8e8;padding:9px 12px;text-align:left}
 table.t th{background:#f8fafc;font-weight:700;color:#333;white-space:nowrap}
 table.t td.num{text-align:right;font-variant-numeric:tabular-nums}
 /* 계산식 — 이 상품의 논리 그 자체 */
 .calc{border:1px solid #e2e7f0;border-radius:12px;padding:16px 18px;background:#fbfcfe;margin:0 0 8px;max-width:520px}
 .calc p{margin:0;font:15px/1.7 var(--font-sans);color:#2b3242}
 .calc .eq{font:800 22px/1.4 var(--font-sans);color:#0b3a91;margin-top:6px}
 .pkg-note{font:12.5px/1.6 var(--font-sans);color:#8a8a8a;margin:8px 0 0}
 .note{font:12.5px/1.7 var(--font-sans);color:#9a9a9a;margin-top:10px}
 .warn{border:1px solid #f0d8a8;background:#fdf8ee;border-radius:12px;padding:12px 15px;margin:0 0 8px}
 .warn p{margin:0;font:14px/1.6 var(--font-sans);color:#8a5a12}
 .faq details{border-bottom:1px solid #eee;padding:12px 2px}
 .faq summary{font:700 15px/1.5 var(--font-sans);cursor:pointer}
 .faq p{margin:8px 0 0;font:14px/1.7 var(--font-sans);color:#333}
 /* 상품 카드(허브) */
 .prod{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin:12px 0 0}
 .prod a{border:1px solid #e8eaf0;border-radius:12px;padding:15px 17px;text-decoration:none;color:inherit;display:block;transition:border-color .15s ease}
 .prod a:hover{border-color:#3b74f2}
 .prod .kk{display:inline-block;font:700 11.5px/1 var(--font-sans);color:#0b3a91;background:#eef4ff;border-radius:999px;padding:6px 10px;margin:0 0 9px}
 .prod h3{font:750 18px/1.4 var(--font-sans);margin:0 0 5px;color:#111827}
 .prod p{font:13.5px/1.6 var(--font-sans);color:#6b7280;margin:0 0 10px}
 .prod .fig{font:800 15px/1.4 var(--font-sans);color:#172033}
 .prod .go{font:800 12.5px/1 var(--font-sans);color:#0b3a91;margin-top:9px;display:block}
 .cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
 .cta a{font:700 15px/1 var(--font-sans);padding:15px 24px;border-radius:11px;text-decoration:none}
 .cta .p{background:#0b3a91;color:#fff}
 .cta .s{background:#f2f2f2;color:#222}
 .site-foot{border-top:1px solid #e9e9ee;background:#fafafb;margin-top:56px}
 .foot-inner{width:var(--shell-w);margin:0 auto;box-sizing:border-box;padding:26px var(--dock-gutter) 34px}
 .foot-nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-bottom:16px}
 .foot-nav a{color:#33363d;text-decoration:none;font:600 13.5px/1 var(--font-sans)}
 .foot-info{display:flex;flex-wrap:wrap;gap:6px 20px;font-style:normal;font:13px/1.7 var(--font-sans);color:#5c616b}
 .foot-info b{color:#33363d;font-weight:650;margin-right:4px}
 .foot-copy{margin:14px 0 0;font:12.5px/1.6 var(--font-sans);color:#9a9ea7}
 /* 우측 플로팅 도크 — 매체 목록·지도와 동일 */
 .viewtog{position:fixed;top:var(--dock-top);z-index:19;display:flex;flex-direction:column;gap:5px;
          width:var(--dock-w);right:auto;
          left:calc(50% + var(--shell-w)/2 - var(--dock-gutter) + (var(--dock-gutter) - var(--dock-w))/2)}
 .viewtog a{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid #e2e7f0;border-radius:11px;
            background:#fff;text-decoration:none;font:700 13px/1.3 var(--font-sans);color:#2b3242;
            box-shadow:none;transition:border-color .15s ease}
 .viewtog a:hover{border-color:#3b74f2}
 .viewtog a[hidden]{display:none}
 .viewtog .ic{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:6px;background:#eaf0ff;color:#0b3a91}
 .viewtog .ic svg{width:14px;height:14px;flex:none}
 .viewtog .consult .ic,.viewtog .favlink .ic{background:#0b3a91;color:#fff}
 .viewtog .favlink svg{fill:none;stroke:currentColor}
 .viewtog b{margin-left:auto;font:800 10px/1 var(--font-sans);color:#fff;background:#0b3a91;border-radius:999px;padding:3px 7px}
 @media(max-width:1079px){.hd-in,.wrap,.foot-inner{padding-inline:0}
   .viewtog{right:10px;left:10px;top:auto;bottom:10px;width:auto;flex-direction:row;flex-wrap:wrap;justify-content:center}
   .viewtog a{flex:1 1 auto;justify-content:center;padding:9px 10px;font-size:12.5px}
   .wrap{padding-bottom:100px}}
 @media(max-width:900px){.hd-in{gap:12px;min-height:50px}.hd a{font-size:13px}}
"""

# 우측 플로팅 도크 — 매체 목록과 동일 구성(지도로 보기 / 목록으로 보기 / 상담신청 / 관심매체 비교)
DOCK = ('<div class="viewtog">'
        '<a href="map.html"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/><path d="M9 3v15M15 6v15"/></svg></span>지도로 보기</a>'
        '<a href="media-catalog.html"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></span>목록으로 보기</a>'
        '<a class="consult" href="estimate.html"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.4-.6L3 21l1.7-5a8.2 8.2 0 0 1-.7-3.4 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.6 7.9z"/></svg></span>상담신청</a>'
        '<a class="favlink" id="favBar" href="map.html" hidden><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="7" height="14" rx="1.5"/><rect x="13.5" y="5" width="7" height="14" rx="1.5"/></svg></span>관심매체 비교<b id="favCount">0</b></a>'
        '</div>')
FAV_SCRIPT = '\n<script src="assets/js/catalog-fav.js?v=fav-20260717a"></script>'


def head(title, desc, canon, ld):
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>' for o in ld)
    return f"""<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canon}">
<link rel="stylesheet" href="assets/css/styles.css">
{ld_html}
<style>{CSS}</style></head><body>
{HEADER}"""


def region_table(net):
    rs = sorted(net.get("regions", []), key=lambda r: -r["monitors"])
    if not rs:
        return ""
    rows = "".join(f'<tr><th>{esc(r["name"])}</th><td class="num">{n_(r["complexes"])}</td>'
                   f'<td class="num">{n_(r["monitors"])}</td></tr>' for r in rs)
    unit = "빌딩" if net["type"] == "office" else "단지"
    return (f'<h2>지역별 분포</h2><table class="t">'
            f'<tr><th>지역</th><th style="text-align:right">{unit}</th><th style="text-align:right">모니터</th></tr>'
            f'{rows}</table>')


def product_page(net):
    nid = net["id"]
    brand, typ = net["brand"], net["type"]
    place = "아파트" if typ == "apartment" else "오피스"
    unit_word = "단지" if typ == "apartment" else "빌딩"
    kicker, blurb = COPY.get(nid, ("", ""))
    is_pkg = net.get("saleUnit") == "package"
    ur = unit_range(nid)
    ex = example(nid)

    # 핵심 수치
    st_items = [("보유 " + unit_word, f'{n_(net["complexes"])}곳'), ("모니터", f'{n_(net["monitors"])}대')]
    if net.get("households"):
        st_items.append(("도달 세대", f'{n_(net["households"])}세대'))
    if net.get("population"):
        st_items.append(("도달 인구", f'{n_(net["population"])}명'))
    stats = "".join(f"<div><dt>{esc(a)}</dt><dd>{esc(b)}</dd></div>" for a, b in st_items)

    # 판매 방식 — 이 상품의 핵심
    if is_pkg:
        sale = (f'<h2>판매 방식</h2>'
                f'<div class="warn"><p><b>권역 패키지 전용</b> — {unit_word} 단위 개별 판매는 하지 않습니다. '
                f'집행 가능 권역과 비용은 상담으로 안내해 드립니다.</p></div>')
    else:
        lo, hi = ur if ur else (0, 0)
        # 30초 소재 단가.
        #  · 미디어믿(gsa): 데이터에 실측값(unitPrice30) 있음 → 그대로.
        #  · 타운보드·포커스: 엑셀에 30초 컬럼 없음. "15초의 2배" 규칙(대표님 확인) → 계산.
        u30 = ""
        v30 = [x["unitPrice30"] for x in sites.get(nid, []) if x.get("unitPrice30")]
        if v30:
            u30 = (f'<p style="margin-top:9px">30초 소재: 대당 월 <b>{n_(min(v30))}~{n_(max(v30))}원</b> '
                   f'(15초의 약 1.75배)</p>')
        elif nid in ("townboard", "fmk") and ur:
            u30 = (f'<p style="margin-top:9px">30초 소재: 대당 월 <b>{n_(lo * 2)}~{n_(hi * 2)}원</b> '
                   f'(15초의 2배)</p>')
        calc = ""
        if ex:
            calc = (f'<div class="calc"><p>{esc(ex["name"])} · 모니터 {ex["monitors"]}대</p>'
                    f'<p class="eq">{ex["monitors"]}대 × {n_(ex["unitPrice"])}원 = 월 {n_(ex["monthlyCost"])}원</p></div>')
        sale = (f'<h2>광고비 — {unit_word} 단위</h2>'
                f'<p class="lead">{unit_word} 하나를 통째로 집행하며, <b>모니터 수 × 대당 단가</b>가 월 광고비입니다. '
                f'대당 월 <b>{n_(lo)}~{n_(hi)}원</b>이며 단가는 <b>지역별로 다릅니다</b>.{u30}</p>'
                f'{calc}<p class="note">VAT 별도. 정확한 비용과 구좌 가능 여부는 상담 시 확정됩니다.</p>')

    # 패키지표
    pkg = ""
    if nid in PACKAGES:
        p = PACKAGES[nid]
        rows = "".join(f'<tr><th>{esc(a)}</th><td class="num">{esc(b)}</td><td class="num">{esc(c)}</td></tr>'
                       for a, b, c in p["rows"])
        pkg = (f'<h2>대량 집행 패키지</h2>'
               f'<p class="lead">전국·권역 단위로 묶어 집행하는 옵션입니다.</p>'
               f'<table class="t"><tr><th>패키지</th><th style="text-align:right">수량</th>'
               f'<th style="text-align:right">월 비용</th></tr>{rows}</table>'
               f'<p class="pkg-note">{esc(p["note"])} · VAT 별도</p>')

    spec = "".join(f"<tr><th>{esc(a)}</th><td>{esc(b)}</td></tr>" for a, b in [
        ("매체 유형", f"{place} 엘리베이터 광고"), ("규격", net.get("spec")),
        ("설치 위치", net.get("placement")), ("타깃", net.get("target")),
        ("운영사", net.get("vendor")),
    ] if b)

    # FAQ — 검색·AI 질문 형태 그대로
    faqs = []
    if is_pkg:
        faqs.append((f"{brand} 광고는 어떻게 집행하나요?",
                     f"{brand}은 권역 패키지 전용입니다. {unit_word} 하나만 골라 집행할 수는 없고, "
                     f"CBD·GBD 등 권역 단위로 묶어 집행합니다. 비용은 상담으로 안내해 드립니다."))
    else:
        lo, hi = ur if ur else (0, 0)
        faqs.append((f"{brand} 광고 비용은 얼마인가요?",
                     f"{unit_word} 단위로 판매하며 모니터 대당 월 {n_(lo)}~{n_(hi)}원입니다(VAT 별도). "
                     + (f"예를 들어 {ex['name']}은 모니터 {ex['monitors']}대라 월 {n_(ex['monthlyCost'])}원입니다. " if ex else "")
                     + "단가는 지역별로 다릅니다."))
        faqs.append((f"{unit_word} 하나만 골라서 광고할 수 있나요?",
                     f"네. {brand}은 {unit_word} 단위로 판매합니다. 원하는 {unit_word}를 골라 그곳의 모니터 전체에 "
                     f"송출하는 방식이라, 동네 상권 홍보처럼 좁은 범위 집행에 적합합니다."))
    faqs.append((f"{brand}은 어디에 몇 개나 있나요?",
                 f"{net['complexes']:,}곳 {unit_word}에 모니터 {net['monitors']:,}대를 운영합니다."
                 + (f" 도달 세대는 약 {n_(net['households'])}세대입니다." if net.get("households") else "")))
    faq_html = "".join(f"<details{' open' if i == 0 else ''}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>"
                       for i, (q, a) in enumerate(faqs))

    title = f"{brand} – {place} 엘리베이터 광고 비용·매체 정보 | 광고플레이"
    desc = (f"{brand} {place} 엘리베이터 광고 — {n_(net['complexes'])}곳 {unit_word}, 모니터 {n_(net['monitors'])}대. "
            + (f"{unit_word} 단위 집행, 대당 월 {n_(ur[0])}~{n_(ur[1])}원." if (ur and not is_pkg) else "권역 패키지 전용.")
            + " 규격·지역 분포·집행 방식을 확인하세요.")
    canon = f"{BASE}/elevator-{SLUG[nid]}.html"

    ld = [
        {"@context": "https://schema.org", "@type": "Product",
         "name": f"{brand} {place} 엘리베이터 광고", "category": "엘리베이터 광고",
         "description": blurb, "brand": {"@type": "Organization", "name": "광고플레이"},
         "offers": {"@type": "Offer", "priceCurrency": "KRW",
                    "price": (ur[0] if (ur and not is_pkg) else 0),
                    "availability": "https://schema.org/InStock",
                    "priceSpecification": {"@type": "UnitPriceSpecification",
                                           "price": (ur[0] if (ur and not is_pkg) else 0),
                                           "priceCurrency": "KRW",
                                           "unitText": "모니터 1대 월" if not is_pkg else "패키지"},
                    "seller": {"@type": "Organization", "name": "광고플레이", "url": f"{BASE}/"}}},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q,
                         "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "옥외광고 매체", "item": f"{BASE}/media-catalog.html"},
            {"@type": "ListItem", "position": 3, "name": "엘리베이터 광고", "item": f"{BASE}/elevator.html"},
            {"@type": "ListItem", "position": 4, "name": brand, "item": canon}]},
    ]

    return head(title, desc, canon, ld) + f"""
<main class="wrap">
{DOCK}
<p class="bc"><a href="index.html">홈</a> › <a href="media-catalog.html">옥외광고 매체</a> › <a href="elevator.html">엘리베이터 광고</a> › {esc(brand)}</p>
<h1>{esc(brand)} — {esc(place)} 엘리베이터 광고</h1>
<p class="lead">{esc(blurb)}</p>
<dl class="stats">{stats}</dl>
{sale}
<h2>매체 규격</h2>
<table class="t">{spec}</table>
{region_table(net)}
{pkg}
<h2>자주 묻는 질문</h2>
<div class="faq">{faq_html}</div>
<div class="cta">
  <a class="p" href="estimate.html?cat=elevator">상담 신청</a>
  <a class="s" href="map.html">지도에서 {esc(unit_word)} 찾기</a>
</div>
</main>""" + FOOTER + FAV_SCRIPT + """</body></html>"""


def hub_page():
    apt = [n for n in nets if n["type"] == "apartment"]
    off = [n for n in nets if n["type"] == "office"]
    tot_c = sum(n["complexes"] for n in nets)
    tot_m = sum(n["monitors"] for n in nets)
    tot_h = sum(n["households"] for n in nets)

    def cards(group):
        out = ""
        for n in group:
            nid = n["id"]
            kicker, blurb = COPY.get(nid, ("", ""))
            ur = unit_range(nid)
            is_pkg = n.get("saleUnit") == "package"
            fig = (f'대당 월 {n_(ur[0])}~{n_(ur[1])}원' if (ur and not is_pkg) else "권역 패키지 전용")
            unit_word = "단지" if n["type"] == "apartment" else "빌딩"
            out += (f'<a href="elevator-{SLUG[nid]}.html">'
                    f'<span class="kk">{esc(kicker)}</span>'
                    f'<h3>{esc(n["brand"])}</h3>'
                    f'<p>{esc(unit_word)} {n_(n["complexes"])}곳 · 모니터 {n_(n["monitors"])}대</p>'
                    f'<span class="fig">{esc(fig)}</span>'
                    f'<span class="go">비용·지역 분포 자세히 →</span></a>')
        return out

    rows = "".join(
        f'<tr><th>{esc(n["brand"])}</th><td>{"아파트" if n["type"]=="apartment" else "오피스"}</td>'
        f'<td class="num">{n_(n["complexes"])}</td><td class="num">{n_(n["monitors"])}</td>'
        f'<td>{"권역 패키지" if n.get("saleUnit")=="package" else ("단지 단위" if n["type"]=="apartment" else "빌딩 단위")}</td>'
        f'<td>{(f"대당 월 {n_(unit_range(n['id'])[0])}~{n_(unit_range(n['id'])[1])}원" if (unit_range(n["id"]) and n.get("saleUnit")!="package") else "상담")}</td></tr>'
        for n in nets)

    faqs = [
        ("아파트 엘리베이터 광고 비용은 얼마인가요?",
         "단지 단위로 집행하며 모니터 대당 월 8,000~15,000원입니다(VAT 별도). 단가는 지역별로 다릅니다. "
         "모니터 5대 단지는 월 5만원, 14대 단지는 월 14만원 수준으로, 옥외광고 중 가장 접근성이 높습니다."),
        ("엘리베이터 광고는 어떻게 집행하나요?",
         "원하는 단지를 골라 그 단지의 엘리베이터 모니터 전체에 송출하는 방식입니다. "
         "모니터 수 × 대당 단가가 월 광고비이며, 1일 15초 영상 90~100회 송출이 보장됩니다."),
        ("광고플레이는 엘리베이터 매체를 얼마나 보유하고 있나요?",
         f"아파트·오피스 합쳐 {n_(tot_c)}곳, 모니터 {n_(tot_m)}대를 운영합니다. "
         f"도달 세대는 약 {n_(tot_h)}세대입니다."),
        ("아파트와 오피스 중 어디가 좋나요?",
         "타깃이 다릅니다. 아파트는 주거 가구(가족 단위 소비)에, 오피스는 상주 직장인과 방문 고객에게 닿습니다. "
         "동네 상권·생활 밀착 업종은 아파트가, B2B·직장인 타깃은 오피스가 적합합니다."),
    ]
    faq_html = "".join(f"<details{' open' if i == 0 else ''}><summary>{esc(q)}</summary><p>{esc(a)}</p></details>"
                       for i, (q, a) in enumerate(faqs))

    title = "엘리베이터 광고 – 아파트·오피스 승강기 모니터 광고 비용 | 광고플레이"
    desc = (f"아파트·오피스 엘리베이터 광고 {n_(tot_c)}곳, 모니터 {n_(tot_m)}대. "
            f"단지 단위로 대당 월 8,000~15,000원부터 집행할 수 있습니다. "
            f"타운보드·포커스·미디어믿 등 상품별 비용과 지역 분포를 비교하세요.")
    canon = f"{BASE}/elevator.html"
    ld = [
        {"@context": "https://schema.org", "@type": "CollectionPage",
         "name": "엘리베이터 광고 | 광고플레이", "url": canon,
         "about": ["엘리베이터 광고", "아파트 엘리베이터 광고", "승강기 광고", "오피스 엘리베이터 광고"],
         "isPartOf": {"@type": "WebSite", "name": "광고플레이", "url": f"{BASE}/"},
         "hasPart": [{"@type": "Product", "name": n["brand"],
                      "url": f"{BASE}/elevator-{SLUG[n['id']]}.html"} for n in nets]},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q,
                         "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "옥외광고 매체", "item": f"{BASE}/media-catalog.html"},
            {"@type": "ListItem", "position": 3, "name": "엘리베이터 광고", "item": canon}]},
    ]

    return head(title, desc, canon, ld) + f"""
<main class="wrap">
{DOCK}
<p class="bc"><a href="index.html">홈</a> › <a href="media-catalog.html">옥외광고 매체</a> › 엘리베이터 광고</p>
<h1>엘리베이터 광고</h1>
<p class="lead">아파트·오피스 엘리베이터 모니터에 영상 광고를 집행합니다.
<b>단지 하나를 골라 월 5만원대</b>부터 시작할 수 있어, 옥외광고 중 가장 접근성이 높습니다.</p>
<dl class="stats">
  <div><dt>보유 단지·빌딩</dt><dd>{n_(tot_c)}곳</dd></div>
  <div><dt>모니터</dt><dd>{n_(tot_m)}대</dd></div>
  <div><dt>도달 세대</dt><dd>{n_(tot_h)}세대</dd></div>
  <div><dt>대당 월 광고비</dt><dd>8,000원~</dd></div>
</dl>
<h2>아파트 <span style="color:#8a8a8a;font-weight:600">— 주거 가구에 노출</span></h2>
<div class="prod">{cards(apt)}</div>
<h2>오피스 <span style="color:#8a8a8a;font-weight:600">— 상주 직장인·방문 고객에 노출</span></h2>
<div class="prod">{cards(off)}</div>
<h2>상품 비교</h2>
<table class="t">
<tr><th>상품</th><th>구분</th><th style="text-align:right">단지·빌딩</th><th style="text-align:right">모니터</th><th>판매 단위</th><th>광고비</th></tr>
{rows}
</table>
<p class="note">VAT 별도. 단가는 지역별로 다르며, 정확한 비용과 구좌 가능 여부는 상담 시 확정됩니다.</p>
<h2>자주 묻는 질문</h2>
<div class="faq">{faq_html}</div>
<div class="cta">
  <a class="p" href="estimate.html?cat=elevator">상담 신청</a>
  <a class="s" href="map.html">지도에서 단지 찾기</a>
</div>
</main>""" + FOOTER + FAV_SCRIPT + """</body></html>"""


# 브랜드별 한 줄 강점 — 억지 우열이 아니라 실제 데이터에 있는 특징만
BRAND_EDGE = {
    "townboard": "전국 최대 커버리지 · 25인치 내부 TV와 50·55인치 대기공간 게시판 두 형태",
    "fmk": "도달 인구 규모 최다 · 수도권 아파트·오피스텔 집중",
    "gsa": "15초·30초 소재 선택 가능 · 서울·경기 집중",
    "officebiz": "오피스 상주 직장인 + 방문 고객 · 프라임 오피스 밀집",
    "primeliving": "CBD·GBD 등 도심 핵심 권역 주상복합·레지던스 · 권역 패키지 전용",
    "asa": "CBD·GBD·YBD 핵심 업무권역 프라임 오피스 · 권역 패키지 전용",
}


def place_page(place):
    """아파트 / 오피스 패키지·상품 안내 — 지도 '패키지 상품 보기' 버튼의 착지 페이지.
    브랜드사별로 섹션을 나눠 규모·강점·패키지 단가표·개별 상세 링크를 싣는다."""
    typ = "apartment" if place == "apartment" else "office"
    ns = [n for n in nets if n["type"] == typ]
    label = "아파트" if typ == "apartment" else "오피스"
    uw = "단지" if typ == "apartment" else "빌딩"
    tot_c = sum(n["complexes"] for n in ns)
    tot_m = sum(n["monitors"] for n in ns)

    # 상단 요약 그리드 — 이 페이지 상품들을 한눈에(매체 목록 섹션과 동일한 카드)
    grid = ""
    for n in ns:
        nid = n["id"]; ur = unit_range(nid); pkg = n.get("saleUnit") == "package"
        kicker = COPY.get(nid, ("", ""))[0]
        fig = f'대당 월 {n_(ur[0])}~{n_(ur[1])}원' if (ur and not pkg) else "권역 패키지"
        grid += (f'<a href="#{nid}">'
                 f'<span class="kk">{esc(kicker)}</span>'
                 f'<h3>{esc(n["brand"])}</h3>'
                 f'<p>{uw} {n_(n["complexes"])}곳 · 모니터 {n_(n["monitors"])}대</p>'
                 f'<span class="fig">{esc(fig)}</span></a>')

    secs = ""
    for n in ns:
        nid = n["id"]; ur = unit_range(nid)
        pkg = n.get("saleUnit") == "package"
        edge = BRAND_EDGE.get(nid, "")
        # 판매 방식
        if pkg:
            price_line = f'<b>권역 패키지 전용</b> · {uw} 개별 판매 없음'
        else:
            price_line = f'{uw} 단위 · 대당 월 <b>{n_(ur[0])}~{n_(ur[1])}원</b>(지역별 상이)' if ur else '단가 상담'
        # 패키지표(있는 상품만)
        pkg_tbl = ""
        if nid in PACKAGES:
            p = PACKAGES[nid]
            rows = "".join(f'<tr><th>{esc(a)}</th><td class="num">{esc(b)}</td><td class="num">{esc(c)}</td></tr>'
                           for a, b, c in p["rows"])
            pkg_tbl = (f'<table class="t"><tr><th>패키지</th><th style="text-align:right">수량</th>'
                       f'<th style="text-align:right">월 비용</th></tr>{rows}</table>'
                       f'<p class="pkg-note">{esc(p["note"])} · VAT 별도</p>')
        secs += (
            f'<section class="brand-sec" id="{nid}">'
            f'<div class="brand-head"><h2>{esc(n["brand"])}</h2>'
            f'<a class="brand-go" href="elevator-{SLUG[nid]}.html">개별 상세 →</a></div>'
            f'<p class="brand-edge">{esc(edge)}</p>'
            f'<dl class="stats">'
            f'<div><dt>보유 {uw}</dt><dd>{n_(n["complexes"])}곳</dd></div>'
            f'<div><dt>모니터</dt><dd>{n_(n["monitors"])}대</dd></div>'
            + (f'<div><dt>도달 세대</dt><dd>{n_(n["households"])}세대</dd></div>' if n.get("households") else "")
            + (f'<div><dt>도달 인구</dt><dd>{n_(n["population"])}명</dd></div>' if n.get("population") else "")
            + f'</dl>'
            f'<p class="brand-price">{price_line}</p>'
            f'{pkg_tbl}'
            f'</section>')

    title = f"{label} 엘리베이터 광고 – 상품·패키지 비교(브랜드별) | 광고플레이"
    desc = (f"{label} 엘리베이터 광고 상품을 브랜드별로 비교합니다. {uw} {n_(tot_c)}곳·모니터 {n_(tot_m)}대. "
            f"단지 단위 단가와 전국·권역 패키지 비용을 한눈에 확인하세요.")
    canon = f"{BASE}/elevator-{place}.html"
    ld = [
        {"@context": "https://schema.org", "@type": "CollectionPage",
         "name": f"{label} 엘리베이터 광고 | 광고플레이", "url": canon,
         "about": [f"{label} 엘리베이터 광고", "엘리베이터 광고", "승강기 광고"],
         "isPartOf": {"@type": "WebSite", "name": "광고플레이", "url": f"{BASE}/"},
         "hasPart": [{"@type": "Product", "name": n["brand"],
                      "url": f"{BASE}/elevator-{SLUG[n['id']]}.html"} for n in ns]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE}/"},
            {"@type": "ListItem", "position": 2, "name": "옥외광고 매체", "item": f"{BASE}/media-catalog.html"},
            {"@type": "ListItem", "position": 3, "name": "엘리베이터 광고", "item": f"{BASE}/elevator.html"},
            {"@type": "ListItem", "position": 4, "name": f"{label} 상품·패키지", "item": canon}]},
    ]
    return head(title, desc, canon, ld) + f"""
<main class="wrap">
{DOCK}
<p class="bc"><a href="index.html">홈</a> › <a href="media-catalog.html">옥외광고 매체</a> › <a href="elevator.html">엘리베이터 광고</a> › {label} 상품·패키지</p>
<h1>{label} 엘리베이터 광고 — 상품·패키지 비교</h1>
<p class="lead">{label} 엘리베이터 광고를 <b>브랜드(매체망)별</b>로 정리했습니다.
같은 {uw} 단위 상품이라도 커버리지·강점·패키지 단가가 다릅니다.
아래에서 비교하고, 개별 {uw}는 지도·목록에서 위치로 골라 바로 집행할 수 있습니다.</p>
<dl class="stats">
  <div><dt>{label} {uw}</dt><dd>{n_(tot_c)}곳</dd></div>
  <div><dt>모니터</dt><dd>{n_(tot_m)}대</dd></div>
  <div><dt>매체 브랜드</dt><dd>{len(ns)}개 망</dd></div>
</dl>
<h2>상품 한눈에 보기</h2>
<div class="prod">{grid}</div>
<h2>브랜드별 상세·패키지</h2>
{secs}
<div class="cta">
  <a class="p" href="estimate.html?cat=elevator">상담 신청</a>
  <a class="s" href="map.html">지도에서 {uw} 찾기</a>
</div>
</main>""" + FOOTER + FAV_SCRIPT + """</body></html>"""


def main():
    open("elevator.html", "w", encoding="utf-8").write(hub_page())
    for n in nets:
        open(f"elevator-{SLUG[n['id']]}.html", "w", encoding="utf-8").write(product_page(n))
    open("elevator-apartment.html", "w", encoding="utf-8").write(place_page("apartment"))
    open("elevator-office.html", "w", encoding="utf-8").write(place_page("office"))
    print(f"생성: elevator.html + 상품 {len(nets)}장 + 아파트/오피스 패키지 2장")
    for n in nets:
        print(f"   · elevator-{SLUG[n['id']]}.html  ({n['brand']})")
    print("   · elevator-apartment.html / elevator-office.html")


if __name__ == "__main__":
    main()
