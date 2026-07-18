# -*- coding: utf-8 -*-
"""
build-insights.py — '광고 인사이트' 콘텐츠(전광판 인사이트) 정적 페이지 생성기.
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
    # 허브 목록에 노출할 핵심 수치 — 사진 대신 '데이터'로 보여주는 카드의 재료
    "stats": [("월 광고비", "1,200만원~"), ("일평균 유동인구", "22.9만명"), ("규격", "12.0×18.5m")],
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
    "stats": [("월 광고비", "1,200만원~"), ("일평균 유동인구", "25.4만명"), ("규격", "20.3×11.0m")],
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
    # 적선빌딩은 반경 500m 유동인구 실측치가 없어 '행사 체류 인원'(원자료 값)으로 대체
    "stats": [("월 광고비", "500만원~"), ("행사 체류", "1만여명"), ("규격", "19.0×10.0m")],
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
    /* 페이지 공통 골격 — 헤더·본문·도크가 모두 이 기준선을 쓴다(옥외광고 매체 페이지와 동일) */
    :root{--shell-max:1760px;--dock-gutter:226px;--dock-top:145px;--dock-w:210px}
    /* 본문 폭 — 헤더·본문·푸터·도크가 모두 이 값을 공유해야 어긋나지 않는다 */
    :root{--shell-w:min(var(--shell-max),calc(100% - 40px))}
    /* 헤더 — 지도 페이지(.map-global-header)와 동일: 높이 54px, 14px/650, #344054, SUIT */
    .hd{position:sticky;top:0;z-index:30;border-bottom:1px solid #e9edf3;
        background:#fff;font-family:var(--font-sans)}
    /* 헤더 내용도 본문과 같은 기준선에 맞춘다 */
    .hd-in{display:flex;align-items:center;gap:22px;min-height:54px;flex-wrap:wrap;box-sizing:border-box;
           width:min(var(--shell-max),calc(100% - 40px));margin:0 auto;padding-inline:var(--dock-gutter)}
    .hd-brand{display:inline-flex;align-items:center;gap:10px;text-decoration:none;flex:none}
    .hd-brand strong{font-size:16px;font-weight:800;color:#0f172a}
    .hd-nav{margin-left:auto;display:flex;align-items:center;gap:22px;flex-wrap:wrap}
    .hd-act{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
    .hd a{font-size:14px;font-weight:650;color:#344054;text-decoration:none;white-space:nowrap;transition:color .15s ease,transform .15s ease}
    .hd-nav a:hover,.hd-nav a:focus,.hd-act a:hover,.hd-act a:focus{color:#0b1b3f;transform:translateY(-2px)}
    .hd-nav a.on,.hd-act a.on{color:#0b3a91;font-weight:750}
    /* 본문도 옥외광고 매체 페이지와 같은 폭·기준선을 쓴다 */
    .ins-wrap{width:min(var(--shell-max),calc(100% - 40px));margin:0 auto;box-sizing:border-box;
              padding:22px var(--dock-gutter) 90px;font-family:var(--font-sans);color:#1c1c1c}
    /* 1080px 미만은 도크 자리를 뺄 여유가 없다 → 도크는 하단 가로 바, 본문은 여백 해제 */
    @media(max-width:1079px){
      .hd-in{padding-inline:0}
      .ins-wrap{padding-inline:0;padding-bottom:100px}
      .viewtog{right:10px;left:10px;top:auto;bottom:10px;width:auto;flex-direction:row;flex-wrap:wrap;justify-content:center}
      .viewtog a{flex:1 1 auto;justify-content:center;padding:9px 10px;font-size:12.5px}}
    @media(max-width:900px){.hd-in{gap:12px;min-height:50px}.hd-nav{gap:14px}.hd-act{gap:12px}.hd a{font-size:13px}}
    /* 우측 플로팅 메뉴판 — 지도 도크(.gps-dock/.gps-svc)와 동일한 형태. top은 본문 시작선에 맞춤 */
    /* 좌우는 본문 오른쪽 여백(--dock-gutter)의 정중앙에 놓는다 */
    .viewtog{position:fixed;top:var(--dock-top);z-index:19;display:flex;flex-direction:column;gap:5px;
             width:var(--dock-w);right:auto;
             left:calc(50% + var(--shell-w)/2 - var(--dock-gutter) + (var(--dock-gutter) - var(--dock-w))/2)}
    .viewtog a{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid #e2e7f0;border-radius:11px;
               background:rgba(255,255,255,.97);text-decoration:none;font:700 13px/1.3 var(--font-sans);color:#2b3242;
               box-shadow:none;transition:border-color .15s ease}
    .viewtog a:hover{border-color:#3b74f2}
    .viewtog a[hidden]{display:none}  /* display:flex가 hidden 속성을 덮어써서 명시 필요 */
    .viewtog .ic{width:22px;height:22px;flex:none;display:grid;place-items:center;border-radius:6px;
                 background:#eaf0ff;color:#0b3a91}
    .viewtog .ic svg{width:14px;height:14px;flex:none}
    .viewtog .consult .ic{background:#0b3a91;color:#fff}
    .ins-bc{font:13px/1.6 var(--font-sans);color:#8a8a8a;margin:0 0 8px}
    .ins-bc a{color:#8a8a8a;text-decoration:none}
    .ins-wrap h1{font:850 26px/1.3 var(--font-sans);margin:6px 0 8px}
    .ins-meta{font:13px/1.6 var(--font-sans);color:#888;margin:0 0 16px}
    .ins-hero{width:100%;height:auto;border-radius:14px;display:block;margin:0 0 16px}
    .ins-lead{font:17px/1.75 var(--font-sans);color:#2a2a2a;margin:0 0 14px}
    /* 인사이트 목록 상단 제목·설명을 헤더(54px) 밑에 불투명 고정 — 옥외광고 목록과 동일.
       (상세 기사에는 .ins-sticky를 두지 않아 영향 없음) */
    .ins-sticky{position:sticky;top:calc(var(--hd-h,54px) - 1px);z-index:20;background:#fff;padding:16px 0 10px}
    /* 헤더와 블록 사이 미세 어긋남으로 스크롤된 콘텐츠가 비쳐 '줄'이 생기던 것 차단 */
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
    .ins-why{margin:0}
    .ins-why b{display:block;color:#0b3a91;font:700 15px/1.5 var(--font-sans);margin-top:12px}
    .ins-why p{margin:2px 0 0;font:15px/1.75 var(--font-sans);color:#2a2a2a}
    .faq details{border-bottom:1px solid #eee;padding:13px 2px}
    .faq summary{font:700 16px/1.5 var(--font-sans);cursor:pointer;color:#181818}
    .faq p{margin:9px 0 0;font:15px/1.75 var(--font-sans);color:#333}
    .ins-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
    .ins-cta a{display:inline-block;font:700 15px/1 var(--font-sans);padding:15px 24px;border-radius:11px;text-decoration:none}
    .ins-cta .p{background:#0b3a91;color:#fff}
    .ins-cta .s{background:#f2f2f2;color:#222}
    /* 인사이트 목록 — 매체 목록(사진 그리드)과 목적이 달라 보이도록 '읽는 문서' 형태로 간다.
       사진 대신 핵심 수치를 앞세운 편집형 인덱스: 얇은 구분선, 큰 번호, 여백 위주. */
    .ins-sec{margin-top:38px}
    .ins-sec-head{display:flex;align-items:baseline;gap:10px;padding-bottom:2px}
    .ins-sec-head h2{font:800 18px/1.4 var(--font-sans);margin:0;padding:0}
    .ins-sec-head span{font:13px/1 var(--font-sans);color:#9aa1ad}
    .ins-index{list-style:none;margin:12px 0 0;padding:0;border-top:1px solid #ececf1}
    .ins-index li{border-bottom:1px solid #ececf1}
    .ins-index a{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:20px;align-items:center;
                 padding:26px 10px;text-decoration:none;color:inherit;transition:background .15s ease}
    .ins-index a:hover{background:#f8fafc}
    .ins-index .num{align-self:start;font:800 19px/1.3 var(--font-sans);color:#ccd2de}
    .ins-index .kicker{display:inline-block;font:700 11.5px/1 var(--font-sans);color:#0b3a91;
                       background:#eef4ff;border-radius:999px;padding:6px 10px;margin:0 0 10px}
    .ins-index h3{font:750 20px/1.4 var(--font-sans);margin:0 0 5px;padding:0;color:#111827}
    .ins-index .sub{font:14px/1.6 var(--font-sans);color:#6b7280;margin:0 0 14px}
    .ins-index .stats{display:flex;flex-wrap:wrap;gap:12px 30px;margin:0;padding:0}
    .ins-index .stats div{min-width:0}
    .ins-index .stats dt{font:600 12px/1.4 var(--font-sans);color:#98a0ad;margin:0 0 2px}
    .ins-index .stats dd{font:800 17px/1.35 var(--font-sans);color:#172033;margin:0}
    .ins-index .go{font:800 13px/1 var(--font-sans);color:#0b3a91;white-space:nowrap;display:inline-flex;align-items:center}
    .ins-index .go::after{content:"";width:6px;height:6px;margin-left:7px;border-top:2px solid currentColor;
                          border-right:2px solid currentColor;transform:rotate(45deg)}
    /* 네이버 블로그 연동 — 자체 문서(위)와 블로그(아래) 두 채널을 한 페이지에서 안내 */
    .ins-blog{display:flex;align-items:center;gap:20px;margin-top:16px;padding:22px 24px;
              border:1px solid #e8eaf0;border-radius:16px;background:#fbfcfe}
    .ins-blog .bt{min-width:0}
    .blog-badge{display:inline-grid;place-items:center;width:42px;height:23px;border-radius:6px;
                background:#03c75a;color:#fff;font:900 11px/1 var(--font-sans);margin:0 0 9px}
    .ins-blog h3{font:750 17px/1.4 var(--font-sans);margin:0 0 5px;color:#111827}
    .ins-blog p{font:14px/1.6 var(--font-sans);color:#6b7280;margin:0}
    .blog-go{margin-left:auto;flex:none;font:700 14px/1 var(--font-sans);color:#fff;background:#0b3a91;
             border-radius:10px;padding:14px 18px;text-decoration:none;white-space:nowrap}
    .blog-go:hover{background:#0d4099}
    @media(max-width:640px){
      .ins-wrap h1{font-size:23px}
      .ins-index a{grid-template-columns:36px minmax(0,1fr);gap:12px;padding:22px 4px}
      .ins-index .go{grid-column:2;justify-self:start;margin-top:12px}
      .ins-blog{flex-wrap:wrap}.blog-go{margin-left:0;width:100%;text-align:center}}
    .site-foot{border-top:1px solid #e9e9ee;background:#fafafb;margin-top:56px}
    /* 푸터도 헤더·본문과 같은 기준선 */
    .foot-inner{width:min(var(--shell-max),calc(100% - 40px));margin:0 auto;box-sizing:border-box;
                padding:26px var(--dock-gutter) 34px}
    @media(max-width:1079px){.foot-inner{padding-inline:0}}
    .foot-nav{display:flex;flex-wrap:wrap;gap:10px 18px;margin-bottom:16px}
    .foot-nav a{color:#33363d;text-decoration:none;font:600 13.5px/1 var(--font-sans)}
    .foot-info{display:flex;flex-wrap:wrap;gap:6px 20px;font-style:normal;font:13px/1.7 var(--font-sans);color:#5c616b}
    .foot-info b{color:#33363d;font-weight:650;margin-right:4px}
    .foot-copy{margin:14px 0 0;font:12.5px/1.6 var(--font-sans);color:#9a9ea7}
"""

