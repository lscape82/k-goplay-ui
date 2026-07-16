/* 카테고리 칩 줄 커스텀 가로 스크롤바
   - 네이티브 바는 브라우저가 두께(10~15px)를 강제 예약해 (1) 두껍고 (2) 칩 세로정렬을 깨므로 숨김 처리됨.
   - 대신 얇고(4px) 연한 커스텀 바를 얹어: 마우스휠→가로 스크롤, 썸 드래그, 트랙 클릭 지원.
   - 절대배치라 레이아웃(칩↔검색칸 정렬)에 영향 없음. */
(function () {
  function init() {
    var list = document.querySelector('.map-category-list');
    var strip = document.querySelector('.map-category-strip');
    if (!list || !strip) return false;
    if (strip.querySelector('.map-cat-scrollbar')) return true; // 이미 설치됨

    if (getComputedStyle(strip).position === 'static') strip.style.position = 'relative';

    var track = document.createElement('div');
    track.className = 'map-cat-scrollbar';
    var thumb = document.createElement('div');
    thumb.className = 'map-cat-scrollbar-thumb';
    track.appendChild(thumb);
    strip.appendChild(track);

    function layout() {
      var lr = list.getBoundingClientRect();
      var sr = strip.getBoundingClientRect();
      // 세로 위치는 CSS(bottom)로 스트립 하단에 고정 — top을 측정 시점 좌표로 계산하면
      // 칩이 늦게 렌더될 때 값이 어긋난 채 박혀버림. 좌우만 리스트에 맞춰 계산.
      track.style.left = (lr.left - sr.left) + 'px';
      track.style.width = lr.width + 'px';
      update();
    }

    function update() {
      var sw = list.scrollWidth, cw = list.clientWidth;
      if (sw <= cw + 1) { track.style.display = 'none'; return; }
      track.style.display = 'block';
      var trackW = track.clientWidth;
      var thumbW = Math.max(28, (cw / sw) * trackW);
      var maxScroll = sw - cw;
      var maxThumb = trackW - thumbW;
      var left = maxScroll > 0 ? (list.scrollLeft / maxScroll) * maxThumb : 0;
      thumb.style.width = thumbW + 'px';
      thumb.style.transform = 'translateX(' + left + 'px)';
    }

    // 스크롤 동기화
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', layout);
    // 트랙 위치가 밀리지 않게 재계산 트리거들.
    // ResizeObserver는 '크기'만 감지하므로, 칩이 나중에 렌더되며 리스트 '위치'가 바뀌는 경우를 놓친다.
    // → 칩 렌더(childList)와 load 시점에도 재계산.
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { layout(); });
      ro.observe(list);
      ro.observe(strip);
    }
    if (window.MutationObserver) {
      new MutationObserver(function () { layout(); }).observe(list, { childList: true });
    }
    window.addEventListener('load', layout);

    // 세로 휠 → 가로 스크롤
    list.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        list.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    // 썸 드래그
    var dragging = false, startX = 0, startLeft = 0;
    thumb.addEventListener('mousedown', function (e) {
      dragging = true; startX = e.clientX; startLeft = list.scrollLeft;
      document.body.style.userSelect = 'none';
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var sw = list.scrollWidth, cw = list.clientWidth;
      var thumbW = thumb.getBoundingClientRect().width;
      var maxThumb = track.clientWidth - thumbW;
      var maxScroll = sw - cw;
      var dx = e.clientX - startX;
      list.scrollLeft = startLeft + (maxThumb > 0 ? (dx / maxThumb) * maxScroll : 0);
    });
    window.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false; document.body.style.userSelect = '';
    });

    // 트랙 클릭 → 해당 위치로 이동
    track.addEventListener('mousedown', function (e) {
      if (e.target === thumb) return;
      var rect = track.getBoundingClientRect();
      var thumbW = thumb.getBoundingClientRect().width;
      var target = (e.clientX - rect.left) - thumbW / 2;
      var maxThumb = track.clientWidth - thumbW;
      var maxScroll = list.scrollWidth - list.clientWidth;
      list.scrollLeft = maxThumb > 0 ? (target / maxThumb) * maxScroll : 0;
    });

    layout();
    setTimeout(layout, 300);
    setTimeout(layout, 1200);
    return true;
  }

  function boot() {
    if (init()) return;
    var tries = 0;
    var t = setInterval(function () {
      if (init() || ++tries > 20) clearInterval(t);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
