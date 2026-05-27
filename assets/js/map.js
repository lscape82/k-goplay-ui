document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-map");
  if (!root) return;

  const [areas, media] = await Promise.all([
    AdPlay.loadJson("data/areas.json"),
    AdPlay.loadJson("data/media.json"),
  ]);

  const areaFilter = document.querySelector("#mapAreaFilter");
  const categoryFilter = document.querySelector("#mapCategoryFilter");
  const stage = document.querySelector("#mapStage");
  const selectedRoot = document.querySelector("#mapSelectedArea");
  const listRoot = document.querySelector("#mapMediaList");
  const countRoot = document.querySelector("#mapResultCount");

  const areaPositions = {
    "gwanghwamun": { x: 47, y: 18, lat: 37.5759, lng: 126.9768 },
    "myeongdong-euljiro": { x: 54, y: 29, lat: 37.564, lng: 126.9827 },
    "seoul-station": { x: 43, y: 36, lat: 37.5547, lng: 126.9706 },
    "mapo": { x: 27, y: 40, lat: 37.5436, lng: 126.9512 },
    "hongdae": { x: 21, y: 34, lat: 37.5572, lng: 126.9245 },
    "yeouido": { x: 32, y: 55, lat: 37.5219, lng: 126.9246 },
    "seongsu": { x: 66, y: 47, lat: 37.5446, lng: 127.0559 },
    "dosan-daero": { x: 58, y: 60, lat: 37.5225, lng: 127.0365 },
    "samseong-coex": { x: 70, y: 65, lat: 37.5126, lng: 127.0588 },
    "gangnam-daero": { x: 58, y: 74, lat: 37.4979, lng: 127.0276 },
    "jamsil": { x: 82, y: 62, lat: 37.5133, lng: 127.1002 },
    "other-national": { x: 82, y: 82, lat: 37.5665, lng: 126.978 },
  };
  let naverMap = null;
  let naverMarkers = [];

  const areaStats = areas.map((area) => {
    const items = media.filter((item) => item.areaSlug === area.slug);
    return { area, items, position: areaPositions[area.slug] || { x: 50, y: 50 } };
  }).filter((entry) => entry.items.length > 0);

  let selectedSlug = new URLSearchParams(window.location.search).get("area") || "all";

  populateFilters();
  render();

  areaFilter.addEventListener("change", () => {
    selectedSlug = areaFilter.value;
    render();
  });
  categoryFilter.addEventListener("change", render);

  function populateFilters() {
    areaStats.forEach(({ area, items }) => {
      const option = document.createElement("option");
      option.value = area.slug;
      option.textContent = `${area.name} (${items.length})`;
      areaFilter.appendChild(option);
    });
    Object.entries(AdPlay.categoryLabels).forEach(([value, label]) => {
      if (value === "other") return;
      if (!media.some((item) => item.category === value)) return;
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      categoryFilter.appendChild(option);
    });
    if ([...areaFilter.options].some((option) => option.value === selectedSlug)) {
      areaFilter.value = selectedSlug;
    } else {
      selectedSlug = "all";
    }
  }

  function render() {
    const category = categoryFilter.value;
    const filteredAreaStats = areaStats.map((entry) => ({
      ...entry,
      filteredItems: entry.items.filter((item) => category === "all" || item.category === category),
    })).filter((entry) => entry.filteredItems.length > 0);

    const visibleStats = selectedSlug === "all"
      ? filteredAreaStats
      : filteredAreaStats.filter((entry) => entry.area.slug === selectedSlug);
    const visibleItems = visibleStats.flatMap((entry) => entry.filteredItems);
    const selectedEntry = selectedSlug === "all"
      ? topArea(filteredAreaStats)
      : filteredAreaStats.find((entry) => entry.area.slug === selectedSlug);

    countRoot.textContent = `${visibleItems.length.toLocaleString("ko-KR")}개 매체`;
    renderStage(filteredAreaStats);
    renderSelected(selectedEntry, visibleItems);
    renderMedia(visibleItems);
  }

  function renderStage(stats) {
    if (window.naver && window.naver.maps) {
      renderNaverMap(stats);
      return;
    }

    renderNaverLoadError();
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

  function renderNaverMap(stats) {
    try {
      stage.classList.add("has-naver-map");
      if (!naverMap) {
        stage.innerHTML = "";
        naverMap = new naver.maps.Map(stage, {
          center: new naver.maps.LatLng(37.5172, 127.0473),
          zoom: 12,
          minZoom: 9,
          mapTypeControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT,
          },
        });
      }

      naverMarkers.forEach((marker) => marker.setMap(null));
      naverMarkers = [];

      const bounds = new naver.maps.LatLngBounds();
      stats.forEach((entry) => {
        const { area, position } = entry;
        const latlng = new naver.maps.LatLng(position.lat, position.lng);
        bounds.extend(latlng);
        const marker = new naver.maps.Marker({
          map: naverMap,
          position: latlng,
          title: area.name,
          icon: {
            content: markerContent(entry),
            size: new naver.maps.Size(64, 64),
            anchor: new naver.maps.Point(32, 32),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => {
          selectedSlug = area.slug;
          areaFilter.value = selectedSlug;
          render();
          naverMap.panTo(latlng);
        });
        naverMarkers.push(marker);
      });

      if (stats.length > 1) {
        naverMap.fitBounds(bounds, { top: 72, right: 72, bottom: 72, left: 72 });
      } else if (stats.length === 1) {
        naverMap.setCenter(new naver.maps.LatLng(stats[0].position.lat, stats[0].position.lng));
        naverMap.setZoom(14);
      }
    } catch (error) {
      console.error("Naver map failed to initialize.", error);
      naverMap = null;
      naverMarkers = [];
      renderNaverLoadError();
    }
  }

  function markerContent(entry) {
    const isActive = selectedSlug === entry.area.slug;
    const isFeatured = AdPlay.config.featuredAreaSlugs.includes(entry.area.slug);
    return `
      <button type="button" class="naver-map-marker${isActive ? " is-active" : ""}${isFeatured ? " is-featured" : ""}" aria-label="${AdPlay.esc(entry.area.name)}">
        <span>${entry.filteredItems.length}</span>
        <strong>${AdPlay.esc(entry.area.name)}</strong>
      </button>`;
  }

  function markerHtml(entry, maxCount) {
    const { area, filteredItems, position } = entry;
    const isActive = selectedSlug === area.slug;
    const isFeatured = AdPlay.config.featuredAreaSlugs.includes(area.slug);
    const size = 38 + Math.round((filteredItems.length / maxCount) * 28);
    return `
      <button type="button" class="map-marker${isActive ? " is-active" : ""}${isFeatured ? " is-featured" : ""}"
        data-area-slug="${AdPlay.esc(area.slug)}"
        style="left:${position.x}%; top:${position.y}%; --marker-size:${size}px;"
        aria-label="${AdPlay.esc(area.name)} 매체 ${filteredItems.length}개 보기">
        <span>${filteredItems.length}</span>
        <strong>${AdPlay.esc(area.name)}</strong>
      </button>`;
  }

  function renderSelected(entry, visibleItems) {
    if (!entry) {
      selectedRoot.innerHTML = `<p class="empty">조건에 맞는 지역이 없습니다.</p>`;
      return;
    }
    const area = entry.area;
    const count = selectedSlug === "all" ? visibleItems.length : entry.filteredItems.length;
    selectedRoot.innerHTML = `
      <div class="map-selected-kicker">${selectedSlug === "all" ? "전체 권역 요약" : "선택 권역"}</div>
      <h2>${selectedSlug === "all" ? "서울 주요 DOOH 권역" : AdPlay.esc(area.name)}</h2>
      <p>${AdPlay.esc(selectedSlug === "all" ? "핀 크기는 등록 매체 수를 기준으로 표시됩니다. 프리미엄 권역은 강조 색상으로 표시했습니다." : area.summary)}</p>
      <div class="compact-metrics">
        ${metric("표시 매체", `${count.toLocaleString("ko-KR")}개`)}
        ${metric("일 유동", selectedSlug === "all" ? "권역별 확인" : `${AdPlay.formatNumber(area.dailyFootTraffic)}명`)}
      </div>
      <div class="tag-list">${AdPlay.tagsHtml(selectedSlug === "all" ? ["대형 전광판", "패키지", "상권 비교"] : area.recommendedIndustries)}</div>
      <div class="actions">
        <a class="button secondary" href="${selectedSlug === "all" ? "areas.html" : `area-detail.html?slug=${encodeURIComponent(area.slug)}`}">지역 상세</a>
        <a class="button" href="${selectedSlug === "all" ? "media.html" : `media.html?area=${encodeURIComponent(area.slug)}`}">매체 보기</a>
      </div>
    `;
  }

  function renderMedia(items) {
    const topItems = [...items]
      .sort((a, b) => (AdPlay.minMonthlyPrice(a) || Number.MAX_SAFE_INTEGER) - (AdPlay.minMonthlyPrice(b) || Number.MAX_SAFE_INTEGER))
      .slice(0, 8);
    listRoot.innerHTML = topItems.length
      ? topItems.map(mediaCard).join("")
      : `<div class="empty">조건에 맞는 매체가 없습니다. 필터를 조정해 주세요.</div>`;
  }

  function mediaCard(item) {
    return `
      <article class="map-media-card">
        <a class="map-media-thumb" href="media-detail.html?slug=${encodeURIComponent(item.slug)}">
          <img src="${AdPlay.esc(AdPlay.pageImage(item))}" alt="${AdPlay.esc(item.name)} 현장 이미지" loading="lazy" onerror="this.src='${AdPlay.esc(AdPlay.config.placeholderImage)}'">
        </a>
        <div>
          <div class="directory-meta">
            <span>${AdPlay.esc(item.areaName)}</span>
            <span>${AdPlay.esc(AdPlay.categoryLabels[item.category] || item.mediaType || "매체")}</span>
          </div>
          <h3><a href="media-detail.html?slug=${encodeURIComponent(item.slug)}">${AdPlay.esc(item.name)}</a></h3>
          <p>${AdPlay.esc(item.address || "주소 확인 필요")}</p>
          <strong class="price">${AdPlay.priceLabel(item)}</strong>
        </div>
      </article>`;
  }

  function topArea(stats) {
    return [...stats].sort((a, b) => b.filteredItems.length - a.filteredItems.length)[0];
  }

  function metric(label, value) {
    return `<div><span>${AdPlay.esc(label)}</span><strong>${AdPlay.esc(value)}</strong></div>`;
  }
});
