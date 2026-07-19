(function () {
  const cache = {};
  const categoryLabels = {
    large_billboard: "대형 전광판",
    shopping_mall_did: "쇼핑몰 DID",
    subway: "지하철 광고",
    bus: "버스 광고",
    transport_hub: "도시 철도·버스·터미널",
    daily_touchpoint: "생활밀착형 광고",
    package: "패키지",
    other: "기타",
  };
  const categorySummaries = {
    large_billboard: "핵심 상권과 대형 교차로에서 첫 시선을 확보하는 고임팩트 매체입니다.",
    package: "동일 상권 내 매체 2~3개를 묶어 도달률을 높이는 추천 구성입니다.",
    shopping_mall_did: "쇼핑·문화 체류 공간에서 구매 고려를 자극하는 DID 매체입니다.",
    subway: "출퇴근과 방문 동선에서 반복 노출을 확보하는 이동 경로 매체입니다.",
    bus: "보행자와 운전자 모두에게 일상 반복 노출을 만드는 버스·쉘터 매체입니다.",
    daily_touchpoint: "아파트, 오피스, 편의점 등 생활권 접점에서 메시지를 누적합니다.",
  };
  const config = {
    brandName: "광고플레이",
    brandMark: "AD",
    brandHref: "media.html",
    phone: "1533-1975",
    email: "info@k-goplay.com",
    companyName: "광고플레이 주식회사(Adplay Co., Ltd)",
    ceo: "임정언",
    address: "세종특별자치시 한누리대로 350, 뱅크빌딩 6층 D45호(어진동)",
    fax: "044-902-6029",
    bizNo: "148-81-03399",
    mailOrderNo: "제2024-세종아름-0724",
    copyright: "Copyright ⓒ Adplay Korea Co., Ltd. All Rights Reserved.",
    placeholderImage: "assets/images/placeholders/media-placeholder.svg",
    priceNotice: "표기된 광고비는 VAT 별도 기준의 참고가입니다. 최종 비용 및 구좌 가능 여부는 상담 시점에 확인이 필요합니다.",
    featuredAreaSlugs: ["dosan-daero", "samseong-coex", "gangnam-daero"],
    homeCategoryOrder: ["large_billboard", "package", "shopping_mall_did", "subway", "bus", "daily_touchpoint"],
    navItems: [
      { href: "media-catalog.html", label: "옥외광고 목록" },
      { href: "map.html", label: "옥외광고 지도" },
      { href: "insights.html", label: "광고 인사이트" },
      // 운영자 도구(주소 변환·매체 관리)는 관리자 허브(admin.html)로 통합
      { href: "admin.html", label: "관리자" },
      // 삭제(2026-07-19): 지역 보기→도크 '지역으로 보기', 견적 문의→상담 CTA, 소재 제작 의뢰→지도 도크로 흡수
    ],
  };

  async function loadJson(path) {
    if (!cache[path]) {
      cache[path] = fetch(path, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`${path} 로드 실패`);
        return response.json();
      });
    }
    return cache[path];
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "확인 필요";
    return Number(value).toLocaleString("ko-KR");
  }

  function formatKRW(value) {
    if (value === null || value === undefined || value === "") return "상담 필요";
    const num = Number(value);
    if (num >= 100000000) {
      const eok = num / 100000000;
      return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억원`;
    }
    return `${Math.round(num / 10000).toLocaleString("ko-KR")}만원`;
  }

  function minMonthlyPrice(item) {
    const prices = (item.pricing || [])
      .map((row) => row.monthlyPriceKRW)
      .filter((value) => Number.isFinite(Number(value)));
    return prices.length ? Math.min(...prices) : null;
  }

  function priceLabel(item) {
    const min = minMonthlyPrice(item);
    return min ? `월 ${formatKRW(min)}부터` : "상담 필요";
  }

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function tagsHtml(tags) {
    return (tags || []).slice(0, 6).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("");
  }

  function setActiveNav() {
    const current = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.getAttribute("href") === current) link.classList.add("is-active", "on");
    });
  }

  function pageImage(item) {
    return item.imageUrl || config.placeholderImage;
  }

  function priceNotice() {
    return config.priceNotice;
  }

  function renderSiteChrome() {
    document.querySelectorAll("[data-site-header]").forEach((root) => {
      // 옛 JS 헤더(.nav/.nav-links)를 새 공통 헤더(.hd)로 교체 — 정적 앱 페이지와 동일 메뉴.
      root.classList.remove("site-header");
      root.classList.add("hd");
      root.innerHTML = `
        <div class="hd-in">
          <a class="hd-brand" href="map.html" aria-label="광고플레이 홈"><span class="brand-mark">${esc(config.brandMark)}</span><strong>${esc(config.brandName)}</strong></a>
          <nav class="hd-nav" aria-label="주요 메뉴">
            <a data-nav href="map.html">옥외광고 지도</a>
            <a data-nav href="media-catalog.html">옥외광고 목록</a>
            <a data-nav href="cases.html">광고집행사례</a>
            <a data-nav href="insights.html">광고 인사이트</a>
          </nav>
          <div class="hd-act">
            <a data-nav href="about.html">회사소개</a>
            <a href="admin.html">관리자</a>
            <a href="login.html">로그인</a>
            <a href="join.html">회원가입</a>
          </div>
        </div>`;
    });
    document.querySelectorAll("[data-site-footer]").forEach((root) => {
      root.innerHTML = `
        <div class="footer-inner">
          <nav class="foot-nav" aria-label="회사 정보 메뉴">
            <a href="index.html">홈</a><a href="about.html">회사소개</a><a href="terms.html">이용약관</a><a href="privacy.html">개인정보처리방침</a><a href="media-policy.html">매체관리규정</a>
          </nav>
          <address class="foot-info">
            <span><b>회사명</b> ${esc(config.companyName)}</span>
            <span><b>대표자</b> ${esc(config.ceo)}</span>
            <span><b>이용문의</b> ${esc(config.phone)}</span>
            <span><b>팩스</b> ${esc(config.fax)}</span>
            <span><b>이메일</b> ${esc(config.email)}</span>
            <span><b>주소</b> ${esc(config.address)}</span>
            <span><b>통신판매업신고</b> ${esc(config.mailOrderNo)}</span>
            <span><b>사업자등록번호</b> ${esc(config.bizNo)}</span>
          </address>
          <small class="foot-copy">${esc(config.copyright)}</small>
        </div>`;
    });
    document.querySelectorAll("[data-price-notice]").forEach((root) => {
      root.textContent = config.priceNotice;
    });
  }

  function audienceProfile(item) {
    const text = [item.name, item.areaName, item.areaSlug, item.address, item.locationDescription, item.mapLocation && item.mapLocation.sourceAddress].filter(Boolean).join(" ");
    const source = "출처: 소상공인 상권정보 · 통계청 KOSIS (2026, 상권 기준)";
    if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) {
      return { archetype: "coex", gender: { female: 48, male: 52 }, worker: "높음", note: "업무·전시 방문과 쇼핑 체류가 섞인 3040 중심", source,
        age: [["10대", 5, 17, "학생·동반"], ["20대", 22, 73, "활동층"], ["30대", 28, 93, "구매 핵심"], ["40대", 24, 80, "직장인"], ["50대", 14, 47, "가족 소비"], ["60대+", 7, 23, "생활권"]] };
    }
    if (/서울역|KTX|seoul-station|transport/i.test(text)) {
      return { archetype: "seoul-station", gender: { female: 45, male: 55 }, worker: "보통", note: "출장·관광·통근이 겹쳐 전 연령 고른 분포", source,
        age: [["10대", 6, 20, "학생·동반"], ["20대", 20, 67, "활동층"], ["30대", 24, 80, "구매 핵심"], ["40대", 23, 77, "직장인"], ["50대", 16, 53, "가족 소비"], ["60대+", 11, 37, "생활권"]] };
    }
    if (/광화문|종로|시청|청계|gwanghwamun|jongno|jung/i.test(text)) {
      return { archetype: "gwanghwamun", gender: { female: 47, male: 53 }, worker: "매우 높음", note: "도심 오피스 직장인 3040·40대 이상 비중 높음", source,
        age: [["10대", 4, 13, "학생·동반"], ["20대", 18, 60, "활동층"], ["30대", 26, 87, "구매 핵심"], ["40대", 26, 87, "직장인"], ["50대", 16, 53, "가족 소비"], ["60대+", 10, 33, "생활권"]] };
    }
    return { archetype: "gangnam", gender: { female: 58, male: 42 }, worker: "높음", note: "뷰티·패션 소비층, 2030 여성 비중 우세", source,
      age: [["10대", 6, 20, "학생·동반"], ["20대", 28, 93, "활동층"], ["30대", 30, 100, "구매 핵심"], ["40대", 20, 67, "직장인"], ["50대", 11, 37, "가족 소비"], ["60대+", 5, 17, "생활권"]] };
  }

  // 출처 표기 공통 방식 — 작은 '출처' 라벨 + 호버 메모 툴팁(.srcpop). 지도·목록·상세가 공유.
  // 각 줄은 실제 공공데이터 출처 링크. opts.traffic=true 면 도로 교통량 출처도 표기(지도 전용).
  // 문구·링크는 지도(map.js)·목록 상세(build-media-pages.py)가 똑같이 쓰도록 여기 한 곳에서 정의.
  function sourceChip(opts) {
    opts = opts || {};
    const S = [
      ["일평균 유동인구 · 소상공인 상권정보 빅데이터 (2026)", "https://bigdata.sbiz.or.kr/"],
      ["인구·성별·연령 · 통계청 KOSIS (2025)", "https://kosis.kr/"],
      ["버스 승하차 · 서울 열린데이터광장 (2026)", "https://data.seoul.go.kr/"],
      ["지하철 승하차 · 국가철도공단 철도통계 (2025)", "https://www.kric.go.kr/"],
    ];
    if (opts.traffic) S.push(["도로 교통량 · 서울 TOPIS (2025)", "https://topis.seoul.go.kr/"]);
    const rows = S.map(([label, href]) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join("");
    return `<span class="srcpop" tabindex="0" role="note" aria-label="데이터 출처">출처<span class="srcpop-body"><b>데이터 출처</b>${rows}</span></span>`;
  }

  window.AdPlay = {
    config,
    loadJson,
    formatNumber,
    formatKRW,
    minMonthlyPrice,
    priceLabel,
    getParam,
    esc,
    tagsHtml,
    categoryLabels,
    pageImage,
    priceNotice,
    audienceProfile,
    sourceChip,
  };

  async function renderHome() {
    const statsRoot = document.querySelector("#home-stats");
    const areasRoot = document.querySelector("#home-areas");
    const categoryRoot = document.querySelector("#home-categories");
    if (!statsRoot && !areasRoot && !categoryRoot) return;

    const [media, areas] = await Promise.all([
      loadJson("data/media.json"),
      loadJson("data/areas.json"),
    ]);
    const shortTerm = media.filter((item) => item.shortTermAvailable).length;
    const packageCount = media.filter((item) => item.category === "package").length;
    const activeAreas = areas.filter((area) => media.some((item) => item.areaSlug === area.slug)).length;

    if (statsRoot) {
      statsRoot.innerHTML = [
        ["등록 매체", `${formatNumber(media.length)}개`],
        ["운영 상권", `${formatNumber(activeAreas)}권역`],
        ["단기 집행 가능", `${formatNumber(shortTerm)}개`],
        ["추천 패키지", `${formatNumber(packageCount)}종`],
      ].map(([label, value]) => `<div class="card stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
    }

    if (areasRoot) {
      const featured = areas.filter((area) => config.featuredAreaSlugs.includes(area.slug));
      areasRoot.innerHTML = featured.map((area) => `
        <article class="card">
          <div class="card-body">
            <div class="meta"><span>일평균 유동 ${formatNumber(area.dailyFootTraffic)}명</span></div>
            <h3>${esc(area.name)}</h3>
            <p>${esc(area.summary)}</p>
            <a class="button secondary" href="area-detail.html?slug=${encodeURIComponent(area.slug)}">상세보기</a>
          </div>
        </article>`).join("");
    }

    if (categoryRoot) {
      const visible = config.homeCategoryOrder
        .map((category) => ({ category, count: media.filter((item) => item.category === category).length }))
        .filter((entry) => entry.count > 0);
      categoryRoot.innerHTML = visible.map(({ category, count }) => {
        const href = category === "package" ? "media.html?tab=package" : `media.html?category=${encodeURIComponent(category)}`;
        return `
          <article class="card">
            <div class="card-body">
              <div class="meta"><span>${count.toLocaleString("ko-KR")}개 매체</span></div>
              <h3>${esc(categoryLabels[category])}</h3>
              <p>${esc(categorySummary(category))}</p>
              <a class="button secondary" href="${href}">이 유형 매체 보기</a>
            </div>
          </article>`;
      }).join("");
    }
  }

  function categorySummary(category) {
    return categorySummaries[category] || "상담을 통해 목적에 맞는 매체 조합을 제안합니다.";
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderSiteChrome();
    setActiveNav();
    renderHome().catch((error) => {
      console.error(error);
    });
  });
})();
