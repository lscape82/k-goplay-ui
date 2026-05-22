document.addEventListener("DOMContentLoaded", async () => {
  const listRoot = document.querySelector("#areas-list");
  const detailRoot = document.querySelector("#area-detail");
  if (!listRoot && !detailRoot) return;

  const [areas, media, guides] = await Promise.all([
    AdPlay.loadJson("data/areas.json"),
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/guides.json"),
  ]);

  if (listRoot) renderAreaList(listRoot, areas, media);
  if (detailRoot) renderAreaDetail(detailRoot, areas, media, guides);
});

function renderAreaList(root, areas, media) {
  root.innerHTML = areas.map((area) => {
    const count = media.filter((item) => item.areaSlug === area.slug).length;
    return `
      <article class="directory-card">
        <div class="directory-meta">
          <span>${count.toLocaleString("ko-KR")}개 매체</span>
          ${area.needsReview ? '<span class="soft-badge review">검수 필요</span>' : '<span class="soft-badge">데이터 확보</span>'}
        </div>
        <h3>${AdPlay.esc(area.name)}</h3>
        <p>${AdPlay.esc(area.summary)}</p>
        <div class="compact-metrics">
          ${compactMetric("일 유동", `${AdPlay.formatNumber(area.dailyFootTraffic)}명`)}
          ${compactMetric("교통량", `${AdPlay.formatNumber(area.trafficVolumeDaily)}대`)}
        </div>
        <div class="tag-list">${AdPlay.tagsHtml(area.recommendedIndustries)}</div>
        <a class="button secondary" href="area-detail.html?slug=${encodeURIComponent(area.slug)}">상세보기</a>
      </article>`;
  }).join("");
}

function renderAreaDetail(root, areas, media, guides) {
  const slug = AdPlay.getParam("slug") || "dosan-daero";
  const area = areas.find((entry) => entry.slug === slug);
  if (!area) {
    root.innerHTML = `<div class="container"><div class="empty">지역 정보를 찾을 수 없습니다.</div></div>`;
    return;
  }

  document.title = `${area.name} | 광고플레이 DOOH`;
  const areaMedia = media.filter((item) => item.areaSlug === area.slug);
  const relatedGuides = guides.filter((guide) => guide.areaSlug === area.slug || !guide.areaSlug).slice(0, 3);

  root.innerHTML = `
    <article class="area-document">
      <div class="container">
        <nav class="detail-crumb" aria-label="현재 위치">
          <a href="areas.html">지역 보기</a>
          <span>/</span>
          <span>${AdPlay.esc(area.name)}</span>
        </nav>

        <header class="document-header compact-document-header">
          <div>
            <p class="document-kicker">AREA GUIDE</p>
            <h1>${AdPlay.esc(area.name)}</h1>
            <p class="document-lede">${AdPlay.esc(area.description || area.summary)}</p>
          </div>
          <div class="document-status">
            <span>${area.needsReview ? "검수 필요" : "검수 완료"}</span>
            <strong>${(area.sourcePages || []).join(", ") || "-"}p</strong>
          </div>
        </header>

        ${area.needsReview ? `<p class="subtle-alert">${AdPlay.esc(area.dataQualityNote)}</p>` : ""}

        <section class="document-section">
          <div class="section-body">
            <h2>지역 핵심 지표</h2>
            <div class="insight-grid area-insights">
              <div class="insight-panel span-2">
                <div class="insight-head"><span>상권 규모</span><strong>광고 집행 판단 기준</strong></div>
                <div class="metric-strip">
                  ${metricItem("일 유동인구", area.dailyFootTraffic, "명")}
                  ${metricItem("일 교통량", area.trafficVolumeDaily, "대")}
                  ${metricItem("등록 매체", areaMedia.length, "개")}
                </div>
              </div>
              ${subwayBars(area)}
              <div class="insight-panel">
                <div class="insight-head"><span>추천 업종</span><strong>우선 검토 카테고리</strong></div>
                <div class="tag-list">${AdPlay.tagsHtml(area.recommendedIndustries)}</div>
              </div>
              <div class="insight-panel">
                <div class="insight-head"><span>주요 타깃</span><strong>대표 소비층</strong></div>
                <div class="tag-list">${AdPlay.tagsHtml(area.primaryTargets)}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="document-section">
          <div class="section-body">
            <div class="related-head">
              <h2>해당 지역 매체</h2>
              <a href="media.html">전체 매체 보기</a>
            </div>
            <p class="document-note">${AdPlay.priceNotice()}</p>
            <div class="related-list">${areaMedia.map(mediaRow).join("") || '<p class="empty">등록된 매체가 없습니다.</p>'}</div>
          </div>
        </section>

        <section class="document-section">
          <div class="section-body">
            <div class="related-head">
              <h2>관련 가이드</h2>
              <a href="guides.html">가이드 전체</a>
            </div>
            <div class="directory-grid compact">${relatedGuides.map(guideCard).join("")}</div>
          </div>
        </section>
      </div>
    </article>`;
}

function compactMetric(label, value) {
  return `<div><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
}

function metricItem(label, value, suffix) {
  const text = Number.isFinite(Number(value)) ? `${AdPlay.formatNumber(value)}${suffix}` : "확인 필요";
  return `<div class="metric-item"><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(text)}</strong></div>`;
}

function subwayBars(area) {
  const rows = [...(area.subwayMonthlyUsers || [])]
    .filter((row) => Number.isFinite(Number(row.users)))
    .sort((a, b) => Number(b.users) - Number(a.users))
    .slice(0, 5);
  if (!rows.length) return "";
  const max = Math.max(...rows.map((row) => Number(row.users)));
  return `
    <div class="insight-panel span-2">
      <div class="insight-head"><span>지하철 월 이용객</span><strong>주요 역 TOP ${rows.length}</strong></div>
      <div class="bar-list">
        ${rows.map((row, index) => `
          <div class="bar-row ${index === 0 ? "is-top" : ""}">
            <span>${AdPlay.esc(row.station)}</span>
            <div class="bar-track"><i style="width:${Math.max(8, (Number(row.users) / max) * 100)}%;"></i></div>
            <strong>${index === 0 ? "<b>TOP</b>" : ""}${AdPlay.formatNumber(row.users)}</strong>
          </div>`).join("")}
      </div>
    </div>`;
}

function mediaRow(item) {
  return `
    <a class="related-row" href="media-detail.html?slug=${encodeURIComponent(item.slug)}">
      <span>${AdPlay.esc(item.mediaType || item.areaName)}</span>
      <strong>${AdPlay.esc(item.name)}</strong>
      <em>${AdPlay.priceLabel(item)}</em>
    </a>`;
}

function guideCard(guide) {
  return `
    <article class="directory-card small">
      <div class="directory-meta"><span>${AdPlay.esc(guide.category)}</span><span>PDF ${guide.sourcePages.join(", ")}p</span></div>
      <h3>${AdPlay.esc(guide.title)}</h3>
      <p>${AdPlay.esc(guide.summary)}</p>
      <a class="button secondary" href="guide-detail.html?slug=${encodeURIComponent(guide.slug)}">읽기</a>
    </article>`;
}
