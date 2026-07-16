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
    copyright: "저작권자 © 광고플레이. 무단전재 및 재배포 금지.",
    placeholderImage: "assets/images/placeholders/media-placeholder.svg",
    priceNotice: "표기된 광고비는 VAT 별도 기준의 참고가입니다. 최종 비용 및 구좌 가능 여부는 상담 시점에 확인이 필요합니다.",
    featuredAreaSlugs: ["dosan-daero", "samseong-coex", "gangnam-daero"],
    homeCategoryOrder: ["large_billboard", "package", "shopping_mall_did", "subway", "bus", "daily_touchpoint"],
    navItems: [
      { href: "media.html", label: "매체 찾기" },
      { href: "map.html", label: "지도 보기" },
      { href: "areas.html", label: "지역 보기" },
      { href: "insights.html", label: "옥외광고 가이드" },
      { href: "geocode.html", label: "주소 변환" },
      { href: "estimate.html", label: "견적 문의" },
      { href: "media-management.html", label: "매체 관리" },
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
      if (link.getAttribute("href") === current) link.classList.add("is-active");
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
      root.innerHTML = `
        <nav class="nav" aria-label="주요 메뉴">
          <a class="brand" href="${esc(config.brandHref)}"><span class="brand-mark">${esc(config.brandMark)}</span><span>${esc(config.brandName)}</span></a>
          <div class="nav-links">
            ${config.navItems.map((item) => `<a data-nav href="${esc(item.href)}"${item.external ? ` target="_blank" rel="noopener"` : ``}>${esc(item.label)}</a>`).join("")}
            <span class="nav-social" style="display:inline-flex;align-items:center;gap:12px;margin-left:6px;padding-left:14px;border-left:1px solid #e5e7eb">
              <a href="#" aria-label="페이스북" target="_blank" rel="noopener" style="color:#9aa4b2;line-height:0"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.6l.4-3H13.5V8.1c0-.87.24-1.46 1.5-1.46H16.6V4a20 20 0 0 0-2.3-.12c-2.3 0-3.8 1.4-3.8 3.95V10H7.9v3h2.6v8z"/></svg></a>
              <a href="#" aria-label="인스타그램" target="_blank" rel="noopener" style="color:#9aa4b2;line-height:0"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg></a>
              <a href="https://blog.naver.com/k-goplay" aria-label="네이버 블로그" target="_blank" rel="noopener" style="line-height:0"><span style="display:inline-flex;align-items:center;justify-content:center;height:17px;padding:0 4px;border-radius:4px;background:#9aa4b2;color:#fff;font:900 9px/1 system-ui;letter-spacing:.02em">blog</span></a>
              <a href="https://www.youtube.com/channel/UCxXNbNumZkcpjIGzUaOnfnQ" aria-label="유튜브" target="_blank" rel="noopener" style="color:#9aa4b2;line-height:0"><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6z"/></svg></a>
            </span>
          </div>
        </nav>`;
    });
    document.querySelectorAll("[data-site-footer]").forEach((root) => {
      root.innerHTML = `
        <div class="footer-inner">
          <strong>${esc(config.brandName)}</strong>
          <span>Tel. ${esc(config.phone)} · E-mail. ${esc(config.email)}</span>
          <small>${esc(config.copyright)}</small>
        </div>`;
    });
    document.querySelectorAll("[data-price-notice]").forEach((root) => {
      root.textContent = config.priceNotice;
    });
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
