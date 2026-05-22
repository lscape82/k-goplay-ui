document.addEventListener("DOMContentLoaded", async () => {
  const listRoot = document.querySelector("#guides-list");
  const detailRoot = document.querySelector("#guide-detail");
  if (!listRoot && !detailRoot) return;

  const guides = await AdPlay.loadJson("data/guides.json");
  if (listRoot) renderGuideList(listRoot, guides);
  if (detailRoot) renderGuideDetail(detailRoot, guides);
});

function renderGuideList(root, guides) {
  root.innerHTML = guides.map((guide) => `
    <article class="directory-card guide-card">
      <div class="directory-meta">
        <span>${AdPlay.esc(guide.category)}</span>
      </div>
      <h3>${AdPlay.esc(guide.title)}</h3>
      <p>${AdPlay.esc(guide.summary)}</p>
      <a class="button secondary" href="guide-detail.html?slug=${encodeURIComponent(guide.slug)}">읽기</a>
    </article>`).join("");
}

function renderGuideDetail(root, guides) {
  const slug = AdPlay.getParam("slug");
  const guide = guides.find((entry) => entry.slug === slug) || guides[0];
  if (!guide) {
    root.innerHTML = `<div class="container"><div class="empty">가이드 글을 찾을 수 없습니다.</div></div>`;
    return;
  }
  document.title = `${guide.title} | 광고플레이 DOOH`;
  const related = guides.filter((entry) => entry.slug !== guide.slug).slice(0, 3);

  root.innerHTML = `
    <article class="guide-document">
      <div class="container">
        <nav class="detail-crumb" aria-label="현재 위치">
          <a href="guides.html">가이드</a>
          <span>/</span>
          <span>${AdPlay.esc(guide.category)}</span>
        </nav>

        <header class="document-header compact-document-header">
          <div>
            <p class="document-kicker">${AdPlay.esc(guide.category)}</p>
            <h1>${AdPlay.esc(guide.title)}</h1>
            <p class="document-lede">${AdPlay.esc(guide.summary)}</p>
          </div>
        </header>

        <div class="guide-layout">
          <main class="guide-prose">
            ${guide.body.map((paragraph, index) => `
              <section>
                <span>${String(index + 1).padStart(2, "0")}</span>
                <p>${AdPlay.esc(paragraph)}</p>
              </section>`).join("")}
          </main>
          <aside class="guide-side">
            <div class="summary-card">
              <div class="summary-card-head">
                <span>다음 단계</span>
                <strong>매체 비교와 견적 요청</strong>
              </div>
              <a class="button" href="media.html">매체 찾기</a>
              <a class="button secondary" href="estimate.html">견적 문의</a>
            </div>
          </aside>
        </div>

        <section class="document-section">
          <div class="section-body">
            <div class="related-head">
              <h2>다른 가이드</h2>
              <a href="guides.html">전체 보기</a>
            </div>
            <div class="directory-grid compact">${related.map((item) => `
              <article class="directory-card small">
                <div class="directory-meta"><span>${AdPlay.esc(item.category)}</span></div>
                <h3>${AdPlay.esc(item.title)}</h3>
                <p>${AdPlay.esc(item.summary)}</p>
                <a class="button secondary" href="guide-detail.html?slug=${encodeURIComponent(item.slug)}">읽기</a>
              </article>`).join("")}</div>
          </div>
        </section>
      </div>
    </article>`;
}
