# -*- coding: utf-8 -*-
"""엘리베이터 광고 상품별 대표 건물 주소를 지역 분산 샘플링 후 네이버 지오코딩 → data/elevator-sites.json.
전체 13만+ 건은 비현실적이므로 상품별 상한(CAP)만큼 시도별 라운드로빈으로 뽑아 실제 좌표를 얻는다.
CAP를 늘리면 커버리지를 확장할 수 있다."""
import json, os, re, time, urllib.parse, urllib.request, urllib.error
import openpyxl, xlrd

SRC = os.environ.get("ELEV_SRC", r"C:\Users\lscap\Desktop")
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "data", "elevator-sites.json")
CAP = int(os.environ.get("ELEV_CAP", "45"))

def load_env():
    creds = {}
    p = os.path.join(ROOT, ".env")
    if os.path.exists(p):
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                creds[k.strip()] = v.strip()
    return creds

ENV = load_env()
CID = ENV.get("NAVER_MAPS_CLIENT_ID")
CSECRET = ENV.get("NAVER_MAPS_CLIENT_SECRET")

def norm_sido(v):
    if not v:
        return "기타"
    s = str(v).strip()
    for t in ["특별자치도", "특별자치시", "특별시", "광역시"]:
        s = s.replace(t, "")
    if s.endswith("도"):
        s = s[:-1]
    alias = {"강원특별": "강원", "전북특별": "전북", "제주특별": "제주",
             "충청북": "충북", "충청남": "충남", "전라북": "전북", "전라남": "전남",
             "경상북": "경북", "경상남": "경남"}
    return alias.get(s, s)

def hidx(hdr, name):
    for i, h in enumerate(hdr):
        if h and name in str(h).replace("\n", " "):
            return i
    return None

def to_int(v):
    try:
        return int(float(v))
    except Exception:
        return 0

def rows_xlsx(path, sheet, header_at, name_c, region_c, addr_c, monitor_c):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    data = list(ws.iter_rows(min_row=header_at, values_only=True))
    hdr = data[0]
    ni, ri, ai, mi = hidx(hdr, name_c), hidx(hdr, region_c), hidx(hdr, addr_c), hidx(hdr, monitor_c)
    out = []
    for r in data[1:]:
        if ni is None or ni >= len(r) or not r[ni]:
            continue
        addr = r[ai] if ai is not None and ai < len(r) else None
        if not addr:
            continue
        out.append(dict(name=str(r[ni]).strip(), sido=norm_sido(r[ri] if ri is not None else None),
                        address=str(addr).strip(), monitors=to_int(r[mi]) if mi is not None else 0))
    wb.close()
    return out

def rows_asa(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["Sheet1"]
    bases = [1, 7, 13, 19]
    carry = {b: None for b in bases}
    out = []
    for r in ws.iter_rows(values_only=True):
        for b in bases:
            if b + 4 >= len(r):
                continue
            region, name, ext, intr = r[b + 1], r[b + 2], r[b + 3], r[b + 4]
            if region:
                carry[b] = region
            if name and isinstance(name, str) and name.strip() and name.strip() not in ("빌딩명", "No."):
                nm = name.strip()
                q = re.sub(r"\s*[A-Da-d]?\d+동$", "", nm).strip()  # '1동','B동' 꼬리 제거
                out.append(dict(name=nm, sido="서울",
                                address=q, monitors=to_int(ext) + to_int(intr),
                                district=str(carry[b] or "")))
    wb.close()
    return out

def rows_h(path):
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_name("오피스보드")
    hdr = [str(ws.cell_value(4, j)).replace("\n", " ") for j in range(ws.ncols)]
    def idx(name):
        for j, h in enumerate(hdr):
            if name in h:
                return j
        return None
    ni, ai, mi = idx("건물명"), idx("상세주소"), idx("모니터 합계")
    out = []
    for i in range(5, ws.nrows):
        name = ws.cell_value(i, ni) if ni is not None else None
        addr = ws.cell_value(i, ai) if ai is not None else None
        if not name or not addr:
            continue
        out.append(dict(name=str(name).strip(), sido="서울", address=str(addr).strip(),
                        monitors=to_int(ws.cell_value(i, mi)) if mi is not None else 0))
    return out

def sample_spread(rows, cap):
    """시도별 라운드로빈 + 시도 내 모니터 많은 순 우선 → 지역 분산 샘플."""
    by = {}
    for r in rows:
        by.setdefault(r["sido"], []).append(r)
    for k in by:
        by[k].sort(key=lambda x: -x["monitors"])
    picked, i = [], 0
    order = sorted(by.keys(), key=lambda k: -len(by[k]))
    while len(picked) < cap and any(i < len(by[k]) for k in order):
        for k in order:
            if i < len(by[k]):
                picked.append(by[k][i])
                if len(picked) >= cap:
                    break
        i += 1
    return picked

def geocode(query):
    url = "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"x-ncp-apigw-api-key-id": CID, "x-ncp-apigw-api-key": CSECRET})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        addrs = data.get("addresses") or []
        if not addrs:
            return None
        a = addrs[0]
        return dict(lat=float(a["y"]), lng=float(a["x"]),
                    roadAddress=a.get("roadAddress", ""), jibunAddress=a.get("jibunAddress", ""))
    except Exception as exc:
        print("  geocode err:", str(exc)[:80])
        return None

PRODUCTS = [
    dict(id="townboard", fn=lambda: rows_xlsx(os.path.join(SRC, "T사_아파트 엘리베이터.xlsx"),
         "타운보드S(전국 50,000대)", 6, "아파트명", "지역1", "주소", "가동수량")),
    dict(id="fmk", fn=lambda: rows_xlsx(os.path.join(SRC, "F사_아파트 엘리베이터.xlsx"),
         "FMK", 4, "도시", "도시", "주소(도로명)", "판매수량")),
    dict(id="gsa", fn=lambda: rows_xlsx(os.path.join(SRC, "G사_아파트 엘리베이터.xlsx"),
         "설치 리스트", 5, "아파트명", "지역1", "주 소", "합계")),
    dict(id="officebiz", fn=lambda: rows_h(os.path.join(SRC, "H_오피스 엘리베이터.xls"))),
    dict(id="asa", fn=lambda: rows_asa(os.path.join(SRC, "A사_오피스 엘리베이터.xlsx"))),
]

def main():
    if not CID or not CSECRET:
        raise SystemExit("NAVER_MAPS_CLIENT_ID/SECRET 미설정(.env 확인)")
    result = {}
    for p in PRODUCTS:
        rows = p["fn"]()
        sample = sample_spread(rows, CAP)
        print(f"[{p['id']}] 전체 주소 {len(rows):,} → 샘플 {len(sample)} 지오코딩...")
        sites = []
        for s in sample:
            g = geocode(s["address"])
            time.sleep(0.12)
            if not g:
                continue
            sites.append(dict(name=s["name"], sido=s["sido"], monitors=s["monitors"],
                              address=g["roadAddress"] or s["address"], lat=g["lat"], lng=g["lng"]))
        result[p["id"]] = sites
        print(f"    → 좌표 확보 {len(sites)}개")
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    total = sum(len(v) for v in result.values())
    print(f"WROTE {os.path.normpath(OUT)}  (총 {total} 사이트)")

if __name__ == "__main__":
    main()
