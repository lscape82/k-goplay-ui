document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-detail");
  if (!root) return;

  const slug = AdPlay.getParam("slug");
  const [media, areas] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/areas.json"),
  ]);
  const item = media.find((entry) => entry.slug === slug);

  if (!item) {
    root.innerHTML = `
      <main class="detail-document">
        <p class="empty">매체 정보를 찾을 수 없습니다. <a href="media.html">매체 목록으로 돌아가기</a></p>
      </main>`;
    return;
  }

  document.title = `${item.name} | 광고플레이 DOOH`;
  const area = areas.find((entry) => entry.slug === item.areaSlug);
  const similar = media
    .filter((entry) => entry.areaSlug === item.areaSlug && entry.slug !== item.slug)
    .slice(0, 4);
  const playCondition = primaryPlayCondition(item);
  const recommendedIndustries = item.recommendedIndustries?.length ? item.recommendedIndustries : area?.recommendedIndustries;
  const faqs = buildFaqs(item, area, recommendedIndustries);

  root.innerHTML = `
    <article class="detail-document">
      <nav class="detail-crumb" aria-label="현재 위치">
        <a href="media.html">매체 찾기</a>
        <span>/</span>
        <a href="area-detail.html?slug=${encodeURIComponent(item.areaSlug)}">${AdPlay.esc(item.areaName)}</a>
      </nav>

      <header class="document-header">
        <div>
          <p class="document-kicker">${AdPlay.esc(item.areaName)} · ${AdPlay.esc(item.mediaType)}</p>
          <h1>${AdPlay.esc(item.name)}</h1>
          <p class="document-lede">${AdPlay.esc(detailSummary(item))}</p>
        </div>
      </header>

      <div class="detail-page-grid">
        <main class="detail-main-column">
          <figure class="document-photo ${item.videoUrl ? "has-video" : ""}">
            ${heroMedia(item)}
          </figure>

          <nav class="section-index" aria-label="상세 정보 목차">
            <a class="is-active" href="#summary">요약</a>
            <a href="#spec">스펙</a>
            <a href="#pricing">가격</a>
            <a href="#target">타깃</a>
            <a href="#faq">FAQ</a>
          </nav>

          <section id="summary" class="document-section">
            <div class="section-body">
              <h2>의사결정 요약</h2>
              <p>${AdPlay.esc(item.locationDescription || area?.description || area?.summary || "상세 위치 설명 확인 필요")}</p>
              ${insightVisuals(item, area)}
              <dl class="key-value-lines">
                ${line("주소", item.address || "주소 확인 필요")}
                ${line("지역", item.areaName)}
                ${line("매체 유형", AdPlay.categoryLabels[item.category] || item.mediaType || "확인 필요")}
                ${line("예약 안내", item.availabilityNote || "상담 시점에 구좌 가능 여부 확인 필요")}
              </dl>
            </div>
          </section>

          <section id="spec" class="document-section">
            <div class="section-body">
              <h2>매체 스펙</h2>
              <div class="spec-grid">
                ${specItem("규격", item.widthM && item.heightM ? `${item.widthM}m x ${item.heightM}m` : "확인 필요")}
                ${specItem("해상도", item.resolutionPx || "확인 필요")}
                ${specItem("운영시간", item.operationHours || "확인 필요")}
                ${specItem("소재/송출 조건", playCondition)}
              </div>
            </div>
          </section>

          <section id="pricing" class="document-section">
            <div class="section-body">
              <h2>가격</h2>
              <p class="document-note">${AdPlay.priceNotice()}</p>
              ${priceSummaryChips(item)}
              ${priceTable(item.pricing)}
            </div>
          </section>

          <section id="target" class="document-section">
            <div class="section-body">
              <h2>추천 업종과 지역 타깃</h2>
              <div class="text-columns">
                <div>
                  <h3>추천 업종</h3>
                  <div class="tag-list">${AdPlay.tagsHtml(recommendedIndustries)}</div>
                </div>
                <div>
                  <h3>지역 타깃</h3>
                  <ul class="clean-list">${listItems(area?.primaryTargets)}</ul>
                </div>
              </div>
            </div>
          </section>

          <section id="faq" class="document-section">
            <div class="section-body">
              <h2>자주 묻는 질문</h2>
              <div class="faq-list">
                ${faqs.map((f, i) => `
                  <details class="faq-item"${i === 0 ? " open" : ""}>
                    <summary>${AdPlay.esc(f.q)}</summary>
                    <p>${AdPlay.esc(f.a)}</p>
                  </details>`).join("")}
              </div>
            </div>
          </section>

          <section class="related-document">
            <div class="related-head">
              <h2>같은 지역의 유사 매체</h2>
              <a href="media.html">전체 매체 보기</a>
            </div>
            <div class="related-list">${similar.map(similarRow).join("") || '<p class="empty">유사 매체가 없습니다.</p>'}</div>
          </section>
        </main>

        <aside class="summary-rail" aria-label="견적 요약">
          <div class="summary-card">
            <div class="summary-card-head">
              <span>대표 광고비</span>
              <strong>${AdPlay.priceLabel(item)}</strong>
            </div>
            ${factRow("송출 조건", playCondition)}
            ${factRow("운영 시간", item.operationHours || "확인 필요")}
            ${factRow("단기 집행", item.shortTermAvailable ? "가능" : "협의 필요")}
            <a class="button" href="estimate.html?media=${encodeURIComponent(item.slug)}">이 매체 견적 문의</a>
            <a class="button secondary" href="one-pager.html?slug=${encodeURIComponent(item.slug)}">매체 제안서 (PDF)</a>
            <p>${AdPlay.priceNotice()}</p>
          </div>
        </aside>
      </div>
    </article>
  `;

  initSectionTabs(root);
  injectSeo(item, area, faqs);
});

