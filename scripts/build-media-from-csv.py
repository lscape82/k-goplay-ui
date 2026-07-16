# -*- coding: utf-8 -*-
"""
build-media-from-csv.py
CSV(광고플레이 실매체 리스트) -> data/media.json + data/media_locations.json 생성.
- 규격/해상도/계약정보는 원문(raw) 보존, 파싱값은 보조.
- 좌표/도로명주소/거리뷰좌표(pan,tilt,fov) 반영.
- 사진/영상은 UI 느낌용 샘플 에셋 순환 배정.
"""
import csv, json, re, sys, io

SRC = r"data/source-media-list.csv"
OUT_MEDIA = r"data/media.json"
OUT_LOC = r"data/media_locations.json"

SAMPLE_IMAGES = [
    "assets/images/map-samples/gangnam-wide.jpg",
    "assets/images/map-samples/gangnam-close.jpg",
    "assets/images/map-samples/cheonggye-wide.jpg",
    "assets/images/map-samples/cheonggye-close.jpg",
    "assets/images/map-samples/gwanghwamun-wide.jpg",
    "assets/images/map-samples/gwanghwamun-close.jpg",
]
SAMPLE_VIDEOS = [
    "video/303.mp4",
    "video/231.mp4",
    "assets/videos/large-billboard-260513.mp4",
]
CATEGORY_LABELS = {
    "large_billboard": "대형 전광판",
    "shopping_mall_did": "쇼핑몰 DID",
    "subway": "지하철 광고",
    "bus": "버스 광고",
    "transport_hub": "도시 철도·버스·터미널",
    "daily_touchpoint": "생활밀착형 광고",
    "package": "패키지",
    "other": "기타",
}


def g(r, i):
    return r[i].strip() if i < len(r) and r[i] is not None else ""


def clean_name(s):
    return re.sub(r"^[\s.·・·,]+", "", s).strip()


