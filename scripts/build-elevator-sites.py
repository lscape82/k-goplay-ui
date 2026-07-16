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

def cell(r, i):
    return r[i] if i is not None and i < len(r) else None

def rows_xlsx(path, sheet, header_at, name_c, region_c, addr_c, monitor_c,
              household_c=None, year_c=None, unitprice_c=None):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[sheet]
    data = list(ws.iter_rows(min_row=header_at, values_only=True))
    hdr = data[0]
    ni, ri, ai, mi = hidx(hdr, name_c), hidx(hdr, region_c), hidx(hdr, addr_c), hidx(hdr, monitor_c)
    hi = hidx(hdr, household_c) if household_c else None
    yi = hidx(hdr, year_c) if year_c else None
    pi = hidx(hdr, unitprice_c) if unitprice_c else None
    out = []
    for r in data[1:]:
        if ni is None or ni >= len(r) or not r[ni]:
            continue
        addr = cell(r, ai)
        if not addr:
            continue
        monitors = to_int(cell(r, mi))
        unitprice = to_int(cell(r, pi))
        out.append(dict(name=str(r[ni]).strip(), sido=norm_sido(cell(r, ri)),
                        address=str(addr).strip(), monitors=monitors,
                        households=to_int(cell(r, hi)), year=to_int(cell(r, yi)),
                        price=unitprice * monitors if unitprice else 0))
    wb.close()
    return out

def rows_townboard(path):
    """타운보드 로컬상품 — 요청 필드 전량 추출(구분·아파트명·입주년도·주소·평형·세대수·모니터수·개별단가·월비용·모니터크기)."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for sheet in ["타운보드S(전국 50,000대)", "타운보드L(전국 10,000대)"]:
        if sheet not in wb.sheetnames:
            continue
        data = list(wb[sheet].iter_rows(min_row=6, values_only=True))
        hdr = data[0]
        c = {k: hidx(hdr, k) for k in ["구분", "아파트명", "입주년도", "지역1", "주소", "평형", "세대수", "가동수량", "개별 단가", "모니터크기"]}
        mc = hidx(hdr, "월비용")
        if mc is None:
            mc = hidx(hdr, "총 단가")
        for r in data[1:]:
            name, addr = cell(r, c["아파트명"]), cell(r, c["주소"])
            if not name or not addr:
                continue
            monitors = to_int(cell(r, c["가동수량"]))
            unit = to_int(cell(r, c["개별 단가"]))
            monthly = to_int(cell(r, mc)) or unit * monitors
            out.append(dict(
                gubun=str(cell(r, c["구분"]) or "아파트").strip(),
                name=str(name).strip(),
                year=to_int(cell(r, c["입주년도"])),
                sido=norm_sido(cell(r, c["지역1"])),
                address=str(addr).strip(),
                pyeong=str(cell(r, c["평형"]) or "").strip(),
                households=to_int(cell(r, c["세대수"])),
                monitors=monitors,
                unitPrice=unit,
                monthlyCost=monthly,
                monitorSize=str(cell(r, c["모니터크기"]) or "").strip(),
            ))
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
    tenant_i, price_i = idx("입주업체"), idx("1개월 금액")
    out = []
    for i in range(5, ws.nrows):
        name = ws.cell_value(i, ni) if ni is not None else None
        addr = ws.cell_value(i, ai) if ai is not None else None
        if not name or not addr:
            continue
        out.append(dict(name=str(name).strip(), sido="서울", address=str(addr).strip(),
                        monitors=to_int(ws.cell_value(i, mi)) if mi is not None else 0,
                        households=0, year=0,
                        price=to_int(ws.cell_value(i, price_i)) if price_i is not None else 0,
                        tenants=to_int(ws.cell_value(i, tenant_i)) if tenant_i is not None else 0))
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
    dict(id="townboard", cap=None,  # 전량 지오코딩
         fn=lambda: rows_townboard(os.path.join(SRC, "타운보드 가동리스트(로컬상품)_260706.xlsx"))),
    dict(id="fmk", fn=lambda: rows_xlsx(os.path.join(SRC, "F사_아파트 엘리베이터.xlsx"),
         "FMK", 4, "도시", "도시", "주소(도로명)", "판매수량",
         household_c="총 세대수", year_c="준공연도", unitprice_c="대당단가")),
    dict(id="gsa", fn=lambda: rows_xlsx(os.path.join(SRC, "G사_아파트 엘리베이터.xlsx"),
         "설치 리스트", 5, "아파트명", "지역1", "주 소", "합계",
         household_c="세대수", year_c="준공년도")),
    dict(id="officebiz", fn=lambda: rows_h(os.path.join(SRC, "H_오피스 엘리베이터.xls"))),
    dict(id="asa", fn=lambda: rows_asa(os.path.join(SRC, "A사_오피스 엘리베이터.xlsx"))),
]

ONLY = os.environ.get("ELEV_ONLY", "").strip()  # 특정 상품만 재생성(쉼표구분)

def main():
    if not CID or not CSECRET:
        raise SystemExit("NAVER_MAPS_CLIENT_ID/SECRET 미설정(.env 확인)")
    # 기존 데이터 유지 후, 파일이 있는 상품만 갱신(다른 상품 원본은 삭제됨)
    result = {}
    if os.path.exists(OUT):
        result = json.load(open(OUT, encoding="utf-8"))
    only = set(x for x in ONLY.split(",") if x)
    for p in PRODUCTS:
        if only and p["id"] not in only:
            continue
        try:
            rows = p["fn"]()
        except FileNotFoundError:
            print(f"[{p['id']}] 원본 파일 없음 → 기존 {len(result.get(p['id'], []))}개 유지")
            continue
        cap = p.get("cap", CAP)
        sample = rows if cap is None else sample_spread(rows, cap)
        print(f"[{p['id']}] 전체 {len(rows):,} → {'전량' if cap is None else '샘플'} {len(sample)} 지오코딩...")
        sites = []
        for idx, s in enumerate(sample):
            g = geocode(s["address"])
            time.sleep(0.08)
            if not g:
                continue
            site = dict(s)
            site["id"] = f"{p['id']}-{idx}"
            site["address"] = g["roadAddress"] or s["address"]
            site["lat"], site["lng"] = g["lat"], g["lng"]
            sites.append(site)
            if (idx + 1) % 300 == 0:
                print(f"    ...{idx + 1}/{len(sample)} (좌표 {len(sites)})")
        result[p["id"]] = sites
        print(f"    → 좌표 확보 {len(sites)}개")
        # 중간 저장(장시간 작업 안전)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    total = sum(len(v) for v in result.values())
    print(f"WROTE {os.path.normpath(OUT)}  (총 {total} 사이트)")

if __name__ == "__main__":
    main()
