document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-list");
  if (!root) return;

  const [media, areas] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/areas.json"),
  ]);

  const areaFilter = document.querySelector("#areaFilter");
  const categoryFilter = document.querySelector("#categoryFilter");
  const categoryFilterWrap = document.querySelector("#categoryFilterWrap");
  const budgetFilter = document.querySelector("#budgetFilter");
  const searchFilter = document.querySelector("#searchFilter");
  const sortBy = document.querySelector("#sortBy");
  const countEl = document.querySelector("#resultCount");
  const tabs = [...document.querySelectorAll(".catalog-tab")];
  const chipsRoot = document.querySelector("#activeChips");
  const tabCountAll = document.querySelector("#tabCountAll");
  const tabCountPackage = document.querySelector("#tabCountPackage");

  // Populate area / category dropdowns (skip package — handled by tab)
  const activeAreas = areas.filter((area) => media.some((item) => item.areaSlug === area.slug));
  activeAreas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.slug;
    option.textContent = area.name;
    areaFilter.appendChild(option);
  });

  Object.entries(AdPlay.categoryLabels).forEach(([value, label]) => {
    if (value === "package" || value === "other") return;
    if (!media.some((item) => item.category === value)) return;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    categoryFilter.appendChild(option);
  });

  // Pre-select from URL
  const params = new URLSearchParams(window.location.search);
  let activeTab = params.get("tab") === "package" ? "package" : "all";
  if (params.get("category") && [...categoryFilter.options].some((o) => o.value === params.get("category"))) {
    categoryFilter.value = params.get("category");
  }
  if (params.get("area") && [...areaFilter.options].some((o) => o.value === params.get("area"))) {
    areaFilter.value = params.get("area");
  }

  function setTab(tab) {
    activeTab = tab;
    tabs.forEach((btn) => {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (categoryFilterWrap) categoryFilterWrap.style.display = tab === "package" ? "none" : "";
    render();
  }
  tabs.forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

  // Tab counts
  const packageCount = media.filter((m) => m.category === "package").length;
  if (tabCountAll) tabCountAll.textContent = ` ${media.length}`;
  if (tabCountPackage) tabCountPackage.textContent = ` ${packageCount}`;

  function matchesBudget(item) {
    const min = AdPlay.minMonthlyPrice(item);
    const selected = budgetFilter.value;
    if (selected === "all") return true;
    if (!min) return selected === "unknown";
    if (selected === "under-10m") return min < 10000000;
    if (selected === "10m-20m") return min >= 10000000 && min <= 20000000;
    if (selected === "20m-50m") return min > 20000000 && min <= 50000000;
    if (selected === "50m-100m") return min > 50000000 && min <= 100000000;
    if (selected === "over-100m") return min > 100000000;
    return true;
  }

  function applySort(items) {
    const v = sortBy.value;
    if (v === "price-asc" || v === "price-desc") {
      const dir = v === "price-asc" ? 1 : -1;
      return [...items].sort((a, b) => {
        const pa = AdPlay.minMonthlyPrice(a) ?? Number.POSITIVE_INFINITY;
        const pb = AdPlay.minMonthlyPrice(b) ?? Number.POSITIVE_INFINITY;
        return (pa - pb) * dir;
      });
    }
    if (v === "area") {
      return [...items].sort((a, b) => (a.areaName || "").localeCompare(b.areaName || "", "ko"));
    }
    return items; // recommended (default order)
  }

  function renderChips(filtered) {
    const chips = [];
    if (areaFilter.value !== "all") {
      const opt = [...areaFilter.options].find((o) => o.value === areaFilter.value);
      chips.push({ label: opt.textContent, clear: () => (areaFilter.value = "all") });
    }
    if (categoryFilter.value !== "all" && activeTab !== "package") {
      const opt = [...categoryFilter.options].find((o) => o.value === categoryFilter.value);
      chips.push({ label: opt.textContent, clear: () => (categoryFilter.value = "all") });
    }
    if (budgetFilter.value !== "all") {
      const opt = [...budgetFilter.options].find((o) => o.value === budgetFilter.value);
      chips.push({ label: opt.textContent, clear: () => (budgetFilter.value = "all") });
    }
    if (searchFilter.value.trim()) chips.push({ label: `"${searchFilter.value.trim()}"`, clear: () => (searchFilter.value = "") });

    if (!chips.length) {
      chipsRoot.innerHTML = "";
      return;
    }
    chipsRoot.innerHTML = chips.map((c, i) => `<button type="button" class="active-chip" data-chip-idx="${i}">${AdPlay.esc(c.label)}<span aria-hidden="true">×</span><span class="sr-only">필터 제거</span></button>`).join("") + `<button type="button" class="active-chip clear-all" data-chip-idx="all">필터 초기화</button>`;
    [...chipsRoot.querySelectorAll("[data-chip-idx]")].forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.chipIdx;
        if (idx === "all") {
          areaFilter.value = "all";
          categoryFilter.value = "all";
          budgetFilter.value = "all";
          searchFilter.value = "";
        } else {
          chips[Number(idx)].clear();
        }
        render();
      });
    });
  }

  function render() {
    const query = searchFilter.value.trim().toLowerCase();
    const tabPool = activeTab === "package"
      ? media.filter((m) => m.category === "package")
      : media;

    const filtered = tabPool.filter((item) => {
      const haystack = [item.name, item.areaName, item.address, ...(item.tags || [])].join(" ").toLowerCase();
      return (
        (areaFilter.value === "all" || item.areaSlug === areaFilter.value) &&
        (activeTab === "package" || categoryFilter.value === "all" || item.category === categoryFilter.value) &&
        matchesBudget(item) &&
        (!query || haystack.includes(query))
      );
    });

    const sorted = applySort(filtered);

    countEl.textContent = `${sorted.length.toLocaleString("ko-KR")}개`;
    root.innerHTML = sorted.length
      ? sorted.map(cardHtml).join("")
      : `<div class="empty">조건에 맞는 매체가 없습니다. 필터를 조정해 주세요.</div>`;
    renderChips(sorted);
  }

  function specChips(item) {
    const chips = [];
    if (item.widthM && item.heightM) {
      chips.push(`<span class="spec-chip"><b>크기</b>${item.widthM}×${item.heightM}m</span>`);
    }
    const row = (item.pricing || [])[0];
    if (row && row.dailyPlays && row.durationSec) {
      chips.push(`<span class="spec-chip"><b>송출</b>일 ${row.dailyPlays}회 · ${row.durationSec}초</span>`);
    } else if (row && row.dailyPlays) {
      chips.push(`<span class="spec-chip"><b>송출</b>일 ${row.dailyPlays}회</span>`);
    }
    if (item.shortTermAvailable) chips.push(`<span class="spec-chip is-mint">단기 가능</span>`);
    return chips.join("");
  }

  function packageMeta(item) {
    const memberCount = Number(item.packageItemCount);
    return memberCount ? `${memberCount}개 매체 묶음` : "패키지 묶음";
  }

  function cardHtml(item) {
    const tagItems = (item.tags || [])
      .slice(0, 3)
      .map((tag) => `<span class="tag">${AdPlay.esc(tag)}</span>`)
      .join("");
    const isPackage = item.category === "package";
    const packageBadge = isPackage ? `<div class="package-badge">📦 패키지 · ${AdPlay.esc(packageMeta(item))}</div>` : "";
    return `
      <article class="card${isPackage ? " card--package" : ""}">
        <a class="media-thumb" href="media-detail.html?slug=${encodeURIComponent(item.slug)}" aria-label="${AdPlay.esc(item.name)} 상세보기">
          ${packageBadge}
          <img class="card-image" src="${AdPlay.esc(AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지" loading="lazy" onerror="this.src='${AdPlay.esc(AdPlay.config.placeholderImage)}'">
        </a>
        <div class="card-body">
          <div class="meta">
            <span>${AdPlay.esc(item.areaName)}</span>
          </div>
          <h3>${AdPlay.esc(item.name)}</h3>
          <p>${AdPlay.esc(item.address || "주소 확인 필요")}</p>
          <div class="spec-chips">${specChips(item)}</div>
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

  [areaFilter, categoryFilter, budgetFilter, searchFilter, sortBy].forEach((control) => {
    if (!control) return;
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

  setTab(activeTab);
});
