/* =====================================================================
   광고플레이 개선 적용 — 주요 서비스 도크 + 상세 모달 (additive, 미배포)
   기존 map.js 로직에 의존하지 않는 독립 모듈. 지도 캔버스에 도크를 주입하고
   각 서비스 클릭 시 상세 화면(모달)을 띄운다.
   근거: 경쟁사 분석(TKAD·HOO·ADVoost·adtype) + 정보접근성.
   ===================================================================== */
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  // 아이콘은 단색 SVG 라인으로 통일 — 이모지는 OS마다 그림이 다르고(Windows/Mac/Android),
  // 22px 크기에선 형태가 뭉개지며, 알록달록해서 사이트 톤(네이비 단색)을 깬다.
  // 은유도 바로잡음: AI=로봇(옛 은유)→반짝임, 비교=저울(법률 뉘앙스)→나란한 두 패널.
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICONS = {
    // AI = 반짝임(요즘 표준 은유)
    planner: svg('<path d="M11 3.5l1.6 4L16.5 9l-3.9 1.6L11 14.5 9.4 10.6 5.5 9l3.9-1.5z"/>' +
                 '<path d="M17.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'),
    // 비교 = 나란한 두 패널(성과 리포트의 막대그래프와 형태가 겹치지 않게)
    compare: svg('<rect x="3.5" y="5" width="7" height="14" rx="1.5"/>' +
                 '<rect x="13.5" y="5" width="7" height="14" rx="1.5"/>'),
    creative: svg('<rect x="3" y="4.5" width="18" height="15" rx="2"/>' +
                  '<circle cx="8.5" cy="10" r="1.6"/><path d="M21 15.5l-4.5-4L10 19"/>')
  };

  // 6개 → 3개 축소(2026-07-17 확정). 도크는 "사기 전"에 쓰는 자리라 구매 후 기능은 두지 않는다.
  //  · 가용 캘린더 삭제 — 매체주가 제각각이고 선착순이라 실시간 재고를 알 수 없음(원천 불가).
  //    목업의 "잔여 슬롯 2/6"은 만들 수 없는 숫자였다.
  //  · 제안서 만들기 삭제 — 관심매체 비교 패널의 PDF 버튼으로 흡수(one-pager.html).
  //  · 성과 리포트 이동 — 계약 광고주용이라 로그인 → 마이페이지로.
  var SERVICES = [
    { key: "planner",  icon: ICONS.planner,  label: "AI 추천 플래너", sub: "예산·업종·지역 → 매체 조합 자동 설계" },
    { key: "compare",  icon: ICONS.compare,  label: "관심매체 비교·상담", sub: "담은 매체 비교 · 제안서(PDF)·엑셀 받기" },
    { key: "creative", icon: ICONS.creative, label: "소재 제작 의뢰", sub: "의뢰서 작성하면 제작 견적 발송", href: "creative-request.html" }
  ];

  function tip(text) {
    return '<span class="gps-tip"><span class="ic">i</span><span class="pop">' + text + '</span></span>';
  }
  function bl(win, label, w, val) {
    return '<div class="gps-bl' + (win ? " win" : "") + '"><span class="l">' + label +
      '</span><span class="gps-bt"><span class="gps-bf" style="width:' + w + '%"></span></span>' +
      '<span class="val tnum">' + val + '</span></div>';
  }
  var FEAT = {
    planner: {
      icon: "🤖", title: "AI 추천 플래너", sub: "예산·업종·지역·목표로 최적 매체 조합을 설계합니다",
      body:
        '<div class="gps-chips" style="margin-bottom:14px">' +
          '<span class="gps-chip">예산 <b>월 500만</b></span><span class="gps-chip">업종 <b>F&amp;B·카페</b></span>' +
          '<span class="gps-chip">지역 <b>강남·성수</b></span><span class="gps-chip">목표 <b>인지도</b></span><span class="gps-chip">기간 <b>4주</b></span>' +
        '</div>' +
        '<div class="mblock"><h4>추천 시나리오 3안 <span class="gps-badge est">추정</span></h4>' +
          '<div class="gps-scen">' +
            '<div class="gps-sc on"><div class="t">효율형</div><div class="kk">CPM 최소</div><div class="big">₩3,100</div><div class="li"><span>월 도달</span><b>142만</b></div></div>' +
            '<div class="gps-sc"><div class="t">균형형</div><div class="kk">도달·효율</div><div class="big">₩3,600</div><div class="li"><span>월 도달</span><b>168만</b></div></div>' +
            '<div class="gps-sc"><div class="t">도달우선</div><div class="kk">최대 노출</div><div class="big">₩4,200</div><div class="li"><span>월 도달</span><b>205만</b></div></div>' +
          '</div></div>' +
        '<div class="gps-row2">' +
          '<div class="mblock"><h4>선택안 · 포트폴리오</h4>' +
            '<div class="gps-alloc"><div style="width:46%;background:#3b74f2">전광판 46%</div><div style="width:34%;background:#6a8ff5">엘리베이터 34%</div><div style="width:20%;background:#9db8ff;color:#1b46c4">버스 20%</div></div>' +
            '<div class="gps-poi"><div class="th"></div><div><div class="nm">강남 신사 H스퀘어 전광판</div><div class="mt">대형 LED · 도달 82만</div></div><div class="pct"><b>46%</b><span>₩820만</span></div></div>' +
            '<div class="gps-poi"><div class="th"></div><div><div class="nm">성수 생활밀착 엘리베이터</div><div class="mt">생활밀착 · 도달 41만</div></div><div class="pct"><b>34%</b><span>₩170만</span></div></div>' +
            '<div class="gps-poi"><div class="th"></div><div><div class="nm">강남권 버스정류장 패키지</div><div class="mt">20곳 묶음 · 도달 19만</div></div><div class="pct"><b>20%</b><span>₩100만</span></div></div>' +
          '</div>' +
          '<div class="mblock"><h4>예상 성과 <span class="gps-badge est">추정</span></h4>' +
            '<div class="gps-kpis">' +
              '<div class="gps-kpi"><div class="k">순도달 ' + tip("일정 기간 내 최소 1회 이상 노출된 순 인원(중복 제외). 정부 유동데이터 기반 추정.") + '</div><div class="v tnum">142만</div><div class="d up">타깃 적합 89%</div></div>' +
              '<div class="gps-kpi"><div class="k">노출 빈도 ' + tip("1인당 평균 노출 횟수 = 총 노출 ÷ 순도달. 추정 모델 값.") + '</div><div class="v tnum">3.4회</div><div class="d">1인 기준</div></div>' +
              '<div class="gps-kpi"><div class="k">평균 CPM ' + tip("1,000명 도달당 광고비. 낮을수록 효율적.") + '</div><div class="v tnum">₩3,100</div><div class="d up">▼ 시장가 -18%</div></div>' +
              '<div class="gps-kpi"><div class="k">총 집행 예산</div><div class="v tnum">₩490만</div><div class="d">목표 내 98%</div></div>' +
            '</div>' +
            '<p class="gps-cap">* 도달은 정부 유동데이터(실측 기반), 빈도·CPM은 노출모델 추정치입니다.</p>' +
            '<div style="margin-top:8px"><span class="gps-src">소상공인 상권정보 · 관광 데이터랩 매칭</span></div>' +
          '</div>' +
        '</div>',
      foot: '<button class="gps-bs">관심매체로 담기</button><button class="gps-bp">제안서 만들기 →</button>'
    },
    compare: {
      icon: "⚖️", title: "관심매체 비교·상담", sub: "담은 매체를 지표별로 나란히 비교하고 바로 상담합니다",
      body:
        '<div class="gps-card cmp">' +
          '<div class="gps-rowh"><span>일 유동인구 · 많을수록 유리</span></div>' +
          bl(true, "신사 H스퀘어", 92, "18.7만") + bl(false, "코엑스 K-POP", 74, "15.1만") + bl(false, "서울역 파노라마", 58, "11.8만") +
          '<div class="gps-rowh"><span>천명당 비용(CPM) · 낮을수록 유리</span></div>' +
          bl(true, "서울역 파노라마", 40, "₩2,600") + bl(false, "신사 H스퀘어", 52, "₩3,200") + bl(false, "코엑스 K-POP", 88, "₩5,400") +
          '<div class="gps-rowh"><span>2030 타깃 비중 · 목표 적합</span></div>' +
          bl(true, "신사 H스퀘어", 86, "53%") + bl(false, "코엑스 K-POP", 78, "48%") + bl(false, "서울역 파노라마", 60, "37%") +
        '</div>' +
        '<div class="gps-note" style="margin-top:14px"><span>◆</span><span><b>추천:</b> 효율은 서울역, 타깃 적합은 신사가 우세 — 인지도 목표라면 신사+서울역 2종 묶음이 CPM·도달 균형이 가장 좋습니다.</span></div>',
      foot: '<button class="gps-bs">제안서로 내보내기</button><button class="gps-bp">묶음 상담 신청 →</button>'
    }
  };

  ready(function () {
    var shell = document.querySelector(".map-canvas-shell");
    if (!shell) return;

    // ---- dock ----
    var dock = document.createElement("div");
    dock.className = "gps-dock";
    var html = '';
    SERVICES.forEach(function (s) {
      // 관심매체 비교 배지는 실제 관심 개수와 동기화(data-fav-count), 0이면 숨김
      var badge = s.key === "compare"
        ? '<span class="bn" data-fav-count hidden>0</span>'
        : (s.badge ? '<span class="bn">' + s.badge + '</span>' : "");
      html += '<button type="button" class="gps-svc" data-gps="' + s.key + '">' +
        '<span class="top"><span class="ic">' + s.icon + '</span>' + s.label +
        badge + '</span>' +
        '<span class="sub">' + s.sub + '</span></button>';
    });
    dock.innerHTML = html;
    shell.appendChild(dock);

    // 도크를 연락처 카드 위에 항상 10px 간격으로 동적 배치 — 카드 높이 변화(관심매체 버튼 표시 등)에 대응해 겹침 방지
    var contactCard = document.querySelector(".map-contact-card");
    function positionDock() {
      if (!contactCard) return;
      var cs = getComputedStyle(contactCard);
      if (cs.display === "none") { dock.style.bottom = ""; return; } // 모바일: 카드 숨김·도크 static
      var b = parseFloat(cs.bottom) || 26;
      dock.style.bottom = (b + contactCard.offsetHeight + 10) + "px";
    }
    positionDock();
    if (window.ResizeObserver && contactCard) new ResizeObserver(positionDock).observe(contactCard);
    window.addEventListener("resize", positionDock);

    // ---- modal ----
    var ov = document.createElement("div");
    ov.className = "gps-ov";
    ov.innerHTML =
      '<div class="gps-modal" role="dialog" aria-modal="true">' +
        '<div class="gps-modal-h"><span class="mi"></span><div><h3></h3><div class="msub"></div></div><button class="x" aria-label="닫기">×</button></div>' +
        '<div class="gps-modal-b"></div>' +
        '<div class="gps-modal-f"></div>' +
      '</div>';
    document.body.appendChild(ov);

    var mi = ov.querySelector(".mi"), mt = ov.querySelector("h3"), msub = ov.querySelector(".msub"),
        mb = ov.querySelector(".gps-modal-b"), mf = ov.querySelector(".gps-modal-f");

    function open(key) {
      var f = FEAT[key]; if (!f) return;
      mi.textContent = f.icon; mt.textContent = f.title; msub.textContent = f.sub;
      mb.innerHTML = f.body; mf.innerHTML = f.foot;
      ov.classList.add("open");
    }
    function close() { ov.classList.remove("open"); }

    dock.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gps]");
      if (!b) return;
      var key = b.getAttribute("data-gps");
      if (key === "compare") { document.dispatchEvent(new CustomEvent("gps:open-favorites")); return; } // 실제 관심매체 패널(비교+합계+상담) 열기
      var svc = SERVICES.filter(function (s) { return s.key === key; })[0];
      if (svc && svc.href) { location.href = svc.href; return; } // 소재 제작 의뢰 = 모달이 아니라 별도 페이지
      open(key);
    });
    ov.querySelector(".x").addEventListener("click", close);
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // 시나리오/토글 인터랙션
    mb.addEventListener("click", function (e) {
      var sc = e.target.closest(".gps-scen .gps-sc");
      if (sc) { sc.parentNode.querySelectorAll(".gps-sc").forEach(function (x) { x.classList.remove("on"); }); sc.classList.add("on"); return; }
      var rt = e.target.closest(".gps-rtoggle button");
      if (rt) { rt.parentNode.querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); }); rt.classList.add("on"); }
    });
  });

  // ===== 리스트 카드 사진 캐러셀 (호버 시 좌우 화살표로 넘김, 경쟁사 방식) =====
  ready(function () {
    function initCarousels(root) {
      (root || document).querySelectorAll(".map-list-card").forEach(function (card) {
        if (card.getAttribute("data-gps-caro")) return;
        var pair = card.querySelector(".map-card-photo-pair");
        if (!pair) return;
        var figs = pair.querySelectorAll("figure");
        if (figs.length < 2) return;
        var imgA = figs[0].querySelector("img"), imgB = figs[1].querySelector("img");
        if (!imgA || !imgB) return;
        // 카드에 심어둔 갤러리(여러 장) — 없으면 현재 렌더된 2장으로 대체
        var gallery = (card.getAttribute("data-gallery") || "").split(",").filter(Boolean);
        if (gallery.length < 2) gallery = [imgA.getAttribute("src"), imgB.getAttribute("src")].filter(Boolean);
        var pages = Math.ceil(gallery.length / 2);
        if (pages < 2) return; // 넘길 페이지가 없으면 화살표 미표시
        card.setAttribute("data-gps-caro", "1");
        var page = 0;
        var prev = document.createElement("button");
        prev.type = "button"; prev.className = "gps-caro prev"; prev.setAttribute("aria-label", "이전 사진"); prev.textContent = "‹";
        var next = document.createElement("button");
        next.type = "button"; next.className = "gps-caro next"; next.setAttribute("aria-label", "다음 사진"); next.textContent = "›";
        var dots = document.createElement("div"); dots.className = "gps-caro-dots";
        for (var p = 0; p < pages; p++) { var d = document.createElement("span"); if (p === 0) d.className = "on"; dots.appendChild(d); }
        function show(p) {
          page = (p + pages) % pages;
          imgA.setAttribute("src", gallery[page * 2] || gallery[0]);
          imgB.setAttribute("src", gallery[page * 2 + 1] || gallery[page * 2] || gallery[0]);
          dots.querySelectorAll("span").forEach(function (s, j) { s.classList.toggle("on", j === page); });
        }
        function stop(e) { e.preventDefault(); e.stopPropagation(); }
        prev.addEventListener("click", function (e) { stop(e); show(page - 1); });
        next.addEventListener("click", function (e) { stop(e); show(page + 1); });
        pair.appendChild(prev); pair.appendChild(next); pair.appendChild(dots);
      });
    }
    var listEl = document.querySelector("#mapMediaList");
    if (!listEl) return;
    initCarousels(listEl);
    new MutationObserver(function () { initCarousels(listEl); }).observe(listEl, { childList: true });
  });
})();