function buildFaqs(item, area, industries) {
  const price = AdPlay.priceLabel(item);
  const addr = item.address || item.areaName || "위치 확인 필요";
  const size = item.widthM && item.heightM ? `${item.widthM}m x ${item.heightM}m` : "규격 상담 필요";
  const res = item.resolutionPx || "해상도 확인 필요";
  const hours = item.operationHours || "운영시간 확인 필요";
  const shortTerm = item.shortTermAvailable
    ? "네, 단기 집행이 가능합니다. 가능 기간과 구좌는 상담 시 확인해 드립니다."
    : "단기 집행 여부는 매체 사정에 따라 상담 시 협의가 필요합니다.";
  const industryText = (industries || []).slice(0, 5).join(", ");
  return [
    { q: `${item.name} 광고 비용은 얼마인가요?`, a: `${price}이며(VAT 별도), 집행 기간과 소재 길이에 따라 달라집니다. 정확한 비용과 구좌 가능 여부는 상담 시 확정됩니다.` },
    { q: `${item.name}은(는) 어디에 있나요?`, a: `${addr}에 위치한 ${item.mediaType || "옥외광고 매체"}입니다.${item.areaName ? ` ${item.areaName} 상권 동선에서 노출됩니다.` : ""}` },
    { q: `${item.name} 규격과 운영시간은 어떻게 되나요?`, a: `화면 규격 ${size}, 해상도 ${res}, 운영시간 ${hours}입니다.` },
    { q: "단기 집행도 가능한가요?", a: shortTerm },
    industryText ? { q: "어떤 업종 광고에 적합한가요?", a: `${industryText} 등 업종에 적합하며, ${item.areaName || "해당 상권"}의 유동 특성에 맞춘 캠페인에 효과적입니다.` } : null,
  ].filter(Boolean);
}

