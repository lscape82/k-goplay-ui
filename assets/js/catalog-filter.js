/* 옥외광고 매체 목록 — 정적으로 깔린 카드(513개)를 걸러주는 필터.
   중요: 카드를 JS로 "그리지" 않고, 이미 HTML에 있는 카드를 보였다/숨겼다 한다.
   → 봇은 JS 없이도 513개를 전부 읽고, 사람은 필터를 쓸 수 있다. */
(function () {
  var root = document.querySelector("#media-list");
  if (!root) return;

  var cards = [].slice.call(root.querySelectorAll(".card"));
  var searchEl = document.querySelector("#searchFilter");
  var areaEl = document.querySelector("#areaFilter");
  var catEl = document.querySelector("#categoryFilter");
  var budgetEl = document.querySelector("#budgetFilter");
  var sortEl = document.querySelector("#sortBy");
  var countEl = document.querySelector("#resultCount");
  var chipsEl = document.querySelector("#activeChips");
  var tabs = [].slice.call(document.querySelectorAll(".catalog-tab"));
  var emptyEl = document.querySelector("#catalogEmpty");
  var activeTab = "all";

  // 원래 순서 기억 — 같은 카테고리 안에서의 수작업 큐레이션 순서 보존용(2차 정렬 키)
  cards.forEach(function (c, i) { c.dataset.order = i; });

  // 카드 기본(추천) 정렬 = 지도(map.js categoryTabs) 카테고리 탭 순서와 동일.
  // package(패키지)는 지도에서 전광판과 한 탭으로 묶이므로 large_billboard 바로 뒤에 둔다.
  // ⚠ 지도 categoryTabs 순서를 바꾸면 여기 CATEGORY_ORDER도 함께 수정(자동 싱크 아님 — 수동 복제).
  var CATEGORY_ORDER = ["large_billboard", "package", "subway", "transport_hub", "bus", "vehicle", "shopping_mall_did", "daily_touchpoint", "other"];
  function catRank(cat) { var i = CATEGORY_ORDER.indexOf(cat); return i === -1 ? 999 : i; }

  // 예산 구간은 지도(map.js)와 동일 — filters.json 정의를 그대로 옮긴 만원 단위 버킷.
  // 이 값을 바꿀 땐 data/filters.json / map.js 도 함께(단일 출처 원칙).
  var BUDGET_BUCKETS = {
    "under100":   [0, 100],
    "100-300":    [100, 300],
    "300-500":    [300, 500],
    "500-1000":   [500, 1000],
    "1000-1500":  [1000, 1500],
    "1500plus":   [1500, null]
  };
  function budgetOk(price) {
    var v = budgetEl ? budgetEl.value : "all";
    if (v === "all") return true;
    if (!price) return v === "unknown";
    if (v === "unknown") return false;
    var b = BUDGET_BUCKETS[v];
    if (!b) return true;
    var manwon = Number(price) / 10000; // 원 → 만원
    return manwon >= b[0] && (b[1] === null || manwon < b[1]);
  }

  function render() {
    var q = (searchEl && searchEl.value.trim().toLowerCase()) || "";
    var area = (areaEl && areaEl.value) || "all";
    var cat = (catEl && catEl.value) || "all";

    var shown = cards.filter(function (c) {
      var d = c.dataset;
      if (activeTab === "package" && d.package !== "1") return false;
      if (area !== "all" && d.region !== area) return false;
      if (cat !== "all" && d.cat !== cat) return false;
      if (!budgetOk(d.price)) return false;
      if (q && d.search.indexOf(q) === -1) return false;
      return true;
    });

    // 정렬
    var mode = (sortEl && sortEl.value) || "recommended";
    var sorted = shown.slice();
    if (mode === "price-asc") {
      sorted.sort(function (a, b) { return (Number(a.dataset.price) || Infinity) - (Number(b.dataset.price) || Infinity); });
    } else if (mode === "price-desc") {
      sorted.sort(function (a, b) { return (Number(b.dataset.price) || -1) - (Number(a.dataset.price) || -1); });
    } else if (mode === "area") {
      sorted.sort(function (a, b) { return (a.dataset.region || "힣").localeCompare(b.dataset.region || "힣", "ko"); });
    } else {
      // 추천순 = 카테고리 순서(지도 탭과 동일)로 그룹핑, 같은 카테고리 안에선 원래 큐레이션 순서 유지
      sorted.sort(function (a, b) {
        var ra = catRank(a.dataset.cat), rb = catRank(b.dataset.cat);
        if (ra !== rb) return ra - rb;
        return a.dataset.order - b.dataset.order;
      });
    }

    cards.forEach(function (c) { c.hidden = true; });
    sorted.forEach(function (c) { c.hidden = false; root.appendChild(c); });

    if (countEl) {
      // 필터/검색/탭이 걸렸을 때만 결과 개수 표시. 초기 전체 상태에선 숨김
      // (개별·패키지 중복 매체가 있어 '전체 개수'를 한 숫자로 못 박으면 오히려 혼란)
      var filtered = activeTab !== "all" || area !== "all" || cat !== "all"
        || (budgetEl && budgetEl.value !== "all") || q !== "";
      countEl.textContent = filtered ? sorted.length.toLocaleString("ko-KR") + "개" : "";
      countEl.hidden = !filtered;
    }
    if (emptyEl) emptyEl.hidden = sorted.length > 0;
    renderChips();
  }

  function renderChips() {
    if (!chipsEl) return;
    var chips = [];
    function label(el) {
      if (!el || el.value === "all") return null;
      var o = [].slice.call(el.options).find(function (x) { return x.value === el.value; });
      return o ? o.textContent : null;
    }
    [[areaEl, "지역"], [catEl, "유형"], [budgetEl, "예산"]].forEach(function (pair) {
      var t = label(pair[0]);
      if (t) chips.push({ text: t, clear: function () { pair[0].value = "all"; } });
    });
    if (searchEl && searchEl.value.trim()) {
      chips.push({ text: '"' + searchEl.value.trim() + '"', clear: function () { searchEl.value = ""; } });
    }
    if (!chips.length) { chipsEl.innerHTML = ""; return; }
    chipsEl.innerHTML = chips.map(function (c, i) {
      return '<button type="button" class="active-chip" data-i="' + i + '">' + c.text +
             '<span aria-hidden="true">×</span><span class="sr-only">필터 제거</span></button>';
    }).join("") + '<button type="button" class="active-chip clear-all" data-i="all">필터 초기화</button>';
    [].slice.call(chipsEl.querySelectorAll("[data-i]")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.i === "all") {
          [areaEl, catEl, budgetEl].forEach(function (el) { if (el) el.value = "all"; });
          if (searchEl) searchEl.value = "";
        } else {
          chips[Number(btn.dataset.i)].clear();
        }
        render();
      });
    });
  }

  [searchEl, areaEl, catEl, budgetEl, sortEl].forEach(function (el) {
    if (!el) return;
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      activeTab = t.dataset.tab;
      tabs.forEach(function (x) {
        var on = x === t;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-selected", on ? "true" : "false");
      });
      render();
    });
  });

  render();
})();