# 관심매체 스크립트(catalog-fav.js)는 가이드에 붙일 곳이 없어 넣지 않는다.

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

IC_MAP = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
          'stroke-linejoin="round" aria-hidden="true"><path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/>'
          '<path d="M9 3v15M15 6v15"/></svg>')
IC_LIST = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
           'aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>')
IC_STAR = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61'
           'L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>')
IC_CHAT = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
           'stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-3.4-.6L3 21l1.7-5'
           'a8.2 8.2 0 0 1-.7-3.4 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.6 7.9z"/></svg>')

def viewtog(active=""):
    """우측 플로팅 메뉴판 — 지도 도크와 동일한 형태. active: 'map' | 'list' | ''
    가이드는 매체를 담는 페이지가 아니라 '관심매체 비교'는 넣지 않는다(지도·목록·상세에만)."""
    on = lambda k: ' class="on"' if active == k else ''
    return (f'<div class="viewtog">'
            f'<a{on("map")} href="map.html"><span class="ic">{IC_MAP}</span>지도로 보기</a>'
            f'<a{on("list")} href="media-catalog.html"><span class="ic">{IC_LIST}</span>목록으로 보기</a>'
            f'<a class="consult" href="estimate.html"><span class="ic">{IC_CHAT}</span>상담신청</a>'
            f'</div>')

