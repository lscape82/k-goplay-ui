document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-map");
  if (!root) return;

  const [media, locations] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/media_locations.json"),
  ]);

  const categoryBar = document.querySelector("#mapCategoryBar");
  const stage = document.querySelector("#mapStage");
  const listView = document.querySelector("#mapListView");
  const detailRoot = document.querySelector("#mapDetailView");
  const listRoot = document.querySelector("#mapMediaList");
  const countRoot = document.querySelector("#mapResultCount");
  const summaryRoot = document.querySelector("#mapResultSummary");
  const searchForm = document.querySelector(".map-global-search");
  const searchInput = document.querySelector("#mapGlobalSearch");
  const curationToggle = document.querySelector("#mapCurationToggle");
  const curationPanel = document.querySelector("#mapCurationPanel");
  const curationClose = document.querySelector("#mapCurationClose");
  const curationList = document.querySelector("#mapCurationList");
  const curationImage = document.querySelector("#mapCurationImage");
  const curationCaption = document.querySelector("#mapCurationCaption");
  const curationMeta = document.querySelector("#mapCurationMeta");
  const curationTitle = document.querySelector("#mapCurationTitle");
  const curationDesc = document.querySelector("#mapCurationDesc");
  const curationLive = document.querySelector("#mapCurationLive");
  const curationDownload = document.querySelector("#mapCurationDownload");
  const curationMapView = document.querySelector("#mapCurationMapView");
  const zoomControls = document.querySelector(".map-zoom-controls");
  const costFilterToggle = document.querySelector("#mapCostFilterToggle");
  const costFilterPanel = document.querySelector("#mapCostFilterPanel");
  const costFilterClose = document.querySelector("#mapCostFilterClose");
  const costFilterApply = document.querySelector("#mapCostFilterApply");
  const regionToggle = document.querySelector("#mapRegionToggle");
  const regionPanel = document.querySelector("#mapRegionPanel");
  const regionClose = document.querySelector("#mapRegionClose");
  const budgetActive = document.querySelector("#mapBudgetActive");
  const periodActive = document.querySelector("#mapPeriodActive");

  const categoryTabs = [
    { value: "all", label: "옥외광고 전체", summaryLabel: "전체 옥외광고" },
    { value: "large_billboard", label: "전광판·빌보드 광고", categories: ["large_billboard", "package"] },
    { value: "subway", label: "지하철 광고", categories: ["subway"] },
    { value: "transport_hub", label: "공항·터미널·기차 광고", categories: ["transport_hub"] },
    { value: "bus", label: "버스 정류장 광고", categories: ["bus"] },
    { value: "mobility", label: "이동매체 광고", categories: ["transport_hub", "bus"] },
    { value: "shopping_mall_did", label: "쇼핑·문화시설 광고", categories: ["shopping_mall_did"] },
    { value: "daily_touchpoint", label: "엘리베이터 광고", categories: ["daily_touchpoint"] },
    { value: "other", label: "생활권 광고", categories: ["daily_touchpoint", "shopping_mall_did"] },
  ];

  const curationItems = [
    {
      id: "landmark",
      mediaSlug: "sinsa-h-station",
      title: "압도적 스케일 대형 전광판",
      label: "랜드마크 전광판",
      meta: "도시의 시선이 머무는 곳",
      desc: "강남·도심 핵심 상권에서 브랜드 런칭과 대형 캠페인을 빠르게 각인시키는 대표 매체 조합입니다.",
      image: "assets/images/map-samples/gangnam-wide.jpg",
      tag: "매체 종류",
    },
    {
      id: "genz",
      mediaSlug: "samseong-kpop-square-package",
      title: "2030 MZ 대학가·핫플 미디어",
      label: "MZ 타깃 집행 사례",
      meta: "콘텐츠 반응과 방문 동선 중심",
      desc: "쇼핑, 공연, 팝업, K-콘텐츠 동선이 겹치는 지역을 묶어 젊은 방문객에게 반복 노출합니다.",
      image: "assets/images/map-samples/cheonggye-close.jpg",
      tag: "집행 사례",
    },
    {
      id: "daily",
      mediaSlug: "daily-apartment-elevator-tv",
      title: "생활 속 엘리베이터·편의점 보드",
      label: "생활권 반복 노출",
      meta: "아파트·오피스·편의점 접점",
      desc: "짧은 접촉을 자주 만드는 생활권 매체로 프로모션, 지역 타깃, 앱 설치 캠페인에 적합합니다.",
      image: "assets/images/map-samples/gwanghwamun-wide.jpg",
      tag: "매체 종류",
    },
    {
      id: "mobility",
      mediaSlug: "transport-seoul-station-ktx-panorama",
      title: "최신 스마트 교통 미디어",
      label: "이동형·교통 매체",
      meta: "출퇴근과 이동 동선 커버",
      desc: "역사, 터미널, 정류장 등 이동 전후 접점에서 반복적으로 메시지를 노출합니다.",
      image: "assets/images/map-samples/gwanghwamun-close.jpg",
      tag: "매체 종류",
    },
    {
      id: "indoor",
      mediaSlug: "samseong-kpop-square-package",
      title: "쇼핑몰·광장·영화관 Indoor",
      label: "체류형 실내 매체",
      meta: "구매 고려가 일어나는 공간",
      desc: "쇼핑몰, 영화관, 광장처럼 체류 시간이 긴 공간에서 브랜드 선호와 구매 전환을 보조합니다.",
      image: "assets/images/map-samples/cheonggye-wide.jpg",
      tag: "매체 종류",
    },
    {
      id: "hot",
      mediaSlug: "sinsa-syh-tower",
      title: "핫플·타임싱크 패키지",
      label: "시즌 집중 패키지",
      meta: "이벤트 일정에 맞춘 단기 집행",
      desc: "1개월 미만 집행이 가능한 매체를 중심으로 행사 기간에 맞춰 빠르게 노출합니다.",
      image: "assets/images/map-samples/gangnam-close.jpg",
      tag: "집행 사례",
    },
  ];

  const regionTargets = {
    nationwide: { latitude: 36.45, longitude: 127.9, zoom: 7 },
    capital: { latitude: 37.55, longitude: 126.98, zoom: 10 },
    seoul: { latitude: 37.5665, longitude: 126.978, zoom: 11 },
    gangbuk: { latitude: 37.6396, longitude: 127.0257, zoom: 12 },
    gangnam: { latitude: 37.4979, longitude: 127.0276, zoom: 12 },
    gangdong: { latitude: 37.5301, longitude: 127.1238, zoom: 12 },
    gangseo: { latitude: 37.5509, longitude: 126.8495, zoom: 12 },
    sejong: { latitude: 36.4801, longitude: 127.289, zoom: 12 },
    daejeon: { latitude: 36.3504, longitude: 127.3845, zoom: 12 },
    gwangju: { latitude: 35.1595, longitude: 126.8526, zoom: 12 },
    daegu: { latitude: 35.8714, longitude: 128.6014, zoom: 12 },
    busan: { latitude: 35.1796, longitude: 129.0756, zoom: 12 },
    ulsan: { latitude: 35.5384, longitude: 129.3114, zoom: 12 },
    changwon: { latitude: 35.2279, longitude: 128.6811, zoom: 12 },
    jeju: { latitude: 33.4996, longitude: 126.5312, zoom: 11 },
  };

  let activeCategory = new URLSearchParams(window.location.search).get("category") || "all";
  let selectedMediaSlug = new URLSearchParams(window.location.search).get("media") || "";
  let detailOpen = Boolean(selectedMediaSlug);
  let activeBudget = "all";
  let pendingBudget = "all";
  let activePeriod = "all";
  let pendingPeriod = "all";
  let naverMap = null;
  let naverMarkers = [];
  let currentItems = [];

  const mediaWithLocations = media.map((item) => ({
    ...item,
    mapLocation: locations[item.slug] || null,
  })).filter(hasLatLng);

  renderCategoryTabs();
  renderCuration();
  render();

  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      selectedMediaSlug = "";
      detailOpen = false;
      render();
    });
  }
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      selectedMediaSlug = "";
      detailOpen = false;
      render();
    });
  }
  if (curationClose && curationPanel) {
    curationClose.addEventListener("click", () => {
      curationPanel.hidden = true;
      if (curationToggle) curationToggle.setAttribute("aria-expanded", "false");
    });
  }
  if (curationToggle && curationPanel) {
    curationToggle.addEventListener("click", () => {
      const willOpen = curationPanel.hidden;
      curationPanel.hidden = !willOpen;
      curationToggle.setAttribute("aria-expanded", String(willOpen));
    });
  }
  if (costFilterToggle && costFilterPanel) {
    costFilterToggle.addEventListener("click", () => {
      const willOpen = costFilterPanel.hidden;
      costFilterPanel.hidden = !willOpen;
      costFilterToggle.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) closeRegionPanel();
      syncCostFilterButtons();
    });
  }
  if (costFilterClose && costFilterPanel) {
    costFilterClose.addEventListener("click", () => {
      costFilterPanel.hidden = true;
      if (costFilterToggle) costFilterToggle.setAttribute("aria-expanded", "false");
    });
  }
  if (costFilterPanel) {
    costFilterPanel.querySelectorAll("[data-budget-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        pendingBudget = button.dataset.budgetFilter || "all";
        syncCostFilterButtons();
      });
    });
    costFilterPanel.querySelectorAll("[data-period-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        pendingPeriod = button.dataset.periodFilter || "all";
        syncCostFilterButtons();
      });
    });
  }
  if (costFilterApply) {
    costFilterApply.addEventListener("click", () => {
      activeBudget = pendingBudget;
      activePeriod = pendingPeriod;
      selectedMediaSlug = "";
      detailOpen = false;
      if (costFilterPanel) costFilterPanel.hidden = true;
      if (costFilterToggle) costFilterToggle.setAttribute("aria-expanded", "false");
      render();
    });
  }
  if (regionToggle && regionPanel) {
    regionToggle.addEventListener("click", () => {
      const willOpen = regionPanel.hidden;
      regionPanel.hidden = !willOpen;
      regionToggle.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) closeCostPanel();
    });
  }
  if (regionClose) {
    regionClose.addEventListener("click", closeRegionPanel);
  }
  if (regionPanel) {
    regionPanel.querySelectorAll("[data-region-target]").forEach((button) => {
      button.addEventListener("click", () => {
        moveToRegion(button.dataset.regionTarget);
        closeRegionPanel();
      });
    });
  }
  if (curationMapView) {
    curationMapView.addEventListener("click", () => {
      const slug = curationMapView.dataset.mediaSlug;
      if (slug) {
        if (curationPanel) curationPanel.hidden = true;
        if (curationToggle) curationToggle.setAttribute("aria-expanded", "false");
        openDetail(slug, true, true);
      }
    });
  }
  if (zoomControls) {
    const [zoomIn, zoomOut, locate] = zoomControls.querySelectorAll("button");
    if (zoomIn) zoomIn.addEventListener("click", () => naverMap && naverMap.setZoom(naverMap.getZoom() + 1));
    if (zoomOut) zoomOut.addEventListener("click", () => naverMap && naverMap.setZoom(naverMap.getZoom() - 1));
    if (locate) {
      locate.addEventListener("click", () => {
        const item = selectedItem(currentItems);
        if (item && naverMap && window.naver && window.naver.maps) {
          naverMap.panTo(new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude));
        }
      });
    }
  }
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !detailOpen) return;
    detailOpen = false;
    syncPanelMode();
    focusSelectedCard();
  });

  function renderCategoryTabs() {
    const available = new Set(mediaWithLocations.map((item) => item.category));
    categoryBar.innerHTML = categoryTabs
      .filter((tab) => tab.value === "all" || (tab.categories || [tab.value]).some((category) => available.has(category)))
      .map(({ value, label }) => `
        <button type="button" class="map-category-pill${activeCategory === value ? " is-active" : ""}" data-map-category="${AdPlay.esc(value)}" aria-pressed="${activeCategory === value ? "true" : "false"}">
          ${AdPlay.esc(label)}
        </button>
      `).join("");

    categoryBar.querySelectorAll("[data-map-category]").forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.mapCategory;
        selectedMediaSlug = "";
        detailOpen = false;
        render();
      });
    });
  }

  function renderCuration(activeId = "landmark") {
    if (!curationList) return;
    curationList.innerHTML = curationItems.map((item) => `
      <button type="button" class="${item.id === activeId ? "is-active" : ""}" data-curation-id="${AdPlay.esc(item.id)}">
        <strong>${AdPlay.esc(item.title)}</strong>
      </button>
    `).join("");

    curationList.querySelectorAll("[data-curation-id]").forEach((button) => {
      button.addEventListener("click", () => updateCuration(button.dataset.curationId || "landmark"));
    });
    updateCuration(activeId, false);
  }

  function updateCuration(id, updateActive = true) {
    const item = curationItems.find((entry) => entry.id === id) || curationItems[0];
    if (!item) return;
    if (updateActive && curationList) {
      curationList.querySelectorAll("[data-curation-id]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.curationId === item.id);
      });
    }
    if (curationImage && curationImage.tagName === "IMG") curationImage.src = item.image;
    if (curationCaption) curationCaption.textContent = item.title;
    if (curationMeta) curationMeta.textContent = item.meta;
    if (curationTitle) curationTitle.textContent = item.label;
    if (curationDesc) curationDesc.textContent = item.desc;
    if (curationLive) curationLive.href = `estimate.html?intent=live-talk&media=${encodeURIComponent(item.mediaSlug)}`;
    if (curationDownload) curationDownload.href = "assets/downloads/goplay-media-introduction.html";
    if (curationMapView) curationMapView.dataset.mediaSlug = item.mediaSlug;
  }

  function render(options = {}) {
    const query = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    const activeTab = categoryTabs.find((tab) => tab.value === activeCategory) || categoryTabs[0];
    const activeCategories = activeTab.categories || [activeTab.value];
    const filtered = mediaWithLocations
      .filter((item) => activeCategory === "all" || activeCategories.includes(item.category))
      .filter(matchesCostPeriod);
    const searched = filtered.filter((item) => {
      if (!query) return true;
      const location = item.mapLocation || {};
      const haystack = [
        item.name,
        item.areaName,
        item.mediaType,
        item.address,
        location.sourceName,
        location.sourceAddress,
        ...(item.tags || []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
    currentItems = searched;

    if (selectedMediaSlug && !searched.some((item) => item.slug === selectedMediaSlug)) {
      selectedMediaSlug = "";
      detailOpen = false;
    }
    if (!selectedMediaSlug && searched.length) selectedMediaSlug = searched[0].slug;

    const countText = `${searched.length.toLocaleString("ko-KR")}개`;
    countRoot.textContent = countText;
    if (summaryRoot) {
      const category = categoryTabs.find((tab) => tab.value === activeCategory) || categoryTabs[0];
      const categoryLabel = category.summaryLabel || category.label;
      const queryText = query ? `, "${query}" 검색 결과` : "";
      const filterText = costPeriodSummary();
      summaryRoot.innerHTML = `<span class="sr-only">지도 표시 지역에 <strong id="mapResultCount">${countText}</strong>의 ${AdPlay.esc(categoryLabel)} 매체가 있습니다${AdPlay.esc(queryText)}.${filterText ? ` ${AdPlay.esc(filterText)}.` : ""}</span>`;
    }
    updateCostFilterLabels();
    renderCategoryTabs();
    renderStage(searched, options.preserveView);
    renderList(searched);
    renderDetail(selectedItem(searched));
    syncPanelMode();
  }

  function renderStage(items, preserveView = false) {
    if (!window.naver || !window.naver.maps) {
      stage.innerHTML = `
        <div class="map-load-error">
          <strong>네이버 지도를 불러오지 못했습니다.</strong>
          <span>네이버 클라우드 앱의 Web 서비스 URL에 현재 도메인이 등록되어 있는지 확인해 주세요.</span>
        </div>
      `;
      return;
    }

    try {
      stage.classList.add("has-naver-map");
      if (!naverMap) {
        stage.innerHTML = "";
        naverMap = new naver.maps.Map(stage, {
          center: new naver.maps.LatLng(37.5172, 127.0473),
          zoom: 12,
          minZoom: 8,
          mapTypeControl: false,
          zoomControl: false,
        });
      }

      naverMarkers.forEach((marker) => marker.setMap(null));
      naverMarkers = [];
      if (!items.length) return;

      const bounds = new naver.maps.LatLngBounds();
      items.forEach((item) => {
        const latlng = new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude);
        bounds.extend(latlng);
        const marker = new naver.maps.Marker({
          map: naverMap,
          position: latlng,
          title: item.name,
          icon: {
            content: markerContent(item),
            size: new naver.maps.Size(54, 62),
            anchor: new naver.maps.Point(27, 54),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => openDetail(item.slug, true, true));
        naverMarkers.push(marker);
      });

      if (!preserveView) {
        if (items.length === 1) {
          const item = items[0];
          naverMap.setCenter(new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude));
          naverMap.setZoom(15);
        } else {
          naverMap.fitBounds(bounds, { top: 76, right: 76, bottom: 76, left: 76 });
        }
      }
    } catch (error) {
      console.error("Naver map failed to initialize.", error);
    }
  }

  function markerContent(item) {
    const isActive = selectedMediaSlug === item.slug;
    const image = cardImages(item)[0];
    return `
      <button type="button" class="media-map-pin${isActive ? " is-active" : ""}" aria-label="${AdPlay.esc(item.name)}">
        <span class="media-map-pin-image"><img src="${AdPlay.esc(image)}" alt="" onerror="this.src='${AdPlay.esc(AdPlay.pageImage(item))}'"></span>
      </button>`;
  }

  function renderList(items) {
    listRoot.innerHTML = items.length
      ? items.map(listCard).join("")
      : `<div class="empty">조건에 맞는 매체가 없습니다.</div>`;

    listRoot.querySelectorAll("[data-map-media]").forEach((button) => {
      button.addEventListener("click", () => openDetail(button.dataset.mapMedia, true, true));
    });
  }

  function listCard(item, index) {
    const location = item.mapLocation;
    const images = cardImages(item, index);
    const isActive = selectedMediaSlug === item.slug;
    return `
      <article class="map-list-card${isActive ? " is-active" : ""}">
        <button type="button" data-map-media="${AdPlay.esc(item.slug)}" aria-label="${AdPlay.esc(item.name)} 상세 보기" aria-current="${isActive ? "true" : "false"}"></button>
        <div class="map-card-photo-pair">
          <figure>
            <img src="${AdPlay.esc(images[0])}" alt="${AdPlay.esc(item.name)} 현장 이미지 1" loading="lazy" onerror="this.src='${AdPlay.esc(AdPlay.pageImage(item))}'">
          </figure>
          <figure>
            <img src="${AdPlay.esc(images[1])}" alt="${AdPlay.esc(item.name)} 현장 이미지 2" loading="lazy" onerror="this.src='${AdPlay.esc(images[0])}'">
          </figure>
        </div>
        <div class="map-list-card-body">
          <div class="map-list-title-row">
            <h2>${AdPlay.esc(item.name)}</h2>
            <strong>${AdPlay.esc(mapCardPriceLabel(item))}</strong>
          </div>
          <p>${AdPlay.esc(compactAddress(item))}</p>
          <div class="map-list-tags">
            ${[item.areaName, AdPlay.categoryLabels[item.category] || item.mediaType, sizeLabel(item)].filter(Boolean).slice(0, 4).map((tag) => `<span>${AdPlay.esc(tag)}</span>`).join("")}
          </div>
          <div class="map-card-footer">
            <span>상세보기</span>
          </div>
        </div>
      </article>`;
  }

  function renderDetail(item) {
    if (!item) {
      detailRoot.innerHTML = "";
      return;
    }
    const location = item.mapLocation;
    const image = cardImages(item)[0];
    const galleryImages = detailGalleryImages(item);
    const insight = locationInsight(item);
    const roadviewUrl = `https://map.naver.com/v5/search/${encodeURIComponent(location.sourceAddress || item.address)}`;
    detailRoot.innerHTML = `
      <button type="button" class="map-detail-close" id="mapDetailClose" aria-label="목록으로 돌아가기">×</button>
      <section class="map-detail-media-hero" aria-label="현장 사진과 영상">
        <figure class="map-detail-video-preview">
          <img src="${AdPlay.esc(galleryImages[1] || image)}" alt="${AdPlay.esc(item.name)} 광고 현장 영상 미리보기">
        </figure>
        <div class="map-detail-media-grid">
          ${galleryImages.slice(0, 4).map((src, index) => `
            <figure>
              <img src="${AdPlay.esc(src)}" alt="${AdPlay.esc(item.name)} 현장 사진 ${index + 1}" loading="${index === 0 ? "eager" : "lazy"}">
              ${index === 3 ? `<span>사진 더보기(${Math.max(galleryImages.length, 4)})</span>` : ""}
            </figure>
          `).join("")}
        </div>
      </section>
      <div class="map-detail-body">
        <div class="map-detail-title-row">
          <h2>${AdPlay.esc(item.name)}</h2>
          <span>♡</span>
        </div>
        <p class="map-detail-address">${AdPlay.esc(compactAddress(item))}</p>
        <div class="map-list-tags">
          ${[item.mediaType, item.areaName, location.isComposite ? "복합 매체" : "", item.category === "package" ? "패키지" : ""].filter(Boolean).map((tag) => `<span>${AdPlay.esc(tag)}</span>`).join("")}
        </div>
        <div class="map-detail-actions">
          <a href="media-detail.html?slug=${encodeURIComponent(item.slug)}"><strong>매체 소개서</strong><span>Brochure</span></a>
          <a href="#detailTraffic"><strong>데이터 리포트</strong><span>Data Report</span></a>
          <a href="${roadviewUrl}" target="_blank" rel="noopener"><strong>거리뷰 보기</strong><span>Street View</span></a>
        </div>
        <a class="map-detail-consult" href="#detailConsult">온라인 상담</a>
        <section class="map-detail-section map-detail-section-top" id="detailSpecs">
          <h3>상세 제원</h3>
          <dl class="map-detail-specs">
            ${detailFact("크기", location.size || sizeLabel(item))}
            ${detailFact("해상도", location.resolution || item.resolutionPx || "확인 필요")}
            ${detailFact("유형", AdPlay.categoryLabels[item.category] || item.mediaType)}
            ${detailFact("운영시간", location.operationHours || item.operationHours)}
            ${detailFact("집행조건", contractSummary(item))}
          </dl>
        </section>
        <section class="map-detail-section map-detail-selling">
          <h3>매체 노출 포인트</h3>
          <p class="map-detail-copy">${AdPlay.esc(mediaSellingPoint(item))}</p>
        </section>
        <a class="map-detail-live-card" href="estimate.html?intent=live-talk&media=${encodeURIComponent(item.slug)}">
          <strong>실시간 라이브 상담</strong>
          <span>할인, 패키지, 예산 맞춤 집행은 1533-1975 또는 라이브 상담 신청하세요.</span>
        </a>
        <nav class="map-detail-tabs" aria-label="상세 정보 바로가기">
          <a href="#detailSpecs">상세제원</a>
          <a href="#detailTraffic">유동인구</a>
          <a href="#detailGallery">갤러리</a>
          <a href="#detailRoadview">로드뷰</a>
          <a href="#detailLocation">지역특징</a>
          <a href="#detailConsult">상담</a>
        </nav>
        <section class="map-detail-section" id="detailTraffic">
          <h3>유동인구와 타깃</h3>
          <p class="map-detail-copy">${AdPlay.esc(insight.traffic)}</p>
          ${trafficVisualization(insight)}
        </section>
        <section class="map-detail-section" id="detailGallery">
          <h3>갤러리</h3>
          <div class="map-detail-gallery">
            ${galleryImages.map((src, index) => `<img src="${AdPlay.esc(src)}" alt="${AdPlay.esc(item.name)} 현장사진 ${index + 1}" loading="lazy">`).join("")}
          </div>
          <button type="button" class="map-detail-more">사진 더보기</button>
        </section>
        <section class="map-detail-section" id="detailRoadview">
          <h3>로드뷰</h3>
          <a class="map-detail-roadview" href="${roadviewUrl}" target="_blank" rel="noopener">
            <img src="${AdPlay.esc(galleryImages[0] || image)}" alt="${AdPlay.esc(item.name)} 거리뷰 미리보기">
            <span>거리뷰 보기</span>
          </a>
        </section>
        <section class="map-detail-section" id="detailLocation">
          <h3>입지 특성</h3>
          <p class="map-detail-copy">${AdPlay.esc(insight.location)}</p>
          <div class="map-insight-score">
            ${insight.scores.map((score) => `<div><span>${AdPlay.esc(score.label)}</span><i style="--score:${score.value}"></i><strong>${score.value}</strong></div>`).join("")}
          </div>
        </section>
        <section class="map-detail-section">
          <h3>주요시설 및 행사</h3>
          <dl class="map-detail-table">
            ${insight.facilities.map((row) => `<dt>${AdPlay.esc(row.label)}</dt><dd>${AdPlay.esc(row.value)}</dd>`).join("")}
          </dl>
        </section>
        <section class="map-detail-section" id="detailConsult">
          <details class="map-consult-accordion">
            <summary>온라인 상담</summary>
          <form class="map-consult-form" action="estimate.html" method="get">
            <input type="hidden" name="media" value="${AdPlay.esc(item.slug)}">
            <p class="map-consult-required">* 필수 정보를 입력해 주세요</p>
            <label>
              <span>이름*</span>
              <input name="name" type="text" placeholder="이름을 입력해 주세요" required>
            </label>
            <label>
              <span>대표전화*</span>
              <input name="phone" type="tel" placeholder="연락처를 입력해 주세요" required>
            </label>
            <label>
              <span>소속(기업명)</span>
              <input name="company" type="text" placeholder="개인/기업명을 입력해 주세요">
            </label>
            <label>
              <span>이메일</span>
              <input name="email" type="email" placeholder="이메일 형식으로 입력해 주세요">
            </label>
            <label>
              <span>제목</span>
              <input name="subject" type="text" value="${AdPlay.esc(item.name)} - 상담 문의 드립니다">
            </label>
            <label>
              <span>상세내용</span>
              <textarea name="message" rows="7" placeholder="광고 목적, 타깃, 선호 지역, 매체수량 및 예산을 입력해 주세요"></textarea>
            </label>
            <div class="map-consult-grid">
              <label>
                <span>기간선택</span>
                <select name="period">
                  <option value="">기간선택</option>
                  <option>1일</option>
                  <option>3일</option>
                  <option>7일</option>
                  <option>15일</option>
                  <option>1개월 이상</option>
                </select>
              </label>
              <label>
                <span>시작일</span>
                <input name="startDate" type="date">
              </label>
            </div>
            <label>
              <span>광고비용</span>
              <textarea name="budget" rows="3" placeholder="계획하신 예산을 입력해 주세요"></textarea>
            </label>
            <label>
              <span>기타 문의</span>
              <textarea name="extra" rows="3" placeholder="영상 제작, 광고기간, 구좌수 조정 등 기타 문의 사항을 입력해 주세요"></textarea>
            </label>
            <label class="map-consult-agree">
              <input name="privacy" type="checkbox" required>
              <span>개인정보 수집 및 이용에 동의합니다.</span>
            </label>
            <button type="submit">작성완료</button>
          </form>
          </details>
        </section>
      </div>`;

    document.querySelector("#mapDetailClose").addEventListener("click", () => {
      detailOpen = false;
      syncPanelMode();
      focusSelectedCard();
    });
    const onlineConsult = detailRoot.querySelector('.map-detail-consult[href="#detailConsult"]');
    if (onlineConsult) onlineConsult.addEventListener("click", (event) => {
      event.preventDefault();
      const formSection = detailRoot.querySelector("#detailConsult");
      if (!formSection) return;
      const details = formSection.querySelector("details");
      if (details) details.open = true;
      formSection.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = formSection.querySelector("input[name='name']");
      if (firstInput) firstInput.focus({ preventScroll: true });
    });
  }

  function mediaSellingPoint(item) {
    const text = [item.name, item.areaName, item.areaSlug, item.address].filter(Boolean).join(" ");
    if (/광화문|종로|시청|청계|gwanghwamun|jongno|jung/i.test(text)) {
      return "광장과 횡단보도 대기 동선에서 정면 시야가 형성되고, 주변 공공기관·언론사·문화시설 방문객에게 반복 노출되는 도심 랜드마크형 매체입니다.";
    }
    if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) {
      return "코엑스·무역센터·백화점 방문 동선과 차량 흐름을 동시에 커버해 전시, 팝업, 프리미엄 브랜드 캠페인의 인지 확산에 유리합니다.";
    }
    if (/서울역|KTX|seoul-station|transport/i.test(text)) {
      return "철도·지하철·버스 환승객이 매체 전면을 지나며 확인하는 교통 허브형 매체로, 단기 고빈도 고지와 광역 캠페인에 적합합니다.";
    }
    return "횡단보도 대기 지점과 차량 정체 구간에서 시야가 오래 머무는 대형 전광판으로, 도산대로·강남 상권의 뷰티·패션·F&B 브랜드 노출에 강점이 있습니다.";
  }

  function openDetail(slug, panToMarker, moveFocus = false) {
    const item = currentItems.find((entry) => entry.slug === slug);
    if (!item) return;
    selectedMediaSlug = slug;
    detailOpen = true;
    render({ preserveView: true });
    if (moveFocus) {
      detailRoot.focus({ preventScroll: true });
    }
    if (panToMarker && naverMap && window.naver && window.naver.maps) {
      naverMap.panTo(new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude));
    }
  }

  function syncPanelMode() {
    listView.hidden = detailOpen;
    detailRoot.hidden = !detailOpen;
  }

  function focusSelectedCard() {
    const button = listRoot.querySelector(`[data-map-media="${CSS.escape(selectedMediaSlug)}"]`);
    if (button) button.focus({ preventScroll: true });
  }

  function selectedItem(items) {
    return items.find((item) => item.slug === selectedMediaSlug) || items[0] || null;
  }

  function hasLatLng(item) {
    return item.mapLocation && Number.isFinite(Number(item.mapLocation.latitude)) && Number.isFinite(Number(item.mapLocation.longitude));
  }

  function cardDescription(item) {
    const description = item.mapLocation && item.mapLocation.description;
    if (description && description.replace(/[.\s]/g, "").length > 0) {
      return description.length > 84 ? `${description.slice(0, 84)}...` : description;
    }
    return item.locationDescription || item.address || "현장 설명 확인 필요";
  }

  function compactAddress(item) {
    const location = item.mapLocation || {};
    const candidates = [item.address, location.sourceAddress].filter(Boolean);
    const roadAddress = (candidates.find((address) => /[가-힣0-9](대로|로|길)(\s|[0-9])/u.test(address)) || candidates[0] || "").replace(/\s{2,}/g, " ").trim();
    const dongMatch = candidates.join(" ").match(/([가-힣0-9]+동)/);
    const dong = dongMatch && dongMatch[1] ? dongMatch[1] : "";
    if (!roadAddress) return location.sourceAddress || "주소 확인 필요";
    if (!dong || roadAddress.includes(`(${dong})`)) return roadAddress;
    return `${roadAddress} (${dong})`;
  }

  function sizeLabel(item) {
    if (item.widthM && item.heightM) return `${item.widthM}m x ${item.heightM}m`;
    return item.resolutionPx || "";
  }

  function shortName(name) {
    return String(name || "").replace(/전광판|패키지|상세/g, "").trim().slice(0, 16);
  }

  function detailFact(label, value) {
    return `<dt>${AdPlay.esc(label)}</dt><dd>${AdPlay.esc(value || "확인 필요")}</dd>`;
  }

  function mapCardPriceLabel(item) {
    const min = AdPlay.minMonthlyPrice(item);
    return min ? `월 ${AdPlay.formatKRW(min)}` : "월 비용 상담 필요";
  }

  function contractSummary(item) {
    const min = AdPlay.minMonthlyPrice(item);
    const monthly = min ? `월 ${AdPlay.formatKRW(min)}` : "월 비용 상담 필요";
    return `${monthly} · 1개월 미만 집행 협의 가능`;
  }

  function matchesCostPeriod(item) {
    const days = activePeriod === "all" ? 30 : Number(activePeriod);
    if (Number.isFinite(days) && days < 30 && !item.shortTermAvailable) return false;
    const estimated = estimatedCampaignCost(item, days);
    if (activeBudget === "all") return true;
    if (!Number.isFinite(estimated)) return false;
    const manwon = estimated / 10000;
    if (activeBudget === "under100") return manwon < 100;
    if (activeBudget === "100-300") return manwon >= 100 && manwon < 300;
    if (activeBudget === "300-500") return manwon >= 300 && manwon < 500;
    if (activeBudget === "500-1000") return manwon >= 500 && manwon < 1000;
    if (activeBudget === "1000-1500") return manwon >= 1000 && manwon < 1500;
    if (activeBudget === "1500plus") return manwon >= 1500;
    return true;
  }

  function estimatedCampaignCost(item, days) {
    const monthly = AdPlay.minMonthlyPrice(item);
    if (!Number.isFinite(Number(monthly))) return null;
    if (!Number.isFinite(days) || days >= 30) return Number(monthly);
    return Math.ceil((Number(monthly) / 30) * days);
  }

  function syncCostFilterButtons() {
    if (!costFilterPanel) return;
    costFilterPanel.querySelectorAll("[data-budget-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.budgetFilter === pendingBudget);
    });
    costFilterPanel.querySelectorAll("[data-period-filter]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.periodFilter === pendingPeriod);
    });
    if (budgetActive) budgetActive.textContent = filterLabel("budget", pendingBudget);
    if (periodActive) periodActive.textContent = filterLabel("period", pendingPeriod);
  }

  function updateCostFilterLabels() {
    if (budgetActive) budgetActive.textContent = filterLabel("budget", activeBudget);
    if (periodActive) periodActive.textContent = filterLabel("period", activePeriod);
    if (costFilterToggle) {
      const hasFilter = activeBudget !== "all" || activePeriod !== "all";
      costFilterToggle.classList.toggle("has-filter", hasFilter);
    }
  }

  function closeCostPanel() {
    if (costFilterPanel) costFilterPanel.hidden = true;
    if (costFilterToggle) costFilterToggle.setAttribute("aria-expanded", "false");
  }

  function closeRegionPanel() {
    if (regionPanel) regionPanel.hidden = true;
    if (regionToggle) regionToggle.setAttribute("aria-expanded", "false");
  }

  function moveToRegion(targetKey) {
    const target = regionTargets[targetKey];
    if (!target || !naverMap || !window.naver || !window.naver.maps) return;
    naverMap.setCenter(new naver.maps.LatLng(target.latitude, target.longitude));
    naverMap.setZoom(target.zoom);
  }

  function costPeriodSummary() {
    const parts = [];
    if (activeBudget !== "all") parts.push(filterLabel("budget", activeBudget));
    if (activePeriod !== "all") parts.push(filterLabel("period", activePeriod));
    return parts.length ? `적용 조건: ${parts.join(" · ")}` : "";
  }

  function filterLabel(type, value) {
    const budget = {
      all: "비용 전체",
      under100: "100만원 미만",
      "100-300": "100 - 300만원 미만",
      "300-500": "300 - 500만원 미만",
      "500-1000": "500 - 1,000만원 미만",
      "1000-1500": "1,000 - 1,500만원 미만",
      "1500plus": "1,500만원 이상",
    };
    const period = {
      all: "기간 전체",
      1: "1일",
      3: "3일",
      7: "7일",
      15: "15일",
      30: "1개월 이상",
    };
    return (type === "budget" ? budget : period)[value] || "전체";
  }

  function detailGalleryImages(item) {
    const images = cardImages(item);
    const all = [
      ...images,
      "assets/images/map-samples/gangnam-wide.jpg",
      "assets/images/map-samples/gangnam-close.jpg",
      "assets/images/map-samples/cheonggye-wide.jpg",
      "assets/images/map-samples/cheonggye-close.jpg",
      "assets/images/map-samples/gwanghwamun-wide.jpg",
      "assets/images/map-samples/gwanghwamun-close.jpg",
    ];
    return [...new Set(all)].slice(0, 6);
  }

  function trafficVisualization(insight) {
    const stats = insight.stats || {
      daily500: "7.6만명",
      daily300: "3.1만명",
      subway: "12.4만명",
      bus: "3.8만명",
      traffic: "8.6만대",
      target: "2030·직장인",
    };
    const monthly = [71, 73, 75, 79, 83, 78, 74, 79, 77, 79, 75, 76];
    const monthLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
    const points = monthly.map((value, index) => `${20 + index * 24},${94 - value * 0.58}`).join(" ");
    const dayBars = [
      ["월", 82, "강"],
      ["화", 84, "강"],
      ["수", 86, "강"],
      ["목", 88, "최대"],
      ["금", 87, "강"],
      ["토", 72, "주말"],
      ["일", 62, "완만"],
    ];
    const timeBars = [
      ["05~09", 54, "출근"],
      ["09~12", 70, "오전"],
      ["12~14", 62, "점심"],
      ["14~18", 100, "피크"],
      ["18~23", 86, "저녁"],
      ["23~05", 34, "심야"],
    ];
    return `
      <div class="map-traffic-kpis">
        <article><span>일평균 유동 500m</span><strong>${AdPlay.esc(stats.daily500)}</strong><em>상권 반경 추정</em></article>
        <article><span>일평균 유동 300m</span><strong>${AdPlay.esc(stats.daily300)}</strong><em>매체 근접권</em></article>
        <article><span>핵심 타깃</span><strong>${AdPlay.esc(stats.target)}</strong><em>구매·방문 가능층</em></article>
      </div>
      <div class="map-traffic-kpis is-compact">
        <article><span>지하철 승하차</span><strong>${AdPlay.esc(stats.subway)}</strong><em>주변역 일평균</em></article>
        <article><span>버스 승하차</span><strong>${AdPlay.esc(stats.bus)}</strong><em>주변 정류장</em></article>
        <article><span>도로 교통량</span><strong>${AdPlay.esc(stats.traffic)}</strong><em>주요 간선도로</em></article>
      </div>
      <div class="map-traffic-chart">
        <h4>월별 일평균 유동인구 추이</h4>
        <svg viewBox="0 0 366 150" role="img" aria-label="월별 유동인구 추이 그래프">
          <defs>
            <linearGradient id="trafficLine" x1="0" x2="1">
              <stop offset="0%" stop-color="#0b3a91"></stop>
              <stop offset="100%" stop-color="#4f7df3"></stop>
            </linearGradient>
            <linearGradient id="trafficArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#4f7df3" stop-opacity="0.22"></stop>
              <stop offset="100%" stop-color="#4f7df3" stop-opacity="0"></stop>
            </linearGradient>
          </defs>
          <path d="M20 112H342" class="axis"></path>
          <polygon points="20,112 ${points} 284,112" class="area"></polygon>
          <polyline points="${points}" class="line"></polyline>
          ${monthly.map((value, index) => `<circle cx="${20 + index * 24}" cy="${94 - value * 0.58}" r="3.5"></circle>`).join("")}
          ${monthLabels.map((label, index) => `<text x="${20 + index * 24}" y="136">${AdPlay.esc(label)}</text>`).join("")}
        </svg>
      </div>
      <div class="map-traffic-grid">
        <div class="map-traffic-panel">
          <h4>요일별 일평균</h4>
          ${dayBars.map(([label, value, note]) => `<div><span>${label}</span><i style="--bar:${value}"></i><strong>${note}</strong></div>`).join("")}
        </div>
        <div class="map-traffic-panel">
          <h4>시간대별 유동</h4>
          ${timeBars.map(([label, value, note]) => `<div><span>${label}</span><i style="--bar:${value}"></i><strong>${note}</strong></div>`).join("")}
        </div>
      </div>
      <div class="map-traffic-bars" aria-label="지역 특징 지수">
        ${insight.audience.map((row) => `<div><span>${AdPlay.esc(row.label)}</span><i style="--bar:${row.value}"></i><strong>${AdPlay.esc(row.note)}</strong></div>`).join("")}
      </div>`;
  }

  function locationInsight(item) {
    const text = [item.name, item.areaName, item.areaSlug, item.address, item.mapLocation && item.mapLocation.sourceAddress].filter(Boolean).join(" ");
    if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) {
      return {
        location: "코엑스, 무역센터, 백화점, 호텔, 전시·컨벤션 동선이 겹치는 복합 상권입니다. B2B 방문객과 쇼핑·관광 체류 인구가 함께 발생해 브랜드 인지도와 행사 연계 캠페인에 적합합니다.",
        traffic: "평일에는 업무·전시 방문 수요가 안정적으로 유입되고, 주말에는 쇼핑몰·영화관·행사 방문객 중심으로 체류 시간이 길어지는 특성이 있습니다.",
        stats: { daily500: "8.4만명", daily300: "3.4만명", subway: "13.8만명", bus: "4.1만명", traffic: "9.2만대", target: "2030·B2B 방문객" },
        scores: scoreSet([["기업·오피스", 5], ["대형몰·상업시설", 5], ["지역명소", 4], ["교통접점", 4], ["행사연계", 5]]),
        facilities: facilitySet([["주요 교통", "삼성역, 봉은사역, 테헤란로"], ["지역 명소", "코엑스, 무역센터, 별마당길, K-POP 광장"], ["상업 시설", "백화점, 쇼핑몰, 영화관, 호텔"], ["기업·오피스", "무역센터, 테헤란로 업무시설, 컨벤션 방문 기업"], ["행사", "전시회, 컨퍼런스, 브랜드 팝업, K-콘텐츠 행사"]]),
        audience: audienceSet([["평일 업무·전시", 88, "오피스·컨벤션"], ["주말 쇼핑·관광", 78, "체류형 방문"], ["2030 활동층", 82, "문화·쇼핑"], ["프리미엄 소비층", 74, "백화점·호텔"]]),
      };
    }
    if (/서울역|KTX|seoul-station|transport/i.test(text)) {
      return {
        location: "철도, 지하철, 버스, 택시 동선이 집중되는 광역 교통 허브입니다. 출퇴근·출장·관광객이 반복적으로 교차해 단기간 고빈도 노출과 전국 단위 도달 메시지에 유리합니다.",
        traffic: "평일 출퇴근 피크와 주말 여행 수요가 모두 발생합니다. 이동 목적이 뚜렷한 이용자가 많아 금융, 통신, 여행, 공공 캠페인 고지에 적합합니다.",
        stats: { daily500: "9.1만명", daily300: "3.7만명", subway: "18.6만명", bus: "5.4만명", traffic: "8.8만대", target: "출퇴근·출장객" },
        scores: scoreSet([["교통접점", 5], ["광역도달", 5], ["기업·오피스", 4], ["관광동선", 4], ["상업시설", 3]]),
        facilities: facilitySet([["주요 교통", "서울역, KTX, 공항철도, 지하철 1·4호선"], ["지역 명소", "서울로, 남대문, 도심 관광 동선"], ["상업 시설", "역사 상업시설, 호텔, F&B"], ["기업·오피스", "서울역 인근 업무지구, 도심 기관"], ["행사", "여행 성수기, 공공 캠페인, 광역 프로모션"]]),
        audience: audienceSet([["출퇴근 피크", 86, "반복 노출"], ["출장·관광객", 90, "광역 이동"], ["주말 여행", 76, "목적형 방문"], ["고지 수용도", 80, "이동 전 대기"]]),
      };
    }
    if (/광화문|종로|시청|청계|gwanghwamun|jongno|jung/i.test(text)) {
      return {
        location: "광화문, 청계광장, 시청, 종로 업무지구를 연결하는 서울 도심 랜드마크 입지입니다. 관광·문화·공공행사 동선과 오피스 유동이 함께 발생해 신뢰도 높은 브랜드 노출에 적합합니다.",
        traffic: "평일에는 직장인 출퇴근·점심 유동이 강하고, 주말에는 관광객과 행사 방문객 비중이 커집니다. 축제·문화행사 시 체류 시간이 길어져 반복 노출이 가능합니다.",
        stats: { daily500: "7.9만명", daily300: "3.2만명", subway: "11.7만명", bus: "4.6만명", traffic: "7.4만대", target: "직장인·관광객" },
        scores: scoreSet([["지역명소", 5], ["기업·오피스", 5], ["교통접점", 4], ["관광·행사", 5], ["상업시설", 4]]),
        facilities: facilitySet([["주요 교통", "광화문역, 시청역, 종각역, 세종대로"], ["지역 명소", "청계광장, 광화문광장, 세종문화회관, 덕수궁"], ["상업 시설", "무교동·종로 상권, F&B, 관광특구"], ["기업·오피스", "서울시청, 금융기관, 언론사, 대기업 오피스"], ["행사", "서울페스티벌, 빛초롱축제, 도심 문화행사"]]),
        audience: audienceSet([["평일 직장인", 86, "출퇴근·점심"], ["주말 관광객", 78, "도심 명소"], ["행사 체류", 84, "반복 노출"], ["40대 이상", 72, "구매력 높은 층"]]),
      };
    }
    return {
      location: "강남대로, 도산대로, 신사·청담 상권을 잇는 프리미엄 소비 동선입니다. 업무, 뷰티, 패션, F&B, 야간 활동 수요가 겹쳐 브랜드 런칭과 고관여 소비재 캠페인에 적합합니다.",
      traffic: "평일에는 출퇴근·점심 직장인 유동이 안정적이고, 저녁과 주말에는 쇼핑·약속·외식 목적 방문객이 증가합니다. 2030 활동층과 구매력 높은 직장인층을 함께 공략할 수 있습니다.",
      stats: { daily500: "7.6만명", daily300: "3.1만명", subway: "12.4만명", bus: "3.8만명", traffic: "8.6만대", target: "2030·직장인" },
      scores: scoreSet([["기업·오피스", 5], ["상업시설", 5], ["지역명소", 4], ["교통접점", 4], ["야간활동", 4]]),
      facilities: facilitySet([["주요 교통", "신사역, 강남대로, 도산대로, 주요 버스 동선"], ["지역 명소", "가로수길, 압구정·청담 상권, 프리미엄 뷰티·패션 거리"], ["상업 시설", "병원, 뷰티, F&B, 쇼룸, 브랜드 플래그십"], ["기업·오피스", "강남 업무시설, 스타트업, 전문직 종사자"], ["행사", "브랜드 팝업, 패션·뷰티 런칭, 시즌 프로모션"]]),
      audience: audienceSet([["평일 직장인", 84, "출퇴근·점심"], ["2030 활동층", 88, "쇼핑·약속"], ["프리미엄 소비", 82, "뷰티·패션"], ["야간 유동", 76, "외식·모임"]]),
    };
  }

  function scoreSet(scores) {
    return scores.map(([label, value]) => ({ label, value }));
  }

  function facilitySet(rows) {
    return rows.map(([label, value]) => ({ label, value }));
  }

  function audienceSet(rows) {
    return rows.map(([label, value, note]) => ({ label, value, note }));
  }

  function cardImages(item) {
    const samples = {
      gangnam: ["assets/images/map-samples/gangnam-wide.jpg", "assets/images/map-samples/gangnam-close.jpg"],
      cheonggye: ["assets/images/map-samples/cheonggye-wide.jpg", "assets/images/map-samples/cheonggye-close.jpg"],
      gyeongbokgung: ["assets/images/map-samples/gwanghwamun-wide.jpg", "assets/images/map-samples/gwanghwamun-close.jpg"],
    };
    const order = [samples.gangnam, samples.cheonggye, samples.gyeongbokgung];
    const index = Math.max(0, currentItems.findIndex((entry) => entry.slug === item.slug));
    return order[index % order.length];
  }
});
