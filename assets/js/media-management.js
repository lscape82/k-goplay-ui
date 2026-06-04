document.addEventListener("DOMContentLoaded", () => {
  const tableRoot = document.querySelector("#mediaAdminTable");
  const searchInput = document.querySelector("#mediaAdminSearch");
  const sortSelect = document.querySelector("#mediaAdminSort");
  const pageSizeSelect = document.querySelector("#mediaAdminPageSize");
  const statusEl = document.querySelector("#mediaAdminStatus");
  const refreshBtn = document.querySelector("#mediaAdminRefresh");
  const prevBtn = document.querySelector("#mediaAdminPrev");
  const nextBtn = document.querySelector("#mediaAdminNext");
  const pageEl = document.querySelector("#mediaAdminPage");
  const form = document.querySelector("#mediaAdminForm");
  const fieldsRoot = document.querySelector("#mediaAdminFields");
  const detailHead = document.querySelector(".admin-detail-head");
  const detailTitle = document.querySelector("#mediaAdminDetailTitle");
  const detailMeta = document.querySelector("#mediaAdminDetailMeta");
  const actionsRoot = document.querySelector("#mediaAdminActions");
  const usageWarning = document.querySelector("#mediaAdminUsageWarning");
  const saveNotice = document.querySelector("#mediaAdminSaveNotice");
  const cancelBtn = document.querySelector("#mediaAdminCancel");
  const saveBtn = document.querySelector("#mediaAdminSave");
  if (!tableRoot) return;

  const fieldGroups = [
    ["", ["representcompanyname", "representname", "isused", "ordering", "saddressinfo"]],
    ["", ["latitude", "longitude", "__spacer", "__geocodeButton", "panoposition", "__panoButton"]],
    ["", ["pickcategory", "periodcategory", "costcategory"]],
  ];
  const readOnlyColumns = new Set(["idx"]);
  const fieldLabels = {
    representcompanyname: "매체명",
    representname: "매체사",
    saddressinfo: "주소",
    latitude: "위도",
    longitude: "경도",
    panoposition: "로드뷰 좌표",
    isused: "사용 여부",
    ordering: "정렬순",
    pickcategory: "선택 카테고리",
    periodcategory: "기간 카테고리",
    costcategory: "비용 카테고리",
  };

  let columns = [];
  let rows = [];
  let page = 1;
  let totalPages = 1;
  let total = 0;
  let selectedIdx = null;
  let selectedSnapshot = null;
  let updateConfigured = false;
  const apiOrigin = window.location.hostname.endsWith("github.io") ? "https://k-goplay.vercel.app" : "";

  function esc(value) {
    return window.AdPlay ? AdPlay.esc(value) : String(value ?? "");
  }

  function valueText(value) {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  function compactText(value, fallback = "-") {
    const text = valueText(value).trim();
    return text || fallback;
  }

  function setStatus(message, tone = "") {
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
  }

  function apiUrl(path) {
    return `${apiOrigin}${path}`;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error("관리 API 서버에서 접속해야 합니다.");
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "요청 실패");
    return data;
  }

  function mediaTitle(row) {
    return compactText(row.representcompanyname || row.representname || row.idx, "이름 없음");
  }

  function mediaAddress(row) {
    return compactText(row.saddressinfo);
  }

  function updatePager() {
    pageEl.textContent = `${page.toLocaleString("ko-KR")} / ${totalPages.toLocaleString("ko-KR")}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
  }

  function renderList() {
    if (!rows.length) {
      tableRoot.innerHTML = `<div class="empty">조건에 맞는 매체가 없습니다.</div>`;
      updatePager();
      return;
    }

    tableRoot.innerHTML = rows.map((row) => {
      const selected = String(row.idx) === String(selectedIdx);
      return `
        <button class="admin-media-row ${selected ? "is-selected" : ""}" type="button" data-idx="${esc(row.idx)}">
          <span class="admin-row-main">
            <strong>${esc(mediaTitle(row))}</strong>
            <em>${esc(mediaAddress(row))}</em>
          </span>
        </button>`;
    }).join("");

    tableRoot.querySelectorAll("[data-idx]").forEach((button) => {
      button.addEventListener("click", () => selectRow(button.dataset.idx));
    });
    updatePager();
  }

  function inputHtml(col, value) {
    const text = valueText(value);
    const readOnly = readOnlyColumns.has(col);
    const attrs = `name="${esc(col)}" data-col="${esc(col)}"${readOnly ? " readonly" : ""}`;
    if (col === "isused") {
      const selected = text === "0" || text.toLowerCase() === "false" ? "0" : "1";
      return `
        <select ${attrs}>
          <option value="1"${selected === "1" ? " selected" : ""}>사용</option>
          <option value="0"${selected === "0" ? " selected" : ""}>미사용</option>
        </select>`;
    }
    if (text.length > 140) {
      return `<textarea ${attrs}>${esc(text)}</textarea>`;
    }
    return `<input ${attrs} value="${esc(text)}">`;
  }

  function renderFields(row) {
    const used = new Set(["idx", "addressinfo"]);
    const groups = fieldGroups.map(([title, cols]) => {
      const available = cols.filter((col) => col.startsWith("__") || columns.includes(col));
      available.forEach((col) => {
        if (!col.startsWith("__")) used.add(col);
      });
      if (!available.length) return "";
      return `
        <section class="admin-field-group">
          ${title ? `<h3>${esc(title)}</h3>` : ""}
          <div class="admin-field-grid">
            ${available.map((col) => renderFieldCell(col, row)).join("")}
          </div>
        </section>`;
    }).join("");

    const etc = columns.filter((col) => !used.has(col));
    const etcHtml = etc.length
      ? `
        <section class="admin-field-group">
          <h3>기타</h3>
          <div class="admin-field-grid">
            ${etc.map((col) => `
              <label class="field">
                <span>${esc(fieldLabels[col] || col)}</span>
                ${inputHtml(col, row[col])}
              </label>`).join("")}
          </div>
        </section>`
      : "";
    fieldsRoot.innerHTML = groups + etcHtml;
    hideSaveNotice();
    updateUsageWarning();
  }

  function updateUsageWarning() {
    const isusedInput = fieldsRoot.querySelector('[data-col="isused"]');
    usageWarning.hidden = !isusedInput || isusedInput.value !== "0";
  }

  function showSaveNotice(message = "완료되었습니다.", tone = "ok") {
    saveNotice.textContent = message;
    saveNotice.dataset.tone = tone;
    saveNotice.hidden = false;
    window.clearTimeout(showSaveNotice._timer);
    showSaveNotice._timer = window.setTimeout(hideSaveNotice, 2500);
  }

  function hideSaveNotice() {
    if (!saveNotice) return;
    saveNotice.hidden = true;
    saveNotice.textContent = "";
  }

  function renderFieldCell(col, row) {
    if (col === "__geocodeButton") {
      return `
        <div class="field admin-action-cell">
          <span>&nbsp;</span>
          <button type="button" class="button secondary admin-geocode-button" data-action="geocode">주소로 위경도 불러오기</button>
        </div>`;
    }
    if (col === "__spacer") {
      return `<div class="field admin-grid-spacer" aria-hidden="true"></div>`;
    }
    if (col === "__panoButton") {
      return `
        <div class="field admin-action-cell">
          <span>&nbsp;</span>
          <button type="button" class="button secondary admin-geocode-button admin-pano-button" data-action="pano">위경도로 로드뷰 좌표 생성</button>
        </div>`;
    }
    return `
      <label class="field ${col === "saddressinfo" || col === "costcategory" ? "full" : ""}">
        <span>${esc(fieldLabels[col] || col)}${readOnlyColumns.has(col) ? " / 키" : ""}</span>
        ${inputHtml(col, row[col])}
      </label>`;
  }

  async function geocodeSelectedAddress() {
    const roadInput = fieldsRoot.querySelector('[data-col="saddressinfo"]');
    const query = (roadInput?.value || "").trim();
    if (!query) {
      setStatus("주소를 입력해 주세요.", "error");
      return;
    }

    const button = fieldsRoot.querySelector('[data-action="geocode"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "변환 중";
    setStatus("주소 변환 중");

    try {
      const data = await geocodeAddress(query);
      const addr = data.addresses && data.addresses[0];
      if (!addr) throw new Error("주소 결과가 없습니다.");

      const latInput = fieldsRoot.querySelector('[data-col="latitude"]');
      const lngInput = fieldsRoot.querySelector('[data-col="longitude"]');
      if (roadInput && addr.roadAddress) roadInput.value = addr.roadAddress;
      if (latInput) latInput.value = addr.y;
      if (lngInput) lngInput.value = addr.x;
      setStatus("위경도 불러오기 완료", "ok");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function fillPanopositionFromCoords() {
    const latInput = fieldsRoot.querySelector('[data-col="latitude"]');
    const lngInput = fieldsRoot.querySelector('[data-col="longitude"]');
    const panoInput = fieldsRoot.querySelector('[data-col="panoposition"]');
    const lat = (latInput?.value || "").trim();
    const lng = (lngInput?.value || "").trim();
    if (!lat || !lng) {
      setStatus("위도와 경도를 먼저 입력해 주세요.", "error");
      return;
    }
    const current = (panoInput?.value || "").trim().split(",");
    const heading = current[2] || "0";
    const pitch = current[3] || "0";
    const zoom = current[4] || "100";
    panoInput.value = `${lat},${lng},${heading},${pitch},${zoom}`;
    setStatus("로드뷰 좌표 생성 완료", "ok");
  }

  async function geocodeAddress(query) {
    try {
      const configResponse = await fetch(apiUrl("/api/geocode/config"));
      const config = configResponse.ok ? await configResponse.json() : {};
      if (config.configured) {
        const response = await fetch(apiUrl("/api/geocode?query=" + encodeURIComponent(query)));
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "주소 변환 실패");
        return data;
      }
    } catch (error) {
      console.warn("proxy geocode unavailable:", error);
    }

    return new Promise((resolve, reject) => {
      if (!window.naver || !naver.maps || !naver.maps.Service) {
        reject(new Error("네이버 지도 SDK가 로드되지 않았습니다."));
        return;
      }
      naver.maps.Service.geocode({ query }, (status, response) => {
        if (status !== naver.maps.Service.Status.OK) {
          reject(new Error("주소 변환에 실패했습니다."));
          return;
        }
        resolve(response.v2);
      });
    });
  }

  function selectRow(idx) {
    selectedIdx = idx;
    const row = rows.find((item) => String(item.idx) === String(idx));
    if (!row) return;
    selectedSnapshot = { ...row };
    detailTitle.textContent = mediaTitle(row);
    detailMeta.textContent = mediaAddress(row);
    detailHead.hidden = true;
    actionsRoot.hidden = false;
    saveBtn.disabled = !updateConfigured;
    cancelBtn.disabled = false;
    saveBtn.textContent = updateConfigured ? "저장" : "저장 불가";
    renderFields(row);
    renderList();
  }

  async function loadConfig() {
    try {
      const data = await fetchJson(apiUrl("/api/media/config"));
      updateConfigured = data.updateConfigured === true;
    } catch {
      updateConfigured = false;
    }
  }

  async function loadMedia() {
    setStatus("DB 조회 중");
    const [sortBy, sortDir] = sortSelect.value.split(":");
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: pageSizeSelect.value,
        search: searchInput.value.trim(),
        sortBy,
        sortDir,
      });
      const data = await fetchJson(apiUrl(`/api/media/admin?${params.toString()}`));
      columns = data.columns || [];
      rows = data.rows || [];
      total = data.total || 0;
      totalPages = data.totalPages || 1;
      page = data.page || page;
      setStatus(`총 ${total.toLocaleString("ko-KR")}개 / 현재 ${rows.length.toLocaleString("ko-KR")}개`, "ok");
      renderList();
      if (selectedIdx && rows.some((row) => String(row.idx) === String(selectedIdx))) {
        selectRow(selectedIdx);
      }
    } catch (error) {
      tableRoot.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
      setStatus("조회 실패", "error");
      updatePager();
    }
  }

  function resetAndLoad() {
    page = 1;
    loadMedia();
  }

  searchInput.addEventListener("input", () => {
    window.clearTimeout(searchInput._timer);
    searchInput._timer = window.setTimeout(resetAndLoad, 300);
  });
  [sortSelect, pageSizeSelect].forEach((control) => {
    control.addEventListener("change", resetAndLoad);
  });
  refreshBtn.addEventListener("click", () => loadMedia());
  prevBtn.addEventListener("click", () => {
    if (page <= 1) return;
    page -= 1;
    loadMedia();
  });
  nextBtn.addEventListener("click", () => {
    if (page >= totalPages) return;
    page += 1;
    loadMedia();
  });

  fieldsRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "geocode") geocodeSelectedAddress();
    if (button.dataset.action === "pano") fillPanopositionFromCoords();
  });

  fieldsRoot.addEventListener("change", (event) => {
    if (event.target.matches('[data-col="isused"]')) updateUsageWarning();
  });

  cancelBtn.addEventListener("click", () => {
    if (!selectedSnapshot) return;
    renderFields(selectedSnapshot);
    setStatus("변경 취소됨");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!updateConfigured) {
      setStatus("저장 API가 비활성화되어 있습니다.", "error");
      return;
    }

    const row = rows.find((item) => String(item.idx) === String(selectedIdx));
    if (!row) return;

    const updates = {};
    fieldsRoot.querySelectorAll("[data-col]").forEach((input) => {
      if (input.readOnly) return;
      const col = input.dataset.col;
      const nextValue = input.value;
      if (nextValue !== valueText(row[col])) updates[col] = nextValue;
    });

    if (!Object.keys(updates).length) {
      setStatus("변경된 값이 없습니다.");
      return;
    }

    saveBtn.disabled = true;
    showSaveNotice("저장 중...", "ok");
    fetch(apiUrl("/api/media/admin/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyColumn: "idx",
        keyValue: row.idx,
        updates,
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "저장 실패");
        Object.assign(row, updates);
        selectedSnapshot = { ...row };
        selectRow(row.idx);
        showSaveNotice("완료되었습니다.", "ok");
      })
      .catch((error) => {
        showSaveNotice(error.message, "error");
        saveBtn.disabled = false;
      });
  });

  loadConfig().then(loadMedia);
});