def header():
    """전 페이지 공통 헤더 — 키워드형 라벨(앵커 텍스트)로 통일"""
    return """<header class="hd"><div class="hd-in">
      <a class="hd-brand" href="index.html" aria-label="광고플레이 홈"><span class="brand-mark">AD</span><strong>광고플레이</strong></a>
      <nav class="hd-nav" aria-label="주요 메뉴">
        <a href="map.html">옥외광고 지도</a>
        <a href="media-catalog.html">옥외광고 목록</a>
        <a href="cases.html">광고집행사례</a>
        <a class="on" href="insights.html">광고 인사이트</a>
      </nav>
      <div class="hd-act">
        <a href="about.html">회사소개</a>
        <a href="login.html">로그인</a>
        <a href="join.html">회원가입</a>
      </div>
    </div></header>"""

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
      {viewtog()}
      <p class="ins-bc"><a href="index.html">홈</a> › <a href="insights.html">광고 인사이트</a> › {esc(it['name'])}</p>
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
"""+FOOTER+"""
  </body>
</html>
"""

BC_LD = {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"홈","item":f"{BASE}/"},
    {"@type":"ListItem","position":2,"name":"광고 인사이트","item":f"{BASE}/insights.html"}]}

def hub_html():
    rows = ""
    for i, it in enumerate(ITEMS, 1):
        stats = "".join(f'<div><dt>{esc(a)}</dt><dd>{esc(b)}</dd></div>' for a, b in it["stats"])
        rows += (f'<li><a href="insight-{it["slug"]}.html">'
                 f'<span class="num">{i:02d}</span>'
                 f'<div class="bd">'
                 f'<span class="kicker">전광판 · {esc(it["address"].split()[1])}</span>'
                 f'<h3>{esc(it["name"])} 광고</h3>'
                 f'<p class="sub">{esc(it["address"])} · {esc(it["size"])} · {esc(it["hours"])}</p>'
                 f'<dl class="stats">{stats}</dl>'
                 f'</div>'
                 f'<span class="go">자세히</span></a></li>')

    ld = {"@context":"https://schema.org","@type":"CollectionPage",
          "name":"광고 인사이트 | 광고플레이",
          "url":f"{BASE}/insights.html",
          "about":["전광판 광고","디지털 옥외광고","DOOH","옥외광고 매체"],
          "isPartOf":{"@type":"WebSite","name":"광고플레이","url":f"{BASE}/"},
          "hasPart":[{"@type":"Article","name":f'{it["name"]} 광고',
                      "url":f'{BASE}/insight-{it["slug"]}.html'} for it in ITEMS]}
    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>광고 인사이트 – 전광판 광고 위치·광고비·유동인구 | 광고플레이</title>
    <meta name="description" content="서울 핵심 상권 전광판 광고 매체의 위치·광고비·유동인구를 실데이터로 정리한 광고 인사이트입니다. 청계광장·명동·경복궁 대형 전광판을 비교하세요.">
    <meta name="keywords" content="광고 인사이트, 전광판 광고, 옥외광고, 디지털 옥외광고, DOOH, 전광판 광고비, 광고플레이">
    <link rel="canonical" href="{BASE}/insights.html">
    <meta property="og:type" content="website">
    <meta property="og:title" content="광고 인사이트 – 전광판 광고 위치·광고비·유동인구 | 광고플레이">
    <meta property="og:description" content="서울 핵심 상권 전광판 광고 매체의 위치·광고비·유동인구를 실데이터로 정리했습니다.">
    <meta property="og:url" content="{BASE}/insights.html">
    <link rel="stylesheet" href="assets/css/styles.css">
    <script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script>
    <script type="application/ld+json">{json.dumps(BC_LD,ensure_ascii=False)}</script>
    <style>{CSS}</style>
  </head>
  <body>
    {header()}
    <main class="ins-wrap">
      {viewtog()}
      <div class="ins-sticky">
      <p class="ins-bc"><a href="index.html">홈</a> › 광고 인사이트</p>
      <h1>광고 인사이트</h1>
      <p class="ins-lead">서울 핵심 상권 전광판 광고 매체의 <b>위치·광고비·유동인구</b>를 실데이터로 정리합니다. 광고 집행 전 매체별 특성과 비용을 한눈에 비교하세요.</p>
      </div><!-- /ins-sticky -->

      <section class="ins-sec">
        <div class="ins-sec-head"><h2>매체 인사이트</h2><span>공공 실데이터 기준 · {len(ITEMS)}건</span></div>
        <ol class="ins-index">{rows}</ol>
      </section>

      <section class="ins-sec">
        <div class="ins-sec-head"><h2>블로그</h2><span>최신 소식</span></div>
        <div class="ins-blog">
          <div class="bt">
            <span class="blog-badge" aria-hidden="true">blog</span>
            <h3>네이버 블로그 · 광고플레이</h3>
            <p>매체 신규 오픈, 집행 후기, 옥외광고 트렌드를 블로그에서 업데이트합니다.</p>
          </div>
          <a class="blog-go" href="https://blog.naver.com/k-goplay" target="_blank" rel="noopener">블로그 바로가기 →</a>
        </div>
      </section>
    </main>
"""+FOOTER+"""
    <script>(function(){var d=document.documentElement,h=document.querySelector(".hd");if(!h)return;function s(){d.style.setProperty("--hd-h",h.offsetHeight+"px")}s();try{new ResizeObserver(s).observe(h)}catch(e){}addEventListener("resize",s);addEventListener("load",s)})();</script>
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
