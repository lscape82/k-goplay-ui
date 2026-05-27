(function () {
  let proxyConfigured = false;

  async function checkConfig() {
    try {
      const res = await fetch("/api/geocode/config");
      if (!res.ok) return false;
      const data = await res.json();
      return data.configured === true;
    } catch {
      return false;
    }
  }

  async function geocodeAddress(query) {
    const res = await fetch("/api/geocode?query=" + encodeURIComponent(query));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "주소 변환에 실패했습니다.");
    return data;
  }

  function renderResult(query, data) {
    const addr = data.addresses && data.addresses[0];
    if (!addr) {
      showError("주소를 찾을 수 없습니다. 더 구체적인 주소로 다시 시도해 주세요.");
      return;
    }

    const lat = addr.y;
    const lng = addr.x;
    const roadAddr = addr.roadAddress || "—";
    const jibunAddr = addr.jibunAddress || "—";
    const navUrl =
      "https://map.naver.com/p/search/" +
      encodeURIComponent(addr.roadAddress || addr.jibunAddress || query);

    document.getElementById("resultInputAddr").textContent = query;
    document.getElementById("resultRoadAddr").textContent = roadAddr;
    document.getElementById("resultJibunAddr").textContent = jibunAddr;
    document.getElementById("resultLat").value = lat;
    document.getElementById("resultLng").value = lng;
    document.getElementById("naverMapLink").href = navUrl;

    const resultEl = document.getElementById("geocodeResult");
    resultEl.hidden = false;
    resultEl.dataset.lat = lat;
    resultEl.dataset.lng = lng;

    document.getElementById("geocodeError").hidden = true;
    document.getElementById("geocodeResultPlaceholder").hidden = true;
  }

  function showError(msg) {
    const el = document.getElementById("geocodeError");
    el.textContent = msg;
    el.hidden = false;
    document.getElementById("geocodeResult").hidden = true;
    document.getElementById("geocodeResultPlaceholder").hidden = true;
  }

  async function submitGeocode(query) {
    const btn = document.getElementById("geocodeBtn");
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "변환 중…";
    document.getElementById("geocodeError").hidden = true;

    try {
      const data = await geocodeAddress(query);
      renderResult(query, data);
    } catch (err) {
      showError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (location.protocol === "file:") {
      document.getElementById("fileProtocolWarning").hidden = false;
      document.getElementById("geocodeBtn").disabled = true;
      return;
    }

    proxyConfigured = await checkConfig();

    if (!proxyConfigured) {
      document.getElementById("configWarning").hidden = false;
      document.getElementById("geocodeBtn").disabled = true;
    }

    const addressParam = AdPlay.getParam("address");
    if (addressParam) {
      document.getElementById("addressInput").value = addressParam;
      if (proxyConfigured) {
        submitGeocode(addressParam);
      }
    }

    document.getElementById("geocodeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const query = document.getElementById("addressInput").value.trim();
      if (query) submitGeocode(query);
    });

    document.getElementById("copyCoords").addEventListener("click", () => {
      const result = document.getElementById("geocodeResult");
      const text = result.dataset.lat + ", " + result.dataset.lng;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById("copyCoords");
        const orig = btn.textContent;
        btn.textContent = "복사됨!";
        setTimeout(() => {
          btn.textContent = orig;
        }, 1500);
      });
    });
  });
})();
