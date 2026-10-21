document.addEventListener("DOMContentLoaded", async () => {
  const root = document.querySelector("#media-map");
  if (!root) return;

  const [media, locations, areas, busStops, busStopPositionOverrides, elevatorData, elevatorSitesData] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/media_locations.json"),
    AdPlay.loadJson("data/areas.json"),
    AdPlay.loadJson("data/bus_stops.json"),
    AdPlay.loadJson("data/bus_stop_position_overrides.json"),
    AdPlay.loadJson("data/elevator-networks.json").catch(() => ({ networks: [] })),
    AdPlay.loadJson("data/elevator-sites.json").catch(() => ({})),
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
  const favBar = document.querySelector("#mapFavBar");
  const favCountEl = document.querySelector("#mapFavCount");
  const favPanel = document.querySelector("#mapFavPanel");
  const favPanelCount = document.querySelector("#mapFavPanelCount");
  const favListEl = document.querySelector("#mapFavList");
  const favTotalEl = document.querySelector("#mapFavTotal");
  const favCta = document.querySelector("#mapFavCta");
  const favDownload = document.querySelector("#mapFavDownload");
  const favShare = document.querySelector("#mapFavShare");
  const favPdf = document.querySelector("#mapFavPdf");
  const favReco = document.querySelector("#mapFavReco");
  const favMix = document.querySelector("#mapFavMix");
  const favClose = document.querySelector("#mapFavClose");
  const mobileLayoutQuery = window.matchMedia("(max-width: 700px)");

  const FAVORITES_KEY = "goplay:favorites";
  let favorites = (() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); } catch (error) { return []; }
  })();

  // 공유 지도링크(?cart=slug,slug,…)로 들어오면 그 매체를 관심매체에 합쳐 비교 패널로 바로 보여준다.
  const SHARED_CART = (new URLSearchParams(window.location.search).get("cart") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (SHARED_CART.length) {
    SHARED_CART.forEach((slug) => { if (!favorites.includes(slug)) favorites.push(slug); });
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch (error) { /* ignore */ }
  }

  function saveFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch (error) { /* ignore */ }
  }
  function isFavorite(slug) {
    return favorites.includes(slug);
  }
  // 비교표에서 '상담 대상' 체크를 해제한 관심매체 id 집합.
  // 비파괴적 제외 — 매체는 표에 남고(흐려짐), 월 합계·상담신청에서만 빠진다. 다시 체크하면 복귀.
  const favExcluded = new Set();
  function toggleFavorite(slug) {
    const index = favorites.indexOf(slug);
    if (index >= 0) { favorites.splice(index, 1); favExcluded.delete(slug); } // 완전 삭제 시 제외 상태도 정리
    else favorites.push(slug);
    saveFavorites();
    updateFavoritesUI();
    if (favPanel && !favPanel.hidden) renderFavPanel();
  }
  function topScoreLabel(insight) {
    const scores = (insight && insight.scores) || [];
    if (!scores.length) return "-";
    const top = scores.slice().sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    return top ? `${top.label} ★${top.value}` : "-";
  }
  // 비고(지역) — 주소의 '구'를 우선, 없으면 매체명/상권으로 폴백
  function regionLabel(item) {
    const addr = item.address || (item.mapLocation && item.mapLocation.sourceAddress) || "";
    const m = addr.match(/([가-힣]{1,3})구(?![가-힣])/);
    if (m) return m[1].length >= 2 ? m[1] : m[1] + "구";
    const text = (item.name || "") + " " + addr;
    if (/서울역|KTX/i.test(text)) return "서울역";
    if (/전국|수도권|지방|생활권/i.test(text)) return "전국";
    return (item.areaName || "-").split(/[\s·/]/)[0];
  }
  // 1일 송출(초수·횟수) — media.json playSpec 우선, 없으면 유형별 기본값
  function playSpecLabel(item) {
    if (item.playSpec) return item.playSpec;
    const t = (item.category || "") + " " + (item.mediaType || "");
    if (/지하철|subway/i.test(t)) return "1일 다회 롤링";
    if (/버스|bus/i.test(t)) return "1일 다회 롤링";
    if (/엘리베이터|elevator|생활/i.test(t)) return "10초 · 상시 롤링";
    if (/DID|쇼핑|9to9/i.test(t)) return "상시 롤링";
    return "20초 · 1일 100회";
  }
  // 비용 표기 "월 1,200만원" → "1,200만원/월"
  function perMonthPrice(label) {
    return /만원$/.test(label || "") ? String(label).replace(/^월\s*/, "") + "/월" : (label || "-");
  }
  // 승하차 등 "856.1만명" → "856만명" (소수점 제거, 만명 단위 통일)
  function roundMan(label) {
    return String(label == null ? "-" : label).replace(/\.\d+(?=\s*만)/, "");
  }
  // "7.9만명"·"856.1만명"·"8.6만대" → 79000 / 8561000 / 86000 (원단위 숫자)
  // 비교표·엑셀에서 계산·편집이 가능하도록 축약 표기를 실제 수치로 되돌린다. 값이 없으면 null.
  function parseManNumber(label) {
    const s = String(label == null ? "" : label).trim();
    if (!s || s === "-") return null;
    const m = s.match(/([\d,]+(?:\.\d+)?)\s*(억|만)?/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(n)) return null;
    const mult = m[2] === "억" ? 100000000 : m[2] === "만" ? 10000 : 1;
    return Math.round(n * mult);
  }
  // 숫자 → "12,000,000" (표에 그대로 노출). 없으면 "-"
  function numCell(n) {
    return n == null ? "-" : Number(n).toLocaleString("ko-KR");
  }
  // 유형 — 카테고리 제목 기반, '광고'·'대형' 등 수식 제거(전광판/지하철/버스…)
  function typeLabel(item) {
    const map = { large_billboard: "전광판", shopping_mall_did: "쇼핑몰 DID", subway: "지하철", bus: "버스", transport_hub: "철도·터미널", daily_touchpoint: "생활밀착형", package: "패키지", other: "기타" };
    if (map[item.category]) return map[item.category];
    return (AdPlay.categoryLabels[item.category] || item.mediaType || "-").replace(/\s*광고$/, "").replace(/^대형\s*/, "");
  }
  function itemsForSlugs(list) {
    return (list || []).map((favId) => {
      if (typeof favId === "string" && favId.indexOf("bus:") === 0) {
        const stop = (busStops || []).find((s) => String(s.id) === favId.slice(4));
        if (!stop) return null;
        const p = stop.adProduct || {};
        return {
          favId,
          name: p.stationName || stop.name,
          image: null,
          price: p.monthlyCostLabel || formatBusWon(p.minMonthlyCost) || "비용 문의",
          priceMonthly: perMonthPrice(p.monthlyCostLabel || formatBusWon(p.minMonthlyCost) || "비용 문의"),
          monthly: Number(p.minMonthlyCost) || 0,
          size: p.outerSize || p.innerSize || "-",
          resolution: "-",
          area: [p.district, p.dong].filter(Boolean).join(" ") || "-",
          type: "버스 정류장",
          reach: p.ridershipLabel || "-",
          target: "-",
          topSpot: "-",
          region: (p.district || "").replace(/구$/, "") || "-",
          playSpec: "1일 다회 롤링",
          address: [p.district, p.dong, p.stationName].filter(Boolean).join(" ") || "-",
          audience: "-",
          operationHours: p.operationHours || "-",
          foot500: "-",
          subway: "-",
          bus: roundMan(p.ridershipLabel || "-"),
          // 비교표·엑셀용 원단위 숫자(축약 표기 파싱 전 원본 기준)
          foot500Num: null,
          subwayNum: null,
          busNum: parseManNumber(p.ridershipLabel),
          note: "-",
          isBus: true,
        };
      }
      if (/^(townboard|fmk|gsa|officebiz|primeliving|asa)-\d+$/.test(favId)) {
        return elevatorFavItem(favId);
      }
      const item = mediaWithLocations.find((m) => m.slug === favId);
      if (!item) return null;
      const insight = locationInsight(item);
      return {
        favId,
        name: item.name,
        image: cardImages(item)[0],
        price: mapCardPriceLabel(item),
        priceMonthly: perMonthPrice(mapCardPriceLabel(item)),
        monthly: AdPlay.minMonthlyPrice(item) || 0,
        shortTerm: shortTermMin(item), // {1,3,7,15}→원 or null — 플래너 단기 집행 금액
        category: item.category || "", // 플래너 가중(업종 적합도)·매체유형 판정용
        size: sizeLabel(item),
        resolution: (item.mapLocation && item.mapLocation.resolution) || item.resolutionPx || "확인 필요",
        area: item.areaName || "-",
        type: typeLabel(item),
        reach: (cardReachLabel(item) || "").replace("일 유동인구 ", "") || "-",
        target: (insight.stats && insight.stats.target) || "-",
        topSpot: topScoreLabel(insight),
        region: regionLabel(item),
        playSpec: playSpecLabel(item),
        address: item.address || "",
        audience: detailAudience(item) || "-",
        operationHours: (item.mapLocation && item.mapLocation.operationHours) || item.operationHours || "-",
        foot500: (insight.stats && insight.stats.daily500) || "-",
        subway: roundMan((insight.stats && insight.stats.subway) || "-"),
        bus: roundMan((insight.stats && insight.stats.bus) || "-"),
        // 비교표·엑셀용 원단위 숫자 — roundMan 은 소수점을 버리므로 반드시 원본 stats 를 파싱한다
        foot500Num: parseManNumber(insight.stats && insight.stats.daily500),
        subwayNum: parseManNumber(insight.stats && insight.stats.subway),
        busNum: parseManNumber(insight.stats && insight.stats.bus),
        note: item.note || "-",
        isBus: false,
      };
    }).filter(Boolean);
  }
  function favoriteItems() { return itemsForSlugs(favorites); }
  // 관심 도크/비교 패널용 — 엘리베이터 사이트(id: townboard-0 형식)를 매체 항목 형태로 변환
  function elevatorFavItem(favId) {
    const netId = favId.replace(/-\d+$/, "");
    const arr = elevatorSites[netId];
    if (!arr) return null;
    const site = arr.find((s) => s.id === favId);
    if (!site) return null;
    const net = elevatorNetworks.find((n) => n.id === netId) || {};
    const isPackage = net.saleUnit === "package";
    const period = ELEV_PRICE_PERIOD[netId] || "월";
    const monthly = isPackage ? 0 : (site.monthlyCost || 0);
    const priceLabel = isPackage ? `${site.district ? site.district + " " : ""}패키지` : (monthly ? `${period} ${monthly.toLocaleString("ko-KR")}원` : "가격 상담");
    return {
      favId,
      name: String(site.name).replace(/_[LS]$/, ""),
      image: null,
      price: priceLabel,
      priceMonthly: monthly || null,
      monthly,
      size: site.monitorSize || "-",
      resolution: "-",
      area: [site.sido, site.district].filter(Boolean).join(" ") || "-",
      type: `${net.vendor || "매체사"} · ${net.type === "apartment" ? "아파트" : "오피스"} 엘리베이터`,
      reach: site.households ? `${site.households.toLocaleString("ko-KR")}세대` : "-",
      target: net.target || "-",
      topSpot: "-",
      region: site.sido || "-",
      playSpec: ELEV_BROADCAST[netId] || "1일 롤링",
      address: site.address || "-",
      audience: "-",
      operationHours: "-",
      foot500: "-", subway: "-", bus: "-",
      foot500Num: null, subwayNum: null, busNum: null,
      note: isPackage ? "패키지 전용" : "-",
      isBus: false,
      isElevator: true,
    };
  }
  function favStarButton(favId, name, variant) {
    const on = activeHas(favId);
    const label = "관심";
    return `<button type="button" class="${variant}${on ? " is-active" : ""}" data-fav-toggle="${AdPlay.esc(favId)}" aria-pressed="${on}" aria-label="${AdPlay.esc(name)} 관심매체 ${on ? "제거" : "담기"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg><span>${label}</span></button>`;
  }

  function favHeartButton(item, variant) {
    return favStarButton(item.slug, item.name, variant);
  }
  function updateFavoritesUI() {
    const count = favorites.length;
    document.querySelectorAll("[data-fav-trigger]").forEach((el) => { el.hidden = count === 0; });
    document.querySelectorAll("[data-fav-count]").forEach((el) => { el.textContent = String(count); });
    document.querySelectorAll(".gps-svc .bn[data-fav-count]").forEach((el) => { el.hidden = count === 0; });
    document.querySelectorAll("[data-fav-toggle]").forEach((button) => {
      const on = activeHas(button.dataset.favToggle);
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    });
  }
  // 관심매체 비교표를 광역시도 › 구 단위로 묶어 순서대로 보여주기 위한 지역 파싱/정렬.
  const FAV_SIDO_ABBR = { "서울특별시":"서울","서울":"서울","부산광역시":"부산","부산":"부산","대구광역시":"대구","대구":"대구","인천광역시":"인천","인천":"인천","광주광역시":"광주","광주":"광주","대전광역시":"대전","대전":"대전","울산광역시":"울산","울산":"울산","세종특별자치시":"세종","세종":"세종","경기도":"경기","경기":"경기","강원특별자치도":"강원","강원도":"강원","강원":"강원","충청북도":"충북","충북":"충북","충청남도":"충남","충남":"충남","전라북도":"전북","전북특별자치도":"전북","전북":"전북","전라남도":"전남","전남":"전남","경상북도":"경북","경북":"경북","경상남도":"경남","경남":"경남","제주특별자치도":"제주","제주":"제주" };
  const FAV_SIDO_ORDER = ["서울","경기","인천","부산","대구","광주","대전","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"];
  function favRegionLabel(fav) {
    const bad = (s) => !s || /^(null|undefined|-)$/i.test(String(s).trim());
    const addr = (fav.address || "").replace(/\s+/g, " ").trim();
    // 주소가 비었거나 "NULL"·"-"(네트워크/패키지 매체 등) → 상권(area)으로, 그것도 없으면 '기타'
    if (bad(addr)) return bad(fav.area) ? "기타" : fav.area;
    const toks = addr.split(" ");
    const sido = FAV_SIDO_ABBR[toks[0]] || toks[0] || "";
    let district = "";
    for (let i = 1; i < toks.length; i += 1) {
      if (/(구|군)$/.test(toks[i])) { district = toks[i]; break; }
      if (/시$/.test(toks[i]) && !district) district = toks[i];
    }
    return [sido, district].filter(Boolean).join(" ") || "기타";
  }
  function favRegionSortKey(label) {
    const sido = (label || "").split(" ")[0];
    const idx = FAV_SIDO_ORDER.indexOf(sido);
    return String(idx < 0 ? 99 : idx).padStart(2, "0") + "_" + label;
  }
  // ⑨ 매체 노출력 등급·키워드 배지 — 플래너/관심매체 리스트·매체 상세 공용.
  //  원본 매체(mediaWithLocations)를 slug로 찾아 유형 내 상대등급까지 산출(1회 캐시).
  let _mgRelMap = null;
  function mgRelMap() {
    if (_mgRelMap) return _mgRelMap;
    _mgRelMap = {};
    try {
      if (window.MediaGrade && window.MediaGrade.assignRelativeGrades && typeof mediaWithLocations !== "undefined" && mediaWithLocations) {
        window.MediaGrade.assignRelativeGrades(mediaWithLocations, { within: true }).forEach((s) => { _mgRelMap[s.item.slug] = s.g; });
      }
    } catch (e) {}
    return _mgRelMap;
  }
  function gradeForFav(fav) {
    if (!window.MediaGrade || !fav) return null;
    const rm = mgRelMap();
    if (rm[fav.favId]) return rm[fav.favId];
    try {
      const src = (typeof mediaWithLocations !== "undefined" && mediaWithLocations) ? mediaWithLocations.find((m) => m.slug === fav.favId) : null;
      return window.MediaGrade.gradeMedia(src || { name: fav.name, category: fav.category, sizeText: fav.size, resolutionPx: fav.resolution, mediaType: fav.type, address: fav.address, areaName: fav.area });
    } catch (e) { return null; }
  }
  // 배지 칩 HTML — 등급 + 3계열(스펙/노출성격/타깃). compact=true면 타깃만 생략 없이 상위 일부만.
  function gradeBadgesHtml(g, opt) {
    if (!g) return "";
    opt = opt || {};
    const chip = (cls, txt) => `<span class="mg-badge ${cls}">${AdPlay.esc(txt)}</span>`;
    let html = "";
    // 물리/노출 게이지는 비슷한 매체끼리 뭉개져(●●●●○ 동일) 변별력이 없어 제거.
    //  → 차별화는 아래 단어 배지(스펙·노출성격·타깃)로만 표현.
    (g.physBadges || []).forEach((b) => { html += chip("mg-spec", b); });
    (g.ctxBadges || []).forEach((b) => { html += chip("mg-ctx", b); });
    (g.audienceBadges || []).forEach((b) => { html += chip("mg-aud", b); });
    return html ? `<span class="map-fav-media-grades">${html}</span>` : "";
  }

  // 관심매체 비교 표(썸네일·규격·유형·보장횟수·비용… 지역그룹)를 생성 — 관심매체(②)와 AI 플래너(①)가 공용으로 재사용.
  // 체크/삭제 data 속성과 전체선택 클래스를 opts 로 분기해 두 메뉴가 서로 간섭하지 않게 한다.
  function favCompareTableHtml(items, opts) {
    opts = opts || {};
    const allClass = opts.allClass || "map-fav-incl-all";
    const inclAttr = opts.inclAttr || "data-fav-incl";
    const rmAttr = opts.rmAttr || "data-fav-remove";
    const excluded = opts.excluded || favExcluded;
    const compareRows = [
      { label: "유형", value: (fav) => fav.type },
      { label: "규격", value: (fav) => fav.size },
      { label: "해상도", value: (fav) => (fav.resolution && /\d\s*[x×]\s*\d/.test(fav.resolution)) ? fav.resolution + "px" : (fav.resolution || "-") },
      { label: "1일 보장횟수", className: "is-playspec", html: true, value: (fav) => AdPlay.esc(fav.playSpec).replace(/\s*·\s*/g, "<br>") },
      { label: "비용(원/월, 부가세 별도)", className: "is-price", value: (fav) => numCell(fav.monthly || null) },
      { label: "운영시간", value: (fav) => fav.operationHours },
      { label: "일평균 유동(명)", className: "is-numl", value: (fav) => numCell(fav.foot500Num) },
      { label: "지하철 승하차(월평균, 명)", className: "is-numl", value: (fav) => numCell(fav.subwayNum) },
      { label: "버스 승하차(월평균, 명)", className: "is-numl", value: (fav) => numCell(fav.busNum) },
      { label: "주 방문층", className: "is-audience", value: (fav) => fav.audience },
      { label: "비고", value: (fav) => fav.note },
    ];
    const thumb = (fav) => fav.image
      ? `<img src="${AdPlay.esc(fav.image)}" alt="" loading="lazy">`
      : `<span class="map-fav-busimg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M4 16h16M4 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M20 16v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2M6 8h12M7 12h.01M17 12h.01"/></svg></span>`;
    const rowHtml = (fav) => `
              <tr class="${excluded.has(fav.favId) ? "is-excluded" : ""}">
                <td class="map-fav-no-cell"><input type="checkbox" class="map-fav-incl" ${inclAttr}="${AdPlay.esc(fav.favId)}"${excluded.has(fav.favId) ? "" : " checked"} aria-label="${AdPlay.esc(fav.name)} 상담 대상 포함"></td>
                <th class="map-fav-rowhead"><span class="map-fav-media-cell">${thumb(fav)}<span class="map-fav-media-info"><b>${AdPlay.esc(fav.name)}</b><span class="map-fav-media-addr">${AdPlay.esc(fav.address)}</span><span class="map-fav-media-tags"></span>${gradeBadgesHtml(gradeForFav(fav))}</span></span></th>
                ${compareRows.map((row) => `<td class="${row.className || ""}">${row.html ? row.value(fav) : AdPlay.esc(row.value(fav))}</td>`).join("")}
              </tr>`;
    const tagged = items.map((fav) => ({ fav, region: favRegionLabel(fav) }));
    tagged.sort((a, b) => favRegionSortKey(a.region).localeCompare(favRegionSortKey(b.region), "ko"));
    const counts = {};
    tagged.forEach((t) => { counts[t.region] = (counts[t.region] || 0) + 1; });
    let out = "";
    let last = null;
    tagged.forEach((t) => {
      if (t.region !== last) {
        out += `<tr class="map-fav-group"><td colspan="13"><span class="map-fav-group-pin" aria-hidden="true">●</span>${AdPlay.esc(t.region)}<em>${counts[t.region]}개</em></td></tr>`;
        last = t.region;
      }
      out += rowHtml(t.fav);
    });
    return `
      <div class="map-fav-compare map-fav-compare--rows">
        <table>
          <thead>
            <tr>
              <th class="map-fav-no-h"><label class="map-fav-selall-h"><input type="checkbox" class="${allClass}" aria-label="전체 선택/해제" title="전체 선택/해제"><span>전체선택</span></label></th>
              <th class="map-fav-compare-corner">매체</th>
              ${compareRows.map((row) => `<th class="${row.className || ""}">${AdPlay.esc(row.label)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${out}</tbody>
        </table>
      </div>`;
  }
  function renderFavPanel() {
    const items = favoriteItems();
    if (favPanelCount) favPanelCount.textContent = String(items.length);
    if (!favListEl) return;
    if (!items.length) {
      favListEl.innerHTML = `<p class="map-fav-empty">아직 담은 관심매체가 없습니다.<br>매체·버스정류장의 "★ 관심" 버튼으로 담아 비교해 보세요.</p>`;
      if (favTotalEl) favTotalEl.textContent = "-";
      if (favCta) { favCta.setAttribute("aria-disabled", "true"); favCta.removeAttribute("href"); }
      if (favReco) favReco.hidden = true;
      return;
    }
    favListEl.innerHTML = favCompareTableHtml(items, { allClass: "map-fav-incl-all", inclAttr: "data-fav-incl", rmAttr: "data-fav-remove", excluded: favExcluded });
    recalcFavConsult();
    syncFavAllCheckbox();
    if (favReco) {
      const reco = favRecommendation(items);
      favReco.innerHTML = reco ? `<strong>추<br>천</strong><span class="map-fav-reco-body">${AdPlay.esc(reco)}</span>` : "";
      favReco.hidden = !reco;
    }
    fitFavTitles();
  }
  // 헤더 '전체선택' 체크박스 상태 = 모두 체크(true) / 일부만(indeterminate) / 모두 해제(false)
  function syncFavAllCheckbox() {
    const all = document.querySelector(".map-fav-incl-all");
    if (!all) return;
    const boxes = [].slice.call(document.querySelectorAll("[data-fav-incl]"));
    const checked = boxes.filter((b) => b.checked).length;
    all.checked = boxes.length > 0 && checked === boxes.length;
    all.indeterminate = checked > 0 && checked < boxes.length;
  }
  // 상담 대상(체크된 매체)만으로 월 합계·상담 링크·CTA 라벨을 갱신. 체크박스 토글 시 표 전체를 다시 그리지 않고
  // 이것만 호출해 가로 스크롤 위치를 지킨다. renderFavPanel 초기 렌더에서도 재사용.
  // 미디어믹스 — 상담 대상(체크된) 매체의 유형별 예산 비중 막대. 금액 정보가 없으면 매체 수 비중으로 폴백.
  const FAV_TYPE_COLORS = { "전광판": "#2540ea", "빌보드": "#2540ea", "엘리베이터": "#2f8fd0", "버스": "#6b57d6", "버스쉘터": "#6b57d6", "지하철": "#0c9a84", "공항": "#128a9c", "철도": "#128a9c", "쇼핑몰": "#8a5cf0", "쇼핑몰 DID": "#8a5cf0", "편의점": "#3a86b5", "차량": "#5b7cc2" };
  const FAV_MIX_PALETTE = ["#2540ea", "#2f8fd0", "#6b57d6", "#0c9a84", "#8a5cf0", "#128a9c", "#5b7cc2"];
  function favTypeColor(type, i) { return FAV_TYPE_COLORS[type] || FAV_MIX_PALETTE[i % FAV_MIX_PALETTE.length]; }
  function favMixHtml(entries, total, isCount) {
    const bar = entries.map((e, i) => `<span style="width:${(e.v / total * 100).toFixed(2)}%;background:${favTypeColor(e.t, i)}"></span>`).join("");
    const leg = entries.map((e, i) => `<span class="map-fav-mix-item"><i style="background:${favTypeColor(e.t, i)}"></i>${AdPlay.esc(e.t)} <b>${Math.round(e.v / total * 100)}%</b>${isCount ? "" : " · " + AdPlay.formatKRW(e.v)}</span>`).join("");
    return `<div class="map-fav-mix-head">매체 유형별 ${isCount ? "매체 수" : "예산"} 비중</div><div class="map-fav-mix-bar">${bar}</div><div class="map-fav-mix-leg">${leg}</div>`;
  }
  function renderFavMix(included) {
    if (!favMix) return;
    if (!included || !included.length) { favMix.hidden = true; favMix.innerHTML = ""; return; }
    const toEntries = (map) => Object.keys(map).map((t) => ({ t, v: map[t] })).sort((a, b) => b.v - a.v);
    const byCost = {};
    included.forEach((f) => { const t = f.type || "기타"; byCost[t] = (byCost[t] || 0) + (f.monthly || 0); });
    const totalCost = included.reduce((s, f) => s + (f.monthly || 0), 0);
    favMix.hidden = false;
    if (totalCost > 0) {
      favMix.innerHTML = favMixHtml(toEntries(byCost), totalCost, false);
    } else {
      const byCount = {};
      included.forEach((f) => { const t = f.type || "기타"; byCount[t] = (byCount[t] || 0) + 1; });
      favMix.innerHTML = favMixHtml(toEntries(byCount), included.length, true);
    }
  }
  function recalcFavConsult() {
    const items = favoriteItems();
    const included = items.filter((fav) => !favExcluded.has(fav.favId));
    const total = included.reduce((sum, fav) => sum + (fav.monthly || 0), 0);
    // 제목 옆 숫자 = 상담 대상(체크된) 수 — CTA·합계와 같은 기준. 제외하면 함께 줄어든다.
    if (favPanelCount) favPanelCount.textContent = String(included.length);
    if (favTotalEl) favTotalEl.textContent = included.length ? (total ? `월 ${AdPlay.formatKRW(total)}~` : "상담 필요") : "-";
    if (favCta) {
      const label = favCta.querySelector("span");
      if (included.length) {
        favCta.setAttribute("href", `estimate.html?intent=bundle&media=${included.map((fav) => encodeURIComponent(fav.favId)).join(",")}`);
        favCta.removeAttribute("aria-disabled");
        if (label) label.textContent = `${included.length}개 매체로 상담신청`;
      } else {
        favCta.setAttribute("aria-disabled", "true");
        favCta.removeAttribute("href");
        if (label) label.textContent = "상담 대상을 선택하세요";
      }
    }
    renderFavMix(included);
  }
  // 담은 매체 기준 자동 추천 요약 — 도달(일평균 유동) 최고 · 비용 효율(월 비용) 최저 매체를 짚고 묶음 제안
  function favRecommendation(items) {
    if (!items || items.length < 2) return "";
    const num = (s) => { const m = String(s == null ? "" : s).match(/[\d.]+/); return m ? parseFloat(m[0]) : NaN; };
    const reachList = items.filter((f) => !isNaN(num(f.foot500)));
    const costList = items.filter((f) => f.monthly > 0);
    const bestReach = reachList.length ? reachList.slice().sort((a, b) => num(b.foot500) - num(a.foot500))[0] : null;
    const cheapest = costList.length ? costList.slice().sort((a, b) => a.monthly - b.monthly)[0] : null;
    let lead;
    if (bestReach && cheapest && bestReach.favId === cheapest.favId) lead = `‘${bestReach.name}’가 도달·비용 모두 우세합니다.`;
    else if (bestReach && cheapest) lead = `도달은 ‘${bestReach.name}’, 비용 효율은 ‘${cheapest.name}’가 우세합니다.`;
    else if (bestReach) lead = `도달은 ‘${bestReach.name}’가 우세합니다.`;
    else if (cheapest) lead = `비용 효율은 ‘${cheapest.name}’가 우세합니다.`;
    else return "";
    return `${lead} 담은 ${items.length}종을 묶으면 도달·비용 균형과 집행 협상력을 함께 높일 수 있습니다.`;
  }
  // 매체명 한 줄 넘어가면 폰트 자동 축소(줄바꿈 방지)
  function fitFavTitles() {
    if (!favListEl) return;
    favListEl.querySelectorAll(".map-fav-media-info b").forEach((el) => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      let guard = 0;
      while (el.scrollWidth > el.clientWidth + 1 && size > 9.5 && guard < 24) {
        size -= 0.5;
        el.style.fontSize = size + "px";
        guard++;
      }
    });
  }
  // 화면 표와 같은 열 순서·단위 표기를 유지. headers 와 rows 는 짝이 맞아야 함.
  // 수치는 문자열이 아니라 '숫자'로 내보내야 엑셀에서 정렬·합계·편집이 된다(빈 값은 "-" 대신 null).
  // 주소 앞머리의 시·도를 짧은 이름으로. 엑셀에서 큰 단위(서울/부산…)로 먼저 묶어 보기 위함.
  function sidoShort(addr) {
    const first = String(addr || "").trim().split(/\s+/)[0] || "";
    const table = {
      "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
      "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
      "경기도": "경기", "강원특별자치도": "강원", "강원도": "강원",
      "충청북도": "충북", "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북",
      "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주", "제주도": "제주",
    };
    if (table[first]) return table[first];
    for (const k in table) if (first.indexOf(k.slice(0, 2)) === 0) return table[k]; // 표기 변형 폴백
    return "";
  }
  // 지역 = 시/도(서울·부산·대구…)만. 구/군은 넣지 않는다(주소 칸에 이미 들어감).
  const FAV_EXPORT_HEADERS = ["지역", "매체명", "주소", "규격", "해상도(px)", "유형", "1일 보장횟수", "비용(원/월, 부가세 별도)", "운영시간", "일평균 유동(명)", "지하철 승하차(월평균, 명)", "버스 승하차(월평균, 명)", "주 방문층", "비고"];
  const favExportRow = (f) => [sidoShort(f.address), f.name, f.address, f.size, f.resolution, f.type, f.playSpec,
    f.monthly || null, f.operationHours, f.foot500Num, f.subwayNum, f.busNum, f.audience, f.note];
  const FAV_NUMERIC_COLS = [7, 9, 10, 11]; // 비용·일평균 유동·지하철·버스 (0-based)

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // xlsx 는 ZIP+XML 구조라 직접 만들면 파일이 깨지기 쉬움 → 검증된 SheetJS 를
  // '다운로드를 누른 시점'에만 지연 로드(평소 페이지 로딩에 부담 주지 않음).
  function loadXlsxLib() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX 로드 실패")));
      s.onerror = () => reject(new Error("XLSX 스크립트 요청 실패"));
      document.head.appendChild(s);
    });
  }

  // ExcelJS — 셀 서식(색·테두리·숫자서식)이 되는 라이브러리. 제안서급 '갖춘 서식' 엑셀용. 지연 로드.
  function loadExcelJS() {
    if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
      s.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error("ExcelJS 로드 실패")));
      s.onerror = () => reject(new Error("ExcelJS 스크립트 요청 실패"));
      document.head.appendChild(s);
    });
  }

  function downloadFavCsvFallback(items) {
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const csv = "﻿" + [FAV_EXPORT_HEADERS].concat(items.map(favExportRow))
      .map((r) => r.map(esc).join(",")).join("\r\n");
    saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "관심매체_비교.csv");
  }

  // 한장제안서: 선택한 매체를 one-pager.html 로 넘겨 A4 가로 1장씩 렌더 → 브라우저 인쇄로 PDF 저장.
  // 버스정류장(bus:###)은 media.json 에 없어 한장제안서를 만들 수 없으므로 제외한다.
  function openFavOnePager() {
    // 상담 대상으로 체크된 매체만. (버스정류장은 media.json 에 없어 제안서 양식이 없으므로 별도 제외)
    const slugs = favorites.filter((id) => typeof id === "string" && id.indexOf("bus:") !== 0 && !favExcluded.has(id));
    if (!slugs.length) {
      window.alert("한장제안서를 만들 수 있는 매체가 없습니다.\n(상담 대상 체크 + 버스정류장 외 매체가 있어야 합니다.)");
      return;
    }
    window.open(`one-pager.html?slugs=${encodeURIComponent(slugs.join(","))}`, "_blank", "noopener");
  }

  async function downloadFavExcel() {
    // 상담 대상으로 체크된 매체만 내보낸다(제외한 매체는 제외).
    const items = favoriteItems().filter((f) => !favExcluded.has(f.favId));
    if (!items.length) { window.alert("상담 대상으로 체크된 관심매체가 없습니다."); return; }
    try {
      const XLSX = await loadXlsxLib();
      const aoa = [FAV_EXPORT_HEADERS].concat(items.map(favExportRow));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // 열 폭 — 기본값이면 주소·주 방문층 같은 긴 값이 잘려 보임 (지역=시/도 한 칸)
      ws["!cols"] = [8, 22, 34, 14, 14, 12, 16, 20, 14, 16, 18, 17, 26, 24].map((w) => ({ wch: w }));
      // 수치 열에 천단위 표시 형식 지정 — 값 자체는 숫자라 계산·정렬이 그대로 된다
      FAV_NUMERIC_COLS.forEach((c) => {
        for (let rowIdx = 1; rowIdx < aoa.length; rowIdx++) {
          const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
          const cell = ws[ref];
          if (cell && typeof cell.v === "number") cell.z = "#,##0";
        }
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "관심매체 비교");
      XLSX.writeFile(wb, "관심매체_비교.xlsx");
    } catch (error) {
      // 오프라인·CDN 차단 등으로 라이브러리를 못 받으면 최소한 CSV 로라도 받게 함
      console.warn("xlsx 생성 실패 → CSV 로 대체", error);
      downloadFavCsvFallback(items);
    }
  }
  // 담은 매체만 열리는 공유 지도링크를 만들어 클립보드에 복사한다.
  // 광고주/동료가 링크를 열면 그 매체들이 관심매체에 담긴 채 비교 패널이 바로 뜬다.
  function copyFavMapLink() {
    const slugs = favorites.filter((id) => typeof id === "string" && id.indexOf("bus:") !== 0 && !favExcluded.has(id));
    if (!slugs.length) { window.alert("공유할 매체가 없습니다.\n(관심매체 담기 후 상담 대상으로 체크해 주세요.)"); return; }
    const url = `${window.location.origin}${window.location.pathname}?cart=${encodeURIComponent(slugs.join(","))}`;
    const done = () => {
      if (favShare) {
        const prev = favShare.innerHTML;
        favShare.innerHTML = "✓ 링크 복사됨";
        setTimeout(() => { favShare.innerHTML = prev; }, 1800);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => window.prompt("아래 링크를 복사하세요:", url));
    } else {
      window.prompt("아래 링크를 복사하세요:", url);
    }
  }

  // 맞춤 추천: 업종/타깃을 고르면 조건(카테고리 + 지역 키워드)에 맞는 매체를 관심매체에 자동으로 담는다.
  // 매칭이 3곳 미만이면 지역 조건을 풀어 카테고리만으로 폴백. media.json은 수작업 큐레이션 순서라 상위 N = 대표 매체.
  const MATCH_THEMES = [
    // 업종(14) — 광고 주요 버티컬을 OOH 적합도로 재구성
    { key: "beauty", type: "biz", label: "뷰티", cats: ["large_billboard", "package", "shopping_mall_did"], areaKeys: ["강남", "성수", "홍대", "명동", "신사", "가로수", "압구정"], cap: 8 },
    { key: "fashion", type: "biz", label: "패션", cats: ["large_billboard", "package", "shopping_mall_did"], areaKeys: ["홍대", "성수", "강남", "가로수", "신사", "동대문"], cap: 8 },
    { key: "luxury", type: "biz", label: "명품", cats: ["large_billboard", "package", "shopping_mall_did"], areaKeys: ["청담", "압구정", "신사", "명동", "강남", "한남"], cap: 8 },
    { key: "fnb", type: "biz", label: "F&B", cats: ["large_billboard", "package", "convenience", "shopping_mall_did"], areaKeys: ["홍대", "강남", "성수", "명동", "이태원"], cap: 8 },
    { key: "food", type: "biz", label: "식품", cats: ["large_billboard", "package", "convenience", "daily_touchpoint"], areaKeys: [], cap: 8 },
    { key: "finance", type: "biz", label: "금융", cats: ["large_billboard", "package", "transport_hub"], areaKeys: ["여의도", "강남", "종로", "을지로", "광화문"], cap: 8 },
    { key: "tech", type: "biz", label: "테크", cats: ["large_billboard", "package", "transport_hub", "subway"], areaKeys: ["강남", "여의도", "구로", "판교", "역삼"], cap: 8 },
    { key: "retail", type: "biz", label: "유통", cats: ["shopping_mall_did", "large_billboard", "package", "convenience"], areaKeys: ["잠실", "강남", "영등포", "신촌", "명동"], cap: 8 },
    { key: "auto", type: "biz", label: "자동차", cats: ["large_billboard", "package", "highway", "transport_hub"], areaKeys: ["강남", "도산", "분당", "서초"], cap: 8 },
    { key: "pharma", type: "biz", label: "의료", cats: ["large_billboard", "package", "convenience", "subway"], areaKeys: [], cap: 8 },
    { key: "edu", type: "biz", label: "교육", cats: ["large_billboard", "package", "convenience", "subway"], areaKeys: ["대치", "노원", "목동", "중계", "강남"], cap: 8 },
    { key: "travel", type: "biz", label: "여행", cats: ["transport_hub", "large_billboard", "package"], areaKeys: ["명동", "홍대", "이태원", "강남", "공항"], cap: 8 },
    { key: "enter", type: "biz", label: "엔터", cats: ["large_billboard", "package", "shopping_mall_did"], areaKeys: ["홍대", "강남", "건대", "신촌"], cap: 8 },
    { key: "realestate", type: "biz", label: "부동산", cats: ["large_billboard", "package", "subway"], areaKeys: ["강남", "여의도", "송파", "마포"], cap: 8 },
    // 타깃(12) — 생애단계 + 인구세분 + 라이프스타일 3축
    { key: "teen", type: "tgt", label: "10대", cats: ["large_billboard", "package", "bus", "subway"], areaKeys: ["홍대", "노원", "강남", "목동"], cap: 8 },
    { key: "univ", type: "tgt", label: "대학생", cats: ["large_billboard", "package", "bus", "subway"], areaKeys: ["홍대", "신촌", "건대", "이대", "안암", "회기", "대학"], cap: 8 },
    { key: "young", type: "tgt", label: "사회초년생", cats: ["large_billboard", "package", "convenience", "shopping_mall_did"], areaKeys: ["성수", "홍대", "강남", "영등포", "관악"], cap: 8 },
    { key: "worker", type: "tgt", label: "직장인", cats: ["large_billboard", "package", "transport_hub", "subway"], areaKeys: ["여의도", "강남", "종로", "을지로", "광화문", "역삼", "삼성"], cap: 8 },
    { key: "middle", type: "tgt", label: "중장년", cats: ["large_billboard", "package", "highway", "subway"], areaKeys: ["강남", "목동", "분당", "송파"], cap: 8 },
    { key: "silver", type: "tgt", label: "실버", cats: ["convenience", "shopping_mall_did", "bus", "subway"], areaKeys: [], cap: 8 },
    { key: "women2030", type: "tgt", label: "2030여성", cats: ["large_billboard", "package", "shopping_mall_did"], areaKeys: ["강남", "성수", "홍대", "가로수", "명동"], cap: 8 },
    { key: "men2030", type: "tgt", label: "2030남성", cats: ["large_billboard", "package", "subway"], areaKeys: ["강남", "홍대", "건대", "구로"], cap: 8 },
    { key: "parents", type: "tgt", label: "영유아부모", cats: ["daily_touchpoint", "convenience", "shopping_mall_did"], areaKeys: ["목동", "대치", "분당", "송파"], cap: 8 },
    { key: "single", type: "tgt", label: "1인가구", cats: ["convenience", "daily_touchpoint", "large_billboard"], areaKeys: ["관악", "영등포", "성수", "마포"], cap: 8 },
    { key: "premium", type: "tgt", label: "고소득", cats: ["large_billboard", "package", "shopping_mall_did"], areaKeys: ["청담", "압구정", "도산", "한남", "서초"], cap: 8 },
    { key: "tourist", type: "tgt", label: "관광객", cats: ["large_billboard", "package", "transport_hub", "shopping_mall_did"], areaKeys: ["명동", "홍대", "이태원", "동대문", "강남"], cap: 8 }
  ];
  // 상품(세부유형) → 같은 업종·타깃 안에서도 '상품'에 따라 상권이 달라짐. 선택 시 부모의 지역키워드를 이 상권으로 override(가장 구체 신호).
  // 시드(핵심 예시) — 이 테이블만 넓히면 세분화가 확장됨. 관련: [[data-catalog-and-needs]].
  const PLAN_SUBTYPES = {
    beauty:  [ { k: "cosmetic", l: "화장품", areaKeys: ["명동", "홍대", "성수", "가로수", "강남", "신사"] }, { k: "clinic", l: "성형·피부과", areaKeys: ["압구정", "신사", "논현", "청담", "강남", "역삼"] }, { k: "device", l: "뷰티 디바이스·의료기기", areaKeys: ["강남", "판교", "가산", "구로", "역삼"] } ],
    fashion: [ { k: "street", l: "스트리트·캐주얼", areaKeys: ["홍대", "성수", "건대", "동대문"] }, { k: "contemp", l: "컨템포러리·명품", areaKeys: ["청담", "압구정", "신사", "가로수", "한남"] } ],
    fnb:     [ { k: "cafe", l: "카페·디저트", areaKeys: ["성수", "연남", "홍대", "가로수", "익선"] }, { k: "dining", l: "외식·다이닝", areaKeys: ["강남", "이태원", "여의도", "을지로", "서촌"] } ],
    pharma:  [ { k: "clinic", l: "병원·클리닉", areaKeys: ["압구정", "신사", "강남", "논현", "서초"] }, { k: "otc", l: "약국·건강기능", areaKeys: ["종로", "영등포", "노원", "신촌"] } ],
    tourist: [ { k: "foreign", l: "외국인 관광", areaKeys: ["명동", "동대문", "홍대", "이태원", "인사동", "남대문"] }, { k: "domestic", l: "내국인 관광", areaKeys: ["광화문", "북촌", "경복궁", "인사동", "서촌", "여의도"] } ],
    univ:    [ { k: "hongdae", l: "홍대·신촌권", areaKeys: ["홍대", "신촌", "이대"] }, { k: "gangnam", l: "강남·대학가", areaKeys: ["건대", "안암", "회기", "대학"] } ]
  };
  // ===== ① AI 추천 플래너 — 관심매체 비교(②)와 완전 별도. 자기 데이터(plannerSlugs)로 시작·완결. =====
  const PLAN_SCOPES = [{ k: "all", l: "전국" }, { k: "metro", l: "수도권" }, { k: "local", l: "지방" }];
  const PLAN_SIDOS = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
  // 플랫폼 전체 매체 카테고리(지도 카테고리 필터와 동일) — 매체유형 선택지의 기준
  const PLAN_ALL_CATS = ["large_billboard", "package", "subway", "transport_hub", "bus", "shopping_mall_did", "daily_touchpoint", "convenience", "highway", "other"];
  const PLAN_METRO = ["서울", "경기", "인천"];
  let plannerSlugs = [];
  const plannerExcluded = new Set();
  // A′ 비대칭 동기화: ①에서 직접 담은 매체(②에도 반영) / ①에서 뺀 AI추천(재생성돼도 유지)
  const plannerAdded = new Set();
  const plannerRemoved = new Set();
  // 지역 = 누적 토큰 배열. 토큰: {scope:"metro"|"local"} 또는 {sido, gu}(gu "" = 시도 전체). 빈 배열 = 전국.
  let plannerRegions = [];
  let plannerAddSido = "";     // 지역 추가 UI에서 현재 고른 시·도(필터 아님, 구 목록 표시용)
  let plannerBudget = 5000;    // 만원, 0 = 제한 없음. 기본 3~5천만
  // 예산·기간 비례 매체 수 상한(3~15곳). 예산 없으면 8곳.
  // 평균 매체비 ≈ 월 650만 × (기간/30). 기간을 줄이면 매체비↓ → 더 많은 매체 수용 → '짧게·여러 매체' 레버가 매체 수를 실제로 늘림.
  function planCapFor(period) { if (!plannerBudget) return 8; const perMedia = 650 * ((period || 30) / 30); return Math.max(3, Math.min(15, Math.round(plannerBudget / perMedia))); }
  // 업종(단일) + 타깃(복수) + 기타(직접입력 키워드)
  let plannerBiz = "beauty";
  let plannerBizCustom = "";
  let plannerTargets = [];
  let plannerSubtypes = {}; // {부모키(업종/타깃): 선택 상품키} — 세분화. 부모 지역키워드를 상품 상권으로 override.
  let plannerCustoms = [];
  let plannerBody = null, plannerFoot = null;
  // 예산 상한(만원) — 딱 떨어지는 값 + 직접입력. 플랜 금액은 이 안에 들어감.
  const PLAN_BUDGETS = [{ v: 1000, l: "1천만" }, { v: 3000, l: "3천만" }, { v: 5000, l: "5천만" }, { v: 10000, l: "1억" }];
  // 집행 기간 — 딱 떨어지는 값 + 직접입력(일). 1개월 미만은 단기요율, 이상은 월×개월.
  const PLAN_PERIODS = [
    { d: 7, l: "7일" }, { d: 15, l: "15일" }, { d: 30, l: "1개월" }, { d: 90, l: "3개월" }, { d: 180, l: "6개월" }, { d: 365, l: "1년" },
  ];
  let plannerPeriodDays = 30; // 기본 1개월
  // 매체유형 = 플랫폼 전체 카테고리(미디어믹스 = 전체)
  const PLAN_MEDIA_TYPES = [
    { k: "all", l: "미디어믹스", cats: null },
    { k: "led", l: "전광판·빌보드", cats: ["large_billboard", "package"] },
    { k: "subway", l: "지하철", cats: ["subway"] },
    { k: "hub", l: "공항·터미널·기차", cats: ["transport_hub"] },
    { k: "bus", l: "버스", cats: ["bus"] },
    { k: "mall", l: "쇼핑·문화", cats: ["shopping_mall_did"] },
    { k: "elev", l: "엘리베이터", cats: ["daily_touchpoint"] },
    { k: "cvs", l: "편의점", cats: ["convenience"] },
    { k: "highway", l: "고속도로", cats: ["highway"] },
    { k: "other", l: "기타 생활권", cats: ["other"] },
  ];
  const PLAN_SCENARIOS = [
    { k: "eff", l: "효율형", desc: "CPM 최소" },
    { k: "bal", l: "균형형", desc: "도달·효율" },
    { k: "reach", l: "도달우선", desc: "최대 노출" },
  ];
  // 커버 = 노출 방식(출력 배지). '매체 종류'가 아니라 '어떻게 분포시키나'. 같은 매체도 방식이 결정.
  const PLAN_COVERAGE = [
    { k: "auto", l: "균형 분포", desc: "조건 기준 균형" },
    { k: "focus", l: "핵심지역 집중", desc: "주요 핵심 상권에 집중" },
    { k: "wide", l: "와이드 분산", desc: "여러 지역에 넓게" },
    { k: "local", l: "생활권 밀착", desc: "동네·생활 접점에 반복" },
    { k: "path", l: "동선형", desc: "이동 동선 따라" },
  ];
  // 전국 주요 핵심 상권 — '핵심지역 집중' 판정용
  const PLAN_PRIME_AREAS = ["강남", "역삼", "삼성", "코엑스", "서초", "여의도", "영등포", "명동", "을지로", "종로", "광화문", "시청", "홍대", "합정", "신촌", "성수", "건대", "가로수", "신사", "압구정", "청담", "도산", "잠실", "송파", "이태원", "동대문", "판교", "서면", "해운대", "동성로"];
  // 조정 레버 — 직관적 방향 단어. 선택한 안을 그 방향으로 재추천(오버라이드). 대안과 같은 엔진.
  // 라벨은 국내외 OOH 미디어플래닝 문헌의 표준 트레이드오프를 반영:
  //  ① 효율(CPM) vs 도달 규모 — GRP=Reach×Frequency 기본축(Movingwalls·AdQuick)
  //  ② 커버리지 전략 — 집중/분산/생활권 반복(유효빈도 3+·Ostrow)/구매 동선(path-to-purchase)
  //  ③ 집행 리듬 — 지속 노출(continuity) vs 집중(플라이팅), Ephron 리센시 플래닝
  //  ④ 매체 성격 — 임팩트/체류·주목(dwell time>size·MRC 주목도)/생활밀착/운전자·도로변(포맷 오디언스)
  // 두 줄로 정리: 1행 = 목표·커버리지(효율/도달·집중/분산/반복/동선), 2행 = 집행·매체 성격(기간·매체 유형). 라벨은 두 줄에 맞게 간결화.
  // 조정 레버 = '미디어 믹스'만(지역 집중/분산은 지역 믹스가 담당 → 레버에서 제거, 중복·혼동 방지).
  // 1행 = 목표·기간(무엇을 더 살지), 2행 = 매체 성격(어떤 매체로). 단어 간 차이가 명확하도록 정리.
  const PLAN_LEVERS = [
    [{ l: "효율(CPM↓)", set: { scenario: "eff" } }, { l: "도달(규모↑)", set: { scenario: "reach" } }, { l: "짧게·자주", set: { period: 15 } }, { l: "길게·꾸준히", set: { period: 180 } }],
    [{ l: "대형 임팩트", set: { media: "impact" } }, { l: "체류·주목형", set: { media: "dwell" } }, { l: "생활 밀착형", set: { media: "life" } }, { l: "운전자·도로변", set: { media: "driver" } }],
  ];
  // ★ 캠페인 목적(objective) — 매체·송출·지역 믹스를 '목적'이 구동(브랜드 티어 아님). 맞춤 추천안의 기본 축과 지역 믹스 기본값을 결정.
  const PLAN_OBJECTIVES = [
    { k: "awareness", l: "인지 확대", scenario: "reach", media: null, coverage: "auto", rstrat: "topN", note: "넓은 도달 — 상위 상권에 고루" },
    { k: "launch", l: "런칭·신제품", scenario: "reach", media: "impact", coverage: "focus", rstrat: "core1", note: "핵심 상권 대형 매체로 각인" },
    { k: "sustain", l: "지속·생활밀착", scenario: "eff", media: "life", coverage: "wide", rstrat: "all", note: "생활 동선 반복 노출 — 효율 우선" },
    { k: "convert", l: "방문·전환", scenario: "eff", media: "driver", coverage: "focus", rstrat: "topN", note: "매장·상권 인근 접점 집중" },
  ];
  let plannerObjective = "awareness";
  function curObjective() { return PLAN_OBJECTIVES.find((o) => o.k === plannerObjective) || PLAN_OBJECTIVES[0]; }
  let plannerMediaType = "all";
  let plannerRegionStrat = "topN"; // 지역 커버리지 전략: all|topN|core1|coreMulti|wide (지역 직접 지정 시 무시)
  let plannerRegionN = 3;          // '상위권 집중'이 덮을 상위 지역 수
  // ⓒ 외부 지역집계(연령·성별·주중/주말 등) — 선택적 정밀 데이터. 파일 없거나 비어도 서비스는 현재 신호(적합·유동·매체수)로 작동.
  // data/region-stats.json: { "<areaName>": { age2030, genderM, weekend, dayFoot, subwayDaily, source } } (0~1 비율). 나중에 채우면 랭킹·표시 정밀화.
  let regionStats = {};
  (function loadRegionStats() { try { fetch("data/region-stats.json").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) regionStats = j.regions || j; }).catch(function () {}); } catch (e) {} })();
  let plannerAnKey = "custom"; // 선택된 안: custom(맞춤) | alt1 | alt2
  let plannerLever = {};       // 레버 오버라이드 {scenario?,coverage?,media?,period?}
  let planEffDays = 30;        // 현재 선택 안의 유효 집행 기간(일) — 금액·노출·라벨 기준
  let plannerRefineOpen = false;
  // "활성 수집함" — 지도 ★은 '맨 앞에 떠 있는 창'으로 간다. 두 세트는 끝까지 독립.
  function plannerOpen() { const o = document.querySelector(".gps-ov"); return !!(o && o.classList.contains("open")); }
  // 플래너가 '활성(앞) 수집함'인가? → 플래너가 열려 있고, 관심매체 창이 앞(gpsFront="fav")이 아닐 때.
  // 둘 다 열렸는데 관심매체 창을 눌러 앞으로 올리면 플래너는 비활성 → ★은 ②관심매체에만 담긴다.
  function plannerIsActiveCollector() {
    if (!plannerOpen()) return false;
    const favP = document.getElementById("mapFavPanel");
    const favVisible = favP && !favP.hidden;
    if (!favVisible) return true; // 관심매체 창이 닫혀 있으면 플래너가 유일한 활성 수집함
    return document.body.dataset.gpsFront !== "fav";
  }
  // ★ = ②관심매체(내 매체 목록) 소속 여부 — 지도 어디서든 의미 하나로 일관.
  function activeHas(slug) { return favorites.indexOf(slug) >= 0; }
  // 지도 ★: 항상 ②에 담기/빼기. 플래너가 '앞(활성)'일 때만 ①에도 반영(①→② 비대칭). 관심매체 창이 앞이면 ②에만.
  function activeToggle(slug) {
    toggleFavorite(slug); // ② 담기/빼기 — 항상 (updateFavoritesUI·관심패널 갱신 포함)
    if (plannerIsActiveCollector()) {
      if (isFavorite(slug)) { plannerAdded.add(slug); plannerRemoved.delete(slug); }
      else { plannerAdded.delete(slug); plannerRemoved.add(slug); plannerExcluded.delete(slug); }
      applyPlan();
      if (plannerBody) renderPlannerResult(plannerBody, plannerFoot, {});
    }
  }
  function planSido(item) {
    const addr = (item.address || item.areaName || "").replace(/\s+/g, " ").trim();
    return addr ? (FAV_SIDO_ABBR[addr.split(" ")[0]] || addr.split(" ")[0] || "") : "";
  }
  function planGu(item) {
    const addr = (item.address || item.areaName || "").replace(/\s+/g, " ").trim();
    const toks = addr.split(" ");
    for (let i = 1; i < toks.length; i += 1) { if (/(구|군)$/.test(toks[i])) return toks[i]; }
    for (let i = 1; i < toks.length; i += 1) { if (/시$/.test(toks[i])) return toks[i]; }
    return "";
  }
  function inPlanRegion(item) {
    if (!plannerRegions.length) return true; // 전국
    const s = planSido(item), g = planGu(item);
    return plannerRegions.some((r) => {
      if (r.scope === "metro") return PLAN_METRO.indexOf(s) >= 0;
      if (r.scope === "local") return PLAN_METRO.indexOf(s) < 0;
      return r.sido === s && (!r.gu || r.gu === g);
    });
  }
  // 특정 시·도의 구/시 목록(데이터 기반)
  function planGuOptions(sido) {
    if (!sido) return [];
    const pool = Array.isArray(mediaWithLocations) ? mediaWithLocations : [];
    const set = {};
    pool.forEach((m) => { if (planSido(m) === sido) { const g = planGu(m); if (g) set[g] = 1; } });
    return Object.keys(set).sort((a, b) => a.localeCompare(b, "ko"));
  }
  function regionTokenLabel(r) {
    if (r.scope === "metro") return "수도권";
    if (r.scope === "local") return "지방";
    return r.sido + (r.gu ? " " + r.gu : " 전체");
  }
  // 업종(단일)+타깃(복수)+기타 키워드를 합쳐 매칭 기준(cats·areaKeys·라벨) 산출
  function planCriteria() {
    const themes = [];
    if (plannerBiz) { const t = MATCH_THEMES.find((x) => x.key === plannerBiz); if (t) themes.push(t); }
    plannerTargets.forEach((k) => { const t = MATCH_THEMES.find((x) => x.key === k); if (t) themes.push(t); });
    let cats = [];
    themes.forEach((t) => { cats = cats.concat(t.cats || []); });
    const customs = [plannerBizCustom].concat(plannerCustoms).filter(Boolean);
    const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);
    cats = uniq(cats);
    const bizT = MATCH_THEMES.find((x) => x.key === plannerBiz);
    // 상품(세부) 선택 시 그 상권으로 부모 지역키워드 override(가장 구체) — 예: 뷰티>성형·피부과 → 압구정·신사
    const subAK = (parent) => { const sel = plannerSubtypes[parent]; const list = PLAN_SUBTYPES[parent]; if (sel && list) { const s = list.find((x) => x.k === sel); if (s) return s.areaKeys || []; } return null; };
    // 업종 지역키워드(×1) — 세부 선택 시 override
    const bizAreaKeys = uniq((subAK(plannerBiz) || (bizT ? bizT.areaKeys || [] : [])).concat(plannerBizCustom ? [plannerBizCustom] : []));
    // 타깃 지역키워드(×2, 지역 랭킹에서 업종보다 세게) — 각 타깃의 세부 선택 시 override
    let tgtAreaKeys = [];
    plannerTargets.forEach((k) => { const t = MATCH_THEMES.find((x) => x.key === k); if (!t) return; tgtAreaKeys = tgtAreaKeys.concat(subAK(k) || t.areaKeys || []); });
    tgtAreaKeys = uniq(tgtAreaKeys.concat(plannerCustoms));
    const areaKeys = uniq(bizAreaKeys.concat(tgtAreaKeys));
    const bizLabel = plannerBizCustom || (bizT ? bizT.label : "");
    const tgtLabels = plannerTargets.map((k) => (MATCH_THEMES.find((x) => x.key === k) || {}).label).filter(Boolean).concat(plannerCustoms);
    return { cats, areaKeys, tgtAreaKeys, bizAreaKeys, bizLabel, tgtLabels, hasAny: themes.length > 0 || customs.length > 0 };
  }
  // 매체유형 선택이 있으면 그 카테고리로, 없으면 조건 카테고리(없으면 전체)로 지도 풀을 좁힌다.
  function planCatsFor(crit) {
    const mt = PLAN_MEDIA_TYPES.find((m) => m.k === plannerMediaType);
    if (mt && mt.cats) return mt.cats;
    return crit.cats.length ? crit.cats : PLAN_ALL_CATS;
  }
  function matchedPool(crit) {
    const pool = Array.isArray(mediaWithLocations) ? mediaWithLocations : [];
    const cats = planCatsFor(crit);
    const areaKeys = crit.areaKeys || [];
    const matchArea = (item) => {
      if (!areaKeys.length) return true;
      const text = [item.name, item.areaName, item.areaSlug, item.address].filter(Boolean).join(" ").toLowerCase();
      return areaKeys.some((k) => text.includes(k.toLowerCase()));
    };
    const base = (withArea) => pool.filter((item) => cats.indexOf(item.category) >= 0 && inPlanRegion(item) && (!withArea || matchArea(item)));
    let matched = base(true);
    if (matched.length < 3) matched = base(false);
    return matched;
  }
  // 월 노출(OTS) 추정 — 유동(일평균)×30, 지하철·버스는 월평균 승하차를 그대로. 모두 '추정'이며 디지털 클릭과 다름.
  function planMonthlyExposure(f) {
    if (f.foot500Num) return f.foot500Num * 30;
    if (f.subwayNum) return f.subwayNum;
    if (f.busNum) return f.busNum;
    return 0;
  }
  function planOts(items) { return items.reduce((s, f) => s + planExposure(f, planEffDays), 0); }
  function planCpm(cost, ots) { return ots ? cost / (ots / 1000) : null; }
  // 매체유형별 평균 노출 빈도(1인) 가정 — 생활매체는 반복↑, 대형 전광판은 반복↓. 도달·빈도 분해용(추정).
  function planFreqFactor(f) {
    const t = `${f.type || ""} ${f.name || ""}`;
    if (/엘리베이터|엘베|타운보드/.test(t)) return 8;
    if (/편의점/.test(t)) return 4;
    if (/지하철|철도/.test(t)) return 2.5;
    if (/버스|쉘터/.test(t)) return 2;
    if (/공항|터미널/.test(t)) return 1.3;
    return 1.5; // 전광판·빌보드 등
  }
  function planReachOf(f, days) { const ff = planFreqFactor(f) || 1; return planExposure(f, days) / ff; }
  // 플랜 집계 — 노출(OTS)·순도달(중복할인)·평균빈도·금액·CPM. 모두 '추정'.
  function planAggregate(items, days) {
    const ots = items.reduce((s, f) => s + planExposure(f, days), 0);
    const sumReach = items.reduce((s, f) => s + planReachOf(f, days), 0);
    const dedup = items.length > 1 ? 0.85 : 1; // 매체 간 중복 보정(추정)
    const reach = sumReach * dedup;
    const cost = items.reduce((s, f) => s + planPriceForDays(f, days), 0);
    return { ots, reach, freq: reach ? ots / reach : 0, cost, cpm: planCpm(cost, ots) };
  }
  // 기간(일) 노출 추정 = 월 노출 × 일수/30
  function planExposure(f, days) { return planMonthlyExposure(f) * ((days || 30) / 30); }
  // 단기요율(구간 1/3/7/15 + 월=30) 사이를 선형 보간해 임의 일수 금액 추정. 표에 없는 10일·5일 등 감안.
  function shortTermPriceForDays(st, days, monthly) {
    const pts = [];
    [1, 3, 7, 15].forEach((d) => { if (st && st[d] != null) pts.push([d, st[d]]); });
    if (monthly) pts.push([30, monthly]);
    if (!pts.length) return null;
    pts.sort((a, b) => a[0] - b[0]);
    if (days <= pts[0][0]) return pts[0][1];
    if (days >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [d0, p0] = pts[i], [d1, p1] = pts[i + 1];
      if (days >= d0 && days <= d1) return p0 + (p1 - p0) * ((days - d0) / (d1 - d0));
    }
    return pts[pts.length - 1][1];
  }
  // 집행 기간(일)의 추정 금액. 1개월 이상=월×개월, 미만=단기요율(없으면 월 비례 임시추정).
  function planPriceForDays(f, days) {
    const d = days || 30;
    const monthly = f.monthly || 0;
    if (d >= 30) return monthly * (d / 30);
    const st = f.shortTerm;
    if (!st) return monthly * (d / 30); // 단기요율 없음 → 월 비례(협의 대상)
    const p = shortTermPriceForDays(st, d, monthly);
    return p == null ? monthly * (d / 30) : p;
  }
  // 기간 라벨(프리셋이면 그 이름, 아니면 'N일')
  function periodLabel(days) {
    const hit = PLAN_PERIODS.find((p) => p.d === days);
    return hit ? hit.l : (days + "일");
  }
  // 매체별 역할 — 왜 이 매체인지 한눈에(도달확보/반복강화/임팩트확장/구매유도). 유형 문자열 기반 휴리스틱.
  function planRole(f) {
    const t = `${f.type || ""} ${f.name || ""}`;
    if (/엘리베이터|엘베|타운보드/.test(t)) return { k: "freq", l: "반복강화" };
    if (/버스|쉘터/.test(t)) return { k: "reach", l: "도달확보" };
    if (/지하철|철도|공항|역사|터미널/.test(t)) return { k: "reach", l: "도달확보" };
    if (/편의점|쇼핑|몰|마트|DID|리테일/.test(t)) return { k: "nudge", l: "구매유도" };
    if (/전광판|빌보드|LED|미디어|옥상|월/.test(t)) return { k: "impact", l: "임팩트확장" };
    return { k: "reach", l: "도달확보" };
  }
  // ★ 송출 방식 — digital(로테이션: 타 브랜드와 사이클 공유·영상 주목도↑) / fixed(고정 단독: 내 브랜드만·각인↑, 정적 '병풍' 위험).
  // 둘의 장단점이 분명해 '송출방식 믹스'(주목+각인)도 중요한 설계 축. 키워드 휴리스틱(데이터 정식 플래그 확보 전).
  function broadcastMode(f) {
    const t = `${f.type || ""} ${f.name || ""}`.toLowerCase();
    const ps = `${f.playSpec || ""}`;
    if (/조명|래핑|포스터|와이드|인쇄|옥상|빌보드/.test(t)) return "fixed";                 // 명시적 고정형 우선
    if (/롤링|회전|로테이션|\d+\s*회/.test(ps) || /전광판|led|디지털|사이니지|미디어|did|비전|psd|스크린/i.test(t)) return "digital";
    if (/쉘터|정류장|스크린도어/.test(t)) return "fixed";                                   // 쉘터·정류장 조명광고 등 대개 고정
    return "";
  }
  // 역할 뜻(배지 툴팁·목표 칩 설명 공용) — 목표(방향) 선택지와 매체 배지가 같은 용어를 가리킴
  const PLAN_ROLE_KEY = [
    { k: "reach", l: "도달확보", d: "많은 사람에게 기본 도달 (지하철·버스·교통거점)" },
    { k: "freq", l: "반복강화", d: "생활동선 반복 노출로 빈도↑ (엘리베이터 등)" },
    { k: "impact", l: "임팩트확장", d: "대형 전광판 주목도·브랜드 임팩트" },
    { k: "nudge", l: "구매유도", d: "매장·편의점 근처에서 구매 유도" },
  ];
  // 추천 시나리오별 정렬: 효율형=CPM 최소, 도달우선=노출 최대, 균형형=큐레이션 순서 유지.
  function orderByScenario(items, scen) {
    const arr = items.slice();
    if (scen === "eff") {
      arr.sort((a, b) => {
        const ca = planCpm(planPriceForDays(a, planEffDays), planExposure(a, planEffDays));
        const cb = planCpm(planPriceForDays(b, planEffDays), planExposure(b, planEffDays));
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return ca - cb;
      });
    } else if (scen === "reach") {
      arr.sort((a, b) => planExposure(b, planEffDays) - planExposure(a, planEffDays));
    }
    return arr;
  }
  // 타깃 동선 단계(0 이동=교통, 1 거리/상권=전광판·쇼핑, 2 생활=엘베·편의점)
  function planPathStage(f) {
    const t = `${f.type || ""} ${f.name || ""}`;
    if (/지하철|버스|쉘터|철도|공항|터미널|역사/.test(t)) return 0;
    if (/편의점|엘리베이터|엘베|타운보드/.test(t)) return 2;
    return 1;
  }
  function planIsPrime(f) { const t = `${f.name || ""} ${f.area || ""} ${f.address || ""}`; return PLAN_PRIME_AREAS.some((a) => t.indexOf(a) >= 0); }
  // 핵심지역 집중 = 주요 상권 매체 우선, 와이드 = 넓게 커버하는 네트워크/패키지 매체(엘베·버스·지하철) 우선,
  // 생활권 밀착 = 동네 접점(엘베·편의점) 우선, 동선형 = 교통→거리→생활 단계 번갈아.
  function applyCoverage(items, cov) {
    const by = (re) => { const m = (f) => re.test(`${f.type || ""} ${f.name || ""}`); return items.filter(m).concat(items.filter((f) => !m(f))); };
    if (cov === "focus") return items.filter(planIsPrime).concat(items.filter((f) => !planIsPrime(f)));
    if (cov === "wide") return by(/버스|쉘터|지하철|철도|엘리베이터|엘베|타운보드|패키지/);
    if (cov === "local") return by(/엘리베이터|엘베|타운보드|편의점/);
    if (cov === "path") {
      const buckets = { 0: [], 1: [], 2: [] };
      items.forEach((f) => buckets[planPathStage(f)].push(f));
      const out = []; let added = true;
      while (added) { added = false; [0, 1, 2].forEach((s) => { if (buckets[s].length) { out.push(buckets[s].shift()); added = true; } }); }
      return out;
    }
    return items;
  }
  // 매체 성격 강조(미디어플래닝 포맷 분류 기반):
  //  impact=대형 임팩트(스쳐도 각인), dwell=체류·주목형(오래 머무는 면=회상↑, '체류시간>크기' MRC 주목도·노출시간),
  //  life=생활 밀착(동네 반복 접점), driver=운전자·도로변(차량 동선 대형).
  function applyMedia(items, media) {
    const front = (re) => { const m = (f) => re.test(`${f.type || ""} ${f.name || ""}`); return items.filter(m).concat(items.filter((f) => !m(f))); };
    if (media === "impact") return front(/전광판|빌보드|LED|미디어|옥상|월/);
    if (media === "dwell") return front(/엘리베이터|엘베|타운보드|쉘터|정류장|역사|지하철|철도|승강장|스크린도어|편의점|카페|대학/);
    if (media === "life") return front(/엘리베이터|엘베|타운보드|편의점|버스|쉘터|지하철/);
    if (media === "driver") return front(/전광판|빌보드|LED|옥상|교차로|사거리|고속도로|도로|로드|간선/);
    return items;
  }
  // 후보 풀 = 지역 + (고정 시)매체유형 안의 전 매체. 업종·타깃은 '가중'(가두지 않음) — 관련 지역·카테고리를 앞으로.
  function candidatePool(crit) {
    const mt = PLAN_MEDIA_TYPES.find((m) => m.k === plannerMediaType);
    const mtCats = mt && mt.cats;
    const pool = (Array.isArray(mediaWithLocations) ? mediaWithLocations : []).filter((item) => inPlanRegion(item) && (!mtCats || mtCats.indexOf(item.category) >= 0));
    const fav = itemsForSlugs(pool.map((m) => m.slug).filter(Boolean));
    const areaKeys = (crit.areaKeys || []).map((k) => k.toLowerCase());
    const cats = crit.cats || [];
    const score = (f) => { let s = 0; const t = `${f.name || ""} ${f.area || ""} ${f.address || ""}`.toLowerCase(); areaKeys.forEach((k) => { if (t.indexOf(k) >= 0) s += 3; }); if (cats.indexOf(f.category) >= 0) s += 2; return s; };
    return fav.map((f, i) => ({ f, s: score(f), i })).sort((a, b) => (b.s - a.s) || (a.i - b.i)).map((x) => x.f);
  }
  // ===== 지역(상권) 상대평가 레이어 =====
  // 광고주 판단 = "이 장소 몇 명"(절대값)이 아니라 "후보 지역 중 어디가 타깃에 상대적으로 맞나 + 어떻게 덮나".
  // 지역 커버리지 전략 프리셋 — 후보 지역 랭킹 위에서 '어디를 어떻게 덮을지' 선택.
  // ★ 상권 프로파일 — 유동 숫자만으론 설득력 약함. '그 상권을 지배하는 업종·시설·성격'을 근거/가중치로.
  // 지금은 큐레이션 사전(placeholder). 국세청/카드사 상가업소(업종별 점포)·소진공 주요상권·집객시설 데이터 연동 시 자동·정밀화. [[data-catalog-and-needs]]
  const PLAN_AREA_PROFILE = [
    { re: /도산|압구정|청담|신사/, trait: "성형외과·피부과·수입차 쇼룸·명품 패션이 밀집한 고소득 상권", biz: ["beauty", "luxury", "fashion", "auto", "pharma"] },
    { re: /가로수/, trait: "패션·뷰티 플래그십이 늘어선 트렌드 거리 상권", biz: ["fashion", "beauty", "luxury"] },
    { re: /강남역|강남대로|역삼|서초/, trait: "학원·오피스·성형·피부과가 밀집한 유동 최대 상권", biz: ["beauty", "pharma", "finance", "tech", "edu"] },
    { re: /명동|을지로|남대문|동대문/, trait: "외국인 관광·면세·화장품 로드숍 중심의 관문 상권", biz: ["beauty", "retail", "travel", "fashion"] },
    { re: /삼성|코엑스/, trait: "전시·MICE·오피스 중심의 비즈니스 상권", biz: ["tech", "finance", "auto", "travel"] },
    { re: /홍대|신촌|이대/, trait: "대학가 2030·스트리트 패션·클럽 중심의 MZ 상권", biz: ["fashion", "fnb", "enter", "beauty"] },
    { re: /성수|연무장|연남/, trait: "카페·팝업·힙플레이스 중심의 트렌드 상권", biz: ["fashion", "fnb", "beauty", "enter"] },
    { re: /여의도|광화문|종로|시청/, trait: "대기업 오피스·직장인이 밀집한 업무 상권", biz: ["finance", "tech", "realestate", "food"] },
    { re: /건대|회기|안암|성신/, trait: "대학가·젊은 유동 중심 상권", biz: ["fashion", "fnb", "enter", "edu"] },
    { re: /이태원|한남/, trait: "외국인·프리미엄 F&B·패션 상권", biz: ["fnb", "fashion", "luxury", "travel"] },
    { re: /잠실|송파/, trait: "대형 쇼핑몰·가족 생활권 상권", biz: ["retail", "food", "edu"] },
  ];
  function areaProfile(key) { for (let i = 0; i < PLAN_AREA_PROFILE.length; i += 1) { if (PLAN_AREA_PROFILE[i].re.test(key || "")) return PLAN_AREA_PROFILE[i]; } return null; }
  // 지역 믹스 = '지역 범위'만 정함(매체 개념 섞지 않음). 한곳 집중 ↔ 여러 곳 분산 3단계.
  const PLAN_REGION_STRATS = [
    { k: "core1", l: "1곳 집중",  desc: "1순위 지역 한 곳에만 예산 집중" },
    { k: "topN",  l: "상위 3곳",  desc: "타깃 적합 상위 3개 지역에 분산" },
    { k: "all",   l: "전체 분산",  desc: "후보 지역 전체에 넓게 분산" },
  ];
  // 지역 전략은 '지역 직접 지정 안 함(전국/타깃 기반)'일 때만 활성. 직접 지정 시 그 지역을 그대로 따름.
  function regionLayerActive() { return !plannerRegions.length; }
  function planRegionKeyOf(f) { return (f.area && f.area !== "-") ? f.area : favRegionLabel(f); }
  // ⓒ 외부 정밀집계(region-stats.json) 가중 보정 — 공신식 자료 분석으로 보강한 지표. 있는 필드만 반영(없으면 0 = 영향 없음, graceful).
  //  유효노출(vai)·시간대적합(dayFit)·연령(age2030)·소득(income)·직장(worker)·배후거주(resident) 가산, 경쟁 클러터(competition) 감산.
  //  타깃/업종에 따라 관련 지표만 가중(예: 명품→income, 직장인→worker, 2030/뷰티→age2030).
  function regionExtBoost(g, crit, tgtStr) {
    const e = g.ext; if (!e) return 0;
    const n = (v) => (typeof v === "number" ? v : 0);
    let b = 0;
    b += 0.10 * n(e.vai);        // 유효노출(가시성) 보정 — Geopath VAI류
    b += 0.10 * n(e.dayFit);     // 시간대·요일 타깃 적합(dayparting)
    b -= 0.08 * n(e.competition); // 경쟁·클러터 → SOV 하락 패널티
    if (/2030|대학생|사회초년|영유아|뷰티|패션|엔터/.test(tgtStr)) b += 0.12 * n(e.age2030);
    if (/명품|고소득|프리미엄|luxury|자동차/.test(tgtStr)) b += 0.12 * n(e.income);
    if (/직장|오피스|금융|테크|worker/.test(tgtStr)) b += 0.10 * n(e.worker);
    if (/주거|거주|가족|영유아|실버|1인|부동산/.test(tgtStr)) b += 0.10 * n(e.resident);
    return b;
  }
  // 후보 지역 상대 랭킹 — 후보풀을 상권(area)별로 묶어 '타깃 적합(밀도)·평균 유동·매체 수'로 상대 스코어(1순위=100).
  // ⓐ 가중 튜닝: 크기 편향 제거 위해 '합'이 아닌 '밀도/평균' 사용 — fitRatio(적합 밀도)·footAvg(평균 유동).
  //   타깃·업종 키워드가 있으면 적합(0.55) 중심, 없으면 유동·매체수만. ⓒ 외부집계(ext) 있으면 2030 타깃 시 소폭 보정.
  function buildRegionRanking(crit) {
    const pool = candidatePool(crit);
    const lc = (k) => k.toLowerCase();
    const tgtKeys = (crit.tgtAreaKeys || []).map(lc).filter(Boolean); // 타깃 지역키워드(가중 ×2)
    const bizKeys = (crit.bizAreaKeys || []).map(lc).filter(Boolean); // 업종 지역키워드(가중 ×1)
    const cats = crit.cats || [];
    const tgtStr = (crit.tgtLabels || []).join(" ") + " " + (crit.bizLabel || "");
    const tgt2030 = /2030|대학생|사회초년|영유아|뷰티|패션/.test(tgtStr); // ext(연령) 보정 대상
    // 상권 키워드가 '건물명'의 일부로 걸리는 오매칭 방지(예: 진주 '강남빌딩' → 강남 상권 아님).
    const BLDG = /^(빌딩|타워|빌\b|센터|스퀘어|플라자|프라자|관\b|상가)/;
    const keyHit = (t, a) => { let i = t.indexOf(a); while (i >= 0) { if (!BLDG.test(t.slice(i + a.length))) return true; i = t.indexOf(a, i + 1); } return false; };
    const groups = {};
    pool.forEach((f) => {
      const key = planRegionKeyOf(f);
      if (!groups[key]) groups[key] = { key: key, items: [], foot: 0, subway: 0, fit: 0, types: {} };
      const g = groups[key];
      g.items.push(f);
      g.foot += f.foot500Num || 0; g.subway += f.subwayNum || 0;
      const t = `${f.name || ""} ${f.area || ""} ${f.address || ""} ${f.audience || ""}`.toLowerCase();
      // 타깃 지역 적합을 업종보다 2배 가중 → 20대 타깃이면 홍대·신촌이 뷰티 기본상권(강남)보다 우선
      let fit = 0; tgtKeys.forEach((a) => { if (keyHit(t, a)) fit += 2; }); bizKeys.forEach((a) => { if (keyHit(t, a)) fit += 1; }); if (cats.indexOf(f.category) >= 0) fit += 1;
      g.fit += fit; const ty = f.type || "기타"; g.types[ty] = (g.types[ty] || 0) + 1;
    });
    const arr = Object.keys(groups).map((k) => groups[k]);
    if (!arr.length) return arr;
    arr.forEach((g) => { g.typeCount = Object.keys(g.types).length; g.typeTop = Object.keys(g.types).sort((a, b) => g.types[b] - g.types[a])[0] || ""; g.fitRatio = g.fit / g.items.length; g.footAvg = g.foot / g.items.length; g.ext = regionStats[g.key] || null; });
    const norm = (sel) => { const m = Math.max(1e-9, ...arr.map(sel)); return (g) => sel(g) / m; };
    const nFit = norm((g) => g.fitRatio), nFoot = norm((g) => g.footAvg), nN = norm((g) => g.items.length);
    const hasFit = tgtKeys.length || bizKeys.length || cats.length;
    const maxFitRatio = Math.max(1e-9, ...arr.map((g) => g.fitRatio));
    arr.forEach((g) => {
      let s = hasFit ? (0.55 * nFit(g) + 0.25 * nFoot(g) + 0.20 * nN(g)) : (0.6 * nFoot(g) + 0.4 * nN(g));
      // 적합 신호가 있을 때, 최상위 대비 적합도가 바닥(부분매칭 수준)인 지역은 강등 → 유동만으로 상위 오르는 것 방지
      if (hasFit && g.fitRatio < maxFitRatio * 0.2) s *= 0.15;
      // ⓒ 외부 정밀집계(region-stats.json) 가중 — 있는 필드만 반영(graceful). 5지표+VAI+연령.
      s += regionExtBoost(g, crit, tgtStr);
      // ★ 상권 지배 업종이 캠페인 업종과 맞으면 가중(유동 숫자 외에 '상권 성격'을 반영). profile 없으면 영향 없음.
      g.profile = areaProfile(g.key);
      if (plannerBiz && g.profile && g.profile.biz && g.profile.biz.indexOf(plannerBiz) >= 0) s *= 1.3;
      g.score = s;
    });
    arr.sort((a, b) => (b.score - a.score) || (b.foot - a.foot));
    // 적합 신호가 있으면, 최상위 대비 적합도가 바닥(부분매칭 수준)인 지역은 후보에서 제외(최소 3곳은 유지).
    // 후보 지역 = 적합도 바닥 아니고(부분매칭 배제) + 최소 3매체 이상(1~2매체짜리 '건물명 오매칭' 지역 제외). 최소 3곳 유지.
    let out = arr;
    if (hasFit) { const kept = arr.filter((g) => g.fitRatio >= maxFitRatio * 0.2 && g.items.length >= 3 && g.fit >= 2); out = kept.length >= 3 ? kept : arr.filter((g) => g.items.length >= 3).slice(0, 3); if (out.length < 3) out = arr.slice(0, 3); }
    const top = out[0] ? out[0].score || 1 : 1;
    out.forEach((g, i) => { g.rel = Math.round(g.score / top * 100); g.rank = i + 1; });
    return out;
  }
  // 후보 집합 내 백분위(0~1, 1=최상위) — 지역 상대 장단점 산출용.
  function regionRankPct(arr, sel, g) {
    if (arr.length <= 1) return 1;
    const v = sel(g); const below = arr.filter((x) => sel(x) < v).length;
    return below / (arr.length - 1);
  }
  // 대표 매체유형 → 상권 성격 구절(근거 문장·설명용).
  function typePhrase(t) {
    t = t || "";
    if (/전광판|빌보드|led|옥상|미디어/i.test(t)) return "대형 전광판 중심";
    if (/편의점/.test(t)) return "편의점 생활매체 중심";
    if (/엘리베이터|엘베|타운보드/.test(t)) return "엘리베이터 생활매체 중심";
    if (/지하철|역사|승강장|철도|스크린도어/.test(t)) return "지하철 역사매체 중심";
    if (/버스|쉘터|정류장/.test(t)) return "버스 교통매체 중심";
    if (/공항|터미널/.test(t)) return "교통거점 매체 중심";
    if (/쇼핑|몰|마트|did|리테일/i.test(t)) return "쇼핑몰 매체 중심";
    return (t ? t + " 중심" : "혼합 매체");
  }
  // 지역 상대 장단점 — 후보 지역들과 비교해 '강점/약점'을 가공 근거로 자동 생성(근거 없는/혼동 배지 제외).
  function regionProsCons(g, arr) {
    const pros = [], cons = [];
    const pFit = regionRankPct(arr, (x) => x.fitRatio, g);
    const pFoot = regionRankPct(arr, (x) => x.foot, g);   // 표시값(총 유동)과 같은 기준으로 강약점 산출
    const pN = regionRankPct(arr, (x) => x.items.length, g);
    if (pFit >= 0.7) pros.push("타깃 적합 높음");
    if (pFoot >= 0.8) pros.push("유동 최상위"); else if (pFoot >= 0.6) pros.push("유동 상위"); else if (pFoot <= 0.2) cons.push("유동 낮음");
    if (pN >= 0.7) pros.push("매체 선택폭 넓음"); else if (pN <= 0.15) cons.push("매체 수 적음");
    if (g.ext) { if (g.ext.age2030 >= 0.37) pros.push("2030 밀집"); if (g.ext.weekend >= 0.45) pros.push("주말 강세"); else if (g.ext.weekend <= 0.35) cons.push("주말 약함"); }
    if (!pros.length && !cons.length) pros.push("균형형"); // 뚜렷한 강약점 없음
    return { pros: pros.slice(0, 3), cons: cons.slice(0, 2) };
  }
  // 후보 집합 내 순위(1=최상). 동점이면 같은 순위.
  function rankPos(arr, sel, g) { const v = sel(g); return arr.filter((x) => sel(x) > v).length + 1; }
  // 받침 유무로 조사 은/는 선택.
  function josaEN(w) { const c = (w || "").charCodeAt((w || "").length - 1); if (c < 0xAC00 || c > 0xD7A3) return "은"; return ((c - 0xAC00) % 28) ? "은" : "는"; }
  // 지역별 '왜 이 순위·왜 적합한지' 한 문장 근거 — 지역마다 강점(1위 지표)·트레이드오프를 다르게 서술.
  function regionSummary(g, arr) {
    const dom = g.typeTop || "";
    const n = arr.length;
    const metrics = [["타깃 적합도", rankPos(arr, (x) => x.fitRatio, g)], ["유동", rankPos(arr, (x) => x.foot, g)], ["매체 선택폭", rankPos(arr, (x) => x.items.length, g)]];
    const best = metrics.slice().sort((a, b) => a[1] - b[1])[0];
    const worst = metrics.slice().sort((a, b) => b[1] - a[1])[0];
    const lead = best[1] <= 3 ? `${best[0]} ${best[1]}위` : `${best[0]} 양호`;
    const weak = (n >= 4 && worst[1] !== best[1] && worst[1] >= Math.ceil(n * 0.6)) ? ` 다만 ${worst[0]}${josaEN(worst[0])} 상위권 대비 낮습니다.` : "";
    const prof = g.profile || areaProfile(g.key);
    // 상권 성격(지배 업종·시설)을 앞에 세워 설득력 강화. 없으면 매체유형 기반 서술.
    const head = prof ? `${prof.trait}.` : `${typePhrase(dom)} 상권.`;
    // 매체는 단정 짓지 않음 — 같은 상권도 '캠페인 목적'(런칭·신제품 고지·인지도=임팩트 / 지속·효율=교통매체)에 따라 믹스가 달라짐.
    // (브랜드 티어로 못박지 않음: 저가도 런칭이면 대형 전광판, 고가도 지속이면 교통매체를 쓸 수 있음.)
    const topTypes = Object.keys(g.types || {}).sort((a, b) => g.types[b] - g.types[a]);
    const typesTxt = topTypes.slice(0, 3).join("·");
    const media = g.typeCount >= 3 ? ` ${typesTxt} 등 ${g.typeCount}종 매체가 있어 목적에 따라 임팩트↔지속 믹스를 설계할 수 있습니다.`
      : g.typeCount === 2 ? ` ${typesTxt} 중심으로, 목적에 맞춰 믹스가 가능합니다.`
      : topTypes.length ? ` ${typesTxt} 중심 상권입니다.` : "";
    return `${head} ${lead}.${media}${weak}`.replace(/\s+/g, " ").trim();
  }
  // 전략별 선택 지역 키 집합. null = 지역 제한 없음(전체/와이드).
  function strategyRegionKeys(ranking, strat) {
    if (!ranking.length) return null;
    if (strat === "all") return null;                                            // 전체 분산
    if (strat === "topN") return ranking.slice(0, plannerRegionN).map((g) => g.key); // 상위 3곳
    return [ranking[0].key];                                                     // core1 = 1곳 집중
  }
  // 라운드로빈 섞기 — keyFn 기준으로 고르게 분산(유형 다양화 / 지역 분산 공용).
  function roundRobin(arr, keyFn) {
    const buckets = {}; const order = [];
    arr.forEach((f) => { const k = keyFn(f) || "기타"; if (!buckets[k]) { buckets[k] = []; order.push(k); } buckets[k].push(f); });
    const out = []; let added = true;
    while (added) { added = false; order.forEach((k) => { if (buckets[k].length) { out.push(buckets[k].shift()); added = true; } }); }
    return out;
  }
  function interleaveByType(arr) { return roundRobin(arr, (f) => f.type || "기타"); }
  function interleaveByRegion(arr) { return roundRobin(arr, (f) => planRegionKeyOf(f)); }
  // 전략(시나리오·커버·매체·기간) 하나로 최종 매체 slug 목록 산출.
  function buildPlanSlugs(crit, strat, cap) {
    planEffDays = strat.period || 30;
    let base = candidatePool(crit);
    // 지역 커버리지 전략 적용(지역 직접 지정 안 했을 때만)
    if (regionLayerActive()) {
      const keys = strategyRegionKeys(buildRegionRanking(crit), plannerRegionStrat);
      if (keys) { const set = {}; keys.forEach((k) => { set[k] = 1; }); base = base.filter((f) => set[planRegionKeyOf(f)]); }
    }
    let arr = applyMedia(applyCoverage(orderByScenario(base, strat.scenario), strat.coverage), strat.media);
    if (regionLayerActive() && plannerRegionStrat === "all") arr = interleaveByRegion(arr); // 전체 분산 시 여러 지역에 고르게
    if (planEffDays < 30) arr = arr.filter((f) => f.shortTerm).concat(arr.filter((f) => !f.shortTerm)); // 단기면 단기요율 보유 우선
    // 가격 있는 매체 우선 — 패키지·상담가(월정가 0) 매체가 상위를 메워 합계가 '상담'으로 뜨는 것 방지(순서는 전략 내 안정 유지)
    arr = arr.filter((f) => (f.monthly || 0) > 0).concat(arr.filter((f) => !((f.monthly || 0) > 0)));
    if (plannerBudget > 0) {
      // 예산 내에서 '가격이 있는' 매체만 채움 → 예산·조정지표(기간·매체)에 따라 매체 수가 실제로 달라짐
      const b = plannerBudget * 10000; let sum = 0; const picked = [];
      arr.forEach((f) => { const c = planPriceForDays(f, planEffDays); if (c > 0 && sum + c <= b) { picked.push(f); sum += c; } });
      arr = picked.length ? picked : arr.slice(0, 3);
    }
    return arr.slice(0, cap || 8).map((f) => f.favId).filter(Boolean);
  }
  // 안별 매체 수 상한 — 대안①(분산·효율)=더 많이, 대안②(핵심·임팩트)=더 적게. 예산·기간과 함께 변별.
  // period 인자를 주면(선택 안+레버 조정 기간) 그 기간 기준으로 상한 산정.
  function anCap(a, period) {
    const base = planCapFor(period != null ? period : (a && a.period) || 30);
    if (!a) return base;
    if (a.k === "alt1") return Math.min(15, Math.round(base * 1.5));
    if (a.k === "alt2") return Math.max(3, Math.round(base * 0.65));
    return base;
  }
  // 추천안 정의: 맞춤 + AI 대안 2(의도적으로 맞춤과 다르게). 선택한 안엔 레버 오버라이드 적용.
  function planAns() {
    const ip = plannerPeriodDays;
    const shortP = ip >= 30 ? 15 : ip;
    const ob = curObjective();
    return [
      { k: "custom", label: "맞춤 추천안", note: `목적: ${ob.l} — ${ob.note}`, scenario: ob.scenario, coverage: ob.coverage, media: ob.media, period: ip },
      { k: "alt1", label: "AI 대안 ① 효율·분산", note: `기간을 줄여(${periodLabel(shortP)}) 매체 수↑ · 같은 예산에 넓게`, scenario: "eff", coverage: "wide", media: "life", period: shortP },
      { k: "alt2", label: "AI 대안 ② 핵심·임팩트", note: "핵심 상권 대형 매체에 집중 (주목도↑)", scenario: "reach", coverage: "focus", media: "impact", period: ip },
    ];
  }
  function activeStrat() {
    const base = planAns().find((a) => a.k === plannerAnKey) || planAns()[0];
    return Object.assign({}, base, plannerLever);
  }
  // 각 안의 미리보기 지표(매체수·노출·CPM) — 카드용
  function ansPreview(crit) {
    const saved = planEffDays;
    const out = planAns().map((a) => {
      const its = itemsForSlugs(buildPlanSlugs(crit, a, anCap(a)));
      const ots = planOts(its);
      const cost = its.reduce((s, f) => s + planPriceForDays(f, a.period), 0);
      return Object.assign({}, a, { n: its.length, ots, cost, cpm: planCpm(cost, ots) });
    });
    planEffDays = saved;
    return out;
  }
  // 선택한 안(+레버)을 반영해 ①전용 세트 산출. ②관심매체 미변경. 직접 담은/뺀 결정 보존.
  function applyPlan() {
    const crit = planCriteria();
    const strat = activeStrat();
    const curAn = planAns().find((x) => x.k === plannerAnKey) || planAns()[0];
    const rec = buildPlanSlugs(crit, strat, anCap(curAn, strat.period)).filter((s) => !plannerRemoved.has(s));
    const added = Array.from(plannerAdded).filter((s) => favorites.indexOf(s) >= 0);
    plannerSlugs = rec.concat(added.filter((s) => rec.indexOf(s) < 0));
    planEffDays = strat.period || 30;
    Array.from(plannerExcluded).forEach((s) => { if (plannerSlugs.indexOf(s) < 0) plannerExcluded.delete(s); });
    return crit;
  }
  function planIncludedItems() { return itemsForSlugs(plannerSlugs).filter((f) => !plannerExcluded.has(f.favId)); }
  // AI 추천 미디어플랜 엑셀 — 요약·매체리스트·믹스/역할·기간시나리오(가공 지표 포함). 입금가·마진 미표시.
  async function downloadPlanExcel() {
    const items = planIncludedItems();
    if (!items.length) { window.alert("추천 매체가 없습니다."); return; }
    const crit = planCriteria();
    const strat = activeStrat();
    const days = strat.period || planEffDays || 30;
    const agg = planAggregate(items, days);
    const covLabel = (PLAN_COVERAGE.find((c) => c.k === strat.coverage) || {}).l || "";
    const anLabel = (planAns().find((a) => a.k === plannerAnKey) || {}).label || "맞춤 추천안";
    const areaKeys = (crit.areaKeys || []).map((k) => k.toLowerCase());
    const fitOf = (f) => { const t = `${f.name || ""} ${f.area || ""} ${f.address || ""}`.toLowerCase(); return areaKeys.some((k) => t.indexOf(k) >= 0); };
    const fit = (areaKeys.length && items.length) ? Math.round(items.filter(fitOf).length / items.length * 100) : null;
    const supply = Math.round(agg.cost), vat = Math.round(agg.cost * 0.1), total = supply + vat;
    const footOf = (f) => f.foot500Num || f.subwayNum || f.busNum || "";
    const reasonOf = (f) => [planRole(f).l, fitOf(f) ? "타깃 지역 접점" : "", f.shortTerm ? "단기 집행 가능" : ""].filter(Boolean).join(" · ");
    try {
      const ExcelJS = await loadExcelJS();
      const wb = new ExcelJS.Workbook(); wb.creator = "광고플레이";
      const NAVY = "FF2540EA", HEAD = "FFFFFFFF", SECT = "FFE8ECFF", ZEBRA = "FFF5F7FD", LINE = "FFD9DDE4", MUTED = "FF667085";
      const WON = '#,##0', NUM = '#,##0', FRE = '0.0';
      const edge = { style: "thin", color: { argb: LINE } };
      const box = { top: edge, left: edge, bottom: edge, right: edge };
      const headerRow = (rw) => { rw.eachCell((cc) => { cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; cc.font = { bold: true, color: { argb: HEAD }, size: 10 }; cc.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; cc.border = box; }); rw.height = 26; };
      const sect = (ws, a1, a2, text) => { ws.mergeCells(a1 + ":" + a2); const cc = ws.getCell(a1); cc.value = text; cc.font = { bold: true, color: { argb: NAVY }, size: 11 }; cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECT } }; ws.getRow(cc.row).height = 20; };

      // ===== 1. 표지·요약 =====
      const s1 = wb.addWorksheet("표지·요약", { views: [{ showGridLines: false }] });
      s1.columns = [{ width: 30 }, { width: 26 }, { width: 24 }, { width: 22 }];
      s1.mergeCells("A1:D1"); let c = s1.getCell("A1"); c.value = "AI 추천 미디어플랜"; c.font = { bold: true, size: 20, color: { argb: NAVY } }; s1.getRow(1).height = 32;
      s1.mergeCells("A2:D2"); c = s1.getCell("A2"); c.value = `${anLabel}${covLabel ? " · " + covLabel : ""}   ·   ${crit.bizLabel || "맞춤"}   ·   ${periodLabel(days)}`; c.font = { color: { argb: MUTED }, size: 11 };
      let r = 4; sect(s1, "A" + r, "D" + r, "■ 캠페인 조건"); r++;
      [["업종", crit.bizLabel || "-"], ["타깃", (crit.tgtLabels || []).join(", ") || "-"], ["지역", plannerRegions.length ? plannerRegions.map(regionTokenLabel).join(", ") : "전국"], ["집행 기간", periodLabel(days)], ["예산 상한", plannerBudget ? plannerBudget.toLocaleString() + "만원" : "제한 없음"], ["추천안", anLabel]].forEach(([k, v]) => { const rr = s1.getRow(r++); rr.getCell(1).value = k; rr.getCell(1).font = { bold: true, color: { argb: MUTED } }; s1.mergeCells(`B${rr.number}:D${rr.number}`); rr.getCell(2).value = v; });
      r++; sect(s1, "A" + r, "D" + r, "■ 예상 성과 (정부 유동 실측 기반 추정)"); r++;
      const kpis = [["예상 도달(명)", Math.round(agg.reach)], ["평균 빈도(회/1인)", agg.freq ? Number(agg.freq.toFixed(1)) : ""], ["예상 노출/OTS(명)", Math.round(agg.ots)], ["CPM(원·1,000노출)", agg.cpm ? Math.round(agg.cpm) : ""], ["타깃 적합도(%)", fit == null ? "" : fit], ["매체 / 지역 수", items.length + " / " + new Set(items.map((f) => sidoShort(f.address))).size]];
      for (let i = 0; i < kpis.length; i += 2) { const rr = s1.getRow(r++); rr.height = 20; [[1, kpis[i]], [3, kpis[i + 1]]].forEach(([col, kp]) => { rr.getCell(col).value = kp[0]; rr.getCell(col).font = { bold: true, color: { argb: MUTED }, size: 10 }; const vc = rr.getCell(col + 1); vc.value = kp[1]; vc.font = { bold: true, size: 13, color: { argb: NAVY } }; if (typeof kp[1] === "number") vc.numFmt = NUM; }); }
      r++; sect(s1, "A" + r, "D" + r, "■ 집행 금액 (부가세 별도, 추정)"); r++;
      [["광고비 (공급가)", supply, false], ["부가세 10%", vat, false], ["집행 총액 (VAT 포함)", total, true]].forEach(([k, v, bold]) => { const rr = s1.getRow(r++); rr.getCell(1).value = k; rr.getCell(1).font = { bold: !!bold, color: { argb: bold ? NAVY : MUTED } }; s1.mergeCells(`B${rr.number}:C${rr.number}`); const vc = rr.getCell(2); vc.value = v; vc.numFmt = WON; vc.alignment = { horizontal: "right" }; if (bold) vc.font = { bold: true, size: 13, color: { argb: NAVY } }; rr.getCell(4).value = "원"; });
      r++; s1.mergeCells("A" + r + ":D" + r); c = s1.getCell("A" + r); c.value = "※ 제작·출력·설치비는 매체별 별도 견적. ※ 노출·도달·빈도·CPM은 정부 유동 실측 기반 추정치로 디지털 클릭·전환과 다르며 실제 집행 시 변동될 수 있습니다. ※ 노출력 등급(β)은 국토교통부·중소벤처기업부 등 공공데이터와 매체 규격·형태·설치·접점 지표 기반 자동 산정 시범값(유형 내 상대평가, 실측 튜닝 전). 산정 기준: grade-method.html. 입금가·마진 미표시."; c.font = { color: { argb: MUTED }, size: 9, italic: true }; c.alignment = { wrapText: true }; s1.getRow(r).height = 40;
      r += 2; s1.mergeCells("A" + r + ":D" + r); c = s1.getCell("A" + r); c.value = "복제 불가 · 저작권자 © 광고플레이(주) (Adplay Korea Co., Ltd.) All Rights Reserved."; c.font = { color: { argb: NAVY }, size: 9, bold: true }; c.alignment = { horizontal: "center" };

      // ===== 2. 매체 상세 =====
      const s2 = wb.addWorksheet("매체 상세", { views: [{ state: "frozen", ySplit: 1 }] });
      var relMap = {};
      try { if (window.MediaGrade && window.MediaGrade.assignRelativeGrades && typeof mediaWithLocations !== "undefined" && mediaWithLocations) window.MediaGrade.assignRelativeGrades(mediaWithLocations, { within: true }).forEach(function (s) { relMap[s.item.slug] = s.g; }); } catch (e) {}
      var gradeOf = function (f) { if (relMap[f.favId]) return relMap[f.favId]; if (!window.MediaGrade) return null; try { return window.MediaGrade.gradeMedia({ category: f.category, sizeText: f.size, mediaType: f.type, address: f.address, areaName: f.area }); } catch (e) { return null; } };
      s2.addRow(["No", "지역", "매체명", "유형", "역할", "규격", "일 유동(명)", "예상 노출", "예상 도달", "빈도(회)", "CPM(원)", `${periodLabel(days)} 금액(원)`, "단기", "선정 이유", "노출력 등급(β)", "접점 유형", "특성 키워드"]); headerRow(s2.getRow(1));
      s2.columns = [5, 9, 24, 14, 10, 14, 11, 12, 11, 8, 10, 15, 7, 30, 13, 14, 26].map((w) => ({ width: w }));
      items.forEach((f, i) => {
        const exp = planExposure(f, days), reach = planReachOf(f, days), price = planPriceForDays(f, days);
        const g = gradeOf(f);
        const row = s2.addRow([i + 1, sidoShort(f.address), f.name, f.type, planRole(f).l, f.size, footOf(f), Math.round(exp), Math.round(reach), Number(planFreqFactor(f).toFixed(1)), exp ? Math.round(price / (exp / 1000)) : "", Math.round(price), f.shortTerm ? "가능" : "협의", reasonOf(f), g ? (g.relGrade || g.grade) : "-", g ? g.context.label : "-", g ? g.badges.join(" · ") : ""]);
        row.eachCell((cc, col) => { cc.border = box; if (!cc.font) cc.font = { size: 9.5 }; if (col >= 7 && col <= 12) { cc.numFmt = col === 10 ? FRE : NUM; cc.alignment = { horizontal: "right" }; } if (col === 15 && cc.value && cc.value !== "-") { cc.font = { bold: true, color: { argb: NAVY }, size: 9.5 }; cc.alignment = { horizontal: "center" }; } });
        if (i % 2) row.eachCell((cc) => { if (!cc.fill) cc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } }; });
      });
      const totR = s2.addRow(["", "합계", `${items.length}개 매체`, "", "", "", "", Math.round(agg.ots), Math.round(agg.reach), agg.freq ? Number(agg.freq.toFixed(1)) : "", agg.cpm ? Math.round(agg.cpm) : "", supply, "", "VAT 별도"]);
      totR.eachCell((cc, col) => { cc.font = { bold: true, color: { argb: NAVY } }; cc.border = box; if (col >= 8 && col <= 12) { cc.numFmt = col === 10 ? FRE : NUM; cc.alignment = { horizontal: "right" }; } });

      // ===== 3. 안별 구성 (3안 비교 + 포함 매트릭스) =====
      const s3 = wb.addWorksheet("안별 구성");
      s3.columns = [{ width: 22 }, { width: 26 }, { width: 11 }, { width: 9 }, { width: 13 }, { width: 12 }, { width: 15 }];
      const savedEff = planEffDays;
      const ans = planAns().map((a) => { const sl = buildPlanSlugs(crit, a, anCap(a)); const its = itemsForSlugs(sl); return { a, sl, its, ag: planAggregate(its, a.period) }; });
      planEffDays = savedEff;
      s3.mergeCells("A1:G1"); c = s3.getCell("A1"); c.value = "추천안 3종 비교"; c.font = { bold: true, size: 14, color: { argb: NAVY } }; s3.getRow(1).height = 24;
      s3.addRow([]); s3.addRow(["추천안", "전략", "기간", "매체 수", "예상 노출", "예상 도달", "집행 금액(원)"]); headerRow(s3.getRow(3));
      ans.forEach(({ a, its, ag }) => { const row = s3.addRow([a.label, a.note, periodLabel(a.period), its.length, Math.round(ag.ots), Math.round(ag.reach), Math.round(ag.cost)]); row.eachCell((cc, col) => { cc.border = box; if (!cc.font) cc.font = { size: 9.5 }; if (col >= 4) { cc.numFmt = NUM; cc.alignment = { horizontal: "right" }; } }); if (a.k === plannerAnKey) row.eachCell((cc) => { cc.font = { bold: true, color: { argb: NAVY }, size: 9.5 }; }); });
      s3.addRow([]); const mt = s3.addRow(["매체별 포함 (● = 해당 안에 포함)"]); s3.mergeCells(`A${mt.number}:G${mt.number}`); mt.getCell(1).font = { bold: true, color: { argb: NAVY } }; mt.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SECT } };
      const uni = []; ans.forEach(({ sl }) => sl.forEach((s) => { if (uni.indexOf(s) < 0) uni.push(s); }));
      s3.addRow(["매체명", "유형", ans[0].a.label, ans[1].a.label, ans[2].a.label]); headerRow(s3.lastRow);
      uni.forEach((slug) => { const f = (itemsForSlugs([slug]) || [])[0]; if (!f) return; const row = s3.addRow([f.name, f.type, ans[0].sl.indexOf(slug) >= 0 ? "●" : "–", ans[1].sl.indexOf(slug) >= 0 ? "●" : "–", ans[2].sl.indexOf(slug) >= 0 ? "●" : "–"]); row.eachCell((cc, col) => { cc.border = box; if (col >= 3) { cc.alignment = { horizontal: "center" }; cc.font = { size: 11, bold: cc.value === "●", color: { argb: cc.value === "●" ? NAVY : LINE } }; } else cc.font = { size: 9.5 }; }); });

      // 안별 합계·KPI (● 매트릭스 열에 정렬)
      var s3sum = function (label, vals, fmt) { var row = s3.addRow([label, ""].concat(vals)); row.eachCell(function (cc, col) { cc.border = box; if (col === 1) cc.font = { bold: true, color: { argb: NAVY }, size: 9.5 }; else if (col >= 3) { cc.alignment = { horizontal: "center" }; cc.font = { bold: true, size: 9.5 }; if (fmt) cc.numFmt = NUM; } }); return row; };
      s3.addRow([]); headerRow(s3.addRow(["안별 합계·KPI", "", ans[0].a.label, ans[1].a.label, ans[2].a.label]));
      s3sum("매체 수", ans.map(function (x) { return x.its.length; }), true);
      s3sum("집행 금액(원)", ans.map(function (x) { return Math.round(x.ag.cost); }), true);
      s3sum("예상 노출(명)", ans.map(function (x) { return Math.round(x.ag.ots); }), true);
      s3sum("예상 도달(명)", ans.map(function (x) { return Math.round(x.ag.reach); }), true);
      s3sum("CPM(원)", ans.map(function (x) { return x.ag.cpm ? Math.round(x.ag.cpm) : ""; }), true);

      // ===== 4. 믹스·역할 =====
      const s4 = wb.addWorksheet("믹스·역할");
      s4.columns = [{ width: 18 }, { width: 15 }, { width: 10 }, { width: 24 }];
      const byType = {}, byRole = {};
      items.forEach((f) => { const t = f.type || "기타"; byType[t] = (byType[t] || 0) + planPriceForDays(f, days); const ro = planRole(f).l; byRole[ro] = (byRole[ro] || 0) + 1; });
      const totalCost = agg.cost || 1;
      s4.mergeCells("A1:D1"); c = s4.getCell("A1"); c.value = "■ 유형별 예산 믹스"; c.font = { bold: true, color: { argb: NAVY }, size: 12 };
      s4.addRow(["매체 유형", "금액(원)", "비중(%)", "비중 막대"]); headerRow(s4.getRow(2));
      Object.keys(byType).sort((a, b) => byType[b] - byType[a]).forEach((t) => { const pv = Math.round(byType[t] / totalCost * 100); const row = s4.addRow([t, Math.round(byType[t]), pv, "█".repeat(Math.max(1, Math.round(pv / 5)))]); row.getCell(2).numFmt = WON; row.getCell(2).alignment = { horizontal: "right" }; row.getCell(3).alignment = { horizontal: "right" }; row.getCell(4).font = { color: { argb: NAVY } }; row.eachCell((cc) => cc.border = box); });
      s4.addRow([]); const rh = s4.addRow(["■ 역할별 분포"]); s4.mergeCells(`A${rh.number}:D${rh.number}`); rh.getCell(1).font = { bold: true, color: { argb: NAVY }, size: 12 };
      s4.addRow(["역할", "매체 수", "비중 막대", ""]); headerRow(s4.lastRow);
      Object.keys(byRole).forEach((ro) => { const row = s4.addRow([ro, byRole[ro], "█".repeat(Math.max(1, byRole[ro])), ""]); row.getCell(2).alignment = { horizontal: "right" }; row.getCell(3).font = { color: { argb: NAVY } }; [1, 2, 3].forEach((col) => row.getCell(col).border = box); });

      // ===== 5. 기간 시나리오 =====
      const s5 = wb.addWorksheet("기간 시나리오");
      s5.columns = [{ width: 12 }, { width: 9 }, { width: 14 }, { width: 13 }, { width: 15 }, { width: 11 }];
      s5.mergeCells("A1:F1"); c = s5.getCell("A1"); c.value = "■ 집행 기간별 성과 시나리오 (추정)"; c.font = { bold: true, color: { argb: NAVY }, size: 12 };
      s5.addRow(["집행 기간", "매체 수", "예상 노출", "예상 도달", "집행 금액(원)", "CPM(원)"]); headerRow(s5.getRow(2));
      [15, 30, 90].forEach((d) => { const a = planAggregate(items, d); const row = s5.addRow([periodLabel(d), items.length, Math.round(a.ots), Math.round(a.reach), Math.round(a.cost), a.cpm ? Math.round(a.cpm) : ""]); row.eachCell((cc, col) => { cc.border = box; if (col >= 3) { cc.numFmt = NUM; cc.alignment = { horizontal: "right" }; } if (d === days) cc.font = { bold: true, color: { argb: NAVY } }; }); });

      const buf = await wb.xlsx.writeBuffer();
      saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `AI추천_미디어플랜_${(crit.bizLabel || "맞춤")}.xlsx`);
    } catch (e) { console.warn("plan xlsx 실패", e); window.alert("엑셀 생성에 실패했습니다."); }
  }
  // 받기(엑셀/PPT/지도링크)는 ②의 검증된 함수를 그대로 쓰되, 호출 순간만 데이터를 플래너 것으로 바꿔치기 후 복원.
  function withPlannerData(fn) {
    const savedFav = favorites.slice();
    const savedExcl = Array.from(favExcluded);
    favorites.length = 0; plannerSlugs.forEach((s) => favorites.push(s));
    favExcluded.clear(); plannerExcluded.forEach((s) => favExcluded.add(s));
    try { fn(); } finally {
      favorites.length = 0; savedFav.forEach((s) => favorites.push(s));
      favExcluded.clear(); savedExcl.forEach((s) => favExcluded.add(s));
    }
  }
  function reapplyPlanner(bodyEl, footEl) {
    applyPlan();
    renderPlannerResult(bodyEl, footEl, {});
  }
  // 큰 숫자를 억/만 단위로 축약(예: 1,420,000 → 142만, 120,000,000 → 1.2억)
  function planFmtEok(n) {
    if (!n) return "—";
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, "") + "억";
    if (n >= 10000) return Math.round(n / 10000).toLocaleString() + "만";
    return Math.round(n).toLocaleString();
  }
  function plannerChooserHtml() {
    // 지역 = 시·도 드롭다운(전국/수도권/지방 + 시도) → 구 선택 → 우측 칩 누적
    const sidoSel = `<select class="map-plan-sel" id="mapPlanSido" aria-label="지역 추가">
        <option value="">＋ 지역 추가</option>
        <option value="__all">전국</option>
        <option value="__metro">수도권</option>
        <option value="__local">지방</option>
        <option value="" disabled>──────</option>
        ${PLAN_SIDOS.map((s) => `<option value="${s}"${plannerAddSido === s ? " selected" : ""}>${s}</option>`).join("")}
      </select>`;
    const guSel = plannerAddSido ? `<select class="map-plan-sel" id="mapPlanGu" aria-label="구·시 선택"><option value="">구·시 선택</option><option value="*">${AdPlay.esc(plannerAddSido)} 전체</option>${planGuOptions(plannerAddSido).map((g) => `<option value="${g}">${g}</option>`).join("")}</select>` : "";
    const regionChips = plannerRegions.length
      ? plannerRegions.map((r, i) => `<button type="button" class="map-plan-chip is-on" data-region-rm="${i}" title="제거">${AdPlay.esc(regionTokenLabel(r))} ✕</button>`).join("")
      : `<span class="map-plan-chip is-ghost">전국</span>`;
    const objChips = PLAN_OBJECTIVES.map((o) => `<button type="button" class="map-plan-chip map-plan-objchip${plannerObjective === o.k ? " is-on" : ""}" data-obj="${o.k}" title="${AdPlay.esc(o.note)}">${AdPlay.esc(o.l)}</button>`).join("");
    const budgetChips = PLAN_BUDGETS.map((b) => `<button type="button" class="map-plan-chip map-plan-bchip${plannerBudget === b.v ? " is-on" : ""}" data-budget="${b.v}">${b.l}</button>`).join("");
    const bizChips = MATCH_THEMES.filter((t) => t.type === "biz").map((t) => `<button type="button" class="map-plan-chip${plannerBiz === t.key ? " is-on" : ""}" data-biz="${t.key}">${AdPlay.esc(t.label)}</button>`).join("");
    const bizCustomChip = plannerBizCustom ? `<button type="button" class="map-plan-chip is-custom is-on" data-bizcustom-rm title="기타 업종 제거">기타: ${AdPlay.esc(plannerBizCustom)} ✕</button>` : "";
    const bizCustomInput = plannerBizCustom ? "" : `<input type="text" class="map-plan-custom-input" data-custom="biz" placeholder="기타 입력 ⏎" maxlength="12">`;
    const tgtChips = MATCH_THEMES.filter((t) => t.type === "tgt").map((t) => `<button type="button" class="map-plan-chip is-tgt${plannerTargets.indexOf(t.key) >= 0 ? " is-on" : ""}" data-tgt="${t.key}">${AdPlay.esc(t.label)}</button>`).join("");
    const tgtCustomChips = plannerCustoms.map((v) => `<button type="button" class="map-plan-chip is-tgt is-custom is-on" data-tgtcustom="${AdPlay.esc(v)}" title="제거">${AdPlay.esc(v)} ✕</button>`).join("");
    const tgtCustomInput = `<input type="text" class="map-plan-custom-input" data-custom="tgt" placeholder="기타 입력 ⏎" maxlength="12">`;
    const mtChips = PLAN_MEDIA_TYPES.map((m) => `<button type="button" class="map-plan-chip${plannerMediaType === m.k ? " is-on" : ""}" data-mtype="${m.k}">${m.l}</button>`).join("");
    // 상품(세부) 하위 칩 행 — 선택한 업종/타깃에 세부유형이 있으면 노출. 고르면 그 상권으로 지역 추천이 정교해짐.
    const subRow = (parentKey, parentLabel) => {
      const list = PLAN_SUBTYPES[parentKey]; if (!list) return "";
      const chips = list.map((s) => `<button type="button" class="map-plan-chip map-plan-subchip${plannerSubtypes[parentKey] === s.k ? " is-on" : ""}" data-subtype="${parentKey}:${s.k}">${AdPlay.esc(s.l)}</button>`).join("");
      return `<div class="map-plan-row map-plan-subrow"><span class="map-plan-tag map-plan-subtag">${AdPlay.esc(parentLabel)} 상품</span><div class="map-plan-chips">${chips}</div></div>`;
    };
    const bizSubRow = plannerBiz ? subRow(plannerBiz, (MATCH_THEMES.find((x) => x.key === plannerBiz) || {}).label || "업종") : "";
    const tgtSubRows = plannerTargets.filter((k) => PLAN_SUBTYPES[k]).map((k) => subRow(k, (MATCH_THEMES.find((x) => x.key === k) || {}).label || "타깃")).join("");
    const periodChips = PLAN_PERIODS.map((p) => `<button type="button" class="map-plan-chip${plannerPeriodDays === p.d ? " is-on" : ""}" data-period="${p.d}">${p.l}</button>`).join("");
    const isCustomPeriod = !PLAN_PERIODS.some((p) => p.d === plannerPeriodDays);
    return `<div class="map-plan-chooser" id="mapPlanChooser">
        <div class="map-plan-row"><span class="map-plan-tag">목적</span><div class="map-plan-chips">${objChips}</div></div>
        <div class="map-plan-row"><span class="map-plan-tag">지역</span><div class="map-plan-chips">${sidoSel}${guSel}${regionChips}</div></div>
        <div class="map-plan-row"><span class="map-plan-tag">예산</span><div class="map-plan-chips">${budgetChips}</div><span class="map-plan-budget">직접 총 <input type="number" id="mapPlanBudget" min="0" step="100" inputmode="numeric" placeholder="제한 없음" value="${plannerBudget || ""}"><em>만원</em></span></div>
        <div class="map-plan-row"><span class="map-plan-tag">기간</span><div class="map-plan-chips">${periodChips}</div><span class="map-plan-budget">직접 <input type="number" id="mapPlanPeriodCustom" min="1" max="365" inputmode="numeric" placeholder="일수" value="${isCustomPeriod ? plannerPeriodDays : ""}"><em>일</em></span></div>
        <div class="map-plan-row"><span class="map-plan-tag">업종</span><div class="map-plan-chips">${bizChips}${bizCustomChip}${bizCustomInput}</div></div>
        ${bizSubRow}
        <div class="map-plan-row"><span class="map-plan-tag">타깃<em class="map-plan-tag-sub">복수</em></span><div class="map-plan-chips">${tgtChips}${tgtCustomChips}${tgtCustomInput}</div></div>
        ${tgtSubRows}
        <div class="map-plan-row"><span class="map-plan-tag">매체<em class="map-plan-tag-sub">선택</em></span><div class="map-plan-chips">${mtChips}</div></div>
      </div>`;
  }
  function renderPlannerInto(bodyEl, footEl) {
    if (!bodyEl) return;
    plannerBody = bodyEl; plannerFoot = footEl;
    applyPlan(); // 첫 진입부터 기본(뷰티) 추천 플랜이 바로 보이도록
    bodyEl.innerHTML = plannerChooserHtml() + '<div class="map-plan-body" id="mapPlanBodyInner"></div>';
    if (footEl) footEl.innerHTML = "";
    wireChooser(bodyEl, footEl);
    renderPlannerResult(bodyEl, footEl, {});
  }
  // 선택이 바뀌면 조건(chooser)만 다시 그려 칩/드릴다운 상태를 갱신하고(입력 포커스 보존 위해 통째 교체),
  // 플랜을 재계산해 결과를 다시 렌더한다.
  function rebuildChooser(bodyEl, footEl) {
    const host = bodyEl.querySelector("#mapPlanChooser");
    if (!host) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = plannerChooserHtml();
    host.replaceWith(tmp.firstElementChild);
    wireChooser(bodyEl, footEl);
  }
  function wireChooser(bodyEl, footEl) {
    const changeSel = () => { applyPlan(); rebuildChooser(bodyEl, footEl); renderPlannerResult(bodyEl, footEl, {}); };
    // 지역 — 범위 칩(전국/수도권/지방) + 시·도 select + 구/시 드릴다운 select
    // 지역 추가 드롭다운: 전국(비우기)/수도권/지방 토큰 or 시·도 선택(→구 목록)
    const sidoSel = bodyEl.querySelector("#mapPlanSido");
    if (sidoSel) sidoSel.addEventListener("change", () => {
      const v = sidoSel.value;
      if (v === "__all") { plannerRegions = []; plannerAddSido = ""; changeSel(); }
      else if (v === "__metro" || v === "__local") { const sc = v.slice(2); if (!plannerRegions.some((r) => r.scope === sc)) plannerRegions.push({ scope: sc }); plannerAddSido = ""; changeSel(); }
      else if (v) { plannerAddSido = v; rebuildChooser(bodyEl, footEl); }
    });
    const guSel = bodyEl.querySelector("#mapPlanGu");
    if (guSel) guSel.addEventListener("change", () => {
      if (!guSel.value) return;
      const gu = guSel.value === "*" ? "" : guSel.value;
      if (!plannerRegions.some((r) => r.sido === plannerAddSido && r.gu === gu)) plannerRegions.push({ sido: plannerAddSido, gu });
      plannerAddSido = ""; changeSel();
    });
    bodyEl.querySelectorAll("[data-region-rm]").forEach((b) => b.addEventListener("click", () => { const i = parseInt(b.getAttribute("data-region-rm"), 10); plannerRegions.splice(i, 1); changeSel(); }));
    // 목적 — 선택하면 맞춤 추천안(시나리오·매체·커버리지)과 지역 믹스 기본값을 목적이 구동. 레버 초기화 후 맞춤 안으로.
    bodyEl.querySelectorAll("[data-obj]").forEach((b) => b.addEventListener("click", () => {
      plannerObjective = b.dataset.obj;
      const ob = curObjective();
      plannerAnKey = "custom"; plannerLever = {};
      plannerRegionStrat = ob.rstrat;
      changeSel();
    }));
    // 예산 프리셋 + 직접입력
    bodyEl.querySelectorAll("[data-budget]").forEach((b) => b.addEventListener("click", () => { const v = parseInt(b.dataset.budget, 10) || 0; plannerBudget = (plannerBudget === v ? 0 : v); changeSel(); }));
    const bud = bodyEl.querySelector("#mapPlanBudget");
    if (bud) bud.addEventListener("input", (e) => {
      plannerBudget = Math.max(0, parseInt(e.target.value, 10) || 0);
      applyPlan(); renderPlannerResult(bodyEl, footEl, {});
      bodyEl.querySelectorAll("[data-budget]").forEach((c) => c.classList.toggle("is-on", plannerBudget !== 0 && parseInt(c.dataset.budget, 10) === plannerBudget));
    });
    // 집행 기간 — 프리셋 칩 + 기타(직접입력 일수)
    bodyEl.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => { plannerPeriodDays = parseInt(b.dataset.period, 10) || 30; changeSel(); }));
    const pc = bodyEl.querySelector("#mapPlanPeriodCustom");
    if (pc) pc.addEventListener("input", (e) => {
      const v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 0));
      if (!v) return;
      plannerPeriodDays = v;
      applyPlan(); renderPlannerResult(bodyEl, footEl, {});
      bodyEl.querySelectorAll("[data-period]").forEach((c) => c.classList.toggle("is-on", parseInt(c.dataset.period, 10) === plannerPeriodDays));
    });
    // 업종(단일) / 타깃(복수)
    bodyEl.querySelectorAll("[data-biz]").forEach((b) => b.addEventListener("click", () => { plannerBiz = (plannerBiz === b.dataset.biz ? "" : b.dataset.biz); changeSel(); }));
    bodyEl.querySelectorAll("[data-tgt]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.tgt; const i = plannerTargets.indexOf(k); if (i >= 0) plannerTargets.splice(i, 1); else plannerTargets.push(k); changeSel(); }));
    bodyEl.querySelectorAll("[data-subtype]").forEach((b) => b.addEventListener("click", () => { const parts = b.dataset.subtype.split(":"); const p = parts[0], k = parts[1]; plannerSubtypes[p] = (plannerSubtypes[p] === k ? "" : k); changeSel(); }));
    // 기타(직접입력) — 업종 1개, 타깃 복수
    const bizRm = bodyEl.querySelector("[data-bizcustom-rm]");
    if (bizRm) bizRm.addEventListener("click", () => { plannerBizCustom = ""; changeSel(); });
    bodyEl.querySelectorAll("[data-tgtcustom]").forEach((b) => b.addEventListener("click", () => { const v = b.getAttribute("data-tgtcustom"); plannerCustoms = plannerCustoms.filter((x) => x !== v); changeSel(); }));
    bodyEl.querySelectorAll(".map-plan-custom-input").forEach((inp) => inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return; e.preventDefault();
      const v = (inp.value || "").trim(); if (!v) return;
      if (inp.dataset.custom === "biz") plannerBizCustom = v;
      else if (plannerCustoms.indexOf(v) < 0) plannerCustoms.push(v);
      inp.value = ""; changeSel();
    }));
    // 매체유형 지정(선택, 하드) — 고르면 그 안에서 추천
    bodyEl.querySelectorAll("[data-mtype]").forEach((b) => b.addEventListener("click", () => { plannerMediaType = b.dataset.mtype; changeSel(); }));
  }
  function renderPlannerResult(bodyEl, footEl, info) {
    const inner = bodyEl.querySelector("#mapPlanBodyInner");
    if (!inner) return;
    const allItems = itemsForSlugs(plannerSlugs);
    if (!allItems.length) { inner.innerHTML = '<p class="map-plan-empty">업종·타깃을 고르거나 지도 ★로 담으면 추천 매체가 여기에 표시됩니다.</p>'; if (footEl) footEl.innerHTML = ""; return; }
    const items = allItems.filter((f) => !plannerExcluded.has(f.favId)); // 상담 대상(체크)
    const total = items.reduce((s, f) => s + planPriceForDays(f, planEffDays), 0);
    const byType = {};
    items.forEach((f) => { const t = f.type || "기타"; byType[t] = (byType[t] || 0) + planPriceForDays(f, planEffDays); });
    const entries = Object.keys(byType).map((t) => ({ t, v: byType[t] })).sort((a, b) => b.v - a.v);
    const mixBar = total ? entries.map((e, i) => `<span style="width:${(e.v / total * 100).toFixed(2)}%;background:${favTypeColor(e.t, i)}"></span>`).join("") : "";
    const mixLeg = entries.map((e, i) => `<span class="map-fav-mix-item"><i style="background:${favTypeColor(e.t, i)}"></i>${AdPlay.esc(e.t)} <b>${total ? Math.round(e.v / total * 100) : 0}%</b></span>`).join("");
    // 송출방식 믹스 — 디지털(주목) vs 고정(각인). 예산 비중 기준.
    const bc = { digital: 0, fixed: 0 };
    items.forEach((f) => { const m = broadcastMode(f); if (m) bc[m] += planPriceForDays(f, planEffDays); });
    const bcTotal = bc.digital + bc.fixed;
    const bcDig = bcTotal ? Math.round(bc.digital / bcTotal * 100) : 0;
    const bcHtml = bcTotal ? `<div class="map-plan-bcmix"><span class="bc-head">송출방식</span><span class="bc-bar"><span class="bc-seg bc-d" style="width:${bcDig}%"></span><span class="bc-seg bc-f" style="width:${100 - bcDig}%"></span></span><span class="bc-leg"><b>디지털 ${bcDig}%</b> 주목 · <b>고정 ${100 - bcDig}%</b> 각인</span></div>` : "";
    const reco = favRecommendation(items);
    const over = plannerBudget > 0 && total > plannerBudget * 10000;
    const crit = planCriteria();
    const curStrat = activeStrat();
    // 추천안 카드: 맞춤 + AI 대안(의도적으로 다르게). 레버로 조정되면 선택 안에 반영.
    // 예상 성과 지표 — 카드보다 먼저 계산(선택 안 카드에 실제값 반영 위해)
    const agg = planAggregate(items, planEffDays);
    const curOts = agg.ots;
    const curCpm = agg.cpm;
    const ans = ansPreview(crit);
    const anCards = ans.map((a) => {
      // 선택된 안은 조정(레버) 결과가 반영된 실제 값으로 표시 → 레버 누르면 위 카드 금액·CPM도 바뀜
      const sel = a.k === plannerAnKey;
      const cost = sel ? total : a.cost, per = sel ? planEffDays : a.period, n = sel ? items.length : a.n, cpm = sel ? curCpm : a.cpm;
      return `
        <button type="button" class="map-plan-sc${sel ? " is-on" : ""}" data-an="${a.k}">
          <span class="map-plan-sc-t">${AdPlay.esc(a.label)}</span>
          <span class="map-plan-sc-k">${AdPlay.esc(a.note)}</span>
          <span class="map-plan-sc-big">${cost ? planFmtEok(cost) + "원~" : "상담"}</span>
          <span class="map-plan-sc-li"><span>${AdPlay.esc(periodLabel(per))} · ${n}곳</span><b>${cpm ? "CPM ₩" + Math.round(cpm).toLocaleString() : "—"}</b></span>
        </button>`;
    }).join("");
    // 조정 레버 (방향 단어)
    const leverHtml = PLAN_LEVERS.map((pair) => `<div class="map-plan-lever-pair">${pair.map((lv) => {
      const k = Object.keys(lv.set)[0], v = lv.set[k];
      // 현재 '적용 중'인 방향을 하이라이트(선택 안의 기본 방향 + 레버 오버라이드) → 뭐가 켜져 있는지 보임
      const eff = k === "period" ? planEffDays : curStrat[k];
      const on = String(eff) === String(v);
      return `<button type="button" class="map-plan-lever${on ? " is-on" : ""}" data-lk="${k}" data-lv="${v}">${lv.l}</button>`;
    }).join("")}</div>`).join("");
    // (agg·curOts·curCpm 은 위에서 이미 계산 — 선택 안 카드 반영용)
    const sidos = {}; items.forEach((f) => { sidos[favRegionLabel(f).split(" ")[0]] = 1; });
    const regionCount = Object.keys(sidos).length;
    const areaKeys = crit.areaKeys || [];
    let fit = null;
    if (areaKeys.length && items.length) {
      const hit = items.filter((f) => { const text = `${f.name || ""} ${f.area || ""} ${f.address || ""}`.toLowerCase(); return areaKeys.some((k) => text.includes(k.toLowerCase())); }).length;
      fit = Math.round(hit / items.length * 100);
    }
    // 선택 안의 커버·역할 = 출력 배지
    const covLabel = (PLAN_COVERAGE.find((c) => c.k === curStrat.coverage) || {}).l || "";
    const roleCount = {}; items.forEach((f) => { const r = planRole(f).k; roleCount[r] = (roleCount[r] || 0) + 1; });
    const topRole = Object.keys(roleCount).sort((a, b) => roleCount[b] - roleCount[a])[0];
    const roleLabel = (PLAN_ROLE_KEY.find((r) => r.k === topRole) || {}).l || "";
    const kpiHtml = `<div class="map-plan-kpis">
        <div class="map-plan-kpi"><span class="k">예상 도달<em class="est">추정</em></span><span class="v">${agg.reach ? planFmtEok(agg.reach) : "—"}</span><span class="d">노출 ${planFmtEok(curOts)} · ${AdPlay.esc(periodLabel(planEffDays))}</span></div>
        <div class="map-plan-kpi"><span class="k">평균 빈도<em class="est">추정</em></span><span class="v">${agg.freq ? agg.freq.toFixed(1) + "회" : "—"}</span><span class="d">1인 평균 노출</span></div>
        <div class="map-plan-kpi"><span class="k">CPM<em class="est">환산</em></span><span class="v">${curCpm ? "₩" + Math.round(curCpm).toLocaleString() : "—"}</span><span class="d">노출 1,000당</span></div>
        <div class="map-plan-kpi"><span class="k">타깃 적합도<em class="est">추정</em></span><span class="v">${fit == null ? "—" : fit + "%"}</span><span class="d">${regionCount}개 지역 · ${items.length}곳</span></div>
      </div>`;
    // 1개월 샘플 믹스 — 목적(역할)별 대표 매체 1곳씩 추린 "즉시 제안" 조합 예시
    const smByRole = {};
    items.forEach((f) => { const rk = planRole(f).k; const gg = gradeForFav(f); const sc = gg ? gg.score : 0; if (!smByRole[rk] || sc > smByRole[rk].sc) smByRole[rk] = { fav: f, g: gg, sc: sc }; });
    const smMix = ["impact", "reach", "freq", "nudge"].filter((k) => smByRole[k]).map((k) => ({ role: k, fav: smByRole[k].fav, g: smByRole[k].g }));
    const smTotal = smMix.reduce((s, m) => s + (m.fav.monthly || 0), 0);
    const smMoney = (v) => v ? (v >= 10000 ? planFmtEok(v) + "원" : v.toLocaleString() + "원") : "상담";
    const sampleMixHtml = smMix.length >= 2 ? `<div class="map-plan-samplemix">
        ${smMix.map((m) => { const rl = (PLAN_ROLE_KEY.find((r) => r.k === m.role) || {}).l || ""; return `<div class="sm-row">
          <span class="sm-role r-${m.role}">${AdPlay.esc(rl)}</span>
          <span class="sm-body"><b>${AdPlay.esc(m.fav.name)}</b><span class="sm-badges">${gradeBadgesHtml(m.g)}</span></span>
          <span class="sm-price">${m.fav.monthly ? "월 " + smMoney(m.fav.monthly) : "상담"}</span></div>`; }).join("")}
        <div class="sm-foot"><span>샘플 합계 <em>월 · VAT 별도</em></span><b>${smTotal ? planFmtEok(smTotal) + "원~" : "상담"}</b></div>
      </div>` : "";
    // 지역(상권) 상대평가 + 커버리지 전략 — 지역을 직접 지정 안 했을 때만 노출(지정 시 그 지역을 따름)
    let regionHtml = "";
    let selRegionKeys = null;
    const rankMap = {}; // 상권키 → 순위 (매체 출처 배지용)
    let sStep = 0;
    const nRegion = regionLayerActive() ? (sStep += 1) : 0;
    const nMix = regionLayerActive() ? (sStep += 1) : 0;
    if (regionLayerActive()) {
      const ranking = buildRegionRanking(crit);
      ranking.forEach((g) => { rankMap[g.key] = g.rank; });
      selRegionKeys = strategyRegionKeys(ranking, plannerRegionStrat); // null = 전체
      const inSel = (k) => !selRegionKeys || selRegionKeys.indexOf(k) >= 0;
      const show = ranking.slice(0, 5);
      // 강약점은 '후보 상위권끼리' 상대 비교(전국 93개 전체와 비교하면 상위권이 전부 '최상위'로 평평해짐)
      const cmpSet = ranking.slice(0, Math.max(5, Math.min(12, ranking.length)));
      const rows = show.map((g) => {
        const pc = regionProsCons(g, cmpSet);
        const extTxt = g.ext && typeof g.ext.age2030 === "number" ? ` · 20·30 ${Math.round(g.ext.age2030 * 100)}%${typeof g.ext.weekend === "number" ? " · 주말 " + Math.round(g.ext.weekend * 100) + "%" : ""}` : "";
        const pros = pc.pros.map((p) => `<span class="rr-pro">${AdPlay.esc(p)}</span>`).join("");
        const cons = pc.cons.map((c) => `<span class="rr-con">${AdPlay.esc(c)}</span>`).join("");
        return `<div class="map-plan-rgnrow${inSel(g.key) ? " is-on" : ""}">` +
          `<div class="rr-head"><b class="rr-rank">${g.rank})</b><span class="rr-name">${AdPlay.esc(g.key)}</span><span class="rr-score" title="타깃 적합 상대점수(1순위=100)">${g.rel}</span></div>` +
          `<div class="rr-metrics">유동 ${planFmtEok(g.foot)} · 매체 ${g.items.length}곳(${g.typeCount}종)${extTxt}</div>` +
          `<div class="rr-why">${AdPlay.esc(regionSummary(g, cmpSet))}</div>` +
          `<div class="rr-tags">${pros}${cons}</div>` +
        `</div>`;
      }).join("");
      const more = ranking.length > show.length ? `<div class="map-plan-tag-help" style="margin-top:2px">+ ${ranking.length - show.length}개 후보 더 · 전체 지역 비교는 아래 <b>다운로드(Excel·PDF)</b>에서</div>` : `<div class="map-plan-tag-help" style="margin-top:2px">연령·성별·주말 등 지역 상세 비교는 아래 <b>다운로드(Excel·PDF)</b>에서</div>`;
      const stratChips = PLAN_REGION_STRATS.map((s) => `<button type="button" class="map-plan-rgn-strat${plannerRegionStrat === s.k ? " is-on" : ""}" data-rstrat="${s.k}" title="${AdPlay.esc(s.desc)}">${s.l}</button>`).join("");
      regionHtml =
        `<div class="map-plan-reco-group">` +
          `<div class="map-plan-substep"><span class="map-plan-step-no">${nRegion}</span>추천 지역 비교 <span class="map-plan-tag-help">타깃·예산 조건의 <b>후보 지역을 상대 비교</b> — 점수·지표·강약점 확인 후 아래에서 <b>어떻게 덮을지</b> 선택</span></div>` +
          `<div class="map-plan-rgnrows">${rows || '<span class="map-plan-tag-help">후보 지역을 계산할 수 없습니다.</span>'}</div>` +
          more +
          `<div class="map-plan-substep map-plan-substep--mix"><span class="map-plan-step-no">${nMix}</span>지역 믹스 <span class="map-plan-tag-help"><b>한곳 집중 ↔ 여러 곳 분산</b> — 예산을 어떻게 나눌지 고르면 추천이 다시 만들어집니다</span></div><div class="map-plan-rgn-strats">${stratChips}</div>` +
        `</div>`;
    }
    const nSel = (sStep += 1), nAdj = (sStep += 1), nPerf = (sStep += 1), nList = (sStep += 1);
    inner.innerHTML =
      regionHtml +
      `<div class="map-plan-reco-group">` +
        `<div class="map-plan-substep"><span class="map-plan-step-no">${nSel}</span>안 선택 <span class="map-plan-tag-help">맞춤 추천안·AI 대안 중 <b>원하는 안을 클릭하면 아래에서 예상 성과와 추천 매체 리스트를 확인</b>할 수 있어요</span></div><div class="map-plan-scen">${anCards}</div>` +
        `<div class="map-plan-substep"><span class="map-plan-step-no">${nAdj}</span>미디어 믹스 조정 <span class="map-plan-tag-help">목표·기간·매체 성격을 바꾸면 <b>위 추천(안)이 다시 만들어집니다</b></span></div><div class="map-plan-levers">${leverHtml}</div>` +
      `</div>` +
      `<div class="map-plan-substep map-plan-substep--open"><span class="map-plan-step-no">${nPerf}</span>예상 성과 <span class="map-plan-tag-help">선택·조정한 안 기준 추정치</span></div>${kpiHtml}` +
      `<div class="map-plan-substep map-plan-substep--open map-plan-media-head"><span class="map-plan-step-no">${nList}</span><span class="mh-title">추천 매체 리스트 <b>${items.length}곳</b></span> <span class="map-plan-tag-help">리스트에 매체를 직접 추가하려면 지도에서 매체 선택 후 <b>★ 관심</b>을 누르세요 · 왼쪽 <b>체크박스를 해제</b>하면 리스트에서 제외됩니다</span></div>` +
      favCompareTableHtml(allItems, { allClass: "map-plan-incl-all", inclAttr: "data-plan-incl", rmAttr: "data-plan-rm2", excluded: plannerExcluded }) +
      (reco ? `<p class="map-fav-reco map-fav-reco--plan"><strong>추<br>천</strong><span class="map-fav-reco-body">${AdPlay.esc(reco)}</span></p>` : "");
    // 지역 커버리지 전략 선택 → 재추천
    inner.querySelectorAll("[data-rstrat]").forEach((b) => b.addEventListener("click", () => { plannerRegionStrat = b.getAttribute("data-rstrat"); reapplyPlanner(bodyEl, footEl); }));
    // 안 선택(레버 초기화) / 레버 조정
    inner.querySelectorAll("[data-an]").forEach((b) => b.addEventListener("click", () => { plannerAnKey = b.getAttribute("data-an"); plannerLever = {}; reapplyPlanner(bodyEl, footEl); }));
    inner.querySelectorAll("[data-lk]").forEach((b) => b.addEventListener("click", () => {
      const k = b.getAttribute("data-lk"); let v = b.getAttribute("data-lv"); if (k === "period") v = parseInt(v, 10);
      if (String(plannerLever[k]) === String(v)) delete plannerLever[k]; else plannerLever[k] = v;
      reapplyPlanner(bodyEl, footEl);
    }));
    // 매체별 역할 배지 + '직접추가' 배지를 각 행 매체 셀에 주입(플래너 전용 — ②관심매체 표는 미변경)
    const byFav = {}; allItems.forEach((f) => { byFav[f.favId] = f; });
    inner.querySelectorAll("[data-plan-incl]").forEach((cb) => {
      const id = cb.getAttribute("data-plan-incl");
      const f = byFav[id];
      if (!f) return;
      const tr = cb.closest("tr");
      const tags = tr && tr.querySelector(".map-fav-media-tags");
      if (!tags) return;
      if (plannerAdded.has(id)) {
        const ad = document.createElement("span");
        ad.className = "map-plan-added";
        ad.textContent = "직접추가";
        tags.appendChild(ad);
      }
      // ⓑ 지역 출처 배지 — '어느 후보 지역/몇 순위에서 뽑혔는지' 투명하게(지역 직접 지정 안 했을 때만).
      if (regionLayerActive()) {
        const rk = rankMap[planRegionKeyOf(f)];
        if (rk) { const rb = document.createElement("span"); rb.className = "map-plan-rgnbadge"; rb.textContent = `${planRegionKeyOf(f)} · ${rk}순위`; tags.appendChild(rb); }
      }
      // 역할 배지(임팩트확장·도달확보·구매유도·반복강화)는 매체 유형에서 1:1 파생 → 카드에선 중복이라 제거.
      // 역할 개념은 엑셀 '안별 구성·믹스 균형 요약'에만 유지(변별력 배지만 카드에 노출).
      // 1개월 미만인데 단기요율 없는 매체 → 금액은 월 비례 임시추정, '단기협의' 표시
      if (planEffDays < 30 && !f.shortTerm && !f.isBus && !f.isElevator) {
        const ng = document.createElement("span");
        ng.className = "map-plan-negotiate";
        ng.textContent = "단기협의";
        tags.appendChild(ng);
      }
    });
    // ① 플랜에서 빼기(×) — 이 추천안에서만 제외(재생성돼도 유지). ②관심매체는 그대로.
    inner.querySelectorAll("[data-plan-rm2]").forEach((b) => b.addEventListener("click", () => {
      const id = b.getAttribute("data-plan-rm2");
      plannerExcluded.delete(id);
      plannerAdded.delete(id);
      plannerRemoved.add(id);
      plannerSlugs = plannerSlugs.filter((s) => s !== id);
      renderPlannerResult(bodyEl, footEl, info);
    }));
    inner.querySelectorAll("[data-plan-incl]").forEach((cb) => cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-plan-incl");
      if (cb.checked) plannerExcluded.delete(id); else plannerExcluded.add(id);
      renderPlannerResult(bodyEl, footEl, info);
    }));
    const inclAll = inner.querySelector(".map-plan-incl-all");
    if (inclAll) inclAll.addEventListener("change", () => {
      if (inclAll.checked) plannerExcluded.clear(); else allItems.forEach((f) => plannerExcluded.add(f.favId));
      renderPlannerResult(bodyEl, footEl, info);
    });
    if (footEl) {
      const svgDL = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>';
      const svgPDF = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
      const svgShare = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4M12 2v13"/></svg>';
      // 하단 고정 영역: 미디어믹스 비중 + 정직한 데이터(한 줄) + 월 합계 + 받기 버튼 — 표를 스크롤해도 항상 보임
      footEl.innerHTML =
        `<div class="map-plan-foot-mix"><div class="map-fav-mix-head">매체 유형별 예산 비중</div><div class="map-fav-mix-bar">${mixBar}</div><div class="map-fav-mix-leg">${mixLeg}</div>${bcHtml}</div>` +
        `<p class="map-plan-foot-note"><b>정직한 데이터</b> · 노출·CPM은 정부 유동 <b>실측 기반 추정치</b>(디지털 클릭과 다름). 매체별 상세·지역 분석은 <b>다운로드 결과물</b>에.</p>` +
        `<div class="map-plan-foot-row">` +
        `<div class="map-fav-total-row"><span>예상 ${AdPlay.esc(periodLabel(planEffDays))} 집행 합계${over ? ' · <b style="color:#cf3b3b">예산 초과</b>' : ""}</span><strong>${total ? AdPlay.formatKRW(total) + "~" : "상담 필요"}</strong></div>` +
        `<button type="button" class="map-fav-download" data-plan-excel>${svgDL}다운로드(Excel)</button>` +
        `<button type="button" class="map-fav-download" data-plan-pdf>${svgPDF}제안서(PDF)</button>` +
        `<button type="button" class="map-fav-download" data-plan-maplink>${svgShare}지도링크 복사</button>` +
        `<a class="map-fav-cta" href="estimate.html?intent=bundle&media=${items.map((f) => encodeURIComponent(f.favId)).join(",")}"><span>${items.length}개 매체로 상담신청</span></a>` +
        `</div>`;
      const q = (s) => footEl.querySelector(s);
      if (q("[data-plan-excel]")) q("[data-plan-excel]").addEventListener("click", () => downloadPlanExcel());
      if (q("[data-plan-pdf]")) q("[data-plan-pdf]").addEventListener("click", () => withPlannerData(openFavOnePager));
      if (q("[data-plan-maplink]")) q("[data-plan-maplink]").addEventListener("click", () => withPlannerData(copyFavMapLink));
    }
  }
  window.AdPlayPlanner = { render: renderPlannerInto };
  function openFavPanel() {
    if (!favPanel) return;
    renderFavPanel();
    favPanel.hidden = false;
    favPanel.style.zIndex = "1001"; document.body.dataset.gpsFront = "fav"; // 열면 맨 앞 + 활성 수집함
    requestAnimationFrame(fitFavTitles);
    if (workspacePage) workspacePage.classList.add("is-fav-open");
  }
  function closeFavPanel() {
    if (!favPanel) return;
    favPanel.hidden = true;
    if (workspacePage) workspacePage.classList.remove("is-fav-open");
  }

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
    // 라벨에서 반복되던 접미사 "광고" 제거 — 칩 라벨은 정적 HTML에 없고 JS 가 렌더해서
    // Yeti·GPTBot·ClaudeBot 등 JS 미실행 크롤러는 본 적이 없다(SEO 손실 0).
    // "전광판 광고"·"옥외광고" 키워드는 이미 title·h1·description·og·schema 에 있고,
    // media-catalog.html 표기(대형 전광판/지하철/버스·쉘터/쇼핑몰 DID)와도 오히려 일치한다.
    { value: "large_billboard", label: "전광판·빌보드", categories: ["large_billboard", "package"] },
    // 교통·이동 묶음(지하철·공항·버스·차량) — 인접 배치로 스캔·키워드 군집
    { value: "subway", label: "지하철", categories: ["subway"] },
    { value: "transport_hub", label: "공항·터미널·기차", categories: ["transport_hub"] },
    { value: "bus", label: "버스 정류장", categories: ["bus"] },
    { value: "shopping_mall_did", label: "쇼핑·문화시설", categories: ["shopping_mall_did"] },
    // 엘리베이터 = 회사 최대 자산(1만+ 지점). 기타 바로 왼쪽에 배치.
    { value: "daily_touchpoint", label: "엘리베이터", categories: ["daily_touchpoint"], alwaysShow: true },
    // 편의점(GS25 세로형 사이니지)은 별도 상단 카테고리에서 제거하고 엘리베이터 좌측 세그먼트
    // 3번째 탭(아파트·오피스·편의점)으로 흡수했다. '생활밀착형 접점' 우산 아래로 통합.
    // 매체 데이터는 여전히 category === "convenience" 인 일반 매체이며 일반 렌더 경로로 그린다.
    // 고속도로 — 한국옥외광고센터 기금조성 광고물(고속도로변 대형 플렉스) 145개
    { value: "highway", label: "고속도로", categories: ["highway"] },
    // 기타 — 리조트·카페·학교·마트 등 애매한 매체용. 매체는 추후 등록, 지금은 버튼만.
    { value: "other", label: "기타 생활권", categories: ["other"], alwaysShow: true },
    // (아래) 예전에 제거한 탭 2개 — 실측으로 다른 탭과 완전히 중복이었다(어떤 매체도 접근 불가가 되지 않음):
    //  · "이동매체 광고"(transport_hub+bus) = 공항·터미널·기차(27) + 버스(18) 를 그대로 합친 것.
    //    게다가 버스 정류장 탭은 실제 정류장 데이터로 2,176개를 보여주는데 여기 버스는 18개뿐이라 숫자도 어긋났다.
    //  · "기타 옥외 광고"(daily_touchpoint+shopping_mall_did) = daily_touchpoint 가 0건이라
    //    쇼핑·문화시설(65)과 결과가 100% 동일했다("기타"를 눌러도 쇼핑·문화시설이 그대로 나옴).
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

  // ?only=<category> — 광고주 시연용 '단일 카테고리' 모드: 해당 카테고리만 표시하고 카테고리 탭을 숨긴다.
  const onlyCategory = new URLSearchParams(window.location.search).get("only") || "";
  if (onlyCategory) document.documentElement.classList.add("map-only-mode");
  let activeCategory = onlyCategory || new URLSearchParams(window.location.search).get("category") || "all";
  // 카테고리 다중 온오프: selectedCats 가 진짜 선택 집합. activeCategory 는 특수 모드용 파생값.
  // 배타 모드(전체·버스·엘리베이터)는 한 번에 하나만. 나머지 일반 카테고리는 여러 개 토글 가능.
  const EXCLUSIVE_CATS = new Set(["all", "bus", "daily_touchpoint"]);
  let selectedCats = new Set([activeCategory]);
  function primaryCategoryMode() {
    if (selectedCats.has("bus")) return "bus";
    if (selectedCats.has("daily_touchpoint")) return "daily_touchpoint";
    if (selectedCats.has("all")) return "all";
    return "__multi__";
  }
  let selectedMediaSlug = new URLSearchParams(window.location.search).get("media") || "";
  let detailOpen = Boolean(selectedMediaSlug);
  // 상세를 열면 기본은 '상세만' 표시(목록 숨김) — 지도 보이는 영역을 최대로.
  // 목록 맥락이 필요하면 상세 헤더의 ☰ 버튼으로 목록을 함께 펼친다(선택은 유지됨).
  let panelsExpanded = false;
  let activeBudget = "all";
  let pendingBudget = "all";
  let activePeriod = "all";
  let pendingPeriod = "all";
  let naverMap = null;
  let naverMarkers = [];
  let mediaCluster = null; // 매체 마커 클러스터링 인스턴스
  let naverBusMarkers = [];
  let busStopIdleListener = null;
  let currentItems = [];
  let selectedBusStopId = "";
  // 엘리베이터 광고 — 상품(네트워크) 단위 리스트 카드 + 실제 지오코딩 핀
  const elevatorNetworks = (elevatorData && elevatorData.networks) || [];
  const elevatorSites = elevatorSitesData || {};
  let elevatorType = "apartment"; // apartment | office | convenience (좌측 리스트 세그먼트 3탭)
  let selectedNetworkId = "";
  let selectedComplexId = ""; // 단지별 카드/핀 선택(포커스)
  let townboardTier = "all"; // 타운보드 3차 토글: all | tv(25인치) | board(50·55인치)
  let elevatorMarkers = [];
  // 관심매체는 전 매체 공통 저장소(goplay:favorites)로 통합 — favStarButton(site.id, ...) 사용
  // 상품별 대표 샘플 사진(첨부 사진으로 교체 예정). 없으면 onerror로 대체 이미지.
  const ELEV_IMAGES = {
    townboard: ["assets/images/elevator/elevator-apt-1.jpg", "assets/images/elevator/elevator-apt-2.jpg"],
    fmk: ["assets/images/elevator/elevator-apt-2.jpg", "assets/images/elevator/elevator-apt-1.jpg"],
    gsa: ["assets/images/elevator/elevator-apt-1.jpg", "assets/images/elevator/elevator-apt-2.jpg"],
    officebiz: ["assets/images/elevator/elevator-office-1.jpg", "assets/images/elevator/elevator-office-2.jpg"],
    asa: ["assets/images/elevator/elevator-office-2.jpg", "assets/images/elevator/elevator-office-1.jpg"],
  };
  const ELEV_IMAGE_FALLBACK = "assets/images/map-samples/gangnam-wide.jpg";
  // 상품별 송출 보장(제품 고정값)
  const ELEV_BROADCAST = { townboard: "15초 · 1일 100회" };
  // 가격 기간 단위 — 원본 열이 다름(월 환산 금지). FMK는 '4주 금액'이 실제 청구 단위.
  const ELEV_PRICE_PERIOD = { townboard: "월", fmk: "4주", gsa: "월", officebiz: "월" };
  // 상품 상세페이지 — 요약 줄에서 실제 <a>로 연결(내부링크 = SEO 크롤 경로)
  const ELEV_DETAIL_PAGE = {
    townboard: "elevator-townboard.html",
    fmk: "elevator-focus.html",
    gsa: "elevator-mediamid.html",
    officebiz: "elevator-officebiz.html",
    primeliving: "elevator-prime-living.html",
    asa: "elevator-prime-office.html",
    convenience: "gs25-ad-map.html",
  };
  // 첫/기본 화면: 서울 전역 1000m 스케일(줌13). 중심은 용산구청.
  const DEFAULT_VIEW = { latitude: 37.5324, longitude: 126.9908, zoom: 13 };
  // 기본/리셋 뷰 적용 — 용산구청을 중심에 두되, 좌측 목록(430px)이 지도 왼쪽을 '오버레이'로 가리므로
  // 데스크톱에선 목록폭 절반만큼 서쪽으로 밀어 용산구청이 '보이는 영역(목록 오른쪽)'의 중앙에 오게 한다.
  function applyDefaultView() {
    if (!naverMap || !window.naver || !naver.maps) return;
    naverMap.setCenter(new naver.maps.LatLng(DEFAULT_VIEW.latitude, DEFAULT_VIEW.longitude));
    naverMap.setZoom(DEFAULT_VIEW.zoom);
    if (!mobileLayoutQuery.matches && typeof naverMap.panBy === "function") {
      const rail = document.querySelector(".map-sidebar");
      const w = rail ? rail.getBoundingClientRect().width : 0;
      if (w > 4) naverMap.panBy(new naver.maps.Point(-Math.round(w / 2), 0)); // 서쪽으로 밀어 용산구청을 우측 가시영역 중앙에
    }
  }
  const BUS_STOP_CLUSTER_MAX_ZOOM = 13;
  // 목록/마커에서 매체를 선택했을 때 지도를 이 줌까지 확대해 해당 매체 위치를 보여줌
  // (18 = 축척 약 20m — 건물 단위로 매체 위치가 또렷하게 보이는 수준)
  const DETAIL_FOCUS_ZOOM = 18;

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

  const ELEVATOR_SEGMENTS = [
    { type: "apartment", label: "아파트" },
    { type: "office", label: "오피스" },
    { type: "convenience", label: "편의점" },
  ];

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

  document.querySelectorAll("[data-fav-trigger]").forEach((el) => el.addEventListener("click", openFavPanel));
  document.addEventListener("gps:open-favorites", openFavPanel); // 서비스 도크 "관심매체 비교" → 실제 통합 패널 열기
  // 플래너 열림/닫힘 시 지도 ★ 상태를 활성 수집함(플래너/관심매체) 기준으로 갱신
  document.addEventListener("gps:planner-opened", updateFavoritesUI);
  document.addEventListener("gps:planner-closed", updateFavoritesUI);
  // 패널 가장자리 화살표(map-rail-toggle.js)가 상세 열린 상태에서 누르면 → 목록 함께 펼치기/접기
  document.addEventListener("gp:toggle-list-panel", () => {
    panelsExpanded = !panelsExpanded;
    syncPanelMode();
  });
  if (favClose) favClose.addEventListener("click", closeFavPanel);
  // 이동형 패널: 헤더를 끌어 위치 이동(데스크톱), 접기 토글. 지도는 가리지 않고 계속 탐색 가능.
  const favHead = document.querySelector("#mapFavHead");
  const favMin = document.querySelector("#mapFavMin");
  const favSheet = favPanel && favPanel.querySelector(".map-fav-sheet");
  if (favHead && favPanel) {
    let favDrag = null;
    favHead.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      if (mobileLayoutQuery.matches) return;
      const rect = favPanel.getBoundingClientRect();
      favDrag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      favPanel.style.right = "auto";
      favPanel.style.left = rect.left + "px";
      favPanel.style.top = rect.top + "px";
      favHead.setPointerCapture(event.pointerId);
      favHead.classList.add("is-grabbing");
    });
    favHead.addEventListener("pointermove", (event) => {
      if (!favDrag) return;
      const w = favPanel.offsetWidth;
      const x = Math.max(6, Math.min(event.clientX - favDrag.dx, window.innerWidth - w - 6));
      const y = Math.max(6, Math.min(event.clientY - favDrag.dy, window.innerHeight - 52));
      favPanel.style.left = x + "px";
      favPanel.style.top = y + "px";
    });
    const favDragEnd = () => { favDrag = null; favHead.classList.remove("is-grabbing"); };
    favHead.addEventListener("pointerup", favDragEnd);
    favHead.addEventListener("pointercancel", favDragEnd);
  }
  // 두 창(AI 추천받기·관심 매체 담기)이 함께 떠 있을 때 — 클릭한 창을 맨 위로.
  // 관심매체 창을 누르면 추천받기(.gps-ov z:1000) 위(1001)로 올라온다. 추천받기 클릭 시 되돌림은 map-services.js에서 처리.
  if (favPanel) favPanel.addEventListener("pointerdown", () => { favPanel.style.zIndex = "1001"; document.body.dataset.gpsFront = "fav"; }, true);
  if (favMin && favSheet) {
    const miIco = favMin.querySelector(".mi-ico");
    const miLbl = favMin.querySelector(".mi-lbl");
    favMin.addEventListener("click", () => {
      const min = favSheet.classList.toggle("is-min");
      if (miIco) miIco.textContent = min ? "▸" : "▾";
      if (miLbl) miLbl.textContent = min ? "펼치기" : "접기";
    });
  }
  // 크기 조절: 좌상단(nw)·우하단(se) 손잡이를 끌어 패널 크기 변경. nw는 반대편(우하단) 모서리를 고정한 채 리사이즈.
  if (favSheet && favPanel) {
    favSheet.querySelectorAll(".map-fav-resize").forEach((handle) => {
      const dir = handle.dataset.resize || "";
      const fromLeft = dir.indexOf("w") >= 0;
      const fromTop = dir.indexOf("n") >= 0;
      const hAxis = fromLeft || dir.indexOf("e") >= 0;
      const vAxis = fromTop || dir.indexOf("s") >= 0;
      let rsz = null;
      handle.addEventListener("pointerdown", (event) => {
        if (mobileLayoutQuery.matches) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = favSheet.getBoundingClientRect();
        rsz = { x: event.clientX, y: event.clientY, w: rect.width, h: rect.height, left: rect.left, top: rect.top };
        favPanel.style.right = "auto";
        favPanel.style.left = rect.left + "px";
        favPanel.style.top = rect.top + "px";
        handle.setPointerCapture(event.pointerId);
      });
      handle.addEventListener("pointermove", (event) => {
        if (!rsz) return;
        const dx = event.clientX - rsz.x;
        const dy = event.clientY - rsz.y;
        const minW = 360, minH = 200;
        const maxW = window.innerWidth - 40, maxH = window.innerHeight - 112;
        const w = hAxis ? Math.max(minW, Math.min(fromLeft ? rsz.w - dx : rsz.w + dx, maxW)) : rsz.w;
        const h = vAxis ? Math.max(minH, Math.min(fromTop ? rsz.h - dy : rsz.h + dy, maxH)) : rsz.h;
        favSheet.style.width = w + "px";
        favSheet.style.height = h + "px";
        if (fromLeft) favPanel.style.left = (rsz.left + (rsz.w - w)) + "px";
        if (fromTop) favPanel.style.top = (rsz.top + (rsz.h - h)) + "px";
      });
      const rszEnd = () => { rsz = null; };
      handle.addEventListener("pointerup", rszEnd);
      handle.addEventListener("pointercancel", rszEnd);
    });
  }
  if (favDownload) favDownload.addEventListener("click", downloadFavExcel);
  if (favShare) favShare.addEventListener("click", copyFavMapLink);
  // 공유 지도링크(?cart=)로 들어온 경우 데이터 로드 후 비교 패널을 자동으로 연다.
  // (window 'load'는 지도 타일까지 기다려 느리므로, 데이터 로드에 충분한 독립 타이머로 연다.)
  if (SHARED_CART.length) {
    setTimeout(() => { try { openFavPanel(); } catch (error) { /* ignore */ } }, 1600);
  }
  if (favPdf) favPdf.addEventListener("click", openFavOnePager);
  if (favPanel) favPanel.addEventListener("click", (event) => {
    if (event.target === favPanel) closeFavPanel();
  });
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-fav-toggle]");
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      activeToggle(toggle.dataset.favToggle);
      return;
    }
    const remove = event.target.closest("[data-fav-remove]");
    if (remove) {
      event.preventDefault();
      toggleFavorite(remove.dataset.favRemove);
    }
  });
  // 상담 대상 체크박스 — 해제 시 그 행을 흐리게(is-excluded) + 합계·상담에서 제외. 다시 체크하면 복귀.
  document.addEventListener("change", (event) => {
    // 전체선택 토글 — 모든 행 체크박스·제외상태를 한 번에 켜고/끈다
    const all = event.target.closest(".map-fav-incl-all");
    if (all) {
      const checkAll = all.checked;
      [].slice.call(document.querySelectorAll("[data-fav-incl]")).forEach((cb) => {
        cb.checked = checkAll;
        const fid = cb.dataset.favIncl;
        if (checkAll) favExcluded.delete(fid); else favExcluded.add(fid);
        const r = cb.closest("tr");
        if (r) r.classList.toggle("is-excluded", !checkAll);
      });
      all.indeterminate = false;
      recalcFavConsult();
      return;
    }
    const incl = event.target.closest("[data-fav-incl]");
    if (!incl) return;
    const id = incl.dataset.favIncl;
    if (incl.checked) favExcluded.delete(id); else favExcluded.add(id);
    const row = incl.closest("tr");
    if (row) row.classList.toggle("is-excluded", !incl.checked);
    recalcFavConsult();
    syncFavAllCheckbox();
  });
  updateFavoritesUI();
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
      .filter((tab) => tab.value === "all" || tab.alwaysShow || (tab.categories || [tab.value]).some((category) => available.has(category)))
      .map(({ value, label }) => `
        <button type="button" class="map-category-pill${selectedCats.has(value) ? " is-active" : ""}" data-map-category="${AdPlay.esc(value)}" aria-pressed="${selectedCats.has(value) ? "true" : "false"}">
          ${AdPlay.esc(label)}
        </button>
      `).join("");

    categoryBar.querySelectorAll("[data-map-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.mapCategory;
        if (EXCLUSIVE_CATS.has(value)) {
          // 전체·버스·엘리베이터: 지도 전체를 전용 방식으로 그려서 배타 선택(다른 건 모두 해제)
          selectedCats = new Set([value]);
        } else {
          // 일반 카테고리: 토글. 배타 모드가 켜져 있었으면 먼저 해제.
          EXCLUSIVE_CATS.forEach((cat) => selectedCats.delete(cat));
          if (selectedCats.has(value)) selectedCats.delete(value);
          else selectedCats.add(value);
          if (selectedCats.size === 0) selectedCats = new Set(["all"]); // 전부 끄면 전체로
        }
        activeCategory = primaryCategoryMode();
        selectedMediaSlug = "";
        selectedNetworkId = "";
        selectedComplexId = "";
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
    // 엘리베이터 우산 카테고리(아파트·오피스·편의점 3탭) 전체를 전용 renderElevator 경로로 그린다.
    // 편의점도 일반 매체이지만 엘리베이터와 동일한 구역 클러스터 지도 + 엘리베이터형 리스트로 노출한다.
    if (activeCategory === "daily_touchpoint" && elevatorNetworks.length) {
      renderElevator(options);
      return;
    }
    const query = (searchInput && searchInput.value ? searchInput.value : "").trim().toLowerCase();
    // 선택된 카테고리들(배타 모드 제외)의 실제 category 값 합집합 — 다중선택 지원
    const activeCategories = [...selectedCats].flatMap((value) => {
      const tab = categoryTabs.find((entry) => entry.value === value);
      return tab ? (tab.categories || [tab.value]) : [];
    });
    // 편의점(1천+)은 점 매체가 많아 '옥외광고 전체'를 뒤덮는다.
    // 버스정류장 레이어처럼 편의점 탭에서만 보이게 하고 '전체'에서는 제외한다.
    const ownTabOnly = ["convenience"];
    const filtered = mediaWithLocations
      .filter((item) => selectedCats.has("all") ? !ownTabOnly.includes(item.category) : activeCategories.includes(item.category))
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

  // 결과 지역 범위 계산 — 넓게 퍼진 검색(이상치 포함)에서도 밀집 지역에 지도를 맞추기 위해
  // 12건 이상이면 위도·경도 각각 상·하위 5%(백분위) 좌표를 잘라내고 그 박스로 fitBounds 한다.
  function boundsForItems(items) {
    const bounds = new naver.maps.LatLngBounds();
    const pts = items
      .map((item) => item.mapLocation)
      .filter((loc) => loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude));
    if (pts.length < 12) {
      pts.forEach((loc) => bounds.extend(new naver.maps.LatLng(loc.latitude, loc.longitude)));
      return bounds;
    }
    const lats = pts.map((loc) => loc.latitude).sort((a, b) => a - b);
    const lngs = pts.map((loc) => loc.longitude).sort((a, b) => a - b);
    const at = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.round(p * (arr.length - 1))))];
    bounds.extend(new naver.maps.LatLng(at(lats, 0.05), at(lngs, 0.05)));
    bounds.extend(new naver.maps.LatLng(at(lats, 0.95), at(lngs, 0.95)));
    return bounds;
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
          center: new naver.maps.LatLng(DEFAULT_VIEW.latitude, DEFAULT_VIEW.longitude),
          zoom: DEFAULT_VIEW.zoom,
          minZoom: 8,
          mapTypeControl: false,
          zoomControl: false,
        });
        busStopIdleListener = naver.maps.Event.addListener(naverMap, "idle", () => {
          if (activeCategory === "bus") syncBusStopLayer();
          else if (activeCategory === "daily_touchpoint") syncElevatorLayer();
        });
      }

      if (mediaCluster) { mediaCluster.setMap(null); mediaCluster = null; }
      naverMarkers.forEach((marker) => marker.setMap(null));
      naverMarkers = [];
      if (typeof clearElevatorLayer === "function") clearElevatorLayer();
      if (!items.length) {
        clearBusStopLayer();
        return;
      }

      items.forEach((item) => {
        const latlng = new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude);
        const marker = new naver.maps.Marker({
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
        const query = (searchInput && searchInput.value ? searchInput.value : "").trim();
        if (!query) {
          // 옥외광고 전체 및 모든 카테고리 탭: 첫 화면 스케일 동일(용산구청 중심·서울 1000m)
          applyDefaultView();
        } else if (items.length === 1) {
          const item = items[0];
          naverMap.setCenter(new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude));
          naverMap.setZoom(15);
        } else {
          // 검색 결과가 넓게 퍼지면(예: '강남' 104건에 서울 밖 이상치 몇 건) 전체 fitBounds 가
          // 전국 축소로 벌어진다. 12건 이상이면 상·하위 5% 좌표를 잘라 '밀집 지역'에만 맞춘다.
          const fitBounds = boundsForItems(items);
          naverMap.fitBounds(fitBounds, { top: 76, right: 76, bottom: 76, left: 76 });
        }
      }

      // 매체 마커 클러스터링 — 가까운 매체를 +N으로 묶고 확대 시 개별 핀으로 분리
      if (typeof MarkerClustering === "function") {
        // 묶음 아이콘: 사진핀과 동일한 크기(단일), 강조 블루
        // 묶음 아이콘: 채운 원 + 숫자. 개수가 많을수록 '크고 진하게'(연보라→네이비) 5단계.
        // 크기·색이 밀집도를, 숫자가 정확한 개수를 보조로 말한다. 앵커는 원 중심(반지름).
        const clusterIcons = [
          { content: `<div class="map-cluster map-cluster--s"></div>`,   size: new naver.maps.Size(30, 30), anchor: new naver.maps.Point(15, 15) },
          { content: `<div class="map-cluster map-cluster--m"></div>`,   size: new naver.maps.Size(38, 38), anchor: new naver.maps.Point(19, 19) },
          { content: `<div class="map-cluster map-cluster--l"></div>`,   size: new naver.maps.Size(46, 46), anchor: new naver.maps.Point(23, 23) },
          { content: `<div class="map-cluster map-cluster--xl"></div>`,  size: new naver.maps.Size(54, 54), anchor: new naver.maps.Point(27, 27) },
          { content: `<div class="map-cluster map-cluster--xxl"></div>`, size: new naver.maps.Size(62, 62), anchor: new naver.maps.Point(31, 31) },
        ];
        mediaCluster = new MarkerClustering({
          map: naverMap,
          markers: naverMarkers,
          minClusterSize: 5, // 5개 미만 무리는 묶지 않고 개별 사진핀으로 표시(작은 +2·+3 클러스터 제거)
          maxZoom: 16, // 줌16(100m)에서만 묶음 완전 해제. 300m·500m·1000m는 묶음 유지
          gridSize: 90, // 묶는 반경(px)
          disableClickZoom: false,
          icons: clusterIcons,
          indexGenerator: [10, 30, 100, 500], // <10=s · 10~29=m · 30~99=l · 100~499=xl · 500+=xxl (icons 5단계와 대응)
          stylingFunction: (clusterMarker, count) => {
            const el = clusterMarker.getElement();
            const target = el.querySelector("div:first-child") || el;
            target.textContent = count;
            el.setAttribute("aria-label", count + "개 매체 묶음");
          },
        });
      } else {
        // 라이브러리 미로드 시: 개별 마커라도 표시(폴백)
        naverMarkers.forEach((marker) => marker.setMap(naverMap));
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

  // ── 엘리베이터 광고 — 상품 카드 리스트 + 실제 지오코딩 핀 ───────────────
  function elevatorFmt(n) {
    if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}만`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}천`;
    return String(n);
  }

  function elevatorReachLabel(net) {
    if (net.households) return `세대 ${elevatorFmt(net.households)} 도달`;
    if (net.population) return net.type === "office" ? `입주 ${elevatorFmt(net.population)}명 규모` : `인구 ${elevatorFmt(net.population)} 도달`;
    return net.topRegion ? `${net.topRegion} ${net.topRegionShare}% 집중` : "";
  }

  function elevatorPriceLabel(net) {
    if (!net.prices || !net.prices.length) return "단가 상담";
    const lo = Math.min(...net.prices).toLocaleString("ko-KR");
    const hi = Math.max(...net.prices).toLocaleString("ko-KR");
    return lo === hi ? `대당 월 ${lo}원` : `대당 월 ${lo}~${hi}원`;
  }

  function elevatorImages(net) {
    return ELEV_IMAGES[net.id] || [ELEV_IMAGE_FALLBACK, ELEV_IMAGE_FALLBACK];
  }


  function elevatorNetworksByType() {
    return elevatorNetworks.filter((net) => net.type === elevatorType);
  }

  // 편의점(GS25) 매체를 엘리베이터 사이트 형태로 변환 — 동일한 구역 클러스터 지도 + 엘리베이터형
  // 리스트 카드로 노출하기 위함. 좌표는 media_locations(latitude/lng)를, 구/군/시(district)와
  // 시/도(sido)는 areaName("서울 강남구" = <시도 축약> <구/군/시>)에서 파생한다.
  let convenienceSitesCache = null;
  function convenienceSites() {
    if (convenienceSitesCache) return convenienceSitesCache;
    convenienceSitesCache = mediaWithLocations
      .filter((item) => item.category === "convenience" && item.mapLocation
        && Number.isFinite(item.mapLocation.latitude) && Number.isFinite(item.mapLocation.longitude))
      .map((item) => {
        const area = String(item.areaName || "").trim().split(/\s+/).filter(Boolean);
        const sido = area[0] || sidoShort(item.address) || "";
        const district = area.length > 1 ? area[area.length - 1] : (area[0] || sido || "기타");
        return {
          id: item.slug,
          name: item.name,
          lat: item.mapLocation.latitude,
          lng: item.mapLocation.longitude,
          address: item.address || (item.mapLocation && item.mapLocation.sourceAddress) || "",
          district,
          sido,
          gubun: "편의점",
          vendor: "GS25",
          brand: "GS25",
          placement: "매장 내 세로형 사이니지",
          type: "convenience",
          networkId: "convenience",
          saleUnit: "site",
          monitors: 1,
        };
      });
    return convenienceSitesCache;
  }

  function renderElevator(options = {}) {
    renderCategoryTabs();
    if (busStopLegend) { busStopLegend.hidden = true; busStopLegend.classList.remove("is-visible"); }
    detailOpen = false;
    if (summaryRoot) {
      const sites = elevatorSitesForType();
      const label = elevatorType === "apartment" ? "아파트 엘리베이터 광고, 지오코딩된 단지"
        : elevatorType === "office" ? "오피스 엘리베이터 광고, 지오코딩된 단지"
        : "편의점(GS25) 세로형 사이니지, 지오코딩된 매장";
      summaryRoot.innerHTML = `<span class="sr-only">${label} ${sites.length.toLocaleString("ko-KR")}곳</span>`;
    }
    updateCostFilterLabels();
    renderElevatorList(elevatorComplexesForView()); // 리스트는 지도와 독립적으로 항상 렌더
    try { renderElevatorStage(options.preserveView); } catch (error) { console.warn("elevator map skipped", error); }
    syncPanelMode();
  }

  // 시도 접두어를 떼어 구·동 위주로 간결 표기
  function elevatorComplexAddr(site) {
    const stripped = String(site.address || "").replace(/^(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도)\s*/, "").trim();
    return stripped || site.address || "주소 확인 필요";
  }

  function elevWon(value) {
    if (!value) return "";
    if (value >= 10000) {
      const man = value / 10000;
      return `${Number.isInteger(man) ? man : man.toFixed(1)}만원`;
    }
    return `${value.toLocaleString("ko-KR")}원`;
  }

  function isTownboardTv(site) { return /^25/.test(site.monitorSize || ""); }

  function elevatorSitesForType() {
    if (elevatorType === "convenience") return convenienceSites();
    const out = [];
    elevatorNetworksByType()
      .filter((net) => !selectedNetworkId || net.id === selectedNetworkId)
      .forEach((net) => {
        (elevatorSites[net.id] || []).forEach((site) => {
          if (Number.isFinite(site.lat) && Number.isFinite(site.lng)) {
            out.push({ ...site, networkId: net.id, brand: net.brand, vendor: net.vendor, placement: net.placement, type: net.type, saleUnit: net.saleUnit || "site" });
          }
        });
      });
    // 타운보드 3차 토글(TV 25인치 / 게시판 50·55인치)
    if (selectedNetworkId === "townboard" && townboardTier !== "all") {
      return out.filter((site) => (townboardTier === "tv" ? isTownboardTv(site) : !isTownboardTv(site)));
    }
    return out;
  }

  // 상품 단가 범위 — 원본 unitPrice에서 실측(네트워크 prices가 비어있는 상품이 있어서)
  function elevatorUnitRange(netId) {
    const prices = (elevatorSites[netId] || []).map((s) => s.unitPrice).filter((v) => v > 0);
    if (!prices.length) return null;
    return { lo: Math.min(...prices), hi: Math.max(...prices) };
  }

  function elevatorTierCounts() {
    const sites = elevatorSites.townboard || [];
    return {
      tv: sites.filter(isTownboardTv).length,
      board: sites.filter((s) => s.monitorSize && !isTownboardTv(s)).length,
    };
  }

  function elevatorComplexesForView() {
    const sites = elevatorSitesForType();
    let list = sites;
    if (naverMap && window.naver && window.naver.maps && activeCategory === "daily_touchpoint") {
      const bounds = naverMap.getBounds();
      if (bounds) {
        const sw = bounds.getSW();
        const ne = bounds.getNE();
        const inView = sites.filter((s) => s.lat >= sw.lat() && s.lat <= ne.lat() && s.lng >= sw.lng() && s.lng <= ne.lng());
        list = inView.length ? inView : sites;
      }
    }
    list = list.slice().sort((a, b) => (b.monitors || 0) - (a.monitors || 0));
    if (selectedComplexId) {
      const sel = list.find((s) => s.id === selectedComplexId);
      if (sel) list = [sel, ...list.filter((s) => s.id !== selectedComplexId)];
    }
    return list.slice(0, 120);
  }

  function elevatorComplexCard(site) {
    const isSel = selectedComplexId === site.id;
    const gubun = site.gubun || (site.type === "office" ? "오피스" : "아파트");
    const isPackage = site.saleUnit === "package";
    const monthly = site.monthlyCost || site.price || 0;
    const period = ELEV_PRICE_PERIOD[site.networkId] || "월";
    const vendorCode = site.vendor || site.brand;
    // 세대·입주년도·평형 한 줄(칩 대신). 평형 다종은 "평형 N종".
    const pyeongVals = String(site.pyeong || "").split(",").map((v) => v.trim()).filter(Boolean);
    const meta = [];
    if (site.households) meta.push(`${site.households.toLocaleString("ko-KR")}세대`);
    else if (site.tenants) meta.push(`입주사 ${site.tenants.toLocaleString("ko-KR")}`);
    if (site.year) meta.push(`${site.year}년`);
    if (pyeongVals.length) meta.push(pyeongVals.length > 1 ? `평형 ${pyeongVals.length}종` : `평형 ${pyeongVals[0]}`);
    if (site.floors) meta.push(site.floors);
    const metaLine = meta.join(" · ");
    // 설치 위치: 타운보드는 모니터크기 판별, 그 외는 networks.placement
    const install = site.networkId === "townboard"
      ? (/^25/.test(site.monitorSize || "") ? "엘리베이터 내부 TV" : "대기공간 게시판")
      : (site.placement || "");
    // 계산식 + 비용을 한 줄로: "50″ 257대 × 10,000원 = 월 2,570,000원 (VAT 별도)"
    const sizeShort = (String(site.monitorSize || "").match(/(\d+(?:\.\d+)?)/) || [])[1];
    let calc;
    if (isPackage) {
      calc = `${(site.monitors || 0).toLocaleString("ko-KR")}대 · ${site.district ? AdPlay.esc(site.district) + " " : ""}패키지 <small>개별 판매 없음</small>`;
    } else if (site.unitPrice && site.monitors) {
      calc = `${sizeShort ? `${sizeShort}″ ` : ""}${site.monitors.toLocaleString("ko-KR")}대 × ${site.unitPrice.toLocaleString("ko-KR")}원 = <b>${period} ${monthly.toLocaleString("ko-KR")}원</b> <small>VAT 별도</small>`;
    } else {
      calc = monthly ? `<b>${period} ${monthly.toLocaleString("ko-KR")}원</b> <small>VAT 별도</small>` : "가격 상담";
    }
    const detailPage = ELEV_DETAIL_PAGE[site.networkId] || "elevator.html";
    const detailLabel = isPackage ? "패키지 보기" : "상세보기";
    return `
      <article class="map-elev-complex${isSel ? " is-active" : ""}${site.pick ? " is-pick" : ""}">
        <button type="button" data-elev-complex="${AdPlay.esc(site.id)}" aria-label="${AdPlay.esc(site.name)} 지도에서 보기" aria-current="${isSel ? "true" : "false"}"></button>
        <div class="map-elev-complex-head">
          <h3><span class="map-elev-gubun">${AdPlay.esc(gubun)}</span>${AdPlay.esc(String(site.name).replace(/_[LS]$/, ""))}</h3>
          <div class="map-elev-head-right">
            <span class="map-elev-vendor">${AdPlay.esc(vendorCode)}</span>
            ${favStarButton(site.id, site.name, "map-card-fav")}
          </div>
        </div>
        <p class="map-elev-complex-addr">${AdPlay.esc(site.address || "주소 확인 필요")}</p>
        ${(metaLine || install) ? `<div class="map-elev-complex-meta">
          <span>${AdPlay.esc(metaLine)}</span>
          ${install ? `<span class="map-elev-install">${AdPlay.esc(install)}</span>` : ""}
        </div>` : ""}
        <p class="map-elev-calc${isPackage ? " is-package" : ""}">${calc}</p>
        <div class="map-elev-complex-foot">
          <a class="map-elev-detail-link" href="${AdPlay.esc(detailPage)}">${detailLabel} ›</a>
        </div>
      </article>`;
  }

  // 아파트·오피스·편의점 3탭 세그먼트 — 엘리베이터 리스트와 편의점 리스트가 공유한다.
  function elevatorSegmentControl() {
    return `
      <div class="map-elev-seg" role="tablist" aria-label="엘리베이터 광고 장소">
        ${ELEVATOR_SEGMENTS.map(({ type, label }) => {
          const on = elevatorType === type;
          return `<button type="button" role="tab" data-elev-type="${type}" aria-selected="${on}" class="${on ? "is-active" : ""}">${label}</button>`;
        }).join("")}
      </div>`;
  }

  function bindElevatorSegment(container) {
    container.querySelectorAll("[data-elev-type]").forEach((button) => {
      button.addEventListener("click", () => {
        if (elevatorType === button.dataset.elevType) return;
        elevatorType = button.dataset.elevType;
        selectedNetworkId = "";
        townboardTier = "all";
        selectedComplexId = "";
        render({ preserveView: true });
      });
    });
  }

  function renderElevatorList(complexes) {
    const total = elevatorSitesForType().length;
    const isApt = elevatorType === "apartment";
    const isConv = elevatorType === "convenience";
    const pkgPage = isConv ? "gs25-ad-map.html" : isApt ? "elevator-apartment.html" : "elevator-office.html";
    const pkgLabel = isConv ? "편의점 GS25 상품 보기" : isApt ? "아파트 패키지 상품 보기" : "오피스 패키지 상품 보기";
    listRoot.innerHTML = `
      ${elevatorSegmentControl()}
      <a class="map-elev-pkg-link" href="${AdPlay.esc(pkgPage)}">${AdPlay.esc(pkgLabel)} <span aria-hidden="true">→</span></a>
      <p class="map-elev-cards-cap">이 화면 <b>${complexes.length.toLocaleString("ko-KR")}</b>곳 <span>· 지도 이동 시 갱신</span></p>
      <div class="map-elev-complex-list">${
        complexes.length
          ? complexes.map(elevatorComplexCard).join("")
          : `<div class="empty">이 지역에 표시할 매체가 없습니다. 지도를 이동하거나 축소해 보세요.</div>`
      }</div>`;

    bindElevatorSegment(listRoot);
    listRoot.querySelectorAll("[data-elev-complex]").forEach((button) => {
      button.addEventListener("click", () => focusComplex(button.dataset.elevComplex));
    });
  }

  function focusComplex(id) {
    const site = elevatorSitesForType().find((s) => s.id === id);
    if (!site) return;
    selectedComplexId = id;
    if (naverMap && window.naver && window.naver.maps) {
      naverMap.setCenter(new naver.maps.LatLng(site.lat, site.lng));
      if (naverMap.getZoom() <= BUS_STOP_CLUSTER_MAX_ZOOM) naverMap.setZoom(BUS_STOP_CLUSTER_MAX_ZOOM + 2);
      syncElevatorLayer();
    } else {
      renderElevatorList(elevatorComplexesForView());
    }
    if (mobileLayoutQuery.matches) setMobileListOpen(true);
  }

  function clearElevatorLayer() {
    elevatorMarkers.forEach((marker) => marker.setMap(null));
    elevatorMarkers = [];
  }

  function ensureNaverMap() {
    if (naverMap || !window.naver || !window.naver.maps) return;
    stage.classList.add("has-naver-map");
    stage.innerHTML = "";
    naverMap = new naver.maps.Map(stage, {
      center: new naver.maps.LatLng(DEFAULT_VIEW.latitude, DEFAULT_VIEW.longitude),
      zoom: DEFAULT_VIEW.zoom,
      minZoom: 8,
      mapTypeControl: false,
      zoomControl: false,
    });
    busStopIdleListener = naver.maps.Event.addListener(naverMap, "idle", () => {
      if (activeCategory === "bus") syncBusStopLayer();
      else if (activeCategory === "daily_touchpoint") syncElevatorLayer();
    });
  }

  function elevatorClusterGroups(sites) {
    const grouped = new Map();
    sites.forEach((site) => {
      const key = String(site.district || site.sido || "기타"); // 구/군/시 단위 클러스터(버스와 동일)
      const group = grouped.get(key) || { name: key, count: 0, lat: 0, lng: 0 };
      group.count += 1;
      group.lat += site.lat;
      group.lng += site.lng;
      grouped.set(key, group);
    });
    return [...grouped.values()]
      .map((group) => {
        const size = Math.max(34, Math.min(72, 28 + Math.sqrt(group.count) * 4.8));
        return { ...group, lat: group.lat / group.count, lng: group.lng / group.count, size };
      })
      .sort((a, b) => b.count - a.count);
  }

  function elevatorClusterContent(group) {
    return `
      <button type="button" class="bus-stop-cluster" style="--cluster-size: ${group.size}px" aria-label="${AdPlay.esc(group.name)} 엘리베이터 광고 ${group.count.toLocaleString("ko-KR")}개 보기">
        <span>${AdPlay.esc(group.name)}</span>
        <strong>${group.count.toLocaleString("ko-KR")}</strong>
      </button>`;
  }

  // 표시(pick) 지점이 많으면 라벨은 겹치므로, 30곳 이하일 때만 단지명 라벨 노출
  const ELEV_LABEL_MAX = 30;
  let elevatorPickCache = null;
  function elevatorPickCount() {
    if (elevatorPickCache === null) {
      elevatorPickCache = Object.values(elevatorSites).reduce((n, arr) => n + arr.filter((s) => s.pick).length, 0);
    }
    return elevatorPickCache;
  }
  function elevatorShowPickLabel() { return elevatorPickCount() <= ELEV_LABEL_MAX; }

  function elevatorPinContent(site) {
    const office = site.type === "office";
    const active = selectedComplexId === site.id ? " is-active" : "";
    const pick = site.pick ? (" is-pick" + (site.networkId === "townboard" ? " is-pick-tb" : (site.networkId === "fmk" ? " is-pick-foc" : ""))) : ""; // 상품별 색: 포커스=빨강, 타운보드=보라
    const nm = String(site.name).replace(/_[LS]$/, "");
    // 마우스 오버 시 단지명(+매체사·모니터) 툴팁
    const hover = `${nm}${site.vendor ? " · " + site.vendor : ""}${site.monitors ? " · 모니터 " + site.monitors + "대" : ""}`;
    const pin = `<span class="bus-stop-pin ${office ? "is-elev-office" : "is-elev-apt"}${pick}${active}" role="img" title="${AdPlay.esc(hover)}" aria-label="${AdPlay.esc(hover)}"><span class="bus-stop-pin-core"></span></span>`;
    if (!site.pick || !elevatorShowPickLabel()) return pin;
    // 표시 지점이 적을 때만 단지명 라벨
    return `<span class="elev-pin-wrap">${pin}<span class="map-elev-pinlabel">${AdPlay.esc(nm)}</span></span>`;
  }

  // 버스 정류장 광고와 동일 노출: 낮은 줌=구역 클러스터, 높은 줌=개별 핀, 지도 이동마다 재동기화 + 리스트 갱신
  function syncElevatorLayer() {
    if (!naverMap || !window.naver || !window.naver.maps || activeCategory !== "daily_touchpoint") {
      clearElevatorLayer();
      return;
    }
    try {
    clearElevatorLayer();
    const sites = elevatorSitesForType();
    const zoom = typeof naverMap.getZoom === "function" ? naverMap.getZoom() : 12;

    if (zoom <= BUS_STOP_CLUSTER_MAX_ZOOM) {
      elevatorClusterGroups(sites).forEach((group) => {
        const marker = new naver.maps.Marker({
          map: naverMap,
          position: new naver.maps.LatLng(group.lat, group.lng),
          title: `${group.name} 엘리베이터 광고 ${group.count.toLocaleString("ko-KR")}개`,
          icon: {
            content: elevatorClusterContent(group),
            size: new naver.maps.Size(group.size, group.size),
            anchor: new naver.maps.Point(group.size / 2, group.size / 2),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => {
          naverMap.setCenter(new naver.maps.LatLng(group.lat, group.lng));
          naverMap.setZoom(Math.max(naverMap.getZoom() + 2, BUS_STOP_CLUSTER_MAX_ZOOM + 1));
        });
        elevatorMarkers.push(marker);
      });
    } else {
      const bounds = naverMap.getBounds();
      const sw = bounds ? bounds.getSW() : null;
      const ne = bounds ? bounds.getNE() : null;
      sites
        .filter((site) => !sw || (site.lat >= sw.lat() && site.lat <= ne.lat() && site.lng >= sw.lng() && site.lng <= ne.lng()))
        .slice(0, 650)
        .forEach((site) => {
          const marker = new naver.maps.Marker({
            map: naverMap,
            position: new naver.maps.LatLng(site.lat, site.lng),
            title: `${site.vendor || ""} · ${site.name}`,
            icon: (site.pick && elevatorShowPickLabel())
              ? { content: elevatorPinContent(site), size: new naver.maps.Size(150, 44), anchor: new naver.maps.Point(75, 15) }
              : { content: elevatorPinContent(site), size: new naver.maps.Size(26, 26), anchor: new naver.maps.Point(13, 15) },
            zIndex: site.pick ? 100 : undefined,
          });
          naver.maps.Event.addListener(marker, "click", () => focusComplex(site.id));
          elevatorMarkers.push(marker);
        });
    }
    } catch (error) { console.warn("elevator markers skipped", error); }
    renderElevatorList(elevatorComplexesForView());
  }

  function renderElevatorStage(preserveView) {
    if (window.naver && window.naver.maps) {
      ensureNaverMap();
      if (naverMap) {
        if (mediaCluster) { mediaCluster.setMap(null); mediaCluster = null; }
        naverMarkers.forEach((marker) => marker.setMap(null));
        naverMarkers = [];
        clearBusStopLayer();
        // 첫 진입: URL에 clat/clng 있으면 그 지점으로(예: 킨텍스), 없으면 기본 뷰
        if (!preserveView) {
          const sp = new URLSearchParams(location.search);
          const clat = parseFloat(sp.get("clat")), clng = parseFloat(sp.get("clng")), cz = parseInt(sp.get("czoom"), 10);
          if (Number.isFinite(clat) && Number.isFinite(clng)) {
            naverMap.setCenter(new naver.maps.LatLng(clat, clng));
            naverMap.setZoom(Number.isFinite(cz) ? cz : 15);
          } else {
            applyDefaultView();
          }
        }
        syncElevatorLayer();
        return;
      }
    }
    // 네이버 지도 미로드: 리스트만 렌더
    renderElevatorList(elevatorComplexesForView());
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
      <article class="map-list-card${isActive ? " is-active" : ""}" data-gallery="${AdPlay.esc(detailGalleryImages(item).join(","))}">
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
            ${favHeartButton(item, "map-card-fav")}
          </div>
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
    const nearby = nearbyDistrict(item);
    const profile = audienceProfile(item);
    const sv = item.streetView || (location && location.streetView) || null;
    const roadviewUrl = `https://map.naver.com/v5/search/${encodeURIComponent(location.sourceAddress || item.address)}`;
    detailRoot.innerHTML = `
      <button type="button" class="map-detail-close" id="mapDetailClose" aria-label="목록으로 돌아가기">×</button>
      <section class="map-detail-media-hero" aria-label="현장 사진과 영상">
        <figure class="map-detail-video-preview${item.videoUrl ? " has-video" : ""}">
          ${item.videoUrl
            ? `<video src="${AdPlay.esc(item.videoUrl)}" poster="${AdPlay.esc(galleryImages[1] || image)}" autoplay muted loop playsinline preload="metadata" controls aria-label="${AdPlay.esc(item.name)} 광고 현장 영상"><img src="${AdPlay.esc(galleryImages[1] || image)}" alt="${AdPlay.esc(item.name)} 광고 현장"></video>`
            : `<img src="${AdPlay.esc(galleryImages[1] || image)}" alt="${AdPlay.esc(item.name)} 광고 현장 영상 미리보기">`}
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
          ${favHeartButton(item, "map-detail-fav")}
        </div>
        <p class="map-detail-address">${AdPlay.esc(compactAddress(item))}</p>
        <div class="map-list-tags">
          ${[item.mediaType, item.areaName, location.isComposite ? "복합 매체" : "", item.category === "package" ? "패키지" : ""].filter(Boolean).map((tag) => `<span>${AdPlay.esc(tag)}</span>`).join("")}
        </div>
        <div class="map-detail-actions">
          <a href="one-pager.html?slug=${encodeURIComponent(item.slug)}" target="_blank" rel="noopener"><strong>매체 소개서</strong><span>Brochure</span></a>
          <a href="#detailTraffic"><strong>데이터 리포트</strong><span>Data Report</span></a>
          ${sv
            ? `<a href="#detailRoadview"><strong>거리뷰 보기</strong><span>Street View</span></a>`
            : `<a href="${roadviewUrl}" target="_blank" rel="noopener"><strong>거리뷰 보기</strong><span>Street View</span></a>`}
        </div>
        <a class="map-detail-fullpage" href="media-${AdPlay.esc(item.slug)}.html">${AdPlay.esc(item.name)} 상세 페이지 전체보기<span aria-hidden="true">→</span></a>
        <section class="map-detail-section map-detail-section-top" id="detailSpecs">
          <dl class="map-detail-specs">
            ${detailFact("규격", location.size || sizeLabel(item))}
            ${detailFact("해상도", (function (r) { return (/px\s*$/i.test(r) || !/\d\s*[x×]\s*\d/.test(r)) ? r : r + "px"; })(location.resolution || item.resolutionPx || "확인 필요"))}
            ${detailFact("유형", AdPlay.categoryLabels[item.category] || item.mediaType)}
            ${detailFact("운영시간", location.operationHours || item.operationHours)}
            <dt>계약정보<br><span class="map-detail-fact-sub">비용(VAT별도)</span></dt><dd class="map-detail-contract">${contractDetailHtml(item)}</dd>
          </dl>
        </section>
        <section class="map-detail-section map-detail-selling">
          <h3>매체 노출 포인트</h3>
          <p class="map-detail-copy">${AdPlay.esc(mediaSellingPoint(item))}</p>
          ${(function () {
            const g = mgRelMap()[item.slug] || (window.MediaGrade ? window.MediaGrade.gradeMedia(item) : null);
            if (!g) return "";
            const chips = gradeBadgesHtml(g);
            const cau = (g.cautions && g.cautions.length) ? `<p class="map-detail-cautions">※ ${g.cautions.map(AdPlay.esc).join(" · ")}</p>` : "";
            const basis = `<p class="map-grades-basis">유형 내 노출력 지표(규격·형태·설치·노출성격·송출) 상대평가 · 국토교통부·중소벤처기업부 등 <strong>공공데이터</strong> 기반 추정(β) · <a href="grade-method.html" target="_blank" rel="noopener">등급 산정 기준·지표 전체 보기</a></p>`;
            return chips ? `<div class="map-detail-grades"><p class="map-grades-cap">노출력 등급·특성 <em>β</em></p>${chips}${cau}${basis}</div>` : "";
          })()}
          ${detailAudience(item) ? `<div class="map-detail-audience-box">
            <p class="map-audience-cap">이 앞을 지나는 주 방문층</p>
            <p class="map-detail-audience-line">${AdPlay.esc(detailAudience(item))}</p>
          </div>` : ""}
          ${nearby.brands && nearby.brands.length ? `<p class="map-nearby-label map-nearby-label--brands">상권 대표 브랜드</p>
          <div class="map-nearby-brands">${nearby.brands.map((brand) => `<span>${AdPlay.esc(brand)}</span>`).join("")}</div>` : ""}
        </section>
        <a class="map-detail-live-card" href="estimate.html?intent=live-talk&media=${encodeURIComponent(item.slug)}">
          <strong>라이브 톡 상담하기</strong>
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
          <h3>거리뷰</h3>
          <a class="map-detail-roadview" href="${roadviewUrl}" target="_blank" rel="noopener">
            <img src="${AdPlay.esc(galleryImages[0] || image)}" alt="${AdPlay.esc(item.name)} 거리뷰 미리보기">
            <span>거리뷰 보기</span>
          </a>
        </section>
        <section class="map-detail-section" id="detailTraffic">
          <h3>유동인구와 타깃</h3>
          <p class="map-detail-copy">${AdPlay.esc(insight.traffic)}</p>
          ${trafficVisualization(insight, profile)}
        </section>
        <section class="map-detail-section" id="detailLocation">
          <h3>입지 특성</h3>
          ${item.locationFeature ? `<p class="map-detail-copy map-detail-location-feature">${AdPlay.esc(item.locationFeature)}</p>` : ""}
          <div class="map-insight-score">
            ${insight.scores.map((score) => `<div><span>${AdPlay.esc(score.label)}</span><i style="--score:${score.value}"></i><strong>${score.value}</strong></div>`).join("")}
          </div>
          <p class="map-nearby-label">주요 시설·행사</p>
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
    // 거리뷰: 거리뷰좌표(pan/tilt/fov)로 네이버 파노라마 인라인 표시
    if (sv) {
      const panoEl = detailRoot.querySelector("#detailRoadviewPano");
      const panoFallback = () => {
        if (panoEl) panoEl.outerHTML = `<a class="map-detail-roadview-link" href="${roadviewUrl}" target="_blank" rel="noopener">네이버 지도에서 거리뷰 보기</a>`;
      };
      if (panoEl && window.naver && naver.maps && naver.maps.Panorama) {
        try {
          new naver.maps.Panorama(panoEl, {
            position: new naver.maps.LatLng(sv.lat, sv.lng),
            pov: { pan: sv.pan, tilt: sv.tilt, fov: sv.fov },
            flightSpot: true,
            aroundControl: true,
          });
        } catch (error) {
          console.warn("거리뷰 파노라마 초기화 실패", error);
          panoFallback();
        }
      } else {
        panoFallback();
      }
    }
  }

  function mediaSellingPoint(item) {
    if (item.exposureLong) return item.exposureLong; // 매체별 실데이터 우선(있으면), 없으면 아래 상권 키워드 폴백
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
    // 레일을 접어둔 상태에서 핀/매체를 클릭하면, 접힘이 상세를 화면 밖으로 밀어 정보가 안 보인다.
    // 매체 선택은 '상세를 보겠다'는 의도이므로 접힘을 해제해 사이드바가 다시 나오게 한다.
    if (workspacePage) workspacePage.classList.remove("is-rail-collapsed");
    // 매체를 고른 시점에 큐레이션(탐색 도구)의 역할은 끝난다. 열어두면 상세 위를 덮어
    // 매번 사용자가 직접 닫아야 하므로 자동으로 닫는다.
    setCurationPanel(false);
    render({ preserveView: true });
    if (mobileLayoutQuery.matches) {
      setMobileListOpen(true);
    }
    if (moveFocus) {
      detailRoot.focus({ preventScroll: true });
    }
    // 목록에서 매체를 고르면 지도도 해당 매체 위치로 이동. 도시 전체 뷰(줌 13)에서 panTo만 하면
    // "그 매체로 갔다"는 느낌이 없어, 멀리 있을 때는 확대까지 함께(morph). 이미 가까우면 확대는 유지.
    if (panToMarker && naverMap && item.mapLocation && window.naver && window.naver.maps) {
      const target = new naver.maps.LatLng(item.mapLocation.latitude, item.mapLocation.longitude);
      if (naverMap.getZoom() < DETAIL_FOCUS_ZOOM && typeof naverMap.morph === "function") {
        naverMap.morph(target, DETAIL_FOCUS_ZOOM);
      } else {
        naverMap.panTo(target);
      }
    }
  }

  function syncPanelMode() {
    // 기본은 '상세만' 표시 — 목록까지 항상 펼치면 패널이 860px을 덮어 보이는 지도가 거의 남지 않는다.
    // 목록을 함께 보고 싶을 때만 ☰(펼치기)로 연다. 모바일은 폭이 좁아 항상 전환.
    const expanded = panelsExpanded && !mobileLayoutQuery.matches;
    listView.hidden = detailOpen && !expanded;
    detailRoot.hidden = !detailOpen;
    if (workspacePage) {
      workspacePage.classList.toggle("is-detail-open", detailOpen);
      workspacePage.classList.toggle("is-panels-expanded", detailOpen && expanded);
    }
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

  // 엑셀 단가표 기준 단기요율(1/3/7/15일) 보유 여부
  function itemHasShortTerm(item) {
    const list = (item && item.pricing) || [];
    return list.some((p) => p && p.shortTermKRW && Object.keys(p.shortTermKRW).length);
  }
  // 매체의 단기요율을 일수→최저가 맵으로 정규화: {1:원,3:원,7:원,15:원} (없으면 null). 플래너 기간 계산용.
  function shortTermMin(item) {
    const list = (item && item.pricing) || [];
    const keys = { "1d": 1, "3d": 3, "7d": 7, "15d": 15 };
    const out = {};
    list.forEach((p) => {
      const st = p && p.shortTermKRW; if (!st) return;
      Object.keys(keys).forEach((k) => { if (st[k] != null) { const d = keys[k]; out[d] = (out[d] == null) ? st[k] : Math.min(out[d], st[k]); } });
    });
    return Object.keys(out).length ? out : null;
  }

  function mapCardDecisionSummary(item) {
    const terms = [mapCardPriceLabel(item)];
    // 가격 뒤 같은 자리·같은 스타일로: 단기요율 보유 매체는 '1개월 미만 가능', 그 외는 '1개월 미만 협의'
    terms.push(itemHasShortTerm(item) ? "1개월 미만 가능" : "1개월 미만 협의");
    return terms.filter(Boolean).join(" · ");
  }

  function cardReachLabel(item) {
    const area = areaBySlug.get(item.areaSlug);
    const ft = area && Number(area.dailyFootTraffic);
    if (!ft) return "";
    const man = Math.round((ft / 10000) * 10) / 10;
    return `일 유동인구 ${man}만명`;
  }

  // 단기 집행 가능 여부(엑셀 단가표 기준 단기요율 보유 시). 가능 기간은 매체별로 상이 → 카드에는 가능 여부만 표시.
  function mapCardShortTerm(item) {
    if (!itemHasShortTerm(item)) return "";
    return `<p class="map-card-st"><span>단기 집행 가능</span></p>`;
  }

  function detailAudience(item) {
    const area = areaBySlug.get(item.areaSlug);
    const list = (area && area.primaryTargets) || [];
    return list.join(" · ");
  }

  function cardExposurePoint(item) {
    // 가치 앵커: 노출 맥락 앞에 '일 유동인구 N만명'을 붙여, 높은 가격이 '투자'로 읽히게 한다.
    const reach = cardReachLabel(item);
    let point;
    if (item.exposureShort) {
      point = item.exposureShort; // 매체별 실데이터 우선(있으면), 없으면 아래 상권 키워드 폴백
    } else {
      const text = [item.name, item.areaName, item.areaSlug, item.address, item.mapLocation && item.mapLocation.sourceAddress]
        .filter(Boolean)
        .join(" ");
      if (/광화문|종로|시청|청계|gwanghwamun|jongno/i.test(text)) point = "광장·보행 동선에서 반복 노출";
      else if (/서울역|KTX|seoul-station|transport/i.test(text)) point = "철도·지하철 환승 동선 집중 노출";
      else if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) point = "업무·전시 방문객과 차량 동시 노출";
      else if (/신사|강남|도산|가로수|sinsa|gangnam/i.test(text)) point = "횡단보도·차량정체 구간 정면 노출";
      else point = "주요 보행·차량 동선에서 반복 노출";
    }
    return reach ? `${reach} · ${point}` : point;
  }

  function contractSummary(item) {
    const min = AdPlay.minMonthlyPrice(item);
    const monthly = min ? `월 ${AdPlay.formatKRW(min)}` : "월 비용 상담 필요";
    return `${monthly} · 1개월 미만 집행 협의 가능`;
  }
  // 계약정보 원문(줄단위) 표시 — 실데이터 우선, 없으면 요약 폴백
  function contractDetailHtml(item) {
    const location = item.mapLocation || {};
    let lines = Array.isArray(item.contractLines) ? item.contractLines.slice() : [];
    if (!lines.length && location.contract) {
      lines = String(location.contract).split(/\n+/).map((line) => line.trim()).filter(Boolean);
    }
    if (!lines.length && item.contractText) {
      lines = [String(item.contractText).trim()];
    }
    if (!lines.length) return AdPlay.esc(contractSummary(item) || "확인 필요");
    return lines
      .map((line) => `<span class="map-contract-line${/^\*/.test(line) ? " is-note" : ""}">${AdPlay.esc(line)}</span>`)
      .join("");
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
      all: "예산 전체",
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
    // 실사진이 있는 매체는 자기 사진만 노출(샘플 섞이지 않게)
    const own = ownImages(item);
    if (own.length) return [...new Set(own)].slice(0, 6);
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

  function trafficVisualization(insight, profile) {
    const stats = insight.stats || {
      daily500: "7.6만명",
      daily300: "3.1만명",
      subway: "12.4만명",
      bus: "3.8만명",
      traffic: "8.6만대",
      target: "2030·직장인",
    };
    const isReal = insight.isReal || { subway: false, bus: false };
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
    const ageRows = (profile && profile.age) || [
      ["10대", 8, 27, "학생·동반"],
      ["20대", 24, 78, "활동층"],
      ["30대", 27, 88, "구매 핵심"],
      ["40대", 22, 72, "직장인"],
      ["50대", 13, 43, "가족 소비"],
      ["60대+", 6, 22, "생활권"],
    ];
    const gender = (profile && profile.gender) || { female: 52, male: 48 };
    const ageTopIndex = ageRows.reduce((top, row, index) => row[1] > ageRows[top][1] ? index : top, 0);
    const audienceRows = insight.audience || [];
    return `
      <div class="map-traffic-kpis">
        <article class="is-primary"><span>일평균 유동 500m</span><strong>${AdPlay.esc(stats.daily500)}</strong><em>상권 반경 추정</em></article>
        <article><span>일평균 유동 300m</span><strong>${AdPlay.esc(stats.daily300)}</strong><em>매체 근접권</em></article>
        <article class="is-text-kpi"><span>핵심 타깃</span><strong>${AdPlay.esc(stats.target)}</strong><em>구매·방문 가능층</em></article>
        <article><span>지하철 승하차</span><strong>${AdPlay.esc(stats.subway)}</strong><em>주변역 월평균${isReal.subway ? "" : " · 추정"}</em></article>
        <article><span>버스 승하차</span><strong>${AdPlay.esc(stats.bus)}</strong><em>주변 정류장 월평균${isReal.bus ? "" : " · 추정"}</em></article>
        <article><span>도로 교통량</span><strong>${AdPlay.esc(stats.traffic)}</strong><em>주요 간선도로 · 추정</em></article>
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
              <stop offset="0%" stop-color="#2540ea"></stop>
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
        </div>
        <div class="map-gender-split">
          <div class="map-gender-split-head">
            <h5>성별 비중</h5>
            <b>여성 ${gender.female}% · 남성 ${gender.male}%</b>
          </div>
          <div class="map-gender-bar">
            <span class="f" style="width:${gender.female}%">여성 ${gender.female}%</span>
            <span class="m" style="width:${gender.male}%">남성 ${gender.male}%</span>
          </div>
        </div>
        <div class="map-age-distribution">
          <div class="map-age-distribution-head">
            <h5>연령대 분포</h5>
            <b>${AdPlay.esc(ageRows[ageTopIndex][0])} 최다</b>
          </div>
          ${ageRows.map(([label, percent, value, note], index) => `<div class="map-age-row ${index === ageTopIndex ? "is-peak" : ""}">
            <span>${label}</span>
            <i style="--bar:${value}"></i>
            <em>${percent}%</em>
            <strong>${note}</strong>
          </div>`).join("")}
        </div>
        <div class="map-traffic-segment-list">
          ${audienceRows.map((row) => `<div class="map-traffic-segment"><span>${AdPlay.esc(row.label)}</span><i style="--bar:${row.value}"></i><strong>${AdPlay.esc(row.note)}</strong></div>`).join("")}
        </div>
        ${profile ? `<p class="map-audience-src">${AdPlay.sourceChip({ traffic: true })}</p>` : ""}
      </div>`;
  }

  // 성별·연령 프로필의 단일 소스는 common.js(AdPlay.audienceProfile). 지도·목록 페이지가 공유해 자동 동기화됩니다.
  function audienceProfile(item) {
    return AdPlay.audienceProfile(item);
  }

  function nearbyDistrict(item) {
    // 실데이터 우선: 배치로 수집한 item.nearbyBrands가 있으면 사용, 없으면 아래 키워드 폴백
    if (Array.isArray(item.nearbyBrands) && item.nearbyBrands.length) {
      return { summary: item.nearbySummary || "", brands: item.nearbyBrands.slice(0, 8) };
    }
    const text = [item.name, item.areaName, item.areaSlug, item.address, item.mapLocation && item.mapLocation.sourceAddress].filter(Boolean).join(" ");
    if (/삼성|코엑스|COEX|samseong|coex/i.test(text)) {
      return {
        summary: "전시·쇼핑·업무가 겹치는 복합 상권으로, 백화점·몰 방문객과 B2B 유동이 함께 발생합니다.",
        brands: ["현대백화점", "스타필드 코엑스", "메가박스", "스타벅스", "올리브영", "무신사 스탠다드", "자라", "별마당도서관"],
      };
    }
    if (/서울역|KTX|seoul-station|transport/i.test(text)) {
      return {
        summary: "철도·지하철·버스 환승 허브로, 출퇴근·출장·관광 유동이 반복 교차하는 교통 중심 상권입니다.",
        brands: ["롯데마트", "롯데아울렛 서울역", "스타벅스", "파리바게뜨", "버거킹", "던킨", "CU", "서울로7017"],
      };
    }
    if (/광화문|종로|시청|청계|gwanghwamun|jongno|jung/i.test(text)) {
      return {
        summary: "도심 랜드마크 입지로, 직장인 출퇴근·점심 유동과 관광·문화행사 동선이 함께 형성됩니다.",
        brands: ["교보문고", "광화문 D타워", "세종문화회관", "스타벅스", "올리브영", "파리바게뜨", "GS25", "덕수궁"],
      };
    }
    return {
      summary: "강남·도산·신사를 잇는 프리미엄 소비 동선으로, 2030·구매력 직장인이 밀집하고 뷰티·패션·F&B가 강세입니다.",
      brands: ["올리브영", "무신사", "애플 가로수길", "스타벅스", "다이소", "투썸플레이스", "자라", "CU"],
    };
  }

  function locationInsight(item) {
    const text = [item.name, item.areaName, item.areaSlug, item.address, item.mapLocation && item.mapLocation.sourceAddress].filter(Boolean).join(" ");
    const area = areaBySlug.get(item.areaSlug);
    const withAreaTransit = (insight) => {
      const subway = areaSubwayTotal(area);
      const bus = areaBusTotal(area);
      return {
        ...insight,
        // 권역이 붙은 매체만 areas.json 실측치를 쓴다. 나머지는 아래 stats 의 하드코딩 추정값이
        // 그대로 남으므로, 출처(철도통계 등)를 붙이면 안 된다 — isReal 로 구분해 표기를 가른다.
        isReal: { subway: Boolean(subway), bus: Boolean(bus) },
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
          <div class="map-list-title-row map-bus-title-row">
            <h2>${AdPlay.esc(title)}${arsLabel ? `<span class="map-bus-stop-ars">${AdPlay.esc(arsLabel)}</span>` : ""}</h2>
            ${favStarButton("bus:" + stop.id, title, "map-card-fav")}
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

  // 매체 자체 사진(images)이 있으면 그것만 사용. 없는 매체는 기존처럼 샘플 사진으로 대체.
  function ownImages(item) {
    return Array.isArray(item && item.images) ? item.images.filter(Boolean) : [];
  }

  function cardImages(item) {
    const own = ownImages(item);
    if (own.length) return own.length >= 2 ? own.slice(0, 2) : [own[0], own[0]];
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
