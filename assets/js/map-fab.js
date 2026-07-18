/* 지도에서 매체 찾기 — 스크롤을 따라다니는 플로팅 버튼(FAB)
   클릭 시 지도 페이지(map.html)로 이동. 여러 콘텐츠 페이지에 공용 주입.
   자체 스타일 포함(페이지별 CSS와 충돌 없음). 지도 페이지에선 숨김. */
(function () {
  if (/\/map\.html$/.test(location.pathname)) return; // 지도 페이지엔 노출 안 함

  function inject() {
    if (document.querySelector(".gp-map-fab")) return true;
    if (!document.body) return false;

    var style = document.createElement("style");
    style.textContent = [
      /* 지도 강조색 #0b3a91 (.map-category-pill.is-active 배경)과 동일하게 통일 */
      ".gp-map-fab{position:fixed;right:44px;top:84px;z-index:9999;display:inline-flex;align-items:center;gap:10px;",
      "padding:8px 16px 8px 8px;border-radius:999px;text-decoration:none;",
      "background:#0b3a91;color:#fff;",
      "border:1px solid rgba(255,255,255,.14);",
      "box-shadow:0 6px 18px rgba(11,58,145,.30),0 1px 3px rgba(15,20,32,.14),inset 0 1px 0 rgba(255,255,255,.18);",
      "font-family:'SUIT Variable','Pretendard',system-ui,-apple-system,sans-serif;",
      "opacity:0;transform:translateY(-10px);transition:opacity .35s ease,transform .3s cubic-bezier(.2,.8,.3,1),box-shadow .3s ease}",
      ".gp-map-fab.is-in{opacity:1;transform:translateY(0)}",
      ".gp-map-fab:hover{transform:translateY(-2px);background:#0d4099;",
      "box-shadow:0 12px 28px rgba(11,58,145,.40),0 2px 6px rgba(15,20,32,.18),inset 0 1px 0 rgba(255,255,255,.24)}",
      ".gp-map-fab:active{transform:translateY(0)}",
      ".gp-map-fab:focus-visible{outline:3px solid #cfdaea;outline-offset:3px}",
      ".gp-map-fab .ic{position:relative;flex:0 0 auto;width:32px;height:32px;border-radius:999px;",
      "background:rgba(255,255,255,.20);display:grid;place-items:center}",
      ".gp-map-fab .ic svg{width:17px;height:17px;fill:#fff}",
      ".gp-map-fab .tx{display:flex;flex-direction:column;gap:1px;line-height:1.1;padding-right:2px}",
      ".gp-map-fab .tx .e{font-size:10px;font-weight:600;color:rgba(255,255,255,.7);letter-spacing:.04em}",
      ".gp-map-fab .tx .m{font-size:14px;font-weight:750;letter-spacing:-.01em;white-space:nowrap}",
      ".gp-map-fab .go{margin-left:1px;font-size:14px;font-weight:600;opacity:.7;transition:transform .2s ease}",
      ".gp-map-fab:hover .go{transform:translateX(2px);opacity:1}",
      "@media(max-width:900px){.gp-map-fab{right:20px;top:74px}}",
      "@media(max-width:640px){.gp-map-fab{right:14px;top:66px;padding:7px 14px 7px 7px;gap:8px}",
      ".gp-map-fab .ic{width:28px;height:28px}.gp-map-fab .ic svg{width:15px;height:15px}",
      ".gp-map-fab .tx .m{font-size:13px}.gp-map-fab .tx .e{font-size:9.5px}}",
      "@media(prefers-reduced-motion:reduce){.gp-map-fab,.gp-map-fab .go{transition:opacity .3s ease}}"
    ].join("");
    document.head.appendChild(style);

    var a = document.createElement("a");
    a.className = "gp-map-fab";
    a.href = "map.html";
    a.setAttribute("aria-label", "지도에서 매체 찾기");
    a.innerHTML =
      '<span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg></span>' +
      '<span class="tx"><span class="e">지금</span><span class="m">지도에서 매체 찾기</span></span>' +
      '<span class="go" aria-hidden="true">&rsaquo;</span>';
    document.body.appendChild(a);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { a.classList.add("is-in"); });
    });
    return true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
