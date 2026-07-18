/* 관심매체 — 지도 페이지와 같은 저장소(localStorage "goplay:favorites")를 쓴다.
   → 목록에서 담은 매체가 지도에서 그대로 보이고, 그 반대도 된다. (진짜 연동)
   비교·상담 패널은 지도에 있으므로, 담긴 게 있으면 지도로 보내준다. */
(function () {
  var KEY = "goplay:favorites"; // map.js FAVORITES_KEY 와 동일해야 함
  var list = document.querySelector("#media-list"); // 목록 페이지에만 있음

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
  }
  var favs = read();
  var has = function (slug) { return favs.indexOf(slug) !== -1; };

  function syncButtons() {
    [].slice.call(document.querySelectorAll("[data-fav-toggle]")).forEach(function (b) {
      var on = has(b.dataset.favToggle);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var bar = document.querySelector("#favBar");
    var cnt = document.querySelector("#favCount");
    if (cnt) cnt.textContent = String(favs.length);
    if (bar) bar.hidden = favs.length === 0;
  }

  if (list) {
    list.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-fav-toggle]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var slug = btn.dataset.favToggle;
      var i = favs.indexOf(slug);
      if (i === -1) favs.push(slug); else favs.splice(i, 1);
      write(favs);
      syncButtons();
    });
  }

  // 다른 탭(지도)에서 바뀌면 즉시 반영
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    favs = read();
    syncButtons();
  });

  syncButtons();
})();
