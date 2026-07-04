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

  var SERVICES = [
    { key: "planner",  icon: "🤖", label: "AI 추천 플래너", sub: "예산·업종·지역 → 매체 조합 자동 설계" },
    { key: "compare",  icon: "⚖️", label: "관심매체 비교", sub: "담은 매체를 지표별로 비교" },
    { key: "calendar", icon: "🗓️", label: "실시간 가용 캘린더", sub: "집행 가능일 확인·예약" },
    { key: "proposal", icon: "📄", label: "제안서 만들기", sub: "데이터·견적 담은 제안서 생성" },
    { key: "report",   icon: "📊", label: "성과 리포트", sub: "예상·실측 성과 확인" },
    { key: "creative", icon: "🎬", label: "AI 소재 제작", sub: "규격별 소재 자동 생성" }
  ];

  function tip(text) {
    return '<span class="gps-tip"><span class="ic">i</span><span class="pop">' + text + '</span></span>';
  }
  function bl(win, label, w, val) {
    return '<div class="gps-bl' + (win ? " win" : "") + '"><span class="l">' + label +
      '</span><span class="gps-bt"><span class="gps-bf" style="width:' + w + '%"></span></span>' +
      '<span class="val tnum">' + val + '</span></div>';
  }
  function calGrid(startDow, days, states) {
    var out = '<div class="gps-cgrid">';
    for (var i = 0; i < startDow; i++) out += '<div class="gps-cd mut"></div>';
    for (var d = 1; d <= days; d++) out += '<div class="gps-cd ' + (states[d] || "") + '">' + d + "</div>";
    return out + "</div>";
  }
  function marchStates() {
    var s = {}; [1, 2].forEach(function (d) { s[d] = "f"; }); [3, 4, 5].forEach(function (d) { s[d] = "b"; });
    for (var d = 10; d <= 23; d++) s[d] = "sel";
    [28, 29, 30, 31].forEach(function (d) { s[d] = "b"; });
    return s;
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
      icon: "⚖️", title: "관심매체 비교", sub: "담은 매체를 지표별로 나란히 비교합니다",
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
    },
    calendar: {
      icon: "🗓️", title: "실시간 가용 캘린더", sub: "신사 H스퀘어 · 2026년 3월",
      body:
        '<div class="gps-chips" style="margin-bottom:12px"><span class="gps-chip" style="background:var(--gps-accent-wash);border-color:var(--gps-accent);color:var(--gps-accent-ink)"><b>신사 H스퀘어</b></span><span class="gps-chip">코엑스 K-POP</span><span class="gps-chip">서울역 파노라마</span></div>' +
        '<div class="gps-cal-h"><span>집행 가능 구간을 선택하세요</span><span class="sel">선택: 3/10–3/23 (14일)</span></div>' +
        calGrid(0, 31, marchStates()) +
        '<div class="gps-calleg"><span><i style="background:var(--gps-good)"></i>집행 가능</span><span><i style="background:var(--gps-warn)"></i>대기·예약중</span><span><i style="background:var(--gps-crit)"></i>마감</span><span><i style="background:var(--gps-accent)"></i>선택 구간</span></div>' +
        '<div class="gps-row2" style="margin-top:14px">' +
          '<div class="gps-card gps-soft"><h4>선택 요약</h4><div class="gps-kpis">' +
            '<div class="gps-kpi"><div class="k">잔여 슬롯 ' + tip("한 화면을 여러 광고가 순환 송출합니다. 남은 광고 자리 수입니다.") + '</div><div class="v tnum">2 / 6</div></div>' +
            '<div class="gps-kpi"><div class="k">예상 금액</div><div class="v tnum">₩840만</div></div>' +
          '</div></div>' +
          '<div class="gps-card"><h4>가격 단위</h4><div class="gps-kpis">' +
            '<div class="gps-kpi"><div class="k">1일</div><div class="v tnum" style="font-size:16px">₩60만</div></div>' +
            '<div class="gps-kpi"><div class="k">1개월</div><div class="v tnum" style="font-size:16px">₩1,800만</div></div>' +
          '</div><div style="margin-top:8px"><span class="gps-src">매체사 예약 시스템 · 실시간</span></div></div>' +
        '</div>',
      foot: '<button class="gps-bs">대기 알림 신청</button><button class="gps-bp">이 구간 예약 문의 →</button>'
    },
    proposal: {
      icon: "📄", title: "제안서 만들기", sub: "관심매체 조합을 공유 가능한 제안서로 자동 생성",
      body:
        '<div class="gps-row2">' +
          '<div class="mblock"><h4>구성 옵션</h4>' +
            '<div class="gps-card" style="display:flex;flex-direction:column;gap:8px">' +
              '<label style="font-size:13px;font-weight:600"><input type="checkbox" checked> 표지 · 캠페인 개요</label>' +
              '<label style="font-size:13px;font-weight:600"><input type="checkbox" checked> 매체 상세 (사진·규격·위치)</label>' +
              '<label style="font-size:13px;font-weight:600"><input type="checkbox" checked> 오디언스 데이터 (정부 근거)</label>' +
              '<label style="font-size:13px;font-weight:600"><input type="checkbox" checked> 견적표 · 예산 배분</label>' +
              '<label style="font-size:13px;font-weight:600;color:var(--gps-muted)"><input type="checkbox"> 집행 스케줄 캘린더</label>' +
              '<label style="font-size:13px;font-weight:600;color:var(--gps-muted)"><input type="checkbox"> 광고주 로고 삽입</label>' +
            '</div>' +
          '</div>' +
          '<div class="mblock"><h4>미리보기</h4>' +
            '<div class="gps-card">' +
              '<div style="background:linear-gradient(120deg,#0b1b3f,#12245a);color:#fff;border-radius:8px;padding:14px;margin-bottom:10px"><div style="font-size:14px;font-weight:800">강남 F&amp;B 캠페인 매체 제안</div><div style="font-size:11px;color:#c3ccdf;margin-top:3px">광고플레이 · 2026.03 · 3개 매체</div></div>' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px dotted var(--gps-line)"><span>신사 H스퀘어</span><b class="tnum">₩1,800만</b></div>' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px dotted var(--gps-line)"><span>서울역 파노라마</span><b class="tnum">₩2,400만</b></div>' +
              '<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0"><span>합계 · CPM</span><b class="tnum">₩4,720만 · ₩3,100</b></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gps-note"><span>◆</span><span><b>차별점:</b> 도달·타깃 수치에 출처 라벨(국토부·통계청·상권정보)이 함께 인쇄돼, 광고주 내부 보고에 그대로 쓸 수 있습니다.</span></div>',
      foot: '<button class="gps-bs">링크 공유</button><button class="gps-bs">PPT</button><button class="gps-bp">PDF 생성 →</button>'
    },
    report: {
      icon: "📊", title: "성과 리포트", sub: "집행 결과를 예상 대비로 보여주고 재집행을 유도합니다",
      body:
        '<div class="gps-rtoggle"><button class="on">실측</button><button>예상</button></div> <span class="gps-badge act">실측 · 매체 송출로그 기반</span>' +
        '<div class="gps-kpis" style="grid-template-columns:repeat(5,1fr);margin-top:12px">' +
          '<div class="gps-kpi"><div class="k">총 노출</div><div class="v tnum">4,210만</div><div class="d up">▲ +12%</div></div>' +
          '<div class="gps-kpi"><div class="k">순 도달</div><div class="v tnum">168만</div><div class="d up">▲ +8%</div></div>' +
          '<div class="gps-kpi"><div class="k">평균 빈도</div><div class="v tnum">3.6회</div><div class="d">1인</div></div>' +
          '<div class="gps-kpi"><div class="k">달성 CPM</div><div class="v tnum">₩2,980</div><div class="d up">▼ 목표↓</div></div>' +
          '<div class="gps-kpi"><div class="k">목표 달성률</div><div class="v tnum">112%</div><div class="d up">초과</div></div>' +
        '</div>' +
        '<div class="gps-card" style="margin-top:14px"><h4>일별 노출 추이</h4>' +
          '<div class="gps-spark"><span style="height:50%"></span><span style="height:58%"></span><span style="height:46%"></span><span style="height:70%"></span><span style="height:64%"></span><span style="height:80%"></span><span style="height:76%"></span><span class="hi" style="height:100%"></span></div>' +
          '<div style="margin-top:10px"><span class="gps-src">매체사 송출 로그 · 유동 데이터 보정</span></div>' +
        '</div>',
      foot: '<button class="gps-bs">리포트 PDF</button><button class="gps-bp">같은 조건 재집행 →</button>'
    },
    creative: {
      icon: "🎬", title: "AI 소재 제작", sub: "원본 1개 → 매체 규격별 자동 리사이즈·검수",
      body:
        '<div class="gps-card gps-soft" style="display:flex;align-items:center;gap:14px;margin-bottom:14px">' +
          '<div style="width:74px;aspect-ratio:16/9;border-radius:8px;background:linear-gradient(135deg,#16233f,#33507e);flex:none"></div>' +
          '<div><div style="font-size:14px;font-weight:800">원본 소재 업로드 완료</div><div style="font-size:12px;color:var(--gps-muted)">brand_launch.mp4 · 3840×2160 · 15초 · 42MB</div></div>' +
          '<button class="gps-bs" style="margin-left:auto">교체</button>' +
        '</div>' +
        '<div class="mblock"><h4>매체 규격별 자동 생성</h4><div class="gps-sizes">' +
          '<div class="gps-sz"><div class="box r169"></div><div class="cap">전광판 16:9</div><div class="spec">1920×1080</div><div class="ok">✓ 완료</div></div>' +
          '<div class="gps-sz"><div class="box r916"></div><div class="cap">세로 9:16</div><div class="spec">1080×1920</div><div class="ok">✓ 완료</div></div>' +
          '<div class="gps-sz"><div class="box r11"></div><div class="cap">정사각 1:1</div><div class="spec">1080×1080</div><div class="ok">✓ 완료</div></div>' +
          '<div class="gps-sz"><div class="box r219"></div><div class="cap">와이드 21:9</div><div class="spec">2560×1080</div><div class="ok" style="color:var(--gps-warn)">⚙ 조정</div></div>' +
          '<div class="gps-sz"><div class="box r31"></div><div class="cap">버스 3:1</div><div class="spec">1500×500</div><div class="ok">✓ 완료</div></div>' +
        '</div></div>' +
        '<div class="gps-note"><span>◆</span><span><b>ADVoost AutoClip 벤치마크</b> — 매체별 소재 제작 부담을 없애 소액·초심 광고주의 진입장벽을 낮춥니다.</span></div>',
      foot: '<button class="gps-bs">규격 추가</button><button class="gps-bp">5종 소재 생성 →</button>'
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
