/* 좌측 패널(목록·상세) 접기/펼치기 토글
   - .map-workspace 는 grid-template-columns: var(--map-left-rail) 1fr 구조라,
     사이드바 컬럼을 0으로 접으면 지도가 전체 폭을 차지한다(= 모두 펼쳐보기).
   - 버튼은 지도 좌측 가장자리(.map-canvas-shell 기준)에 붙어, 접힘 여부와 무관하게
     항상 경계에 위치한다.
   - 접기/펼치기 후 지도 컨테이너 크기가 바뀌므로 리레이아웃 트리거(resize)를 보낸다. */
(function () {
  function init() {
    var page = document.querySelector(".map-workspace-page");
    var shell = document.querySelector(".map-canvas-shell");
    if (!page || !shell) return false;
    if (shell.querySelector(".gp-rail-toggle")) return true;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gp-rail-toggle";
    btn.innerHTML = '<span class="ic" aria-hidden="true"></span>';

    // 지도 컨테이너의 '보이는 폭'이 바뀌므로 타일이 깨지지 않게 리레이아웃
    function relayoutMap() {
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 60);
    }

    // 화살표 하나로 '목록 펼치기'와 '전부 접기'를 동시에 할 수는 없어 맥락에 따라 나눈다.
    //  - 상세가 열려 있으면: 목록을 옆에 함께 펼치기/접기 (map.js 가 상태를 가지고 있어 이벤트로 위임)
    //  - 상세가 없으면: 기존대로 목록 전체 접기/펼치기(지도 전체 화면)
    function refresh() {
      var detailOpen = page.classList.contains("is-detail-open");
      var expanded = page.classList.contains("is-panels-expanded");
      var collapsed = page.classList.contains("is-rail-collapsed");
      // 화살표 방향: ▶ = 넓히기, ◀ = 좁히기 (아이콘은 is-widen 클래스로 CSS 처리)
      var widen = detailOpen ? !expanded : collapsed;
      btn.classList.toggle("is-widen", widen);
      var label = detailOpen
        ? (expanded ? "목록 접기" : "목록 함께 보기")
        : (collapsed ? "목록 펼치기" : "목록 접기");
      btn.setAttribute("aria-label", label);
      btn.setAttribute("aria-expanded", String(detailOpen ? expanded : !collapsed));
      btn.title = label;
    }

    btn.addEventListener("click", function () {
      if (page.classList.contains("is-detail-open")) {
        document.dispatchEvent(new CustomEvent("gp:toggle-list-panel"));
      } else {
        page.classList.toggle("is-rail-collapsed");
      }
      refresh();
      relayoutMap();
    });

    // 상세 열림/펼침 상태는 map.js 가 클래스로 바꾸므로 그 변화를 감시해 화살표를 동기화
    new MutationObserver(refresh).observe(page, { attributes: true, attributeFilter: ["class"] });

    shell.appendChild(btn);
    refresh();
    return true;
  }

  function boot() {
    if (init()) return;
    var tries = 0;
    var t = setInterval(function () {
      if (init() || ++tries > 20) clearInterval(t);
    }, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
