/* media-grade.js — 매체 노출력 등급 산정 (⑨)
 * 입지(유동인구)와 분리된 "매체 자체의 노출력"을 물리·형태·설치·송출·노출환경 지표로
 * 점수화 → 등급(SSA/SA/A/B/C). 현장 실사 주관판단을 규칙화·점수화·반복가능하게 자동화.
 *
 * 설계 근거(공신력): 서범석 OSCAR(정면도·크기·설치높이·간섭도), 김신엽·심성욱(가로·세로·설치높이),
 * Geopath LTS(시야내크기·중심성·노출시간), Route/VAC, Spieß&Nikolaus(가림·환경복잡도 최대영향).
 * ※ 가중치는 수렴된 연구 결과 기반 초안이며 실측 튜닝 전제. 실사 필요 항목은 보유 데이터로
 *   자동 추정 후 체크리스트로 보정(auto + 실사 하이브리드).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MediaGrade = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var has = function (s, re) { return re.test(s || ""); };

  // 규격 파싱: widthM/heightM 우선, 없으면 sizeText 의 "Nm x Mm" 에서 미터 추출.
  function parseSizeArea(it) {
    if (it.widthM && it.heightM) return it.widthM * it.heightM;
    var t = String(it.sizeText || "");
    // "12m x 18.5m" / "11.2 x 20.0m" — 미터 표기(소수 포함, 두 자리 이하)만 면적으로
    var m = t.match(/([\d.]+)\s*m?\s*[xX×]\s*([\d.]+)\s*m/);
    if (m) { var w = parseFloat(m[1]), h = parseFloat(m[2]); if (w < 100 && h < 100) return w * h; }
    return null;
  }
  function parseResoPx(it) {
    var t = String(it.resolutionPx || it.sizeText || "");
    var m = t.match(/(\d{3,5})\s*[xX×]\s*(\d{3,5})\s*px/) || (/(\d{3,5})\s*[xX×]\s*(\d{3,5})/.test(t) && t.indexOf("m") < 0 ? t.match(/(\d{3,5})\s*[xX×]\s*(\d{3,5})/) : null);
    if (m) return parseInt(m[1], 10) * parseInt(m[2], 10);
    return null;
  }
  // 면적(㎡) → 0~5
  function sizeScore(area, cat) {
    if (area == null) { // 데이터 없으면 카테고리 기본값
      return ({ large_billboard: 4, highway: 4, subway: 2.5, shopping_mall_did: 3, transport_hub: 3, bus: 2, convenience: 1.5, other: 2.5, package: 4 })[cat] || 2.5;
    }
    if (area >= 150) return 5; if (area >= 80) return 4.3; if (area >= 40) return 3.5;
    if (area >= 15) return 2.8; if (area >= 5) return 2; return 1.2;
  }
  function resoScore(px, cat) {
    if (px == null) return ({ convenience: 4, shopping_mall_did: 4, subway: 3.5, large_billboard: 3.5 })[cat] || 3;
    if (px >= 3000000) return 5; if (px >= 1500000) return 4.3; if (px >= 700000) return 3.6; if (px >= 300000) return 3; return 2.3;
  }

  // 형태 분류 (sizeText + locationDescription)
  function detectForm(it) {
    var t = (it.name || "") + " " + (it.sizeText || "") + " " + (it.locationDescription || "") + " " + (it.exposureShort || "");
    var tags = [];
    if (has(t, /커브|곡면|라운드/)) tags.push("커브형");
    if (has(t, /초대형|대형/)) tags.push("대형");
    if (has(t, /세로형|세로/)) tags.push("세로형"); else if (has(t, /가로형|가로/)) tags.push("가로형");
    if (has(t, /분할|멀티|다면|여러\s*면/)) tags.push("분할·멀티면");
    return tags;
  }
  function formScore(tags, cat) {
    var s = 2.5;
    if (tags.indexOf("커브형") >= 0) s += 1.2;
    if (tags.indexOf("대형") >= 0) s += 0.8;
    if (tags.indexOf("세로형") >= 0) s += 0.6;       // 보행 눈높이 시야 유리
    if (tags.indexOf("분할·멀티면") >= 0) s += 0.9;   // 동시송출/주목
    return clamp(s, 1, 5);
  }

  // 접점 유형 분류 (노출 대상 × 동선 상태) — locationDescription 키워드 규칙
  function detectContext(it) {
    var t = (it.name || "") + " " + (it.locationDescription || "") + " " + (it.exposureShort || "") + " " + (it.areaName || "") + " " + (it.mediaType || "");
    var cat = it.category;
    if (cat === "subway" || cat === "transport_hub") return { key: "station", label: "역사 내", target: "보행", flow: "대합실·환승" };
    if (cat === "convenience" || has(t, /편의점|매장|점포|스토어/)) return { key: "store", label: "매장 앞", target: "보행", flow: "보행+계산대 대기" };
    if (cat === "highway" || has(t, /고속도로|나들목|IC|톨게이트/)) return { key: "road", label: "도로가(고속)", target: "운전자", flow: "이동(고속)" };
    if (has(t, /광장|페스티벌|축제|행사/)) return { key: "plaza", label: "광장형", target: "보행", flow: "체류" };
    if (has(t, /사거리|교차로/)) return { key: "cross", label: "사거리·교차로", target: "차량+보행", flow: "복합·신호대기" };
    if (has(t, /횡단보도/)) return { key: "crosswalk", label: "횡단보도", target: "보행", flow: "대기(체류)" };
    // 역사 '내부' 단서(랜드마크 "○○역"만으로는 역사 내 아님 — 빌딩 전광판 오분류 방지)
    if (has(t, /승강장|대합실|환승\s*통로|환승통로|개찰|스크린도어|역사\s*내|연결\s*통로|지하\s*연결/)) return { key: "station", label: "역사 내", target: "보행", flow: "대합실·환승" };
    if (has(t, /터미널|공항|쇼핑몰/)) return { key: "indoor", label: "터미널·몰", target: "보행", flow: "실내 보행" };
    if (has(t, /도로|대로|차량|교통량/)) return { key: "road", label: "도로가", target: "차량+보행", flow: "이동(+신호대기)" };
    return { key: "walk", label: "보행로", target: "보행", flow: "이동" };
  }
  // 타깃 동선(오디언스) 감지 — 광고주는 "누가 보느냐"로 매체를 고른다.
  //  name+address+areaName 키워드 규칙. 중복 가능(캠퍼스+번화가 등) → 우선순위 상위 1~2개.
  function detectAudience(it) {
    var t = (it.name || "") + " " + (it.address || "") + " " + (it.jibunAddress || "") + " " + (it.areaName || "") + " " + (it.locationDescription || "");
    var out = [];
    if (has(t, /홍대|성수|강남역|건대|신촌|이태원|명동|가로수|성신여대|압구정|연남/)) out.push({ k: "fandom", label: "2030 번화가·팬덤" });
    if (has(t, /테헤란|여의도|광화문|을지로|역삼|선릉|삼성역|삼성동|종로|시청|마곡|상암|판교|구로디지털|가산/)) out.push({ k: "office", label: "직장인 밀집" });
    if (has(t, /대학교|대학가|캠퍼스|대입구역|한양대|홍익대|서울대입구|건대입구|경희대|고려대|연세대|이화여대|중앙대|성균관|한국외대/)) out.push({ k: "univ", label: "대학가·MZ" });
    if (has(t, /정부청사|청사|구청|시청|관공서|법원|세무서|보건소/)) out.push({ k: "public", label: "관공서 방문 동선" });
    if (has(t, /터미널|공항|KTX|SRT|고속버스|환승센터/)) out.push({ k: "hub", label: "대규모 유동 허브" });
    if (has(t, /백화점|코엑스|스타필드|아울렛|쇼핑몰|더현대|롯데월드몰|타임스퀘어|스퀘어원|현대백화점|롯데백화점|신세계백화점/)) out.push({ k: "shopping", label: "쇼핑 동선" });
    if (has(t, /고속도로|나들목|IC|톨게이트/)) out.push({ k: "highway", label: "장거리 운전자" });
    return out;
  }
  // 접점 → 노출 지속성·차량노출 점수
  function dwellScore(ctx) {
    return ({ plaza: 5, store: 4, station: 4, crosswalk: 4.3, cross: 3.8, indoor: 3.5, walk: 2.8, road: 2.3 })[ctx.key] || 3;
  }
  function vehicleScore(it, ctx) {
    var t = it.locationDescription || "";
    var s = ({ road: 4, cross: 4.5, highway: 4.5 })[ctx.key] || 1.5;
    if (has(t, /신호\s*대기|정차/)) s += 0.5;
    if (has(t, /정체|교통량\s*최다|교통량\s*많/)) s += 0.3;
    if (it.category === "highway") s = Math.max(s, 4.3);
    return clamp(s, 0, 5);
  }

  // 설치 높이·눈높이 (category 기본 + 키워드)
  function heightScore(it) {
    var t = it.locationDescription || "";
    var base = ({ convenience: 5, shopping_mall_did: 4.3, subway: 4, bus: 4, other: 3.8, transport_hub: 3.5, large_billboard: 2.8, highway: 2.5, package: 3 })[it.category] || 3;
    if (has(t, /저층|눈높이|지면|보행자\s*시선/)) base = Math.max(base, 4.5);
    if (has(t, /옥상|상단|고층|빌딩\s*상/)) base = Math.min(base, 2.3);
    return base;
  }
  // 정면도
  function frontScore(it) {
    var t = it.locationDescription || "";
    if (has(t, /정면\s*노출|정면으로|정면\s*배치|정면\s*향/)) return 4.6;
    if (has(t, /정면/)) return 4;
    return 3; // 기본 중립 (실사 보정)
  }
  // 자발광/휘도 — 디지털·LED·사이니지는 자발광
  function lumaScore(it) {
    var t = (it.mediaType || "") + (it.locationDescription || "");
    if (has(t, /LED|전광판|사이니지|디지털|DID|영상/)) return 4.3;
    if (has(t, /조명|라이트박스/)) return 3.5;
    return 2.5;
  }
  // 동적성(영상/전환)
  function dynamicScore(it) {
    var t = (it.mediaType || "") + (it.locationDescription || "") + (it.sizeText || "");
    if (has(t, /영상|전환|분할\s*표출|LED|전광판|사이니지|디지털|DID/)) return 4.5;
    return 1.5;
  }
  // 가림/시야확보·환경복잡도 — 자동 추정 어려움(실사). 키워드 단서만 반영, 기본 중립.
  function occlusionScore(it) { // 높을수록 시야 확보 좋음(가림 적음)
    var t = it.locationDescription || "";
    if (has(t, /개방|탁\s*트|전면\s*노출|전면\s*차폐\s*없|시야\s*확보/)) return 4.5;
    if (has(t, /가림|가려|밀집\s*간판|복잡/)) return 2.3;
    return 3.2; // 실사 보정 대상
  }
  function clutterScore(it) { // 높을수록 시각 간섭 적음
    var t = it.locationDescription || "";
    if (has(t, /단독|독립|돋보|유일/)) return 4.3;
    if (has(t, /밀집|복잡|경쟁\s*매체|간판\s*많/)) return 2.2;
    return 3.2; // 실사 보정 대상
  }

  // 싱크 상품(여러 로케이션/기둥 동시송출) 판별 — 초대형급 임팩트 확장 요인.
  //  예: 강남·명동·홍대 싱크, 연속 기둥 시퀀스 동시송출. name·패키지 필드까지 참조.
  function isSyncProduct(it) {
    var t = (it.name || "") + " " + (it.locationDescription || "") + " " + (it.exposureShort || "") + " " + (it.mediaType || "") + " " + (it.sizeText || "");
    return has(t, /싱크|sync|동시\s*송출|동시송출|연속\s*기둥|시퀀스|멀티\s*로케이션|복수\s*지점\s*동시/) || it.category === "package";
  }
  // 송출 방식
  function deliveryScore(it) {
    var t = (it.name || "") + (it.locationDescription || "") + (it.sizeText || "") + (it.mediaType || "");
    var s = 3;
    if (isSyncProduct(it)) s += 1.5; // 싱크/동시송출 = 임팩트 확장
    if (has(t, /연속|시퀀스|멀티|다면/)) s += 0.8;
    if (has(t, /분할\s*표출|분할/)) s += 0.6;
    if (has(t, /독점|단독\s*송출/)) s += 0.5;
    return clamp(s, 1, 5);
  }

  // 매체 연식/노후도 — 설치 시점(신규일수록 화질·휘도·세대↑). 데이터 없으면 중립(운영사/실사 확보 필요).
  function ageScore(it) {
    var y = it.installedYear || it.설치연도 || (it.installDate ? parseInt(String(it.installDate).slice(0, 4), 10) : null);
    if (!y) return 3; // 미상 — 실사 보정 대상
    var age = (new Date().getFullYear()) - y;
    if (age <= 1) return 5; if (age <= 3) return 4.3; if (age <= 5) return 3.6; if (age <= 8) return 2.8; return 2;
  }
  // 노출 범위(가시영역 크기) — 크기가 아니라 "방향 × 차폐 × 가시거리"의 함수.
  //  ⑥ 거리뷰 방위 cone 미연동 시 category + 정면성 + 차폐로 추정. (건너편 건물 정면이면 범위 좁음)
  function rangeScore(it, ctx, frontS, occS) {
    var base = ({ highway: 4.2, large_billboard: 3.5, transport_hub: 3, subway: 2.5, shopping_mall_did: 2.5, bus: 2.3, convenience: 1.8, other: 2.8 })[it.category] || 2.8;
    base = base * 0.5 + (frontS / 5 * 2.3) + (occS / 5 * 2.2);
    var t = it.locationDescription || "";
    if (has(t, /건너편|맞은편|반대편|건물\s*방향|건물\s*향/)) base -= 1.3; // 건너편 건물 향 → 범위 좁음
    if (has(t, /사방|파노라마|개활|사거리|교차로/)) base += 0.7;           // 다방향 → 범위 넓음
    return clamp(base, 1, 5);
  }

  // === 메인: 등급 산정 ===
  function gradeMedia(it) {
    it = it || {};
    var cat = it.category;
    var area = parseSizeArea(it), px = parseResoPx(it);
    var form = detectForm(it), ctx = detectContext(it);

    var front = frontScore(it), occ = occlusionScore(it);
    var A = { // 물리 속성 (매체 고정)
      size: sizeScore(area, cat), reso: resoScore(px, cat), form: formScore(form, cat),
      height: heightScore(it), luma: lumaScore(it), age: ageScore(it), front: front,
    };
    var B = { // 노출 성격 (맥락·동선)
      range: rangeScore(it, ctx, front, occ), vehicle: vehicleScore(it, ctx), dwell: dwellScore(ctx),
      occlusion: occ, clutter: clutterScore(it), dynamic: dynamicScore(it),
    };
    var C = { delivery: deliveryScore(it) }; // 송출

    var avg = function (o) { var k = Object.keys(o), s = 0; k.forEach(function (x) { s += o[x]; }); return s / k.length; };
    var aA = avg(A), aB = avg(B), aC = avg(C);
    var score = Math.round((aA / 5 * 40) + (aB / 5 * 40) + (aC / 5 * 20));
    var gradeAbs = score >= 85 ? "SSA" : score >= 70 ? "SA" : score >= 55 ? "A" : score >= 40 ? "B" : "C";

    // === 키워드 배지 — 광고주 관점 3계열 + 정직한 한계(cautions) ===
    //  셀링 배지는 "소비자가 좋아할 언어 + 매체 차별성"으로, 네거티브는 cautions로 분리.
    // 변별력 배지 — 매체 텍스트(이름·위치설명·특징·노출요약·주소) + 산출 지표에서 소비자 직관 descriptor를 최대한 추출.
    //  (일부 배지는 등급 산정 지표와 동일: 크기·형태·설치높이·정면도·접점·차량환경 등)
    // ⚠️ exposureLong 은 매체별 보일러플레이트(템플릿 마케팅 문구)라 전 매체 공통 → 변별력 오염 → 제외.
    //  매체 고유 정보가 담긴 필드만 사용: 이름·주소·위치설명·특징·노출요약·태그·규격.
    var TXT = [it.name, it.locationDescription, it.locationFeature, it.exposureShort, it.areaName, it.address, it.sizeText, it.mediaType, (Array.isArray(it.tags) ? it.tags.join(" ") : "")].filter(Boolean).join(" ");
    var digitalExpected = /large_billboard|subway|transport_hub|shopping_mall_did|highway|convenience/.test(cat || "");
    var isBoard = /large_billboard|highway/.test(cat || "");
    var catPed = /subway|transport_hub|bus/.test(cat || "");
    var stationCtx = /station|store|indoor/.test(ctx.key);
    var kwEye = has(TXT, /눈높이|저층|지면|보행자\s*시선|승강장|대합실|환승\s*통로|환승통로|벽면|기둥/);
    var pedScale = catPed || (stationCtx && !isBoard);
    var eyeLevel = kwEye || (pedScale && (A.height >= 3.8 || stationCtx));

    // --- [1] 매체 스펙·형태 ---
    var phys = [];
    if (area != null && area >= 300) phys.push("초대형");
    else if (area != null && area >= 150) phys.push("대형");
    else if (area != null && area >= 45) phys.push("중형");
    else if (area != null && area >= 10) phys.push("소형");
    else if (area == null && has(TXT, /초대형/)) phys.push("초대형");
    else if (area == null && (has(TXT, /대형/) || A.size >= 4.3)) phys.push("대형");
    if (has(TXT, /옥상|옥탑|빌딩\s*상단|상단\s*설치|고층\s*설치/) || (isBoard && A.height <= 2.4)) phys.push("옥상형");
    if (has(TXT, /커브|곡면|라운드/)) phys.push("커브형");
    if ((form.indexOf("세로형") >= 0 || has(TXT, /세로형/)) && cat !== "convenience") phys.push("세로형");
    if (has(TXT, /벽면/)) phys.push("벽면형");
    if (has(TXT, /기둥|사각기둥|원기둥/)) phys.push("기둥형");
    if (has(TXT, /캐노피/)) phys.push("캐노피형");
    if (has(TXT, /양면|양\s*면|2면/)) phys.push("양면 노출");
    if (has(TXT, /분할\s*표출|2분할|분할/)) phys.push("분할 표출");
    if (has(TXT, /멀티|다면|여러\s*면|연달아|연속\s*기둥/)) phys.push("멀티면");
    if (A.reso >= 4.5) phys.push("초고화질");
    if (A.age >= 4.3) phys.push("신형 패널");
    if (isSyncProduct(it)) phys.push("싱크 동시송출");
    if (!digitalExpected && A.luma >= 4.2) phys.push("자발광");
    if (!digitalExpected && B.dynamic >= 4.2) phys.push("영상 집행");

    // --- [2] 노출 성격·위치 (매체 위치에 따른 특성) ---
    var ctxB = [];
    if (has(TXT, /사거리|교차로|오거리/)) ctxB.push("교차로 노출");
    if (has(TXT, /횡단보도/)) ctxB.push("횡단보도 체류");
    if (has(TXT, /신호\s*대기|정차/)) ctxB.push("신호대기 정면");
    if (has(TXT, /보행로\s*방향|보행로\s*정면|보행자\s*정면|인도\s*정면|도보\s*정면/)) ctxB.push("보행로 정면");
    if (has(TXT, /도로\s*정면|차도\s*정면/)) ctxB.push("도로 정면");
    if (has(TXT, /출구\s*앞|출구\s*정면|역\s*출구|나오자마자|출입구\s*앞/)) ctxB.push("역 출구 앞");
    if (has(TXT, /정류장\s*정면|정류장\s*앞|쉘터\s*정면/)) ctxB.push("정류장 정면");
    if (has(TXT, /횡단보도\s*정면|횡단보도\s*앞/)) ctxB.push("횡단보도 정면");
    if (has(TXT, /운전자|자동차|대교|고가|주행|차량\s*노출|차량\s*방향|차량\s*정체/) || (B.vehicle >= 4.3 && ctx.key === "road")) ctxB.push("운전자 노출");
    if (has(TXT, /정면\s*시야|정면\s*노출|정면으로|정면\s*배치|정면\s*향/)) ctxB.push("정면 시야");
    if (has(TXT, /건너편|맞은편|반대편|건물\s*방향|건물\s*향/)) ctxB.push("건너편 방향");
    if (eyeLevel) ctxB.push("눈높이 노출");
    if (has(TXT, /환승|출퇴근|대합실|승강장|개찰|스크린도어|연결통로|지하\s*연결/)) ctxB.push("환승·출퇴근 동선");
    if (has(TXT, /정류장|버스정류장|쉘터/)) ctxB.push("정류장 인접");
    if (has(TXT, /정체|교통량\s*많|교통량\s*최다|상습\s*정체|교통\s*밀집/)) ctxB.push("정체구간 노출");
    if (has(TXT, /광장|관광특구|랜드마크|명소|상징/) || ctx.key === "plaza") ctxB.push("광장·랜드마크");
    if (has(TXT, /페스티벌|축제|행사|이벤트|공연/)) ctxB.push("행사·이벤트");
    if (has(TXT, /대로\b|메인\s*상권|중심\s*상권|상권\s*중심|번화가\s*중심|핵심\s*상권/)) ctxB.push("중심상권 대로변");
    if (has(TXT, /역세권|역\s*인근|역\s*앞|도보\s*\d|초역세권/)) ctxB.push("역세권");
    if ((ctx.key === "cross" || has(TXT, /사방|파노라마|개활|다방향/)) && ctxB.indexOf("교차로 노출") < 0) ctxB.push("다방향 노출");
    if (B.dwell >= 4.2 && ctxB.indexOf("횡단보도 체류") < 0 && ctxB.indexOf("신호대기 정면") < 0 && ctxB.indexOf("환승·출퇴근 동선") < 0) ctxB.push("체류 노출");
    if (B.clutter >= 4.3) ctxB.push("단독 주목");

    // --- [3] 타깃·상권 (오디언스) ---
    var aud = [];
    // 구체 상권명 — "번화가" 같은 뭉뚱그림 대신 매체가 선 실제 거리/상권(최우선 배지).
    var DISTRICTS = [[/가로수길/, "가로수길"], [/압구정|로데오/, "압구정·로데오"], [/청담/, "청담"], [/신사|도산대로/, "신사·도산"], [/강남대로|강남역|신논현/, "강남대로"], [/테헤란|역삼|선릉/, "테헤란로"], [/삼성동|코엑스|파르나스/, "삼성·코엑스"], [/잠실/, "잠실"], [/홍대|홍익|양화로/, "홍대"], [/연남/, "연남"], [/합정/, "합정"], [/성수/, "성수"], [/건대|능동/, "건대"], [/신촌/, "신촌"], [/이태원/, "이태원"], [/명동/, "명동"], [/을지로/, "을지로"], [/종로|청계/, "종로·청계"], [/광화문|세종대로/, "광화문"], [/여의도/, "여의도"]];
    for (var di = 0; di < DISTRICTS.length; di++) { if (has(TXT, DISTRICTS[di][0])) { aud.push(DISTRICTS[di][1]); break; } }
    if (has(TXT, /명품|수입차|벤틀리|롤스로이스|마세라티|페라리|람보르기니|고소득|상위\s*클래스|프리미엄|하이엔드|부촌|청담|압구정/)) aud.push("명품·고소득");
    if (has(TXT, /MZ|2030|젊은층|핫플|대학상권|대학가|대학생|홍대|성수|가로수|연남|이태원|신촌/)) aud.push("2030 세대");
    if (has(TXT, /오피스|업무지구|직장|비즈니스|테헤란|여의도|광화문|을지로|직장인|금융\s*중심|상업지구/)) aud.push("직장인·오피스");
    if (has(TXT, /관광|외국인|관광특구|인바운드|명소/)) aud.push("관광·외국인");
    if (has(TXT, /공항|KTX|SRT|터미널|전국|환승\s*허브|고속버스/)) aud.push("전국구 유동");
    if (has(TXT, /패션|뷰티|편집숍|백화점|쇼핑몰|아울렛/)) aud.push("패션·쇼핑");
    if (has(TXT, /의료|병원|클리닉|피부과|성형|에스테틱/)) aud.push("의료 상권");
    if (has(TXT, /정부청사|청사|구청|시청|관공서|법원|세무서/)) aud.push("관공서 동선");
    // detectAudience(지역 키워드)는 위 TXT 추출과 중복되므로, 아직 하나도 못 뽑았을 때만 보강
    if (!aud.length) detectAudience(it).forEach(function (a) { aud.push(a.label); });

    // 중복 제거 + 그룹별 상한(클러터 방지). 노출 성격은 변별 정보가 풍부하므로 5개까지.
    var uniq = function (arr, n) { var o = []; arr.forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); }); return n ? o.slice(0, n) : o; };
    phys = uniq(phys, 4); ctxB = uniq(ctxB, 5); aud = uniq(aud, 3);

    // 정직한 한계(셀링 배지와 분리) — 실사·⑥cone 보정 대상
    var cautions = [];
    if (B.range <= 2.4) cautions.push("노출범위 좁음(방향 확인)");
    if (B.occlusion <= 2.6) cautions.push("시야 일부 가림");
    if (B.dwell <= 2.6 && ctx.key !== "road") cautions.push("통과 동선(짧은 노출)");
    if (A.age < 2.5 && it.installedYear) cautions.push("노후 패널");

    // 비어있으면 접점 유형을 광고주 어휘로 최소 1개 보장
    if (!ctxB.length) {
      var fb = { road: "도로변 노출", walk: "보행 동선", indoor: "실내 보행 동선", cross: "교차로 노출", station: "역사 내 노출", crosswalk: "횡단보도 대기" }[ctx.key];
      if (fb) ctxB.push(fb);
    }

    return {
      grade: gradeAbs, score: score, context: ctx, form: form,
      badges: phys.concat(ctxB), physBadges: phys, ctxBadges: ctxB,
      audienceBadges: aud, cautions: cautions,
      parts: { A: A, B: B, C: C, aA: +aA.toFixed(2), aB: +aB.toFixed(2), aC: +aC.toFixed(2) },
      auto: { area: area, px: px },
    };
  }

  // 유형 내 상대 등급(percentile) — 절대점수 쏠림(등급 flattening) 방지 + "유형 내 상대 우위" 의미 부여.
  //  (버스·지하철 SSA/SA/A 가 상대 등급인 것과 동일 사상.) within:false 면 전체 대비.
  function assignRelativeGrades(items, opt) {
    opt = opt || {};
    var within = opt.within !== false; // 기본: category 내
    var scored = items.map(function (it) { return { item: it, g: gradeMedia(it) }; });
    var groups = {};
    scored.forEach(function (s) { var k = within ? (s.item.category || "_") : "_"; (groups[k] = groups[k] || []).push(s); });
    Object.keys(groups).forEach(function (k) {
      var arr = groups[k].slice().sort(function (a, b) { return b.g.score - a.g.score; });
      var n = arr.length;
      arr.forEach(function (s, i) {
        var pct = n > 1 ? i / (n - 1) : 0; // 0 = 최상위
        s.g.relGrade = pct <= 0.07 ? "SSA" : pct <= 0.25 ? "SA" : pct <= 0.60 ? "A" : pct <= 0.90 ? "B" : "C";
        s.g.relTop = Math.max(1, Math.round((i + 1) / n * 100)); // 상위 X%
      });
    });
    return scored;
  }

  return { gradeMedia: gradeMedia, assignRelativeGrades: assignRelativeGrades };
});
