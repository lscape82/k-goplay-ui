/* 통합 계정 셸 동작 — 전 페이지 공용(지도 제외: 지도는 자체 인라인 사용).
   로그아웃/로그인 상태 전환은 데모(localStorage)로 전 페이지 공유. 실제 연동 시 서버가 data-logged 설정. */
(function () {
  function wire() {
    var acct = document.getElementById("gpAcct");
    if (!acct || acct.dataset.acctWired) return;
    acct.dataset.acctWired = "1";

    try { if (localStorage.getItem("gpDemoLogged") === "in") acct.setAttribute("data-logged", "in"); } catch (e) {}

    var userBtn = document.getElementById("gpAcctUser");
    var menu = document.getElementById("gpAcctMenu");
    var logout = document.getElementById("gpAcctLogout");

    if (userBtn && menu) {
      userBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (menu.hasAttribute("hidden")) { menu.removeAttribute("hidden"); userBtn.setAttribute("aria-expanded", "true"); }
        else { menu.setAttribute("hidden", ""); userBtn.setAttribute("aria-expanded", "false"); }
      });
      document.addEventListener("click", function (ev) {
        if (!menu.hasAttribute("hidden") && !menu.contains(ev.target) && ev.target !== userBtn && !userBtn.contains(ev.target)) {
          menu.setAttribute("hidden", ""); userBtn.setAttribute("aria-expanded", "false");
        }
      });
    }

    if (logout) {
      logout.addEventListener("click", function () {
        acct.setAttribute("data-logged", "out");
        try { localStorage.removeItem("gpDemoLogged"); } catch (e) {}
        if (menu) menu.setAttribute("hidden", "");
        if (userBtn) userBtn.setAttribute("aria-expanded", "false");
      });
    }

    var demo = document.getElementById("gpAcctDemo");
    if (demo) {
      demo.addEventListener("click", function () {
        var isIn = acct.getAttribute("data-logged") === "in";
        acct.setAttribute("data-logged", isIn ? "out" : "in");
        try { isIn ? localStorage.removeItem("gpDemoLogged") : localStorage.setItem("gpDemoLogged", "in"); } catch (e) {}
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
  // 주입형 헤더(common.js가 DOMContentLoaded에서 렌더)도 커버
  document.addEventListener("DOMContentLoaded", function () { setTimeout(wire, 0); });
})();