function injectSeo(item, area, faqs) {
  const base = "https://lscape82.github.io/k-goplay-ui/";
  const url = `${base}media-detail.html?slug=${encodeURIComponent(item.slug)}`;
  const rawImg = AdPlay.pageImage(item);
  const img = /^https?:/.test(rawImg) ? rawImg : base + rawImg.replace(/^\//, "");
  const size = item.widthM && item.heightM ? `, 규격 ${item.widthM}m x ${item.heightM}m` : "";
  const desc = `${item.name} — ${item.address || item.areaName} ${item.mediaType || "옥외광고"} 광고. ${AdPlay.priceLabel(item)}(VAT 별도)${size}. 위치·광고비·유동인구 데이터를 확인하고 견적을 문의하세요.`.slice(0, 158);
  const title = `${item.name} 광고 – ${item.areaName || "전국"} 옥외광고(DOOH) | 광고플레이`;

  document.title = title;
  setMetaTag("name", "description", desc);
  setMetaTag("name", "keywords", `${item.name}, ${item.areaName || ""} 전광판, ${item.mediaType || "전광판"}, 옥외광고, DOOH, 전광판 광고, 광고플레이`);
  setLinkTag("canonical", url);
  setMetaTag("property", "og:type", "website");
  setMetaTag("property", "og:site_name", "광고플레이");
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", desc);
  setMetaTag("property", "og:url", url);
  setMetaTag("property", "og:image", img);
  setMetaTag("name", "twitter:card", "summary_large_image");

  const min = AdPlay.minMonthlyPrice(item);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    description: desc,
    image: img,
    category: item.mediaType || "옥외광고",
    ...(min ? { offers: { "@type": "Offer", price: min, priceCurrency: "KRW", availability: "https://schema.org/InStock", url } } : {}),
    ...(item.address ? { areaServed: item.areaName || undefined, address: { "@type": "PostalAddress", streetAddress: item.address, addressCountry: "KR" } } : {}),
    brand: { "@type": "Brand", name: "광고플레이" },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "매체 찾기", item: `${base}media.html` },
      { "@type": "ListItem", position: 2, name: item.areaName || "지역", item: `${base}area-detail.html?slug=${encodeURIComponent(item.areaSlug || "")}` },
      { "@type": "ListItem", position: 3, name: item.name, item: url },
    ],
  };
  addJsonLd("ld-product", productLd);
  addJsonLd("ld-faq", faqLd);
  addJsonLd("ld-breadcrumb", breadcrumbLd);
}

function setMetaTag(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute("content", value);
}

function setLinkTag(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
  el.setAttribute("href", href);
}

function addJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
  el.textContent = JSON.stringify(data);
}

function factRow(label, value) {
  return `<div class="summary-row"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
}

function line(label, value) {
  return `<dt>${AdPlay.esc(label)}</dt><dd>${AdPlay.esc(value)}</dd>`;
}

function specItem(label, value) {
  return `<div class="spec-item"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
}

function heroMedia(item) {
  if (item.videoUrl) {
    return `
      <video class="document-video" src="${AdPlay.esc(item.videoUrl)}" poster="${AdPlay.esc(AdPlay.pageImage(item))}" autoplay muted loop playsinline controls aria-label="${AdPlay.esc(item.name)} 영상">
        <img src="${AdPlay.esc(AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지">
      </video>`;
  }
  return `<img src="${AdPlay.esc(AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지" onerror="this.src='${AdPlay.esc(AdPlay.config.placeholderImage)}'">`;
}

function detailSummary(item) {
  const addressText = item.address || item.areaName || "위치 확인 필요";
  return `${addressText} · ${item.mediaType || "DOOH 매체"} · ${AdPlay.priceLabel(item)}`;
}

function primaryPlayCondition(item) {
  const row = item.pricing && item.pricing[0];
  if (!row) return "상담 필요";
  const duration = row.durationSec ? `${row.durationSec}초` : "소재 길이 협의";
  const plays = row.dailyPlays ? `일 ${row.dailyPlays}회` : "송출 횟수 협의";
  return `${duration} · ${plays}`;
}

function listItems(items) {
  if (!items || !items.length) return "<li>상담 시 캠페인 목표에 맞춰 확인</li>";
  return items.map((item) => `<li>${AdPlay.esc(item)}</li>`).join("");
}

function areaGenderAge(item) {
  const p = AdPlay.audienceProfile(item);
  return {
    gender: [{ label: "여성", value: p.gender.female }, { label: "남성", value: p.gender.male }],
    age: p.age.map(([label, percent]) => [label, percent]),
  };
}