def norm_space(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def infer_category(name):
    n = name
    if re.search(r"패키지|묶음|번들", n):
        return "package"
    if re.search(r"전동차|지하철|스크린도어|PSD|승강장|스크린 ?도어|[1-9]호선", n):
        return "subway"
    if re.search(r"공항|KIRO|터미널|기차역|KTX|SRT|고속터미널", n):
        return "transport_hub"
    if re.search(r"버스|쉘터|BIT|가로변|정류", n):
        return "bus"
    if re.search(r"쇼핑|몰\b|백화점|DID|마트|엘리베이터|아파트|편의점|스크린골프|생활", n):
        return "shopping_mall_did"
    return "large_billboard"


def parse_wh(s):
    m = re.search(r"([\d.]+)\s*m?\s*[xX×]\s*([\d.]+)\s*m", s)
    if not m:
        return None, None
    try:
        return float(m.group(1)), float(m.group(2))
    except ValueError:
        return None, None


def clean_resolution(s):
    s = (s or "").strip()
    if s in ("", "-", ".", "별도제공"):
        return None
    return s


def split_contract_lines(raw):
    """계약정보 원문을 읽기 좋은 줄로 분리."""
    t = (raw or "").strip()
    if not t:
        return []
    # '*' 앞, '1일'/'1구좌'/'0.5구좌'/'전면'/'매체비'/'뉴스존'/'풀화면' 등 새 항목 앞에 개행
    t = re.sub(r"(?<!^)(?=\*)", "\n", t)
    t = re.sub(r"(?<=원/월)(?=\s*(?:\d|전면|1구좌|0\.5구좌|풀화면|뉴스존))", "\n", t)
    t = re.sub(r"(?<=만원)(?=\s*1일)", "\n", t)
    lines = [norm_space(x) for x in t.split("\n")]
    return [x for x in lines if x]


def parse_pricing(raw):
    """계약정보에서 (초/회/월가격) 파싱 + 원문 라인 보존."""
    lines = split_contract_lines(raw)
    pricing = []
    for line in lines:
        if line.startswith("*"):
            continue
        m = re.search(r"(\d+)\s*초\s*(\d+)\s*[회화].*?([\d,]+)\s*만원", line)
        won = None
        pm = re.search(r"([\d,]+)\s*만원", line)
        eok = re.search(r"([\d.]+)\s*억", line)
        if pm:
            won = int(pm.group(1).replace(",", "")) * 10000
        elif eok:
            won = int(float(eok.group(1)) * 100000000)
        if m:
            pricing.append({
                "label": f"{m.group(1)}초 {m.group(2)}회",
                "durationSec": int(m.group(1)),
                "dailyPlays": int(m.group(2)),
                "monthlyPriceKRW": (int(m.group(3).replace(",", "")) * 10000) if m.group(3) else won,
                "rawText": line,
            })
        elif won is not None:
            pricing.append({
                "label": line[:24],
                "durationSec": None,
                "dailyPlays": None,
                "monthlyPriceKRW": won,
                "rawText": line,
            })
    return pricing


def parse_streetview(raw):
    s = (raw or "").strip()
    if not s:
        return None
    parts = [p.strip() for p in s.split(",")]
    if len(parts) < 2:
        return None
    try:
        lat = float(parts[0]); lng = float(parts[1])
    except ValueError:
        return None
    if not (30 < lat < 40 and 120 < lng < 135):
        return None
    def fnum(i, d):
        try:
            return float(parts[i])
        except (ValueError, IndexError):
            return d
    return {"lat": lat, "lng": lng, "pan": fnum(2, 0.0), "tilt": fnum(3, 0.0), "fov": fnum(4, 90.0)}


def parse_latlng(a, b):
    try:
        lat = float(a); lng = float(b)
    except ValueError:
        return None, None
    if not (30 < lat < 40 and 120 < lng < 135):
        return None, None
    return lat, lng


def short_exposure(text):
    t = norm_space(text)
    if not t:
        return ""
    # 첫 문장 또는 앞 60자
    m = re.split(r"[.!?]|\s{2,}", t)
    first = m[0].strip() if m and m[0].strip() else t
    return (first[:60]).strip()


# 유형별 노출 특성 (카드용 짧은 표현, 상세용 서술 어구)
CATEGORY_EXPOSURE = {
    "large_billboard": ("정면 시야 노출", "횡단보도 대기·차량 정체 구간에서 정면 시야가 오래 머뭅니다"),
    "subway": ("환승·출퇴근 동선 노출", "출퇴근·환승 동선에서 승객에게 반복적으로 노출됩니다"),
    "bus": ("정류장 대기 동선 노출", "정류장 대기 승객과 인근 보행자에게 반복 노출됩니다"),
    "transport_hub": ("이동객 대기 동선 노출", "역·터미널·공항 이동 전후 대기 동선에서 반복 노출됩니다"),
    "shopping_mall_did": ("체류 방문객 노출", "쇼핑·문화시설 체류 방문객의 이동 동선에서 반복 노출됩니다"),
    "package": ("다거점 반복 노출", "여러 거점을 묶어 넓은 범위에 반복 노출됩니다"),
    "daily_touchpoint": ("생활권 접점 노출", "아파트·오피스 등 생활 동선 접점에서 반복 노출됩니다"),
    "other": ("주요 동선 노출", "주요 보행·차량 동선에서 반복 노출됩니다"),
}


# 유형별 활용 가치(상세 노출포인트 마무리 문장)
CATEGORY_VALUE = {
    "large_billboard": "브랜드 런칭·시즌 캠페인의 인지 확산에 강점이 있습니다",
    "subway": "출퇴근 타깃의 반복 고지에 적합합니다",
    "bus": "지역 타깃·생활권 캠페인에 적합합니다",
    "transport_hub": "광역 단위 단기 고빈도 고지에 적합합니다",
    "shopping_mall_did": "구매 고려와 브랜드 선호 형성에 적합합니다",
    "package": "예산 효율적으로 도달 범위를 넓히는 데 적합합니다",
    "daily_touchpoint": "생활권 반복 접점으로 프로모션에 적합합니다",
    "other": "브랜드 인지와 반복 노출에 적합합니다",
}


def detailed_exposure(category, keywords, region, benefit):
    """상세 '매체 노출 포인트' 본문 — 장점+노출특성+활용가치 2~3문장(자세히)."""
    _, long_v = CATEGORY_EXPOSURE.get(category, CATEGORY_EXPOSURE["other"])
    value = CATEGORY_VALUE.get(category, CATEGORY_VALUE["other"])
    kws = [k for k in (keywords or []) if k][:2]
    ctx = norm_space(f"{region} {' '.join(kws)}") if (region or kws) else ""
    s1 = f"{benefit}. " if benefit else ""
    s2 = f"{ctx} 일대에 위치해, {long_v}. " if ctx else f"{long_v}. "
    return norm_space(f"{s1}{s2}{value}.")


def region_of(road, jibun):
    text = (road or "") + " " + (jibun or "")
    m = re.search(r"([가-힣]{1,4}구)(?![가-힣])", text)
    if m:
        return m.group(1)
    m = re.search(r"([가-힣]{1,6}시)(?![가-힣])", text)
    if m:
        return m.group(1)
    return ""


# 입지특성에서 '설치 위치 장점'을 짧게 뽑기
_ADV_MARKERS = ("최다", "최대", "1위", "핵심", "랜드마크", "명소", "특구", "최고",
                "대표", "요충", "밀집", "집중", "유일", "제일")
_LOC_MARKERS = ("유동인구", "교통량", "상권", "관광", "역세권", "번화가", "중심",
                "사거리", "광장", "환승", "허브")
_DANGLE = {"총", "및", "등", "많은", "큰", "주요", "각", "약", "위치", "가능한",
           "연결되어", "중심으로", "통한", "인한", "특히", "또한", "그리고", "있는", "이자", "로서"}


def benefit_summary(feature):
    """입지특성 원문 → 설치 위치 '장점' 강조 짧은 요약(1줄)."""
    t = norm_space(feature)
    if not t:
        return ""
    t = re.sub(r"\([^)]*\)", "", t)  # (롯데월드타워) 같은 괄호 군더더기 제거
    parts = [p.strip(" ·-!~") for p in re.split(r"[.!?,]", t) if p.strip(" ·-!~")]
    if not parts:
        parts = [t]

    def score(p):
        s = sum(2 for mk in _ADV_MARKERS if mk in p)
        s += sum(1 for mk in _LOC_MARKERS if mk in p)
        s -= 0.02 * len(p)  # 짧은 절 약간 우대
        return s

    best = norm_space(max(parts, key=score))
    if len(best) > 20:  # 20자 내 단어 경계로 자름
        best = best[:20].rsplit(" ", 1)[0] or best[:20]
    words = best.split()
    _lead = {"특히", "또한", "그리고", "및", "즉", "단", "특히나", "또", "이는"}
    while len(words) > 2 and words[0] in _lead:  # 앞 연결어 제거
        words.pop(0)
    while len(words) > 2 and (  # 끝 연결어·조사 제거
        words[-1] in _DANGLE or re.search(r"(으로|로서|에서|까지|이자|으로서)$", words[-1])
    ):
        words.pop()
    return " ".join(words).strip(" ·-")


def generate_exposure(category, keywords, region):
    """매체별 키워드·구·유형으로 노출포인트 자동 생성(임시)."""
    short_v, long_v = CATEGORY_EXPOSURE.get(category, CATEGORY_EXPOSURE["other"])
    kws = [k for k in (keywords or []) if k][:2]
    loc = " · ".join(kws) if kws else region
    short = f"{loc} · {short_v}" if loc else short_v
    loc_phrase = " ".join(kws) if kws else region
    if loc_phrase:
        prefix = f"{region} " if region and region not in loc_phrase else ""
        long = f"{prefix}{loc_phrase} 일대에 위치해, {long_v}."
    else:
        long = f"{long_v}."
    return short[:70], long


def main():
    rows = list(csv.reader(io.open(SRC, encoding="utf-8-sig")))
    data = [r for r in rows[1:] if any(c.strip() for c in r)]
    media = []
    locations = {}
    cat_counts = {}
    for i, r in enumerate(data):
        idx = g(r, 0)
        name = clean_name(g(r, 1))
        company = g(r, 2)
        lat, lng = parse_latlng(g(r, 3), g(r, 4))
        jibun = norm_space(g(r, 5))
        road = norm_space(g(r, 6))
        size_raw = norm_space(g(r, 7))
        feature = norm_space(g(r, 8))
        if feature in (".", "-", "·") or re.fullmatch(r"[\d\s]+", feature or ""):  # 부실값·숫자 junk 정리
            feature = ""
        hours = g(r, 9)
        keywords = [g(r, k) for k in (10, 11, 12, 13, 14)]
        keywords = [norm_space(k) for k in keywords if k.strip()]
        sv = parse_streetview(g(r, 15))
        resolution = clean_resolution(g(r, 16))
        contract_raw = g(r, 17).strip()

        slug = f"m-{idx}"
        category = infer_category(name)
        cat_counts[category] = cat_counts.get(category, 0) + 1
        w, h = parse_wh(size_raw)
        pricing = parse_pricing(contract_raw)
        region = region_of(road, jibun)
        # 카드(짧게): 입지특성 장점 요약 or 키워드 요약
        if feature:
            benefit = benefit_summary(feature)
            gen_short = benefit or generate_exposure(category, keywords, region)[0]
        else:
            benefit = ""
            gen_short = generate_exposure(category, keywords, region)[0]
        # 상세 매체 노출 포인트(자세히, 2~3문장)
        gen_long = detailed_exposure(category, keywords, region, benefit)

        video = SAMPLE_VIDEOS[i % len(SAMPLE_VIDEOS)] if category == "large_billboard" else None

        media.append({
            "slug": slug,
            "sourceId": idx,
            "name": name,
            "company": company,
            "category": category,
            "mediaType": CATEGORY_LABELS.get(category, "기타"),
            "areaSlug": "",
            "areaName": "",
            "address": road or jibun,
            "jibunAddress": jibun,
            "locationDescription": feature,
            "locationFeature": feature,   # 상세 "입지 특성" 섹션에 표출할 원문(153개 실데이터)
            "exposureShort": gen_short,   # 카드 노출포인트: 매체별 자동 생성(임시)
            "exposureLong": gen_long,     # 상세 "매체 노출 포인트": 매체별 자동 생성(임시)
            "tags": keywords,
            "widthM": w,
            "heightM": h,
            "sizeText": size_raw,
            "resolutionPx": resolution,
            "operationHours": hours,
            "pricing": pricing,
            "contractText": contract_raw,
            "contractLines": split_contract_lines(contract_raw),
            "taxNote": "VAT 별도",
            "shortTermAvailable": False,
            "imageUrl": SAMPLE_IMAGES[i % len(SAMPLE_IMAGES)],
            "videoUrl": video,
            "streetView": sv,
        })

        locations[slug] = {
            "latitude": lat,
            "longitude": lng,
            "sourceName": name,
            "sourceAddress": road or jibun,
            "jibunAddress": jibun,
            "company": company,
            "size": size_raw,
            "resolution": resolution or "",
            "operationHours": hours,
            "contract": contract_raw,
            "streetView": sv,
            "isComposite": False,
            "sourceLabel": "광고플레이에 등록된 매체리스트_정언.csv",
        }

    json.dump(media, io.open(OUT_MEDIA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(locations, io.open(OUT_LOC, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    with_coords = sum(1 for m in media if locations[m["slug"]]["latitude"] is not None)
    with_sv = sum(1 for m in media if m["streetView"])
    with_price = sum(1 for m in media if any(p.get("monthlyPriceKRW") for p in m["pricing"]))
    print(f"media: {len(media)}")
    print(f"  with coords: {with_coords}")
    print(f"  with streetView: {with_sv}")
    print(f"  with >=1 parsed price: {with_price}")
    print(f"  categories: {cat_counts}")


if __name__ == "__main__":
    main()
