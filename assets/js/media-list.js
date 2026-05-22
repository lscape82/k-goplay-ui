document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-list");
  if (!root) return;

  const [media, areas] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/areas.json"),
  ]);

  const areaFilter = document.querySelector("#areaFilter");
  const categoryFilter = document.querySelector("#categoryFilter");
  const budgetFilter = document.querySelector("#budgetFilter");
  const shortTermFilter = document.querySelector("#shortTermFilter");
  const searchFilter = document.querySelector("#searchFilter");
  const countEl = document.querySelector("#resultCount");

  areas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.slug;
    option.textContent = area.name;
    areaFilter.appendChild(option);
  });

  Object.entries(AdPlay.categoryLabels).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    categoryFilter.appendChild(option);
  });

  function matchesBudget(item) {
    const min = AdPlay.minMonthlyPrice(item);
    const selected = budgetFilter.value;
    if (selected === "all") return true;
    if (!min) return selected === "unknown";
    if (selected === "under-10m") return min < 10000000;
    if (selected === "10m-20m") return min >= 10000000 && min <= 20000000;
    if (selected === "20m-50m") return min > 20000000 && min <= 50000000;
    if (selected === "over-50m") return min > 50000000;
    return true;
  }

  function render() {
    const query = searchFilter.value.trim().toLowerCase();
    const filtered = media.filter((item) => {
      const haystack = [item.name, item.areaName, item.address, ...(item.tags || [])].join(" ").toLowerCase();
      return (
        (areaFilter.value === "all" || item.areaSlug === areaFilter.value) &&
        (categoryFilter.value === "all" || item.category === categoryFilter.value) &&
        (!shortTermFilter.checked || item.shortTermAvailable) &&
        matchesBudget(item) &&
        (!query || haystack.includes(query))
      );
    });

    countEl.textContent = `${filtered.length.toLocaleString("ko-KR")}개 매체`;
    root.innerHTML = filtered.length
      ? filtered.map(cardHtml).join("")
      : `<div class="empty">조건에 맞는 매체가 없습니다. 필터를 조정해 주세요.</div>`;
  }

  function cardHtml(item) {
    const pricing = item.pricing && item.pricing[0];
    const tagItems = (item.tags || [])
      .slice(0, 3)
      .map((tag) => `<span class="tag">${AdPlay.esc(tag)}</span>`)
      .join("");
    return `
      <article class="card">
        <a class="media-thumb" href="media-detail.html?slug=${encodeURIComponent(item.slug)}" aria-label="${AdPlay.esc(item.name)} 상세보기">
          <img class="card-image" src="${AdPlay.esc(AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지" loading="lazy" onerror="this.src='assets/images/placeholders/media-placeholder.svg'">
        </a>
        <div class="card-body">
          <div class="meta">
            <span>${AdPlay.esc(item.areaName)}</span>
            ${item.needsReview ? '<span class="badge review">검수 필요</span>' : ""}
          </div>
          <h3>${AdPlay.esc(item.name)}</h3>
          <p>${AdPlay.esc(item.address || "주소 확인 필요")}</p>
          <div class="tag-list">${tagItems}</div>
          <dl class="info-list">
            <dt>대표 가격</dt><dd class="price">${AdPlay.priceLabel(item)}</dd>
          </dl>
          <div class="actions">
            <a class="button" href="media-detail.html?slug=${encodeURIComponent(item.slug)}">상세보기</a>
            <a class="button secondary" href="estimate.html?media=${encodeURIComponent(item.slug)}">견적 문의</a>
          </div>
        </div>
      </article>`;
  }

  [areaFilter, categoryFilter, budgetFilter, shortTermFilter, searchFilter].forEach((control) => {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

  const priceNotice = document.querySelector("#priceNotice");
  if (priceNotice) priceNotice.textContent = AdPlay.priceNotice();
  render();
});
