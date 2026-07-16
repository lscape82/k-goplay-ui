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
      ".gp-map-fab{position:fixed;right:24px;bottom:24px;z-index:9999;display:inline-flex;align-items:center;gap:12px;",
      "padding:11px 20px 11px 12px;border-radius:999px;text-decoration:none;",
      "background:linear-gradient(135deg,#123a86,#0b2e6b);color:#fff;",
      "box-shadow:0 10px 30px rgba(11,46,107,.38),0 2px 6px rgba(11,46,107,.28);",
      "font-family:'SUIT Variable','Pretendard',system-ui,sans-serif;",
      "opacity:0;transform:translateY(14px);transition:opacity .4s ease,transform .28s cubic-bezier(.2,.8,.3,1),box-shadow .28s ease}",
      ".gp-map-fab.is-in{opacity:1;transform:translateY(0)}",
      ".gp-map-fab:hover{transform:translateY(-3px);box-shadow:0 16px 38px rgba(11,46,107,.46),0 3px 8px rgba(11,46,107,.3)}",
      ".gp-map-fab:active{transform:translateY(-1px)}",
      ".gp-map-fab .ic{position:relative;flex:0 0 auto;width:40px;height:40px;border-radius:999px;",
      "background:rgba(255,255,255,.16);display:grid;place-items:center}",
      ".gp-map-fab .ic svg{width:21px;height:21px;fill:#fff}",
      ".gp-map-fab .ic::after{content:'';position:absolute;inset:0;border-radius:999px;",
      "box-shadow:0 0 0 0 rgba(255,255,255,.5);animation:gpFabPulse 2.6s ease-out infinite}",
      ".gp-map-fab .tx{display:flex;flex-direction:column;line-height:1.15;padding-right:4px}",
      ".gp-map-fab .tx .e{font-size:11px;font-weight:600;color:rgba(255,255,255,.72);letter-spacing:.02em}",
      ".gp-map-fab .tx .m{font-size:15px;font-weight:800;letter-spacing:-.01em}",
      ".gp-map-fab .go{margin-left:2px;font-size:15px;font-weight:700;opacity:.85}",
      "@keyframes gpFabPulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.45)}70%{box-shadow:0 0 0 12px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}",
      "@media(max-width:640px){.gp-map-fab{right:16px;bottom:16px;padding:9px 16px 9px 10px;gap:9px}",
      ".gp-map-fab .ic{width:34px;height:34px}.gp-map-fab .ic svg{width:18px;height:18px}",
      ".gp-map-fab .tx .m{font-size:14px}.gp-map-fab .tx .e{font-size:10px}}",
      "@media(prefers-reduced-motion:reduce){.gp-map-fab,.gp-map-fab .ic::after{animation:none;transition:opacity .3s ease}}"
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
