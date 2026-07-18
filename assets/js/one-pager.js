/* =====================================================================
   한장제안서 (A4 가로 · 매체 1개당 1장)
   ?slugs=m-340,m-98  또는  ?slug=m-340
   가시권 cone의 방향은 지어내지 않는다 — 매체 좌표에서 거리뷰 촬영 지점을 향하는
   실제 방위각을 쓴다(거리뷰 카메라가 선 자리 = 그 매체가 보이는 자리).
   ===================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  const stage = document.querySelector("#opStage");
  if (!stage) return;

  const countEl = document.querySelector("#opCount");
  const params = new URLSearchParams(location.search);
  const slugs = (params.get("slugs") || params.get("slug") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const [media, locations] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/media_locations.json").catch(() => ({})),
  ]);
  const bySlug = new Map(media.map((m) => [m.slug, m]));
  const picked = slugs.map((s) => bySlug.get(s)).filter(Boolean);

  if (!picked.length) {
    countEl.textContent = "매체 없음";
    stage.innerHTML =
      '<div style="padding:60px 20px;text-align:center;color:#6b7280;font-size:14px;line-height:1.8">' +
      "선택된 매체가 없습니다.<br>관심매체를 담은 뒤 다시 시도해 주세요." +
      '<br><br><code style="background:#e5e7eb;padding:4px 8px;border-radius:5px;font-size:12px">one-pager.html?slugs=m-340,m-98</code></div>';
    return;
  }
  countEl.textContent = `${picked.length}개 매체 · A4 가로 ${picked.length}장`;

  /* ── 포맷 ── */
  const manwon = (krw) => (krw / 10000).toLocaleString("ko-KR") + "만원";

  /** 광고비 행: periods가 있으면 기간별 전부, 없으면 월 가격만 */
  function priceValue(p) {
    if (Array.isArray(p.periods) && p.periods.length) {
      return p.periods
        .map((x) => `<b>${manwon(x.priceKRW)}</b>/${AdPlay.esc(x.label)}`)
        .join(", ");
    }
    if (p.monthlyPriceKRW) return `<b>${manwon(p.monthlyPriceKRW)}</b>/월`;
    return AdPlay.esc(p.rawText || "협의");
  }

  function priceBlock(item) {
    const rows = (item.pricing || []).map(
      (p) => `
        <div class="price-row">
          <span class="pl">1일 ${AdPlay.esc(p.label)}</span>
          <span class="pv">${priceValue(p)}</span>
        </div>`
    );
    if (!rows.length && item.contractLines) {
      (item.contractLines || []).filter((l) => !l.startsWith("*")).forEach((l) => {
        rows.push(`<div class="price-row"><span class="pl">계약</span><span class="pv">${AdPlay.esc(l)}</span></div>`);
      });
    }
    return `<div class="price-grid">${rows.join("")}</div>`;
  }

  /** 비고 = 계약 문구 중 * 로 시작하는 단서 조항 */
  function noteText(item) {
    const notes = (item.contractLines || []).filter((l) => l.trim().startsWith("*"));
    return notes.length ? notes.map((n) => n.replace(/^\*\s*/, "")).join(" · ") : "";
  }

  /* ── 좌표 · 방위 ── */
  function coordsOf(item) {
    const loc = locations[item.slug] || {};
    const lat = loc.latitude ?? item.streetView?.lat;
    const lng = loc.longitude ?? item.streetView?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return null;
    const sv = loc.streetView || item.streetView || null;
    return { lat, lng, sv };
  }

  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  /** 매체 → 거리뷰 지점 방위각(도). 그 매체가 "보이는 방향"이다. */
  function bearing(from, to) {
    const φ1 = toRad(from.lat), φ2 = toRad(to.lat), Δλ = toRad(to.lng - from.lng);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /** 방위각·거리(m)만큼 이동한 좌표 */
  function destination(origin, brg, meters) {
    const R = 6371000, δ = meters / R, θ = toRad(brg);
    const φ1 = toRad(origin.lat), λ1 = toRad(origin.lng);
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    return { lat: toDeg(φ2), lng: toDeg(λ2) };
  }

  /* ── 시트 ── */
  function sheetHtml(item, index) {
    const tags = (item.tags || []).map((t) => `<span>#${AdPlay.esc(t)}</span>`).join("");
    const note = noteText(item);
    const photo = item.imageUrl
      ? `<img src="${AdPlay.esc(item.imageUrl)}" alt="${AdPlay.esc(item.name)} 현장 사진" loading="eager">`
      : `<div class="ph-empty">현장 사진 준비 중</div>`;

    return `
      <article class="sheet" data-slug="${AdPlay.esc(item.slug)}">
        <div class="sheet-photo">
          ${photo}
          ${item.mediaType ? `<div class="ph-badge">${AdPlay.esc(item.mediaType)}</div>` : ""}
        </div>
        <div class="sheet-body">
          <h2 class="sheet-name">${AdPlay.esc(item.name)}</h2>
          <div class="sheet-tags">${tags}</div>
          <table class="spec">
            <tr><th>위치</th><td>${AdPlay.esc(item.jibunAddress || item.address || "-")}</td></tr>
            <tr><th>매체 규격</th><td>${AdPlay.esc(item.sizeText || "-")}</td></tr>
            <tr><th>해상도</th><td>${AdPlay.esc(item.resolutionPx || "-")} <span style="color:#6b7280">px</span></td></tr>
            <tr>
              <th>광고비<br><span style="font-weight:600;color:#6b7280">(${AdPlay.esc(item.taxNote || "VAT 별도")})</span></th>
              <td>${priceBlock(item)}${note ? `<p class="price-note">* ${AdPlay.esc(note)}</p>` : ""}</td>
            </tr>
            <tr><th>운영시간</th><td>${AdPlay.esc(item.operationHours || "-")}</td></tr>
            ${item.exposureShort ? `<tr><th>비고</th><td>${AdPlay.esc(item.exposureShort)}</td></tr>` : ""}
          </table>
          <div class="sheet-map">
            <div class="map-canvas" id="opMap${index}"></div>
          </div>
          <div class="sheet-foot">
            <span class="brand">광고플레이</span>
            <span>${AdPlay.config.phone || "1533-1975"}</span>
            <span class="sep">${AdPlay.esc(item.areaName || "")}</span>
          </div>
        </div>
      </article>`;
  }

  stage.innerHTML = picked.map(sheetHtml).join("");

  /* ── 지도 + 가시권 ── */
  picked.forEach((item, index) => {
    const el = document.getElementById(`opMap${index}`);
    const c = coordsOf(item);
    if (!el || !c || !window.naver?.maps) {
      if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#9ca3af;font-size:11px">위치 정보 준비 중</div>';
      return;
    }
    const center = new naver.maps.LatLng(c.lat, c.lng);
    const map = new naver.maps.Map(el, {
      center, zoom: 16, draggable: false, scrollWheel: false, disableDoubleClickZoom: true,
      mapDataControl: false, scaleControl: false, logoControl: true, zoomControl: false,
    });
    new naver.maps.Marker({ position: center, map });

    // 가시권: 거리뷰 지점을 향하는 방위각 ±26°, 반경 180m
    if (c.sv && typeof c.sv.lat === "number") {
      const brg = bearing({ lat: c.lat, lng: c.lng }, { lat: c.sv.lat, lng: c.sv.lng });
      const R = 180, SPREAD = 26;
      const path = [center];
      for (let a = -SPREAD; a <= SPREAD; a += 6.5) {
        const p = destination({ lat: c.lat, lng: c.lng }, brg + a, R);
        path.push(new naver.maps.LatLng(p.lat, p.lng));
      }
      new naver.maps.Polygon({
        map, paths: [path],
        fillColor: "#1f4fd8", fillOpacity: 0.22,
        strokeColor: "#1f4fd8", strokeOpacity: 0.55, strokeWeight: 1,
      });
    }
  });

  /* ── 액션 ── */
  document.querySelector("#opPrint").addEventListener("click", () => window.print());
  document.querySelector("#opBack").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "map.html";
  });
  if (params.get("print") === "1") window.setTimeout(() => window.print(), 900);
});