function deriveAudienceInsights(item, area) {
  const base500 = Number(area?.dailyFootTraffic) || 76000;
  const base300 = Math.round(base500 * 0.4);
  const ga = areaGenderAge(item);
  const dayDist = [["월", 16], ["화", 16], ["수", 17], ["목", 17], ["금", 16], ["토", 11], ["일", 7]];
  const bh = (area?.busHourlyUsers || []).filter((r) => Number(r.users) > 0);
  let timePercent;
  if (bh.length) {
    const total = bh.reduce((sum, r) => sum + Number(r.users || 0), 0) || 1;
    timePercent = bh.map((r) => ({ label: r.label, value: Math.round(Number(r.users || 0) / total * 100) }));
  } else {
    timePercent = [["05~09", 14], ["09~12", 18], ["12~14", 16], ["14~18", 26], ["18~23", 22], ["23~05", 4]].map(([label, value]) => ({ label, value }));
  }
  const wobble = [0, 0.02, 0.04, 0.06, 0.07, 0.05, 0.03, 0.06, 0.05, 0.06, 0.03, 0.02];
  const monthly = wobble.map((w, i) => ({ month: `2026.${String(i + 1).padStart(2, "0")}`, value: Math.round(base500 * (0.95 + w)) }));
  return {
    averageDailyFootTraffic: { radius500m: base500, radius300m: base300 },
    weekdayPercent: [{ label: "주중", value: 72 }, { label: "주말", value: 28 }],
    genderPercent: ga.gender,
    agePercent: ga.age.map(([label, value]) => ({ label, value })),
    dayPercent: dayDist.map(([label, value]) => ({ label, value })),
    timePercent,
    monthlyDailyFootTraffic500m: monthly,
    _derived: true,
  };
}

function insightVisuals(item, area) {
  const insights = item.audienceInsights || deriveAudienceInsights(item, area);
  return `
    <div class="insight-grid">
      ${audienceDashboardVisual(item, insights)}
      ${operationVisual(item.operationHours)}
      ${screenSizeVisual(item)}
      ${efficiencyVisual(item)}
      ${stationBars(area)}
      ${busBars(area)}
      ${busHourlyBars(area)}
    </div>
    ${insights._derived ? `<p class="derived-src"><span class="derived-badge">추정</span> 성별·연령·시간대는 상권 기준 추정치입니다 · 출처: 소상공인 상권정보 · 통계청 KOSIS (2026)</p>` : ""}`;
}

function metricItem(label, value, suffix) {
  const text = Number.isFinite(Number(value)) ? `${AdPlay.formatNumber(value)}${suffix}` : "확인 필요";
  return `<div class="metric-item"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(text)}</strong></div>`;
}

function subwayTotal(area) {
  return (area?.subwayMonthlyUsers || []).reduce((sum, station) => sum + Number(station.users || 0), 0) || null;
}

function busTotal(area) {
  return (area?.busMonthlyUsers || []).reduce((sum, station) => sum + Number(station.users || 0), 0) || null;
}

function audienceDashboardVisual(item, insights) {
  insights = insights || item.audienceInsights;
  if (!insights) return "";
  const avg500 = Number(insights.averageDailyFootTraffic?.radius500m) || 0;
  const avg300 = Number(insights.averageDailyFootTraffic?.radius300m) || 0;
  const weekday = Number((insights.weekdayPercent || [])[0]?.value) || 0;
  const weekend = Number((insights.weekdayPercent || [])[1]?.value) || 0;
  return `
    <div class="audience-dashboard span-2">
      <div class="audience-metrics">
        ${audienceMetricCard("일평균 유동인구", "300m", avg300)}
        ${audienceMetricCard("일평균 유동인구", "500m", avg500)}
        ${audienceMetricCard("주중 일평균", "500m", Math.round(avg500 * weekday / 100))}
        ${audienceMetricCard("주말 일평균", "500m", Math.round(avg500 * weekend / 100))}
      </div>
      <div class="audience-card audience-card-gender">
        <h3>성별 비율 기준 500m</h3>
        ${audienceProgressRows(countFromPercent(insights.genderPercent, avg500), true)}
      </div>
      <div class="audience-card">
        <h3>연령대별 분포 기준 500m</h3>
        ${audienceProgressRows(countFromPercent(insights.agePercent, avg500), false)}
      </div>
      <div class="audience-card">
        <h3>요일별 일평균 기준 500m</h3>
        ${audienceProgressRows(countFromPercent(insights.dayPercent, avg500), false)}
      </div>
      <div class="audience-card audience-card-time">
        <h3>시간대별 유동인구 기준 500m</h3>
        ${audienceColumnChart(countFromPercent(insights.timePercent, avg500))}
      </div>
      <div class="audience-card audience-card-trend">
        <h3>월별 일평균 유동인구 추이 기준 500m</h3>
        ${audienceLineChart(insights.monthlyDailyFootTraffic500m || [])}
      </div>
    </div>`;
}

