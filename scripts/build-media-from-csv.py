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
            "exposureShort": short_exposure(feature),
            "exposureLong": feature,
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
