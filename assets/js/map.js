document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-map");
  if (!root) return;

  const [areas, media, locations] = await Promise.all([
    AdPlay.loadJson("data/areas.json"),
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/media_locations.json"),
  ]);

  const areaFilter = document.querySelector("#mapAreaFilter");
  const categoryFilter = document.querySelector("#mapCategoryFilter");
  const stage = document.querySelector("#mapStage");
  const selectedRoot = document.querySelector("#mapSelectedArea");
  const listRoot = document.querySelector("#mapMediaList");
  const countRoot = document.querySelector("#mapResultCount");

  let naverMap = null;
  let naverMarkers = [];
  let selectedMediaSlug = new URLSearchParams(window.location.search).get("media") || "";
  let currentItems = [];

  const mediaWithLocations = media.map((item) => ({
    ...item,
    mapLocation: locations[item.slug] || null,
  }));

  populateFilters();
  render();

  areaFilter.addEventListener("change", () => {
    selectedMediaSlug = "";
    render();
  });
  categoryFilter.addEventListener("change", () => {
    selectedMediaSlug = "";
    render();
  });

  function populateFilters() {
    const activeAreas = areas
      .map((area) => ({
        area,
        count: mediaWithLocations.filter((item) => item.areaSlug === area.slug && hasLatLng(item)).length,
      }))
      .filter((entry) => entry.count > 0);

    activeAreas.forEach(({ area, count }) => {
      const option = document.createElement("option");
      option.value = area.slug;
      option.textContent = `${area.name} (${count})`;
      areaFilter.appendChild(option);
    });

    Object.entries(AdPlay.categoryLabels).forEach(([value, label]) => {
      if (value === "other") return;
      if (!mediaWithLocations.some((item) => item.category === value && hasLatLng(item))) return;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      categoryFilter.appendChild(option);
    });
  }

  function render(options = {}) {
    const area = areaFilter.value;
    const category = categoryFilter.value;
    const filtered = mediaWithLocations.filter((item) => (
      hasLatLng(item) &&
      (area === "all" || item.areaSlug === area) &&
      (category === "all" || item.category === category)
    ));

    currentItems = filtered;
    if (selectedMediaSlug && !filtered.some((item) => item.slug === selectedMediaSlug)) {
      selectedMediaSlug = "";
    }
    if (!selectedMediaSlug && filtered.length) selectedMediaSlug = filtered[0].slug;

    countRoot.textContent = `${filtered.length.toLocaleString("ko-KR")}개 매체`;
    renderStage(filtered, options.preserveView);
    renderSelectedMedia(selectedItem(filtered), filtered);
    renderMedia(filtered);
  }

  function renderStage(items, preserveView = false) {
    if (!window.naver || !window.naver.maps) {
      renderNaverLoadError();
      return;
    }
    renderNaverMap(items, preserveView);
  }

  function renderNaverLoadError() {
    stage.classList.remove("has-naver-map");
    stage.innerHTML = `
      <div class="map-load-error">
        <strong>네이버 지도를 불러오지 못했습니다.</strong>
        <span>네이버 클라우드 앱의 Web 서비스 URL에 현재 도메인이 등록되어 있는지 확인해 주세요.</span>
      </div>
    `;
  }

  function renderNaverMap(items, preserveView) {
    try {
      stage.classList.add("has-naver-map");
      if (!naverMap) {
        stage.innerHTML = "";
        naverMap = new naver.maps.Map(stage, {
          center: new naver.maps.LatLng(37.5172, 127.0473),
          zoom: 12,
          minZoom: 8,
          mapTypeControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT,
          },
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
            size: new naver.maps.Size(58, 58),
            anchor: new naver.maps.Point(29, 29),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => {
          selectedMediaSlug = item.slug;
          render({ preserveView: true });
          naverMap.panTo(latlng);
        });
        naverMarkers.push(marker);
      });

      if (!preserveView) {
        if (items.length === 1) {
          naverMap.setCenter(new naver.maps.LatLng(items[0].mapLocation.latitude, items[0].mapLocation.longitude));
          naverMap.setZoom(15);
        } else {
          naverMap.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });
        }
      }
    } catch (error) {
      console.error("Naver map failed to initialize.", error);
      naverMap = null;
      naverMarkers = [];
      renderNaverLoadError();
    }
  }

  function markerContent(item) {
    const location = item.mapLocation;
    const isActive = selectedMediaSlug === item.slug;
    const isPackage = item.category === "package";
    return `
      <button type="button" class="naver-map-marker${isActive ? " is-active" : ""}${isPackage ? " is-package" : ""}" aria-label="${AdPlay.esc(item.name)}">
        <span>${markerLabel(item)}</span>
        <strong>${AdPlay.esc(location.sourceName || item.name)}</strong>
      </button>`;
  }

  function renderSelectedMedia(item, items) {
    if (!item) {
      selectedRoot.innerHTML = `<p class="empty">조건에 맞는 매체 위치가 없습니다.</p>`;
      return;
    }
    const location = item.mapLocation;
    selectedRoot.innerHTML = `
      <div class="map-selected-kicker">선택 매체</div>
      <h2>${AdPlay.esc(item.name)}</h2>
      <p>${AdPlay.esc(cardDescription(item))}</p>
      <div class="compact-metrics">
        ${metric("지도 표시", `${items.length.toLocaleString("ko-KR")}개`)}
        ${metric("좌표", `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`)}
      </div>
      <dl class="map-card-facts">
        ${fact("주소", location.sourceAddress || item.address)}
        ${fact("규격", location.size || sizeLabel(item))}
        ${fact("운영", location.operationHours || item.operationHours)}
        ${fact("조건", location.contract || AdPlay.priceLabel(item))}
      </dl>
      <div class="tag-list">${AdPlay.tagsHtml([item.areaName, AdPlay.categoryLabels[item.category] || item.mediaType, ...(location.isComposite ? ["복합 매체"] : [])])}</div>
      <div class="actions">
        <a class="button secondary" href="media-detail.html?slug=${encodeURIComponent(item.slug)}">상세보기</a>
        <a class="button" href="estimate.html?media=${encodeURIComponent(item.slug)}">견적 문의</a>
      </div>
    `;
  }

  function renderMedia(items) {
    listRoot.innerHTML = items.length
      ? items.map(mediaCard).join("")
      : `<div class="empty">조건에 맞는 매체 위치가 없습니다. 필터를 조정해 주세요.</div>`;

    listRoot.querySelectorAll("[data-map-media]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = currentItems.find((entry) => entry.slug === button.dataset.mapMedia);
        if (!item) return;
        selectedMediaSlug = item.slug;
        render({ preserveView: true });
        if (naverMap && window.naver && window.naver.maps) {
          naverMap.panTo(new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude));
        }
      });
    });
  }

  function mediaCard(item) {
    const location = item.mapLocation;
    const isActive = selectedMediaSlug === item.slug;
    return `
      <article class="map-media-card${isActive ? " is-active" : ""}">
        <button type="button" class="map-media-focus" data-map-media="${AdPlay.esc(item.slug)}" aria-label="${AdPlay.esc(item.name)} 지도에서 보기"></button>
        <a class="map-media-thumb" href="media-detail.html?slug=${encodeURIComponent(item.slug)}">
          <img src="${AdPlay.esc(location.photoUrl || AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지" loading="lazy" onerror="this.src='${AdPlay.esc(AdPlay.pageImage(item))}'">
        </a>
        <div>
          <div class="directory-meta">
            <span>${AdPlay.esc(item.areaName)}</span>
            <span>${AdPlay.esc(AdPlay.categoryLabels[item.category] || item.mediaType || "매체")}</span>
          </div>
          <h3><a href="media-detail.html?slug=${encodeURIComponent(item.slug)}">${AdPlay.esc(item.name)}</a></h3>
          <p>${AdPlay.esc(cardDescription(item))}</p>
          <dl class="map-card-mini">
            ${fact("위치", location.sourceAddress || item.address)}
            ${fact("규격", location.size || sizeLabel(item))}
          </dl>
          <strong class="price">${AdPlay.priceLabel(item)}</strong>
        </div>
      </article>`;
  }

  function selectedItem(items) {
    return items.find((item) => item.slug === selectedMediaSlug) || items[0] || null;
  }

  function hasLatLng(item) {
    return item.mapLocation && Number.isFinite(Number(item.mapLocation.latitude)) && Number.isFinite(Number(item.mapLocation.longitude));
  }

  function markerLabel(item) {
    if (item.category === "package") return "PKG";
    if (item.category === "bus") return "BUS";
    if (item.category === "subway") return "SUB";
    if (item.category === "daily_touchpoint") return "EV";
    return "AD";
  }

  function cardDescription(item) {
    const description = item.mapLocation && item.mapLocation.description;
    if (description && description.replace(/[.\s]/g, "").length === 0) {
      return item.locationDescription || item.address || "현장 설명 확인 필요";
    }
    if (description) return description.length > 120 ? `${description.slice(0, 120)}...` : description;
    return item.locationDescription || item.address || "현장 설명 확인 필요";
  }

  function sizeLabel(item) {
    if (item.widthM && item.heightM) return `${item.widthM}m x ${item.heightM}m`;
    return item.resolutionPx || "확인 필요";
  }

  function fact(label, value) {
    if (!value) return "";
    return `<dt>${AdPlay.esc(label)}</dt><dd>${AdPlay.esc(value)}</dd>`;
  }

  function metric(label, value) {
    return `<div><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
  }
});
