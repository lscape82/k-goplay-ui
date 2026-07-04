#!/usr/bin/env node
/**
 * fetch-nearby-brands.mjs  (초안 — API 키 넣고 실행)
 * ---------------------------------------------------------------------------
 * 매체 좌표 주변 "상권 대표 브랜드"를 수집해 data/media.json 각 매체에
 * nearbyBrands 배열을 채운다. → map.js 의 하드코딩 nearbyDistrict() 를 실데이터로 대체.
 *
 * 핵심 로직:
 *   - API 호출은 매체당 1회(넓게 MAX_RADIUS 조회) → 각 점포까지 실제 거리 계산.
 *   - 적응형 선택: 100m 이내 우선 → 부족하면 200m → MAX 로 확장 (밀집 상권은 좁게=차별성,
 *     한산한 곳은 넓혀 결과 확보).
 *   - 랜드마크 보강: 가까운 앵커(백화점·유명 프랜차이즈)가 타이트 범위 밖이면
 *     "이름 (250m)" 형태로 1개 별도 포함.
 *
 * 주 소스: 소상공인시장진흥공단 상가(상권)정보 API (공공데이터포털, 무료·저장 가능)
 *   반경조회 storeListInRadius (cx=경도, cy=위도, radius=m)
 *   응답 항목: bizesNm(상호명), indsLclsNm(업종 대분류), lon, lat ...
 *   * 응답 JSON 경로(body.items)는 실제 스펙에 맞춰 한 번 확인/조정 필요.
 *
 * 실행:
 *   SBIZ_KEY="공공데이터포털_서비스키(디코딩키)" node scripts/fetch-nearby-brands.mjs
 *   (선택) RADIUS=500 LIMIT=8 MIN=6 SLEEP_MS=250
 * ---------------------------------------------------------------------------
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MEDIA_PATH = path.join(ROOT, "data", "media.json");
const LOC_PATH = path.join(ROOT, "data", "media_locations.json");

const SBIZ_KEY = process.env.SBIZ_KEY;                  // 공공데이터포털 서비스키(디코딩키)
const MAX_RADIUS = Number(process.env.RADIUS || 500);   // 조회 반경(m) — 넓게 한 번
const STEPS = [100, 200, MAX_RADIUS];                   // 적응형 선택 단계(가까운 것 우선)
const MIN = Number(process.env.MIN || 6);               // 타이트 범위에서 확보 목표 수
const LIMIT = Number(process.env.LIMIT || 8);           // 매체당 최대 브랜드 수
const LANDMARK_NEAR = 120;                              // 이 거리 넘는 앵커는 "(Xm)" 표기
const SLEEP_MS = Number(process.env.SLEEP_MS || 250);   // 호출 간 간격(쿼터 보호)

if (!SBIZ_KEY) {
  console.error("환경변수 SBIZ_KEY(공공데이터포털 서비스키)가 필요합니다.");
  process.exit(1);
}

// "대표/랜드마크"로 우선할 앵커·프랜차이즈 화이트리스트 (자유롭게 확장)
const ANCHOR = [
  "백화점", "현대백화점", "롯데백화점", "신세계", "스타필드", "코엑스", "IFC몰", "타임스퀘어", "롯데월드몰",
  "올리브영", "무신사", "자라", "ZARA", "유니클로", "H&M", "애플", "무인양품", "다이소",
  "스타벅스", "투썸플레이스", "메가박스", "CGV", "롯데시네마", "교보문고", "영풍문고",
  "이마트", "홈플러스", "롯데마트", "코스트코",
];
const anchorRank = (name) => {
  const i = ANCHOR.findIndex((a) => name.includes(a));
  return i === -1 ? 999 : i;
};
// 랜드마크 = 집객 목적지(백화점·몰·복합·문화). 프랜차이즈(스타벅스 등)와 구분해 반드시 1개 보강.
const LANDMARK = [
  "백화점", "현대백화점", "롯데백화점", "신세계", "스타필드", "코엑스", "IFC몰", "타임스퀘어", "롯데월드몰",
  "교보문고", "영풍문고", "메가박스", "CGV", "롯데시네마", "이마트", "홈플러스", "롯데마트", "코스트코",
];
const isLandmark = (name) => LANDMARK.some((a) => name.includes(a));
const normalize = (name) => name.replace(/\s*\S+점$|\s*\d+호점$/u, "").trim(); // 지점표기 제거
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000, toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function fetchStores(lng, lat, radius) {
  const url = new URL("http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius");
  url.searchParams.set("serviceKey", SBIZ_KEY);
  url.searchParams.set("cx", String(lng)); // 경도
  url.searchParams.set("cy", String(lat)); // 위도
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("type", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error("SBIZ API HTTP " + res.status);
  const json = await res.json();
  const items = json?.body?.items || json?.response?.body?.items || [];
  return items
    .map((it) => ({ name: it.bizesNm, category: it.indsLclsNm || "", lat: Number(it.lat), lng: Number(it.lon) }))
    .filter((s) => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

function pick(stores, mLat, mLng) {
  // 거리 부여 + 지점 통합(dedup, 최단거리·다지점수 유지)
  const byName = new Map();
  for (const s of stores) {
    const key = normalize(s.name);
    const dist = haversine(mLat, mLng, s.lat, s.lng);
    if (!byName.has(key)) byName.set(key, { name: key, category: s.category, dist, count: 1 });
    else {
      const e = byName.get(key);
      e.count++; if (dist < e.dist) e.dist = dist;
    }
  }
  const all = [...byName.values()];

  // 적응형: 가까운 단계부터 채우되 앵커 우선 + 업종 다양성
  const picked = [];
  const take = (maxDist) => {
    const pool = all
      .filter((s) => s.dist <= maxDist && !picked.includes(s))
      .sort((a, b) => anchorRank(a.name) - anchorRank(b.name) || a.dist - b.dist);
    for (const s of pool) {
      if (picked.length >= LIMIT) break;
      const sameCat = picked.filter((p) => p.category === (s.category || "기타")).length;
      if (sameCat >= 3) continue; // 같은 업종 3개 초과 방지
      picked.push(s);
    }
  };
  for (const step of STEPS) {
    take(step);
    if (picked.length >= MIN) break;
  }

  // 랜드마크 보강: 집객 목적지(백화점·몰 등)가 하나도 없으면, 가장 가까운 랜드마크 1개 추가
  if (!picked.some((s) => isLandmark(s.name))) {
    const nearestLm = all
      .filter((s) => isLandmark(s.name))
      .sort((a, b) => a.dist - b.dist)[0];
    if (nearestLm && !picked.includes(nearestLm)) {
      if (picked.length >= LIMIT) picked.pop();
      picked.push(nearestLm);
    }
  }

  // 문자열화: 타이트 범위 밖 랜드마크는 거리 표기 ("코엑스 (250m)")
  return picked
    .sort((a, b) => a.dist - b.dist)
    .map((s) => (isLandmark(s.name) && s.dist > LANDMARK_NEAR ? `${s.name} (${Math.round(s.dist)}m)` : s.name));
}

async function main() {
  const media = JSON.parse(await readFile(MEDIA_PATH, "utf8"));
  const locObj = JSON.parse(await readFile(LOC_PATH, "utf8"));

  // 좌표 조인: media_locations 값들의 sourceName === media.name
  const coordByName = new Map();
  for (const loc of Object.values(locObj)) {
    if (loc?.sourceName && loc.latitude && loc.longitude) {
      coordByName.set(loc.sourceName, { lat: loc.latitude, lng: loc.longitude });
    }
  }

  const items = Array.isArray(media) ? media : media.media || [];
  let processed = 0, filled = 0;
  for (const item of items) {
    const co = coordByName.get(item.name);
    if (!co) { console.warn("좌표 없음, 건너뜀:", item.name); continue; }
    try {
      const stores = await fetchStores(co.lng, co.lat, MAX_RADIUS);
      const brands = pick(stores, co.lat, co.lng);
      if (brands.length) { item.nearbyBrands = brands; filled++; }
      console.log(`v ${item.name} → ${brands.length}개: ${brands.join(", ")}`);
    } catch (e) {
      console.warn(`x 실패 ${item.name}: ${e.message}`);
    }
    processed++;
    await sleep(SLEEP_MS);
  }

  await writeFile(MEDIA_PATH, JSON.stringify(media, null, 2) + "\n", "utf8");
  console.log(`\n완료: ${processed}개 처리, ${filled}개에 nearbyBrands 저장 → ${MEDIA_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

/* ---------------------------------------------------------------------------
 * [선택] 카카오 로컬로 랜드마크/인지도 보강 (문화시설·백화점 등 카테고리)
 *   const r = await fetch(
 *     `https://dapi.kakao.com/v2/local/search/category.json` +
 *     `?category_group_code=CT1&x=${lng}&y=${lat}&radius=${MAX_RADIUS}&sort=distance`,
 *     { headers: { Authorization: `KakaoAK ${process.env.KAKAO_KEY}` } }
 *   ).then((res) => res.json());
 *   // ⚠ 카카오는 약관상 결과 "영구 저장" 제한 → 저장은 공공(상권정보) 기준 권장, 카카오는 랭킹 보조만.
 * ------------------------------------------------------------------------- */
