document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-map");
  if (!root) return;

  const [media, locations, areas, busStops, busStopPositionOverrides] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/media_locations.json"),
    AdPlay.loadJson("data/areas.json"),
    AdPlay.loadJson("data/bus_stops.json"),
    AdPlay.loadJson("data/bus_stop_position_overrides.json"),
  ]);
  const areaBySlug = new Map((areas || []).map((area) => [area.slug, area]));

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
  const busStopLegend = document.querySelector("#mapBusStopLegend");
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
  const workspacePage = document.querySelector(".map-workspace-page");
  const mobileListToggle = document.querySelector("#mapMobileListToggle");
  const mobileListToggleLabel = document.querySelector("#mapMobileListToggleLabel");
  const curationMobileToggle = document.querySelector("#mapCurationMobileToggle");
  const mobileLayoutQuery = window.matchMedia("(max-width: 700px)");

  // Representative centres for the regions this platform covers, so a region
  // search (e.g. 광화문) recenters the map even when no media match it.
  // Naver geocoding is address-only and misses most place/station names.
  const PLACE_CENTERS = [
    { keys: ["광화문", "gwanghwamun", "종로", "시청", "세종대로", "광화문역"], lat: 37.5725, lng: 126.9769, zoom: 15 },
    { keys: ["여의도", "yeouido", "여의도역", "국회의사당"], lat: 37.5283, lng: 126.9294, zoom: 15 },
    { keys: ["홍대", "hongdae", "홍대입구", "합정", "상수", "홍익대"], lat: 37.5571, lng: 126.9245, zoom: 15 },
    { keys: ["성수", "seongsu", "성수동", "성수역", "서울숲"], lat: 37.5446, lng: 127.0559, zoom: 15 },
    { keys: ["잠실", "jamsil", "송파", "롯데월드", "잠실역"], lat: 37.5133, lng: 127.1000, zoom: 14 },
    { keys: ["서울역", "seoul-station", "서울역광장", "남영", "회현"], lat: 37.5547, lng: 126.9707, zoom: 15 },
    { keys: ["마포", "공덕", "mapo", "아현", "공덕역", "마포역"], lat: 37.5443, lng: 126.9514, zoom: 14 },
    { keys: ["명동", "을지로", "myeongdong", "euljiro", "명동역", "을지로입구"], lat: 37.5637, lng: 126.9838, zoom: 15 },
    { keys: ["도산대로", "dosan", "압구정", "청담", "신사", "압구정로데오"], lat: 37.5232, lng: 127.0386, zoom: 14 },
    { keys: ["삼성", "코엑스", "samseong", "coex", "무역센터", "삼성역", "선릉"], lat: 37.5089, lng: 127.0631, zoom: 15 },
    { keys: ["강남", "gangnam", "강남역", "강남대로", "역삼", "교대"], lat: 37.4979, lng: 127.0276, zoom: 14 },
  ];

  function lookupPlaceCenter(rawQuery) {
    const q = (rawQuery || "").trim().toLowerCase();
    if (q.length < 2) return null;
    return PLACE_CENTERS.find((place) =>
      place.keys.some((key) => {
        const k = key.toLowerCase();
        return q.includes(k) || k.includes(q);
      })
    ) || null;
  }

  function centerOnGeocode(query) {
    if (!query || !naverMap || !(window.naver && naver.maps.Service && naver.maps.Service.geocode)) return;
    naver.maps.Service.geocode({ query }, (status, response) => {
      if (status !== naver.maps.Service.Status.OK) return;
      const address = response.v2 && response.v2.addresses && response.v2.addresses[0];
      if (!address) return;
      naverMap.setCenter(new naver.maps.LatLng(Number(address.y), Number(address.x)));
      naverMap.setZoom(15);
    });
  }

  const categoryTabs = [
    { value: "all", label: "옥외광고 전체", summaryLabel: "전체 옥외광고" },
    { value: "large_billboard", label: "전광판·빌보드 광고", categories: ["large_billboard", "package"] },
    { value: "subway", label: "지하철 광고", categories: ["subway"] },
    { value: "transport_hub", label: "공항·터미널·기차 광고", categories: ["transport_hub"] },
    { value: "bus", label: "버스 정류장 광고", categories: ["bus"] },
    { value: "mobility", label: "이동매체 광고", categories: ["transport_hub", "bus"] },
    { value: "shopping_mall_did", label: "쇼핑·문화시설 광고", categories: ["shopping_mall_did"] },
    { value: "daily_touchpoint", label: "엘리베이터 광고", categories: ["daily_touchpoint"] },
    { value: "other", label: "기타 옥외 광고", categories: ["daily_touchpoint", "shopping_mall_did"] },
  ];

  const curationItems = [
    {
      id: "landmark",
      mediaSlug: "sinsa-h-station",
      title: "브랜드 랜드마크 전광판",
      label: "랜드마크 전광판",
      meta: "도시의 시선이 머무는 곳",
      desc: "강남·도심 핵심 상권에서 브랜드 런칭과 대형 캠페인을 빠르게 각인시키는 대표 매체 조합입니다.",
      image: "assets/images/map-samples/gangnam-wide.jpg",
      tag: "매체 종류",
    },
    {
      id: "genz",
      mediaSlug: "samseong-kpop-square-package",
      title: "2030 집중 캠퍼스 미디어",
      label: "MZ 타깃 집행 사례",
      meta: "콘텐츠 반응과 방문 동선 중심",
      desc: "쇼핑, 공연, 팝업, K-콘텐츠 동선이 겹치는 지역을 묶어 젊은 방문객에게 반복 노출합니다.",
      image: "assets/images/map-samples/cheonggye-close.jpg",
      tag: "집행 사례",
    },
    {
      id: "daily",
      mediaSlug: "daily-apartment-elevator-tv",
      title: "생활밀착 미디어 보드",
      label: "생활권 반복 노출",
      meta: "아파트·오피스·편의점 접점",
      desc: "짧은 접촉을 자주 만드는 생활권 매체로 프로모션, 지역 타깃, 앱 설치 캠페인에 적합합니다.",
      image: "assets/images/map-samples/gwanghwamun-wide.jpg",
      tag: "매체 종류",
    },
    {
      id: "mobility",
      mediaSlug: "transport-seoul-station-ktx-panorama",
      title: "일상 동선 커버 교통매체",
      label: "이동형·교통 매체",
      meta: "출퇴근과 이동 동선 커버",
      desc: "역사, 터미널, 정류장 등 이동 전후 접점에서 반복적으로 메시지를 노출합니다.",
      image: "assets/images/map-samples/gwanghwamun-close.jpg",
      tag: "매체 종류",
    },
    {
      id: "indoor",
      mediaSlug: "samseong-kpop-square-package",
      title: "체험 자극 쇼핑·문화시설 미디어",
      label: "체류형 실내 매체",
      meta: "구매 고려가 일어나는 공간",
      desc: "쇼핑몰, 영화관, 광장처럼 체류 시간이 긴 공간에서 브랜드 선호와 구매 전환을 보조합니다.",
      image: "assets/images/map-samples/cheonggye-wide.jpg",
      tag: "매체 종류",
    },
    {
      id: "hot",
      mediaSlug: "sinsa-syh-tower",
      title: "초대형·타임싱크 패키지",
      label: "시즌 집중 패키지",
      meta: "이벤트 일정에 맞춘 단기 집행",
      desc: "1개월 미만 집행이 가능한 매체를 중심으로 행사 기간에 맞춰 빠르게 노출합니다.",
      image: "assets/images/map-samples/gangnam-close.jpg",
      tag: "집행 사례",
    },
    {
      id: "wide-coverage",
      mediaSlug: "gangnam-wide-coverage-package",
      title: "비용효율 와이드커버리지",
      label: "다지역 가로형 패키지",
      meta: "10곳·20곳 단위의 넓은 커버",
      desc: "구형 가로형 매체를 여러 거점에 묶어 예산 부담은 낮추고 반복 노출 범위는 넓히는 패키지입니다.",
      image: "assets/images/map-samples/gangnam-wide.jpg",
      tag: "집행 사례",
    },
    {
      id: "truck",
      mediaSlug: "mobile-truck-national-package",
      title: "전국 이동 트럭래핑",
      isNew: true,
      label: "전국 이동형 광고",
      meta: "지역과 시간대에 맞춘 이동 노출",
      desc: "행사장, 상권, 출퇴근 동선 등 원하는 지역과 시간대에 맞춰 전국 단위로 움직이며 노출하는 이동형 광고입니다.",
      image: "assets/images/map-samples/gwanghwamun-close.jpg",
      tag: "매체 종류",
    },
    {
      id: "medical",
      mediaSlug: "medical-clinic-board-package",
      title: "병의원 메디컬 보드",
      isNew: true,
      label: "의료 업종 특화 보드",
      meta: "병의원·약국 생활권 접점",
      desc: "병의원, 약국, 건강관리 동선에 가까운 생활권 접점에서 의료·헬스케어 메시지를 반복 노출하는 보드형 매체입니다.",
      image: "assets/images/map-samples/cheonggye-wide.jpg",
      tag: "매체 종류",
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
  let naverBusMarkers = [];
  let busStopIdleListener = null;
  let currentItems = [];
  let selectedBusStopId = "";
  const BUS_STOP_CLUSTER_MAX_ZOOM = 13;

  function setCurationPanel(isOpen) {
    if (!curationPanel) return;
    curationPanel.hidden = !isOpen;
    if (workspacePage) workspacePage.classList.toggle("is-curation-open", isOpen);
    if (!curationToggle) return;
    curationToggle.setAttribute("aria-expanded", String(isOpen));
    curationToggle.classList.toggle("is-active", isOpen);
  }

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
      const q = (searchInput && searchInput.value ? searchInput.value : "").trim();
      if (q && currentItems.length === 0 && !lookupPlaceCenter(q)) {
        centerOnGeocode(q);
      }
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
      setCurationPanel(false);
    });
  }
  if (curationToggle && curationPanel) {
    curationToggle.addEventListener("click", () => {
      const willOpen = curationPanel.hidden;
      setCurationPanel(willOpen);
      if (willOpen) {
        closeRegionPanel();
        closeCostPanel();
      }
    });
  }

  function setMobileListOpen(open) {
    if (!workspacePage) return;
    workspacePage.classList.toggle("is-list-open", open);
    if (mobileListToggle) mobileListToggle.setAttribute("aria-expanded", String(open));
    if (mobileListToggleLabel) mobileListToggleLabel.textContent = open ? "지도 보기" : "목록 보기";
  }

  if (mobileListToggle) {
    mobileListToggle.addEventListener("click", () => {
      setMobileListOpen(!workspacePage.classList.contains("is-list-open"));
    });
  }

  if (curationMobileToggle) {
    curationMobileToggle.addEventListener("click", () => {
      setMobileListOpen(false);
      setCurationPanel(true);
    });
  }

  // On mobile the curation panel is opt-in via the floating trigger,
  // so it should not cover the map on load.
  if (mobileLayoutQuery.matches) {
    setCurationPanel(false);
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
        setCurationPanel(false);
        openDetail(slug, true, true);
      }
    });
  }
  if (zoomControls) {
    const [zoomIn, zoomOut] = zoomControls.querySelectorAll("button");
    if (zoomIn) zoomIn.addEventListener("click", () => naverMap && naverMap.setZoom(naverMap.getZoom() + 1));
    if (zoomOut) zoomOut.addEventListener("click", () => naverMap && naverMap.setZoom(naverMap.getZoom() - 1));
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
        <strong><span>${AdPlay.esc(item.title)}</span>${item.isNew ? `<sup class="map-curation-new">NEW!</sup>` : ""}</strong>
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
    const busListStops = activeCategory === "bus" ? filteredBusAdStops(query) : [];
    currentItems = searched;

    if (selectedMediaSlug && !searched.some((item) => item.slug === selectedMediaSlug)) {
      selectedMediaSlug = "";
      detailOpen = false;
    }
    if (!selectedMediaSlug && searched.length) selectedMediaSlug = searched[0].slug;

    const resultCount = activeCategory === "bus" ? busListStops.length : searched.length;
    const countText = `${resultCount.toLocaleString("ko-KR")}개`;
    countRoot.textContent = countText;
    if (summaryRoot) {
      const category = categoryTabs.find((tab) => tab.value === activeCategory) || categoryTabs[0];
      const categoryLabel = category.summaryLabel || category.label;
      const queryText = query ? `, "${query}" 검색 결과` : "";
      const filterText = costPeriodSummary();
      summaryRoot.innerHTML = `<span class="sr-only">지도 표시 지역에 <strong id="mapResultCount">${countText}</strong>의 ${AdPlay.esc(categoryLabel)} 매체가 있습니다${AdPlay.esc(queryText)}.${filterText ? ` ${AdPlay.esc(filterText)}.` : ""}</span>`;
    }
    updateCostFilterLabels();
    if (busStopLegend) {
      const showBusLegend = activeCategory === "bus";
      busStopLegend.hidden = !showBusLegend;
      busStopLegend.classList.toggle("is-visible", showBusLegend);
    }
    renderCategoryTabs();
    renderStage(searched, options.preserveView);
    if (!options.preserveView && query && resultCount === 0) {
      const place = lookupPlaceCenter(query);
      if (place && naverMap) {
        naverMap.setCenter(new naver.maps.LatLng(place.lat, place.lng));
        naverMap.setZoom(place.zoom || 14);
      }
    }
    renderList(searched, busListStops);
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
        busStopIdleListener = naver.maps.Event.addListener(naverMap, "idle", () => {
          if (activeCategory === "bus") syncBusStopLayer();
        });
      }

      naverMarkers.forEach((marker) => marker.setMap(null));
      naverMarkers = [];
      if (!items.length) {
        clearBusStopLayer();
        return;
      }

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
            size: new naver.maps.Size(42, 48),
            anchor: new naver.maps.Point(21, 42),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => openDetail(item.slug, true, true));
        naverMarkers.push(marker);
      });

      if (!preserveView) {
        if (activeCategory === "bus") {
          naverMap.setCenter(new naver.maps.LatLng(37.55, 126.99));
          naverMap.setZoom(12);
        } else if (items.length === 1) {
          const item = items[0];
          naverMap.setCenter(new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude));
          naverMap.setZoom(15);
        } else {
          naverMap.fitBounds(bounds, { top: 76, right: 76, bottom: 76, left: 76 });
        }
      }
      if (activeCategory === "bus") {
        syncBusStopLayer();
      } else {
        clearBusStopLayer();
      }
    } catch (error) {
      console.error("Naver map failed to initialize.", error);
    }
  }

  function clearBusStopLayer() {
    naverBusMarkers.forEach((marker) => marker.setMap(null));
    naverBusMarkers = [];
  }

  function syncBusStopLayer() {
    if (!naverMap || !window.naver || !window.naver.maps || activeCategory !== "bus") {
      clearBusStopLayer();
      return;
    }
    const bounds = naverMap.getBounds();
    if (!bounds) return;
    clearBusStopLayer();

    const query = busStopSearchQuery();
    const allStops = filteredBusAdStops(query);
    const zoom = typeof naverMap.getZoom === "function" ? naverMap.getZoom() : 12;
    if (zoom <= BUS_STOP_CLUSTER_MAX_ZOOM) {
      renderBusStopClusters(allStops);
      renderBusStopList(busStopsForCurrentMapView(query));
      return;
    }

    const stopIdSet = new Set(allStops.map((entry) => String(entry.id)));
    const visibleStops = visibleBusStops(bounds)
      .filter((stop) => stop.adProduct)
      .filter(matchesBusStopCostPeriod)
      .filter((stop) => stopIdSet.has(String(stop.id)))
      .slice(0, 650);
    visibleStops.forEach((stop) => {
      const position = busStopPosition(stop);
      const latlng = new naver.maps.LatLng(position.latitude, position.longitude);
      const marker = new naver.maps.Marker({
        map: naverMap,
        position: latlng,
        title: busStopTitle(stop),
        icon: {
          content: busStopMarkerContent(stop),
          size: new naver.maps.Size(26, 26),
          anchor: new naver.maps.Point(13, 15),
        },
      });
      naver.maps.Event.addListener(marker, "click", () => focusBusStop(stop.id));
      naverBusMarkers.push(marker);
    });
    renderBusStopList(busStopsForCurrentMapView(query));
  }

  function renderBusStopClusters(stops) {
    const groups = busStopClusterGroups(stops);
    groups.forEach((group) => {
      const marker = new naver.maps.Marker({
        map: naverMap,
        position: new naver.maps.LatLng(group.latitude, group.longitude),
        title: `${group.district} 버스 정류장 광고 ${group.count.toLocaleString("ko-KR")}개`,
        icon: {
          content: busStopClusterContent(group),
          size: new naver.maps.Size(group.size, group.size),
          anchor: new naver.maps.Point(group.size / 2, group.size / 2),
        },
      });
      naver.maps.Event.addListener(marker, "click", () => {
        naverMap.setCenter(new naver.maps.LatLng(group.latitude, group.longitude));
        naverMap.setZoom(Math.max(naverMap.getZoom() + 2, BUS_STOP_CLUSTER_MAX_ZOOM + 1));
      });
      naverBusMarkers.push(marker);
    });
  }

  function busStopClusterGroups(stops) {
    const grouped = new Map();
    stops.forEach((stop) => {
      const position = busStopPosition(stop);
      if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return;
      const product = stop.adProduct || {};
      const district = product.district || stop.district || "기타";
      const key = String(district);
      const group = grouped.get(key) || { district: key, count: 0, latitude: 0, longitude: 0 };
      group.count += 1;
      group.latitude += position.latitude;
      group.longitude += position.longitude;
      grouped.set(key, group);
    });
    return [...grouped.values()]
      .map((group) => {
        const size = Math.max(34, Math.min(72, 28 + Math.sqrt(group.count) * 4.8));
        return {
          ...group,
          latitude: group.latitude / group.count,
          longitude: group.longitude / group.count,
          size,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  function busStopClusterContent(group) {
    return `
      <button type="button" class="bus-stop-cluster" style="--cluster-size: ${group.size}px" aria-label="${AdPlay.esc(group.district)} 버스 정류장 ${group.count.toLocaleString("ko-KR")}개 보기">
        <span>${AdPlay.esc(group.district)}</span>
        <strong>${group.count.toLocaleString("ko-KR")}</strong>
      </button>`;
  }

  function visibleBusStops(bounds) {
    const sw = bounds.getSW();
    const ne = bounds.getNE();
    const south = sw.lat();
    const north = ne.lat();
    const west = sw.lng();
    const east = ne.lng();
    return (busStops || []).filter((stop) => (
      busStopPosition(stop).latitude >= south
      && busStopPosition(stop).latitude <= north
      && busStopPosition(stop).longitude >= west
      && busStopPosition(stop).longitude <= east
    ));
  }

  function busStopSearchQuery() {
    return (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
  }

  function busStopsForCurrentMapView(query = busStopSearchQuery()) {
    const allStops = filteredBusAdStops(query);
    if (!naverMap || !window.naver || !window.naver.maps || activeCategory !== "bus") {
      return busStopListWithSelectedFirst(allStops);
    }
    const bounds = naverMap.getBounds();
    if (!bounds) return busStopListWithSelectedFirst(allStops);
    const allowed = new Set(allStops.map((stop) => String(stop.id)));
    const visible = visibleBusStops(bounds)
      .filter((stop) => stop.adProduct)
      .filter((stop) => allowed.has(String(stop.id)));
    return busStopListWithSelectedFirst(visible.length ? visible : allStops);
  }

  function busStopListWithSelectedFirst(stops) {
    const selected = selectedBusStopId
      ? (busStops || []).find((stop) => String(stop.id) === String(selectedBusStopId))
      : null;
    const deduped = [];
    const seen = new Set();
    if (selected) {
      deduped.push(selected);
      seen.add(String(selected.id));
    }
    stops.forEach((stop) => {
      const id = String(stop.id);
      if (seen.has(id)) return;
      deduped.push(stop);
      seen.add(id);
    });
    return deduped;
  }

  function busStopPosition(stop) {
    const override = busStopPositionOverrides?.[String(stop.ars || "")] || busStopPositionOverrides?.[String(stop.id || "")];
    const latitude = Number(override?.latitude ?? stop.latitude);
    const longitude = Number(override?.longitude ?? stop.longitude);
    return { latitude, longitude };
  }

  function busStopMarkerContent(stop) {
    const product = stop.adProduct || {};
    const kind = product.displayKind || "static";
    const grade = product.grade || "";
    const label = busStopTitle(stop);
    return `
      <span class="bus-stop-pin is-${AdPlay.esc(kind)}${selectedBusStopId === String(stop.id) ? " is-active" : ""}${grade ? ` is-grade-${AdPlay.esc(String(grade).toLowerCase().replace(/[^a-z0-9]+/g, "-"))}` : ""}" role="img" aria-label="${AdPlay.esc(label)}">
        <span class="bus-stop-pin-core"></span>
      </span>`;
  }

  function busStopTitle(stop) {
    const product = stop.adProduct || {};
    const price = product.minMonthlyCost
      ? ` · 월 ${Math.round(product.minMonthlyCost / 10000).toLocaleString("ko-KR")}만원`
      : "";
    const grade = product.grade ? ` · ${product.grade}` : "";
    const kind = product.displayLabel ? ` · ${product.displayLabel}` : "";
    return `${stop.name}${stop.ars ? ` (${stop.ars})` : ""}${kind}${grade}${price}`;
  }

  function filteredBusAdStops(query = "") {
    return (busStops || [])
      .filter((stop) => stop.adProduct)
      .filter((stop) => matchesBusStopCostPeriod(stop))
      .filter((stop) => {
        if (!query) return true;
        const product = stop.adProduct || {};
        const haystack = [
          stop.name,
          stop.ars,
          stop.type,
          product.district,
          product.dong,
          product.productType,
          product.grade,
          product.stationName,
          product.faceLabel,
          product.address,
          product.light,
          product.displayLabel,
          product.innerSize,
          product.outerSize,
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      });
  }

  function matchesBusStopCostPeriod(stop) {
    const product = stop.adProduct || {};
    const monthly = Number(product.minMonthlyCost);
    if (activeBudget !== "all") {
      if (!Number.isFinite(monthly)) return false;
      const manwon = monthly / 10000;
      if (activeBudget === "under100") return manwon < 100;
      if (activeBudget === "100-300") return manwon >= 100 && manwon < 300;
      if (activeBudget === "300-500") return manwon >= 300 && manwon < 500;
      if (activeBudget === "500-1000") return manwon >= 500 && manwon < 1000;
      if (activeBudget === "1000-1500") return manwon >= 1000 && manwon < 1500;
      if (activeBudget === "1500plus") return manwon >= 1500;
    }
    return true;
  }

  function focusBusStop(stopId) {
    const stop = (busStops || []).find((item) => String(item.id) === String(stopId));
    if (!stop) return;
    selectedBusStopId = String(stop.id);
    if (naverMap && window.naver && window.naver.maps) {
      const position = busStopPosition(stop);
      naverMap.setCenter(new naver.maps.LatLng(position.latitude, position.longitude));
      if (naverMap.getZoom() < 16) naverMap.setZoom(16);
      syncBusStopLayer();
    }
    renderBusStopList(busStopListWithSelectedFirst(busStopsForCurrentMapView()));
    if (listView && typeof listView.scrollTo === "function") {
      listView.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function formatBusWon(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return `${number.toLocaleString("ko-KR")}원`;
  }

  function markerContent(item) {
    const isActive = selectedMediaSlug === item.slug;
    const image = cardImages(item)[0];
    return `
      <button type="button" class="media-map-pin${isActive ? " is-active" : ""}" aria-label="${AdPlay.esc(item.name)}">
        <span class="media-map-pin-image"><img src="${AdPlay.esc(image)}" alt="" onerror="this.src='${AdPlay.esc(AdPlay.pageImage(item))}'"></span>
      </button>`;
  }

  function renderList(items, busListStops = []) {
    if (activeCategory === "bus") {
      renderBusStopList(busStopsForCurrentMapView());
      return;
    }
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
          </div>
          <p>${AdPlay.esc(compactAddress(item))}</p>
          <p class="map-card-decision-line">${AdPlay.esc(mapCardDecisionSummary(item))}</p>
          <p class="map-card-exposure-point">${AdPlay.esc(cardExposurePoint(item))}</p>
          <div class="map-list-tags">
            ${[item.areaName, AdPlay.categoryLabels[item.category] || item.mediaType].filter(Boolean).slice(0, 3).map((tag) => `<span>${AdPlay.esc(tag)}</span>`).join("")}
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
              ${index === 3 ? `<button type="button" class="map-detail-gallery-jump">사진 더보기(${Math.max(galleryImages.length, 4)})</button>` : ""}
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
          <span>할인, 패키지, 예산 맞춤 집행은 1533-1975 또는 라이브 상담 신청</span>
        </a>
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
        <section class="map-detail-section" id="detailTraffic">
          <h3>유동인구와 타깃</h3>
          <p class="map-detail-copy">${AdPlay.esc(insight.traffic)}</p>
          ${trafficVisualization(insight)}
        </section>
        <section class="map-detail-section" id="detailLocation">
          <h3>입지 특성</h3>
          <p class="map-detail-copy">${AdPlay.esc(insight.location)}</p>
          <div class="map-insight-score">
            ${insight.scores.map((score) => `<div><span>${AdPlay.esc(score.label)}</span><i style="--score:${score.value}"></i><strong>${score.value}</strong></div>`).join("")}
          </div>
        </section>
        <section class="map-detail-section" id="detailFacilities">
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
    const galleryJump = detailRoot.querySelector(".map-detail-gallery-jump");
    if (galleryJump) galleryJump.addEventListener("click", () => {
      const gallerySection = detailRoot.querySelector("#detailGallery");
      if (gallerySection) gallerySection.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (mobileLayoutQuery.matches) {
      setMobileListOpen(true);
    }
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

  function mapCardDecisionSummary(item) {
    const terms = [mapCardPriceLabel(item), sizeLabel(item)];
    terms.push(item.shortTermAvailable === false ? "월 단위 집행" : "1개월 미만 협의");
    return terms.filter(Boolean).join(" · ");
  }

  function cardExposurePoint(item) {
    const text = [item.name, item.areaName, item.areaSlug, item.address, item.mapLocation && item.mapLocation.sourceAddress]
      .filter(Boolean)
      .join(" ");
    if (/광화문|종로|시청|청계|gwanghwamun|jongno/i.test(text)) return "광장·보행 동선에서 반복 노출";
    if (/서울역|KTX|seoul-station|transport/i.test(text)) return "철도·지하철 환승 동선 집중 노출";
    if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) return "업무·전시 방문객과 차량 동시 노출";
    if (/신사|강남|도산|가로수|sinsa|gangnam/i.test(text)) return "횡단보도·차량정체 구간 정면 노출";
    return "주요 보행·차량 동선에서 반복 노출";
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
    const monthly = [7.1, 7.3, 7.5, 7.9, 8.3, 7.8, 7.4, 7.9, 7.7, 7.9, 7.5, 7.6];
    const monthLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
    const minMonth = Math.min(...monthly);
    const maxMonth = Math.max(...monthly);
    const peakIndex = monthly.indexOf(maxMonth);
    const monthX = (index) => 26 + index * 28.6;
    const monthY = (value) => 118 - ((value - minMonth) / (maxMonth - minMonth || 1)) * 54;
    const points = monthly.map((value, index) => `${monthX(index)},${monthY(value)}`).join(" ");
    const dayBars = [
      ["월", 7.4, 82, "강"],
      ["화", 7.6, 84, "강"],
      ["수", 7.8, 86, "강"],
      ["목", 8.0, 88, "최대"],
      ["금", 7.9, 87, "강"],
      ["토", 6.5, 72, "주말"],
      ["일", 5.7, 62, "완만"],
    ];
    const timeBars = [
      ["05~09", 4.2, 54, "출근"],
      ["09~12", 5.4, 70, "오전"],
      ["12~14", 4.8, 62, "점심"],
      ["14~18", 7.8, 100, "피크"],
      ["18~23", 6.7, 86, "저녁"],
      ["23~05", 2.6, 34, "심야"],
    ];
    const topDay = dayBars.reduce((top, row) => row[1] > top[1] ? row : top, dayBars[0]);
    const topTime = timeBars.reduce((top, row) => row[1] > top[1] ? row : top, timeBars[0]);
    const ageRows = [
      ["10대", 8, 27, "학생·동반"],
      ["20대", 24, 78, "활동층"],
      ["30대", 27, 88, "구매 핵심"],
      ["40대", 22, 72, "직장인"],
      ["50대", 13, 43, "가족 소비"],
      ["60대+", 6, 22, "생활권"],
    ];
    const audienceRows = insight.audience || [];
    return `
      <div class="map-traffic-lead">
        <p>반경별 유동, 대중교통 승하차, 도로 교통량을 함께 보며 매체 주변 도달 규모와 노출 피크를 판단할 수 있습니다.</p>
      </div>
      <div class="map-traffic-kpis">
        <article class="is-primary"><span>일평균 유동 500m</span><strong>${AdPlay.esc(stats.daily500)}</strong><em>상권 반경 추정</em></article>
        <article><span>일평균 유동 300m</span><strong>${AdPlay.esc(stats.daily300)}</strong><em>매체 근접권</em></article>
        <article class="is-text-kpi"><span>핵심 타깃</span><strong>${AdPlay.esc(stats.target)}</strong><em>구매·방문 가능층</em></article>
        <article><span>지하철 승하차</span><strong>${AdPlay.esc(stats.subway)}</strong><em>주변역 일평균</em></article>
        <article><span>버스 승하차</span><strong>${AdPlay.esc(stats.bus)}</strong><em>주변 정류장</em></article>
        <article><span>도로 교통량</span><strong>${AdPlay.esc(stats.traffic)}</strong><em>주요 간선도로</em></article>
      </div>
      <div class="map-traffic-chart">
        <div class="map-traffic-chart-head">
          <div>
            <h4>월별 일평균 유동 추이</h4>
            <p>반경 500m 기준 · 단위 만명</p>
          </div>
          <strong>${peakIndex + 1}월 피크 ${maxMonth.toFixed(1)}만명</strong>
        </div>
        <svg viewBox="0 0 366 164" role="img" aria-label="월별 유동인구 추이 그래프">
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
          <path d="M26 124H341" class="axis"></path>
          <polygon points="26,124 ${points} 341,124" class="area"></polygon>
          <polyline points="${points}" class="line"></polyline>
          ${monthly.map((value, index) => `<circle class="${index === peakIndex ? "is-peak" : ""}" cx="${monthX(index)}" cy="${monthY(value)}" r="${index === peakIndex ? 5 : 3.5}"></circle>`).join("")}
          <text class="map-traffic-peak" x="${monthX(peakIndex)}" y="${monthY(maxMonth) - 12}">${maxMonth.toFixed(1)}만</text>
          ${monthLabels.map((label, index) => `<text x="${monthX(index)}" y="150">${AdPlay.esc(label)}월</text>`).join("")}
        </svg>
      </div>
      <div class="map-traffic-grid">
        <div class="map-traffic-panel">
          <div class="map-traffic-panel-head">
            <h4>요일별 일평균</h4>
            <b>${topDay[0]}요일 강세</b>
          </div>
          ${dayBars.map(([label, people, value, note]) => `<div><span>${label}</span><i style="--bar:${value}"></i><em>${people.toFixed(1)}만</em><strong>${note}</strong></div>`).join("")}
        </div>
        <div class="map-traffic-panel">
          <div class="map-traffic-panel-head">
            <h4>시간대별 유동</h4>
            <b>${topTime[0]} 집중</b>
          </div>
          ${timeBars.map(([label, people, value, note]) => `<div><span>${label}</span><i style="--bar:${value}"></i><em>${people.toFixed(1)}만</em><strong>${note}</strong></div>`).join("")}
        </div>
      </div>
      <div class="map-traffic-segments" aria-label="타깃 및 방문 동기">
        <div class="map-traffic-segments-head">
          <h4>타깃·방문 동기</h4>
          <p>광고 메시지를 누구에게 맞출지 판단하는 보조 지표입니다.</p>
        </div>
        <div class="map-age-distribution">
          <div class="map-age-distribution-head">
            <h5>연령대 분포</h5>
            <b>20~40대 중심</b>
          </div>
          ${ageRows.map(([label, percent, value, note]) => `<div class="map-age-row ${percent === 27 ? "is-peak" : ""}">
            <span>${label}</span>
            <i style="--bar:${value}"></i>
            <em>${percent}%</em>
            <strong>${note}</strong>
          </div>`).join("")}
        </div>
        <div class="map-traffic-segment-list">
          ${audienceRows.map((row) => `<div class="map-traffic-segment"><span>${AdPlay.esc(row.label)}</span><i style="--bar:${row.value}"></i><strong>${AdPlay.esc(row.note)}</strong></div>`).join("")}
        </div>
      </div>`;
  }

  function locationInsight(item) {
    const text = [item.name, item.areaName, item.areaSlug, item.address, item.mapLocation && item.mapLocation.sourceAddress].filter(Boolean).join(" ");
    const area = areaBySlug.get(item.areaSlug);
    const withAreaTransit = (insight) => {
      const subway = areaSubwayTotal(area);
      const bus = areaBusTotal(area);
      return {
        ...insight,
        stats: {
          ...(insight.stats || {}),
          ...(subway ? { subway: compactPeople(subway) } : {}),
          ...(bus ? { bus: compactPeople(bus) } : {}),
        },
      };
    };
    if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) {
      return withAreaTransit({
        location: "코엑스, 무역센터, 백화점, 호텔, 전시·컨벤션 동선이 겹치는 복합 상권입니다. B2B 방문객과 쇼핑·관광 체류 인구가 함께 발생해 브랜드 인지도와 행사 연계 캠페인에 적합합니다.",
        traffic: "평일에는 업무·전시 방문 수요가 안정적으로 유입되고, 주말에는 쇼핑몰·영화관·행사 방문객 중심으로 체류 시간이 길어지는 특성이 있습니다.",
        stats: { daily500: "8.4만명", daily300: "3.4만명", subway: "13.8만명", bus: "4.1만명", traffic: "9.2만대", target: "2030·B2B 방문객" },
        scores: scoreSet([["기업·오피스", 5], ["대형몰·상업시설", 5], ["지역명소", 4], ["교통접점", 4], ["행사연계", 5]]),
        facilities: facilitySet([["주요 교통", "삼성역, 봉은사역, 테헤란로"], ["지역 명소", "코엑스, 무역센터, 별마당길, K-POP 광장"], ["상업 시설", "백화점, 쇼핑몰, 영화관, 호텔"], ["기업·오피스", "무역센터, 테헤란로 업무시설, 컨벤션 방문 기업"], ["행사", "전시회, 컨퍼런스, 브랜드 팝업, K-콘텐츠 행사"]]),
        audience: audienceSet([["평일 업무·전시", 88, "오피스·컨벤션"], ["주말 쇼핑·관광", 78, "체류형 방문"], ["2030 활동층", 82, "문화·쇼핑"], ["프리미엄 소비층", 74, "백화점·호텔"]]),
      });
    }
    if (/서울역|KTX|seoul-station|transport/i.test(text)) {
      return withAreaTransit({
        location: "철도, 지하철, 버스, 택시 동선이 집중되는 광역 교통 허브입니다. 출퇴근·출장·관광객이 반복적으로 교차해 단기간 고빈도 노출과 전국 단위 도달 메시지에 유리합니다.",
        traffic: "평일 출퇴근 피크와 주말 여행 수요가 모두 발생합니다. 이동 목적이 뚜렷한 이용자가 많아 금융, 통신, 여행, 공공 캠페인 고지에 적합합니다.",
        stats: { daily500: "9.1만명", daily300: "3.7만명", subway: "18.6만명", bus: "5.4만명", traffic: "8.8만대", target: "출퇴근·출장객" },
        scores: scoreSet([["교통접점", 5], ["광역도달", 5], ["기업·오피스", 4], ["관광동선", 4], ["상업시설", 3]]),
        facilities: facilitySet([["주요 교통", "서울역, KTX, 공항철도, 지하철 1·4호선"], ["지역 명소", "서울로, 남대문, 도심 관광 동선"], ["상업 시설", "역사 상업시설, 호텔, F&B"], ["기업·오피스", "서울역 인근 업무지구, 도심 기관"], ["행사", "여행 성수기, 공공 캠페인, 광역 프로모션"]]),
        audience: audienceSet([["출퇴근 피크", 86, "반복 노출"], ["출장·관광객", 90, "광역 이동"], ["주말 여행", 76, "목적형 방문"], ["고지 수용도", 80, "이동 전 대기"]]),
      });
    }
    if (/광화문|종로|시청|청계|gwanghwamun|jongno|jung/i.test(text)) {
      return withAreaTransit({
        location: "광화문, 청계광장, 시청, 종로 업무지구를 연결하는 서울 도심 랜드마크 입지입니다. 관광·문화·공공행사 동선과 오피스 유동이 함께 발생해 신뢰도 높은 브랜드 노출에 적합합니다.",
        traffic: "평일에는 직장인 출퇴근·점심 유동이 강하고, 주말에는 관광객과 행사 방문객 비중이 커집니다. 축제·문화행사 시 체류 시간이 길어져 반복 노출이 가능합니다.",
        stats: { daily500: "7.9만명", daily300: "3.2만명", subway: "11.7만명", bus: "4.6만명", traffic: "7.4만대", target: "직장인·관광객" },
        scores: scoreSet([["지역명소", 5], ["기업·오피스", 5], ["교통접점", 4], ["관광·행사", 5], ["상업시설", 4]]),
        facilities: facilitySet([["주요 교통", "광화문역, 시청역, 종각역, 세종대로"], ["지역 명소", "청계광장, 광화문광장, 세종문화회관, 덕수궁"], ["상업 시설", "무교동·종로 상권, F&B, 관광특구"], ["기업·오피스", "서울시청, 금융기관, 언론사, 대기업 오피스"], ["행사", "서울페스티벌, 빛초롱축제, 도심 문화행사"]]),
        audience: audienceSet([["평일 직장인", 86, "출퇴근·점심"], ["주말 관광객", 78, "도심 명소"], ["행사 체류", 84, "반복 노출"], ["40대 이상", 72, "구매력 높은 층"]]),
      });
    }
    return withAreaTransit({
      location: "강남대로, 도산대로, 신사·청담 상권을 잇는 프리미엄 소비 동선입니다. 업무, 뷰티, 패션, F&B, 야간 활동 수요가 겹쳐 브랜드 런칭과 고관여 소비재 캠페인에 적합합니다.",
      traffic: "평일에는 출퇴근·점심 직장인 유동이 안정적이고, 저녁과 주말에는 쇼핑·약속·외식 목적 방문객이 증가합니다. 2030 활동층과 구매력 높은 직장인층을 함께 공략할 수 있습니다.",
      stats: { daily500: "7.6만명", daily300: "3.1만명", subway: "12.4만명", bus: "3.8만명", traffic: "8.6만대", target: "2030·직장인" },
      scores: scoreSet([["기업·오피스", 5], ["상업시설", 5], ["지역명소", 4], ["교통접점", 4], ["야간활동", 4]]),
      facilities: facilitySet([["주요 교통", "신사역, 강남대로, 도산대로, 주요 버스 동선"], ["지역 명소", "가로수길, 압구정·청담 상권, 프리미엄 뷰티·패션 거리"], ["상업 시설", "병원, 뷰티, F&B, 쇼룸, 브랜드 플래그십"], ["기업·오피스", "강남 업무시설, 스타트업, 전문직 종사자"], ["행사", "브랜드 팝업, 패션·뷰티 런칭, 시즌 프로모션"]]),
      audience: audienceSet([["평일 직장인", 84, "출퇴근·점심"], ["2030 활동층", 88, "쇼핑·약속"], ["프리미엄 소비", 82, "뷰티·패션"], ["야간 유동", 76, "외식·모임"]]),
    });
  }

  function renderBusStopList(stops) {
    let visibleStops = stops.slice(0, 120);
    if (!selectedBusStopId && stops.length) selectedBusStopId = String(stops[0].id);
    const selectedStop = selectedBusStopId
      ? stops.find((stop) => String(stop.id) === selectedBusStopId)
      : null;
    if (selectedStop && !visibleStops.some((stop) => String(stop.id) === selectedBusStopId)) {
      visibleStops = [selectedStop, ...visibleStops].slice(0, 120);
    }
    if (selectedBusStopId && !stops.some((stop) => String(stop.id) === selectedBusStopId)) {
      selectedBusStopId = stops.length ? String(stops[0].id) : "";
      visibleStops = stops.slice(0, 120);
    }
    listRoot.innerHTML = visibleStops.length
      ? visibleStops.map(busStopCard).join("")
      : `<div class="empty">조건에 맞는 버스 정류장 광고가 없습니다.</div>`;

    listRoot.querySelectorAll("[data-map-bus-stop]").forEach((button) => {
      button.addEventListener("click", () => focusBusStop(button.dataset.mapBusStop));
    });
  }

  function busStopSummaryRow(label, items) {
    const values = items.filter(([, value]) => value);
    if (!values.length) return "";
    return `
      <div class="map-bus-stop-summary-row">
        <dt>${AdPlay.esc(label)}</dt>
        <dd>${values.map(([itemLabel, value]) => `
          <span><b>${AdPlay.esc(itemLabel)}</b>${AdPlay.esc(value)}</span>
        `).join("")}</dd>
      </div>`;
  }

  function busStopRawFaceCode(value) {
    return /\d{2}-\d{3}_\d+_\d+/.test(String(value || ""));
  }

  function busStopFaceNumbers(product) {
    const sourceFaces = Array.isArray(product.faces) && product.faces.length
      ? product.faces
      : String(product.faceLabel || "").split(",");
    const numbers = sourceFaces
      .map((face) => String(face || "").trim())
      .map((face) => {
        const rawMatch = face.match(/\d{2}-\d{3}_\d+_(\d+)$/);
        if (rawMatch) return rawMatch[1];
        const labelMatch = face.match(/(\d+)\s*면/);
        if (labelMatch) return labelMatch[1];
        return "";
      })
      .filter(Boolean);
    const uniqueNumbers = [...new Set(numbers
      .map(Number)
      .filter(Boolean)
      .map((number) => ((number - 1) % 4) + 1))]
      .sort((a, b) => a - b);
    return uniqueNumbers.length ? uniqueNumbers : ["1", "2"];
  }

  function compactBusStopFaceLabel(numbers) {
    const numeric = [...new Set(numbers.map(Number).filter(Boolean))].sort((a, b) => a - b);
    if (!numeric.length) return "";
    const groups = [];
    let index = 0;
    while (index < numeric.length) {
      const first = numeric[index];
      const second = numeric[index + 1];
      if (second === first + 1) {
        groups.push(`${first}, ${second}면`);
        index += 2;
      } else {
        groups.push(`${first}면`);
        index += 1;
      }
    }
    return groups.join(", ");
  }

  function busStopFaceLabel(product) {
    const rawLabel = String(product.faceLabel || "").trim();
    if (rawLabel && !busStopRawFaceCode(rawLabel)) return rawLabel;
    const normalized = compactBusStopFaceLabel(busStopFaceNumbers(product));
    return normalized || rawLabel || "확인 필요";
  }

  function busStopTypeImage(product) {
    const type = String(product.productType || "").toUpperCase().replace(/\s+/g, "");
    const match = type.match(/\b(A-1|A-2|A|B-1|B-2|B-3|B)\b/);
    const imageKey = match ? match[1] : "A";
    return `assets/images/bus-stops/${imageKey}.png?v=bus-photo-original-20260621`;
  }

  function busStopFaceImage(product) {
    const type = String(product.productType || "").toUpperCase();
    const compactType = type.replace(/\s+/g, "");
    const faceLabel = busStopFaceLabel(product);
    const compactFace = faceLabel.replace(/\s+/g, "");
    const hasSingleFace = /(^|,)1면($|,)|(^|,)2면($|,)|1,2면/.test(compactFace)
      && !/(3,4면|3,5면|5,6면|총8면)/.test(compactFace);
    const hasAType = /(^|\/)A(-\d)?($|\/)/.test(compactType);
    const hasSideFace = hasAType || /1,3면|2,4면|광역형\(A\)|광역형\(B\)/.test(`${compactFace}${type}`);
    if (/B-3/.test(type) || hasSingleFace) {
      return "assets/images/bus-stops/ad-face-single-horizontal.png";
    }
    if (hasSideFace) {
      return "assets/images/bus-stops/ad-face-side-horizontal.png";
    }
    return "assets/images/bus-stops/ad-face-double-horizontal.png";
  }

  function busStopVisual(product) {
    const kindLabel = product.displayLabel || "고정형";
    const typeLabel = product.productType || "버스 쉘터";
    const faceLabel = busStopFaceLabel(product);
    return `
      <div class="map-bus-stop-visual" aria-label="버스 정류장 광고 타입 및 광고면 위치">
        <figure class="map-bus-stop-type-preview">
          <img src="${AdPlay.esc(busStopTypeImage(product))}" alt="${AdPlay.esc(typeLabel)} 타입 예시">
          <figcaption>
            <strong>${AdPlay.esc(kindLabel)}</strong>
            <span>${AdPlay.esc(typeLabel)}</span>
          </figcaption>
        </figure>
        <figure class="map-bus-stop-face-preview">
          <img src="${AdPlay.esc(busStopFaceImage(product))}" alt="버스 쉘터 광고면 위치 안내">
          <figcaption>광고면 ${AdPlay.esc(faceLabel)}</figcaption>
        </figure>
      </div>`;
  }

  function busStopCard(stop) {
    const product = stop.adProduct || {};
    const isActive = selectedBusStopId === String(stop.id);
    const title = product.stationName || stop.name;
    const arsLabel = stop.ars ? `ID ${stop.ars}` : "";
    const monthly = product.monthlyCostLabel || formatBusWon(product.minMonthlyCost) || "비용 문의";
    const vatNote = monthly === "비용 문의" ? "" : "* 부가세 별도";
    const summaryRows = [
      busStopSummaryRow("위치", [["자치구", product.district], ["동명", product.dong], ["정류소명", title], ["주소", product.address]]),
      busStopSummaryRow("상품", [["타입", product.productType], ["등급", product.grade], ["광고면", busStopFaceLabel(product)], ["조명", product.light || product.displayLabel]]),
      busStopSummaryRow("비용·유동", [["월광고비", monthly], ["출력/부착비", product.installationCostLabel || "80,000원"], ["월 승하차객수", product.ridershipLabel || "확인 필요"]]),
      busStopSummaryRow("규격", [["외경", product.outerSize], ["내경", product.innerSize]]),
    ].join("");
    return `
      <article class="map-list-card map-bus-stop-card${isActive ? " is-active" : ""}">
        <button type="button" data-map-bus-stop="${AdPlay.esc(String(stop.id))}" aria-label="${AdPlay.esc(title)} 위치 보기" aria-current="${isActive ? "true" : "false"}"></button>
        <div class="map-list-card-body">
          <div class="map-list-title-row">
            <h2>${AdPlay.esc(title)}${arsLabel ? `<span class="map-bus-stop-ars">${AdPlay.esc(arsLabel)}</span>` : ""}</h2>
            <strong class="map-bus-stop-price">${AdPlay.esc(monthly)}${vatNote ? `<small>${AdPlay.esc(vatNote)}</small>` : ""}</strong>
          </div>
          ${isActive ? `<span class="map-bus-stop-selected-label">지도에서 선택한 정류장</span>` : ""}
          <dl class="map-bus-stop-summary">${summaryRows}</dl>
          ${busStopVisual(product)}
        </div>
      </article>`;
  }

  function areaBusTotal(area) {
    return (area?.busMonthlyUsers || []).reduce((sum, stop) => sum + Number(stop.users || 0), 0) || null;
  }

  function areaSubwayTotal(area) {
    return (area?.subwayMonthlyUsers || []).reduce((sum, station) => sum + Number(station.users || 0), 0) || null;
  }

  function compactPeople(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number >= 10000 ? `${(number / 10000).toFixed(1)}만명` : `${AdPlay.formatNumber(number)}명`;
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