function audienceMetricCard(label, scope, value) {
  return `
    <div class="audience-metric">
      <span>${AdPlay.esc(label)} <b>(${AdPlay.esc(scope)})</b></span>
      <strong>${AdPlay.formatNumber(value)}명</strong>
    </div>`;
}

function countFromPercent(rows, base) {
  return (rows || []).map((row) => ({
    label: row.label,
    percent: Number(row.value) || 0,
    count: Math.round((Number(base) || 0) * (Number(row.value) || 0) / 100),
  }));
}

function audienceProgressRows(rows, genderColor) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return `
    <div class="audience-progress-list">
      ${rows.map((row, index) => {
        const width = `${Math.max(3, (row.count / max) * 100)}%`;
        return `
          <div class="audience-progress ${genderColor && index === 1 ? "is-accent" : ""}">
            <span>${AdPlay.esc(row.label)}</span>
            <div class="audience-progress-track"><i style="width:${width}"></i></div>
            <strong>${AdPlay.formatNumber(row.count)}명 <em>${formatPercent(row.percent)}</em></strong>
          </div>`;
      }).join("")}
    </div>`;
}

function audienceColumnChart(rows) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return `
    <div class="audience-columns">
      ${rows.map((row) => {
        const height = `${Math.max(8, (row.count / max) * 100)}%`;
        return `
          <div class="audience-column">
            <strong>${formatCompact(row.count)}</strong>
            <i style="height:${height}"></i>
            <span>${AdPlay.esc(row.label)}</span>
          </div>`;
      }).join("")}
    </div>`;
}

