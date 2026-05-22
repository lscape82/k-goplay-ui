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
          <figure class="document-photo">
            <img src="${AdPlay.esc(AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지" onerror="this.src='${AdPlay.esc(AdPlay.config.placeholderImage)}'">
          </figure>

          <nav class="section-index" aria-label="상세 정보 목차">
            <a class="is-active" href="#summary">요약</a>
            <a href="#spec">스펙</a>
            <a href="#pricing">가격</a>
            <a href="#target">타깃</a>
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
            <p>${AdPlay.priceNotice()}</p>
          </div>
        </aside>
      </div>
    </article>
  `;

  initSectionTabs(root);
});

function factRow(label, value) {
  return `<div class="summary-row"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
}

function line(label, value) {
  return `<dt>${AdPlay.esc(label)}</dt><dd>${AdPlay.esc(value)}</dd>`;
}

function specItem(label, value) {
  return `<div class="spec-item"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
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

function insightVisuals(item, area) {
  return `
    <div class="insight-grid">
      <div class="insight-panel span-2">
        <div class="insight-head">
          <span>상권 지표</span>
          <strong>도달 가능 규모</strong>
        </div>
        <div class="metric-strip">
          ${metricItem("일 유동인구", area?.dailyFootTraffic, "명")}
          ${metricItem("일 교통량", area?.trafficVolumeDaily, "대")}
          ${metricItem("월 지하철 이용", subwayTotal(area), "명")}
        </div>
      </div>
      ${operationVisual(item.operationHours)}
      ${screenSizeVisual(item)}
      ${efficiencyVisual(item)}
      ${stationBars(area)}
    </div>`;
}

function metricItem(label, value, suffix) {
  const text = Number.isFinite(Number(value)) ? `${AdPlay.formatNumber(value)}${suffix}` : "확인 필요";
  return `<div class="metric-item"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(text)}</strong></div>`;
}

function subwayTotal(area) {
  return (area?.subwayMonthlyUsers || []).reduce((sum, station) => sum + Number(station.users || 0), 0) || null;
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
