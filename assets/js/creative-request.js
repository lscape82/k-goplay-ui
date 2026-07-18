/* =====================================================================
   광고 소재 제작 의뢰서 — 실시간 예상 견적
   금액 모델의 근거: 동일 제작사·동일 일자·동일 20초 광고 견적서 2건(실물).
     · 인포그래픽版(촬영 없음) = 기획 100 + 편집 200 + 디자인 100 + 성우 100 = 500만
     · 영상촬영版(촬영 있음)   = 기획 100 + 촬영 250 + 장비 200 + 편집 150 + 배우 200 = 900만
   촬영을 하면 편집비가 400→150만으로 내려간다(실사가 있으면 그래픽을 만들 필요가 없음).
   ※ 추정치를 지어내지 않는다 — 위 두 건에 없는 항목(다국어 등)은 금액 대신 "별도 협의".
   ===================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#creativeForm");
  if (!form) return;

  const quoteEl = document.querySelector("#crQuote");
  const mailLink = document.querySelector("#crMailLink");
  const copyButton = document.querySelector("#crCopyButton");
  const actorBlock = document.querySelector("#crActorBlock");

  const MAN = 10000; // 1만원

  // 견적서 실물에서 그대로 가져온 단가
  const RATE = {
    planning: 100 * MAN,   // Preproduction (기획 구성료) — 촬영 여부와 무관하게 동일
    shooting: 250 * MAN,   // Production (촬영)
    gear: 200 * MAN,       // 촬영 장비대여비
    design: 100 * MAN,     // 디자인 (촬영 없을 때만)
    editGraphic: 200 * MAN, // 편집 (모션/자막/효과음/BGM) — 촬영 없을 때
    editShoot: 150 * MAN,  // 편집 (색보정/자막/효과음/BGM) — 촬영 있을 때
    voice: 100 * MAN,      // 성우 녹음
    actor: 200 * MAN,      // 메인 배우
  };

  const won = (n) => "₩" + n.toLocaleString("ko-KR");
  const eok = (n) => (n / MAN).toLocaleString("ko-KR") + "만원";

  function getData() {
    const fd = new FormData(form);
    const multi = (name) => fd.getAll(name).filter(Boolean);
    return {
      brand: fd.get("brand") || "",
      contact: fd.get("contact") || "",
      shoot: fd.get("shoot") || "none",
      actor: fd.get("actor") || "none",
      assets: multi("asset"),
      media: multi("medium"),
      length: fd.get("length") || "",
      voice: !!fd.get("voice"),
      multilang: !!fd.get("multilang"),
      addon: !!fd.get("addon"),
      budget: fd.get("budget") || "",
      due: fd.get("due") || "",
      reference: fd.get("reference") || "",
      message: fd.get("message") || "",
    };
  }

  /** 견적서 항목을 그대로 재현한 라인 목록 */
  function buildLines(d) {
    const shooting = d.shoot === "shoot";
    const lines = [
      { key: "planning", label: "기획 (구성안·카피 구조)", amount: RATE.planning, on: true },
    ];

    if (shooting) {
      lines.push({ key: "shooting", label: "촬영", amount: RATE.shooting, on: true });
      lines.push({ key: "gear", label: "촬영 장비 대여", amount: RATE.gear, on: true });
      lines.push({ key: "edit", label: "편집 (색보정·자막·효과음·BGM)", amount: RATE.editShoot, on: true });
      lines.push({ key: "actor", label: "메인 배우", amount: RATE.actor, on: d.actor === "actor" });
    } else {
      lines.push({ key: "design", label: "디자인 (KV·배경·타이포)", amount: RATE.design, on: true });
      lines.push({ key: "edit", label: "편집 (모션·자막·효과음·BGM)", amount: RATE.editGraphic, on: true });
    }

    lines.push({ key: "voice", label: "성우 녹음", amount: RATE.voice, on: d.voice });
    return lines;
  }

  function total(lines) {
    return lines.reduce((sum, l) => (l.on ? sum + l.amount : sum), 0);
  }

  /** 촬영 방식을 아직 못 정한 경우의 범위 (두 견적서의 최소~최대) */
  function askRange(d) {
    const min = RATE.planning + RATE.design + RATE.editGraphic + (d.voice ? RATE.voice : 0);
    const max = RATE.planning + RATE.shooting + RATE.gear + RATE.editShoot + RATE.actor + (d.voice ? RATE.voice : 0);
    return [min, max];
  }

  function line(l) {
    return `
      <div class="cr-line${l.on ? "" : " off"}">
        <span class="l">${AdPlay.esc(l.label)}</span>
        <span class="v">${won(l.amount)}</span>
      </div>`;
  }

  function buildQuote(d) {
    const shooting = d.shoot === "shoot";
    const asking = d.shoot === "ask";

    if (asking) {
      const [min, max] = askRange(d);
      return `
        <div class="cr-quote">
          <div class="cr-quote-h"><b>예상 제작비 범위</b><span>방식 미정</span></div>
          <div class="cr-empty">
            촬영 방식을 정하면 항목별 견적을 보여드립니다.<br>
            <strong style="color:#111827">보유 소재 제작 ${eok(min)} ~ 새로 촬영 ${eok(max)}</strong>
          </div>
        </div>
        <p class="cr-note">
          <b>VAT 별도 · 실비 별도</b> (식비·교통비·유류비·의상구입비·현장 인건비는 진행 시 별도 정산)<br>
          목적과 예산을 알려주시면 <b>적합한 방식을 먼저 제안</b>드린 뒤 정식 견적서를 보내드립니다.
        </p>
        <span class="cr-src">실제 견적 2건(20초) 기준 · 참고용</span>`;
    }

    const lines = buildLines(d);
    const sum = total(lines);

    return `
      <div class="cr-quote">
        <div class="cr-quote-h"><b>예상 제작비</b><span>${shooting ? "새로 촬영" : "보유 소재 제작"}${d.length ? " · " + AdPlay.esc(d.length) : ""}</span></div>
        ${lines.map(line).join("")}
        <div class="cr-total"><span class="l">합계 (VAT 별도)</span><span class="v">${won(sum)}</span></div>
      </div>
      <p class="cr-note">
        <b>VAT 별도 · 실비 별도</b> (식비·교통비·유류비·의상구입비·현장 인건비는 진행 시 별도 정산)<br>
        ${d.multilang ? "<b>다국어 자막</b>은 구성 범위에 따라 달라져 <b>별도 협의</b>합니다.<br>" : ""}
        ${d.media.length > 1 ? `<b>매체 ${d.media.length}종</b> 송출 규격별 최적화 편집이 포함됩니다.<br>` : ""}
        위 금액은 <b>참고용 추정</b>이며, 정식 견적서는 <b>24시간 이내</b> 발송됩니다.
      </p>
      <span class="cr-src">실제 견적 2건(20초) 기준 · 참고용</span>`;
  }

  function buildBody(d) {
    const lines = buildLines(d);
    const shootLabel = { none: "보유 소재로 제작 (촬영 없음)", shoot: "새로 촬영", ask: "추천 요청 (방식 미정)" }[d.shoot];
    const out = [
      "[광고플레이 소재 제작 의뢰서]",
      "",
      `회사명/브랜드명: ${d.brand || "-"}`,
      `연락처: ${d.contact || "-"}`,
      "",
      `촬영 방식: ${shootLabel}`,
    ];
    if (d.shoot === "shoot") out.push(`출연자: ${d.actor === "actor" ? "모델·배우 필요" : "제품·공간만 촬영"}`);
    out.push(
      `보유 소재: ${d.assets.length ? d.assets.join(", ") : "-"}`,
      `집행 매체: ${d.media.length ? d.media.join(", ") : "-"}`,
      `영상 길이: ${d.length || "-"}`,
      `성우·내레이션: ${d.voice ? "필요" : "불필요"}`,
      `다국어 자막: ${d.multilang ? "필요 (별도 협의)" : "불필요"}`,
      `기획·카피 대행: ${d.addon ? "요청" : "브랜드 제공"}`,
      `예산 범위: ${d.budget || "-"}`,
      `희망 납기일: ${d.due || "-"}`,
      `참고 영상: ${d.reference || "-"}`,
      "",
      "— 예상 제작비 (VAT 별도, 실비 별도) —"
    );

    if (d.shoot === "ask") {
      const [min, max] = askRange(d);
      out.push(`방식 미정 · ${eok(min)} ~ ${eok(max)}`);
    } else {
      lines.filter((l) => l.on).forEach((l) => out.push(`${l.label}: ${won(l.amount)}`));
      out.push(`합계: ${won(total(lines))}`);
    }

    out.push("", "추가 내용:", d.message || "-");
    return out.join("\n");
  }

  function update() {
    const d = getData();
    actorBlock.hidden = d.shoot !== "shoot";
    quoteEl.innerHTML = buildQuote(d);
    const body = buildBody(d);
    quoteEl.dataset.rawBody = body;
    const subject = encodeURIComponent(`[광고플레이 소재 제작 의뢰] ${d.brand || "제작 문의"}`);
    mailLink.href = `mailto:${AdPlay.config.email}?subject=${subject}&body=${encodeURIComponent(body)}`;
  }

  // "없음"과 나머지 보유 소재는 함께 고를 수 없음
  form.addEventListener("change", (event) => {
    const t = event.target;
    if (t.name === "asset") {
      const boxes = [...form.querySelectorAll("[name='asset']")];
      const none = boxes.find((b) => b.value === "없음");
      if (t === none && t.checked) boxes.forEach((b) => { if (b !== none) b.checked = false; });
      else if (t !== none && t.checked && none) none.checked = false;
    }
    update();
  });
  form.addEventListener("input", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    update();
    mailLink.focus();
  });

  copyButton.addEventListener("click", async () => {
    await navigator.clipboard.writeText(quoteEl.dataset.rawBody || buildBody(getData()));
    copyButton.textContent = "복사 완료";
    window.setTimeout(() => { copyButton.textContent = "의뢰 내용 복사하기"; }, 1600);
  });

  update();
});