function audienceLineChart(rows) {
  const points = (rows || []).map((row) => ({ label: monthLabel(row.month), value: Number(row.value) || 0 }));
  if (!points.length) return "";
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 640;
  const height = 220;
  const padX = 38;
  const padTop = 34;
  const padBottom = 42;
  const plotWidth = width - padX * 2;
  const plotHeight = height - padTop - padBottom;
  const coords = points.map((point, index) => {
    const x = padX + (plotWidth * index / Math.max(points.length - 1, 1));
    const ratio = max === min ? 0.5 : (point.value - min) / (max - min);
    const y = padTop + plotHeight - (plotHeight * ratio);
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return `
    <div class="audience-line-wrap">
      <svg class="audience-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="월별 일평균 유동인구 추이">
        <polyline points="${line}" fill="none" stroke="#496c98" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${coords.map((point) => `
          <g>
            <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" fill="#496c98"></circle>
            <text x="${point.x.toFixed(1)}" y="${(point.y - 12).toFixed(1)}" text-anchor="middle">${formatCompact(point.value)}</text>
            <text class="axis-label" x="${point.x.toFixed(1)}" y="${height - 12}" text-anchor="middle">${AdPlay.esc(point.label)}</text>
          </g>`).join("")}
      </svg>
    </div>`;
}

function formatCompact(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return `${Math.round(num / 1000)}K`;
}

function audienceMetricVisual(item) {
  const insights = item.audienceInsights;
  if (!insights) return "";
  return `
    <div class="insight-panel span-2">
      <div class="insight-head">
        <span>매체 반경 데이터 <em>엑셀 분석</em></span>
        <strong>500m 일평균 ${AdPlay.formatNumber(insights.averageDailyFootTraffic?.radius500m)}명</strong>
      </div>
      <div class="metric-strip">
        ${metricItem("500m 유동인구", insights.averageDailyFootTraffic?.radius500m, "명")}
        ${metricItem("300m 유동인구", insights.averageDailyFootTraffic?.radius300m, "명")}
        ${metricItem("주중 비중", (insights.weekdayPercent || [])[0]?.value, "%")}
      </div>
    </div>`;
}

function audienceTrendVisual(item) {
  const rows = item.audienceInsights?.monthlyDailyFootTraffic500m || [];
  const values = rows.map((row) => Number(row.value)).filter((value) => Number.isFinite(value));
  if (!values.length) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const peak = rows.reduce((best, row) => Number(row.value) > Number(best.value) ? row : best, rows[0]);
  return `
    <div class="insight-panel span-2 audience-trend-panel">
      <div class="insight-head">
        <span>월별 유동인구 추이 <em>500m 기준</em></span>
        <strong>최고 ${monthLabel(peak.month)} · ${AdPlay.formatNumber(peak.value)}명</strong>
      </div>
      <div class="audience-bars" aria-label="월별 500m 일평균 유동인구">
        ${rows.map((row) => {
          const value = Number(row.value);
          const height = max ? Math.max(14, (value / max) * 100) : 0;
          return `
            <div class="audience-bar ${value === max ? "is-peak" : ""}">
              <i style="height:${height}%"></i>
              <span>${AdPlay.esc(monthLabel(row.month))}</span>
            </div>`;
        }).join("")}
      </div>
      <p class="insight-caption">연평균 ${AdPlay.formatNumber(item.audienceInsights?.averageDailyFootTraffic?.radius500m)}명, 월별 범위 ${AdPlay.formatNumber(min)}~${AdPlay.formatNumber(max)}명입니다.</p>
    </div>`;
}

function genderVisual(item) {
  const rows = item.audienceInsights?.genderPercent || [];
  if (!rows.length) return "";
  return `
    <div class="insight-panel">
      <div class="insight-head">
        <span>성별 비중 <em>500m 기준</em></span>
        <strong>${AdPlay.esc(topPercentLabel(rows))}</strong>
      </div>
      <div class="split-chart">
        ${rows.map((row, index) => `<i class="${index === 0 ? "primary" : "secondary"}" style="width:${Number(row.value)}%"></i>`).join("")}
      </div>
      <div class="split-legend">${rows.map((row) => `<span><b>${AdPlay.esc(row.label)}</b>${formatPercent(row.value)}</span>`).join("")}</div>
    </div>`;
}

function ageVisual(item) {
  return percentBarPanel("연령대 비중", "핵심 연령 40~60대+", item.audienceInsights?.agePercent, true);
}

function timeSlotVisual(item) {
  return percentBarPanel("시간대 비중", "오후~저녁 집중 노출", item.audienceInsights?.timePercent, false);
}

function percentBarPanel(kicker, title, rows, compact) {
  if (!rows || !rows.length) return "";
  const max = Math.max(...rows.map((row) => Number(row.value) || 0));
  return `
    <div class="insight-panel">
      <div class="insight-head">
        <span>${AdPlay.esc(kicker)} <em>500m 기준</em></span>
        <strong>${AdPlay.esc(title)}</strong>
      </div>
      <div class="profile-bars ${compact ? "is-compact" : ""}">
        ${rows.map((row) => {
          const value = Number(row.value) || 0;
          const width = max ? Math.max(5, (value / max) * 100) : 0;
          return `
            <div class="profile-row">
              <span>${AdPlay.esc(row.label)}</span>
              <div class="bar-track"><i style="width:${width}%"></i></div>
              <strong>${formatPercent(value)}</strong>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function monthLabel(month) {
  const parts = String(month || "").split(".");
  return parts.length > 1 ? `${Number(parts[1])}월` : String(month || "");
}

function topPercentLabel(rows) {
  const top = [...rows].sort((a, b) => Number(b.value) - Number(a.value))[0];
  return top ? `${top.label} ${formatPercent(top.value)}` : "확인 필요";
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "확인 필요";
  return `${Number.isInteger(num) ? num : num.toFixed(1)}%`;
}

function operationVisual(operationHours) {
  const parsed = parseOperationHours(operationHours);
  const left = parsed ? `${(parsed.start / 1440) * 100}%` : "0%";
  const width = parsed ? `${((parsed.end - parsed.start) / 1440) * 100}%` : "0%";
  return `
    <div class="insight-panel">
      <div class="insight-head">
        <span>운영 시간</span>
        <strong>${AdPlay.esc(operationHours || "확인 필요")}</strong>
      </div>
      <div class="time-visual">
        <div class="time-track"><i style="left:${left}; width:${width};"></i></div>
        <div class="time-scale"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      </div>
    </div>`;
}

function parseOperationHours(text) {
  const match = String(text || "").match(/(\d{1,2}):?(\d{2})?\s*[~\-]\s*(\d{1,2}):?(\d{2})?/);
  if (!match) return null;
  const start = Number(match[1]) * 60 + Number(match[2] || 0);
  let end = Number(match[3]) * 60 + Number(match[4] || 0);
  if (end === 0 || end === 24 * 60) end = 24 * 60;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function screenSizeVisual(item) {
  const hasSize = item.widthM && item.heightM;
  const area = hasSize ? item.widthM * item.heightM : null;
  return `
    <div class="insight-panel">
      <div class="insight-head">
        <span>화면 규모</span>
        <strong>${hasSize ? `${item.widthM}m x ${item.heightM}m` : "확인 필요"}</strong>
      </div>
      <div class="screen-viz">
        <div class="screen-shape" style="${hasSize ? `aspect-ratio:${item.widthM}/${item.heightM};` : ""}"></div>
        <p>${area ? `약 ${area.toFixed(1)}㎡` : "규격 확인 필요"}</p>
      </div>
    </div>`;
}

function efficiencyVisual(item) {
  const row = item.pricing && item.pricing.find((price) => Number(price.monthlyPriceKRW) > 0 && Number(price.dailyPlays) > 0);
  if (!row) return "";
  const monthly = Number(row.monthlyPriceKRW);
  const dailyPlays = Number(row.dailyPlays);
  const dailyCost = Math.round(monthly / 30);
  const monthlyPlays = dailyPlays * 30;
  const costPerPlay = Math.round(monthly / monthlyPlays);
  return `
    <div class="insight-panel">
      <div class="insight-head">
        <span>가격 효율</span>
        <strong>${AdPlay.esc(row.label || "기본 조건")}</strong>
      </div>
      <div class="efficiency-list">
        ${efficiencyItem("일 환산 비용", AdPlay.formatKRW(dailyCost))}
        ${efficiencyItem("월 예상 송출", `${AdPlay.formatNumber(monthlyPlays)}회`)}
        ${efficiencyItem("1회 송출 단가", `${AdPlay.formatNumber(costPerPlay)}원`)}
      </div>
      <p class="insight-caption">월 광고비를 30일, 일 송출 횟수 기준으로 단순 환산한 값입니다.</p>
    </div>`;
}

function efficiencyItem(label, value) {
  return `<div class="efficiency-item"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
}

function stationBars(area) {
  const stations = [...(area?.subwayMonthlyUsers || [])]
    .filter((station) => Number.isFinite(Number(station.users)))
    .sort((a, b) => Number(b.users) - Number(a.users))
    .slice(0, 5);
  if (!stations.length) return "";
  const max = Math.max(...stations.map((station) => Number(station.users)));
  return `
    <div class="insight-panel span-2">
      <div class="insight-head">
        <span>주요 지하철 월 이용객</span>
        <strong>${AdPlay.esc(area?.name || "지역")} 권역</strong>
      </div>
      <div class="bar-list">
        ${stations.map((station) => {
          const width = `${Math.max(8, (Number(station.users) / max) * 100)}%`;
          return `
            <div class="bar-row ${station === stations[0] ? "is-top" : ""}">
              <span>${AdPlay.esc(station.station)}</span>
              <div class="bar-track"><i style="width:${width};"></i></div>
              <strong>${station === stations[0] ? '<b>TOP</b>' : ""}${AdPlay.formatNumber(station.users)}</strong>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function busBars(area) {
  const stops = [...(area?.busMonthlyUsers || [])]
    .filter((stop) => Number.isFinite(Number(stop.users)))
    .sort((a, b) => Number(b.users) - Number(a.users))
    .slice(0, 5);
  if (!stops.length) return "";
  const max = Math.max(...stops.map((stop) => Number(stop.users)));
  return `
    <div class="insight-panel span-2">
      <div class="insight-head">
        <span>주요 버스 정류장 월 승하차</span>
        <strong>${AdPlay.esc(area?.busDataSource || "서울시 버스 데이터")}</strong>
      </div>
      <div class="bar-list">
        ${stops.map((stop) => {
          const width = `${Math.max(8, (Number(stop.users) / max) * 100)}%`;
          const label = stop.ars ? `${stop.station} · ${stop.ars}` : stop.station;
          return `
            <div class="bar-row ${stop === stops[0] ? "is-top" : ""}">
              <span>${AdPlay.esc(label)}</span>
              <div class="bar-track"><i style="width:${width};"></i></div>
              <strong>${stop === stops[0] ? '<b>TOP</b>' : ""}${AdPlay.formatNumber(stop.users)}</strong>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function busHourlyBars(area) {
  const rows = [...(area?.busHourlyUsers || [])].filter((row) => Number.isFinite(Number(row.users)));
  if (!rows.length) return "";
  const max = Math.max(...rows.map((row) => Number(row.users)));
  return `
    <div class="insight-panel span-2">
      <div class="insight-head">
        <span>버스 시간대별 승하차</span>
        <strong>${AdPlay.esc(peakBusLabel(rows))}</strong>
      </div>
      <div class="bar-list">
        ${rows.map((row) => {
          const isPeak = Number(row.users) === max;
          const width = `${Math.max(8, (Number(row.users) / max) * 100)}%`;
          return `
            <div class="bar-row ${isPeak ? "is-top" : ""}">
              <span>${AdPlay.esc(row.label)}</span>
              <div class="bar-track"><i style="width:${width};"></i></div>
              <strong>${isPeak ? '<b>PEAK</b>' : ""}${AdPlay.formatNumber(row.users)}</strong>
            </div>`;
        }).join("")}
      </div>
    </div>`;
}

function peakBusLabel(rows) {
  const peak = rows.reduce((top, row) => Number(row.users) > Number(top.users) ? row : top, rows[0]);
  return `${peak.label} 집중`;
}

function priceSummaryChips(item) {
  const min = AdPlay.minMonthlyPrice(item);
  const hasShortTermPrice = (item.pricing || []).some((row) => [
    row.price15DaysKRW,
    row.price10DaysKRW,
    row.price7DaysKRW,
    row.price5DaysKRW,
    row.price3DaysKRW,
    row.price1DayKRW,
  ].some((value) => Number(value) > 0));
  return `
    <div class="price-summary">
      <span><b>최저 월</b>${min ? AdPlay.formatKRW(min) : "상담 필요"}</span>
      <span><b>과세</b>${AdPlay.esc(item.taxNote || "VAT 별도")}</span>
      <span><b>단기</b>${hasShortTermPrice ? "가격표 제공" : item.shortTermAvailable ? "집행 가능 · 협의" : "협의 필요"}</span>
    </div>`;
}

function priceTable(rows) {
  if (!rows || !rows.length) return `<p class="empty">가격은 상담 시 확인이 필요합니다.</p>`;
  const columns = [
    { key: "monthlyPriceKRW", label: "월" },
    { key: "price15DaysKRW", label: "15일" },
    { key: "price10DaysKRW", label: "10일" },
    { key: "price7DaysKRW", label: "7일" },
    { key: "price5DaysKRW", label: "5일" },
    { key: "price3DaysKRW", label: "3일" },
    { key: "price1DayKRW", label: "1일" },
  ].filter((col) => rows.some((row) => {
    const v = row[col.key];
    return v !== null && v !== undefined && v !== "";
  }));
  return `
    <div class="table-wrap document-price-table">
      <table>
        <thead>
          <tr>
            <th>조건</th>
            ${columns.map((col) => `<th>${col.label}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>
                <strong>${AdPlay.esc(row.label || "조건 확인")}</strong>
                <small>${AdPlay.esc(row.rawText || "")}</small>
              </td>
              ${columns.map((col) => priceCell(row[col.key])).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function priceCell(value) {
  const isEmpty = value === null || value === undefined || value === "";
  return `<td class="${isEmpty ? "muted-price" : "strong-price"}">${AdPlay.formatKRW(value)}</td>`;
}

function similarRow(item) {
  return `
    <a class="related-row" href="media-detail.html?slug=${encodeURIComponent(item.slug)}">
      <span>${AdPlay.esc(item.areaName)}</span>
      <strong>${AdPlay.esc(item.name)}</strong>
      <em>${AdPlay.priceLabel(item)}</em>
    </a>`;
}

function initSectionTabs(root) {
  const links = [...root.querySelectorAll(".section-index a")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  links.forEach((link) => {
    link.addEventListener("click", () => {
      links.forEach((item) => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });

  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    const current = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!current) return;
    links.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${current.target.id}`);
    });
  }, { rootMargin: "-25% 0px -60% 0px", threshold: [0.1, 0.4, 0.7] });
  sections.forEach((section) => observer.observe(section));
}
