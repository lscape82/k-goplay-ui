import csv
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path


AREAS = {
    "dosan-daero": ["신사", "압구정", "도산", "가로수길", "청담", "학동", "강남구청"],
    "samseong-coex": ["삼성역", "코엑스", "봉은사", "무역센터", "한국무역센터"],
    "gangnam-daero": ["강남역", "강남대로", "신논현", "양재역", "역삼역"],
    "myeongdong-euljiro": ["명동", "을지로입구", "롯데백화점", "남대문", "퇴계로"],
    "gwanghwamun": ["광화문", "경복궁", "세종문화회관", "서울신문사", "종로1가"],
    "yeouido": ["여의도", "여의나루", "국회의사당", "IFC", "더현대"],
    "hongdae": ["홍대입구", "홍익대학교", "합정역", "상수역", "연남동"],
    "seongsu": ["성수역", "성수동", "서울숲", "뚝섬역"],
    "jamsil": ["잠실역", "롯데월드", "석촌호수", "잠실새내"],
    "seoul-station": ["서울역", "남대문경찰서", "숭례문"],
    "mapo": ["마포역", "공덕역", "마포경찰서", "공덕오거리"],
}

BUCKETS = [
    ("05~09", range(5, 9)),
    ("09~12", range(9, 12)),
    ("12~14", range(12, 14)),
    ("14~18", range(14, 18)),
    ("18~23", range(18, 23)),
    ("23~05", [23, 0, 1, 2, 3, 4]),
]

DATA_SOURCE = "서울시 버스노선별 정류장별 시간대별 승하차 인원 정보 2026년 5월"
API_URL = "https://data.seoul.go.kr/dataList/dataView.do"


def parse_axisj_response(text):
    try:
        normalized = re.sub(r"([,{])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', text)
        return json.loads(normalized)
    except json.JSONDecodeError:
        script = """
const fs = require('fs');
const vm = require('vm');
const input = fs.readFileSync(0, 'utf8');
const value = vm.runInNewContext('(' + input + ')', Object.create(null), { timeout: 5000 });
process.stdout.write(JSON.stringify(value));
"""
        completed = subprocess.run(
            ["node", "-e", script],
            input=text,
            text=True,
            encoding="utf-8",
            capture_output=True,
            check=True,
        )
        return json.loads(completed.stdout)


def fetch_keyword(keyword):
    params = {
        "onepagerow": "5000",
        "srvType": "S",
        "infId": "OA-12913",
        "serviceKind": "0",
        "pageNo": "1",
        "filterCol": "SBWY_STNS_NM",
        "txtFilter": keyword,
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        text = response.read().decode("utf-8", errors="replace")
    return parse_axisj_response(text).get("list", [])


def clean_stop_name(name):
    return re.sub(r"\([^)]*\)", "", name or "").strip()


def row_total(row):
    total = 0
    hours = [0] * 24
    for key, value in row.items():
        match = re.match(r"HR_(\d+)_GET_(?:ON|OFF)_T?NOPE", key)
        if not match:
            continue
        try:
            count = int(str(value).replace(",", "") or 0)
        except ValueError:
            count = 0
        hour = int(match.group(1))
        if 0 <= hour <= 23:
            hours[hour] += count
            total += count
    return total, hours


def collect_area_metrics():
    result = {}
    response_cache = {}
    for slug, keywords in AREAS.items():
        stops = {}
        for keyword in keywords:
            rows = response_cache.setdefault(keyword, fetch_keyword(keyword))
            for row in rows:
                if row.get("USE_YM") and row.get("USE_YM") != "202605":
                    continue
                stop_name = clean_stop_name(row.get("SBWY_STNS_NM"))
                total, hours = row_total(row)
                if not stop_name or total <= 0:
                    continue
                key = (row.get("STOPS_ID") or "", row.get("STOPS_ARS_NO") or "", stop_name)
                stop = stops.setdefault(
                    key,
                    {
                        "station": stop_name,
                        "ars": row.get("STOPS_ARS_NO") or "",
                        "users": 0,
                        "hours": [0] * 24,
                    },
                )
                stop["users"] += total
                stop["hours"] = [a + b for a, b in zip(stop["hours"], hours)]

        top_stops = sorted(stops.values(), key=lambda item: item["users"], reverse=True)[:5]
        hourly = [0] * 24
        for stop in top_stops:
            hourly = [a + b for a, b in zip(hourly, stop["hours"])]

        result[slug] = {
            "busMonthlyUsers": [
                {"station": stop["station"], "ars": stop["ars"], "users": stop["users"]}
                for stop in top_stops
            ],
            "busHourlyUsers": [
                {"label": label, "users": sum(hourly[hour] for hour in hours)}
                for label, hours in BUCKETS
            ],
            "busDataSource": DATA_SOURCE,
        }
    return result


def write_areas_json(metrics):
    path = Path("data/areas.json")
    areas = json.loads(path.read_text(encoding="utf-8"))
    for area in areas:
        area_metrics = metrics.get(area["slug"])
        if area_metrics:
            area.update(area_metrics)
    path.write_text(json.dumps(areas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_areas_csv(metrics):
    path = Path("data/areas.csv")
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
        fieldnames = list(rows[0].keys()) if rows else []

    for field in ["busMonthlyUsersSummary", "busDataSource"]:
        if field not in fieldnames:
            fieldnames.append(field)

    for row in rows:
        area_metrics = metrics.get(row.get("slug"))
        if not area_metrics:
            continue
        row["busMonthlyUsersSummary"] = "; ".join(
            f"{stop['station']} {stop['users']}" for stop in area_metrics["busMonthlyUsers"]
        )
        row["busDataSource"] = area_metrics["busDataSource"]

    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    metrics = collect_area_metrics()
    write_areas_json(metrics)
    write_areas_csv(metrics)
    for slug, area_metrics in metrics.items():
        total = sum(stop["users"] for stop in area_metrics["busMonthlyUsers"])
        print(f"{slug}: {total:,}")


if __name__ == "__main__":
    main()
