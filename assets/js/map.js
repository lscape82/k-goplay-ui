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
  const curationPanel = document.querySelector("#mapCurationPanel");
  const curationClose = document.querySelector("#mapCurationClose");
  const zoomControls = document.querySelector(".map-zoom-controls");

  const categoryTabs = [
    ["all", "전체매체"],
    ["large_billboard", "건물 전광판 광고"],
    ["subway", "지하철 광고"],
    ["bus", "버스 정류장 광고"],
    ["transport_hub", "공항, 터미널, 기차 광고"],
    ["shopping_mall_did", "쇼핑몰, 영화관 광고"],
    ["daily_touchpoint", "엘리베이터 광고"],
  ];

  let activeCategory = new URLSearchParams(window.location.search).get("category") || "all";
  let selectedMediaSlug = new URLSearchParams(window.location.search).get("media") || "";
  let detailOpen = Boolean(selectedMediaSlug);
  let naverMap = null;
  let naverMarkers = [];
  let currentItems = [];

  const mediaWithLocations = media.map((item) => ({
    ...item,
    mapLocation: locations[item.slug] || null,
  })).filter(hasLatLng);

  renderCategoryTabs();
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
    });
  }
  document.querySelectorAll("[data-curation-media]").forEach((button) => {
    button.addEventListener("click", () => openDetail(button.dataset.curationMedia, true, true));
  });
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
      .filter(([value]) => value === "all" || available.has(value))
      .map(([value, label]) => `
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

  function render(options = {}) {
    const query = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    const filtered = mediaWithLocations.filter((item) => activeCategory === "all" || item.category === activeCategory);
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
      const categoryLabel = categoryTabs.find(([value]) => value === activeCategory)?.[1] || "전체매체";
      const queryText = query ? `, "${query}" 검색 결과` : "";
      summaryRoot.innerHTML = `지도 표시 지역에 <strong id="mapResultCount">${countText}</strong>의 ${AdPlay.esc(categoryLabel)} 광고가 있습니다${AdPlay.esc(queryText)}.`;
    }
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
            <strong>${AdPlay.priceLabel(item)}</strong>
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
    detailRoot.innerHTML = `
      <button type="button" class="map-detail-close" id="mapDetailClose" aria-label="목록으로 돌아가기">×</button>
      <figure class="map-detail-hero">
        <img src="${AdPlay.esc(image)}" alt="${AdPlay.esc(item.name)} 현장 이미지" onerror="this.src='${AdPlay.esc(AdPlay.pageImage(item))}'">
      </figure>
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
          <a href="media-detail.html?slug=${encodeURIComponent(item.slug)}">소개서</a>
          <a href="https://map.naver.com/v5/search/${encodeURIComponent(location.sourceAddress || item.address)}" target="_blank" rel="noopener">로드뷰</a>
          <button type="button" data-copy-map-link>공유</button>
        </div>
        <a class="map-detail-consult" href="estimate.html?media=${encodeURIComponent(item.slug)}">상담하기</a>
        <dl class="map-detail-specs">
          ${detailFact("크기", location.size || sizeLabel(item))}
          ${detailFact("해상도", location.resolution || item.resolutionPx || "확인 필요")}
          ${detailFact("유형", AdPlay.categoryLabels[item.category] || item.mediaType)}
          ${detailFact("운영시간", location.operationHours || item.operationHours)}
          ${detailFact("계약정보", location.contract || AdPlay.priceLabel(item))}
        </dl>
        <div class="map-detail-contact">
          <p>${AdPlay.esc(location.sourceAddress || item.address)}</p>
          <p>1533-1975 · 광고플레이 전화걸기</p>
        </div>
      </div>`;

    document.querySelector("#mapDetailClose").addEventListener("click", () => {
      detailOpen = false;
      syncPanelMode();
      focusSelectedCard();
    });
    const copyButton = detailRoot.querySelector("[data-copy-map-link]");
    copyButton.addEventListener("click", async () => {
      const url = `${window.location.origin}${window.location.pathname}?media=${encodeURIComponent(item.slug)}`;
      try {
        await navigator.clipboard.writeText(url);
        copyButton.textContent = "복사됨";
      } catch {
        copyButton.textContent = "공유";
      }
    });
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
    if (!roadAddress) return sourceAddress || "주소 확인 필요";
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
