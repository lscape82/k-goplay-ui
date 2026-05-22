document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#estimateForm");
  if (!form) return;

  const [media, areas] = await Promise.all([
    AdPlay.loadJson("data/media.json"),
    AdPlay.loadJson("data/areas.json"),
  ]);

  const areaSelect = form.querySelector("[name='area']");
  const mediaSelect = form.querySelector("[name='media']");
  const summary = document.querySelector("#estimateSummary");
  const mailLink = document.querySelector("#mailLink");
  const copyButton = document.querySelector("#copyButton");

  areas.forEach((area) => areaSelect.appendChild(new Option(area.name, area.name)));
  media.forEach((item) => mediaSelect.appendChild(new Option(item.name, item.name)));

  const mediaSlug = AdPlay.getParam("media");
  const selectedMedia = media.find((item) => item.slug === mediaSlug);
  if (selectedMedia) {
    mediaSelect.value = selectedMedia.name;
    areaSelect.value = selectedMedia.areaName;
  }

  function getData() {
    return Object.fromEntries(new FormData(form).entries());
  }

  function buildBody(data) {
    return [
      "[광고플레이 DOOH 견적 문의]",
      "",
      `브랜드명: ${data.brand || "-"}`,
      `담당자명: ${data.manager || "-"}`,
      `연락처: ${data.phone || "-"}`,
      `이메일: ${data.email || "-"}`,
      `업종: ${data.industry || "-"}`,
      `희망 지역: ${data.area || "-"}`,
      `희망 매체: ${data.media || "-"}`,
      `예산 범위: ${data.budget || "-"}`,
      `집행 기간: ${data.period || "-"}`,
      `광고 소재 보유 여부: ${data.creative || "-"}`,
      "",
      "문의 내용:",
      data.message || "-",
    ].join("\n");
  }

  function displayValue(value, fallback = "미입력") {
    return value && String(value).trim() ? AdPlay.esc(value) : `<span class="empty-value">${fallback}</span>`;
  }

  function summaryRow(label, value, fallback) {
    return `
      <div class="summary-row-ui">
        <span>${AdPlay.esc(label)}</span>
        <strong>${displayValue(value, fallback)}</strong>
      </div>`;
  }

  function buildPreview(data) {
    return `
      <div class="invoice-preview">
        <div class="invoice-section">
          ${summaryRow("브랜드명", data.brand)}
          ${summaryRow("담당자명", data.manager)}
          ${summaryRow("연락처", data.phone)}
          ${summaryRow("이메일", data.email)}
          ${summaryRow("업종", data.industry)}
        </div>
        <div class="invoice-section">
          ${summaryRow("희망 지역", data.area, "자동 반영")}
          ${summaryRow("희망 매체", data.media, "자동 반영")}
          ${summaryRow("예산 범위", data.budget)}
          ${summaryRow("집행 기간", data.period)}
          ${summaryRow("광고 소재", data.creative)}
        </div>
        <div class="invoice-message">
          <span>문의 내용</span>
          <p>${displayValue(data.message)}</p>
        </div>
      </div>`;
  }

  function updateSummary() {
    const data = getData();
    const body = buildBody(data);
    summary.innerHTML = buildPreview(data);
    summary.dataset.rawBody = body;
    const subject = encodeURIComponent(`[광고플레이 DOOH 문의] ${data.brand || "견적 문의"}`);
    mailLink.href = `mailto:info@k-goplay.com?subject=${subject}&body=${encodeURIComponent(body)}`;
  }

  form.addEventListener("input", updateSummary);
  form.addEventListener("change", updateSummary);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    updateSummary();
    mailLink.focus();
  });
  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(summary.dataset.rawBody || buildBody(getData()));
    copyButton.textContent = "복사 완료";
    window.setTimeout(() => {
      copyButton.textContent = "문의 내용 복사하기";
    }, 1600);
  });

  updateSummary();
});
